# U0-L: testy dnešného správania knižnice (testy-lib, meno `testy-lib`)

Plán 2.2 „U0-L", 3.6, 4.3 „testy-lib, testy-dam", príloha A; návrh komponentov 4.2 (a 1.10, 1.11, 2.8 pre to, čo U6
a U7 zachovajú). Strom `/home/volar/projects/anzusystems/krok5-praca/wt/lib-u` (worktree knižnice, HEAD `03c3a108`,
necommitnuté opravy N32 a N39-L ako východisko, nemenené). Mimo `src` sa nemení nič; produkčný kód sa nemení.

**Stav: uzavretý vedúcim 9. 10.** po cykle 6 (posudky bez nálezu v teste; posledná CK-LIB-T U0-L-c5 zelená,
298 / 3 719). Ďalej P0 (vedúci) a U1 (impl-komp-lib).

## Podkroky

1. **Snímok `U0-L`** (9. 10.): `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/krok5-praca/wt/lib-u U0-L`, kód 0. `status.txt`: 13 súborov N32 a N39-L (` M`)
   a nový `consumerProfileAssetDetailSave.test.ts` (`??`). Súbory mimo `src`: žiadne.
2. **Testy** (zoznam nižšie), písané z návrhu 4.2; podvrhnutý len okraj: klient DAM (`fakeDam`), klient a API obrázkov
   (`consumerImageApi`), dlhé čakanie riadku (existujúca náhrada `window.setTimeout` od 10 s v
   `uploadQueueRowRefresh.test.ts`). Žiadny `vi.mock` navyše. Identifikátory z riadkov a assetov (`item.assetId`),
   nič sa nespúšťa súbežne (pasca `lib-vlna4.md` sa tu neuplatní: žiadny upload sa nezačína).
3. **Cielené behy** (všetky cez `tezky.sh`, `--retry=0`, TMPDIR `…/lib-u/node_modules/.cache/vitest-tmp-testy-lib`;
   tri súbory kroku):
   - beh 1: 40 testov detailu, 2 červené: prípad „zastaranej" záložky Fókus pri videu (pozri odchýlku 3) tvrdil editor;
     skutočnosť je obrázok, prípad prepísaný na to, čo používateľ vidí;
   - beh 2: **70 / 70 zelených** (detail 40, miesta obrázka 12, riadok 18 = 17 + 1);
   - po oprave typov (bod 5) beh 3: **70 / 70 zelených**.
