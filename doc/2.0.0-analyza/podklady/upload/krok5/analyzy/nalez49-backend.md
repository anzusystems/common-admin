# Nález 49, backendová polovica: spracovanie metadát v core-dam a hromadné uloženie (overenie, 9. 10.)

Zadanie: vlastník chce nález 49 overiť poriadne (denník `upload-postup.md:167`, `:433`; podozrenie v
`analyzy/pv9-riadok-hromadnej-upravy.md:290-295`). Toto je polovica core-dam; admin-dam overuje súbežne iný agent.
Kód som len čítal, nič nespúšťal ani nevolal.

Skratky: `CD/` = core-dam `vendor/anzusystems/core-dam-bundle/src/`, verzia **1.52.0**, ref `c9d62929`
(`core-dam/composer.lock:305-310`, `vendor/composer/installed.json:311-317`; v `anzusystems/` nie je zdrojová kópia
balíka, aplikácia `core-dam/src` triedy z tejto témy neprepisuje ani nedekoruje); `CB/` = `vendor/anzusystems/common-bundle/src/`
11.4.1 (`composer.lock:149-150`); `C/` = `/home/volar/projects/petit/core-dam/`; `DAM/` = admin-dam `src/`; `LIB/` =
common-admin `src/`.

## 0. V skratke

1. **Mechanizmus potvrdený.** `PATCH /adm/v1/asset/metadata-bulk-update` nemá žiadnu ochranu pred zastaraným
   formulárom (verzia, `modifiedAt`, stav súboru, zámok). Uloženie s `described: true` po spracovaní prepíše
   alebo zmaže vlastné polia, ktoré doplnil EXIF (titulok, popis, autor…), celé nahradí kľúčové slová a autorov,
   zmaže návrhy a konflikty autorov. Keďže je potom asset `described`, spracovanie už nikdy nič nedoplní.
2. **Metadáta sa spracujú skoro.** Nespracúvajú sa až po dokončení nahrávania, ale asynchrónne z **prvého kúska**
   hneď počas nahrávania (Pub/Sub). Najneskôr sa doplnia v tej istej transakcii, ktorá súbor prepne na `processed`.
   Platí teda: súbor `processed` ⇒ metadáta sú v DB.
3. **Dosiahnuteľnosť.** Nový asset je hneď po založení čitateľný z DB a v Elasticsearch je so stavom `draft`.
   Predvolený filter zoznamu admin-dam (`status: [with_file]`) ho ukáže až po spracovaní a preindexovaní, keď už
   metadáta v DB sú. **Predvolená cesta je teda zatvorená.** Otvorená je, ak si používateľ vo filtri zvolí „draft“
   (filter to ponúka), alebo ak sa id assetu dostane do hromadnej úpravy inou cestou (to overuje frontend agent).
   Okno trvá od založenia assetu po spracovanie prvého kúska, zvyčajne niekoľko sekúnd (odhad, nemerané), pri
   nahromadených úlohách v Pub/Sub dlhšie.
4. **Notifikácia nepomôže každému.** `asset_metadata_processed` a `asset_file_*` dostane len `AssetFile.notifyTo`,
   teda ten, kto súbor nahral. Kto hromadne upravuje cudzí asset, nedostane nič.
5. **Uloženie z detailu a z bočného panela** zoznamu ide tou istou cestou (jedna položka, `described: true`), takže
   má to isté riziko. `PUT /adm/v1/asset/{id}` metadáta nemení.
6. **Opačný smer** (spracovanie prepíše čerstvé uloženie používateľa) je tiež možný, ale len v krátkom okne
   (zlomok sekundy až sekunda, odhad). Je to vec core-dam, nie tohto projektu.

## 1. Spracovanie nahraného súboru (obrázok; video, audio a dokument rovnako, `AbstractAssetFileStatusFacade`)

Notifikácie posiela `AbstractNotificationDispatcher::notify` synchrónne do Google Pub/Sub, témy notifikačného
servera (`CD/Notification/AbstractNotificationDispatcher.php:55-83`), a to len príjemcovi `AssetFile.notifyTo`
(`CD/Notification/AssetFileNotificationDispatcher.php:45-57`, `:62-73`). `notifyTo` nastaví každá HTTP požiadavka,
ktorá entitu zakladá alebo mení (`CD/Domain/AbstractManager.php:76-111`), teda pri súbore ten, kto ho založil a
dokončil.

