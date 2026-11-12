# Nález 49, strana frontendu (admin-dam a knižnica): formulár metadát načítaný pred spracovaním nového assetu (overenie, 9. 10.)

Zadanie: vlastník chce nález 49 overiť poriadne (`upload-postup.md:167`, `:433`). Toto je frontendová polovica:
admin-dam a po doplnení zadania aj knižnica. Backend overil iný agent (`analyzy/nalez49-backend.md`), jeho fakty
tu len preberám. Podnet: `analyzy/pv9-riadok-hromadnej-upravy.md`, časť 5. Kód som čítal v dnešnom nezakomitovanom
stave oboch stromov, core-dam-bundle 1.52.0 len na čítanie. Spustil som jediný beh: dva súbory testov DAM s filtrom
(časť 8).

Skratky: `D-st` = admin-dam `src/domains/coreDam/asset/store/uploadQueuesStore.ts`; `D-api` = admin-dam
`src/domains/coreDam/asset/api/assetApi.ts`; `D-la` = admin-dam
`src/domains/coreDam/asset/components/list/composables/assetListActions.ts`; `AQIE` = admin-dam
`src/domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue`; `L-se` = LIB
`src/domains/dam/uploadQueue/settlement/uploadSettle.ts`; `L-sm` = LIB `…/settlement/uploadSettlement.ts`;
`L-st` = LIB `src/domains/dam/uploadQueue/store/uploadQueuesStore.ts`; `L-api` = LIB `src/domains/dam/api/damAssetApi.ts`;
`L-uq/` = LIB `src/domains/dam/uploadQueue/components/`; `L-iw/` = LIB `src/domains/dam/imageWidget/components/`;
`L-as/` = LIB `src/domains/dam/assetSelect/`; `LT-s` = LIB `…/settlement/__tests__/uploadSettle.test.ts`;
`DT/` = admin-dam `src/test/`; `CD/` = core-dam `vendor/anzusystems/core-dam-bundle/src/`.

Pravidlo z backendu (`nalez49-backend.md`, časti 1 a 6): keď je hlavný súbor `processed`, metadáta sú v DB.
Riziko nesie asset, ktorý **nie je `described`** a jeho hlavný súbor je **`uploading`, `uploaded` alebo
`stored`**. Čítanie assetu vracia `mainFile.fileAttributes.status` aj `flags.described`. `processedMetadata` API
nevracia, preto sa nedá zistiť, že metadáta prišli už z prvého kúska.

## 0. V skratke