4. **Dôkaz, že prípady tvrdiace neprítomnosť vedia zlyhať** (všetko v pamäti, produkčný súbor sa na disku neohol ani na
   chvíľu). Konfigurácia `…/lib-u/node_modules/.cache/vitest-tmp-testy-lib/vitest.u0l.config.mts`: `mergeConfig`
   so skutočnou `vitest.config.mts`, `root` = `lib-u`, plugin `load` s `enforce: 'pre'`, ktorý v module nahradí presný
   text (text musí byť v module práve raz, inak výnimka); zoznam ohnutých modulov do `u0l-bend-*-applied.txt`; beh cez
   `tezky.sh` s `--config`. Ohnutia (`bend-1.json` až `bend-3.json` v tom istom priečinku) a výsledok:
   - **súbor 1** (riadok a miesta obrázka; 30 testov): **presne 7 červených**, 23 zelených:
     - `UploadQueueItemEditable.vue`, vetva `Uploaded`: `refreshDue.value = props.item.error.hasError` namiesto `false`
       (ako pravidlo (a) admin-dam „Obnoviť hneď pri chybe"): červený práve nový prípad riadku;
     - `AImagePublicInput.vue`: `data.id = resImage.value?.id ?? 0` namiesto podmieneného `id`: „creates … without an
       id" (oba profily);
     - `ImageDetailDialogMetadata.vue`: `position: 0` v obrázku média: „shows the image of the file of the media …"
       (oba profily); bez podmienky `isNull(imageFileId)`: „has no image for a media without the file of one" (oba);
     - po oprave typov (bod 5) zopakované: tých istých 7.
   - **súbor 2** (detail; 40 testov): **presne 17 červených**, 23 zelených:
     - `AssetDetailDialogSidebar.vue`: záložka Fókus `v-if="true"`: tri druhy assetu (video, audio, dokument) × 2
       profily a „shows the picture of a video, also when the tab … was left open" × 2;
     - `AssetDetailDialog.vue`: `roiEditable` = `true`: CMS „only shows the image to a user … without that grant" a
       „… while no user of the DAM is loaded";
     - `AssetMetadata.vue`: panel súboru `v-if="true"`: UGC „has no panel of the file";
     - `AssetDetailDialog.vue`: zatvorenie bez `dialog.value = null`: oba spôsoby zatvorenia × 2 profily;
     - `AssetDetailDialog.vue`: prepínač vždy `true`: „hides its sidebar by the toggle …" × 2.
   - **súbor 3** (detail; 40 testov): **presne 17 červených**, 23 zelených:
     - `AssetDetailDialog.vue`: `simpleMode` = `true`: CMS obrázok pred záložkou Fókus, dva varianty obrázka (bez
       farby, bez obrázka detailu), tri druhy × 2 profily, „zastaraná" záložka × 2 (11);
     - `AssetDetailDialog.vue`: `roiEditable` bez výnimky pre `roiUpdateAcl` `null` (kontrola práva aj pri inej adrese):
       UGC „can be edited with no user of the DAM at all";
     - `AssetInfobox.vue`: „Neobsahuje súbor" pri každom stave okrem mazania: „says nothing of a processed file …" a
       „says that the main file is a duplicate" × 2;
     - `AssetDetailDialogSidebar.vue`: záložky `v-if="true"`: UGC „has the editor … at once, and no tabs".
5. **Formát a kontroly** na troch súboroch: `oxfmt --check` (dva súbory preformátované `oxfmt`, len zalomenie),
   `oxlint` 0, `eslint` (cez `tezky.sh`) 0; `lint:tsc` (cez `tezky.sh`) prvý pokus 2 chyby typov v
   `damImageSites.test.ts` (`wrapper.props('modelValue')` na netypovanom obale, `element.value` bez typu poľa) →
   model sa číta z obsluhy `onUpdate:modelValue`, `get<HTMLInputElement>`; druhý pokus kód 0.

6. **CK-LIB-T U0-L zelené** (`vysledky/U0-L-ck.log`, `ck-kod=0`): 298 súborov / 3 696 testov, ako vyrátané.
   Záplata `zaplaty/U0-L.diff` (vedúci).

## Cyklus 1 (posudok Codexu `impl/posudky/U0-L-c1-codex.md`, posudok Opusa v dvoch správach vedúcemu)

Žiadny zlý ani vždy prechádzajúci prípad; medzery, ktoré by U6 a U7 mohli prejsť bez povšimnutia. Snímok `U0-L-c1`
(kód 0) pred opravami. Doplnené (`assetDetailDialog.test.ts` 40 → 52, `damImageSites.test.ts` 12 → 14):

1. Detail:
   - (a) tlačidlo „Uložiť" v skutočnom `AssetDetailDialog` je v sidebare (cieľ teleportu), uloží
     (`PATCH <asset>/metadata-bulk-update` s assetom) a povie „uložené" (oba profily; JS19, JS23);
   - (b) obrázok: `aspectRatio` nie je, `cover`, `showUploading`, `showProcessing`, `showWaiting`, `showDone` vypnuté,
     `useComponent` (vlastnosti náhrady podľa mena, ktoré po U6 platia); vykreslené: medzi ľavou časťou a obrázkom nie je
     žiadny prvok `.position-relative` a rodič obrázka má vypočítané `display: flex` (oba profily: CMS obrázok, UGC
     video; JS8, JS9);
   - (c) CMS: obrázok otvorený, keď sklad drží záložku Fókus: vybraná Fókus, editor hneď, regióny, žiadny formulár
     (JS14); skutočný prechod (oba profily): obrázok, v CMS výber Fókusu, potom iný asset (video `asset-2`): obrázok
     videa 356×200, žiadny editor, záložky len Info a vybraná, panel metadát. Prípad „zastaranej" záložky pri videu
     tvrdí už len to, čo vidno (vybraná Info, panel metadát), nie hodnotu v sklade;
   - (d) zmena assetu v otvorenom dialógu nakreslí sidebar znova: panel metadát, ktorý používateľ zavrel, je pri
     ďalšom assete znova otvorený (oba profily; `:key="asset.id"`, `ADD:219-221`);
   - (e) CMS: texty panela „Info o súbore" majú vypočítané `overflow-wrap: normal`, texty panela metadát `break-word`
     (karta; JS29, `AssetMetadata.vue:195-197`). Dialóg jedného súboru: vedúci povolil
     `LT0/consumerProfileUploadDialogSingle.test.ts` (ten istý cyklus c1, bez nového snímku); nový prípad CMS „breaks
     the texts of the panel of the file as the rest of its card does": panel „Info o súbore" má vypočítané
     `overflow-wrap: break-word` (34 prípadov + 13 z N39-L = 47 → 48).
2. IM9: **licenciu a pozíciu objektu náhľadu pripnúť nejde.** Náhľad nie je komponent, ale `<img :src>`; objekt sa
   podá len `widgetImageToDamImageOriginalUrl` (`imageActions.ts:24`), ktorá číta iba `dam.damId`, a výsledok je reťazec.
   Ani vlastnosti komponentu, ani nič vykreslené licenciu či pozíciu nenesie; videl by ich len `vi.mock` modulu
   `imageActions` (plán 4.3 zakazuje). Sú to mŕtve údaje: ich zmena v U7 sa nemôže prejaviť. Dokázané ohnutím, že
   `images.calls` toEqual `[]` vie zlyhať (nižšie). **Vedúci prijal 9. 10.** (mŕtve údaje, náhrada modulu zakázaná).
3. IM8: nový prípad „updates a saved image with the file typed in its place, of the licence of that file": uložený
   obrázok 802 so súborom a licenciou iného assetu (`OTHER_FILE`, licencia + 1, `internal: true`), používateľ napíše
   iný súbor (licencia profilu, `mainFileInternal: false`); `updateImage(802)` má `dam` z assetu napísaného súboru
   (`AImagePublicInput.vue:124-129`). Vstup dostáva obe licencie (`selectLicences`).
4. IM7 bez súboru: tvrdí sa, čo sa ukáže (zástupný obrázok `placeholder16x9.svg` vo `VImg`) a že sa nepýta API
   obrázkov; `undefined` aj `null` obrázka dajú to isté.
5. RD12 beží pod existujúcou náhradou `@/domains/dam/composables/commonAdminCoreDamOptions` súboru
   (`uploadQueueRowRefresh.test.ts:11-14`, predpísané miesto prípadov), riadok ju sám nečíta (`UploadQueueItemEditable.vue`
   ju neimportuje). Opus potvrdil odchýlku 3 a spresnil ju: záložka sa vynúti len pri pripojení `VTabs`
   (`group.js`: `forceMandatoryValue` pri `onMounted`; pri odregistrovaní vybranej záložky výber ostane), takže v U6
   musí ostať `:key="asset.id"` na sidebare; prípad (c) prechodu a (d) to strážia.

Behy cyklu 1 (cez `tezky.sh`, `--retry=0`): tri súbory kroku **84 / 84 zelených** (detail 52, miesta 14, riadok 18).
Ohnutia v pamäti (tá istá konfigurácia `vitest.u0l.config.mts`):
- `bend-c1-detail.json` (detail, 52): **presne 9 červených**: `AssetDetailDialog.vue` `cover`, `show-done` a
  `:aspect-ratio` obrázka: (b) vlastnosti × 2; obal `<div class="position-relative d-flex">` okolo obrázka: (b) obal × 2;
  nastavenie záložky Info pri otvorení (ako dialóg jedného súboru): (c) CMS obrázok so zastaranou Fókus; bez
  `:key="asset.id"`: (c) prechod v CMS a (d) × 2 (prechod v UGC ostane zelený: jednoduchý sidebar pripojí `VTabs` až
  pri videu, teda znova vynúti prvú); `AssetMetadata.vue` bez `overflow-wrap: normal`: (e).
- `bend-c1-sites.json` (miesta, 14): **presne 10 červených**: `AImagePublicInput.vue` `dam` z uloženého obrázka:
  nový prípad IM8 × 2; po overení súboru navyše `imageApi.fetchImage`: oba prípady náhľadu × 2 (zlyhá riadok
  `images.calls`, `:198`); `AImageWidgetSimple.vue` pri podanom obrázku navyše `imageApi.fetchImage`: IM7 obrázok × 2
  (zlyhá riadok `images.calls`, `:246`); `ImageDetailDialogMetadata.vue` bez podmienky `isNull(imageFileId)`: IM7
  zástupný obrázok × 2.
- `bend-c1-single.json` (`consumerProfileUploadDialogSingle`, 48): `UploadQueueDialogSingleSidebarMetadataContent.vue`
  s `overflow-wrap: normal` na paneli súboru: **presne 1 červený** (nový prípad), 47 zelených.
Štyri súbory (tri kroku a `consumerProfileUploadDialogSingle`): **132 / 132 zelených**. `oxfmt --check`, `oxlint`,
`eslint` (cez `tezky.sh`) na štyroch súboroch čisté, `lint:tsc` (cez `tezky.sh`) kód 0.
Záplata `bash …/zaplata.sh U0-L-c1` (znova, po prípade dialógu jedného súboru) → `zaplaty/U0-L-c1.diff` (3 súbory
v `src`, mimo `src` a `doc` nič). Počty: CK má mať **298 / 3 711** (+15 oproti U0-L).

**CK-LIB-T U0-L-c1 zelené** (`vysledky/U0-L-c1-ck.log`, `ck-kod=0`): 298 súborov / 3 711 testov, ako vyrátané.

## Cyklus 2 (posudok Codexu `impl/posudky/U0-L-c2-codex.md`, posudok Opusa vedúcemu)

Snímok `U0-L-c2` (kód 0) pred opravami. Doplnené:

1. (Codex, stredné, JS23) Uloženie v skutočnom detaile, `describe('its save button')` (oba profily):
   - „is "Save" in the sidebar, turns while the DAM saves the asset, and says it is saved": text tlačidla
     `common.button.save`; odpoveď na `PATCH` sa zadrží (`dam.hold`), počas nej tlačidlo naozaj točí
     (`v-btn--loading`), po uvoľnení netočí, „uložené";
   - nový „of a detail opened from the queue of an upload › writes what it saved back into the row of the queue":
     skutočný upload jedného súboru do frontu (`addByFiles`, dlhé čakania cez `holdLongWaits`, mená cez
     `answerDamNames`), riadok `Uploaded` s popisom „from the server"; detail otvorený ako ho otvára dialóg frontu
     (`updateUploadStore = true`, asset riadku z DAM); popis prepísaný v poli detailu; DAM si pri zadržanej odpovedi
     uloží, čo uloženie poslalo; po uložení ide `GET <asset>/<id riadku>` a riadok frontu má prepísaný popis
     (`AssetDetailSidebarMetadata.vue:59-61`). Identifikátor z riadku (`row().assetId`).
2. (Codex nízke, Opus stredné, JS9) Rozloženie obrázka:
   - (a) detail: prípad „puts the picture straight into the flex box …" (trieda `position-relative` a rodič náhrady)
     **vypustený**: v detaile nič neprekrýva obrázok, takže obal by nemal nič viditeľné; vlastnosti `AssetImage`
     (bez `aspectRatio`, `cover`, `show*`) ostávajú (JS8);
   - (b) dialóg jedného súboru, nový `describe('the picture of the file')` (oba profily): „shows the file being sent,
     then processed, then done": vlastnosti náhrady `AssetImage` počas posielania (zadržaný kúsok: `showUploading`,
     `uploadingProgress` a `remainingTime` z riadku), spracovania (`showProcessing`) a po nahratí (`showDone`; v UGC je
     tam editor, obrázok nie), vždy `aspectRatio` 16/9 a `showWaiting` `false`; „draws the error of a refused file over
     the picture alone": pri zamietnutom súbore je `offsetParent` prekrytia `.dam-upload-queue__overlay` obal obrázka
     (`UQDS:429`), nie ľavá časť; identifikátory z riadku.
