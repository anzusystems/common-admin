# Úlohy pre core-dam: nález 51, ochrana uloženia, príznak metadát, nález 52 (návrh, 9. 10.)

Zadanie: navrhnúť backendové úlohy k nálezu 51 (opačný súbeh), k ochrane uloženia nespracovaného assetu, k P1
(`processedMetadata` v API) a k nálezu 52, a zistiť, kde sa majú robiť. Nadväzuje na `analyzy/nalez49-backend.md`,
`analyzy/nalez49-frontend.md` (7.1, F-A až F-D) a `podklady/upload/2-notif-be.md` (§10 P1). Nálezy 51 a 52 sú v denníku
(`upload-postup.md:169-170`); návrh doplnenia ich textu je v časti 8. Kód som len čítal, nič nespúšťal ani nevolal.

Skratky: `CD/` = `/home/volar/projects/petit/core-dam/vendor/anzusystems/core-dam-bundle/src/` (1.52.0, ref `c9d62929`);
`C/` = `/home/volar/projects/petit/core-dam/`; `CB/` = `C/vendor/anzusystems/common-bundle/src/` (11.4.1);
`ORM/` = `C/vendor/doctrine/orm/src/` (3.6.8); `LIB/` = common-admin `src/`. Cesta **1b** = spracovanie metadát z
prvého kúska (`CD/Messenger/Handler/AssetFileMetadataProcessHandler.php:33-49`), cesta **6** = metadáta v
`AbstractAssetFileStatusFacade::process` (`CD/Domain/AssetFile/AbstractAssetFileStatusFacade.php:299-321`), ako v
`nalez49-backend.md`, časť 1.

## Oprava po overení (9. 10.)

Overenie Codexom (`analyzy/posudok-be-core-dam-ulohy-codex.md`): použiteľné, s opravami. Opravy sú zapracované v
texte nižšie.

| # | čo bolo | čo platí |
|---|---|---|
| 1 | BE-1: `processedMetadata` čítať v ceste 6 z DB **pred** zámkom | Čítať ho **pod zámkom** z obnoveného súboru, v **oboch** cestách. Pred zámkom môže ešte vyjsť `false` tesne predtým, než cesta 1b skončí. Cesta 1b dnes žiadnu kontrolu príznaku nemá (`MetadataProcessor.php:30-43`), kontroluje len cesta 6 (`AbstractAssetFileStatusFacade.php:305`). Krok musí byť zopakovateľný bez účinku: kto príde druhý, nájde príznak a skončí |
| 2 | BE-1: `lock_suggester_` zrušiť pre nereentrantnosť | **Nechať.** Má iný názov ako nový `asset_metadata_`, takže vnorenie nevadí. Nereentrantný je len rovnaký názov (`CB/Util/ResourceLocker.php:78-82`) |
| 3 | BE-1: krok pred transakciou spracovania stačí | Synchrónna cesta z URL má **vonkajšiu** transakciu (`CD/Domain/Asset/AssetSysFacade.php:69-75`, `CD/Domain/Image/ImageDownloadFacade.php:44-49`), takže tam krok beží v nej a zámok sa uvoľní pred jej potvrdením. Asset je však v tej transakcii nový a nikto iný ho nevidí. Treba aj **posúdiť rozsah**: import od poskytovateľa (`CD/Domain/AssetFile/AbstractAssetFileFactory.php:154-169`) a zápisy sys API z URL (`AssetSysFacade.php:112-120`). Uloženie jedného assetu z frontendu ide tým istým hromadným koncovým bodom (`LIB/domains/dam/api/damAssetApi.ts:266-284`), zámok ho teda pokryje |
| 4 | `ORM\Version` „zlyhá pri každom súbehu“ | Príliš absolútne. Zlyhá len pri súbehu zápisov, ktoré menia ten istý verzovaný riadok |
| 5 | E: „triedy sú `final`, prepísať sa to nedá“ | Nie všetky: `AssetCopyBuilder` `final` nie je (`CD/Domain/Asset/AssetCopyBuilder.php:16`). Prepísanie v aplikácii je **ťažké**, nie nemožné: hlavné závislosti sú `final` a vkladajú sa podľa konkrétneho typu (`AbstractAssetFileStatusFacade.php:59,95`). Že inde lokálny repozitár balíka nie je a ako presne ide vydanie, sa z týchto súborov overiť nedá |
| 6 | okno nahrávajúceho (51b) platí všeobecne | **Len so zapnutými notifikáciami.** Notifikácia metadát otvorí formulár bez ohľadu na stav súboru (`LIB/domains/dam/uploadQueue/settlement/uploadSettlement.ts:631-638`, `uploadSettle.ts:576-588`, admin-dam `uploadQueuesStore.ts:747-749`). Samotné dopytovanie otvorí formulár riadku uploadu až pri `processed` (`uploadSettle.ts:613-643`, admin-dam `uploadQueuesStore.ts:95-106`), a vtedy toto okno nevzniká |
| 7 | — | **Pokyn pre frontend:** pravidlo dopytovania (formulár uploadu až pri `processed`) nechať. `processedMetadata` nepoužiť na skoršie odomknutie, kým nie sú vydané opravené BE-1 (kontrola pod zámkom) aj BE-2 (príznak až v poslednom zápise) |
| 8 | dôsledky súbehu ako istý výsledok | Ide o **možný** súbeh. Presné hodnoty a účinky opakovania (aj porušenie primárneho kľúča) sa bez testu súbehu overiť nedajú |

## 0. V skratke

1. **Nález 51 platí a má dve okná.** V ceste 1b je krátke (desiatky až stovky ms). V ceste 6 je dlhé: worker si asset
   načíta ešte **pred** čakaním na zámok licencie, zápisom do úložiska a orezmi a metadáta potom spracuje **druhý raz**,
   ak si príznak `processedMetadata` prečítal skôr, než ho cesta 1b zapísala. Podľa zastaranej kópie (`described = false`)
   obnoví návrhy, vráti odobraté kľúčové slová a autorov a EXIF prepíše polia, ktoré používateľ práve uložil.