1. **admin-dam, hromadná úprava:** jediný vstup je zoznam assetov a nekontroluje stav. Pri predvolenom filtri
   („Obsahuje súbor") sa nový asset do zoznamu dostane až so svojimi metadátami. Nespracovaný asset sa dá zaškrtnúť
   len tak, že používateľ zvolí filter „Stav: Koncept", zruší čip „Obsahuje súbor" alebo hľadá podľa ID či URL
   (takéto hľadanie vypne ostatné filtre), a to v okne sekúnd pred spracovaním metadát prvého kúska.
2. **admin-dam, detail a pravý panel:** otvoria a uložia nespracovaný asset bez akejkoľvek kontroly. Uloženie
   pošle všetko s `described: true` a notifikácia ich nikdy neobnoví. Vstupy sú tie isté ako pri bode 1, plus
   priame adresy `/assets/<id>` a `/assets/file/<id>`.
3. **Zvyšok reťaze platí:** riadok s formulárom notifikáciu metadát odmietne (`L-se:578`) a hromadné uloženie
   pošle každé pole každého upraviteľného riadku, aj nedotknuté, s `described: true` (`D-api:208-226`). Backend
   tomu nebráni.
4. **Knižnica:** riadky uploadu (okno pre viac súborov aj dialóg pre jeden súbor) a riadky kópie do licencie
   dostanú formulár až po spracovaní metadát. Výber assetov ukazuje len `with_file` a filter stavu nemá. Nespracovaný
   asset sa do knižnice dostane len vložením čerstvého ID do hľadania vo výbere. Potom ho „Upraviť v DAM" vo výbere
   aj „Upraviť asset" vo widgete otvoria s uložením bez kontroly, a widget pri jeho výbere môže poslať autorov s
   `described: true` (`L-api:318`).
5. **Ten istý tvar, častejší, nový nález (nie 49):** keď používateľ v admin-dam uloží asset v pravom paneli alebo
   v detaile otvorenom zo zoznamu, riadok hromadnej úpravy toho istého assetu si hodnoty nezapíše. Neskoršie
   hromadné uloženie ich potom vráti späť.
6. **Oprava podľa stavu z čítania** (nie podľa notifikácie, ktorá chodí len tomu, kto asset nahral): v admin-dam
   hromadná úprava rizikovému assetu formulár nedá a detail s panelom mu vypnú „Uložiť"; v knižnici sa vypne
   „Uložiť" detailu. Časť 7, spolu asi 4–5 h v DAM a 1,5 h v LIB.
7. **Verdikt:** možné len ak (časť 9). Priorita nízka, krok 5 to neblokuje.

## 1. admin-dam: dá sa nespracovaný asset dostať do hromadnej úpravy?

### 1.1 Vstupy

- Riadok typu `Asset` (rola `massEdit`, `D-st:82-93`) vzniká len v `addByAssets` (`D-st:427-458`). Volá ho len
  zoznam assetov: `toggleSelected` (`D-la:341-353`) a `selectMultiple` (`D-la:355-390`), z dlaždíc aj z riadkov
  tabuľky (`list/components/AssetListItem.vue:42-58,90-115`, `AssetTableRowItem.vue:60-89`). Grep `addByAssets`
  mimo testov iné miesto nenájde. Externí poskytovatelia plnia tú istú frontu riadkami iného typu
  (`ExternalProviderAsset`), nie assetmi DAM.
- Kontroluje sa len limit počtu (`D-la:347-350,376-381`). Stav assetu, stav hlavného súboru ani `described`
  nekontroluje zoznam, `addByAssets` ani `fetchLazyAdditionalMetadata` (`D-st:517-540`).
- Notifikácie zoznam nemenia: `src/domains/system/composables/appNotificationListeners.ts:27-69` píše len do front a
  distribúcií. Zoznam sa obnoví len pri pripojení stránky, zmene filtra, triedení, tlačidle „Obnoviť"
  (`list/AssetListView.vue:71-73,86-91,162-176`) a po uložení okna uploadu
  (`footer/AssetFooterUploadOverlayFull.vue:85,107`).

### 1.2 Čo zoznam ukáže a čo sa dá zaškrtnúť

- Predvolený filter stavu je `[with_file]` (`src/domains/coreDam/asset/filter/AssetFilter.ts:10`); ďalej platí
  `visible: true` a `generatedBySystem: false` (`:22-23`). Nový asset má `visible` predvolene `true`
  (`CD/Entity/Embeds/AssetFlags.php:33`).
- Používateľ môže vybrať aj „Koncept" a „Vymazávaný" (`AssetListFilterForm.vue:84-89`,
  `asset/valueObject/DamAssetStatus.ts`, texty `locales/sk/coreDam/asset.json:79-82`). Alebo zruší čip „Obsahuje
  súbor", pretože krížik odoberie jednu hodnotu poľa (LIB `src/domains/filters/components/FiltersSelected.vue:39-42,81-84`),
  a filter stavu potom nie je žiadny. Koncept sa vykreslí so šedou ikonou (`asset/components/AssetImage.vue:99-105`) a
  zaškrtne sa ako každý iný.
- Pri hľadaní podľa ID text, ktorý je UUID alebo URL obrázka (`CD/Elasticsearch/SearchDto/AssetAdmSearchDto.php:821-828`),
  aj pole filtra „Id" (`AssetListFilterForm.vue:36`), vypnú všetky ostatné filtre okrem licencie
  (`CD/Elasticsearch/QueryFactory/AssetQueryFactory.php:121,144-155`). Riadok uploadu má „Kopírovať asset ID"
  (`locales/sk/coreDam/asset.json:247`) od chvíle, keď server asset vytvoril (`AQIE:379-384`; `assetId` z odpovede
  `uploadInit`, `shared/services/upload/uploadService.ts:228-249`).

### 1.3 Kedy je nový asset v indexe a s akým stavom (podľa `nalez49-backend.md`, časť 1)

| čas | čo sa stane | stav v DB / v indexe | metadáta v DB |
|---|---|---|---|
| T0 | `uploadInit`: súbor aj asset vzniknú a index sa zapíše v tej istej transakcii (`CD/Domain/AssetFile/AbstractAssetFileFacade.php:218-238`) | `draft` / `draft` (v hľadaní po obnovení ES) | žiadne |
| T1 | worker spracuje metadáta prvého kúska (≤ 10 MB, `D-st:80`): EXIF, návrhy, vlastné polia, ak asset nie je popísaný; potom notifikácia `asset_metadata_processed` (`CD/Domain/Chunk/ChunkFacade.php:57-59`, `FileProcessor/MetadataProcessor.php:30-46`) | `draft` / `draft` | **doplnené** |
| T2 | spracovanie súboru. Ak metadáta ešte nie sú, urobia sa tu. `toProcessed` prepne asset na `with_file`, všetko v jednej transakcii (`AbstractAssetFileStatusFacade.php:299-321`) | `with_file` / ešte `draft` | hotové |
| T3 | po commite nový zápis indexu (`AbstractAssetFileStatusFacade.php:310-312`, `CD/Messenger/Handler/RefreshAssetPropertiesHandler.php:33-43`) | `with_file` / `with_file` | hotové |

- **S predvoleným filtrom** sa nový asset objaví až po T3 a po obnovení zoznamu; metadáta vtedy v DB sú. Nález 49
  tu nenastane.
- **S Konceptom alebo podľa ID** je asset v zozname od T0. Nebezpečné okno je T0 → T1: čas prvého kúska, čakanie
  vo fronte workera a exiftool. Bežne to trvá sekundy; pri nahrávaní rýchlosťou 10 Mbit/s trvá len kúsok asi 8 s
  (výpočet, nemerané). Pri chybe spracovania prvého kúska sa okno natiahne do T2 (backend 4.2). Veľký súbor okno
  nepredĺži, lebo metadáta idú z prvého kúska.

### 1.4 Odpoveď

Áno, dá sa: filtrom „Koncept", zrušeným čipom „Obsahuje súbor" alebo hľadaním podľa ID či URL, a len v okne
T0 → T1. Iná cesta do hromadnej úpravy nevedie.

## 2. Čo dávka načíta a čo riadok potom dostane

- Riadok pred načítaním (`D-st:432-446`) má stav `Loading`, `assetStatus` (tu `draft`), názov, `assetId`,
  `fileId` hlavného súboru, prepínač jednorazového použitia a náhľad `image_list` (koncept ho nemá).
- Dávka (`D-st:454-457,517-540`) volá `GET /adm/v1/asset/licence/{licencia}/ids/{ids}` po 50 kusoch
  (`D-api:81-124`). Číta z databázy a bez filtra stavu (`CD/Repository/AssetRepository.php:82-92`). Do riadku
  zapíše `keywords`, `authors`, `metadata.customData`, `mainFileSingleUse` a konflikty autorov, a nastaví
  `Uploaded` a `canEditMetadata = true`. Stav hlavného súboru ani `flags.described`, ktoré odpoveď nesie,
  nečíta. V okne T0 → T1 teda riadok dostane prázdne zoznamy a prázdne vlastné polia s otvoreným formulárom.
- Potom riadok nič neobnoví:
  - **Notifikácia metadát** chodí len tomu, kto asset nahral (`CD/Notification/AssetFileNotificationDispatcher.php:62-72`).
    Vyvolá čítanie o 2 s (`L-sm:631-638`, LIB `…/settlement/uploadPollSchedule.ts:48-49`), potom
    `tryLoadMetadata` (`L-se:643`), ktoré **skončí na `row.canEditMetadata`** (`L-se:578`). Na `metadataGate`
    (`D-st:252`) sa pýta len riadok `Failed` (`L-se:582`).
  - **Notifikácia „spracovaný":** `settleProcessedByEvent` rolu `never` vynechá (`L-se:380`) a `onProcessedSeen`
    zmaže len chybu (`D-st:269-275`). Čítanie o 250 ms doplní len stav assetu a náhľad (`L-se:616-618,173-190`).
  - Dopytovanie riadok nesleduje a **„Obnoviť"** sa načítanému riadku neukáže (`AQIE:220-258`).
  - Pripínajú to testy: DAM `DT/queue/notificationSettlesQueue.test.ts:569-580` (riadok hromadnej úpravy si po
    notifikácii metadát nechá `['typed']`) a `:526-545`; LIB `LT-s:181-202` (N-S3: riadok so zapnutým formulárom
    nedostane nič, „ani keď mu metadáta tu nikdy načítané neboli").
- Pravidlo „do riadku s formulárom nič" chráni to, čo používateľ napísal. Riadok však nerozlišuje napísané a
  načítané pole, takže rovnako chráni aj prázdne pole z času načítania.
- Riadok sa obnoví len dvoma spôsobmi: odznačiť a znova označiť (`D-la:341-353`, nové načítanie), alebo uložiť
  detail otvorený z tohto riadku cez „Upraviť", keď je `view = 'queue'` (`AssetDetailSidebarMetadata.vue:60-62`,
  `D-st:857-868`).

## 3. Čo pošle hromadné uloženie

- Uloží sa každý riadok s `assetId` a `canEditMetadata` (`D-api:205-206`), aj nedotknutý. Ide po 10 riadkoch v
  jednom `PATCH /adm/v1/asset/metadata-bulk-update` (`D-api:58,228-242`).
- Za každý riadok ide `{ id, keywords, authors, described: true, customData }` a `mainFileSingleUse`, ak nie je
  `null` (`D-api:208-226`). Zmeny sa nesledujú, nedotknutý riadok ide s hodnotami z načítania
  (`DT/queue/overlaySave.test.ts:441-453`: `asset-2` odíde ako `keywords: [], authors: [], described: true, customData: {}`).
  Povinné prázdne pole uloženie zastaví (`overlaySave.test.ts:458`), nepovinné prejde.
- Čo s tým urobí server (backend, časť 3): kľúčové slová a autorov nahradí, upraviteľné vlastné pole, ktoré chýba,
  zmaže, `described: true` zmaže návrhy a natrvalo vypne doplnenie z EXIF. Ak sa uloží pred T1, nič sa neprepíše,
  ale už sa ani nedoplní; backend to berie ako zámer. Príklad konfigurácie: obrázok v euBrief má „Popis" z EXIF,
  nepovinný a nie len na čítanie (`core-dam/src/Migrations/Version20260121122700.php:105-121`).

## 4. admin-dam: detail, pravý panel a ostatné cesty

### 4.1 Detail a pravý panel nespracovaného assetu

- Otvoria sa takto (všetky čítajú asset raz, pri otvorení):
  - klik v zozname otvorí pravý panel (`D-la:301-325`);
  - dvojklik alebo ceruzka otvorí dialóg (`D-la:241-275`);
  - priama adresa `/assets/<id>` (`detail/AssetDetailView.vue`) alebo `/assets/file/<id>` (`detail/AssetFileDetailView.vue:84-97`);
  - „Upraviť" v riadku hromadnej úpravy (`AQIE:142-166`).
- „Upraviť" v riadku uploadu je vypnuté, kým riadok nemá metadáta (`AQIE:368-376`), takže z uploadu sa detail pred
  T1 neotvorí.
- Žiadna kontrola stavu: formulár (`asset/components/AssetMetadata.vue`) ani obe uloženia
  (`detail/components/AssetDetailSidebarMetadata.vue:43-69`, `list/components/AssetListSidebarMetadata.vue:62-86`)
  sa na stav assetu ani súboru nepýtajú. Pravý panel stav súboru aspoň ukáže (`AssetInfobox`,
  `AssetListSidebarMetadata.vue:132-136`).
- Notifikácie detail neobnovia. Jediný poslucháč DAM (`appNotificationListeners.ts:27-69`) píše do front, a hák
  `onAssetRead` doplní detailu len hlavný súbor (`D-st:261-266`).
- Uloženie pošle `keywords`, `authors`, `customData`, `described: true` a navyše všetky štyri prepínače
  (`D-api:296-339`).
- **Odpoveď:** áno, detail aj panel nespracovaný asset otvoria a uložia. Je to rovnako zriedkavé ako hromadná
  úprava a vstupy sú tie isté, plus dve priame adresy.

### 4.2 Ostatné cesty

| cesta | formulár pred spracovaním metadát? | poznámka |
|---|---|---|
| riadok uploadu (`upload`) | nie. Formulár dostane až po notifikácii metadát (čítanie o 2 s, `L-se:577-588`) alebo pri usadení spracovaného súboru (`L-se:320-348`, len `Processed`) | zvyškové riziko 2 s odstupu pri notifikácii pred commitom (backend 4.4) je známe (`uploadPollSchedule.ts:48`) |
| import od poskytovateľa (`externalImport`) | nie, politika je rovnaká ako pri uploade (`D-st:105-106`) | |
| slot | formulár nemá (`D-st:101`) | |
| **detail alebo panel zo zoznamu uložený, kým je asset v hromadnej úprave** | — | **nový nález.** Uloženie zo zoznamu riadok hromadnej úpravy neprepíše: `AssetListSidebarMetadata.vue:62-86` nerobí nič a `AssetDetailSidebarMetadata.vue:60-62` píše len pri `view === 'queue'`, kým zoznam nastaví `'list'` (`D-la:242`, `AssetDetailView.vue:76,91`). Neskoršie hromadné uloženie preto vráti staré hodnoty. Naopak hromadné uloženie neobnoví otvorený panel (`footer/AssetFooterSelectedFull.vue:62-79`). Odvodené z kódu; LIB po uložení detailu asset znova prečíta (`L-st:429-456`) |
| nepopísaný asset `with_file`, do ktorého niekto nahrá ďalší slot | — | server znova spustí návrhy a pridá kľúčové slová a autorov (backend 4.2). Otvorený formulár ich uložením odoberie. Hlavný súbor je `processed`, takže pravidlo zo stavu to nezachytí; zriedkavé |

## 5. Knižnica (widgety admin-cms a admin-ugc)

### 5.1 Kde knižnica ukazuje formulár metadát a ukladá

| obrazovka | uloženie | kedy dostane formulár / dáta | nespracovaný asset pred T1? |
|---|---|---|---|
| okno uploadu (viac súborov), riadok | `bulkUpdateAssetsMetadata`, `described: true` (`L-api:217-235`), len riadky s formulárom (`L-api:214-215`; `L-uq/UploadQueueDialog.vue:72,92-112`) | z usadenia: notifikácia metadát (čítanie o 2 s), alebo spracovaný súbor, alebo „Obnoviť" (politika `L-st:112-113`, tie isté `L-se:577-588`, `:320-348`). Formulár je dovtedy vypnutý (`L-uq/UploadQueueItemEditable.vue:382`) | **nie** |
| okno uploadu, „Upraviť asset" | detail knižnice (riadok nižšie) | tlačidlo je vypnuté bez formulára (`UploadQueueItemEditable.vue:303-310`), asset sa číta pri kliku (`UploadQueueDialog.vue:154-158`) | **nie** |
| dialóg pre jeden súbor | `bulkUpdateAssetsMetadata` s prepínačom (`L-uq/UploadQueueDialogSingle.vue:253-303`) | formulár aj obe tlačidlá podľa `canEditMetadata` riadku (`UploadQueueDialogSingleSidebarMetadata.vue:41-44,86,95`, `UploadQueueDialogSingleSidebarMetadataContent.vue:97`) | **nie** |
| riadok kópie do licencie | ako okno uploadu | z čítania po notifikácii `asset_file_copied` alebo z dopytovania (`L-st:206-237`, `L-sm:622-630`). Metadáta kópie skopíruje server z originálu pri jej založení a EXIF na kópii nespracúva (`CD/Domain/Asset/AssetCopyBuilder.php:25-46`, `CD/Domain/AssetFile/AssetFileCopyBuilder.php:25-30`, `CD/Domain/Image/ImageCopyFacade.php:99-124`; čítané) | **nie** (spracovanie kópie metadáta nemení) |
| duplikát, ktorý sa stane originálom | ako okno uploadu | metadáta originálu; duplikát ukazuje len na spracovaný súbor (`CD/Repository/AbstractAssetFileRepository.php:63-70`) | **nie** |
| výber assetov, pravý panel | žiadne: `AssetMetadata` je `readonly` (`L-as/components/AAssetListInner.vue:362-368,401-407`) | asset sa číta pri kliku (`L-as/composables/assetSelectListActions.ts:107-133`) | — |
| výber assetov, „Upraviť v DAM" | detail knižnice | dáta z kliku, po zatvorení sa načítajú znova (`AAssetListInner.vue:170-187,419-424`) | **áno, ak je asset v zozname** (5.2) |
| widget, „Upraviť asset" (obrázok, médium, galéria) | detail knižnice | asset sa číta pri kliku podľa súboru (`L-iw/ImageWidgetInner.vue:521-537`, `ImageMediaWidgetInner.vue:632`, `ImageWidgetMultipleInner.vue:387-401`) | **áno, ak widget drží obrázok assetu vybraného podľa ID** (5.2). Z uploadu dostane widget obrázok až po formulári (`UploadQueueDialog.vue:75-76`; jeden súbor po `canEditMetadata`) |
| detail knižnice (`assetDetail/components/AssetDetailSidebarMetadata.vue:48-69`) | `updateAssetMetadata`, `described: true` (`L-api:266-306`, `:278`) | bez kontroly stavu; po uložení z okna uploadu sa riadky prečítajú znova (`L-st:429-456`) | podľa vstupu (riadky vyššie) |
| widget, výber assetu bez autorov | `updateAssetAuthors`: `{ id, authors, described: true }` (`L-api:308-345`, `:318`) | asset sa číta pri výbere (`ImageWidgetInner.vue:422-467`, `ImageMediaWidgetInner.vue:479-581`) a pošle sa pri potvrdení dialógu metadát obrázka (`ImageWidgetInner.vue:545-563`, `ImageMediaWidgetInner.vue:686`) | **áno, ak sa vyberie podľa ID**. Vymení autorov a nastaví `described`, vlastné polia nepošle |
| galéria, autori | `bulkUpdateAssetsAuthors`: `{ id, authors }` bez `described` (`L-iw/ImageWidgetMultipleInner.vue:449-467`) | autori z výberu alebo z uploadu (`:168-169,344-345`) | pri výbere podľa ID by vymenila autorov; rodina nálezu 32 |

### 5.2 Dá sa nespracovaný asset v knižnici vybrať?

- Výber assetov má filter stavu natvrdo `['with_file']` (`L-as/filter/AssetFilter.ts:14`). Formulár filtra pole
  stavu nemá (`L-as/components/AssetSelectFilterForm.vue:82-162`) a obnovenie filtra vráti predvolenú hodnotu
  (`assetSelectListActions.ts:139-150`, LIB `src/domains/filters/composables/filterFactory.ts:202-211`). Čipy
  (`AFiltersSelected`) výber nepoužíva.
- Hľadanie textom je vo výbere vždy (`AAssetListInner.vue:283-285`; admin-ugc povolí `text` a `createdAtFrom`,
  `admin-ugc/src/main.ts:67`). UUID alebo URL v texte, ako aj pole „Id" (ak ho aplikácia povolí,
  `AssetSelectFilterForm.vue:88-91`), vypne ostatné filtre na backende (1.2).