3. (Opus, IM8) Prípad „updates a saved image with the file typed in its place …": napísaný súbor je v `otherLicence`
   (nie prvá licencia výberu ani licencia profilu), uložený obrázok v licencii profilu; telo má `licenceId:
   otherLicence`.
4. (Opus, JS19) Panel oblasti záujmu: `regions().props()` ⊇ `{ isActive: true, queueKey: QUEUE }` v detaile (CMS po
   Fókuse, UGC hneď, CMS so zastaranou Fókus) a v `consumerProfileUploadDialogSingle` (`:229`, `:237`, rozšírené
   tvrdenia existujúceho prípadu rozloženia).
- Mimo zmeny: druhé čítanie `AImagePublicInput` po vytvorení zapísal vedúci ako nález 63.

Behy cyklu 2 (cez `tezky.sh`, `--retry=0`): štyri súbory **136 / 136 zelených** (detail 52 = 52 − 2 vypustené + 2
nové, miesta 14, riadok 18, jeden súbor 52 = 48 + 4), dva behy po sebe. Ohnutia v pamäti (tá istá konfigurácia,
súbory `bend-c2-*.json` v `…/vitest-tmp-testy-lib/`):
- `bend-c2-detail-1.json` (detail, 52): **presne 7 červených**: bez `updateFromDetail` v `AssetDetailSidebarMetadata`:
  zápis do riadku × 2; `AssetDetailDialogSidebar` `:is-active="false"` oboch regiónov: CMS obrázok po Fókuse, UGC
  editor hneď, CMS zastaraná Fókus; text tlačidla `common.button.confirm`: „is "Save" …" × 2;
