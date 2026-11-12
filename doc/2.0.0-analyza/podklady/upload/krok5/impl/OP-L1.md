# OP-L1: fronta a detail, nálezy 59 + 84, 75, 60 (impl-lib-op)

**Stav: po cykle 1, čaká na posudok opráv.** Cielené testy a CK zelené po poslednej úprave `src` (CK-LIB OP-L-c1, 12. 10.).

Zadanie vedúceho (opravy overených nálezov, `overenie-nalezov.md`, tabuľka „FE, knižnica"): FE-1 (59 + 84), FE-10 (75),
FE-11 (60). Strom LIB `/home/volar/projects/anzusystems/common-admin`, TMPDIR
`node_modules/.cache/vitest-tmp-impl-lib-op`. Snímok **`OP-L1`** (s `doc/changelog/2.0.0.md`), záplata
`krok5-praca/zaplaty/OP-L1.diff` (10 súborov; mimo `src` a `doc` nič).

## Zmenené súbory

- `src/domains/dam/uploadQueue/store/uploadQueuesStore.ts`
- `src/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue`
- `src/domains/dam/uploadQueue/components/UploadQueueDialog.vue`
- `src/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue`
- `src/domains/dam/uploadQueue/__tests__/uploadQueueOperations.test.ts`
- `src/domains/dam/uploadQueue/__tests__/uploadNamedConfiguration.test.ts`
- `src/domains/dam/assetDetail/__tests__/consumerProfileAssetDetailSave.test.ts`
- `src/domains/dam/__tests__/consumerProfileUploadDialogSingle.test.ts`
- `src/domains/dam/__tests__/consumerProfileUploadDialogActions.test.ts`
- `doc/changelog/2.0.0.md` (tri odrážky v „Upload queue and its dialogs.")

## FE-1 (59 + 84): uloženie v detaile sa dostane do riadkov, aj keď nové čítanie assetu zlyhá

**Čo sa mení v kóde.** `updateFromDetail(asset, configName?, mainFileSingleUse?)` (`uploadQueuesStore.ts:294`): tretí
argument je nový a nepovinný. Vetva `catch` čítania (`:325-343`) už chybu nezahodí naprázdno: riadkom toho assetu vo všetkých
frontách zapíše `keywords`, `authors` a `customData` z argumentu `asset`, každému riadku vlastné kópie (`[...]`,
`cloneDeep`), a prepínač jednorazového použitia z tretieho argumentu, ak ho volajúci dal. Mená autorov a kľúčových slov
si doplní z pamäte mien ako úspešná vetva. Návrhy servera (`authorConflicts`, nové mená) ostávajú, ako ich riadok mal.
`AssetDetailSidebarMetadata.vue:65-75` posiela ako tretí argument prepínač, ktorý uložil (sklad detailu ho drží mimo
assetu, `assetDetailStore.ts:22,26`); od cyklu 1 z kópie vzatej pred odoslaním. Úspešná vetva sa nemení. Odpoveď PATCH sa nečíta: `updateAssetMetadata` ide cez
príkaz bez odpovede a čítať ju by zmenilo, čo sa pri uložení detailu považuje za chybu.

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, dialóg fronty galérie a výberu assetov, „upraviť asset" na
riadku, uloženie v detaile, po ktorom zlyhá čítanie assetu (sieť, 5xx): detail povie „upravené" ako doteraz, ale riadok
ukáže uložené hodnoty a ďalšie „uložiť" fronty ich pošle. Doteraz riadok ostal pri starých hodnotách a ďalšie uloženie
fronty nimi prepísalo, čo detail uložil.

**Na backend.** Pri zlyhanom čítaní ide v ďalšom uložení fronty (`PATCH …/metadata-bulk-update`) pre ten asset to, čo
uložil detail, namiesto starých hodnôt riadku. Navyše môže ísť dopyt na mená autorov a kľúčových slov, ktoré pamäť mien
ešte nemá (rovnaký ako po úspešnom čítaní). Uloženie detailu a čítanie po ňom sa nemenia.

**Rozhodnutia pri oprave.**
- Neznáme meno konfigurácie: riadky ostanú, ako boli, a nič sa nečíta, ako pred krokom (prvý tvar kroku tam zapisoval
  uložené hodnoty; vrátené v cykle 1).
- Bez tretieho argumentu si riadky prepínač nechajú (existujúci volajúci a testy s jedným či dvoma argumentmi).

## FE-10 (75): dialóg jedného súboru po zatvorení nezapíše asset do skladu detailu

**Čo sa mení v kóde.** `UploadQueueDialogSingle.vue:189-192`: id assetu sa zapamätá pred čítaním a po `await` sa skončí,
ak prvý riadok fronty už nemá ten asset. Zatvorenie dialógu frontu vyprázdni (`onStopConfirm`, `:86-90`), takže po
zatvorení riadok nie je a po ďalšom výbere súboru má iný asset.

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, widget obrázka a widget obrázka s médiom: keď používateľ zatvorí
dialóg hneď po dokončení súboru (čítanie assetu ešte beží) a nahrá ďalší súbor, nový dialóg už neukáže panel súboru
(„File info") predošlého súboru (admin-cms; admin-ugc panel súboru nemá, tam sa len do skladu nezapíše cudzí asset).

**Na backend.** Nič.

**Odchýlka od znenia zadania.** Podmienka sa pýta na riadok fronty, nie na príznak otvoreného dialógu
(`uploadQueueDialog`): starší test `uploadQueueDialogSingle.test.ts` dialóg pripája bez príznaku a čaká asset v sklade,
a riadok hovorí to isté (každé zatvorenie frontu vyprázdni).

## FE-11 (60): točiace sa tlačidlo neuloží druhý raz

**Čo sa mení v kóde.** Prvý riadok obslúh končí, kým beží uloženie: `UploadQueueDialog.vue:102` (`onSave`) a `:123`
(`onSaveAndApply`), `AssetDetailSidebarMetadata.vue:57` (`onSave`).

**Čo sa mení pre používateľa.** admin-cms a admin-ugc: Enter alebo medzerník na tlačidle, ktoré sa točí (myš naň
nedosiahne, fokus mu ostáva), už nepošle druhé uloženie: „uložiť" a „uložiť a použiť" v dialógu fronty, „Uložiť"
v detaile assetu. Pri „uložiť a použiť" tak widget dostane obrázky raz.

**Na backend.** Jeden `PATCH …/metadata-bulk-update` namiesto dvoch rovnakých.

## Testy a prečo vedia zlyhať

Nové a prepísané prípady (174 prípadov v piatich súboroch):

- `uploadQueueOperations.test.ts`, „when the asset cannot be read again" (+4, namiesto „leaves the rows as they are…"):
  riadky dostanú uložené hodnoty a prepínač (`true`, `false`) a ďalšie uloženie fronty ich pošle; každý riadok má
  vlastné kópie (aj vnorený zoznam vo vlastných poliach), nie zoznamy detailu; bez tretieho argumentu si prepínač nechajú.
- `uploadNamedConfiguration.test.ts`: jeden prípad prepísaný (čítanie pod predvolenou konfiguráciou zlyhá: riadok má
  uložené hodnoty; požiadavky pripnuté ako doteraz). Prípad neznámej konfigurácie je od cyklu 1 znova v znení spred kroku.
- `consumerProfileAssetDetailSave.test.ts` (obe aplikácie, +4): detail otvorený z riadku pošle frontu aj prepínač
  a riadok ho má po zlyhanom čítaní; „sends one save however often its button is pressed…".
- `consumerProfileUploadDialogSingle.test.ts` (obe aplikácie, +2): čítanie assetu podržané, dialóg zatvorený, ďalší
  súbor vybraný, čítanie pustené: sklad detailu ostane prázdny a panel nového dialógu neobsahuje `file-1`.
- `consumerProfileUploadDialogActions.test.ts` (obe aplikácie, +4): „save" a „save and apply" stlačené trikrát počas
  podržaného PATCH: jedna požiadavka, jedno „upravené" resp. jedno `apply`.

Tlačidlo sa v testoch stláča `click()` na prvku, ktorý príde aj pri točiacom sa tlačidle (to, čo z Enteru urobí
prehliadač); skutočný kláves testy neposielajú.

**Dôkaz** (v pamäti, `vitest.bend.config.mts`, snímok `OP-L1`; skript `scratchpad/opl1-bend.sh`, výpisy
`scratchpad/opl1-bend-*.log`, `opl1-old.log`):

| Ohyb | Zlyhá |
|---|---|
| štyri produkčné súbory zo snímku | 16 / 174 (všetky nové a prepísané prípady) |
| `keywords` bez kópie | 1 (kópie) |
| `authors` bez kópie | 1 (kópie) |
| `customData` bez kópie | 1 (kópie) |
| `customData` len plytká kópia | 1 (kópie, vnorený zoznam) |
| prepínač z `asset.mainFileSingleUse` | 5 (2 + „bez argumentu" v sklade, 2 v detaile) |
| prepínač sa nezapíše | 4 |
| detail prepínač nepošle | 2 |
| detail bez stráže | 2 |
| `onSave` fronty bez stráže | 2 |
| `onSaveAndApply` fronty bez stráže | 2 |
| dialóg jedného súboru bez kontroly po `await` | 2 (admin-cms na texte panela, admin-ugc na sklade) |

**Behy.** Cielené (`scratchpad/opl1-run.sh`): 9 súborov / 386 zelených; `oxfmt`, `oxlint`, `eslint` na deviatich
súboroch čisté, `lint:tsc` 0. **CK-LIB OP-L1 zelená** (`vysledky/OP-L1-ck.log`): `test:browser` 311 súborov / 4 272
testov, `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.

## Texty na potvrdenie

Žiadne.

## Známe obmedzenie (odstránené v cykle 1)

Prvý tvar kroku čítal hodnoty pre riadky zo živého assetu detailu až po PATCH: čo používateľ medzitým napísal, dostalo
sa do riadku ako uložené. Cyklus 1 berie jednu kópiu pred odoslaním (nižšie).

## Nové nálezy (nemenené)

- **Chyba po zatvorení dialógu jedného súboru.** Keď čítanie assetu pre detail zlyhá až po zatvorení dialógu, `catch`
  ukáže chybu k dialógu, ktorý už nie je (`UploadQueueDialogSingle.vue:195-196`). Nič sa neuloží zle.
- **Úspešná vetva `updateFromDetail` dáva riadkom toho istého assetu spoločné zoznamy a spoločný objekt vlastných polí**
  (`uploadQueuesStore.ts:308-310`). Dôsledok som nenašiel: riadok aj vlastný formulár pri zápise zoznam a objekt
  nahrádzajú kópiou (`UploadQueueItemEditable.vue:104-129`, `ACustomDataForm.vue:63`).

## Cyklus 1 (OP-L-c1, 12. 10.; posudky Codex a Opus nad OP-L1 až OP-L3, spoločný cyklus)

Snímok `OP-L-c1` (strom po OP-L3), záplata `zaplaty/OP-L-c1.diff` (10 súborov, spolu s OP-L2). FE-11 bez nálezu.

1. **FE-1, kópia toho, čo sa posiela** (Codex vysoká, Opus nízka). `AssetDetailSidebarMetadata.vue:65-75`: pred PATCH
   sa vezme jedna kópia assetu (`cloneDeep`), prepínač a príznak „povedať fronte"; z tej kópie ide PATCH aj
   `updateFromDetail`. Doteraz dostala fronta živý asset detailu a prepínač čítaný po PATCH: čo používateľ napísal
   alebo prepol počas ukladania, došlo do riadkov ako uložené, a detail otvorený medzitým na inom assete odovzdal ten
   iný asset. Požiadavka sa nemení (rovnaké hodnoty v tom istom okamihu).
2. **FE-1, detail zatvorený počas PATCH** (Opus). `updateFromDetail` sa po úspešnom PATCH volá vždy, s kópiou z bodu 1,
   aj keď je sklad detailu medzitým prázdny. Doteraz sa preskočilo, riadky ostali pri starých hodnotách a ďalšie
   uloženie fronty prepísalo, čo detail uložil. Pre používateľa (admin-cms, admin-ugc; dialóg fronty, „upraviť
   asset", „Uložiť" a hneď zavrieť): riadok ukáže uložené hodnoty. Na backend: po takom zatvorení ide navyše
   `GET …/asset/{id}` (čítanie po uložení), ktoré doteraz nešlo.
3. **FE-1, neznáma konfigurácia.** `uploadQueuesStore.ts:296-302`: meno, ktoré aplikácia nemá, skončí hneď a riadky
   ostanú, ako boli (sedem riadkov). Test „is left alone, in silence…" je znova v znení spred kroku. Z changelogu je
   preč veta o treťom argumente.
4. **FE-10, čitateľ skladu** (Opus). `assetDetailView.ts:114-116`: pohľad dialógu jedného súboru berie asset zo
   skladu len vtedy, keď je to asset riadku. `assetDetailViewOfUploadItem` volá len `UploadQueueDialogSingle.vue:79`;
   detail assetu ide cez `assetDetailViewOfAsset`, admin-dam ani `src/lib.ts` ho nepoužívajú. **Navyše, to isté
   porovnanie v druhom čitateľovi toho istého dialógu:** `UploadQueueDialogSingleSidebarMetadataContent.vue:165-167`
   (panel súboru čítal sklad priamo, mimo pohľadu, a asset odložený výberom z knižnice ukazoval už počas nahrávania).
   Pre používateľa (admin-cms, admin-ugc; widgety jedného obrázka: výber assetu bez autorov z knižnice, potom upload):
   dialóg uploadu ukazuje svoj riadok, kým si neprečíta vlastný asset; doteraz ukázal „File info" vybraného assetu
   (admin-cms) a po dokončení súboru jeho id a stav. Na backend nič.
5. **Zápis:** changelog (dve odrážky doplnené, jedna veta preč).

**Obmedzenie bodu 4.** Riadok, ktorý sa stane originálom duplikátu až po tom, čo dialóg prečítal jeho pôvodný asset
(`uploadSettle.ts:516-545` to pre uložený riadok nevylučuje), má od tej chvíle iný asset než sklad a dialóg ho znova
nečíta: ukáže riadok bez panela súboru. Predtým ukazoval pôvodný asset pod riadkom, ktorý už patrí originálu.

**Testy** (`consumerProfileAssetDetailSave.test.ts`, skupina „opened from a row of the upload queue", +8;
`consumerProfileUploadDialogSingle.test.ts`, +2): riadky dostanú, čo sa poslalo, nie čo sa napísalo a prepolo počas
PATCH; fronta sa dozvie o uloženom assete, aj keď sklad medzitým drží iný; detail zatvorený počas PATCH (čítanie po
ňom prejde aj zlyhá); dialóg nad skladom s assetom z knižnice ukazuje riadok, kým neprečíta svoj.

**Dôkaz** (v pamäti, snímok `OP-L-c1`; `scratchpad/oplc1-bend.sh`, výpisy `oplc1-bend-*.log`, `oplc1-old.log`):
päť produkčných súborov zo snímku → 15 / 161 (s prípadmi OP-L2). Ohyby: kópia je živý asset → 2; prepínač čítaný po
PATCH → 6; asset čítaný po PATCH → 4; preskočenie pri zatvorenom detaile → 4; neznáma konfigurácia hodí → 1, číta pod
predvolenou → 1; pohľad berie hocijaký asset → 2; panel súboru berie hocijaký asset → 1 (admin-cms).

**Behy.** Cielené 84 súborov / 1 882 zelených (`dam/uploadQueue`, `assetDetail`, `dam/__tests__`, `imageWidget`,
`assetSelect`); `oxfmt`, `oxlint`, `eslint` na deviatich súboroch čisté, `lint:tsc` 0. **CK-LIB OP-L-c1 zelená**
(`vysledky/OP-L-c1-ck.log`): `test:browser` 314 súborov / 4 367 testov (OP-L3 +12), `test:eslint` 7 / 82, ostatné čisté.

**Nové nálezy z posudkov (nemenené).**
- **„Uložiť a použiť" dialógu fronty po zatvorení.** Keď používateľ počas jeho behu dialóg zavrie, frontu to
  vyprázdni a dialóg zanikne, ale obsluha dobehne a pošle widgetu svoje staré obrázky (`UploadQueueDialog.vue:122-161`).
- **`updateUploadStore` sa nikdy nevracia na `false`** (`UploadQueueDialog.vue:171` je jediný zápis): po prvom
  „upraviť asset" z fronty volá `updateFromDetail` každé ďalšie uloženie detailu, aj otvoreného z galérie. Číta sa
  asset navyše; riadky iného assetu sa nemenia.