- Čerstvé ID ponúka riadok uploadu v knižnici („Kopírovať asset ID", `UploadQueueItemEditable.vue:314-318`, od
  vytvorenia assetu), alebo ho pošle kolega z admin-dam.
- **Odpoveď:** v knižnici sa nespracovaný asset dostane k formuláru len cez vloženie čerstvého ID do hľadania vo
  výbere a len v okne T0 → T1. Predvolená cesta je zatvorená a riadky uploadu a kópie formulár pred spracovaním
  nedostanú.

## 6. Scenár s časmi

Predpoklady (nemerané): fotograf nahráva z terénu rýchlosťou 10 Mbit/s a redaktor má v admin-dam filter
„Stav: Koncept".

1. **10:00:00** Fotograf pustí `foto.jpg` (8 MB). `uploadInit` vytvorí asset A ako `draft` v DB aj v indexe.
2. **10:00:03** Redaktor klikne „Obnoviť" zoznamu. A je v ňom ako šedá dlaždica s názvom súboru.
3. **10:00:05** Redaktor zaškrtne A. Dávka mu dá kľúčové slová `[]`, autorov `[]`, vlastné polia `{}` a otvorený
   formulár. Mimochodom dostane aj `mainFile.fileAttributes.status = uploading` a `flags.described = false`, ale
   tieto hodnoty dnes nikto nečíta.