- `bend-c2-detail-2.json` (detail, 52): bez `saveButtonLoading.value = true`: **presne 4 červené** (oba prípady
  tlačidla × 2);
- `bend-c2-single-1.json` (jeden súbor, 52): **presne 6 červených**: obal `<div class="position-relative">` → `<div>`:
  prekrytie × 2 (zlyhá riadok `offsetParent`); `:show-processing="false"`: stavy obrázka × 2 (zlyhá riadok
  spracovania); `UploadQueueDialogSingleSidebar` `:is-active="false"` oboch regiónov: rozloženie × 2;
- `bend-c2-single-2.json` (jeden súbor, 52): `:aspect-ratio="undefined"`: **presne 4 červené** (stavy obrázka × 2,
  prekrytie × 2);
- `bend-c2-sites.json` (miesta, 14): `licenceId: props.selectLicences[0]!`: **presne 2 červené** (nový prípad IM8 × 2).
`oxfmt --check`, `oxlint`, `eslint` (cez `tezky.sh`) na štyroch súboroch čisté, `lint:tsc` (cez `tezky.sh`) kód 0.
Záplata `bash …/zaplata.sh U0-L-c2` → `zaplaty/U0-L-c2.diff` (3 súbory v `src`: detail, miesta, jeden súbor; mimo
`src` a `doc` nič). Počty: CK má mať **298 / 3 715** (+4 oproti U0-L-c1).

**CK-LIB-T U0-L-c2 zelené** (`vysledky/U0-L-c2-ck.log`, `ck-kod=0`): 298 súborov / 3 715 testov, ako vyrátané.

## Cyklus 3 (posudok Codexu `impl/posudky/U0-L-c3-codex.md`, posudok Opusa vedúcemu)

Snímok `U0-L-c3` (kód 0) pred opravami. Doplnené:

1. (Codex + Opus, stredné) Priebeh v dialógu jedného súboru: pri zadržanom kúsku mal riadok `progressPercent` a
   `remainingTime` `null` (falošný DAM nevolá `onUploadProgress`, `AssetImage` má predvolené `null`), takže tvrdenie
   prešlo aj bez väzby. Teraz má zadržaný riadok nenulové hodnoty tak, ako ich píše sklad (`setUploadSpeed`,
   `uploadQueuesStore.ts:351-355`; ako `uploadQueueRowStates.test.ts:124`): 37,5 % a 12 s, a tvrdia sa na obrázku.
   Udalosť priebehu som neposielal: rýchlosť a odhad počíta merač s vlastným časovačom (`uploadService.ts:211-229`),
   hodnoty by záviseli od času.
2. (Opus + Codex, JS9) Detail, nový prípad „puts the picture straight into the whole of its left side" (oba profily,
   náhrada `AssetImage`): rodič obrázka má vypočítané `display: flex` a rozmery celej ľavej časti
   (`.dam-image-detail__left`, šírka aj výška nenulové), teda medzi nimi nič nie je; bez tried.
3. (Opus + Codex) Prekrytie chyby v dialógu jedného súboru, prípad „draws the error of a refused file over the
   picture, and over nothing more" (oba profily): **skutočný `AssetImage`** (súbor bez náhľadu: sivý rámček 356×200
   bez požiadavky, `mountDialog(true)`) a **skutočné pravidlo prekrytia**: `dam-upload-queue.scss` (samostatný, bez
   `@use`) načítaný ako text (`?inline`) a vložený do stránky len pre tento prípad (`<style>` sa po ňom odoberie,
   `onTestFinished`); celý `main.scss` som nenačítal, lebo `image-detail.scss` pri šírke `md-and-down` dáva ľavej
   časti výšku 0 a zmenil by rozloženie ostatných prípadov (**vyvrátené sondou A v c4**: pri otvorenom sidebare má ľavá
   plocha pri 414×896 výšku 314 px = 35dvh, `image-detail.scss:92-96`; výška 0 platí len pri zavretom sidebare,
   `image-detail.scss:63-67`). Tvrdí sa: obrázok 356×200 a hranice prekrytia = hranice
   obrázka (zaokrúhlené). Nahradilo to `offsetParent`, ktorý by prešiel aj pri prekrytí bez `position: absolute`.