2. **Zasiahnuť to môže aj toho, kto nahráva**, nielen niekoho iného, ale **len so zapnutými notifikáciami**: riadok
   uploadu sa odomkne notifikáciou z cesty 1b, keď súbor ešte len čaká na cestu 6. Samotné dopytovanie otvorí
   formulár až pri `processed`. F-A až F-D riadky uploadu nepokrývajú. Je to zriedkavé, ale reálne (pravdepodobnosť a
   čas som odhadol, nemeral).
3. **Odporúčaná oprava (BE-1):** zámok na asset v Redise a čerstvé čítanie pri spracovaní metadát aj pri uložení. Pod
   zámkom sa v oboch cestách skontroluje `processedMetadata` z obnoveného súboru, takže krok prebehne len raz; v ceste 6
   beží pred transakciou spracovania. Bez migrácie a bez zmeny API, asi 1,5 dňa. `ORM\Version` neodporúčam: neochráni
   vlastné polia ani kľúčové slová a zlyhávalo by pri súbehu zápisov toho istého riadku. Doplnenie „len prázdnych
   kľúčov“ súbeh neuzavrie.
4. **Ochranu uloženia nespracovaného assetu na backende (B) neodporúčam.** Škodlivý prípad nálezu 49 nezachytí, lebo
   pri uložení je súbor už spracovaný. Odmietla by riadne uloženia z okna uploadu a jedna položka by zablokovala celú
   dávku. Nález 49 rieši F-A až F-D.
5. **P1 (BE-2)** je malá aditívna zmena (2-3 h), ale len v tom istom vydaní ako BE-1. Dnes sa príznak môže potvrdiť
   skôr než vlastné polia a cesta 6 metadáta po ňom ešte prepíše. Frontend potom získa odomknutie formulára počas
   nahrávania aj pri dopytovaní, nielen pri notifikácii. **Dovtedy** frontend nechá pravidlo dopytovania (formulár až
   pri `processed`) a príznak na skoršie odomknutie nepoužije.
6. **Nález 52** sa v tomto core-dam týka len audia v CMS: obrázky, videá aj dokumenty majú jediný slot. Zámer v kóde
   nikde nie je, skôr to vyzerá ako nedomyslené. Odporúčam backendu položiť otázku a prípadne malú opravu (BE-3).
   Frontend nemeniť.
7. **Vedľajší nález (návrh na zápis):** návrhy kľúčových slov a autorov si vo workeri pamätajú nastavenie systému a
   typu **prvého** spracovaného súboru a použijú ho pre ďalšie súbory, kým sa worker nereštartuje (BE-4, asi 1 h).
8. **Kde:** všetko v `anzusystems/core-dam-bundle` (GitHub, lokálna kópia repozitára nie je), vydanie, potom zvýšenie
   verzie v core-dam. Prepísať triedy v aplikácii je ťažké, väčšina dotknutých je `final`. Výnimkou je kópia hromadného uloženia pre UGC
   v core-dam, tam treba BE-1 zopakovať.

## 1. Nález 51: kedy presne spracovanie prepíše čerstvé uloženie

### 1.1 Čo worker načíta a kedy

Entity manager sa po každej správe vyprázdni (`C/vendor/symfony/doctrine-bridge/Messenger/DoctrineClearEntityManagerWorkerSubscriber.php:31-45`,
zaregistrované v `C/vendor/doctrine/doctrine-bundle/config/messenger.php`). Zastaraná kópia teda vzniká len vnútri jednej
správy. Asset je pri súbore lenivý (`CD/Entity/ImageFile.php:30-32`), metadáta assetu sú samostatná entita
(`CD/Entity/Asset.php:98-99`) a kľúčové slová a autori sú `EXTRA_LAZY` (`Asset.php:62-63`, `:74-75`).

| | cesta 1b | cesta 6 |
|---|---|---|
| súbor a jeho `processedMetadata` | `AssetFileMetadataProcessHandler.php:35` | `CD/Messenger/Handler/AssetFileChangeStateHandler.php:81`; neskôr sa nečíta znova, `process` sa pýta kópie (`AbstractAssetFileStatusFacade.php:305`) |
| riadok `asset` (`described`, `autocompletedMetadata`) | pri prvom `supports()` návrhov (`CD/Domain/AssetMetadata/Suggestion/AbstractSuggester.php:45-47` cez `CD/Domain/Configuration/ExtSystemConfigurationProvider.php:31-34`), po exiftoole, pod zámkom `lock_suggester_` (`CD/Domain/AssetMetadata/AssetMetadataProcessor.php:60-74`) | `CD/Domain/AssetFile/FileProcessor/FileAttributesProcessor.php:65`, volané z `AbstractAssetFileStatusFacade.php:212`, teda **pred** zámkom licencie (`:215`), uložením (`:216`) a orezmi (`:223`, `:304`) |
| `AssetMetadata` (`customData`, návrhy) | pri prvom zápise návrhov (`KeywordSuggester.php:37`, `AuthorSuggester.php:58`) alebo pri doplnení (`CD/Domain/AssetMetadata/AssetMetadataAutocomplete.php:44`) | to isté, už vnútri transakcie spracovania (`:302`) |
| kľúčové slová a autori | `containsKey` je dotaz v čase návrhu (`KeywordSuggester.php:40`, `AuthorSuggester.php:61`) | to isté |
| zápis | medzizápis pri každom založení nového slova či autora (`CD/Domain/Keyword/KeywordFacade.php:35-52` → `KeywordManager.php:12-16`, flush celej jednotky práce; autori `AuthorFacade.php:40-57`), posledný zápis `MetadataProcessor.php:39-42`; bez transakcie, takže je potvrdený hneď | ten istý flush, potvrdený až pri `:309` |
| okno | od načítania assetu po posledný flush: dotazy návrhov, prípadné založenie slov a autorov s indexom v ES, doplnenie polí. Desiatky až stovky ms (odhad) | od `:212` po `:309`: čakanie na zámok licencie, zápis do úložiska, orezy. Sekundy; pri hromadnom nahrávaní do jednej licencie s viacerými podmi workera desiatky sekúnd (odhad) |

