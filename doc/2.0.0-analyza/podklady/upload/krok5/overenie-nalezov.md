# Overenie otvorených nálezov proti dnešnému kódu (12. 10.)

Zadanie vlastníka: overiť všetky zapísané nálezy, nechať len dokázané, rozdeliť na FE a BE, pridať návrh opravy.
Štyri nezávislé overenia (Opus, len čítanie, každé s úlohou nález vyvrátiť): widgety a galéria knižnice, fronta a
detail knižnice, admin-dam, backend core-dam. **Nič sa nespúšťalo**: „dokázané" znamená, že celá cesta chyby je v
dnešnom kóde ukázaná riadok po riadku (vrátane nainštalovanej závislosti alebo backendu, kde od nich tvrdenie
závisí). Frontendové nálezy, ktoré stoja na správaní backendu, sú spojené s tým, čo zistilo overenie backendu.

Cesty: `L` = `common-admin/src/domains`, `D` = `admin-dam/src/domains/coreDam/asset`, `B` =
`petit/core-dam/vendor/anzusystems/core-dam-bundle/src`.

## FE, knižnica (common-admin)

| Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|
| 59 + 84 (jeden problém) | Po uložení detailu otvoreného z dialógu fronty: keď nové čítanie assetu zlyhá, chyba sa zahodí, detail povie „upravené" a ďalšie uloženie fronty prepíše kľúčové slová, autorov, vlastné polia a jednorazovú licenciu starými hodnotami riadku | `L/dam/uploadQueue/store/uploadQueuesStore.ts:295,316-318`; `L/dam/assetDetail/components/AssetDetailSidebarMetadata.vue:65-69`; `UploadQueueDialog.vue:111,133`; test `uploadQueueOperations.test.ts:670-679` to dnes pripína ako želané | v `catch` zapísať do riadkov uložené hodnoty (z argumentu alebo z odpovede PATCH); test prepísať | S |
| 74 | Galéria bez kópie číta všetky vybrané assety pod licenciou prezeranou pri potvrdení; backend asset inej licencie potichu vynechá (200 s kratším zoznamom), obrázok dostane prázdny popis, zdroj a autorov | `ImageWidgetMultipleInner.vue:275-280,321-322,354,376-378`; backend `B/Repository/AssetRepository.php:82-92` | v `assetSelectConfirmMap` čítať po licenciách assetov, autorov pod ext systémom tej licencie; pri odmietnutí ukázať chybu | S až M |
| 55 | `updateAssetAuthors` je posledné uloženie v starom tvare: pri 422 dve hlášky; keď nie sú načítané prvky vlastného formulára, „Potvrdiť" sa točí navždy. Backend odpovedá 200 alebo 422 | `L/dam/api/damAssetApi.ts:314-316,358-394`; volajúci `ImageWidgetInner.vue:614-615`, `ImageMediaWidgetInner.vue:757-758`; backend `B/Controller/Api/Adm/V1/AssetController.php:196-210` | prepísať podľa `bulkUpdateAssetsAuthors` (`:404-411`), volajúci `showMetadataSaveError` | S |
| 54 | Galéria: riadok, ktorého asset DAM pri načítaní nevrátil (zmazaný, iná licencia), po prvom uložení vymení pole zdroja za prázdny výber autorov a zdroj prestane byť povinný | `ImageWidgetMultipleInner.vue:168-174,515`; `ImageWidgetMultipleItem.vue:50-53,111` | `:515`: `matchedImage ? matchedImage.showDamAuthors && matchedImage.damAuthors.length === 0 : false` | S |
| 79 | Galéria pri 51 a viac súboroch: nič sa nezaradí, dialóg fronty sa aj tak otvorí prázdny a po „Zrušiť" ostane | `ImageWidgetMultipleInner.vue:208-209,219-220`; `ImageWidgetMultipleLimitDialog.vue:74-85` | zmazať dva riadky; dialóg otvára `@after-add` po skutočnom zaradení | S |
| 81 | Dialóg výberu súboru: z viacerých pustených súborov vezme prvý ešte pred kontrolou formátu, bez upozornenia; ak je prvý zlý, platný druhý sa stratí | `AFileInputDialog.vue:92-101`; `AFileInput.vue:62-67,109-115`; `AFileDropzone.vue:46-50` | v `AFileInput` pri jednom súbore skontrolovať všetky, upozorniť, vziať prvý platný | S |
| 78 | Dialóg detailu obrázka: pole popisu nemá väzbu validácie; popis nad 2 000 znakov len zablokuje potvrdenie všeobecnou hláškou | `ImageDetailDialogMetadata.vue:91-95,225-229` | doplniť `:v` | S |
| 82 | Hromadné operácie galérie: dve dvojice tlačidiel majú rovnaké prístupné mená | `ImageMassOperations.vue:109,125,164,180,210,226` | použiť existujúce kľúče `fillOneEmptyField`, `replaceOneField` | S |
| 67 | „+" na chipe konfliktu autora číta čítačka ako „Zavrieť" | `AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:43-48`; `vuetify/lib/components/VChip/VChip.js:40-43,133-134` | `close-label` a nový text (sk, en, cs) | S |
| 75 | Dialóg jedného súboru zapíše asset do zdieľaného skladu aj po zatvorení; ďalší dialóg ukáže „File info" predošlého súboru. Nič sa neuloží zle | `UploadQueueDialogSingle.vue:86-90,183-189` | po `await` skončiť, ak dialóg už neukazuje ten riadok | S |
| 60 | Tlačidlá uloženia sa pri ukladaní len točia; Enter alebo medzerník pošle druhé rovnaké uloženie. Neškodné | `UploadQueueDialog.vue:100-103,120-123,236-250`; `AssetDetailSidebarMetadata.vue:55-57` | prvý riadok obslúh: skončiť, kým beží uloženie | S |
| 61 | Tvrdenie testu, ktoré nemôže zlyhať. Len testy | `uploadQueuesStore.test.ts:463-480` | zmazať alebo dať mock, ktorý odpovie po zrušení | S |
| 80 | Po odobratí obrázka galérie idú nové pozície za staré maximum (1, 3, 4). core-cms ich uloží, ako prišli; pri načítaní sa triedi podľa pozície, dôsledok sa nenašiel | `ImageWidgetMultipleInner.vue:360-364,534-551`; `petit/core-cms/src/Domain/Image/Manager/ImageManager.php:79` | `updateAllPositions()` po odobratí; odporúčam nechať | S |
| 65, 88, 89 | Prázdny súbor sa spustí znova (bez účinku); hodiny späť pred poslednou odpoveďou (kozmetika, veľmi zriedkavé); opakované čítanie kúska na hranici veľkosti (výkon) | `uploadService.ts:195-199`; `uploadMeter.ts:45-50,86-91`; `damUploadChunkSize.ts:21-31` | odporúčam nechať | S |

## FE, admin-dam

| Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|
| Koreň 49 | Hromadné uloženie pošle každý riadok s formulárom celý, aj nedotknutý, s `described: true`; zmenu iného redaktora medzi načítaním a uložením potichu prepíše. Backend polia, ktoré neprídu, preskočí | `D/api/assetApi.ts:202-217,288-296`; test `overlaySave.test.ts:499-520`; `B/Domain/Asset/AssetMetadataBulkManager.php:45-141` | pamätať si načítané hodnoty riadku a poslať len zmenené polia; najprv rozhodnutie produktu, či má uloženie označiť `described` aj nedotknuté riadky | L (asi deň) |
| 73 | Úzky súbeh: bežná vetva dávky prepíše riadok, ktorému už notifikácia dala formulár, aj to, čo doň používateľ napísal | `D/store/uploadQueuesStore.ts:456-499` (`:478-486`, `:407-420`); `lazyMetadata.test.ts:197-216` | riadok s `canEditMetadata` si hodnoty nechá a len prejde na „hotový" | S |
| PV16-D | Po zlyhanom prvom čítaní distribúcií karta povie „Nie je čo zobraziť", nič nečíta znova a nemá „skúsiť znova"; späť sa dá len prepnutím záložky | `AssetDetailSidebarDistribution.vue:71-84,129-134`; `distributionListPoll.ts:85-100,145`; test `distributionListPoll.test.ts:702-718` | miestny príznak zlyhania a riadok s chybou a tlačidlom; dva nové texty | S |
| 56 | Pravý panel zoznamu zruší „upravené" pred odoslaním; po zlyhanom uložení „Uložiť" vyzerá, akoby nič neuložené nebolo | `D/components/list/components/AssetListSidebarMetadata.vue:81-82,92-93,174` | v `catch` vrátiť príznak, ak je otvorený ten istý asset | S |
| 14 | 72 ikonových `VBtn` v 40 súboroch a 1 klikateľná ikona bez prístupného mena (60 má aspoň bublinu); žiadny `.vue` admin-dam nemá `aria-label`. Počítané skriptom, obmedzenia: len `VBtn` a `VIcon` v šablónach admin-dam | skript `scratchpad/a11y_icon_buttons_admin_dam.py`; strážny test `src/test/a11y/iconButtonNames.test.ts:15-22` kryje tri súbory | `:aria-label` z textu bubliny, 12 nových mien, strážny test na celý `src` | M |
| 71, `resetList()` | Mŕtvy riadok typov a akcia skladu distribúcií bez volajúceho | `src/plugins.d.ts:29`; `D/store/distributionListStore.ts:88-90,129` | zmazať | S |

## BE, core-dam (v úlohe Azure DevOps #86919: BE-1 až BE-4, doplnené 12. 10.; nová otázka je tam ako BE-6)

| Bod | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|
| BE-1 (nález 51) | Spracovanie metadát prvého kúska číta asset, neskôr zapíše celé JSON stĺpce z tej kópie; uloženie metadát nemá zámok ani verziu. Uloženie medzi čítaním a zápisom workera sa stratí (návrhy sa vrátia, pribudnú EXIF kľúčové slová a autori, vlastné polia z EXIF sa prepíšu). Ako často, nie je zmerané | `B/Domain/AssetFile/FileProcessor/MetadataProcessor.php:30-46`; `B/Domain/AssetMetadata/AssetMetadataProcessor.php:62-63`; `B/Domain/AssetMetadata/AssetMetadataBulkFacade.php:46-80` | zámok na asset, znova prečítať príznak a asset v `MetadataProcessor::process` aj v `bulkUpdate` | M |
| BE-4 (nález 53) | Návrhár si drží nastavenie prvého spracovaného súboru po celý život procesu; súbory iného systému či typu dostanú zlé nastavenie, v oboch smeroch (aj založenie kľúčových slov a autorov v cudzom systéme) | `B/Domain/AssetMetadata/Suggestion/AbstractSuggester.php:19`; `KeywordSuggester.php:77-82`; `AuthorSuggester.php:99-104` | zmazať vlastnú pamäť, poskytovateľ konfigurácie ju má po systémoch | S |
| BE-3 (nález 52) | Prvý kúsok každého súboru spustí návrhy znova, kým asset nie je popísaný; ďalší slot nahradí návrhy a môže pridať kľúčové slová a autorov. Týka sa audia cms aj anzunews. Zámer z kódu nevidno | `B/Domain/Chunk/ChunkFacade.php:57-59`; `AbstractSuggester.php:43-50` | návrhy len z hlavného súboru; najprv potvrdiť zámer a overiť, kedy sa priraďuje `mainFile` | S |
| BE-2 | API nevracia `processedMetadata`; frontend nevie, že spracovanie dopísalo metadáta | `B/Model/Dto/AssetFile/Embeds/AssetFileFlagsAdmDto.php:12-32` | pole v DTO; zmysel má len s BE-1 a so zmenou vo frontende | S |

Nález 51b: fakty v kóde platia (asset sa číta pred zámkom licencie, krok sa pri opakovanom doručení zopakuje), ale
scenár z prevádzky dokázaný nie je (chýba štartovací skript workerov a meranie). Ostáva ako dôvod v BE-1, časové
tvrdenia vypustiť.

Návrh úprav textu úlohy #86919: BE-1 doplniť, že prvý kúsok sa pri opakovanom doručení zopakuje, a označiť trvania
za neoverené; BE-3 doplniť audio anzunews a overenie `mainFile`; BE-4 doplniť opačný smer. Nová otázka pre backend
(fakt v kóde, zámer neznámy): pri duplikáte v uploade do slotu sa epizódy podcastu materského assetu presunú na asset
originálu (`B/Event/Listener/AssetFileDuplicatePreFlushEventListener.php:19-26`).

## Vypadli (nedokázané alebo vyvrátené)

- **77 vyvrátený:** riadok slotu kôš nikdy nemá. Sloty idú do fronty `slots`, ktorú kreslí `AssetQueueItemList` len
  s „Zrušiť"; riadok s košom (`AssetQueueEditable`) je len vo frontách `global` a `edit` (overené aj vedúcim).
- **Nedokázané** (fakt v kóde platí, ale cesta, ktorou by naň niekto narazil, sa nenašla): 58, 66, 69, 72, 76, 83,
  85, 87.
- **Nie sú chyby:** 100 % a 0 s počas čakania na server je zámer merača; „Invalid token (401)" pri `test:eslint` je
  výstup testu `src/test/vite/anzuSentry.test.ts`, ktorý si sám spustí miestny server odpovedajúci 401.

## Stav po opravách (12. 10. večer)

Vlastník rozhodol opraviť: v knižnici 59+84, 74, 55, 54, 79, 81, 78, 82, 67, 75, 60 (kroky OP-L1 až OP-L3 s cyklom
OP-L-c1); v admin-dam koreň 49, 73, PV16-D, 56, 71 s `resetList()` a z nálezu 14 len bubliny (kroky OP-D1 až OP-D3
s cyklami). Všetko opravené, posudky Codexu a Opusa bez otvoreného nálezu, kópia knižnice C5 v admin-dam zelená.
Bez opravy ostávajú dokázané 61, 65, 80, 88, 89 a z nálezu 14 mená pre čítačku obrazovky. Prehľad je v
`register-zblizeni.md`, časť 5.6; nové nálezy z tejto práce (90 až 109) sú v denníku.

## Druhé overenie: nálezy 90 až 109 (12. 10. dopoludnia)

Zadanie vlastníka: overiť rovnako ako prvé, nechať len dokázané, pridať popis a odporúčanie. Tri nezávislé overenia
(Opus, len čítanie, každé s úlohou nález vyvrátiť): widgety knižnice, fronta a UI knižnice, admin-dam. Z dvadsiatich
čísel sú 95 a 100 opravené cestou (OP-L-c1, OP-D-c2) a 107 je v BE-7 úlohy #86919; overovalo sa 17. **Dokázaných je
osem**, ostatné vypadli. Dokázané 94, 102, 108, 91, 109 a časti 90 a 105 si vedúci potvrdil vlastným čítaním.
Poradové čísla nadväzujú na FE-1 až FE-17.