4. (Opus, JS7/JS12) Obrázok dialógu jedného súboru: počas posielania a spracovania sivý rámček (`src` prázdny,
   356×200, `#ccc`) s typom a stavom riadku (`item().assetType`, `item().assetStatus`); po nahratí (CMS) náhľad
   riadku `image_detail` súboru, 1600×900 (`requestedWidth`, `requestedHeight`), dominantná farba hlavného súboru
   prečítaného assetu (`#3a6b8c`), typ obrázok a stav „so súborom". V UGC je po nahratí na mieste obrázka editor.

Behy cyklu 3 (cez `tezky.sh`, `--retry=0`): štyri súbory **138 / 138 zelených** dva razy po sebe (detail 54, miesta
14, riadok 18, jeden súbor 52). Ohnutia v pamäti (`bend-c3-*.json`), každé zvlášť:
- `:uploading-progress="null"` v `UploadQueueDialogSingle.vue`: **presne 2 červené** (prípad stavov × 2 profily);
- `:remaining-time="null"`: **presne 2 červené** (to isté);
- `:src="''"`: **presne 1 červený** (stavy, CMS; v UGC je po nahratí editor a pred ním je `src` prázdny aj tak);
- `:background-color="'#ccc'"`: **presne 1 červený** (to isté);
- obal `<div class="position-relative">` → `<div>`: **presne 2 červené** (prekrytie × 2; zlyhá riadok hraníc
  prekrytia, `:318`);
- `position-relative` presunuté z obalu na celú plochu `w-100 h-100 pa-2`: **presne 2 červené** (prekrytie × 2;
  zlyhá riadok `:318`);
- `AssetDetailDialog.vue`: `<div>` okolo `AssetImage`: **presne 2 červené** (nový prípad JS9 × 2; zlyhá
  `display`: `block` namiesto `flex`).
`oxfmt --check`, `oxlint`, `eslint` (cez `tezky.sh`) na štyroch súboroch čisté, `lint:tsc` (cez `tezky.sh`) kód 0.
Záplata `bash …/zaplata.sh U0-L-c3` → `zaplaty/U0-L-c3.diff` (2 súbory v `src`: detail a jeden súbor; mimo `src` a
`doc` nič). Počty: CK má mať **298 / 3 717** (+2 oproti U0-L-c2).

**CK-LIB-T U0-L-c3 zelené** (`vysledky/U0-L-c3-ck.log`, `ck-kod=0`): 298 súborov / 3 717 testov, ako vyrátané.

## Cyklus 4 (posudok Codexu `impl/posudky/U0-L-c4-codex.md`, posudok Opusa vedúcemu)

Snímok `U0-L-c4` (kód 0) pred opravami.

**Sonda A** (zadanie vedúceho; v pamäti: ohnutý bol len text testu, na disku sa nezmenilo nič). Prípad prekrytia
v dialógu jedného súboru s celým štýlom knižnice (`styles/main.scss?inline`, ako ho načíta `src/lib.ts`), sidebar
aktívny (`--sidebar-active`), **v teste bez obalu aplikácie**; obdĺžniky `[x, y, šírka, výška]`:
- okno 414×896 (iframe, CMS): ľavá plocha `[207, 497, 207, 314]`; obal `.position-relative` `[311, 654, 0, 0]`;
  `.asset-image.asset-image--placeholder` `[311, 654, 0, 0]`; `.dam-upload-queue__overlay` `[311, 654, 0, 0]`,
  `position: absolute`; `elementFromPoint` v strede obrázka aj ľavej plochy: `div.text-error` (text prekrytia);
- okno 1280×800 (CMS aj UGC): ľavá plocha `[640, 449, 616, 750]`; obal, obrázok aj prekrytie `[648, 824, 0, 0]`;
  `elementFromPoint` v strede obrázka aj ľavej plochy `null` (bod pod spodkom okna, ľavá plocha začína na y=449;
  posun som neskúmal).
S celým štýlom je zástupný obrázok aj prekrytie 0×0 (`image-detail.scss:24-27` dáva placeholderu 100 % obalu bez
rozmeru): pri odmietnutom súbore nie je vidieť sivý rámček ani závoj, len obsah prekrytia. Vedúci to zapísal ako
**nález 64** (na rozhodnutie vlastníka); test ho nepripína ani neopravuje. **Rozhodnutie vedúceho k A:** geometriu
prekrytia nepripínať (0×0 s celým štýlom, 356×200 s čiastočným, ktoré používateľ nevidí); prípad prepísať na
štruktúru návrhu 2.8 (`navrh-komponenty.md:878-879`), bez `?inline`.

1. (A) Prípad „draws the error of a refused file in one box with the picture, after it" (oba profily, skutočný
   `AssetImage`, nič nestojí: súbor bez náhľadu nič nepýta): prekrytie a obrázok majú toho istého rodiča a ten je
   `offsetParent` prekrytia; obal obsahuje práve `[obrázok, prekrytie]` (prekrytie za obrázkom, kreslí sa navrchu pri
   `z-index: auto`); obal nie je plná plocha: jeho rodič je priame dieťa ľavej plochy a má jej šírku. Vypustené:
   vkladanie `dam-upload-queue.scss?inline`, `onTestFinished`, tvrdenie 356×200 a rovnosť hraníc.
2. (B1, JS7) Odkaz `image_detail` má požadovanú veľkosť 1280×720 inú než skutočnú 1600×900 (detail: `linksOf` vo
   fixture `image`; dialóg: odkaz súboru pri spracovaní): detail tvrdí skutočnú 1600×900 (`ADD:90-91` `.width`,
   `.height`), dialóg požadovanú 1280×720 (`UQDS:166-167` `requested*`).