4. **~10:00:08** Worker doplní „Popis", autora a kľúčové slovo z EXIF. Redaktorovi nepríde nič, lebo notifikácie
   idú fotografovi; aj keby prišli, riadok ich odmietne.
5. **10:01** Redaktor hromadne doplní „Šport" do prázdnych kľúčových slov (`D-st:833-843`) a uloží. A má potom
   kľúčové slová `[Šport]`, autorov `[]`, zmazaný „Popis", žiadne návrhy a `described: true`.
6. Ak fotograf potom uloží svoje okno uploadu, hodnoty sa vrátia, lebo jeho riadok má metadáta od ~10:00:10.
   Vyhrá posledné uloženie.

V knižnici je to isté možné len tak, že redaktor vloží ID z riadku uploadu do hľadania vo výbere assetov, asset
vyberie a otvorí „Upraviť v DAM" ešte pred krokom 4. S predvolenými filtrami sa A nikde neobjaví pred T3.

## 7. Návrh opravy podľa stavu z čítania

### 7.1 Pravidlo

```ts
// The server may yet fill in its metadata from the file: a form loaded now would overwrite that when saved.
const metadataMayStillChange = (asset: AssetDetailItemDto) =>
  !asset.flags.described &&
  !!asset.mainFile &&
  ([AssetFileProcessStatus.Uploading, AssetFileProcessStatus.Uploaded, AssetFileProcessStatus.Stored] as string[]).includes(
    asset.mainFile.fileAttributes.status
  )
```