| # | Krok (kde) | Súbor / asset | Notifikácia | Čo vidí klient |
|---|---|---|---|---|
| 1 | `POST /adm/v1/image/licence/{l}` → `createAssetFile` (`CD/Domain/AssetFile/AbstractAssetFileFacade.php:218-238`) | `uploading` (`CD/Model/Enum/AssetFileProcessStatus.php:19`) / `draft` (`CD/Model/Enum/AssetStatus.php:26`); `customData = []`, `described = false`, `autocompletedMetadata = false` (`CD/Entity/Embeds/AssetFlags.php:30-39`) | — | DB hneď (`GET /asset/{id}`, `/asset/licence/{l}/ids/…` bez filtra stavu, `CD/Repository/AssetRepository.php:82-92`); ES hneď so `status: draft` (`AbstractAssetFileFacade.php:231`, `CD/Elasticsearch/IndexFactory/AssetIndexFactory.php:68`) |
| 2 | prvý kúsok `POST /image/{id}/chunk` → `ChunkFacade::create` (`CD/Domain/Chunk/ChunkFacade.php:55-58`): po commite správa `AssetFileMetadataProcessMessage` | bez zmeny | — | — |
| 3 | worker `AssetFileMetadataProcessHandler` (`CD/Messenger/Handler/AssetFileMetadataProcessHandler.php:33-49`): exiftool na prvom kúsku → `MetadataProcessor::process` bez transakcie, flush je commit (`CD/Domain/AssetFile/FileProcessor/MetadataProcessor.php:30-46`) | súbor `processedMetadata = true`; asset: kľúčové slová, autori, návrhy, vlastné polia (časť 2) | `asset_metadata_processed`, po commite (`MetadataProcessor.php:43` → `CD/Event/Subscriber/MetadataProcessedSubscriber.php` → `AssetFileNotificationDispatcher.php:62-73`) | metadáta v DB; ES sa neindexuje |
| 4 | `PATCH /image/{id}/uploaded` → `finishUpload` (`CD/Domain/AssetFile/AbstractAssetFileStatusFacade.php:189-200`) | `uploaded` | `asset_file_uploaded`, v požiadavke (`:196`) | správa `ImageFileChangeStateMessage` (`:197`) |
| 5 | worker `AssetFileChangeStateHandler` (`CD/Messenger/Handler/AssetFileChangeStateHandler.php:79-117`) → `storeAndProcess` (`AbstractAssetFileStatusFacade.php:205-258`): zloženie súboru, kontrola duplikátu (`:270`), uloženie (`:281`) | `stored` (alebo `duplicate` / `failed`) | `asset_file_stored` / `_duplicate` / `_failed` (`:289`, `:236`, `:244`, `:252`) | — |
| 6 | `process` (`:299-321`), jedna DB transakcia: spracovanie obrázka (orezy, ROI; `CD/Domain/Image/ImageStatusFacade.php:45-61`); **ak metadáta ešte nie sú** (`:305-306`), krok 3 tu; `toProcessed`, kde asset `draft` → `with_file` (`CD/Domain/AssetFile/AssetFileStatusManager.php:65-76`); commit (`:309`) | `processed` / `with_file` | `asset_metadata_processed` (len ak sa metadáta robia tu, a to **pred commitom**), po commite `asset_file_processed` (`:318`) | DB `with_file` |
| 7 | `AssetRefreshPropertiesMessage` (`:310-311`) → `RefreshAssetPropertiesHandler` (`CD/Messenger/Handler/RefreshAssetPropertiesHandler.php:33-58`) preindexuje | — | — | ES `status: with_file` (stav podľa spracovaného slotu, `CD/Domain/Asset/AssetPropertiesRefresher.php:127-141`) |

- Asynchrónne: správy idú cez `gps://` (`C/.env:120`; DSN a smerovanie `CD/DependencyInjection/AnzuSystemsCoreDamExtension.php:106`,
  `:434`). Testy bežia so `sync://` (`C/.env.test:9`), takže testami sa časovanie overiť nedá. Opakovanie
  metadátového odberu: 2 s až 600 s (`:334-337`).