3. (B2, JS12) Nový prípad „draws the grey box of the kind and the state of its row" (oba profily): riadku so
   zadržaným kúskom sa dá typ video a stav „mazanie" (iné než predvolené dialógu `image`/`draft` aj predvolené
   `AssetImage` `image`/`with_file`), sivý rámček ich nesie. Riadok je skutočný riadok frontu zmenený na mieste (ako
   priebeh v c3), nie riadok zostavený mimo skladu: sklad nemá verejný spôsob, ako vložiť hotový riadok.
4. (B3, JS9) **Skutočný obrázok v detaile som nepripol; sonda** (detail, CMS, skutočný `AssetImage`,
   `image_detail` = `data:image/svg+xml` 3200×900, bez siete, deterministické):
   - bez štýlu knižnice (ako beží sada), 414×896: ľavá plocha `[207, 497, 3216, 1214]`, plná plocha to isté, obrázok
     (`.v-img.asset-image--component`) 3200×900, `object-fit: contain`; s obalom `<div>` to isté (3200×900);
   - s `main.scss?inline`: 414×896 ľavá plocha `[207, 497, 3216, 314]`, obrázok 3200×298 (výška orezaná,
     `max-height: 100%` z `.v-responsive`); 1280×800 ľavá plocha `[640, 449, 3816, 750]`, plná plocha 3216×750,
     obrázok 3200×734; s obalom `<div>` obrázok v oboch oknách 3200×900 (výška už orezaná nie je).
   Šírka sa nezmenší ani so štýlom (plocha rastie na obsah), pomer strán rámčeka neostáva (pomer obrázka drží len
   `object-fit: contain`). S celým štýlom obal mení výšku obrázka (opravené v c5, Opus 4): pri 1280×800 je výška
   plochy skutočná (750 = 100dvh − 50 px panela) a obyčajný `<div>` obal zmenil obrázok z 734 px na 900 px, lebo
   `.v-responsive { max-height: 100% }` v obale bez výšky nemá voči čomu orezať; rozťahuje sa len šírka (3216–3816 px),
   výška nie. Prípad JS9 ostáva so stubom (rodič obrázka je flex a má rozmery celej ľavej plochy; obyčajný obal →
   červené). **Vedúci súhlasil** (9. 10.): skutočná geometria sa nepripína, lebo prostredie testu bez obalu aplikácie
   roztiahne plochu na šírku obsahu a geometria by viazala U6 na nereprezentatívne rozloženie; kontrolu výšky
   s `main.scss` nechce. **Medzera je prijatá, nie neškodná** (opravené v c5, Codex; zúžené v c6, Opus): plná
   plocha detailu má `pa-2` (8 px, `border-box`; `AssetDetailDialog.vue:201-204`), takže obal `w-100 h-100` v nej je
   o 16 px menší než `.dam-image-detail__left` a prípad (`assetDetailDialog.test.ts:322`, rámčeky sa porovnávajú
   presne) by zlyhal; prešiel by len flex obal, ktorý prevezme aj odsadenie plochy (napríklad plochu bez `pa-2` a obal
   s ním), hoci návrh 2.8 dáva obal len s prekrytím (odvodené z CSS, nespustené). Overí sa pohľadom v prehliadači
   (K-04 po U6: vedúci doplnil do plánu pohľad aj na detail so širokým obrázkom a na nález 64).

Behy cyklu 4 (cez `tezky.sh`, `--retry=0`): štyri súbory **140 / 140 zelených** dva razy po sebe (detail 54, miesta
14, riadok 18, jeden súbor 54). Prvý `lint:tsc` 2 chyby typov (rozšírenie `AssetFileLinks` je zjednotenie typov) →
`Object.assign` na odkazoch; potom kód 0. Ohnutia v pamäti (`bend-c4-*.json`), každé zvlášť:
- obal `<div class="position-relative">` → `<div>`: **presne 2 červené** (prípad prekrytia × 2; zlyhá `offsetParent`);
- `position-relative` z obalu na plnú plochu: **presne 2 červené** (to isté; zlyhá `offsetParent`);
- prekrytie v šablóne pred obrázkom: **presne 2 červené** (zlyhá poradie detí obalu);
- `UQDS:166-167` `width`/`height` namiesto `requested*`: **presne 1 červený** (stavy, CMS);
- `ADD:90-91` `requestedWidth`/`requestedHeight` namiesto `width`/`height`: **presne 2 červené** (CMS obrázok a
  obrázok bez dominantnej farby);
- bez `:asset-type` obrázka v `UQDS`: **presne 2 červené** (nový prípad typu × 2);
- bez `:asset-status`: **presne 4 červené** (nový prípad × 2 a prípad stavov × 2: stav riadku `draft` sa líšil od
  predvoleného `with_file` už predtým; slepý bol len typ).
`oxfmt --check`, `oxlint`, `eslint` (cez `tezky.sh`) na štyroch súboroch čisté, `lint:tsc` kód 0. Záplata
`bash …/zaplata.sh U0-L-c4` → `zaplaty/U0-L-c4.diff` (2 súbory v `src`; mimo `src` a `doc` nič). Počty: CK má mať
**298 / 3 719** (+2 oproti U0-L-c3).

**CK-LIB-T U0-L-c4 zelené** (`vysledky/U0-L-c4-ck.log`, `ck-kod=0`): 298 súborov / 3 719 testov, ako vyrátané.

## Cyklus 5 (posudok Codexu `impl/posudky/U0-L-c5-codex.md`, posudok Opusa vedúcemu)

Snímok `U0-L-c5` (kód 0) pred opravami. Nález 64 je overený v prehliadači; vlastník rozhodol opraviť ho v U6 (rámec
dá obalu rozmer), test U0-L tú opravu nesmie blokovať.