Cesta 6 spracuje metadáta znova, keď worker prečíta súbor (`:81`) skôr, než cesta 1b potvrdí príznak. Pri súbore
z jedného kúska (bežný obrázok) a voľnom workeri je to pravdepodobné: cesta 1b musí najprv stiahnuť kúsok a spustiť
exiftool, kým cesta 6 súbor načíta hneď (odvodené, nemerané). `nalez49-backend.md` 1 má len opačné poradie (neskorší
krok 1b už vlastné polia nemení). Ak worker načíta asset až po potvrdení cesty 1b, doplnenie polí sa síce preskočí
(`autocompletedMetadata`), ale návrhy bežia znova.

### 1.2 Čo worker zapíše

- Doctrine zapíše len stĺpce, ktoré sa od načítania zmenili (`ORM/Persisters/Entity/BasicEntityPersister.php:360-378`).
- `custom_data`, `keyword_suggestions` a `author_suggestions` sú JSON (`CD/Entity/AssetMetadata.php:26-36`), takže sa
  zapíšu **celé** z kópie workera: `array_merge(kópia, EXIF)` (`AssetMetadataAutocomplete.php:44-47`) a návrhy celé nahradené.
- Na riadku `asset` zapíše worker len `autocompletedMetadata` (`AssetMetadataAutocomplete.php:48`) a v ceste 6 stav
  `draft` → `with_file` (`CD/Domain/AssetFile/AssetFileStatusManager.php:67-69`). Hodnotu `described` nezapíše, takže
  `true` z uloženia ostane.
- Kľúčové slová a autorov zapíše ako rozdiel: vloží pridané riadky a nič nezmaže (`ORM/Persisters/Collection/ManyToManyPersister.php:56-82`).
  Ak ten istý riadok medzitým pridal používateľ, vloženie poruší primárny kľúč (`C/src/Migrations/Version20220090101243.php:21-22`).
  Spracovanie potom skončí výnimkou a správa sa zopakuje; v ceste 6 sa súbor znova spracuje zo `stored`
  (`AssetFileChangeStateHandler.php:90,123-146`). Je to odvodené, nespúšťal som to; nastane len pri presnom
  časovaní a overiť sa to dá len testom súbehu.

### 1.3 Výsledok súbehu

Uloženie (`described: true`, vlastné polia C1, kľúčové slová K1, autori A1, prázdne návrhy) sa potvrdí v okne. Ide o
možný výsledok podľa kódu, nie istý; presné hodnoty overí len test súbehu:

- **Vlastné polia:** v ceste 1b sa C1 celé nahradí hodnotou C0 + EXIF, ak worker podľa svojej kópie dopĺňa. V ceste 6
  sa metadáta väčšinou načítajú až po uložení, teda čerstvé, lenže zastarané príznaky doplnenie pustia: výsledok je
  C1 + EXIF a hodnoty používateľa pri kľúčoch, ktoré EXIF má, sú preč.
- **Návrhy** sa vrátia a s nimi aj konflikty autorov v admin-dam (odvodené). Kľúčové slová a autori z EXIF, ktoré
  používateľ odobral, sa tiež vrátia.
- `described` ostane `true`, takže to už nič neopraví. Strata je tichá a trvalá.

Kto na to narazí:
- **Okno 1b:** kto asset nahral, má formulár zamknutý až do notifikácie, ktorá ide po tomto zápise (`MetadataProcessor.php:43`).
  Ostatným ho po F-A až F-D zamkne pravidlo podľa stavu súboru. Zostáva prípad nálezu 52 (slot) a klienti bez F-A až F-D.
- **Okno 6:** aj ten, kto asset nahral, ale **len so zapnutými notifikáciami**. Riadok uploadu sa odomkne notifikáciou
  z cesty 1b bez ohľadu na stav súboru (`LIB/domains/dam/uploadQueue/settlement/uploadSettlement.ts:631-638`,
  `uploadSettle.ts:576-588`, admin-dam `src/domains/coreDam/asset/store/uploadQueuesStore.ts:747-749`), súbor však ešte
  môže čakať na cestu 6. Samotné dopytovanie otvorí formulár riadku uploadu až pri `processed` (`uploadSettle.ts:613-643`,
  admin-dam `uploadQueuesStore.ts:95-106`), takže bez notifikácií toto okno pre riadky uploadu nevzniká. Je to
  zriedkavé, najskôr pri hromadnom nahrávaní malých obrázkov do jednej licencie: spracovanie je v licencii za sebou
  (`AbstractAssetFileStatusFacade.php:207,215`). Odhad, nemerané.

### 1.4 Porovnanie opráv

| | čo uzavrie | kde by sa niečo pokazilo | migrácia, API | veľkosť |
|---|---|---|---|---|
| **`ORM\Version` na `Asset`** | len riadok `asset`. Vlastné polia a návrhy sú v `AssetMetadata`. Pri zmene samotnej kolekcie kľúčových slov či autorov Doctrine verzovaný UPDATE nepošle (`ORM/UnitOfWork.php:766-775` s prázdnou zmenou, `BasicEntityPersister.php:371-373`). Verziu by teda potrebovali obe entity a k tomu vynútené zvýšenie | súbeh zápisov, ktoré menia ten istý verzovaný riadok (nie každý súbeh); takých zapisovateľov assetu je veľa: obnovenie vlastností po každom spracovaní a distribúcii, `toProcessed`, PUT assetu, sloty, mazanie, TTS, API sys a UGC, import RSS. V HTTP odpoveď 500 `unknown_error` (`CB/Exception/Handler/DefaultExceptionHandler.php:13,24-28`) a pre jeden flush padne celá dávka 10 položiek (`CD/Domain/AssetMetadata/AssetMetadataBulkFacade.php:67`). V ceste 6 `storeAndProcess` zachytí každú chybu ako zlyhanie súboru (`AbstractAssetFileStatusFacade.php:245-252`). V ceste 1b nasleduje opakovanie po 2 až 600 s | 1-2 stĺpce. Nález 49 by uzavrel len vtedy, keby klient posielal verziu, ktorú načítal, a to je zmena API v oboch frontendoch | dni; neodporúčam |
| **zámok na asset a čerstvé čítanie, na oboch stranách** | 51 celý, pre zapisovateľov, ktorí zámok berú | uloženie počká, kým worker dokončí krok (do ~1 s, odhad); treba dodržať poradie zámkov, nevnárať rovnaký názov a príznak kontrolovať pod zámkom (1.5) | nič | ~1,5 dňa |
| **„doplniť len prázdne kľúče“** (`AssetMetadataAutocomplete.php:44-47`) | súbeh nie: worker stále zapíše celý JSON zo svojej kópie, obnoví návrhy a vráti slová a autorov; zmierni len časť okna 6 | mení správanie importu od poskytovateľa: ten vlastné polia vyplní pred spracovaním (`CD/Domain/AssetFile/AbstractAssetFileFactory.php:154-169`) a dnes ich EXIF prepíše | nič; produktová zmena | 1 h; ako oprava 51 nie |
| **minimum, bez zámku pri uložení** | okno 6: zámok `asset_metadata_` v oboch cestách, pod ním príznak z obnoveného súboru, žiadne druhé spracovanie, asset a metadáta načítané znova, krok pred transakciou | uloženie zámok neberie, takže krátke okno od čerstvého čítania po zápis ostane (zlomok sekundy) | nič | ~0,5-0,75 dňa |