- Poradie v bežnom prípade: kroky 2 a 3 bežia počas nahrávania, teda metadáta sú pri viackúskovom súbore spravidla
  hotové pred krokom 4. Pri jednom kúsku pretekajú kroky 3 a 5 až 6. Ak krok 3 ešte nedobehol, krok 6 ho urobí sám
  (`:305`). Neskorší krok 3 už `customData` nemení (`autocompletedMetadata` je `true`), znova však spustí návrhy
  kľúčových slov a autorov (ak asset nie je `described`) a pošle `asset_metadata_processed` ešte raz.
- ES sa nikde neobnovuje vynútene (`CD/Elasticsearch/IndexManager.php:24-41`), takže zmena sa v zozname ukáže až po
  jeho bežnom obnovení (predvolene asi 1 s; nastavenie indexu som neoveroval).

## 2. Čo spracovanie vyplní a či prepisuje

| Čo | Podmienka | Prepisuje, alebo dopĺňa |
|---|---|---|
| `exifData` súboru, `processedMetadata` (`CD/Domain/AssetMetadata/AssetMetadataProcessor.php:40-57`) | vždy | prepíše; vo formulári nie je |
| kľúčové slová assetu, `keywordSuggestions` (`CD/Domain/AssetMetadata/Suggestion/KeywordSuggester.php:35-46`) | asset nie je `described` a typ má zapnuté značky (`CD/Domain/AssetMetadata/Suggestion/AbstractSuggester.php:43-50`); CMS obrázok: `Keywords`, `Subject` (`C/config/packages/anzu_systems_core_dam_ext_systems.php:44-50`) | návrhy prepíše; do assetu **pridá** slovo s jednou zhodou, ktoré tam ešte nie je, neexistujúce slovo založí (`:51-75`); nič neodoberie |
| autori assetu, `authorSuggestions` (`CD/Domain/AssetMetadata/Suggestion/AuthorSuggester.php:34-67`, `:109-127`) | to isté; `Artist`, `Creator`, `OwnerName` (`anzu_systems_core_dam_ext_systems.php:51-58`) | ako kľúčové slová; z návrhov s viac ako jednou zhodou robí admin-dam „konflikty autorov“ |
| vlastné polia `customData` (`CD/Domain/AssetMetadata/AssetMetadataAutocomplete.php:30-51`) | asset nie je `described` **a** ešte nebol doplnený (`MetadataProcessor.php:35`); každý prvok formulára s `exifAutocomplete` vezme prvú neprázdnu značku | `array_merge(staré, doplnené)` (`:44-47`): pri kľúči, kde EXIF hodnotu má, **prepíše** aj vyplnenú hodnotu; ostatné kľúče nechá; potom `autocompletedMetadata = true` (`:48`), teda pre asset len raz |

Ktoré vlastné polia sa doplnia, určuje formulár v DB. Migrácie ukazujú upraviteľné (nie iba na čítanie) polia
titulok, popis, autor či autori a kľúčové slová (`C/src/Migrations/Version20260922120000_daily_tools.php:254-288`,
`C/src/Migrations/Version20221230133349.php:56-90`). Produkčné formuláre som neoveroval (sú v DB). Inde sa
`autocompleteMetadata` nevolá (grep v `CD/` aj `C/src/`).

## 3. Čo robí `metadata-bulk-update` s každým poľom

Cesta: `CD/Controller/Api/Adm/V1/AssetController.php:196-210` → `AssetMetadataBulkFacade::bulkUpdate`
(`CD/Domain/AssetMetadata/AssetMetadataBulkFacade.php:46-80`) → `AssetMetadataBulkManager::updateFromMetadataBulkDto`
(`CD/Domain/Asset/AssetMetadataBulkManager.php:25-41`). Pole, ktoré v požiadavke chýba, ostane nedotknuté (`is…Undefined`
= `isset`, `CD/Model/Dto/Asset/FormProvidableMetadataBulkUpdateDto.php:89-92`, `:113-116`, `:153-156`, `:176-179`).