1. (Codex stredné, Opus 1, 2) Prípad prekrytia, teraz „draws the error of a refused file in the positioned box of the
   picture, after the picture": vypustené tvrdenia o medzičlánku plnej plochy (rodič obalu je priame dieťa ľavej
   plochy) a o jeho šírke, aj nadbytočné `overlay.parentElement` (vyplýva z detí obalu). Ostáva: `offsetParent`
   prekrytia je rodič obrázka a deti toho rodiča sú presne `[obrázok, prekrytie]`. Názov a komentár už netvrdia „len
   nad obrázkom" ani „obal nie je plná plocha"; komentár hovorí, že veľkosť obalu sa nepripína (nález 64, U6). Ak U6
   urobí umiestneným obalom samotnú plochu s obrázkom a prekrytím ako jedinými deťmi, prípad prejde.
2. (Codex nízke) Poznámka c4, B3: medzera JS9 prepísaná na „prijatá" (overí K-04), nie „neškodná".
3. (Opus 3) Poznámka c3, bod 3: dôvod „výška 0 pri `md-and-down`" označený ako vyvrátený sondou A (314 px = 35dvh
   pri otvorenom sidebare).
4. (Opus 4) Poznámka c4, B3: veta „obal mení len výšku a len pri roztiahnutom dialógu" opravená (výška je pri
   1280×800 skutočná; obal ju zmení z 734 na 900 px). Test sa nemení.

Behy cyklu 5 (cez `tezky.sh`, `--retry=0`): štyri súbory **140 / 140 zelených** dva razy po sebe. Ohnutia v pamäti
(`bend-c4-wrapper.json`, `bend-c4-order.json` znova nad zmeneným prípadom): obal bez `position-relative` **presne
2 červené**, prekrytie pred obrázkom **presne 2 červené** (prípad prekrytia × 2 profily). `oxfmt --check`, `oxlint`,
`eslint` (cez `tezky.sh`) čisté, `lint:tsc` kód 0. Záplata `bash …/zaplata.sh U0-L-c5` → `zaplaty/U0-L-c5.diff`
(1 súbor v `src`, `consumerProfileUploadDialogSingle.test.ts`; mimo `src` a `doc` nič). Počty: CK má mať **298 /
3 719** (bez zmeny počtu).

Prípady editora oblasti záujmu v `LT0/consumerProfileUploadDialogSingle.test.ts` (pre odkazy v návrhu a pláne, U6
stráže citujú staré `:252-275`): `describe('the editor of the region of interest')` `:412-450`; s právom a s iným
právom `it.each` `:424`, bez používateľa `:437` (CMS), UGC bez používateľa `:442`, ext system `:447`.

**CK-LIB-T U0-L-c5 zelené** (`vysledky/U0-L-c5-ck.log`, `ck-kod=0`): 298 súborov / 3 719 testov, ako vyrátané.

## Cyklus 6 (posudky vedúcemu)

Codex bez nálezu; Opus dve nízke veci len v poznámke (test sa nemenil, strom `lib-u` sa nemenil, snímok netreba):
(1) opis medzery JS9 v c4, B3 zúžený (plocha má `pa-2`, plný flex obal okolo stubu by prípad zhodil; prešiel by len
obal, ktorý prevezme odsadenie plochy; odvodené z CSS); (2) K-04 po U6 má v pláne aj detail so širokým obrázkom a
nález 64. Odkaz `:61-65` opravený na `image-detail.scss:63-67`.

## Zmenené súbory (4, všetky v `src`, len testy; štvrtý od cyklu c1, povolený vedúcim)

- nový `src/domains/dam/assetDetail/__tests__/assetDetailDialog.test.ts` (40 prípadov, po c1 52, po c2 52: −2 obal obrázka, +2 zápis do riadku frontu, po c3 54: +2 obrázok v celej ľavej
  časti, c4 bez zmeny počtu (požadovaná veľkosť odkazu iná než skutočná); oba profily): nadpis „Media
  Library: {názov}"; načítavanie a potom asset; zatvorenie (tlačidlom aj tlačidlom načítavania) vyčistí detail
  (`asset`, `dialog` `null`), ohlási `close` a dialóg zmizne (obal ako widget: `v-if="dialog === kľúč"`); prepínač
  sidebaru; vľavo: CMS obrázok z `image_detail` (rozmery, dominantná farba, typ, stav), po záložke Fókus editor a regióny,
  obrázok bez farby na `#ccc`, bez obrázka detailu 356×200 `#ccc`; UGC editor hneď, bez záložiek; video, audio a dokument:
  bez záložky Fókus, 356×200 `#ccc`; video so zastaranou záložkou Fókus: obrázok a záložka Info; editor: CMS s právom
  `dam_regionOfInterest_update` upraviteľný, s iným právom a bez používateľa len na čítanie, UGC (`/ugc/v1/roi`)
  upraviteľný bez používateľa; editor dostane ext system; `AssetInfobox`: nič, duplikát, zlyhané spracovanie s dôvodom
  (chip), bez súboru, mazanie; CMS panel súboru s id assetu a súboru a chipmi používateľov (vytvoril, zmenil), UGC bez
  panelu súboru. Montované naozaj okrem náhrad podľa mena, ako `LT0/consumerProfileUploadDialogSingle` (`AssetImage`,
  `DamAssetImageRoiSelectLazy`, `AssetDetailSidebarROI`, `AFormRemoteAutocompleteWithCached`; návrh 2.8: tieto náhrady
  po U6 platia).