### FE, knižnica (common-admin)

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-18 | 102 | Galéria (admin-cms): keď pri potvrdení výberu z knižnice zlyhá čítanie assetu (alebo ho DAM v odpovedi vynechá), riadok sa aj tak pridá s prázdnym výberom autorov DAM a s `assetId`. Keď doň redaktor vyberie autora (aj hromadným vyplnením) a galériu uloží, DAM autorov assetu **nahradí** vybranými. Ticho a nevratne. Pri načítaní stránky sa to nestane (opravené v FE-4). Druhý vstup: „Uložiť a použiť" odovzdá widgetu riadok, ktorého metadáta sa nenačítali, rovnako (odovzdanie isté, vznik takého riadku overený len čiastočne) | `ImageWidgetMultipleInner.vue:324-326,333,358-368` (stav), `:483-485,498-500` (uloženie); `damAssetApi.ts:345-352`; backend `AssetMetadataBulkManager.php:55-66`, `common-bundle AbstractManager.php:119-123`; test `consumerProfileImageWidgetMultipleUpload.test.ts:831-857` stav pripína | `showDamAuthors` len pre asset, ktorý sa prečítal (`assetMetadataMap.has(asset.id)` a žiadni autori); to isté rozlíšenie v `UploadQueueDialog.vue:147-153`; test prepísať. Viditeľné: po zlyhanom čítaní riadok ukáže pole Zdroj namiesto výberu autorov | S |
| FE-19 | 94 | Dialóg jedného súboru zatvorený skôr, než zlyhá čítanie assetu nahraného súboru: redaktor dostane chybovú hlášku, ktorá sama nezmizne, k dialógu, ktorý už nevidí. Kontrola z FE-10 kryje len úspešnú vetvu | `UploadQueueDialogSingle.vue:183-200` (`:192` kontrola, `:195-197` `catch` bez nej) | v `catch` tá istá kontrola; zlyhanie ostane v zapisovači chýb API | S |
| FE-20 | 108 | Kto raz v dialógu fronty otvoril úpravu assetu, má do obnovenia stránky po každom uložení detailu jedno čítanie assetu navyše; hláška „uložené" aj tlačidlo naň čakajú. Zápis do cudzej fronty vyvrátený (zhoda len podľa id assetu) | `assetDetailStore.ts:22,30-33`; jediný zápis `UploadQueueDialog.vue:171`; `AssetDetailSidebarMetadata.vue:70,73-76`; `uploadQueuesStore.ts:304-307` | v `updateFromDetail` skončiť pred čítaním, keď žiadna fronta nemá riadok toho assetu; doplnkovo príznak vrátiť pri zatvorení detailu | S |
| FE-21 | 104 | Všetky „+" na chipoch konfliktov autorov majú pre čítačku to isté meno „Pridať autora"; meno autora je len text vedľa, bez väzby | `AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:44-49`; `vuetify/lib/components/VChip/VChip.js:133-134,274-279` | `role="group"` a `:aria-label` s menom autora na chipe (s čítačkou neskúšané); odporúčam nechať | S |

### FE, admin-dam

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-22 | 90 | Karta distribúcií toho istého assetu otvorená znova (prepnutie záložky, nové otvorenie detailu), čítanie zlyhá: ostane zoznam z predošlého otvorenia a všeobecná chybová hláška; riadok chyby s „Skúsiť znova" z FE-14 sa neukáže, lebo zoznam nie je prázdny. Sám sa opraví len pri distribúcii v behu | `AssetDetailSidebarDistribution.vue:78-98,143-172`; `distributionListStore.ts:89-93`; `distributionListPoll.ts:143-148` | pri prvom čítaní inštancie karty zoznam vyprázdniť; zlyhanie padne do riadku chyby z FE-14, bez nového textu | S |
| FE-23 | 105 | Dve vlastné čítania tej istej karty (obnovenie po pridaní, zmazaní alebo úprave; stránkovanie) nemajú poradie: ktoré odpovie neskôr, zapíše zoznam aj stránkovanie. Redaktor vidí starší stav, napríklad znova práve zmazanú distribúciu. Filter a dopytovanie vyvrátené | `AssetDetailSidebarDistribution.vue:86-88,92,95-97`; `distributionApi.ts:50`; `useApiFetchList.ts:74,112,120` | zoznam, príznak aj vypnutie loadera len pre posledné vlastné čítanie, alebo predošlé rušiť | S |
| FE-24 | 91 | Po zmazaní distribúcie v rozšírených nastaveniach sa zmazaná položka na dobu jednej požiadavky znova ukáže a dá sa na ňu kliknúť; druhé zmazanie skončí chybou 404. Nič sa nepokazí | `DistributionManage.vue:94-104` (`finally` vypne loader, kým čítanie rodiča beží); `AListEditor.vue:292,585`; `runtime-core` (emit odpojeného komponentu sa zahodí) | `hideLoader()` z `finally` do `catch`; po úspechu loader vypne čítanie rodiča | S |
| FE-25 | 109 | Panel editora v dialógu exportných dát podcastu má bubliny natvrdo po anglicky: „Bold", „Italic", „Underline", „Link", „Remove link" | `anzutap/components/anzutapToolbar.ts:29,38,47,60,69`; `AnzutapToolbarItem.vue:37` | päť kľúčov sk a en, `t(item.titleT)` | S |

### Vypadli

- **Vyvrátené:** 99 (kľúč je v `common` každého adminu, holý kľúč sa neukáže), 101 (udalosť odpojeného dialógu Vue
  zahodí, do widgetu nič nepríde).
- **Bez účinku alebo bez škody:** 98 (do zdieľaného poľa nikto nepíše na mieste), 92 (riadok drží platnú odpoveď
  servera, uloženie posiela len rozdiel oproti nej; testy to pripínajú ako zámer).
- **Nedokázané** (fakt v kóde platí, cesta používateľa sa nenašla): 93 a 103 (treba widget, ktorého licencie ležia
  vo dvoch ext systémoch; v seedoch taký nie je, produkčné skupiny webov nikto nevidel), 97 (`addByFiles` dnes
  redaktor zlyhať nedonúti), 96 (admin-ugc: bez limitu, ale nič sa nad 50 nezlomí), 106 (len trojitý súbeh).

### Nové pozorovania z overenia (neoverené druhým čítaním, čísla 110 až 116)

- **110** knižnica: hromadné „vyplniť autorov" prepíše Zdroj aj riadku, ktorý výber autorov neukazuje
  (`useImageMassOperations.ts:55-58`); zámer neznámy.
- **111** knižnica: súbory pridané cez „+" alebo dropzónu počas bežiaceho „Uložiť a použiť" sa po dobehnutí zahodia
  bez hlášky (`UploadQueueDialog.vue:264-291,331-338`; `ImageWidgetMultipleInner.vue:445-451`).
- **112** knižnica, admin-ugc: tlačidlo „Nahrať" zoznamu assetov neobnoví svoj vstup, opätovný výber toho istého
  súboru po zastavenom nahraní nič nespustí (`AAssetListInner.vue:254-259`).
- **113** knižnica: `updateFromDetail` volá načítanie autorov a kľúčových slov raz za každú frontu v mape vrátane
  vyprázdnených (`uploadQueuesStore.ts:305,321-323`).
- **114** admin-dam: po úspešnom zrušení distribúcie sa dialóg nezavrie (`DistributionCancelDialog.vue:24-40`).
- **115** admin-dam: dvojklik na „Potvrdiť" v dialógu distribúcie pošle dva PATCH
  (`DistributionManageDialog.vue:49,61,77,149-154`).
- **116** admin-dam: tlačidlo „Remove link" editora sa ukáže, len keď je kurzor v odkaze už pri otvorení
  (`AnzutapToolbar.vue:33-43`, `anzutapToolbar.ts:71`).

## Tretie overenie: pozorovania 110 až 116 (12. 10., 10:30)

Zadanie vlastníka: skontrolovať, či sú to skutočné problémy, a priniesť len tie, čo sa preukážu, s popisom a riešením.
Dve nezávislé overenia (Opus, len čítanie zo snímok `OP2-L1` a `OP2-D1`, s úlohou pozorovanie vyvrátiť). **Zo
siedmich obstálo šesť**, 113 je vyvrátené. Kód 110, 114 a 116 si vedúci prečítal sám.

### FE, knižnica (common-admin)

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-26 | 110 | Hromadné „vyplniť autorov" galérie (admin-cms) sa nepozerá, či riadok výber autorov ukazuje: „prázdnosť" meria skrytým poľom `damAuthors`, ale prepíše aj Zdroj. „Vyplniť prázdne" tak riadku, ktorý ukazuje Zdroj a nemá autorov DAM (asset DAM nevrátil; po FE-18 aj asset, ktorý sa pri výbere neprečítal), potichu prepíše vyplnený Zdroj menami vybraných autorov; do DAM sa mu nič nezapíše, do CMS ide zlý zdroj. S prázdnym výberom sa tým istým riadkom Zdroj vymaže (odvodené, nespúšťané). „Nahradiť" prepíše Zdroj všetkých riadkov viditeľne a na vyžiadanie: rozhodnutie produktu, nie chyba | `useImageMassOperations.ts:36-60` (`:55` podmienka, `:56-57` zápis); `ImageWidgetMultipleItem.vue:110-145`; `ImageWidgetMultipleInner.vue:483-494`; test `ImageMassOperations.test.ts:64-74,121-136` kryje len riadok s výberom autorov | bez „nahradiť" plniť len riadky, ktoré výber autorov ukazujú; pri prázdnom výbere bez „nahradiť" nerobiť nič; každému riadku vlastná kópia poľa. Viditeľné: „Vyplniť prázdne" prestane prepisovať Zdroj riadkov bez výberu autorov | S |
| FE-27 | 111 | Kým v dialógu fronty beží „Uložiť a použiť", „+" aj dropzóna ostávajú aktívne. Súbor pridaný v tom okne sa začne nahrávať a po dobehnutí uloženia ho hostiteľ bez hlášky zahodí (zavrie dialóg, vyprázdni frontu); v DAM ostane rozpracovaný alebo nepripojený asset. Galéria admin-cms a admin-ugc, zoznam assetov admin-ugc; dialóg jedného súboru nie. Úzke okno | `UploadQueueDialog.vue:122-161,264-291,331-338`; `ImageWidgetMultipleInner.vue:445-451`; `AAssetListInner.vue:207-219`; `uploadQueueCore.ts:271-299` | počas oboch uložení vypnúť „+" a dropzónu dialógu. Viditeľné: „+" je počas ukladania sivé | S |
| FE-28 | 112 | admin-ugc, stránka zoznamu assetov: vstup tlačidla „Nahrať" si drží poslednú hodnotu, takže výber toho istého súboru znova (po zlyhaní, zastavení aj úspechu) nespraví nič, bez hlášky. Pustenie do dropzóny funguje | `AAssetListInner.vue:254-262` (slot nedáva kľúč vstupu); `admin-ugc/src/pages/dam/asset/index.vue:44-52`; `AFileInput.vue:86-90,103-111,131-140` (hodnotu nenuluje) | v `AFileInput` po odovzdaní súborov vynulovať hodnotu vstupu; opraví všetkých hostiteľov bez zmeny v adminoch. Viditeľné: ten istý súbor sa dá vybrať znova | S |

### FE, admin-dam

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-29 | 114 | Po úspešnom zrušení čakajúcej vlastnej distribúcie sa zoznam obnoví, ale dialóg ostane otvorený a žiadna hláška nepríde; druhé „Potvrdiť" pošle DELETE na už zmazanú distribúciu | `DistributionCancelDialog.vue:24-40` (`dialogCancel` nuluje len `onCancel` `:19-21`); `AssetDetailSidebarDistribution.vue:204` | po úspechu dialóg zavrieť a ukázať štandardnú hlášku o zmazaní | S |
| FE-30 | 115 | Dialóg úpravy a pridania záznamu distribúcie v rozšírených nastaveniach: „Potvrdiť" sa počas ukladania netočí ani nevypne (`saveButtonLoading` sa nastavuje, šablóna ho nepoužíva), druhý klik pošle druhú rovnakú požiadavku. Pri úprave dve hlášky „upravené", pri vytváraní „vytvorené" a potom chyba. Dve distribúcie u poskytovateľa vyvrátené (dialóg nič neodosiela); dva riadky v DB len pri súbehu, nedokázané | `DistributionManageDialog.vue:49,60-79,149-154`; backend `DistributionUpdateFacade.php:78-108,137-148` | `:loading` na tlačidle a návrat z obsluhy, kým beží uloženie | S |
| FE-31 | 116 | Editor exportných dát podcastu: o tlačidle „Odstrániť odkaz" sa rozhodne raz pri otvorení, keď je kurzor na začiatku textu. Ak text odkazom nezačína, tlačidlo sa neukáže nikdy; ak začína, svieti stále. Iný spôsob odstrániť odkaz v rozhraní nie je | `AnzutapToolbar.vue:25-43` (`show()` len v `onMounted`); `anzutapToolbar.ts:65-73`; `LinkDialog.vue:67-123` | viditeľné položky počítať reaktívne (`computed` nad `item.show()`). Viditeľné: tlačidlo sa ukáže, keď je kurzor v odkaze | S |

### Vypadlo

- **113 vyvrátené:** volania sú v cykle cez fronty, ale načítanie kešky je oneskorené a bez nových id nepošle nič;
  požiadaviek navyše je nula.

## Stav po opravách druhého a tretieho overenia (12. 10. popoludní)