| Pole | Keď je v požiadavke |
|---|---|
| `customData` | **Nezlučuje sa po kľúčoch.** Prechádzajú sa všetky prvky formulára okrem tých, ktoré sú iba na čítanie: kľúč v požiadavke → prepíše; kľúč chýba → **zmaže sa** (`CD/Domain/AssetMetadata/AssetMetadataManager.php:60-81`). Ostanú len kľúče mimo formulára a prvky iba na čítanie. |
| `keywords` | celá kolekcia sa nahradí (`AssetMetadataBulkManager.php:43-53`, `CB/Domain/AbstractManager.php:111-146`) |
| `authors` | celá kolekcia sa nahradí a autori sa nahradia „súčasnými“ (`AssetMetadataBulkManager.php:55-66`, `CD/Domain/Author/AuthorProvider.php:44-64`) |
| `described` | nastaví sa; pri `true` sa vymažú `authorSuggestions` aj `keywordSuggestions` (`AssetMetadataBulkManager.php:129-141`, `AssetMetadataManager.php:45-55`) |
| `mainFileSingleUse`, `…Internal`, `…OverrideInternal`, `ttsAudio` | nastaví sa (`AssetMetadataBulkManager.php:68-111`) |

- Kontroly: ACL `DAM_ASSET_UPDATE` (`AssetMetadataBulkFacade.php:101-115`), hodnoty polí formulára
  (`CD/Validator/Constraints/CustomDataValidator.php:61-79`) a pri `described: true` povinné kľúčové slová a autori
  (`CD/Validator/Constraints/AssetValidator.php:27-57`). **Stav súboru, verziu ani čas zmeny nikto nekontroluje.**
  DTO také pole nemá (`FormProvidableMetadataBulkUpdateDto.php:24-50`) a v balíku nie je `ORM\Version` (grep).
  Pesimistické zámky sú len pri TTS.
- Vplyv na neskoršie spracovanie: `described = true` natrvalo vypne doplnenie vlastných polí (`MetadataProcessor.php:35`)
  aj návrhy (`AbstractSuggester.php:47`). `autocompletedMetadata` uloženie nemení.
- Čo posielajú klienti: admin-dam hromadne `keywords`, `authors`, `customData` a `described: true`
  (`DAM/domains/coreDam/asset/api/assetApi.ts:211-218`), knižnica rovnako (`LIB/domains/dam/api/damAssetApi.ts:224-231`,
  `:278`, `:318`). Čiastočné uloženie už existuje: knižnica pri autoroch galérie posiela len `{id, authors}`
  (`damAssetApi.ts:354-365`) a ostatné polia backend nechá.

## 4. Okná súbehu

### 4.1 Kedy sa dá nový asset prečítať

- Z DB (detail, čítanie po id, ktoré používa hromadné načítanie DAM `DAM/domains/coreDam/asset/store/uploadQueuesStore.ts:519`):
  od kroku 1, bez ohľadu na stav (`AssetController.php:139-150`, `:168-175`).
- Zo zoznamu (ES): od kroku 1 so stavom `draft`, so stavom `with_file` až po kroku 7. admin-dam má predvolený filter
  `status: [with_file]` (`DAM/domains/coreDam/asset/filter/AssetFilter.ts:10`), ale používateľ si môže zvoliť „draft“
  (`DAM/domains/coreDam/asset/components/list/components/AssetListFilterForm.vue:85-88`, možnosti
  `DAM/domains/coreDam/asset/valueObject/DamAssetStatus.ts:11-19`).
- Z toho plynie: v predvolenom zozname sa nový asset objaví až vtedy, keď sú jeho metadáta v DB, takže nález 49 tadiaľ
  nenastane. Či sa asset v stave „draft“ dá zo zoznamu označiť a poslať do hromadnej úpravy, a či do nej vedie iná
  cesta, overuje frontend agent.

### 4.2 Hlavný smer (nález 49): zastaraný formulár prepíše spracovanie

Podmienka: formulár sa načíta medzi krokom 1 a krokom 3 (alebo 6), uloží sa až po nich. Okno začína založením assetu
a končí dobehnutím kroku 3, zvyčajne sekundy po prvom kúsku (odhad: doručenie z Pub/Sub a exiftool, nemerané). Pri
nahromadených úlohách alebo pri chybe (opakovanie 2 s až 600 s) sa natiahne, najdlhšie však po krok 6. Výsledok
uloženia:

- vlastné polia z EXIF dostanú hodnotu z formulára (bežne prázdnu), alebo sa zmažú, ak kľúč chýba;
- kľúčové slová a autori z EXIF zmiznú, návrhy aj konflikty autorov sa vymažú;
- `described = true`, takže spracovanie ich už nikdy nedoplní. Strata je tichá a pre asset trvalá.

Ak používateľ uloží **pred** krokom 3, spracovanie pre `described` nič nedoplní. Je to zámer backendu („popísal
človek“) a používateľ uložil to, čo videl. Za stratu to nepovažujem.