**Odporúčam druhý riadok, teda BE-1, a jeho prvou časťou je minimum.** Ak chce backend menšiu zmenu, aj samotné
minimum uzavrie reálnejšiu časť.

### 1.5 Návrh BE-1 (presné miesta)

a) `CD/Domain/AssetFile/FileProcessor/MetadataProcessor.php:30-46` a `CD/Domain/AssetMetadata/AssetMetadataProcessor.php:40-74`:
   - exiftool a filter nechať mimo zámku (rozdeliť `provideMetaData` na čítanie EXIF a zápis do assetu);
   - zámok `asset_metadata_<assetId>` cez `ResourceLocker` (`CB/Util/ResourceLocker.php:32-50`, Redis, platnosť 60 s);
   - **pod zámkom najprv súbor:** obnoviť súbor (`refresh`, alebo príznak prečítať dotazom z DB) a ak je
     `processedMetadata` už `true`, krok skončí bez zápisu a bez notifikácie. Platí to v **oboch** cestách: cesta 1b
     dnes kontrolu nemá (`MetadataProcessor.php:30-43`), cesta 6 sa pýta len kópie (`AbstractAssetFileStatusFacade.php:305`).
     Kontrola pred zámkom nestačí, lebo môže vyjsť `false` tesne pred koncom druhej cesty. Krok tak prebehne len raz;
   - potom `refresh($asset)` a `refresh($asset->getMetadata())`; refresh založí kolekcie znova, nenačítané
     (`ORM/UnitOfWork.php:2606-2612`);
   - návrhy a doplnenie spúšťať podľa čerstvých príznakov; `setProcessedMetadata(true)` presunúť z
     `AssetMetadataProcessor.php:52` tesne pred posledný flush. Dnes ho medzizápis pri založení slova potvrdí skôr
     ako vlastné polia, čo je dôležité pre BE-2;
   - flush, odomknutie vo `finally`, notifikácia až potom;
   - `lock_suggester_` v `AssetMetadataProcessor.php:60-74` **nechať**. Má iný názov, takže vnorenie vnútri
     `asset_metadata_` nevadí. Nereentrantný je len rovnaký názov: každé `lock()` vytvorí nový kľúč s vlastným tokenom
     (`CB/Util/ResourceLocker.php:78-82`, `C/vendor/symfony/lock/LockFactory.php:39-41`, `Store/RedisStore.php:309-317`),
     takže vnorený zámok s tým istým názvom by čakal sám na seba až 60 s.
b) `AbstractAssetFileStatusFacade.php:299-321`: krok a) spustiť pred `beginTransaction()` (`:302`), nie vnútri
   transakcie spracovania. O tom, či krok niečo urobí, rozhodne kontrola príznaku pod zámkom v a), nie kópia z
   `AssetFileChangeStateHandler.php:81`. Potom ide transakcia spracovania ako dnes. Mimochodom tak notifikácia odíde po
   potvrdení (dnes ide pred ním, `2-notif-be.md` §3, krok 3b). Metadáta potom ostanú, aj keď spracovanie obrázka neskôr
   zlyhá, rovnako ako dnes po ceste 1b. Mimo dlhej transakcie je to preto, lebo v nej by čítanie mohlo vidieť stav
   spred uloženia: MySQL 8 (`C/.env:30`), izolácia nie je nastavená v `C/config/packages/doctrine.php`, takže platí
   predvolené REPEATABLE READ (v produkcii neoverené).
   **Výnimka:** synchrónna cesta z URL má vonkajšiu transakciu (`CD/Domain/Asset/AssetSysFacade.php:69-75` okolo
   `CD/Domain/Image/ImageDownloadFacade.php:44-49`), takže tam krok beží v nej, zámok sa uvoľní pred jej potvrdením a
   „flush = potvrdenie“ neplatí. Asset je v tej transakcii nový a pre ostatných neviditeľný, takže súbeh tam nehrozí
   (odvodené). Backend to má len potvrdiť a nič tam nemeniť.
c) `CD/Domain/AssetMetadata/AssetMetadataBulkFacade.php:46-80` a kópia v aplikácii
   `C/src/Domain/AssetMetadata/AssetMetadataBulkUgcFacade.php:54-86`: po validácii zamknúť `asset_metadata_<id>`
   všetkých položiek, zoradené podľa id. Potom `refresh` assetu aj metadát (načítali sa pri deserializácii, ešte pred
   zámkom), použiť DTO, flush (`:67`, resp. `:75`) a odomknúť vo `finally`, ešte pred indexom v ES. Dávka má najviac
   10 položiek (`C/config/packages/settings.php:46`). Uloženie jedného assetu z frontendu ide tým istým koncovým bodom
   (`LIB/domains/dam/api/damAssetApi.ts:266-284`, v admin-dam `assetApi.ts:296-316`), zámok ho teda pokryje.
d) **Posúdiť rozsah** (súčasť úlohy, nie len vymenovať):
   - import od poskytovateľa vyplní vlastné polia a autorov pri založení (`CD/Domain/AssetFile/AbstractAssetFileFactory.php:154-169`)
     a metadáta spracuje až cesta 6;
   - zápisy sys API z URL (`CD/Domain/Asset/AssetSysFacade.php:112-120` vlastné polia, `:133-151` slová a autori) idú
     po synchrónnom spracovaní v tej istej vonkajšej transakcii.
   Treba rozhodnúť, či majú brať `asset_metadata_`. Podľa môjho čítania nie, lebo asset je v tej chvíli nový alebo ešte
   nikomu neukázaný (odvodené). TTS a import RSS podľa kódu nebežia súbežne so spracovaním uploadu toho istého assetu
   (odvodené).