- Pravidlo stojí na čítaní, ktoré každá cesta už robí, takže platí pre každého používateľa, nielen pre toho,
  kto asset nahral.
- Je opatrné. Keď metadáta prišli už z prvého kúska a súbor sa ešte spracúva, zakáže aj to, čo by bolo bezpečné,
  lebo `processedMetadata` API nevracia.
- Súbor `failed`, `duplicate` alebo asset bez súboru rizikový nie je: spracovanie už nič nedoplní.
- Asset s `described: true` tiež nie: spracovanie mu nedoplní nič (backend 3).
- `AssetFileProcessStatus` knižnica exportuje (`src/lib.ts:345`). `isFinalFileStatus` neexportuje, preto pravidlo
  odporúčam napísať zvlášť v DAM aj v LIB (tri riadky). Krok v DAM tak nemusí čakať na vydanie knižnice.

### 7.2 Kde a ako

| # | cesta | zmena | veľkosť |
|---|---|---|---|
| F-A | DAM hromadná úprava | V `fetchLazyAdditionalMetadata` (`D-st:517-540`) rizikový asset formulár nedostane. Riadok zlyhá s textom „Súbor assetu sa ešte spracúva. Odstráňte položku a označte ju znova, keď bude spracovaný." a zapíše sa do `metadataFailures`, presne ako dnešný riadok bez metadát (`D-st:461-473`). Tomu, kto asset nahral, ho potom notifikácia metadát oživí cez `metadataGate` (`D-st:252`, `L-se:582-587`); ostatní ho odstránia a označia znova. S F5 (PV9) sa zapíše aj do `leftOutByBatch`. Uloženie sa nemení, lebo riadok bez formulára nejde do uloženia (`D-api:205-206`) | asi 2–3 h: kód asi 20 riadkov a text sk/en; testy v `DT/queue/lazyMetadata.test.ts` (rizikový, popísaný, spracovaný, oživenie notifikáciou) a jeden v `overlaySave.test.ts` |
| F-B | DAM detail a pravý panel | V `AssetDetailSidebarMetadata.vue` a `AssetListSidebarMetadata.vue` vypnúť „Uložiť" pri rizikovom assete, s vetou „Súbor sa ešte spracúva; po spracovaní detail obnovte." Panel stav súboru už ukazuje (`AssetInfobox`); nový klik v zozname asset načíta znova (`D-la:95-100,306-325`) | asi 2 h s testami |
| F-C | LIB detail (`assetDetail/components/AssetDetailSidebarMetadata.vue:48-69`) | Ten istý zámok „Uložiť". Pokryje „Upraviť v DAM" vo výbere aj „Upraviť asset" vo widgetoch. Vstup z okna uploadu je už chránený | asi 1,5 h s testom; zmena LIB, ide s jej najbližším vydaním |
| F-D | LIB widget, výber assetu bez autorov (`ImageWidgetInner.vue:458-467`, `ImageMediaWidgetInner.vue:575-581`) | Rizikovému assetu neponúknuť autorov DAM, aby `updateAssetAuthors` neposlal `described: true` pred T1 | asi 1 h; len spolu s F-C |