Okrajový prípad: návrhy kľúčových slov a autorov bežia pri každom novom súbore nepopísaného assetu (`AbstractSuggester.php:47`),
napríklad pri súbore do ďalšieho slotu assetu, ktorý už je `with_file` a je v zozname. Hromadné uloženie potom slová
a autorov pridaných medzitým odoberie. Je to zriedkavé, len pre úplnosť.

### 4.3 Opačný smer: spracovanie prepíše čerstvé uloženie

Ak sa uloženie používateľa zapíše vo chvíli, keď už worker v kroku 3 alebo 6 má asset v pamäti, ale ešte ho
nezapísal, worker podľa svojej kópie vidí `described = false`, doplní polia a zapíše celý JSON `customData`
(stará kópia spojená s doplneným). Tým zmizne, čo používateľ práve uložil, a znova sa objavia návrhy. Okno trvá od
načítania assetu workerom (najneskôr pri návrhoch, `AbstractSuggester.php:47`) po zápis (`MetadataProcessor.php:39-42`),
odhadom do sekundy. Kedy presne Doctrine asset načíta, som nesledoval. Nič tomu nebráni: zámok
`lock_suggester_<asset>` drží len spracovanie (`AssetMetadataProcessor.php:60-74`), uloženie ho neberie a zámok
v kroku 5 sa týka typu a licencie kvôli duplikátom (`AbstractAssetFileStatusFacade.php:207-215`).

### 4.4 Notifikácie a poradie

- Príjemcom je len `AssetFile.notifyTo` (časť 1). Hromadné uloženie mení `notifyTo` assetu, nie súboru
  (`CD/Domain/Asset/AssetManager.php:43-52` sleduje len asset; odvodené, neoverené behom).
- V kroku 6 ide `asset_metadata_processed` ešte pred commitom. Čítanie, ktoré by klient spustil hneď, by teoreticky
  mohlo vidieť staré dáta. Prakticky je klient pomalší (Pub/Sub, notifikačný server, websocket, HTTP); neoverené.
- Poradie doručenia v notifikačnom serveri som neoveroval (rovnako ako PV9, 1.6).

## 5. Uloženie jedného assetu (detail, bočný panel zoznamu)

`updateAssetMetadata` (`DAM/domains/coreDam/asset/api/assetApi.ts:296-316`), ktorý volajú detail
(`DAM/domains/coreDam/asset/components/detail/components/AssetDetailSidebarMetadata.vue:53`) aj bočný panel zoznamu
(`DAM/domains/coreDam/asset/components/list/components/AssetListSidebarMetadata.vue:73`), posiela **ten istý**
`metadata-bulk-update` s jednou položkou: `keywords`, `authors`, `customData` a `described: true`. Backend je teda ten
istý a riziko tiež, ak sa formulár načíta pred krokom 3. `PUT /adm/v1/asset/{id}` mení len `distributionCategory`
(`CD/Domain/Asset/AssetManager.php:29-38`). Či sa detail dá otvoriť pre nespracovaný asset a či sa po notifikácii
obnoví, je frontendová otázka. Rovnaký endpoint majú aj uloženia prekrytia uploadu
(`DAM/…/footer/AssetFooterUploadOverlayFull.vue:84`, `:104`) a knižnica (časť 3).

## 6. Čo z toho plynie pre opravu (fakty pre frontend)

- Spoľahlivý znak, že sa metadáta už nezmenia, je hlavný súbor v stave `processed` (metadáta sú v tej istej transakcii
  alebo skôr, `AbstractAssetFileStatusFacade.php:305-309`), prípadne asset `with_file`. Hromadné načítanie oba stavy
  vracia: `mainFile.fileAttributes.status` (`CD/Model/Dto/AssetFile/Embeds/AssetFileAttributesAdmDto.php:16-17` cez
  `CD/Model/Dto/AssetFile/AbstractAssetFileAdmDto.php:21,38` a `CD/Model/Dto/Asset/AssetAdmDetailDto.php:147-148`), `attributes.assetStatus` (`CD/Model/Dto/Asset/Embeds/AssetAttributesAdmDto.php:15`)
  a `flags.described` (`CD/Model/Dto/Asset/Embeds/AssetFlagsAdmDto.php:12-18`). Príznaky `processedMetadata` a
  `autocompletedMetadata` API nevracia (`CD/Entity/Embeds/AssetFileFlags.php:13-14` bez `Serialize`).