## 2. B: odmietnuť alebo ignorovať uloženie nespracovaného assetu?

- **Nález 49 to neopraví.** Škoda vzniká, keď sa formulár načíta pred spracovaním a uloží **po** ňom. Vtedy je hlavný
  súbor už `processed` a kontrola stavu v čase uloženia prejde. Zachytila by len uloženie pred spracovaním, a to podľa
  `nalez49-backend.md` 4.2 nie je strata (asset popísal človek, z EXIF sa už nič nedoplní).
- **Dopad na klientov:**
  - admin-dam a knižnica ukladajú riadky uploadu po notifikácii z cesty 1b, často kým je súbor `uploading`, `uploaded`
    alebo `stored` (`nalez49-frontend.md` 4.2). Kontrola podľa stavu súboru by odmietla riadne uloženie toho, kto
    nahráva; obísť by sa dala len s príznakom z BE-2.
  - Validácia beží nad celým zoznamom (`AssetMetadataBulkFacade.php:48-49`), takže jedna položka odmietne celú dávku.
  - Widget knižnice posiela autorov s `described: true` (`LIB/domains/dam/api/damAssetApi.ts:318`) a dostal by chybu.
  - admin-cms s vydanou knižnicou 1.49.0 (`upload-postup.md:188`) by ukázal len všeobecnú chybu.
  - admin-ugc ide cez kópiu v aplikácii (`C/src/Controller/Api/Ugc/V1/AssetController.php:119-133`, `admin-ugc/src/main.ts:62`),
    tam by sa kontrola musela zopakovať.
  - Iní klienti `metadata-bulk-update` nie sú (grep v `petit/` a `anzusystems/`).
- **„Ignorovať `customData`“** by ticho zahodilo, čo používateľ napísal. To je produktová zmena v tom, čo sa uloží.
- Backendom, ktorý by nález 49 naozaj zachytil, je kontrola zastaraného formulára: klient pošle, čo videl, napríklad
  `processedMetadata` pri načítaní, a server odmietne, ak sa to medzitým zmenilo. Je to zmena API v oboch frontendoch
  a F-A až F-D ten istý prípad už zamykajú.
- **Odporúčam backend nemeniť.** Nález 49 rieši F-A až F-D.

## 3. C: `processedMetadata` v API (P1)

- **Zmena:** `CD/Model/Dto/AssetFile/Embeds/AssetFileFlagsAdmDto.php:10-32` dostane `#[Serialize] bool $processedMetadata`,
  vyplnený v `getInstance`. Ten DTO majú všetky súbory (`CD/Model/Dto/AssetFile/AbstractAssetFileAdmDto.php:39`), teda
  aj `mainFile.flags.processedMetadata` v detaile assetu a v hromadnom čítaní.
- **Len na čítanie:** PUT `/image/{id}` (`CD/Controller/Api/Adm/V1/ImageController.php:255-266`) berie z príznakov len
  `public` a `singleUse` (`CD/Domain/Image/ImageManager.php:42-53`). Klient ho teda nezmení; stačí to pripnúť testom.
- **Kópie:** nastaviť `true` už na prázdnom súbore kópie pri jej založení (`CD/Domain/Asset/AssetCopyBuilder.php:58-68`).
  Metadáta kópie sú hotové už pri PATCH a kópia sa nespracúva (`2-notif-be.md` 4d). Prípadne to isté aj v
  `CD/Domain/AssetFile/AssetFileCopyBuilder.php:29`.
- **Závislosť:** bez BE-1 by príznak mohol prísť skôr ako vlastné polia (medzizápis, 1.1) a cesta 6 by po ňom
  metadáta ešte prepísala. Frontend, ktorý by sa podľa neho odomykal, by tak nález 51 otvoril znova. Preto musí ísť
  v tom istom vydaní ako opravené BE-1 (kontrola príznaku pod zámkom v oboch cestách, príznak až v poslednom zápise).
- **Pokyn pre frontend do vydania:** pravidlo dopytovania (formulár riadku uploadu až pri `processed`,
  `uploadSettle.ts:613-643`, admin-dam `uploadQueuesStore.ts:95-106`) nechať. `processedMetadata` nepoužiť na skoršie
  odomknutie, kým nie sú vydané BE-1 aj BE-2.
- **Migrácia** netreba, stĺpec existuje (`CD/Entity/Embeds/AssetFileFlags.php:13-14`). Staré kópie ostanú s `false`,
  preto frontend berie „príznak, alebo stav `processed`, `duplicate`, `failed`“. **API:** pole len pribudne.
- **Čo získa frontend:**
  1. Dopytovanie odomkne riadok uploadu v tej istej chvíli ako dnes notifikácia (dnes len notifikácia `uploadSettle.ts:576-588`,
     dopytovanie až pri `processed` `:320-348`). To je potrebné, ak sa od notifikácií odíde (`2-notif-be.md` §10 P1, P2).
  2. Pravidlo F-A až F-D by mohlo byť „nepopísaný a `processedMetadata` nie je a súbor nie je `processed`, `duplicate`
     ani `failed`“. Hromadná úprava a detail by sa odomkli hneď po ceste 1b, nie až po spracovaní, a kópie hneď.
  3. Čítanie po príznaku netreba odkladať o 2 s (`LIB/domains/dam/uploadQueue/settlement/uploadPollSchedule.ts:48`),
     lebo príznak sa zapíše v tom istom potvrdení ako vlastné polia.
  Frontend na to potrebuje asi 3-4 h (typy, pravidlo v DAM aj LIB, usadzovanie) ako malý krok až po vydaní BE-1 a
  BE-2 v core-dam, nie v kroku 5.

## 4. D: nález 52 (nový slot nepopísaného assetu)

- **Mechanizmus:** prvý kúsok každého súboru, aj súboru do slotu, spustí cestu 1b (`CD/Domain/Chunk/ChunkFacade.php:57-59`).
  Návrhy sa pýtajú len na `described` (`AbstractSuggester.php:47`), nahradia návrhy assetu EXIF-om nového súboru
  (`KeywordSuggester.php:37`, `AuthorSuggester.php:58`) a pridajú slová a autorov. Vlastné polia sa naopak dopĺňajú len
  raz na asset (`MetadataProcessor.php:35`).