- Alternatíva k F-A: riadok by čakal (`Loading`) a DAM by ho sám čítal znova, kým súbor nie je hotový. Používateľ
  by nemusel nič robiť, ale treba vlastný časovač a jeho upratanie pri odstránení a vyprázdnení fronty; asi 4–5 h.
  Teraz neodporúčam.
- Kontrola pri zaškrtnutí v zozname podľa údajov zoznamu nestačí. Zoznam sa sám neobnovuje, takže jeho stav
  súboru môže byť zastaraný oboma smermi. F-A rozhoduje podľa čerstvého čítania.
- Mimo opravy: nepopísaný `with_file` asset s novým slotom (4.2), opačný súbeh v core-dam (backend 4.3) a koreň
  „posielať len zmenené polia" (bod 8 nižšie).
- Zaradenie: F-A a F-B do vlastného malého kroku v DAM po K6 a pred C3, spolu s F5 (oba menia ten istý hák a
  `metadataFailures`). Hromadná úprava aj detail sú vlastný kód DAM (jadro C15, `navrh-jadro.md:441`), krok 5 ich
  nemení. Do toho istého kroku patrí aj oprava nového nálezu zo 4.2 (asi 2–3 h). F-C a F-D sú v LIB mimo krokov
  DAM.

## 8. Čo som spustil a čo nie