- Rizikový riadok je ten, kde asset nie je `described` a hlavný súbor je `uploading`, `uploaded` alebo `stored`.
- Oprava založená len na notifikácii nepokryje cudzí asset (4.4). Oprava podľa stavu z čítania pokryje všetkých.
- Backend je jednoduchší nechať tak: kontrola verzie (409) alebo odmietnutie `described: true` pre nespracovaný
  asset sú zmenou API `core-dam-bundle`, mimo tohto projektu.

## 7. Neoverené

- Časy (oneskorenie Pub/Sub, počet workerov, nahromadené úlohy): záleží od nasadenia, nemerané.
- Produkčné vlastné formuláre a ktoré ich polia majú `exifAutocomplete` (sú v DB).
- Kedy presne worker načíta asset do pamäte (dĺžka okna v 4.3).
- Poradie doručenia notifikácií a čítanie pred commitom v kroku 6.
- Či sa asset v stave „draft“ dá v admin-dam označiť do hromadnej úpravy, alebo sa tam dostane inak (frontend agent).

## Verdikt

**Backendová časť nálezu 49 platí.** Zastarané hromadné uloženie (aj uloženie jedného assetu) s `described: true`
po spracovaní ticho a natrvalo nahradí to, čo spracovanie doplnilo z EXIF, a backend tomu nijako nebráni. Okno však
existuje len pre asset, ktorého hlavný súbor ešte nie je spracovaný. Predvolený zoznam admin-dam taký asset neukáže,
takže prípad je **reálny, ale zriedkavý**: treba filter „draft“ alebo inú cestu do hromadnej úpravy a konať do
niekoľkých sekúnd od začiatku nahrávania. Škoda je stredná (titulok, popis, kľúčové slová a autori z agentúrnych
fotiek), frekvencia nízka. Opravu treba robiť vo frontende podľa stavu súboru z čítania, nie podľa notifikácie.
Backend nemeniť.

## Pre vlastníka

1. **Na vedomie:** core-dam pri hromadnom uložení s `described: true` nahradí všetky upraviteľné vlastné polia,
   kľúčové slová a autorov tým, čo poslal formulár, a spracovanie ich potom už nikdy nedoplní. Ochrana proti
   zastaranému formuláru neexistuje. **Potvrdené z kódu.**
2. **Na vedomie:** s predvoleným filtrom zoznamu (len „so súborom“) sa nový asset do hromadnej úpravy pred spracovaním
   metadát nedostane. Nález 49 nastane len s filtrom „draft“ alebo inou cestou (overuje frontend agent).
   **Odporúčam viesť ho ako zriedkavý, reálny a neblokujúci krok 5.**
3. Opravu stavať na stave hlavného súboru z hromadného čítania (`processed` / nepopísaný), nie na notifikácii, ktorá
   príde len tomu, kto súbor nahral. **Odporúčam áno.** Veľkosť a krok určí frontendová analýza (podľa mňa
   samostatný malý krok v admin-dam po K6, podobne ako F5).
4. To isté pravidlo použiť aj pre uloženie z detailu a bočného panela zoznamu, ak sa dajú otvoriť pre nespracovaný
   asset (rovnaký endpoint). **Odporúčam áno**, ak to frontend potvrdí. Je to súčasť toho istého kroku.
5. Uloženie **pred** spracovaním (spracovanie potom pre `described` nič nedoplní) brať ako zámer backendu a nemeniť.
   **Odporúčam áno.**
6. Backend (`core-dam-bundle`) v tomto projekte nemeniť: kontrola verzie alebo odmietnutie uloženia nespracovaného
   assetu sú zmenou API. **Odporúčam nie**; prípadne samostatná úloha pre core-dam.
7. **Na vedomie:** opačný súbeh (spracovanie v krátkom okne prepíše práve uložené polia) je chyba core-dam a frontend
   ju neopraví. **Odporúčam** zapísať ju ako úlohu pre core-dam, mimo krokov tohto projektu (0 h tu).
8. Knižnica používa ten istý endpoint s `described: true` (`damAssetApi.ts:228`, `:278`, `:318`). Či jej upload či
   widgety môžu dať formulár pred spracovaním metadát, nech overí frontend agent alebo agent knižnice. **Potvrdiť
   rozsah.**