Vlastník rozhodol opraviť FE-18 až FE-20, FE-22 až FE-25 (prvý blok) a FE-26 až FE-31 (druhý blok, „do radu");
FE-21 podľa odporúčania ostáva. Kroky: knižnica `OP2-L1`, `OP2-L2` (cykly c1, c2), admin-dam `OP2-D1` (c1),
`OP2-D2` (c1, c2). Každý krok prešiel posudkom Codexu aj Opusa, opravné cykly úzkym posudkom; posledné posudky sú
bez nálezu na opravu. Zmeny oproti zneniu z overenia: FE-26 plní prázdny viditeľný Zdroj ako doteraz a vyníma len
vyplnený; FE-27 kryje aj vlastný vstup hostiteľa (nález 123); FE-29 má navyše návrat počas bežiaceho zrušenia
a nezavrie dialóg otvorený medzitým pre inú distribúciu. Prehľad s viditeľnými dôsledkami a prijatými medzami je
v `register-zblizeni.md`, časť 5.7; nové nálezy z tejto práce (117 až 129) tamže v časti 8.

## Štvrté overenie: nálezy 117 až 129 (12. 10., 14:20)

Zadanie vlastníka: najprv overiť, potom priniesť popis a navrhované riešenie. Tri nezávislé overenia (Opus, len
čítanie, s úlohou nález vyvrátiť): `over-lib-4a` (117, 118, 128), `over-lib-4b` (119 so 129, 124, 127), `over-dam-4`
(120, 121, 122, 125, 126). Nález 123 bol zatvorený v FE-27. **Z dvanástich čísel (jedenásť problémov) obstálo šesť
problémov.** Kód 117, 124, 125 a 127 si vedúci prečítal sám.

### FE, knižnica (common-admin)

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-32 | 117 | Galéria admin-cms: riadok obrázka bez autorov má výber autorov DAM aj „upraviť asset". Keď redaktor autorov doplní v detaile, riadok sa po zavretí detailu neobnoví a ďalej ponúka prázdny výber. (1) Hromadné „vyplniť prázdnych autorov" alebo výber v riadku potom pri uložení galérie autorov z detailu v DAM nahradí. (2) Keď nevyberie nič, obrázok sa do CMS uloží s prázdnym zdrojom, hoci asset autorov má; pri ďalšom otvorení galérie riadok ukáže povinný prázdny Zdroj | `ImageWidgetMultipleInner.vue:430-445`, `:760-765` (dialóg bez `@close`, hoci ho `AssetDetailDialog.vue:41-45` vysiela), `:485-487`, `:500-503`; `ImageWidgetMultipleItem.vue:80-88,110-132`; `AssetDetailSidebarMetadata.vue:55-82`; backend `AssetMetadataBulkManager.php:55-66`, `common-bundle AbstractManager.php:111-147` | po zavretí detailu znova prečítať asset a riadkom s tým `assetId`: ak asset autorov má, nastaviť autorov, Zdroj = mená a výber autorov skryť. Viditeľné: riadok po zavretí detailu ukáže Zdroj s menami | S |
| FE-33 | 119, 129 | Dialóg fronty v admin-cms (notifikácie): nahraný riadok, ktorému sa nenačítali metadáta (notifikácia metadát sa stratila alebo mešká), má vypnutý formulár; „Uložiť a použiť" je aktívne, uloženie riadok ticho preskočí a obrázok príde do galérie bez popisu a zdroja, asset v DAM ostane neuložený. `dam.internal` je vtedy `false` bez ohľadu na asset (bezpečný smer, škoda nedokázaná). „Obnoviť" riadok ponúkne až po 20 s. Zriedkavé | `uploadSettle.ts:337-353`; `uploadSettlement.ts:617-643`; `UploadQueueDialog.vue:82-83,156,159,254-259`; `damAssetApi.ts:104,237-238`; `metadataToImageMap.ts:68-69,85,87`; test `metadataToImageMap.test.ts:199-216` to pripína | pred odovzdaním prečítať nahrané riadky bez formulára tým istým čítaním ako „obnoviť"; ak niektorý formulár dostal, zastaviť s upozornením, nech ho redaktor skontroluje a uloží znova (jeden nový text); ak čítanie zlyhá, pokračovať ako dnes. K tomu `internal` brať z riadku, keď ho odpoveď uloženia nemá | M |
| FE-34 | 124 | Vypnutá dropzóna dialógu fronty (počas ukladania, FE-27) sa pri ťahaní súboru stále rozsvieti cez celý dialóg, len bez textu; pustený súbor sa zahodí. Kozmetika | `AFileDropzone.vue:62-70` (trieda `--disabled` sa nenastavuje), `:168-198` (štýly ju čakajú); jediné použitie `disabled`: `UploadQueueDialog.vue:353-361` | nastaviť triedu `--disabled` a skryť prázdny text | S |
| FE-35 | 127 | V dialógu fronty sa na „+" nedá dostať klávesom Tab (`tabindex="-1"`), vstup pod ním je skrytý a dropzóna je len na myš: z klávesnice sa súbor do otvorenej fronty pridať nedá. Zámer nie je nikde doložený (atribút je tam od prvého commitu súboru, 2024) | `UploadQueueDialog.vue:293-303` (`:295`); `AFileInput.vue:129-143`; `vuetify/lib/components/VBtn/VBtn.js:184` | zmazať `tabindex="-1"`. Viditeľné len pre klávesnicu: jedna zastávka Tab navyše | S |

### FE, admin-dam

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-36 | 121 | Keď čítanie zoznamu po úspešnom zmazaní distribúcie zlyhá, redaktor vidí „záznam bol odstránený" a chybu čítania; zmazaná distribúcia ostane v karte aj v rozšírených nastaveniach s ceruzkou a košom, bez „Skúsiť znova". Sama zmizne len pri distribúcii v behu, inak po prepnutí karty | `forms/DistributionManage.vue:100-113,145-170`; `AssetDetailSidebarDistribution.vue:79-104,149-162`; `AListEditor` (zápis odpojeného editora Vue zahodí) | po úspešnom zmazaní riadok hneď odobrať zo zoznamu v sklade, ešte pred čítaním. Viditeľné len pri zlyhaní | S |
| FE-37 | 125 | Dialóg záznamu distribúcie: „Zrušiť" alebo krížik počas točiaceho sa „Potvrdiť" dialóg odpojí, uloženie dobehne, hláška „upravený/vytvorený" príde, ale zoznam sa neobnoví; ďalšia ceruzka plní formulár zo starého riadku | `forms/DistributionManageDialog.vue:51-54,60-81,107,148`; `forms/DistributionManage.vue:59-63,138-141,183` | kým uloženie beží, dialóg sa nedá zavrieť („Zrušiť" vypnuté, krížik bez účinku). Viditeľné: počas ukladania sa dialóg nezavrie | S |

### Vypadli

- **126 vyvrátené:** dialógy aplikácie sú `persistent` (predvoľby knižnice, `commonVuetifyConfig`), Esc, klik mimo
  ani Späť ich nezavrú; lokálne zavretie bez vedomia rodiča nemá spúšťač.
- **Nedokázané:** 118 (galéria „popísaný" neposiela, takže server doplní autorov aj po nej; bežný výber
  nespracovaný asset neponúkne), 120 (stránkovač sa pri dnešnej konfigurácii nevykreslí: najviac 5 distribúcií
  na asset), 122 (čítanie pri zavretí „Pridať distribúciu" je jediná cesta, ktorou sa nová distribúcia dostane do
  zoznamu), 128 (kópia by musela meškať sekundy až desiatky sekúnd a trafiť do sekundového okna uloženia).

## Stav po opravách štvrtého overenia (12. 10. podvečer)

Vlastník rozhodol opraviť všetkých šesť (FE-32 až FE-37). Kroky: knižnica `OP3-L1` s cyklom c1, admin-dam `OP3-D1`.
Každý krok prešiel posudkom Codexu aj Opusa, cyklus úzkym posudkom; posledné posudky sú bez nálezu na opravu.
Oproti zneniu z overenia: FE-32 číta asset, ktorý detail ukazoval, počká na dobiehajúce uloženie detailu a po zániku
widgetu nič nezapíše; FE-36 zatvára aj medzu FE-24 (nastavenia skryté počas mazania). Prehľad s viditeľnými
dôsledkami a prijatými medzami je v `register-zblizeni.md`, časť 5.8; nové nálezy z tejto práce (130 až 135) tamže
v časti 8.

## Piate overenie: nálezy 130 až 135 (12. 10., 17:25)

Zadanie vlastníka: popis a navrhované riešenie, ako doteraz po overení. Dve nezávislé overenia (Opus, len čítanie,
s úlohou nález vyvrátiť): `over-lib-5` (132 až 135), `over-dam-5` (130, 131). **Obstálo všetkých šesť**, tri so
spresnením znenia. Kód 132 si vedúci prečítal sám.

### FE, knižnica (common-admin)

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-38 | 132 | „Upraviť asset", ktorého čítanie z DAM zlyhá: ukáže sa chybová hláška a stránka ostane stmavená a mŕtva. Nekreslí sa nič, ostane len stmavenie a priehľadná plocha cez celé okno, ktorá berie kliky; dialóg je `persistent`, nezavrie ho Esc, klik mimo ani Späť. Pomôže len obnovenie stránky, neuložená práca (galéria, článok, nahraté nepoužité súbory) je preč. Štyria hostitelia: galéria, oba widgety jedného obrázka, dialóg fronty; admin-cms aj admin-ugc. Pri obrázku, ktorého asset bol v DAM zmazaný, pri KAŽDOM kliku; inak pri 5xx, timeoute, výpadku siete (widgety jedného obrázka aj pri 403). Platí pri prázdnom sklade detailu; so starším assetom v ňom pozri FE-39 | `ImageWidgetMultipleInner.vue:443-459`, `ImageWidgetInner.vue:562-577`, `ImageMediaWidgetInner.vue:687-702`, `UploadQueueDialog.vue:201-213`; `AssetDetailDialogFrame.vue:85-95`; `commonVuetifyConfig.ts:109-113`; `vuetify/lib/components/VOverlay/VOverlay.js:195-199,279-305` | detail sa zavrie sám, keď čítanie skončí bez assetu (jedno miesto v `AssetDetailDialog.vue` pre všetkých hostiteľov). Viditeľné: po chybovej hláške sa detail zavrie | S |
| FE-39 | 135 | Odpoveď čítania, ktorá príde po zavretí detailu z loadera, sa zapíše do skladu detailu spoločného pre stránku a ostane tam. Ďalší detail ju ukáže, keď jeho vlastné čítanie zlyhá alebo keď sa obe čítania prekryjú (staršia odpoveď po novšej prepne detail na starší asset natrvalo). Redaktor vidí názov, náhľad a formulár staršieho assetu; uloženie ide do zobrazeného assetu, nič sa nepomieša. Zriedkavé (pomalý DAM) | `AssetDetailDialog.vue:42-48`; `ImageWidgetMultipleInner.vue:443-458`; `assetDetailStore.ts:15-31`; rovnaký tvar `ImageWidgetInner.vue:562-577`, `ImageMediaWidgetInner.vue:687-702`, `UploadQueueDialog.vue:201-213` | zapisuje a loader vypína len posledné čítanie pri otvorenom dialógu, otvorenie sklad vyčistí; najčistejšie jedna akcia skladu pre štyroch hostiteľov, ktorá po chybe aj zavrie (spolu s FE-38) | S až M |
| FE-40 | 133 | admin-cms: nahratý duplikát obrázka, ktorý už v galérii je, sa vo fronte stane pôvodným assetom s formulárom; „Uložiť a použiť" zapíše jeho autorov do DAM a pridá druhý riadok toho istého súboru. Starý riadok ďalej ponúka prázdny výber: čo doň redaktor vyberie, pri uložení galérie nahradí autorov z fronty; bez výberu sa starý obrázok uloží bez zdroja. Zriedkavé, malá škoda | `uploadSettle.ts:516-545`; `UploadQueueDialog.vue:172-189`; `ImageWidgetMultipleInner.vue:461-467,554-559,572-574,595-606`; backend `AssetMetadataBulkManager.php:55-66` | pri „použiť" riadky toho istého assetu, ktoré ponúkajú výber, prevezmú autorov a Zdroj z použitej položky (bez čítania). Viditeľné: starý riadok ukáže Zdroj s menami | S |
| FE-41 | 134 | Dropzóna je pri ťahaní súboru vždy modrosivá; zelená „súbor je nad zónou" sa neukáže nikdy (pravidlo `--possibility` prepíše `--over`). Od prvej verzie komponentu (2023), kozmetika | `AFileDropzone.vue:64-65,170-178,192-200` | poradie pravidiel (zóna nad súborom zozelenie, čo adminy doteraz nevideli), alebo zmazať mŕtve pravidlá; odporúčam nechať | S |

### FE, admin-dam

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-42 | 130 | Po úspešnom zastavení čakajúcej distribúcie, keď následné čítanie zoznamu zlyhá: hláška o odstránení aj hláška o chybe a riadok ostane „čaká" s tlačidlom „Zastaviť distribúciu"; druhé zastavenie skončí 404. Zmizne samo asi do 15 s, keď server znova odpovedá (dopytovanie) | `DistributionCancelDialog.vue:36-45`; `AssetDetailSidebarDistribution.vue:79-104,149-184`; `distributionListPoll.ts:92-118,142-149` | po úspechu riadok odobrať zo zoznamu v sklade ako FE-36 (jedna akcia skladu pre obe miesta) | S |
| FE-43 | 131 | Detail assetu sa šípkou ← alebo → prepne na susedný asset aj s otvoreným dialógom nad ním, keď fokus nie je v `input` ani `textarea` (hneď po otvorení dialógu, po kliknutí na tlačidlo, pri pohybe po taboch klávesnicou). Panel aj s dialógom sa odpojí; rozpísaný formulár dialógu (pridanie distribúcie, záznam distribúcie) sa zahodí bez otázky. Uloženie, ktoré už odišlo, sa dokončí pre pôvodný asset, hláška príde nad ďalším. Šípky hore/dole (selecty) sa nepočúvajú | `AssetListView.vue:63-69`; `assetListActions.ts:394-427,478-486`; `shared/utils/event.ts:1-13`; `vuetify/lib/components/VDialog/VDialog.js:47-54,71-73`; `AssetDetailDialog.vue:161-166` | šípku nepustiť, keď je nad detailom otvorený iný dialóg alebo menu (rovnaký vzor aj v `externalProviderAssetListActions.ts:358-366`). Viditeľné: s otvoreným dialógom alebo menu šípky asset neprepnú | S |

K FE-43 patrí staršie správanie, ktoré je samostatným rozhodnutím a neopravuje sa: prechod na susedný asset
(šípkou aj tlačidlami v lište detailu) zahodí neuložené metadáta detailu bez otázky
(`assetDetailStore.ts:96`, `metadataAreTouched = false // todo check`).

## Stav po opravách piateho overenia (12. 10. večer)

Vlastník rozhodol opraviť všetkých šesť (FE-38 až FE-43; pri FE-41 chcel, aby zelená fungovala) a pridať upozornenie
pred zahodením neuložených metadát pri prechode na susedný asset (FE-44). Kroky: knižnica `OP4-L1` s cyklom c1,
admin-dam `OP4-D1` s cyklami c1 a c2. Každý krok prešiel posudkom Codexu aj Opusa, cykly úzkym posudkom; posledné
posudky sú bez nálezu na opravu (námietku Codexu k `close(null)` pri nahradení kľúča iným hostiteľom Opus posúdil
ako správne správanie). Prehľad s viditeľnými dôsledkami a prijatými medzami je v `register-zblizeni.md`,
časť 5.9; nové nálezy z tejto práce (136 až 149) tamže v časti 8.

## Šieste overenie: nálezy 136 až 149 (12. 10., večer)

Zadanie vlastníka („1 2 3", bod 3): overiť ako predošlé. Dve nezávislé overenia (Opus, len čítanie, s úlohou nález
vyvrátiť): `overenie6-lib` (136 až 140, 149), `overenie6-dam` (141 až 143, 145 až 148; čítal zmrazenú kópiu `src`
z commitu `1af3c3ac`). Nález 144 sa neoveroval: vlastník rozhodol upozornenie pridať (bod FE-45, krok `OP5-D1`).

### FE, admin-dam