- Spustil som `vitest run` dvoch súborov DAM s filtrom: `DT/queue/notificationSettlesQueue.test.ts` („one asset in
  two queues") a `DT/queue/overlaySave.test.ts` („the overlay of the assets picked for mass edit"), s
  `TMPDIR=…/vitest-tmp-overenie49` a `--retry=0`. Výsledok: 2 súbory, 15 testov zelených, 51 preskočených, 18,8 s.
- Knižnicu som len čítal, nič som v nej nespúšťal.
- Neoverené:
  - interval obnovenia ES a čakanie vo fronte workera;
  - či redakcia používa filter „Koncept" alebo hľadanie podľa ID na čerstvé nahrávky;
  - nový nález zo 4.2, ktorý mám len z kódu;
  - či core-dam dovolí kópiu do licencie z nespracovaného originálu. Kópia by potom niesla metadáta spred EXIF a
    nikdy ich nedostala; je to iná vec než nález 49.

## 9. Verdikt

**Možné len ak** používateľ zámerne dostane k formuláru asset, ktorého hlavný súbor sa ešte nahráva alebo
spracúva, a urobí to v okne sekúnd pred spracovaním metadát prvého kúska. V admin-dam to znamená filter
„Koncept", zrušený čip „Obsahuje súbor" alebo hľadanie podľa ID či URL; potom ide o hromadnú úpravu, detail aj
pravý panel. V knižnici to znamená len vloženie čerstvého ID do hľadania vo výbere assetov; potom ide o detail z
výberu alebo z widgetu a o autorov pri výbere.

