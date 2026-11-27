# OP-L2: galéria a widgety, nálezy 74, 55, 54, 79, 78 (impl-lib-op)

**Stav: po cykle 1, čaká na posudok opráv.** Cielené testy a CK zelené po poslednej úprave `src` (CK-LIB OP-L-c1, 12. 10.).

Zadanie vedúceho (`overenie-nalezov.md`, tabuľka „FE, knižnica"): FE-2 (74), FE-3 (55), FE-4 (54), FE-5 (79), FE-7 (78).
Strom LIB, TMPDIR `node_modules/.cache/vitest-tmp-impl-lib-op`. Snímok **`OP-L2`** (po OP-L1, s
`doc/changelog/2.0.0.md`), záplata `krok5-praca/zaplaty/OP-L2.diff` (10 súborov; mimo `src` a `doc` nič).

## Zmenené súbory

- `src/domains/dam/api/damAssetApi.ts`
- `src/domains/dam/imageWidget/components/ImageWidgetInner.vue`
- `src/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue`
- `src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue`
- `src/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue`
- `src/domains/dam/__tests__/damAssetApiBulkMetadata.test.ts`
- `src/domains/dam/imageWidget/__tests__/imageWidgetsDamAuthorsSave.test.ts` (nový)
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetMultipleUpload.test.ts`
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetLibrary.test.ts`
- `doc/changelog/2.0.0.md` (päť odrážok v „Image widgets and asset select, uploads and picks.")

## FE-2 (74): galéria číta každý vybraný asset pod jeho vlastnou licenciou

**Čo sa mení v kóde.** `assetSelectConfirmMap` (`ImageWidgetMultipleInner.vue:267-326`): vybrané assety sa zoskupia podľa
`asset.licence` (`:274-283`) a čítajú sa po licenciách, jedna požiadavka na licenciu (`:285-286`). Mená autorov sa
hľadajú hneď po čítaní tej licencie, pod jej ext systémom zo zoznamu licencií výberu (`assetSelectStore.selectConfig`,
`:311-315`); ak tam licencia nie je, pod ext systémom prezeranej licencie ako doteraz. Vetva s `readUnder` (assety, ktoré
už sú v licencii uploadu, po kópii ostatných) číta ako doteraz pod jeho licenciou a ext systémom. Po čítaní (`:328-330`) sa
ukáže systémová chyba, keď `showErrorsDefault` chybu nepozná (holá chyba axiosu z `fetchAssetListByIds`).

**Čo sa mení pre používateľa.** admin-cms (admin-ugc má pri galérii jednu licenciu, zmena sa ho týka len chybou
čítania), galéria, výber z knižnice bez kópie: obrázky assetov vybraných v inej licencii, než je prezeraná pri
potvrdení, dostanú popis, zdroj a autorov. Doteraz ich DAM z odpovede potichu vynechal a obrázok prišiel prázdny.
Keď čítanie zlyhá, ukáže sa „systémová chyba" (doteraz nič); obrázky sa pridajú ako doteraz, tie neprečítané bez
textov. Zlyhanie jednej licencie čítanie ďalších nezastaví (od cyklu 1; prvý tvar kroku po ňom skončil).

**Na backend.** `GET …/asset/licence/{L}/ids/…` raz za každú licenciu vybraných assetov (doteraz raz, pod prezeranou
licenciou), a `GET …/author/ext-system/{E}/search?id=…` raz za licenciu, pod jej ext systémom (doteraz raz, pod ext
systémom prezeranej). **Pri výbere z jednej, prezeranej licencie sú požiadavky rovnaké ako doteraz** (jedno čítanie,
jeden dopyt na autorov v tom istom poradí id; pripína prípad „of the licence browsed alone").

## FE-3 (55): uloženie autorov z dialógu obrázka hlási chybu raz a vždy skončí

**Čo sa mení v kóde.** `updateAssetAuthors` (`damAssetApi.ts:325-335`) je prepísané podľa `bulkUpdateAssetsAuthors`:
spoločný príkaz `useMetadataBulkCommand` a `saveMetadataInBatches`. Hlásky už nerobí; chybu hodí volajúcemu. Volajúci
(`ImageWidgetInner.vue:598-604`, `ImageMediaWidgetInner.vue:741-747`) majú okolo neho vlastný `try`: chybu povie
`showMetadataSaveError` a potvrdenie skončí bez uloženia obrázka. Ostatné chyby potvrdenia (uloženie obrázka) idú
vonkajším `catch` ako doteraz.

Odstránené, lebo to nič iné nepoužíva a `src/lib.ts` to nevyváža: `handleMetadataValidationError`, štvrtý parameter
`extSystem` funkcie `updateAssetAuthors` a štyri importy chýb v `damAssetApi.ts`.

**Čo sa mení pre používateľa.** admin-cms (admin-ugc autorov DAM nemá), widget obrázka a widget obrázka s médiom,
dialóg obrázka s výberom autorov DAM, „Potvrdiť":
- 422: jedna hláška „opravte chyby" s poľom pod menom z formulára (autori, vlastné pole). Doteraz dve hlášky.
- 422, keď prvky vlastného formulára ext systému nie sú načítané: tá istá jedna hláška a tlačidlo sa prestane točiť.
  Doteraz sa točilo navždy.
- 2xx iné než 200: systémová chyba (doteraz nič; obrázok sa neuložil ani predtým). Backend odpovedá 200 alebo 422.
- lehota: hláška o lehote (doteraz systémová chyba). 403 a 5xx bez zmeny.
- zlyhané uloženie (5xx, sieť, 2xx iné než 200) ide do záznamu chýb API ako ostatné uloženia metadát; doteraz nešlo.

**Na backend.** Bez zmeny: `PATCH …/asset/metadata-bulk-update` s telom `[{"id":…,"authors":[…],"described":true}]`
(pripnuté doslova ako text v dvoch testoch).

## FE-4 (54): riadok galérie bez assetu si po uložení nechá zdroj

**Čo sa mení v kóde.** `ImageWidgetMultipleInner.vue:525`: `showDamAuthors` po uložení je `matchedImage ?
matchedImage.showDamAuthors && matchedImage.damAuthors.length === 0 : false`. Overené proti načítaniu (`:172-174`):
riadok s nájdeným assetom bez autorov ponúka autorov pred uložením aj po ňom; riadok s autormi nie; riadok, ktorému
autorov používateľ vybral, po uložení neponúka (ako doteraz); riadok bez nájdeného assetu neponúka pred ani po.

**Čo sa mení pre používateľa.** admin-cms, galéria: riadok, ktorého asset DAM pri načítaní nevrátil (zmazaný, licencia
bez prístupu), má po uložení ďalej pole zdroja, povinné ako predtým. Doteraz sa po prvom uložení zmenilo na prázdny
výber autorov. V admin-ugc sa mení len príznak riadku (autorov DAM nemá, pole zdroja mal vždy).

**Na backend.** Nič.

## FE-5 (79): nad limitom 50 súborov sa dialóg fronty neotvorí naprázdno

**Čo sa mení v kóde.** `onFileInput` a `onDrop` (`ImageWidgetMultipleInner.vue:201-221`) už dialóg fronty neotvárajú;
otvára ho `afterLimitDialogAdd` (`:257`), keď `ImageWidgetMultipleLimitDialog` súbory naozaj zaradí. `onFileInput`
obsluhuje aj pridávanie z otvoreného dialógu fronty (jeho vstup aj pustenie, `:748-749`).

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, galéria, 51 a viac súborov naraz (alebo viac, než sa do 50
zmestí): ukáže sa len otázka o limite; po „Zrušiť" neostane otvorený prázdny dialóg fronty. Po „Pridať prvých N" sa
dialóg otvorí nad zaradenými súbormi. Do limitu sa dialóg otvára ako doteraz (o pár mikroúloh neskôr, po zaradení).

**Na backend.** Nič.

## FE-7 (78): popis v dialógu obrázka ukazuje chybu validácie

**Čo sa mení v kóde.** `ImageDetailDialogMetadata.vue:229`: pole popisu v dialógu má `:v="v$.image?.texts.description"`
ako v rozbalenom tvare (`:138`) a ako pole zdroja.

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, dialóg obrázka oboch widgetov jedného obrázka: popis nad 2 000
znakov (alebo iné pravidlo aplikácie, `descriptionValidation`) ukáže chybu pod poľom, po opustení poľa alebo po
„Potvrdiť"; ak aplikácia popis vyžaduje, pole má značku povinného. Doteraz len všeobecná hláška.

**Na backend.** Nič.

## Testy a prečo vedia zlyhať

- `consumerProfileImageWidgetMultipleUpload.test.ts` (obe aplikácie):
  - FE-2, „assets picked in the library, none of them to be copied" (+8): tri assety dvoch licencií, potvrdené nad
    jednou aj nad druhou: dve čítania pod vlastnými licenciami, texty všetkých troch, v admin-cms dopyty na autorov pod
    ext systémami 1 a 7; výber z jednej licencie: jedno čítanie a jeden dopyt (stráž „ako doteraz", na starom kóde
    prejde); čítanie jednej licencie odmietnuté: jedna hláška, prečítané obrázky s textami.
  - FE-2, existujúci prípad „…whose read failed…" (admin-cms): doplnená hláška.
  - FE-4 (+2): „leaves a row whose asset the DAM did not return with its source…"; a do existujúceho prípadu
    „first saves the authors picked in a row…" pribudlo, že riadok po uložení autorov už neponúka.
  - FE-5 (+6): 51 súborov vstupom aj pustením: otázka, žiadny dialóg fronty, ani po „Zrušiť"; „prvých 50": dialóg až
    po zaradení.
- `imageWidgetsDamAuthorsSave.test.ts` (nový, admin-cms, oba widgety, 16): požiadavka doslova a pred uložením obrázka;
  200 bez zoznamu; 422 autori a vlastné pole (jedna hláška, mená z formulára); 422 bez načítaných formulárov;
  403, 500, 204. Po každom zlyhaní: obrázok sa neuloží, dialóg ostáva, „Potvrdiť" sa netočí.
- `damAssetApiBulkMetadata.test.ts` (+15): telo `updateAssetAuthors` ako text; 422 s formulármi aj bez nich skončí
  chybou a nič nehlási; `updateAssetAuthors` pribudlo do tabuľky zlyhaní (12 prípadov).
- `consumerProfileImageWidgetLibrary.test.ts` (obe aplikácie, +2): popis s 2 001 znakmi ukáže chybu pod poľom.

Okrajom testov je klient DAM (`fakeDam`) a čas; `Picker` a zoznam s triedením sú náhrady ako v tých súboroch doteraz.

**Dôkaz** (v pamäti, `vitest.bend.config.mts`, snímok `OP-L2`; `scratchpad/opl2-bend.sh`, výpisy
`scratchpad/opl2-bend-*.log`, `opl2-old.log`):

| Ohyb | Zlyhá |
|---|---|
| päť produkčných súborov zo snímku | 35 / 175 a 6 nezachytených chýb (staré `updateAssetAuthors` sa pri 422 neskončí) |
| widget: chybu autorov povie `showErrorsDefault` (zvlášť každý widget) | 3 a 3 |
| widget: po chybe autorov pokračuje (zvlášť každý widget) | 6 a 6 |
| galéria číta pod prezeranou licenciou | 6 |
| galéria hľadá autorov pod prezeraným ext systémom | 2 (admin-cms) |
| zoskupenie drží len posledný asset licencie | 6 |
| odmietnuté čítanie bez hlášky | 3 |
| `showDamAuthors` po starom | 2 |
| `showDamAuthors` bez `damAuthors.length === 0` | 1 |
| vstup otvorí dialóg hneď | 4 |
| pustenie otvorí dialóg hneď | 2 |
| `afterLimitDialogAdd` neotvorí | 12 |
| popis v dialógu bez `:v` | 2 |

**Behy.** Cielené (`scratchpad/opl2-run.sh`): 24 súborov / 461 zelených (`imageWidget`, `assetSelect`,
`damAssetApiBulkMetadata`, `uploadQueueDialogSingle`); `oxfmt`, `oxlint`, `eslint` na deviatich súboroch čisté,
`lint:tsc` 0. **CK-LIB OP-L2 zelená** (`vysledky/OP-L2-ck.log`): `test:browser` 312 súborov / 4 321 testov (OP-L1 +1
súbor, +49), `test:eslint` 7 / 82, ostatné čisté.

## Texty na potvrdenie

Žiadne (žiadny nový text; FE-2 používa existujúcu „systémovú chybu").

## Rozhodnutia a odchýlky

- **FE-3:** chybu autorov hlási vlastný `try` okolo `updateAssetAuthors`, nie vonkajší `catch` potvrdenia: cez
  `showMetadataSaveError` by inak išli aj chyby uloženia obrázka a neznáme z nich by dostali systémovú chybu navyše.
- **FE-2:** autori sa hľadajú po licenciách, nie po ext systémoch: dve licencie jedného ext systému dajú dva dopyty.
- **FE-2:** `catch` kryje celé čítanie ako doteraz. Systémovú chybu tak dostane aj chyba, ktorú doteraz nikto
  nevidel: výber potvrdený bez nastavených licencií výberu (`requireSelectedSelectConfig` hodí); mimo dialógu výberu
  sa to nestane.

## Nové nálezy (nemenené)

- **Widgety jedného obrázka hľadajú autorov pod ext systémom prezeranej licencie.** `ImageWidgetInner.vue:505-510`
  a `ImageMediaWidgetInner.vue:632-637` (načítanie vybraného assetu), `:591-596` a `:734-739` (uloženie): ext systém
  je `assetSelectStore.requireSelectedSelectConfig()`, nie ext systém licencie vybraného assetu. Výber prežije zmenu
  prezeranej licencie aj v týchto výberoch (test „asks for the copy of an asset picked over another licence…"). Ak má
  druhá licencia iný ext systém, mená sa nenájdu a zdroj ostane prázdny. To isté je nález 74 pre galériu; backend som
  pre tento prípad neoveroval.
- **Výber assetov s uploadom nemá limit 50.** `AAssetListInner.vue:207-213` zaradí všetky súbory a dialóg fronty
  otvorí hneď, bez `ImageWidgetMultipleLimitDialog`.
- **`ImageWidgetMultipleLimitDialog.onDialogConfirm` bez `try`.** Keď `addByFiles` hodí (`:62-68`), tlačidlo
  „Pridať prvých N" sa točí ďalej, `afterAdd` nepríde a odmietnutie nikto nezachytí. Hodí len pri chýbajúcej
  konfigurácii, s ktorou sa widget nepripojí.

## Cyklus 1 (OP-L-c1, 12. 10.; posudky Codex a Opus nad OP-L1 až OP-L3, spoločný cyklus)

Snímok `OP-L-c1`, záplata `zaplaty/OP-L-c1.diff` (spoločná s OP-L1). FE-4, FE-5, FE-7 bez nálezu.

1. **FE-2, zlyhanie jednej licencie nezastaví ostatné** (oba posudky). `ImageWidgetMultipleInner.vue:284-330`:
   `try` je okolo čítania jednej licencie; zlyhania sa zbierajú a po slučke sa povie prvé z nich, raz. Doteraz `try`
   obaľoval celú slučku a po prvom zlyhaní ostali ďalšie licencie neprečítané a ich obrázky prázdne. Ako vyzerá riadok
   neprečítaného assetu, sa nemení (starší stav, pripnutý existujúcim testom). Pre používateľa (admin-cms, galéria,
   výber z viacerých licencií): obrázky licencií, ktoré sa prečítať dali, majú texty; hláška je jedna. Na backend:
   po zlyhaní idú aj čítania ďalších licencií a dopyty na ich autorov.
2. **FE-3, zápis** (dokumenty). Uloženie autorov z dialógu obrázka: lehota ukáže hlášku o lehote (doteraz systémová
   chyba); 2xx iné než 200 ukáže systémovú chybu (doteraz nič); zlyhané uloženie (5xx, sieť, 2xx iné než 200) ide do
   záznamu chýb API ako ostatné uloženia metadát, 401, 403 a 422 nie (`damAssetApiBulkMetadata.test.ts`, tabuľka
   zlyhaní, riadok „the save of the authors of one asset"). Doplnené do changelogu.

**Testy** (`consumerProfileImageWidgetMultipleUpload.test.ts`, +2: prípad „one of whose licences…" nahradili dva): tri
licencie, zlyhá prvá, alebo prvá a posledná: tri čítania, jedna hláška, texty prečítaných, dopyty na autorov len pre
prečítané. **Dôkaz** (`scratchpad/oplc1-bend.sh`): po prvom zlyhaní koniec → 4; hláška za každé zlyhanie → 2; bez
hlášky → 5; päť súborov zo snímku → 15 / 161 (spolu s OP-L1). **CK-LIB OP-L-c1 zelená**: 314 súborov / 4 367 testov.

**Nové nálezy z posudkov (nemenené).**
- **Riadok neprečítaného assetu dostane prázdny výber autorov spolu s `assetId`** a autori v ňom vybraní pri uložení
  nahradia skutočných autorov assetu. Starší stav, pripnutý testom „writes no authors for an image picked from the
  DAM whose read failed…" (`consumerProfileImageWidgetMultipleUpload.test.ts:831`).
- **Riadky galérie vyberajú a ukladajú autorov DAM pod ext systémom stránky** (`cachedExtSystemId`,
  `ImageWidgetMultipleItem.vue:122`, `ImageWidgetMultipleInner.vue` `saveImages`): pre riadok assetu iného ext
  systému je to zlý ext systém.