- nový `src/domains/dam/imageWidget/__tests__/damImageSites.test.ts` (12 prípadov, po c1 14; oba profily): `AImagePublicInput`
  (IM8) vytvorí obrázok s orezanými textami, `position: 0`, bez `id`, `internal` z `mainFileInternal`, a model dostane
  nové id; uložený obrázok (načítaný podľa modelu) aktualizuje pod jeho id (`id` v tele, `showSource: true`,
  `regionPosition: 0`, `internal: false` pri `null`); náhľad (IM9) je originál súboru zadaného id aj adresou originálu,
  bez volania API obrázkov; `ImageDetailDialogMetadata` (IM7): obrázok média presne
  `{ texts prázdne, dam { damId, licenceId média, regionPosition 0, internal false }, flags { showSource false, … } }`
  (`toStrictEqual`: bez `position` a `id`) a adresa náhľadu `w500-h281`; médium bez súboru obrázka žiadny obrázok.
- `src/domains/dam/uploadQueue/__tests__/uploadQueueRowRefresh.test.ts`: nový `describe` s jedným prípadom (17 → 18):
  riadok namontovaný už `Uploaded`, bez metadát, s upozornením (`hasError`, text `readFailed` knižnice): upozornenie je
  vidieť, čaká sa 20 s, pred nimi ani „Obnoviť", ani kôš, po nich oba a „Obnoviť" ohlási `refreshItem` s `assetId`
  riadku. Import `AssetFileFailReason` a `commonT`; existujúce prípady bez zmeny.
- `src/domains/dam/__tests__/consumerProfileUploadDialogSingle.test.ts` (cyklus c1, povolil vedúci): jeden nový prípad
  CMS v „once the file is uploaded": panel „Info o súbore" dialógu jedného súboru láme ako karta (`break-word`, JS29);
  v c2 nový `describe('the picture of the file')` s dvoma prípadmi (stavy obrázka, prekrytie chyby) a v prípade
  rozloženia oblasti záujmu tvrdenia vlastností `AssetDetailSidebarROI` (rozšírené, nič nepovolené neubrané); v c3
  prípady obrázka prepísané (priebeh s hodnotami, zdroj, rozmery, farba, typ a stav; prekrytie so skutočným obrázkom
  a pravidlom `dam-upload-queue.scss`), `mountDialog(realPicture)`; v c4 prekrytie podľa štruktúry návrhu 2.8 (bez
  štýlu a geometrie), požadovaná veľkosť náhľadu, nový prípad typu a stavu riadku; ostatné existujúce prípady bez
  zmeny (47 → 48 → 52 → 54).

Počty: oproti `S0-lib-u-3` (296 súborov / 3 643 testov) +2 súbory, +53 testov: CK má mať **298 / 3 696**.

## Ohnuté súbory

Žiadne na disku. Všetky ohnutia v pamäti (bod 4); `cmp` netreba.

## Odchýlky od návrhu

1. **Objekt náhľadu IM9 (licencia 0, bez pozície) sa nedá pozorovať:** `updatePreviewAndTexts` ho podá len
   `widgetImageToDamImageOriginalUrl`, ktorá číta iba `dam.damId`. Test pripína to, čo z neho vyjde (adresa originálu
   pri zadanom id aj adrese) a že náhľad nevolá API obrázkov. Licenciu a pozíciu by ukázala len náhrada modulu
   (zakázané); zmena licencie či pozície v tom objekte (U7) sa preto ani nemôže prejaviť.
2. **Riadok RD12 je pripravený priamo v stave, ktorý N-Z21 tvrdí** (`Uploaded`, `canEditMetadata: false`,
   `error.hasError` s textom „dáta sa nepodarilo načítať"), nie behom vyrovnania: test riadku tak nezávisí od
   vyrovnania, ktoré menia K4 a K5. Text je ten, ktorý píše sklad knižnice (`commonT('common.damImage.uploadErrors.readFailed')`,
   `uploadQueuesStore.ts:129`), nie text prípravku N-Z21.
3. **Návrh 2.8 („detail dnes ukáže editor pri záložke Fókus bez ohľadu na typ, zachované") nesedí s tým, čo používateľ
   vidí:** záložka je v sklade detailu a otvorenie detailu ju nenastaví, ale pri assete, ktorý nie je obrázok, nemá
   `VTabs` záložku Fókus a vynútene vyberie prvú (Info). Detail videa otvorený po záložke Fókus obrázka teda ukáže
   obrázok a sklad má záložku Info (prvý beh to ukázal, `ADD:191-200` by sám editor ukázal). Prípad pripína to, čo
   používateľ vidí. Pre U6: adaptér z assetu s `roiEditorTab = true` je neškodný len preto, že záložky sidebaru sa
   vrátia na prvú; rámec sidebaru ich musí ponechať v tejto podobe (prípad to stráži, súbor 2 ohnutia).
4. Navyše oproti zoznamu 4.2: načítavanie (`loading`) a zatvorenie z neho (JS2, JS4 rámca), farba pozadia bez dominantnej
   farby, typ a stav podané obrázku, ext system podaný editoru, mazanie a „bez súboru" v `AssetInfobox`.
5. Chipy používateľov sú skutočné; používateľov do vyrovnávacej pamäte používateľov DAM vloží test tak, ako ich tam
   nechá zoznam assetov (`addManualToCachedUsers`); detail sám používateľov nepýta (`get` cache nič nenačíta).

## Zblíženia navyše

Žiadne (krok mení len testy).

## Nové nálezy (mimo zmeny; číslo pridelí vedúci)

Žiadne. (Bod 3 odchýlok je oprava vety návrhu, nie chyba kódu.)