S predvolenými filtrami je to nemožné. Riadky uploadu a kópie (DAM aj LIB) formulár pred spracovaním nedostanú.
Keď to nastane, zvyšok nálezu platí; kód aj testy to potvrdzujú. Notifikácia metadát sa odmietne alebo nepríde,
uloženie pošle hodnoty z načítania s `described: true` a údaje z EXIF prepíše, alebo nedovolí ich doplniť. Opravu
treba postaviť na stave súboru z čítania (časť 7). Krok 5 to neblokuje.

## Pre vlastníka

1. **Záver k nálezu 49:** je „možný len ak" (nespracovaný asset otvorený zámerne cez filter „Koncept" alebo
   hľadanie podľa ID, a len v okne sekúnd). S predvolenými filtrami nie, v knižnici len cez vložené ID. Zapísať ako
   overený, s nízkou prioritou, krok 5 neblokuje. **Odporúčam áno** (zápis 0,25 h).
2. **Pravidlo opravy:** formulár zamknúť, keď asset nie je popísaný a jeho hlavný súbor je `uploading`,
   `uploaded` alebo `stored`, podľa čítania, nie podľa notifikácie. **Odporúčam áno.**
3. **F-A, hromadná úprava v DAM (produktová zmena):** taký asset dostane namiesto formulára text „Súbor assetu sa
   ešte spracúva…". Tomu, kto ho nahral, ho oživí notifikácia; ostatní ho odstránia a označia znova.
   **Odporúčam áno**: asi 2–3 h, malý krok v DAM po K6 spolu s F5, pred C3.
4. **F-B, detail a pravý panel v DAM (produktová zmena):** pri takom assete je „Uložiť" vypnuté a pri ňom veta,
   že sa súbor ešte spracúva. **Odporúčam áno**: asi 2 h, v tom istom kroku.
5. **F-C, detail v knižnici** („Upraviť v DAM" vo výbere, „Upraviť asset" vo widgetoch): ten istý zámok.
   **Odporúčam áno, s nižšou prioritou**, lebo sa tam dá dostať len cez vložené ID: asi 1,5 h, zmena LIB s jej
   najbližším vydaním.
6. **F-D, widget v knižnici:** pri výbere takého assetu neponúknuť autorov DAM (inak pošle `described: true`).
   **Odporúčam len spolu s F-C**, +1 h.
7. **Potvrdiť:** riadky uploadu (DAM aj LIB, okno pre viac súborov aj dialóg pre jeden), importu, slotov a kópie do
   licencie formulár pred spracovaním metadát nedostanú a opravu nepotrebujú.
8. **Koreň (produktová zmena, mení čo ide na backend):** hromadné uloženie posiela každé pole, aj nedotknuté, s
   `described: true`. Posielať len zmenené polia by uzavrelo všetky tieto tvary. **Odporúčam nie v kroku 5**, ale
   ako otvorenú tému po ňom: asi 1 deň v DAM plus tvoje rozhodnutie, kedy posielať `described: true`.
9. **Nový nález (nie 49), častejší:** keď používateľ v admin-dam uloží asset v pravom paneli alebo v detaile
   otvorenom zo zoznamu, riadok hromadnej úpravy toho istého assetu si hodnoty nezapíše a neskoršie hromadné
   uloženie ich vráti; hromadné uloženie zas neobnoví otvorený panel. **Odporúčam zapísať do denníka a opraviť v
   tom istom kroku DAM:** detail zapíše uložené hodnoty do riadku vždy, nielen z fronty, a po hromadnom uložení sa
   otvorený detail načíta znova. Asi 2–3 h. Mení, čo hromadné uloženie pošle, preto to necháme na tvoje
   rozhodnutie.
10. **Otázka:** používa redakcia filter „Koncept" alebo hľadanie podľa ID na práve nahrávané assety? Odpoveď
    ovplyvní len prioritu bodov 3–6, nie ich obsah.