- **Je to zámer?** Nikde to nie je zapísané (ani v kóde, ani v `core-dam-bundle/CHANGELOG.md`). Kde sa návrhy viažu na asset a
  nie na súbor, a vlastné polia raz na asset, vyzerá to skôr ako nedomyslené. To je moja úvaha.
- **Dosah v tomto core-dam:** viac slotov má len audio v CMS (free, premium, bonus, long, trial;
  `C/config/packages/anzu_systems_core_dam_ext_systems.php:186-195`). Všetky obrázky majú jediný slot `default`
  (napríklad `:38-43`, `:443-449`). Video a dokument majú `file_slots: null` (`:305`, `:407`), z čoho je predvolený
  `['default']` (`CD/DependencyInjection/Configuration.php:472-480`), a iný slot sa odmietne
  (`CD/Domain/AssetFile/AbstractAssetFileFacade.php:369-381`). Obrázok v admin-dam druhý súbor nedostane.
- **Možnosti:**
  - (a) backend: návrhy len z hlavného súboru, v `AbstractSuggester::supports` porovnať `getMainFile()` so súborom,
    1-2 h;
  - (b) backend: návrhy zlučovať namiesto nahradenia; slová a autori by však pribúdali ďalej;
  - (c) frontend: posielať len zmenené polia (otvorená téma po kroku 5, `nalez49-frontend.md` bod 8, asi 1 deň v DAM);
  - (d) nechať.
- **Odporúčam (a), ak backend potvrdí, že nejde o zámer; inak (d).** Frontend nemeniť; to sedí s rozhodnutím
  „nechať zapísaný, mimo kroku 5“ (`upload-postup.md:456`).

## 5. Vedľajší nález: návrhy podľa nastavenia prvého súboru vo workeri

`AbstractSuggester` si nastavenie pamätá bez kľúča (`AbstractSuggester.php:19`, `KeywordSuggester.php:79`,
`AuthorSuggester.php:101`: `configurationCache ??= …`). Služba je zdieľaná a worker beží dlho; vymení sa po 10 správach
alebo 600 s (`C/docker/kubernetes/configuration.yaml:194,196`, prevod na `messenger:consume` odvodený). Entity manager sa
vyprázdni, služby nie. Že tieto služby nič nevynuluje, vyvodzujem zo Symfony, kód som nečítal. Fronta metadát mieša
systémy aj typy (`2-notif-be.md` §7). Nastavenia sa líšia: obrázok CMS berie autorov z `Artist`, `Creator`, `OwnerName`
(`anzu_systems_core_dam_ext_systems.php:52-60`), obrázky dennik_sport, eu_brief a people majú autorov bez značiek
(`:574-577`, `:638-641`, `:522-525`). Ak teda worker najprv spracuje obrázok dennik_sport, obrázky CMS potom nedostanú
návrhy autorov. Naopak, po obrázku CMS dostanú autorov z EXIF obrázky dennik_sport. Odvodené z kódu, neoverené v
logoch. **Oprava (BE-4):** pamätať si nastavenie podľa systému a typu, alebo si ho nepamätať vôbec; asi 1 h s testom.

## 6. E: kde sa to robí a ako sa to dostane do core-dam

- **Balík:** `anzusystems/core-dam-bundle` z GitHubu (`C/composer.lock:305-310`), nainštalovaný ako zip bez `.git`.
  Lokálny repozitár som v prehľadaných miestach nenašiel (`find` v `/home/volar` do hĺbky 5 a v `/` do hĺbky 6), čo
  nevylučuje kópiu inde. `C/composer.json` nemá `repositories` ani záplaty. Či je 1.52.0 posledná verzia, som
  neoveroval (bez siete).
- **Tok vydania (odvodený z histórie core-dam, nie z popisu procesu):** zmena v balíku a značka, potom v core-dam
  obmedzenie `^1.52.0` (`C/composer.json:13`) a lock, a nakoniec vydanie core-dam s changelogom
  `C/doc/Core-Dam-Changelog/<verzia>.md` (posledná 1.65.0 z 2. 10. 2026). Pri oprave sa dočasne použije vetva
  `dev-hotfix/…` na overenie na stage, potom značka (commity `2639784` a `7bf75f3`, 30. 7. 2026).
- **Prepísať v aplikácii je ťažké, nie nemožné.** Hlavné dotknuté triedy sú `final` (`MetadataProcessor`,
  `AssetMetadataProcessor`, `AssetMetadataAutocomplete`, `AssetMetadataBulkFacade`, `AssetFileFlagsAdmDto`,
  `AssetFileCopyBuilder`, `KeywordSuggester`, `ImageStatusFacade`) a vkladajú sa podľa konkrétneho typu
  (`AbstractAssetFileStatusFacade.php:59,95`), takže dekorátorom ich nahradiť nejde. Nie všetko je však `final`:
  `AssetCopyBuilder` nie je (`CD/Domain/Asset/AssetCopyBuilder.php:16`), takže časť BE-2 pre kópie by sa v aplikácii
  dala. Jadro BE-1 a DTO z BE-2 nie. Aplikácia dnes mení len rozhrania aliasom (`C/config/services/_default.php:48-49`).
  Odporúčam robiť to v balíku.
- **Výnimky v aplikácii:**
  - Hromadné uloženie pre UGC je kópia v core-dam (`C/src/Domain/AssetMetadata/AssetMetadataBulkUgcFacade.php:26-33`,
    má TODO zjednotiť ju). BE-1 c) treba urobiť aj tam, alebo lepšie: balík ponúkne spoločnú časť a aplikácia ju použije.
  - `C/src/Domain/Chunk/ChunkUgcLegacyFacade.php:57` volá `MetadataProcessor` synchrónne a zmenu dostane sama.

## 7. Neoverené