Cesty sú voči `admin-dam/src`; `A/` = `domains/coreDam/asset/`, `EP/` = `domains/coreDam/externalProvider/`. Čísla
riadkov platia pre commit `1af3c3ac`. Obstálo päť, jeden čiastočne, jeden je vyvrátený (143); z jeho príznaku ostala
susedná vec (nový nález 150), ktorú si vedúci prečítal sám.

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-46 | 148 | Detail assetu externého poskytovateľa nakreslí namiesto svojho obrázka výber ROI s obrázkom DAM z predošlého detailu; posun rámu zapíše ROI do toho obrázka DAM a ukáže hlášku o uložení. Kroky: detail obrázka v zozname, karta ROI, zavrieť; menu integrácií, poskytovateľ, otvoriť detail dlaždice; posunúť rám. Karta detailu je jeden `ref` modulu pre oba detaily, zavretie ho nevracia; detail poskytovateľa karty nemá, takže sa z ROI nedá prepnúť. Sklad ROI plní len karta ROI detailu assetu. Trvá do prepnutia karty v detaile DAM alebo obnovenia stránky. Od 2022 | `A/composables/assetDetailTab.ts:17-23`; `A/components/detail/components/AssetDetailDialogSidebar.vue:83-100`; `EP/components/ExternalProviderAssetDetailDialog.vue:26,197-202`; `A/components/toolbar/AssetToolbarIntegrations.vue:22-24`; knižnica `domains/dam/cropper/components/DamAssetImageRoiSelect.vue:38-125`; `A/components/detail/components/AssetDetailSidebarROI.vue:67-79` | z dialógu poskytovateľa vyhodiť vetvu ROI a `useAssetDetailTab` (mŕtvy kód: žiadna karta ju tam nevie zapnúť). Viditeľné: detail poskytovateľa ukáže vždy svoj obrázok | S |
| FE-47 | 146 | Po zmene hlavnej trasy súboru („Make private", „Make public") sa detail číta znova a neuložené metadáta zahodí bez otázky. Číta sa aj po zlyhanej zmene trasy (udalosť ide vo `finally`). Číta sa asset aktívnej dlaždice zoznamu, nie asset detailu: po kliku na dlaždicu A, nahratí B a „Edit" riadka B vo fronte detail B po zmene trasy ukáže asset A (lišta v pohľade „queue" nemá názov, nie je to hneď vidieť). Bez aktívnej dlaždice sa nečíta nič a stav trasy ostane starý. Od januára 2024 | `domains/coreDam/shared/assetFileRoute/components/AssetFileMainRoute.vue:43-53,107-113`, `AssetFileRouteMakePublicDialog.vue:79-89`; `A/components/AssetMetadata.vue:264-279`; `A/components/list/composables/assetListActions.ts:281-303`; `A/store/assetDetailStore.ts:95-99,116-128`; `A/store/assetListStore.ts:48-62,103-109`; test `test/list/detailNeighbour.test.ts:495-537` drží dnešný stav | čítať asset, ktorý detail drží (`assetDetailStore.asset.id`); udalosť posielať len po úspechu; pri neuložených metadátach prevziať z odpovede len súbor (`mainFile`), bez loadera cez formulár. Viditeľné: nový stav trasy sa ukáže, napísané ostane a „Uložiť" ostane zvýraznené | S až M |
| FE-48 | 141 (čiastočne) | Platí len pre detail po „Vytvoriť prázdny asset" (riadok fronty klávesy zoznamu vypína, drží to test): po prvom kliku do detailu šípka → alebo ← prečíta do detailu suseda zo zoznamu, adresa sa zmení, nový asset v zozname nie je a šípkou sa k nemu vrátiť nedá. Riziko: metadáta vyplnené do suseda v domnení, že je to nový asset. Od 2023; stráž FE-43 to zúžila (menu ostane otvorené do prvého kliku) | `A/components/AssetCreateButton.vue:48-60,85`; `A/components/queue/AssetQueueItemEditable.vue:76-77`; `A/components/list/AssetListView.vue:63-69`; `assetListActions.ts:396-431,487-494`; `A/store/assetListStore.ts:111-119`; test `test/queue/queueRowActions.test.ts:332-350` | šípky nerobia nič, keď je detail otvorený a pohľad nie je „list" (jedno miesto pre oboch otváračov). Opraviť spolu s FE-50, inak detail zo zoznamu s pohľadom „queue" príde aj o šípky | S |
| FE-49 | 145 | → na poslednej načítanej dlaždici (← na prvej) číta ten istý asset znova: do 5 s nič, neskôr loader, `GET` toho istého assetu a detail sa nakreslí nanovo (posun, rozbalené panely a dáta karty sú preč). S neuloženými metadátami príde otázka, hoci niet kam ísť, a „Odísť aj tak" po 5 s napísané nahradí. Tlačidlá lišty nie sú na koncoch vypnuté. Ďalšia strana zoznamu sa z detailu nenačíta, hoci počítadlo ukazuje „25 / 25+". Čítanie znova od 2022; zbytočná otázka z FE-44 | `A/store/assetListStore.ts:111-129`; `assetListActions.ts:31,97-104,396-411,433-448`; `A/components/detail/components/AssetDetailDialog.vue:146-151,187-218`; `A/components/list/AssetListView.vue:57-61,126-130` | v `nextItem` a `prevItem` najprv zistiť cieľ a bez cieľa skončiť pred otázkou aj pred loaderom; tlačidlá na koncoch vypnúť. Viditeľné: → na konci nerobí nič. Načítanie ďalšej strany šípkou je samostatné rozhodnutie produktu (M) | S |
| FE-50 | 142 | „Upraviť" v bočnom paneli zoznamu nenastaví pohľad detailu. Po detaile z fronty alebo po „Vytvoriť prázdny asset" (pohľad „queue", zavretie ho nevracia) má detail otvorený z panela lištu bez ‹ ›, bez „k / N" a bez názvu assetu; klávesy šípok suseda čítajú ďalej. Nič sa nestratí. Trvá, kým sa detail neotvorí ceruzkou alebo dvojklikom dlaždice. Od 2022 | `A/components/list/components/AssetListSidebarMetadata.vue:58-65,182-188`; `A/components/list/components/AssetListItem.vue:56,124-127`; `assetListActions.ts:245-246`; `A/components/detail/components/AssetDetailDialog.vue:52-56,186,220-228`; `A/store/assetDetailStore.ts:88-93,167` | v `onEditMore` nastaviť pohľad „list", keď panel drží asset aktívnej dlaždice, inak „queue". Viditeľné: tlačidlá, počítadlo a názov sú tam | S |
| FE-51 | 147 | Lišta detailu pod loaderom neukáže „1 / N" pre prvý asset (`!activeItemIndex` platí aj pre 0); po načítaní tam je. Kozmetika, od mája 2026. Ten istý loader používa detail poskytovateľa a ukazuje pod ním počítadlo zoznamu DAM | `A/components/detail/components/AssetDetailDialogLoader.vue:22-31,43`; `AssetDetailDialog.vue:146-151`; `EP/components/ExternalProviderAssetDetailDialog.vue:101-104` | `isNull` namiesto `!`; jeden riadok | S |
| FE-52 | 150 (z 143) | Šípka v zozname pri zavretom detaile zmení adresu na `/assets/<id>` a nič ju nevráti (`nextItem`, `prevItem` menia adresu vždy; klik na dlaždicu ju nemení). Obnovenie stránky potom otvorí samostatnú stránku detailu namiesto zoznamu. Od mája 2026 | `assetListActions.ts:407,444` (čítal aj vedúci); knižnica `shared/utils/history.ts:3-10` | adresu meniť len pri otvorenom detaile. Viditeľné: adresa zoznamu ostane `/assets` | S |

**Vyvrátené: 143** (Esc zavrie detail mimo `closeDialog`). Každý `VDialog` má z knižnice `persistent: true`
a `noClickAnimation: true` (`plugins/commonVuetifyConfig.ts:109-113,167-176`), detail to neprepisuje
(`AssetDetailDialog.vue:161-165`); Esc na takom dialógu volá len vypnutú animáciu (`VOverlay.js:279-291,317-318`).
Detail sa používateľom mimo `closeDialog` zavrieť nedá. Komentár `assetDetailStore.ts:158-160` („no way out but
Esc") je nepravdivý: opraviť pri najbližšej zmene súboru.

Nové nálezy overovateľa, neoverené druhým čítaním: 151 `closeDialog` zapne klávesy zoznamu vždy, aj po detaile
z fronty na celú obrazovku, ktorá ich mala vypnuté (`AssetDetailDialog.vue:53`, `A/composables/assetFooterUpload.ts:53-57`);
152 „Vytvoriť prázdny asset" pri prázdnom zozname asset vytvorí, ale detail neukáže (`AssetListView.vue:114-137`),
na stránke poskytovateľa vôbec; 153 v pohľade „queue" lišta detailu neukazuje názov assetu
(`AssetDetailDialog.vue:220-228`).

### FE, knižnica (common-admin)

Cesty sú voči `common-admin/src/domains/dam`; čísla riadkov platia pre commit `ddf049e4`. Obstálo päť (136, 138,
139, 140, 149), 137 v jadre (znenie nie, následok áno a jednoduchšou cestou), 149b cez rozhranie prakticky nie.
Mechanizmus 137 (príznak widgetu a asset v sklade stránky) si vedúci prečítal sám
(`ImageWidgetInner.vue:238-241,468-470,516-519,583-609`, `ImageDetailDialogMetadata.vue:60,142,233`).

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-53 | 137 (jadro) | admin-cms, widgety jedného obrázka: dialóg obrázka kreslí výber autorov DAM nad assetom, ktorý je práve v sklade stránky, bez kontroly, či patrí zobrazenému obrázku; príznak „ukázať autorov" je vlastný widgetu a nevypne ho zavretie dialógu, „upraviť metadáta" ani použitie uploadu. Cesta A (jeden widget): existujúci obrázok Y, „nahradiť z DAM", asset A bez autorov, dialóg zavrieť krížikom, „upraviť metadáta": dialóg ukáže Y s výberom autorov assetu A; potvrdenie zapíše autorov do A (označí ho `described`) a ich menami prepíše zdroj Y. Cesta B (dva widgety jednej stránky): obrázok do výpisu z assetu A1 bez autorov potvrdený bez autora, sociálny obrázok z A2 s autorom „X"; „upraviť metadáta" obrázka do výpisu ukáže A2 s „X" a potvrdenie bez zmeny dá obrázku do výpisu zdroj „X". Znenie zo zápisu neplatí: zrušený výber sklad vyprázdni (asset v ňom ostane len pri súbehu 138). V admin-ugc sa výber nekreslí. Od decembra 2024 | `imageWidget/components/ImageWidgetInner.vue:238-241,470,516-519,583-586,593-609,657-669`; `ImageDetailDialogMetadata.vue:61,233-250`; `ImageMediaWidgetInner.vue:249-252,535,643-646,708-711,736-752`; `assetSelect/components/AAssetSelect.vue:139-142,280-283`; `api/damAssetApi.ts:326-335`; backend `AssetMetadataBulkManager.php:55-66,129-141`; `core-dam/config/packages/anzu_systems_core_dam_ext_systems.php:52-54`; `admin-cms/src/domains/cms/article/components/ArticleEditForm.vue:148`, `widgets/variant/ArticleWidgetSupplementaryMedia.vue:42-59` | spolu s FE-54: widget drží asset, ktorého autorov ponúka, sám a odovzdá ho dialógu; príznak aj asset ruší zavretie dialógu, „upraviť metadáta" a použitie uploadu. Viditeľné: dialóg obrázka ukáže vždy buď jeho zdroj, alebo autorov jeho assetu | M (spolu s FE-54) |
| FE-54 | 136 | admin-cms, widgety jedného obrázka: po „upraviť asset" v dialógu obrázka (detail assetu otvorený a zavretý) výber autorov zmizne a ostane prázdne nepovinné pole „Zdroj". Autori, ktorých redaktor práve uložil v detaile, sa do zdroja obrázka nedostanú; obrázok sa uloží s prázdnym zdrojom, hoci asset autora má. Príznak ostane zapnutý do odchodu zo stránky (cesta B z FE-53). Spresnenie: potvrdiť bez zdroja sa dá aj s kresleným výberom, keď nikto nie je vybraný. Galéria to rieši opätovným čítaním (FE-32), tieto widgety nie. Od decembra 2024 | `ImageDetailDialogMetadata.vue:73-75,142,148-157,233`; `assetDetail/store/assetDetailStore.ts:51,67-72`; `ImageWidgetInner.vue:593,985-990`; `ImageMediaWidgetInner.vue:736,1170-1175`; `composables/uploadValidations.ts:51`; `ImageWidgetMultipleInner.vue:508-552` (vzor) | po zavretí detailu widget asset znova prečíta (po dobehnutí uloženia, ako galéria): má autorov, zdroj sa vyplní menami, výber zmizne a „Zdroj" je povinný; nemá, výber ostane. Rozhodnutie: či sa má obrázok assetu bez autorov dať potvrdiť bez autora aj bez zdroja (dnes áno; odporúčanie nemeniť) | M (spolu s FE-53) |
| FE-55 | 140 | Hostiteľ, ktorý zanikne s otvoreným detailom assetu, nechá v sklade stránky svoj kľúč; ďalší hostiteľ s tým istým kľúčom detail nakreslí hneď. Stačí Späť v prehliadači, keď cieľový záznam histórie je ten, na ktorom sa aplikácia v karte načítala alebo obnovila (Vuetify vtedy navigáciu nezruší). admin-ugc: po návrate na zoznam assetov ho prekryje prázdny dialóg bez tlačidla, pomôže len obnovenie stránky, pri každom návrate. admin-cms: nad ďalším článkom sa hneď otvorí detail assetu z predošlého (dá sa zavrieť; kľúč `image` má päť stránok). Dáta sa nestratia. Staršie | `vuetify/lib/composables/router.js:85-108`; `vuetify/lib/components/VOverlay/VOverlay.js:296-305`; `vue-router/dist/vue-router.js:101-143,1403-1406`; `assetDetail/components/AssetDetailDialog.vue:44-48`; `assetSelect/components/AAssetListInner.vue:253-255,426-431`; `ImageWidgetInner.vue:985-990`; `ImageWidgetMultipleInner.vue:850-856`; `assetDetail/components/AssetDetailDialogFrame.vue:85-98` | `AssetDetailDialog.vue` pri odpojení zavrie sklad, keď `dialog` je ešte jeho kľúč. Viditeľné: po Späť sa na ďalšej stránke nič neotvorí | S |
| FE-56 | 139 | admin-cms, galéria: dva riadky toho istého assetu bez autorov (dvakrát „pridať z DAM", alebo duplikát z fronty bez autora), autor vybraný len v jednom. Výber v prvom riadku: druhý sa uloží s prázdnym zdrojom a po uložení má prázdne povinné „Zdroj". Výber v druhom: asset autora dostane, ale oba riadky po uložení znova ponúkajú prázdny výber a prvý je v CMS bez zdroja; neskorší výber iného autora pôvodného v DAM nahradí. Staršie | `ImageWidgetMultipleInner.vue:393,574-587,593,613-623`; `ImageWidgetMultipleItem.vue:50-53`; `imageWidget/store/imageStore.ts:15-17`; backend `AssetMetadataBulkManager.php:55-66` | pred uložením zjednotiť autorov na asset (jeden zápis na asset, zdroj z mien všetkým jeho riadkom, ktoré výber ponúkajú); príznaky po uložení brať z vlastného riadku. Malé rozhodnutie: rôzne výbery v riadkoch jedného assetu sa spoja | S |
| FE-57 | 149 | admin-ugc, zoznam assetov: po zavretí detailu assetu A a rýchlom kliku na dlaždicu B (kým dobieha opätovné čítanie A) môže panel ukazovať A a zvýraznená byť B. „Upraviť" otvorí A, teda to, čo panel ukazuje; nič sa nezapíše zle. Trvalé len, keď odpoveď B predbehne odpoveď A, inak bliknutie. Staršie | `assetSelect/components/AAssetListInner.vue:177-190`; `assetDetail/store/assetDetailStore.ts:79-84`; `assetSelect/composables/assetSelectListActions.ts:113-116` | čítanie po zavretí detailu si vezme číslo z toho istého počítadla ako klik; načítavanie vypína len posledné čítanie | S |
| FE-58 | 138 | `reset()` výberu assetov sa nevzdá čítania detailu na ceste: odpoveď kliku sa zapíše do skladu aj po `reset()`. Sám bez viditeľného následku; škodí len so zapnutým príznakom (FE-53). Staršie | `assetSelect/composables/assetSelectListActions.ts:116-129,146-151` | `reset()` zvýši počítadlo čítaní a vypne načítavanie | S |

**Neobstál: 149b** (odpoveď kliku na dlaždicu prepíše detail riadku fronty). Zápis mimo počítadla existuje
(`assetSelectListActions.ts:129`), ale čítanie kliku by muselo trvať dlhšie než výber súboru, upload, spracovanie
a otvorenie detailu spolu; panel počas čítania „upraviť" nekreslí. Dá sa zavrieť tou istou podmienkou ako FE-57 (S).

Nové nálezy overovateľa, neoverené druhým čítaním: 154 `assetSelectStore.setList` nevynuluje `activeItemIndex`
(`assetSelect/store/assetSelectStore.ts:66-74`): po obnovení zoznamu klik na dlaždicu s tým istým poradím ju
neoznačí a po zavretí jej detailu sa panel neprečíta; 155 dva riadky galérie jedného assetu s rôznymi výbermi pošlú
dva zápisy s tým istým `id`, platí posledný (`ImageWidgetMultipleInner.vue:574-577`; zatvára FE-56). Oprava textu:
`OP4-L1.md` spomína zoznam assetov aj v admin-cms; `AAssetListInner` používa len admin-ugc.

### Rozhodnutie vlastníka k šiestemu overeniu (12. 10., 21:45)

„suhlasim s opravami": opraviť všetkých trinásť (FE-46 až FE-58) podľa odporúčaní. Štyri rozhodnutia produktu podľa
odporúčania: FE-54 obrázok assetu bez autorov sa ďalej dá potvrdiť bez autora aj bez zdroja; FE-56 rôzne výbery
autorov v riadkoch toho istého obrázka sa pri uložení spoja; FE-49 → na poslednej načítanej dlaždici ďalšiu stranu
nenačíta, len nerobí nič; FE-47 po zmene trasy súboru ostane napísané vo formulári a „Uložiť" zvýraznené. FE-56
vlastník najprv nerozumel; po vysvetlení na príklade (dva riadky, Novák a Kováč) súhlasil. K postupu: „mozes teda
pokracovat rovnakym postupom, verim ze sa dopracujeme k 0 novych nalezov, uvidime".

FE-53 sa opravuje pravidlom, nie zabúdaním: widget ponúka výber autorov len s assetom, ktorý sám prečítal pre
obrázok, ktorý dialóg ukazuje (inak by bežná cesta „potvrdiť bez autora, potom upraviť metadáta" o výber prišla).
Kroky: knižnica `OP5-L1` (FE-53 až FE-58), admin-dam `OP5-D2` (FE-46 až FE-52) po uzavretí `OP5-D1` (FE-45).

### Doplnok k šiestemu overeniu: nálezy potvrdené posudkami kroku OP5-D1 (12. 10., 22:35)

Štyri nálezy mimo zmeny potvrdilo druhé nezávislé čítanie (overovateľ alebo implementér a k tomu posudok Codexu
alebo Opusa). Čísla riadkov platia pre strom po kroku `OP5-D1`. Na rozhodnutie vlastníka.

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-59 | 152 | Pri prázdnom zozname (nová licencia, hľadanie bez výsledku) sa detail assetu nemá kde nakresliť: ceruzka riadka fronty po nahratí súboru alebo „Vytvoriť prázdny asset" neotvorí nič; detail vyskočí neskôr, keď zoznam dostane riadky. Kým visí, nedá sa nakresliť ani otázka o neuložených zmenách | `A/components/list/AssetListView.vue:116-139` (`AssetDetailDialog` len vo vetve `items.length`); `A/components/queue/AssetQueueItemEditable.vue:74-79`; `A/components/AssetCreateButton.vue:48-51` | dialóg detailu pripojiť mimo vetvy zoznamu. Viditeľné: detail sa otvorí aj nad prázdnym zoznamom | S |
| FE-60 | 151 | Zavretie detailu zapne klávesy zoznamu vždy, aj keď ich pohľad fronty na celú obrazovku (upload, hromadná úprava) mal vypnuté: po ceruzke riadka a zavretí detailu šípky ← → hýbu aktívnou dlaždicou v zozname schovanom za frontou a čítajú jej asset do panela | `A/components/detail/components/AssetDetailDialog.vue:53`; `A/composables/assetFooterSelected.ts:73`; `A/composables/assetFooterUpload.ts:54` | zavretie detailu vráti klávesy do stavu spred otvorenia. Viditeľné: šípky pod frontou na celú obrazovku nerobia nič | S |
| FE-61 | 156 | Po novom načítaní zoznamu (filter, hľadanie, zoradenie, „Obnoviť") ostane zapamätané poradie aktívnej dlaždice zo starého zoznamu: žiadna dlaždica nie je zvýraznená, klik na dlaždicu na tom istom mieste ju nezvýrazní, šípky pokračujú od starého miesta. Panel pritom ďalej ukazuje pôvodný asset | `A/store/assetListStore.ts:48,94` (`setList` index neruší; `setActiveByIndex` sa pri rovnakom indexe vráti); sonda implementéra `OP5-D1`; posudok Codexu bod 4 | po načítaní zoznamu nájsť asset panela v novom zozname: je tam, zvýrazní sa na novom mieste; nie je, žiadna dlaždica nie je aktívna. Viditeľné: zvýraznenie sedí s panelom | S |
| FE-62 | 157 | Tlačidlo „upraviť" riadka v tabuľkovom pohľade robí dve veci: spustí detail zoznamu (loader, čítanie) a zároveň prejde na samostatnú stránku detailu, ktorá sklady vyprázdni a asset číta znova. Používateľ skončí na samostatnej stránke; čítanie navyše a krátke prebliknutie | `A/components/list/components/AssetTableRowItem.vue:154-158`; `assetListActions.ts:260-263`; test `sidebarUnsaved.test.ts:657`; posudok Codexu bod 5, Opusa bod 1 | obyčajný klik len prejde na stránku detailu (bez čítania zoznamom); čo používateľ vidí, ostáva. Alternatíva na rozhodnutie: tlačidlo otvorí dialóg detailu ako ceruzka dlaždice | S |


## Stav po opravách šiesteho overenia (13. 10. v noci)

Opravené FE-45 až FE-58 a FE-63. Kroky: knižnica `OP5-L1` s cyklami c1 a c2 (FE-53 až FE-58), admin-dam `OP5-D1`
s cyklom c1 (FE-45) a `OP5-D2` s cyklami c1 a c2 (FE-46 až FE-52, FE-63). Každý krok prešiel posudkom Codexu aj
Opusa, cykly úzkym posudkom; posledné posudky sú bez nálezu na opravu. Čo posudky našli a cykly opravili:

- `OP5-L1`: oprava FE-58 zahodila čítanie, ktoré jediné nastavovalo ext systém stránky pri výbere z knižnice
  (dialóg obrázka potom nenakreslil výber autorov ani Zdroj); čakajúce „potvrdiť" sa dokončilo v novo otvorenom
  dialógu.
- `OP5-D1`: značka „klik odchádza zo zoznamu" platila aj pre Ctrl/Shift klik; po zmazaní assetu sa pýtalo na
  zmazaný asset; obnovený zoznam pod otvorenou otázkou.
- `OP5-D2`: **vysoký nález**: backend odpovedá na „Make private" obrázka a dokumentu 204, obaly brali za úspech
  len 200; po FE-47 by karta súboru ostala v starom stave. Opravené v obaloch, falošný server testov odpovedá ako
  skutočný. Z toho FE-63 (hláška pri odmietnutej zmene) a stráž dvojitého odoslania.

Prehľad s viditeľnými dôsledkami a prijatými medzami je v `register-zblizeni.md`, časť 5.10. Na rozhodnutie
vlastníka čakajú FE-59 až FE-62 („Doplnok k šiestemu overeniu") a tri cesty, ktorými sa rozpísané metadáta panela
ešte zahodia (ceruzka riadka fronty, „Vytvoriť prázdny asset", odchod zo stránky). Nové nálezy z tejto práce
(150 až 176) sú v registri, časť 8; overujú sa v ďalšom kole. **Stav 18. 10.:** FE-59 až FE-62 a cesty P1 až P3
opravené v `OP6` (nižšie, „Opravené v krokoch `OP6-L1` …"); cesta „uloženie hromadnej úpravy s assetom panela"
ostáva rozhodnutím vlastníka 15. 10.

## Siedme overenie: nálezy 153 až 176 (13. 10., v noci)

Podľa pokynu vlastníka „pokracovat rovnakym postupom". Dve nezávislé overenia (Opus, len čítanie, s úlohou nález
vyvrátiť): `overenie7-lib` (154, 160 až 167), `overenie7-dam` (153, 158, 168 až 173, 175, 176; čítal zmrazenú
kópiu `src` po kroku C9). Nálezy 151, 152, 156 a 157 sú body FE-59 až FE-62 (doplnok k šiestemu overeniu); 155
zaniká opravou FE-56; 159 (149b) neobstál už v šiestom overení; 174 rieši FE-61.

### FE, knižnica (common-admin)

Cesty sú voči `common-admin/src/domains/dam`; čísla riadkov platia pre pracovný strom po kroku `OP5-L1-c2`.

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-64 | 162 | Druhé „Potvrdiť" počas ukladania obrázka pošle druhé uloženie. Horšie než v zápise: v dialógu obrázka v texte článku (oba adminy, formulár kreslený v stránke) stačí dvojklik myšou, lebo tlačidlo hostiteľa nie je počas uloženia obrázka vypnuté; v modálnom dialógu z klávesnice (Enter na tlačidle s fokusom, `loading` nie je `disabled`). Pre nový obrázok dve vytvorenia v CMS: jeden záznam je sirota; v admin-ugc sa obrázok vloží do textu dvakrát. Pre existujúci obrázok dve rovnaké uloženia bez následku. Staršie | `imageWidget/components/ImageDetailDialogMetadata.vue:96-103,120-122,342-348`; `imageWidget/composables/imageDialogDamAuthors.ts:126-128`; `ImageWidgetInner.vue:604-611,633-644,708-711`; `ImageMediaWidgetInner.vue:748-754`; `vuetify/lib/components/VBtn/VBtn.css:237-239`, `VBtn.js:144,183-184`; `admin-cms/src/domains/cms/shared/components/anzutap/nodes/embedImage/components/EmbedImageDialog.vue:78-80,200-205`; `admin-ugc/src/domains/anzutap/nodes/embedImage/components/EmbedImageDialog.vue:69-91,147-153` | v oboch widgetoch po čakaní na čítanie riadok „kým uloženie beží, nič"; test. Viditeľné: druhé stlačenie nespraví nič | S |
| FE-65 | 154 (s 166 a 164) | admin-ugc, zoznam assetov: po novom načítaní zoznamu (hľadanie, zoradenie, nahratie a „použiť") klik na dlaždicu na tom istom mieste, kde bola predtým aktívna, ju nezvýrazní, hoci panel ukáže jej asset; po „Upraviť" a zavretí detailu je panel prázdny („žiadny asset") namiesto práve upraveného assetu. Nič sa nezapíše zle. V admin-cms (výber z DAM) len chýba modrý rámik. K tomu v tom istom súbore: 166 prepnutie typu vo výbere s médiami sa nevzdá čítania kliku (panel ukáže asset dlaždice, ktorá už v zozname nie je); 164 predbehnuté čítanie po zavretí detailu hlási svoje zlyhanie. Staršie | `assetSelect/store/assetSelectStore.ts:66-74,111-113,204-215`; `assetSelect/composables/assetSelectListActions.ts:110-137,149-162,177-185`; `assetSelect/components/AAssetListInner.vue:104-112,164-177,342-347`; `assetSelect/components/AAssetSelectMedia.vue:211-215`; `admin-ugc/src/pages/dam/asset/index.vue:29-35` | `setList` a `reset` vynulujú aktívnu dlaždicu; prepnutie typu sa vzdá čítania na ceste; zlyhanie hlási len posledné čítanie. Viditeľné: dlaždica sa zvýrazní a panel sa po zavretí detailu prečíta | S |
| FE-66 | 167 | admin-cms, widgety jedného obrázka: mená vybraných autorov sa zapíšu do zdroja obrázka skôr, než ich DAM prijme. Keď DAM zápis odmietne (oprávnenie, sieť, chyba servera), dialóg ostane; redaktor výber vymaže a potvrdí: obrázok sa uloží do CMS so zdrojom = mená autorov, ktorých DAM neprijal a ktorých redaktor odstránil. V dialógu to nevidí (pole Zdroj je skryté). Galéria to má od `OP5-L1` opravené. Staršie | `ImageWidgetInner.vue:615-636`; `ImageMediaWidgetInner.vue:759-779`; `ImageDetailDialogMetadata.vue:78-80,152-180`; `imageDialogDamAuthors.ts:64-67`; backend `Domain/AssetMetadata/AssetMetadataBulkFacade.php:101-108` | mená držať bokom a do zdroja zapísať až po úspešnom zápise autorov (dva súbory, dva testy). Viditeľné: po odmietnutom zápise sa obrázok uloží bez zdroja, ako pri prázdnom výbere vždy | S |

**Čiastočne alebo bez viditeľného následku (odporúčanie: neopravovať, alebo len upratať):**

- **163** (čiastočne): widget jedného obrázka sa nedozvie o autoroch, ktorých asset dostal inde po výbere (admin-dam na
  inej karte, iný človek, druhý widget s tým istým assetom); „upraviť metadáta" ponúkne prázdny výber a potvrdenie
  s výberom autorov v DAM nahradí. „Posledný zápis vyhráva" v úzkom okne; po obnovení stránky widget ukáže Zdroj.
  Oprava S až M (čítať asset pri otvorení dialógu). Je zapísané ako prijatá medza FE-53.
- **160** (čiastočne): riadok „konflikty autorov" sa v dialógu obrázka ani v detaile assetu knižnice nikdy neukáže,
  lebo pole skladu nikto neplní (`assetDetail/store/assetDetailStore.ts:18,107`); chýba len nápoveď, nič sa
  nezapisuje zle. Či ju redaktori CMS chcú, je rozhodnutie produktu.
- **161** (čiastočne): mená autorov sa hľadajú pod ext systémom výberu alebo stránky, nie licencie assetu. S dnešnými
  dátami neexistuje stránka, kde by sa líšili (SME: ext systém 1; Denník Šport: 13; admin-ugc: 4 natvrdo). Otázka na
  vlastníka len vtedy, ak má jeden výber niekedy ponúkať licencie dvoch ext systémov.
- **165**: `onDetailLoadedCallback` výberu a zoznamu assetov je verejný prop, ktorý nikdy nefungoval (od decembra
  2024) a nikto ho neposiela. Upratanie pred 2.0.0: zmazať a zapísať do changelogu ako odstránené (S).

Nové nálezy overovateľa, neoverené: 177 tabuľkový pohľad zoznamu assetov nemá značku aktívneho riadku
(`AssetSelectTableRowItem.vue:44-57`); 178 každý `ImageWidgetInner` pri vzniku vyprázdni spoločný sklad dialógu
obrázka (`ImageWidgetInner.vue:211-212`); 179 backend pri hromadnom zápise metadát nekontroluje, či autori patria do
ext systému assetu (`AssetMetadataBulkFacade.php:101-108`).

### FE, admin-dam

Cesty sú voči `admin-dam/src`; `A/` = `domains/coreDam/asset/`, `D/` = `A/components/detail/`,
`R/` = `domains/coreDam/shared/assetFileRoute/components/`. Čísla riadkov platia pre strom po kroku C9. Všetkých
deväť v jadre platí, žiadny nevznikol touto prácou; tri používateľovi neškodia.

| Bod | Nález | Čo platí dnes | Dôkaz | Oprava | Veľkosť |
|---|---|---|---|---|---|
| FE-67 | 158 | Osem miest, kde zlyhaná požiadavka nepovie nič (obaly odmietajú surovou chybou axios, `showErrorsDefault` ju nepozná): v karte slotov nastaviť súbor ako hlavný, odobrať zo slotu, duplikovať do iného slotu, zmazať súbor slotu (audio, video, dokument); otočenie obrázka; uloženie náhľadového obrázka videa (karta ďalej ukazuje nový obrázok, po novom otvorení je späť starý); odkaz na stiahnutie v detaile (koliesko sa točí bez konca) a „stiahnuť" v menu slotu. Server má pre tieto akcie aj úmyselné odmietnutia (súbor sa používa, neplatný slot, stiahnutie nepovolené). Staršie | knižnica `domains/system/composables/alerts.ts:130-176`; `D/composables/assetDetailSidebarSlotsActions.ts:41-83`; `D/components/AssetFileRotate.vue:26-37`; `D/components/AssetDetailSidebarImagePreview.vue:58-69`; `D/components/AssetDownloadButton.vue:43-49`; `D/components/slots/AssetSlotListItem.vue:99-103`; `A/api/imageApi.ts`, `audioApi.ts`, `documentApi.ts`, `videoApi.ts` | na šiestich miestach všeobecná hláška, keď knižnica chybu nepozná (ako FE-63); pri dvoch sťahovaniach odchyt chyby a zastavenie kolieska. Viditeľné: „Systémová chyba…" namiesto ničoho. Väčší variant (M): preniesť obaly na `useApiRequest`, potom 403 a validácia povedia dôvod | S |
| FE-68 | 168, 176 (čiastočne) | Dialóg „Make public" (audio, dokument) sa zavrie aj po odmietnutej zmene a napísaný slug je preč. Formulár kontroluje iný text, než posiela: „ab!" prejde kontrolou dĺžky, odíde „ab" a server ho odmietne; text v cyrilike odíde prázdny. Hláška je len všeobecná. Dôvod „súbor sa ešte spracúva" server neposiela vôbec, vie ho len aplikácia, a tá akciu ponúka bez ohľadu na stav súboru. Zavretie je staršie; všeobecnú hlášku pridalo FE-63 | `R/AssetFileRouteMakePublicDialog.vue:46-50,54-69,82,89-92`; knižnica `shared/utils/string.ts:79-93`; backend `Model/Dto/AssetFileRoute/AssetFileRouteAdmCreateDto.php:13-23`, `Domain/AssetFileRoute/AssetFileRouteFacade.php:79,155,168` | dialóg zavrieť len po úspechu; kontrolovať to, čo sa pošle. Viditeľné: po odmietnutí ostane dialóg otvorený so slugom, chyba dĺžky sa ukáže pri poli pred odoslaním. Na rozhodnutie: neponúkať „Make public", kým súbor nie je spracovaný (S) | S |
| FE-69 | 169 (so 170) | Samostatná stránka detailu a stránka detailu súboru (`/assets/<id>`: odkaz zvonka, „pozrieť originál" pri duplikáte, tlačidlo riadka tabuľky) po úspešnej zmene trasy čítajú celý asset znova a rozpísané metadáta zahodia bez otázky; zoznam to má od FE-47 opravené. K tomu 170: zmena trasy v karte slotov pri slote hlavného súboru neobnoví kartu súboru na Info (stále „verejný" s adresou, ktorá neplatí; klik server odmietne); rovnako po „nastaviť ako hlavný súbor" ostane na Info starý hlavný súbor. Staršie | `D/AssetDetailView.vue:92-104,233`; `D/AssetFileDetailView.vue:85-97,210`; `A/store/assetDetailStore.ts:124,129`; `D/components/slots/AssetSlotListItem.vue:174-180`; `D/components/slots/AssetDetailSidebarSlots.vue:92`; `D/composables/assetDetailSidebarSlotsActions.ts:27-39,52-61` | pravidlo zo zoznamu (pri rozpísaných metadátach prevziať len trasu súboru) použiť aj na oboch stránkach; karta slotov po zmene trasy hlavného súboru pošle tú istú udalosť hore. Viditeľné: napísané ostane, karta súboru ukáže nový stav | S až M |
| FE-70 | 171 | Šípka v zozname pri zatvorenom detaile: keď čítanie suseda zlyhá (zmazaný asset, chýbajúce právo, výpadok), panel ukáže „žiadny asset" pri zvýraznenej dlaždici a chyba sa nepovie; klik na tú istú dlaždicu ju povie. Staršie (september 2026) | `A/components/list/composables/assetListActions.ts:476-487,518-529,373-378`; `A/api/assetApi.ts:165-179` | chybu ukázať vždy, adresu vracať len pri otvorenom detaile. Viditeľné: tá istá hláška ako po kliku | S |
| FE-71 | 173, 172 | Tlačidlá ‹ › v lište detailu pod loaderom vyzerajú aktívne a klik na ne sa stratí (pri rýchlom klikaní sa detail posunie o menej assetov; klávesy fungujú). Detail externého poskytovateľa používa ten istý loader a ukazuje pod ním počítadlo zoznamu DAM. Od 2022 | `D/components/AssetDetailDialogLoader.vue:22-31,44-78`; `D/components/AssetDetailDialog.vue:193,210`; `domains/coreDam/externalProvider/components/ExternalProviderAssetDetailDialog.vue:96-99` | loader dostane počítadlo a šípky od toho, kto ho kreslí: tlačidlá kliky posielajú ďalej a na koncoch sú vypnuté; poskytovateľ ukáže svoje alebo žiadne počítadlo. Viditeľné: klik pod loaderom sa nestratí | S |
| FE-72 | 153 | V detaile otvorenom z riadka fronty, po „Vytvoriť prázdny asset" alebo cez „Upraviť" panela pri assete mimo aktívnej dlaždice lišta neukazuje názov assetu (je v jednom bloku s počítadlom zoznamu). Od prvej verzie; samostatná stránka názov ukazuje | `D/components/AssetDetailDialog.vue:222-230`; `A/components/queue/AssetQueueItemEditable.vue:76`; `A/components/AssetCreateButton.vue:49`; `D/AssetDetailView.vue:156-158` | podmienku nechať len na počítadle. Viditeľné: v lište je názov vždy | S |

**Bez následku pre používateľa:** 175 vetva `directDetailLoad` oboch samostatných stránok je od februára 2025 mŕtva
a asset priamej adresy sa číta dvakrát (`D/AssetDetailView.vue:75-84,115-131`, `A/composables/currentExtSystem.ts:95-97`);
zmazať pri najbližšej úprave tých súborov.

Nové nálezy overovateľa, neoverené: 180 zlyhané čítanie súboru videa po zmene slotu nechá kartu náhľadového
obrázka točiť bez konca (`D/components/AssetDetailSidebarImagePreview.vue:36-41`); 181 komentár o vrátení adresy
v chybových vetvách `nextItem` / `prevItem` po FE-52 pre zatvorený detail neplatí (`assetListActions.ts:483,525`;
zaniká s FE-70).

## Ôsme overenie: druhé nezávislé čítanie bodov na rozhodnutie (13. 10., 08:46 až 09:03)

Vlastník 13. 10. ráno: commit piateho bloku áno (LIB `b97ddf31`, DAM `0ad8e12c`), BE-8 do úlohy áno (#86919,
revízia 6); k bodom FE-59 až FE-62, trom cestám zahodenia, FE-64 až FE-72, propu `onDetailLoadedCallback` a otázke
„Make public" počas spracovania: „podme overit ze skutocne platia, chcem popis a navrhovane riesenie".

Štyri čítania Codexom (`impl/posudky/overenie8-lib-codex.md`, `overenie8-dam-a-codex.md`, `overenie8-dam-b1-codex.md`,
`overenie8-dam-b2-codex.md`) a jedno Opusom (`overenie8-dam-a`: FE-59 až FE-62 a tri cesty), každé s úlohou nález
vyvrátiť, nad commitnutým stromom. Tým má každý bod dve nezávislé čítania dvoma modelmi. **Žiadny bod nepadol;**
spresnil sa rozsah a pri šiestich bodoch oprava.

| Bod | Výsledok | Čo sa spresnilo |
|---|---|---|
| FE-59 | platí | širšie: detail zmizne aj počas každého úplného načítania zoznamu a „Upraviť" panela po hľadaní bez výsledku neotvorí nič. Pri oprave vyprázdniť sklad detailu pred prvým vykreslením (zvyšný `detail = true` zo samostatnej stránky) |
| FE-60 | platí | druhé miesto, ktoré klávesy zapne: zlyhané čítanie riadka fronty (`AssetQueueItemEditable.vue:91`). Menšia oprava než „vrátiť predošlý stav": šípky nerobia nič, kým je fronta na celú obrazovku (`customDialog`, `useMainWrapper.ts:4`) |
| FE-61 | platí | širšie: index prežije aj odchod zo stránky a návrat (`resetList`), Shift+klik berie starý index ako kotvu. Oprava: pamätať si **id aktívnej dlaždice** (nie asset panela: panel môže držať asset z fronty alebo asset, ktorého čítanie je na ceste), hľadať ho aj v ďalších stranách (`appendList`); nejde cez `setActiveByIndex`. Dva testy držia dnešný príznak (`sidebarUnsaved.test.ts:745-759`, `detailNotOfList.test.ts:352-364`) |
| FE-62 | platí | čítanie navyše je isté, prebliknutie závisí od časovania. Správne miesta: `assetListActions.ts:270-285`, test `sidebarUnsaved.test.ts:831-839` (drží zbytočné čítanie). **Musí ísť pred P3** |
| P1 ceruzka riadka fronty | platí | pýtať sa pred čítaním, aj keď je to asset panela (táto cesta číta vždy) |
| P2 „Vytvoriť prázdny asset" | platí | pýtať sa pri potvrdení „Vytvoriť" pred odoslaním, nie pri položke menu. Tlačidlo je aj na stránke externého poskytovateľa, kde otázku nemá kto nakresliť: pýtať sa len na zozname DAM a sklad pri odchode zo zoznamu vyprázdniť |
| P3 odchod zo stránky | platí okrem loga | logo vedie na tú istú stránku, nič sa nestratí. Oprava: stráž odchodu na stránke zoznamu + `beforeunload` (natívna otázka prehliadača pri obnovení a zavretí okna) + zmena licencie sa pýta pred odoslaním zmeny. Potrebuje FE-62 a FE-59 pred sebou. Adresy detailu ide cez `history.replaceState`, stráž sa vnútri zoznamu nespustí |
| FE-64 | platí | oprava podľa návrhu; cesta médií sa nemení |
| FE-65 | platí | „použiť" vo výbere sa netýka (výber sa pri potvrdení vyprázdni celý). Oprava ako FE-61: aktívnu dlaždicu obnoviť podľa id |
| FE-66 | platí | oprava podľa návrhu |
| FE-67 | platí na siedmich miestach celé, na ôsmom čiastočne | zmazanie súboru slotu mlčí len pri audiu a videu (dokument zmazať nejde, obrázok už chybu hlási). Odmietnutie „stiahnutie nepovolené" patrí inému koncovému bodu; odkaz na stiahnutie zlyhá pri chýbajúcom práve, súbore alebo výpadku. Oprava: 5 súborov; pri náhľade videa po zlyhaní vrátiť kartu na uložený obrázok |
| FE-68 | platí | test `mainRouteChange.test.ts:445` dnes zavretie po odmietnutí očakáva |
| FE-69 | platí | „nastaviť ako hlavný súbor" potrebuje vlastnú opravu (prečítať hlavný súbor a napísané nechať); udalosť o trase ju nerieši |
| FE-70 | platí | hlášku ukázať len kým je používateľ na stránke zoznamu |
| FE-71 | platí | počítadlo DAM ukáže detail poskytovateľa len po predošlej návšteve zoznamu DAM, inak je prázdne |
| FE-72 | platí | test `detailNotOfList.test.ts:252` dnes prázdnu lištu očakáva; prázdny asset nemá názov ani po oprave |
| 165 prop | platí | prop majú tri komponenty (`AAssetSelect`, `AAssetListInner`, `AAssetSelectMedia`); dlaždice a riadky si robia vlastnú inštanciu akcií bez neho. Nikto ho neposiela (admin-cms, admin-ugc, admin-dam, admin-blog, admin-forum, admin-inhouse) |
| „Make public" počas spracovania | platí | backend pustí len `processed` (obrázok aj audio a dokument), inak 422 bez dôvodu. Oprava: položku schovať, kým súbor nie je spracovaný; „Make private" a kopírovanie adresy nechať |

Nové pozorovania overovateľov, neoverené (register, časť 8, čísla 182 až 186).

### Rozhodnutie vlastníka k ôsmemu overeniu (13. 10., 09:10)

„opravime vsetko": FE-59 až FE-62, tri cesty zahodenia (P1, P2, P3 bez loga), FE-64 až FE-72, zmazanie propu
`onDetailLoadedCallback` a schovanie „Make public", kým súbor nie je spracovaný, všetko podľa spresnených opráv
z tabuľky vyššie. K FE-62 sa vlastník pýtal, či dvojitá akcia tlačidla nemá dôvod: nemá, je to pozostatok
(`27ef68dd` z 18. 5. 2023 tlačidlo otváralo dialóg, `dcd15148` z 1. 6. 2023 ho nahradil odkaz knižnice a starý
handler ostal). Robí sa „obyčajný klik len prejde na stránku detailu"; Ctrl+klik ostáva ako dnes (nová karta
a dialóg v pôvodnej karte), pokiaľ vlastník nepovie inak.

Kroky: knižnica `OP6-L1` (FE-64 až FE-66, prop), admin-dam `OP6-D1` (FE-62, FE-59, FE-60, FE-61, P1 až P3, FE-70)
a po ňom `OP6-D2` (FE-67, FE-68, „Make public", FE-69, FE-71, FE-72).

## Deviate overenie: nové nálezy šiesteho bloku (13. 10., 14:35 až 14:54)

Overených 23 bodov z registra (časť 8): 177 až 180, 182 až 186 a 187 až 201. Každý čítali dva modely nezávisle,
s úlohou ho vyvrátiť: Codex (`impl/posudky/overenie9-lib-a-codex.md`, `-lib-b`, `-dam-a`, `-dam-b`) a Opus
(`overenie9-lib`, `overenie9-dam`). Knižnica nad konečným stavom `OP6-L1`, admin-dam nad zmrazenou kópiou stavu po
`OP6-D1` (pred `OP6-D2`). **Žiadny bod nepadol celý;** 14 platí, 9 platí čiastočne (mechanizmus je v kóde, cesta
používateľa je veľmi nepravdepodobná alebo žiadna). Nič z toho nezapisuje zlé dáta pri bežnej práci.

### FE, knižnica (common-admin)

| FE | Nález | Čo sa deje | Kde | Oprava a čo zmení | Veľkosť |
|---|---|---|---|---|---|
| FE-73 | 188 | Výber assetov (galéria v admin-cms, až 50 kusov): po hľadaní alebo zoradení zmizne fajka z už vybraných dlaždíc, počítadlo ich ráta ďalej. Klik fajku len vráti, až druhý klik asset odoberie; pri plnom počte (50) nereaguje žiadna dlaždica, kým sa výber nezruší. Potvrdenie môže odniesť assety, ktoré redaktor nevidí označené. Od roku 2023 | `assetSelect/store/assetSelectStore.ts:75,88,96-118,153-157,214-220` | `setList` a `appendList` vezmú príznak z mapy výberu. Viditeľné: fajky prežijú hľadanie, zoradenie aj ďalšie strany | S |
| FE-74 | 189, 190 | Zoznam assetov a oba výbery: po „načítať viac" a zmene zoradenia (vo výbere s médiami aj po prepnutí obrázok / video / podcast) sa nový zoznam číta od strany, na ktorej bol starý: prvé riadky chýbajú a nedá sa k nim dostať, typ s menej assetmi ukáže „nič sa nenašlo". Pri prepnutí typu navyše na 200 ms bliknú riadky starého typu (strana na ceste sa nezruší) | `AAssetListInner.vue:161-167`, `AAssetSelect.vue:211-217`, `AAssetSelectMedia.vue:209-223`, `assetSelectListActions.ts:73,88-101` | zoradenie a prepnutie typu vrátia stránkovanie na 1; prepnutie typu zruší požiadavku zoznamu na ceste. Viditeľné: nový zoznam začína od začiatku | S |
| FE-75 | 184 | admin-ugc, zoznam assetov: po hľadaní, ktoré kliknutý asset nevráti, panel ho ukazuje ďalej aj s „Upraviť" (žiadna dlaždica označená); po „Upraviť" a zavretí detailu je panel prázdny („žiadny asset"), hoci práve ten asset sa upravoval. Úprava ide do správneho assetu | `assetSelectListActions.ts:59-63,161-168`, `AAssetListInner.vue:169-174,339-359` | po zavretí detailu bez aktívnej dlaždice prečítať zapamätaný asset. Viditeľné: panel po zavretí ukáže upravený asset. (Druhá možnosť, vyprázdniť panel už pri novom zozname, mení viac.) | S |
| FE-76 | 177 | Tabuľkový pohľad zoznamu assetov a výberov nemá značku riadku, ktorého asset ukazuje panel (dlaždice ju majú). V zozname admin-ugc tak tabuľka neukazuje nič. Kozmetika | `AssetSelectTableRowItem.vue:42-57`, `AssetSelectTilesItem.vue:42` | trieda na aktívny riadok a jedno pravidlo CSS. Viditeľné: zvýraznený riadok | S |
| FE-77 | 191 | Keď zlyhá načítanie konfigurácie vlastných polí (všetky štyri čítania; len pri výpadku), bočný panel zoznamu a výberov sa točí donekonečna, kým sa stránka neobnoví; výber assetu funguje ďalej | `AAssetListInner.vue:210-224`, `AAssetSelect.vue:219-233`, `AAssetSelectMedia.vue:225-239`, `damConfigState.ts:140-170` | stav chyby namiesto kolieska (samotné vypnutie príznaku nestačí, formulár bez konfigurácie spadne). Môže potrebovať text hlášky | S až M |
| FE-78 | 187 | Dialóg obrázka (admin-cms, s autormi DAM): po „Potvrdiť" sa dialóg dá zavrieť; keď sa do odpovede DAM (asi 1 s) otvorí znova „upraviť metadáta" pre obrázok widgetu, uloží sa ten bez stlačenia a dialóg sa zavrie. Vo widgete s médiami po znovuotvorení pre video odíde `createImage` s prázdnymi poľami. **Čiastočne:** úzke okno | `ImageWidgetInner.vue:616-649`, `ImageMediaWidgetInner.vue:759-795` | potvrdenie patrí obrázku, pri ktorom ho stlačili: po každom čakaní skončiť, keď dialóg ukazuje iný. Viditeľné: také potvrdenie potichu skončí | S |
| FE-79 | 193 | Embed obrázka v texte (oba adminy): „Potvrdiť", „Zrušiť" počas pomalého uloženia (asi 2 s) a otvorenie embedu iného obrázka: neskorá odpoveď prepíše jeho formulár prvým obrázkom a jeho potvrdenie upraví prvý obrázok a dá jeho id novému embedu. **Čiastočne:** treba pomalé uloženie | `ImageWidgetInner.vue:274-277,429-431,645-655`, `ImageMediaWidgetInner.vue:442-444,788-799` | po čakaní nepísať do skladu, keď widget zanikol (`disposed`). Bez viditeľnej zmeny | S |
| FE-80 | 195 | admin-ugc, zoznam assetov s frontou uploadu: odpoveď kliku na dlaždicu, ktorá visí niekoľko sekúnd, prepíše asset otvoreného detailu riadka fronty a jeho uloženie ide do kliknutého assetu. **Čiastočne:** čítanie musí visieť cez celý upload | `assetSelectListActions.ts:130,144`, `assetDetailStore.ts:45-64,81-87` | klik číta cez `readBesideDetail` ako čítanie po zavretí. Bez viditeľnej zmeny pri bežnej práci | S |

Platí čiastočne, odporúčanie nechať: **178** (každý widget pri vzniku vyprázdni spoločný sklad dialógu obrázka: žiadna
cesta, ktorou by redaktor pripojil widget pod otvoreným dialógom); **194** (dlaždice majú kľúč podľa id; zopakovaný
asset sa nakreslí dvakrát, zlé označenie z toho neplynie). **192** (embed dialógy adminov nestrážia vlastné uloženie:
myšou sa nedá, tlačidlo je počas načítavania neklikateľné; z klávesnice Enter počas ukladania embedu pošle druhú
úpravu obrázka a v admin-ugc môže vložiť druhý embed) je v kóde admin-cms a admin-ugc, mimo našich repozitárov:
oprava je jeden riadok v každom admine (`if (saveButtonLoading.value) return`), na odovzdanie tímom.

### FE, admin-dam

| FE | Nález | Čo sa deje | Kde | Oprava a čo zmení | Veľkosť |
|---|---|---|---|---|---|
| FE-81 | 185 | Stránka externého poskytovateľa: „Vytvoriť prázdny asset" asset vytvorí (hláška „vytvorené") a nič neotvorí, druhý pokus vytvorí ďalší prázdny; ceruzka riadka fronty uploadu tiež neotvorí nič. Stránka kreslí len detail poskytovateľa | `EP/components/ExternalProviderAssetListView.vue:126-129,188`, `A/components/AssetCreateButton.vue:48-60`, `A/components/queue/AssetQueueItemEditable.vue:84-104` | (a) na tej stránke obe ovládania nekresliť (S), alebo (b) pripojiť tam detail DAM (M; jeho zavretie dnes píše adresu `/assets`). Rozhodnutie produktu | S alebo M |
| FE-82 | 186 | Zoznam DAM bez aktívnej dlaždice (po vstupe na stránku; od FE-61 po každom načítaní, ktoré asset neprinesie): → vyberie druhú dlaždicu, ← nerobí nič; prvá sa dá dosiahnuť len → a ← | `A/store/assetListStore.ts:147-155`, `assetListActions.ts:141-143,497-498` | bez aktívnej dlaždice → vyberie prvú. Viditeľné len v tom stave | S |
| FE-83 | 196, 182 | Stránka poskytovateľa: ← a → chodia po zozname pod frontou uploadu na celú obrazovku (obdoba FE-60); tlačidlá predchádzajúci / ďalší v detaile sú na koncoch zoznamu aktívne a čítajú ten istý asset znova (obdoba FE-49) | `EP/composables/externalProviderAssetListActions.ts:298-366`, `EP/components/ExternalProviderAssetDetailDialog.vue:113-144`, `A/composables/assetFooterUpload.ts:53-57` | tá istá podmienka `customDialog` ako v zozname DAM; na koncoch nič nečítať a tlačidlá vypnúť | S |
| FE-84 | 180, 183 | Detail videa, karta náhľadového obrázka: zlyhané čítanie súboru videa po zmene slotu nechá kartu točiť (kým sa nevyberie iný slot alebo karta); zlyhané čítanie obrázka ukáže natrvalo „spracúva sa" a schová tlačidlá, takže obrázok nejde odobrať ani vymeniť. Len pri zlyhanej požiadavke | `D/components/AssetDetailSidebarImagePreview.vue:27-52`, `A/components/ImagePreview.vue:47-51,84-88,139-202` | `try / catch / finally` a stav „čítanie zlyhalo". Viditeľné: hláška a tlačidlá späť | S |
| FE-85 | 201 | Odkaz „Stiahnuť originál" je podpísaný na 15 minút a dialóg ho znova nečíta. Stlačený neskôr (alebo pri výpadku úložiska) nahradí aplikáciu chybovou stránkou úložiska a rozpísané metadáta sú preč. Len cloudové úložisko; zriedkavé | `D/components/AssetDownloadButton.vue:38-56,109-117`, backend `AssetFileDownloadFacade.php:19,40` | `target="_blank"`: sťahovanie cez novú kartu (v Chrome a Firefoxe sa sama zavrie), chyba ostane v novej karte, aplikácia ostáva; odpadne aj sekundová značka sťahovania z `OP6-D1-c2`. Viditeľná zmena pre používateľa | S |
| FE-86 | 200 | `/` je stránka, ktorá po pripojení robí `push` na `/assets`: Späť zo zoznamu skončí znova na čerstvom zozname (výber sa zahodí), za zoznam sa Späť nedá dostať | `domains/system/views/HomepageView.vue:7-9`, `loginActions.ts:26` | `router.replace` (jeden riadok). Viditeľné: Späť zo zoznamu ide na stránku pred `/` | S |
| FE-87 | 198, 199 | Upratanie: dialóg licencie sa dá potvrdiť dvakrát (tá istá požiadavka dva razy, bez následku) a ostal v ňom ladiaci `console.log`; samostatné stránky detailu štartujú čítanie časovačom 100 ms, ktorý odchod neruší (Späť do 100 ms ukáže na ďalšej stránke hlášku „nesprávne id") | `A/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue:126-158,179,338-345`, `D/AssetDetailView.vue:126-131`, `D/AssetFileDetailView.vue:119-124` | stráž `saving` a koliesko na tlačidle, zmazať log, zrušiť časovač pri odpojení | S |

Platí čiastočne, odporúčanie nechať: **197** (príznak `customDialog` prežíva stránky, ale dialóg na celú obrazovku je
modálny a perzistentný, cesta von zo stránky pod ním sa nenašla).

### Backend

**179** platí: hromadný zápis metadát (`PATCH /adm/v1/asset/metadata-bulk-update`) nekontroluje, či autori (a kľúčové
slová) patria do ext systému assetu; kontroluje len právo čítať autora (`AssetMetadataBulkFacade.php:101-108`,
`FormProvidableMetadataBulkUpdateDto.php:46-50`, `AssetValidator.php:27-57`). Cez admin sa to nedá (výber autorov je
viazaný na ext systém), len ručnou požiadavkou používateľa s prístupom do oboch ext systémov. Návrh: nový bod do
úlohy #86919 (kontrola vo `AssetValidator`, chyba `ERROR_INVALID_EXT_SYSTEM`).

### Otvorené z `OP6-D2`: „Make public" počas spracovania súboru (neopravené)

Oprava „schovať položku, kým súbor nie je `processed`" sa nespravila: stav súboru v otvorenom detaile ostáva
zastaraný (kartu Info píše len celé čítanie assetu, riadky slotov `getList()`), takže schovanie by vzalo akciu, ktorá
dnes funguje. Možnosti: (a) nechať (dnes 422 a všeobecná hláška), (b) schovať len v riadkoch slotov, kde je po ruke
„Obnoviť zoznam", (c) značka „súbor spracovaný" v sklade detailu, (d) backend vráti dôvod odmietnutia a admin ho
ukáže (bod do úlohy #86919).


## Desiate overenie: nové nálezy kroku `OP6-D2` (13. 10., 17:50 až 18:07)

Overených 8 bodov z registra (časť 8): 202 až 208 a 210. Každý čítali dva modely nezávisle, s úlohou ho vyvrátiť:
Codex (`impl/posudky/overenie10-dam-codex.md`, `overenie10-dam-b-codex.md`) a Opus (`overenie10-dam`), nad zmrazenou
kópiou admin-dam po kroku `OP6-D2` (pred cyklom c1). **Žiadny bod nepadol celý.** 209 (pamäť testov) je vec podpory
testov, neoveruje sa čítaním; 211 a 212 našiel posudok kroku (Opus) a druhý raz ich čítal Codex
(`overenie10-dam-c-codex.md`): FE-93 a FE-94 v tabuľke.

### Opravené hneď v `OP6-D2-c1` (rozhodnutie vedúceho: tá istá trieda ako rozhodnuté FE-69 a FE-67)

- **207** platí (oba modely): po „Spraviť ako hlavný súbor" pri napísaných metadátach ostanú tri prepínače
  (jednorazové použitie, dva „interné") od starého hlavného súboru a „Uložiť" ich zapíše novému
  (`AssetMetadataBulkManager.php:77-111` píše do súboru, ktorý je hlavný v čase uloženia). Pred `OP6-D2` to platilo
  aj bez napísaných metadát. Oprava: prepínače idú za novým hlavným súborom; prepnutý a neuložený prepínač sa nahradí.
- **210** platí (oba modely; Opus to isté našiel aj v posudku kroku): zmazanie hlavného súboru na karte slotov nechá kartu
  Info na zmazanom súbore; jej akcie potom posielajú id zmazaného súboru a zlyhajú, „Uložiť" zapíše prepínače
  náhradnému hlavnému súboru. Oprava: zmazanie hlavného súboru povie detailu to isté ako „Spraviť ako hlavný súbor".
- **205** čiastočne: `ImagePreview` si drží obrázok po hodnote „žiadny"; vo formulároch podcastu sa k tomu cesta
  nenašla (Opus) alebo je len pri pomalom uložení (Codex), uloženie posiela hodnotu, nie obrázok. Karta náhľadu videa
  to v `OP6-D2` obchádzala novým vykreslením, ktoré zatváralo otvorený výber; c1 smie opraviť príčinu.

### FE, admin-dam (na rozhodnutie vlastníka)

| FE | Nález | Čo sa deje | Kde | Oprava a čo zmení | Veľkosť |
|---|---|---|---|---|---|
| FE-88 | 204 | Detail, karta slotov: po zmene slotu a hneď šípke na susedný asset (zmena musí trvať dlhšie než krok na suseda a jedno čítanie, asi pol sekundy až sekundu) ukáže karta slotov suseda sloty predošlého assetu, až do „Obnoviť zoznam". Ich menu fungujú: „Odobrať súbor" zmaže súbor predošlého assetu, „Duplikovať do slotu" ho backend PRESUNIE do suseda (pri rovnakom type a licencii). **Platí** (oba modely); zriedkavé, ale píše zlé dáta | `D/composables/assetDetailSidebarSlotsActions.ts:27-39,46-117`, `A/store/assetSlotsStore.ts:10-13`, backend `AssetFilePositionFacade.php:121-152` | čítanie slotov, ktoré dobehne po zániku karty alebo pre iný asset, sa zahodí. Bez viditeľnej zmeny | S až M |
| FE-89 | 203 | Detail alebo panel otvorený, kým sa súbor ešte spracúva (ceruzka riadka fronty počas dlhého uploadu videa alebo zvuku): „Uložiť" je vypnuté s textom „súbor sa ešte spracúva" a po spracovaní sa samo nezapne; pomôže len nové prečítanie assetu (iná dlaždica a späť, znova ceruzka), ktoré napísané zahodí (po otázke). Z toho istého dôvodu sa nedá schovať „Make public" podľa stavu (Q7). **Platí** (Opus; Codex čiastočne: stav prepíše aj „Spraviť ako hlavný súbor") | `A/store/uploadQueuesStore.ts:130-139,270-282`, `domains/system/composables/appNotificationListeners.ts:30-32`, `A/store/assetDetailStore.ts:118-130` | po oznámení „súbor spracovaný" prečítať asset znova, keď ho detail drží a nič nie je napísané; s napísaným nechať zadržané (zámer `OP5-D2`) a povedať to. Viditeľné: formulár sa po spracovaní sám obnoví a „Uložiť" sa zapne. Dosiahne len toho, kto súbor nahral | S až M |
| FE-90 | 206 | Karta slotov ponúka „Spraviť ako hlavný súbor" aj pri súbore, ktorý zlyhal, je duplikát alebo sa ešte spracúva (nahratý z inej karty alebo iným používateľom); backend to prijme. Asset potom nemá obrázok a pri nepopísanom assete sa vypne „Uložiť" (FE-89). **Platí** (oba modely) | `D/components/slots/AssetSlotListItem.vue:246-250`, backend `AssetFilePositionFacade.php:64-83` | položku ponúkať len pri spracovanom súbore (stav riadka je zo zoznamu slotov, ktorý sa po vlastnom uploade číta znova). Viditeľné: položka pri takom súbore zmizne. Backend by ju prijal ďalej (prípadný bod do #86919) | S |
| FE-91 | 202 | Dialóg „Stiahnuť": výber iného slotu, kým sa odkaz prvého ešte číta, môže nechať na tlačidle odkaz hlavného súboru pod výberom, ktorý ukazuje iný slot: stiahne sa iný súbor. **Čiastočne** (Opus: výber je zamknutý, kým sa nenačíta zoznam slotov, prvý odkaz by musel trvať asi sekundu dlhšie; Codex: platí) | `D/components/AssetDownloadButton.vue:33-58,68-71` | počítadlo požiadaviek, platí len posledná. Viditeľné: koliesko sa točí do poslednej odpovede | S |
| FE-92 | 208 | Upratanie: `saving` v karte náhľadu videa nikto nečíta; obe stránky detailu deklarujú udalosť `mainRouteChanged`, ktorú neposielajú; formulár dialógu „Make public" ostáva po potvrdení „dotknutý" (chybu pri novom otvorení ukáže len pri názve, z ktorého vznikne neplatný slug). Bez následku pre používateľa | `D/components/AssetDetailSidebarImagePreview.vue:28,75,89`, `D/AssetDetailView.vue:32-34`, `D/AssetFileDetailView.vue:32-34`, `R/AssetFileRouteMakePublicDialog.vue:87` | zmazať, `$reset()` pri otvorení | S |
| FE-93 | 212 | Detail videa, karta náhľadového obrázka: pri vybranom inom slote než hlavnom a výbere náhľadu z distribúcie sa náhľad uloží správnemu súboru, ale karta potom prečíta hlavný súbor, kým výber slotu nad ňou ukazuje ďalej ten druhý. Ďalšia zmena náhľadu v karte („Vybrať obrázok", „Odobrať") sa uloží hlavnému súboru, nie slotu, ktorý výber ukazuje. **Platí** (posudok Opus, druhé čítanie Codex `overenie10-dam-c-codex.md`) | `D/components/AssetDetailSidebarImagePreview.vue:44-69,138`, `AssetDetailSidebarImagePreviewFromDistributionDialog.vue:70` | po potvrdení dialógu prečítať súbor, ktorý dialóg upravil. Viditeľné: karta ostane na vybranom slote | S |
| FE-94 | 211 | Samostatné stránky detailu: keď po úspešnej zmene z karty slotov („Spraviť ako hlavný súbor", zmena trasy) zlyhá následné čítanie assetu (výpadok siete, 500), stránka ukáže chybu a ďalej kreslí asset spred zmeny aj s akciami; „Uložiť" potom zapíše staré prepínače novému hlavnému súboru. Zoznam v tej situácii detail zavrie. **Čiastočne** (len pri zlyhanom čítaní; prvé otvorenie stránky sa správa inak, ostane prázdna) | `D/AssetDetailView.vue:93-114`, `D/AssetFileDetailView.vue:86-107`, `A/components/list/composables/assetListActions.ts:327-333` | po zlyhanom opätovnom čítaní asset zahodiť. Viditeľné: prázdna stránka s chybou namiesto starého assetu | S |

## Stav po opravách šiesteho bloku (13. 10. večer)

Opravené v krokoch `OP6-L1`, `OP6-D1` a `OP6-D2` (cykly c1 a c2): FE-59 až FE-62, FE-64 až FE-72, P1 až P3, 165,
a z desiateho overenia hneď 205, 207 a 210. Z FE-92 je hotové upratanie (`saving`, nepoužité deklarácie udalostí);
ostáva `$reset()` formulára dialógu „Make public". Neurobené: Q7 (čaká na vlastníka). **Stav 18. 10.:** Q7 vlastník
rozhodol 13. 10., opravené v `OP7-D2` (`register-zblizeni.md` 5.11 a 5.12).

### Nový overený nález z posudkov `OP6-D2-c1` (oba modely nezávisle)

| FE | Nález | Čo sa deje | Kde | Oprava a čo zmení | Veľkosť |
|---|---|---|---|---|---|
| FE-95 | 213 | Detail videa, karta náhľadového obrázka: dve rýchle prepnutia slotu vo výbere nad kartou spustia dve čítania bez poradia; keď pomalšia odpoveď prvého príde posledná, karta ukáže súbor iného slotu, než hovorí výber, a ďalší výber alebo odobratie obrázka sa uloží tomu súboru. **Platí** (Codex aj Opus) | `D/components/AssetDetailSidebarImagePreview.vue:48-53`, `D/components/AssetDetailSlotSelect.vue:53-64` | počítadlo čítaní, platí len posledné (rovnaký vzor ako FE-91). Viditeľné: nič | S |

Zapísané bez overenia (staršie, z posudku Opus): 214 (adresa stránky assetu súboru po zmazaní toho súboru),
215 (`ImagePreview` po zlyhanom čítaní obrázka ostane pri koliesku).

### Triedenie pre vlastníka (pravidlo z 13. 10.: súvisiace opraviť podľa odporúčania, nesúvisiace na schválenie)

- **Súvisia s našimi opravami** (ten istý kód, ktorý blok menil): knižnica FE-75, FE-78, FE-79, FE-80; admin-dam
  FE-82, FE-92 (zvyšok), FE-93, FE-94, FE-95.
- **Nesúvisia (na schválenie):** FE-73, FE-74, FE-76, FE-77, FE-81, FE-83 až FE-91; Q7; backend 179 (návrh bodu do
  #86919); 192 (tímy admin-cms a admin-ugc).

### Rozhodnutie vlastníka k siedmemu bloku (13. 10., 22:35 až 22:45)

Po zozname „novootvorených vecí" (29 bodov s popisom a odporúčaním): „22 - NEMOHLI BY SME SPRAVIT LOAD POHLADU
S ASSETOM? MAME TAKY POHLAD POMOCOU ID KDE SA TO CELE NACITA? / 27 - OPRAVME MOZME ZASAHOVAT AJ DO ADMINOV INYCH TERAZ
/ 28 A 29 OVERME NAJSKOR / OSTATNE SUHLASIM S ODPORUCANIAMI" a k bodu 22 ešte: „PODLA MNA PRECHOD PRERUSI UPLOAD
PRETO BY SOM TO OTVORIL NA NOVOM TABE".

- **Opraviť podľa odporúčaní:** FE-73 až FE-80 (knižnica), FE-82 až FE-95 (admin-dam), vrátane FE-85 cez novú kartu
  a „Make public" len pre spracovaný súbor spolu s FE-89.
- **FE-81 inak, než bolo odporúčanie:** na stránke externého poskytovateľa otvoria „Vytvoriť prázdny asset"
  a ceruzka riadka fronty stránku assetu `/assets/<id>` v NOVEJ KARTE prehliadača; upload na stránke ostane bežať.
- **192 opraviť priamo v admin-cms a admin-ugc** (doterajší zákaz písať do týchto repozitárov pre tento bod neplatí).
- **179** doplniť do úlohy #86919; dôvod odmietnutia pri „Make public" ako bod pre backend sa nepridáva.
- **214 a 209 najprv overiť** druhým čítaním, potom rozhodnúť.
- Push commitov šiesteho bloku vlastník nespomenul: ostávajú lokálne.

## Jedenáste overenie: 214 a 209 (13. 10., 22:40 až 22:55)

Druhé čítanie Codexom (`impl/posudky/overenie11-codex.md`) a jedno meranie vedúceho
(`krok5-praca/pracovne/veduci/209-halda.txt`).

- **214 platí čiastočne.** Na stránke `/assets/file/<F>` sa dá zmazať súbor F, ktorým bola otvorená (aj keď nie je
  hlavný); stránka potom funguje ďalej, adresa ostáva. Po obnovení stránky, zo záložky alebo skopírovaného odkazu
  backend súbor nenájde a aplikácia presmeruje na stránku „nenájdené" (nie chyba nad prázdnym detailom, ako znel
  nález). Možnosti: (a) nechať: „nenájdené" je pre zmazaný súbor pravdivé; (b) po zmazaní súboru z adresy
  nahradiť trasu stránkou assetu `/assets/<id>` (M: stránka sa pripojí nanovo, vráti sa na prvú kartu a treba
  vyriešiť rozpísané metadáta); (c) prepísať len adresu bez navigácie (router si starú trasu pamätá ďalej).
  Odporúčanie: (a).
- **209 platí** (čítaním čiastočne, meraním celé). Každý prípad, ktorý volá `startUploadUi`
  (`src/test/support/uploadUi.ts:83-151`), vyhodnotí knižnicu, Vuetify, i18n, konfiguráciu a sklady nanovo
  (`vi.resetModules()`). Dokázaný držiak starého vyhodnotenia: nastavenie témy knižnice si pri každom vyhodnotení
  zaregistruje poslucháča na spoločnom okne happy-dom (`themeSettings.js:11`, cez `matchMedia` a `useStorage`)
  a nikto ho neodoberie; `stopUploadUi` (`uploadUi.ts:208-216`) odpojí aplikácie a vyprázdni telo, poslucháčov okna
  nie. **Meranie** (dva malé súbory, `--logHeapUsage`): halda po každom prípade rastie o 105 až 125 MB a neklesá
  (`makePublicDialog.test.ts`: 244 → 1 165 MB po 11 prípadoch). Súbor s 32 prípadmi tak berie asi 3,7 GB, so 44
  naráža na limit haldy. Oprava (M, len podpora testov): `startUploadUi` si zapamätá poslucháčov pridaných na okno
  a dokument a `stopUploadUi` ich odoberie; overiť meraním pred a po, zvyšné držiaky hľadať snímkom haldy. Ak to
  nestačí: deliť súbory. Odporúčanie: opraviť ako posledný krok bloku v admin-dam (po `OP7-D2`, lebo mení podporu,
  ktorú používajú všetky testy), s meraním.

**Rozhodnutie vlastníka k jedenástemu overeniu (13. 10.):** „SUHLASIM": 214 nechať; 209 opraviť v podpore testov
ako posledný krok siedmeho bloku v admin-dam (`OP7-T1`, po `OP7-D2`), s meraním pred a po.

## Stav po opravách siedmeho bloku (14. 10., 11:41)

Opravené: knižnica FE-73 až FE-80 (`OP7-L1` s cyklami c1 a c2); admin-dam FE-81 až FE-95 (`OP7-D1` s c1, `OP7-D2`
s c1; „Nastaviť ako verejné" len pre spracovaný súbor spolu s FE-89); 209 v podpore testov (`OP7-T1`); 192 v admin-cms
a admin-ugc. 179 je v úlohe #86919 ako BE-9. 214 sa nechalo (rozhodnutie vlastníka). Záverečné kontroly zelené:
CK-LIB 323 / 4 800, CK-DAM nad kópiou C11 109 / 1 795, `yarn ci` a build oboch repozitárov, kontroly dist knižnice.
Nové nálezy 216 až 228 v registri (časť 8) čakajú na vlastníka; 219 (história pri prihlásení a odhlásení) sa v
`OP7-D1-c1` spravil a vrátil.

### Rozhodnutie vlastníka k nálezom siedmeho bloku (14. 10., po 12:00)

Na zoznam 15 bodov s popisom a odporúčaním: „1-11 suhlasim / 12 spravme vsetky dminy / 14 nechat / 15 over / ostatne
suhlas". Teda: opraviť 227, 221, 217, 220, 222, 223, 216, 218, 225, 226 a z 224 časť s druhým obrázkom; 219
(história prihlásenia a odhlásenia) vo všetkých adminoch: knižničné `ALoginView` a `ALogoutView` (admin-blog,
admin-cms, admin-forum, admin-inhouse ich dostanú s novou verziou knižnice), vlastné kúsky admin-dam (`loginActions.ts`,
`LoginFormSso.vue`) a admin-ugc (`domains/system/logout.ts`); 13: testy admin-dam v troch procesoch (`ck-dam.sh`);
14: text chyby konfigurácie nechať; 15 (228): overiť (Codex `overenie12`).

**228 overené (Codex `overenie12-codex.md`):** (a) hromadná úprava aj (b) čítanie zoznamu dostanú stav hlavného súboru
(`processed`) a otvorenému detailu ho nepovedia: platí, nízka závažnosť (inak sa čaká na notifikáciu; ak nepríde,
„Uložiť" ostane zadržané do nového otvorenia). S napísanými metadátami ostáva „Uložiť" zadržané zámerne. Oprava S:
z oboch čítaní zavolať ten istý mechanizmus ako notifikácia. Podľa pravidla vlastníka (súvisí s FE-89) pridané do
bežiaceho kroku `OP8-D1`.

## Stav po opravách ôsmeho bloku (14. 10. popoludní)

Opravené: knižnica 222, 223, 224 (časť s druhým obrázkom), 219 (`ALoginView`, `ALogoutView`) v `OP8-L1` s cyklami c1
a c2; admin-dam 227, 221, 217, 216, 220, 225, 226, 218, 219 (vlastné prihlásenie), 228 a staršia chyba `postDelete`
v `OP8-D1` s cyklami c1 a c2. admin-ugc `logout.ts` zámerne nezmenený. Záverečné kontroly zelené: CK-LIB 327 / 4 845,
CK-DAM nad kópiou C12 121 / 1 857 (tri procesy, 175 s), `yarn ci` a build oboch repozitárov, kontroly dist. Nové
nálezy 229 až 234 v registri čakajú na vlastníka; na rozhodnutie aj text zadržaného „Uložiť" pri zlyhanom súbore.

## Rozhodnutie vlastníka k ôsmemu bloku a stav po opravách deviateho bloku (14. 10. večer)

Vlastník (17:40): „commit a push a na rozhodnutie suhlasim, B 1-6 over a ak to plati tak odporucanie suhlasim"; (19:25)
„235 a 236 mozme opravit" a pravidlo nadpisov (nadpis dialógu sa nemení podľa stavu). Overenie Codex (`overenie13-lib`,
`overenie13-dam`): 231 neplatí, ostatné platia. Opravené: knižnica 229, 232, 233 (`OP9-L1`, cykly c1 a c2), 235 a 236
(`OP9-L2`, cykly c1 a c2; s nimi aj použitie starého súboru ďalším uploadom, ktoré 236 sprístupnil, a dialóg galérie);
admin-dam text pri zlyhanom súbore, 230, 234 (`OP9-D1`, cykly c1 a c2). Záverečné kontroly zelené: CK-LIB 336 / 4 942,
CK-DAM nad kópiou C13 125 / 1 892, `yarn ci` a build oboch repozitárov, kontroly dist. Nový nález 237 (nadpis dialógov
uploadu podľa stavu, od 1.40.0) čaká na vlastníka. **Stav 18. 10.:** vlastník 14. 10. „toto je vynimka": nadpisy
dialógov uploadu ostávajú (`PRAVIDLA.md`, pravidlo 5).