- Časy okien a pravdepodobnosť poradia ciest 1b a 6 (počet podov, rytmus Pub/Sub); nič som nemeral.
- Izolácia transakcií v produkcii a to, či služby workera nič nevynuluje (časť 5).
- Duplicitné vloženie kľúčového slova či autora a čo potom presne urobí worker (1.2), mám len z kódu.
- Testy balíka (upstream `tests/`) v inštalácii nie sú, takže návrhy testov sa o existujúcu sadu neopierajú.
- Či platnosť zámku 60 s stačí na krok s návrhmi (zakladanie slov a autorov s indexom v ES).
- Či iná kópia repozitára balíka existuje mimo prehľadaných miest a presný postup vydania.

## 8. Návrh zápisu do denníka (pre vedúceho; existujúce dokumenty nemením)

- Riadok 51, doplniť: „Okno v ceste 6 je dlhé: worker načíta asset pred zámkom licencie a metadáta spracuje druhý raz,
  keď si príznak prečítal pred cestou 1b. So zapnutými notifikáciami zasiahne aj toho, kto nahráva (riadok uploadu sa
  odomkne notifikáciou 1b); samotné dopytovanie otvorí formulár až pri `processed`. Úloha BE-1
  (`analyzy/be-core-dam-ulohy.md`).“
- Riadok 52, doplniť: „V tomto core-dam len audio v CMS (iné typy majú jeden slot). Úloha BE-3 s otázkou na zámer.“
- Nový riadok: „Návrhy kľúčových slov a autorov vo workeri používajú nastavenie systému a typu prvého spracovaného
  súboru (`AbstractSuggester::$configurationCache`); backend, odvodené z kódu. Úloha BE-4.“

## 9. Texty úloh pre backend

**BE-1: Spracovanie metadát nesmie prepísať čerstvé uloženie metadát assetu**
> Kontext: Spracovanie metadát (`MetadataProcessor::process`, cesty z prvého kúska a z `AbstractAssetFileStatusFacade::process`)
> pracuje so zastaranou kópiou assetu. V `process` sa asset načíta už v `FileAttributesProcessor.php:65`, teda pred
> zámkom licencie, uložením a orezmi, a príznak `processedMetadata` sa číta z kópie súboru z
> `AssetFileChangeStateHandler.php:81`. Keď medzitým používateľ uloží `metadata-bulk-update` s `described: true`,
> worker podľa kópie (`described = false`) obnoví návrhy, vráti odobraté kľúčové slová a autorov a `array_merge`
> s EXIF prepíše uložené vlastné polia. Celý JSON `customData` sa zapíše z kópie. `described` ostane `true`, takže
> strata je trvalá. Ak používateľ medzitým pridal to isté slovo alebo autora, vloženie môže pri presnom časovaní
> porušiť primárny kľúč `asset_keyword` či `asset_author`. Cesta z prvého kúska dnes príznak `processedMetadata`
> nekontroluje vôbec, cesta `process` len vo svojej kópii; obe tak môžu krok spustiť dvakrát.
> Zmena: (1) V `MetadataProcessor::process` nechať exiftool mimo zámku. Časť, ktorá číta a mení asset, dať pod
> `ResourceLocker` `asset_metadata_<assetId>`. Pod zámkom **najprv** obnoviť súbor (alebo prečítať príznak dotazom z
> DB) a ak je `processedMetadata` už `true`, skončiť bez zápisu a bez notifikácie; platí to pre obe cesty, takže krok
> prebehne len raz. Potom `refresh` assetu aj `AssetMetadata`, návrhy a doplnenie podľa čerstvých príznakov,
> `setProcessedMetadata(true)` až tesne pred posledný flush, flush, odomknutie vo `finally`, notifikácia po potvrdení.
> Existujúci `lock_suggester_` nechať: má iný názov, takže vnorenie nevadí (nereentrantný je len rovnaký názov).
> (2) V `AbstractAssetFileStatusFacade::process` spustiť krok (1) **pred** `beginTransaction()`, nie vnútri transakcie
> spracovania. O tom, či krok niečo urobí, rozhodne kontrola v (1), nie kópia súboru z handlera. Synchrónna cesta
> z URL (`AssetSysFacade::createFromUrlDto`, `ImageDownloadFacade`) má vonkajšiu transakciu, takže tam krok beží v nej
> a zámok sa uvoľní pred jej potvrdením. Asset je tam nový a pre ostatných neviditeľný; overte to, nič tam nemeňte.
> (3) V `AssetMetadataBulkFacade::bulkUpdate` a v kópii `App\Domain\AssetMetadata\AssetMetadataBulkUgcFacade::bulkUpdate`
> po validácii zamknúť všetky assety zoradené podľa id, urobiť `refresh` assetu a metadát, použiť DTO, flush a
> odomknúť pred indexom v ES. Uloženie jedného assetu z frontendu ide tým istým koncovým bodom.
> (4) Posúdiť rozsah: majú `asset_metadata_` brať aj import od poskytovateľa (vyplní vlastné polia a autorov pri
> založení, `AbstractAssetFileFactory::createFromExternalProvider`) a zápisy sys API z URL (`AssetSysFacade::createFromDto`,
> `setupKeywords`, `setupAuthors`)? Podľa nášho čítania nie, lebo asset je vtedy nový; prosíme potvrdiť.
> Testy: (a) cesta z prvého kúska: asset zmenený v DB po načítaní súboru (`described = 1`, vlastné polia, odobraté
> slovo) ostane po spracovaní taký, ako bol uložený; (b) obe cesty pre ten istý súbor za sebou v ľubovoľnom poradí:
> krok prebehne raz a príde jedno `asset_metadata_processed`, aj keď druhá cesta má v pamäti `processedMetadata`
> `false`; (c) `process`, kde sa asset uloží s `described = 1` po načítaní v `storeAndProcess`: nič z EXIF
> nepribudne; (d) hromadné uloženie počká na držaný zámok a zapíše čerstvé dáta (alebo nad mockom zámku poradie
> lock → refresh → flush → unlock); (e) to isté slovo od používateľa aj z EXIF neporuší primárny kľúč; (f) bežný
> upload doplní vlastné polia, návrhy, slová a autorov ako doteraz a príznak sa potvrdí spolu s vlastnými poľami;
> (g) koncový bod UGC rovnako ako (d); (h) synchrónna cesta z URL funguje ako doteraz.
> Migrácia: žiadna. API: bez zmeny; uloženie môže počkať, kým worker dokončí krok (do ~1 s). Riziko: stredné
> (zámky, presun kroku pred transakciu; metadáta ostanú aj pri neskoršom zlyhaní spracovania, ako dnes po prvom
> kúsku; či platnosť zámku 60 s stačí, overiť). Veľkosť: balík asi 1 deň s testami, aplikácia asi 2 h, vydanie a
> zvýšenie verzie asi 2 h.
> Menšia varianta: body (1) a (2) bez zámku pri uložení, asi 0,5-0,75 dňa. Uzavrie dlhé okno a dvojité spracovanie,
> krátke okno od čerstvého čítania po zápis ostane.

**BE-2: `processedMetadata` v príznakoch súboru (len na čítanie)**
> Kontext: Klient, ktorý stav dopytuje, dnes nevie, že metadáta sú spracované, kým súbor nie je `processed`.
> Príznak v DB existuje (`AssetFileFlags::$processedMetadata`), API ho nevracia.
> Zmena: `AssetFileFlagsAdmDto` dostane `#[Serialize] bool $processedMetadata` z entity. Na vstupe sa nepoužije;
> `ImageManager::updateImage` berie len `public` a `singleUse`. Kópie: pri zakladaní prázdneho súboru kópie
> (`AssetCopyBuilder::copySlotToAsset`) nastaviť `true`, lebo kópia sa nespracúva a jej metadáta sú hotové pri PATCH.
> Vydať spolu s BE-1 (kontrola príznaku pod zámkom v oboch cestách, príznak až v poslednom zápise), lebo inak sa
> príznak môže potvrdiť skôr ako vlastné polia a cesta `process` po ňom metadáta ešte prepíše. Frontend sa podľa
> príznaku začne odomykať až po tomto vydaní.
> Testy: príznak v `GET /image/{id}`, v `mainFile` pri `GET /asset/{id}` a v hromadnom čítaní; PUT obrázka s
> `processedMetadata` ho nezmení; kópia ho má hneď `true`; pri bežnom uploade je `true` až s vlastnými poľami.
> Migrácia: žiadna (staré kópie ostanú s `false`, klient berie aj stav súboru). API: pole len pribudne.
> Riziko: nízke. Veľkosť: 2-3 h.

**BE-3: Návrhy kľúčových slov a autorov len z hlavného súboru (najprv potvrdiť zámer)**
> Kontext: Súbor nahraný do ďalšieho slotu nepopísaného assetu (v core-dam len audio CMS: free, premium, bonus,
> long, trial) spustí návrhy znova. Tie nahradia návrhy assetu EXIF-om nového súboru a pridajú slová a autorov.
> Vlastné polia sa pritom dopĺňajú len raz na asset.
> Otázka: je to zámer? Ak nie, zmena: v `AbstractSuggester::supports` pustiť návrhy len pre hlavný súbor assetu.
> Testy: druhý slot nepopísaného audia nezmení návrhy, slová ani autorov; hlavný súbor ako doteraz.
> Migrácia: žiadna. API: bez zmeny. Riziko: nízke. Veľkosť: 1-2 h.

**BE-4: Nastavenie návrhov podľa systému a typu súboru, nie podľa prvého súboru workera**
> Kontext: `AbstractSuggester::$configurationCache` (`KeywordSuggester::getConfiguration`, `AuthorSuggester::getConfiguration`)
> si pamätá nastavenie bez kľúča. V dlho bežiacom workeri sa nastavenie systému a typu prvého spracovaného súboru
> použije pre ďalšie súbory iných systémov, napríklad obrázky CMS po obrázku dennik_sport nedostanú návrhy autorov.
> Zmena: pamätať si nastavenie podľa `extSystem` a typu assetu, alebo si ho nepamätať.
> Testy: dva súbory rôznych systémov za sebou v tej istej inštancii služby dostanú každý svoje nastavenie.
> Migrácia: žiadna. API: bez zmeny. Riziko: nízke. Veľkosť: asi 1 h.

## Pre vlastníka

1. **BE-1 (nález 51):** dať backendu úlohu so zámkom na asset a čerstvým čítaním pri spracovaní metadát aj pri uložení.
   Príznak sa skontroluje pod zámkom v oboch cestách, takže krok prebehne len raz. **Odporúčam áno**, asi 1,5 dňa
   backendu (balík a kópia UGC v core-dam), mimo krokov tohto projektu.
2. `ORM\Version` ani „doplniť len prázdne kľúče“ ako opravu 51 nerobiť. **Odporúčam nie**: prvé neochráni vlastné
   polia ani slová a zlyhávalo by pri súbehu zápisov toho istého riadku; druhé súbeh neuzavrie.
3. **B:** uloženie nespracovaného assetu na backende neodmietať ani neignorovať. **Odporúčam nie**: škodlivý prípad
   nálezu 49 nezachytí, odmietlo by riadne uloženia z okna uploadu a nález 49 riešia F-A až F-D (0 h).
4. **BE-2 (P1):** `processedMetadata` v API a `true` na kópiách, len v tom istom vydaní ako BE-1. **Odporúčam áno**,
   backend 2-3 h. Využitie vo frontende asi 3-4 h ako malý krok po vydaní core-dam, nie v kroku 5. Dovtedy frontend
   nechá pravidlo dopytovania (formulár uploadu až pri `processed`) a príznak na skoršie odomknutie nepoužije.
5. **BE-3 (nález 52):** opýtať sa backendu na zámer; ak zámerom nie je, návrhy len z hlavného súboru. Frontend nemeniť.
   Dosah je len audio v CMS. **Odporúčam áno**, 1-2 h backendu.
6. **Nový nález (BE-4):** návrhy vo workeri berú nastavenie prvého spracovaného súboru. Zapísať do denníka a dať
   backendu. **Odporúčam áno**, asi 1 h.
7. **Na vedomie:** všetko sa robí v `anzusystems/core-dam-bundle` (vydanie, potom zvýšenie verzie v core-dam). Prepísať
   to v aplikácii je ťažké, väčšina dotknutých tried je `final`. Výnimkou je kópia uloženia pre UGC v core-dam, kam ide
   aj časť BE-1.
8. **Poradie:** BE-1 a BE-2 v jednom vydaní; frontend (pravidlo F-A až F-D s príznakom, dopytovanie) až po ňom.
   **Odporúčam áno.**
