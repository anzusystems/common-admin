# S0-B, bod 9: citácie, ktoré posunuli opravy N32, N39-L a N39-D

Prepočet citácií `súbor:riadok` z plánu (`plan-implementacie.md`, verzia 9.3) a z oboch návrhov
(`navrh-jadro.md`, `navrh-komponenty.md`), ktoré ukazujú do súborov zmenených opravami. Zadania krokov citujú
odtiaľto (plán 2.0, „Riadky v návrhoch a v pláne"; 5.3, B9).

- **Staré** = stav, z ktorého citujú plán aj návrhy (LIB 18:46, DAM 18:36): snímok
  `/home/volar/projects/anzusystems/krok5-praca/snap/N32/src` (LIB pred N32; v zmenených súboroch zhodný s HEAD
  `03c3a108`) a `/home/volar/projects/anzusystems/krok5-praca/snap/N39-D/src` (DAM pred N39-D; zhodný s HEAD
  `9818e6b5`).
- **Nové** = pracovné stromy dnes: LIB `/home/volar/projects/anzusystems/common-admin/src` (posledná zmena 15:44,
  po N39-L-c1; CK 15:50), DAM `/home/volar/projects/anzusystems/admin-dam/src` (posledná zmena 13:13; CK 13:22).
- **Ako:** riadky zarovnané po celom súbore (starý → nový, `difflib`), každá citácia overená čítaním oboch strán;
  prípady testov podľa mena (`describe` › `it`/`it.each`); počty prípadov z JSON výstupov CK
  (`krok5-praca/vysledky/N32-lib-browser.json` = stav pred N39-L, `N39-L-c1-lib-browser.json`, `N39-D-dam.json`).
- **Dokumenty:** `plán` = `plan-implementacie.md`, `jadro` = `navrh-jadro.md`, `komp` = `navrh-komponenty.md`;
  riadok je riadok dokumentu, kde citácia stojí. Skratky ciest ako v návrhoch: `L/` = LIB `src/domains/dam/`,
  `D/` = DAM `src/domains/coreDam/`, `LT/`, `LT0/`, `LW/`, `DT/`; `L-aa` = LIB `api/damAssetApi.ts`,
  `D-aa` = DAM `asset/api/assetApi.ts`; `UQDS`, `UQDSS`, `UQDSM` = LIB
  `uploadQueue/components/UploadQueueDialogSingle.vue`, `…Sidebar.vue`, `…SidebarMetadata.vue`; `ADSM` = LIB
  `assetDetail/components/AssetDetailSidebarMetadata.vue`.
- **Stĺpec „nové":** `bez zmeny` = to isté číslo platí a ukazuje na to isté; samotné číslo = obsah zhodný, len
  posunutý; `(zmenené)` = tá istá funkcia alebo prípad na novom mieste, obsah upravila oprava; `zaniklo` = kód už nie
  je, náhrada v časti 4.

## 1. Súbory, ktoré opravy zmenili

Plán 2.0 vymenúva 14 súborov; opravy ich zmenili **21** (LIB 13 zmenených a 1 nový, DAM 7). Navyše oproti zoznamu
v pláne: LIB `LT0/support/fakeDam.ts`, `LT/uploadQueueDialogSingle.test.ts` (len náhrada
`showMetadataSaveError: vi.fn()`, `:45`), `L/uploadQueue/components/UploadQueueDialogSingleSidebar.vue` (vlastnosť
`saving`), `L/assetDetail/components/AssetDetailSidebarMetadata.vue` (nález 48), nový
`L/assetDetail/__tests__/consumerProfileAssetDetailSave.test.ts` (16 prípadov); DAM
`D/asset/components/detail/components/AssetDetailSidebarMetadata.vue`,
`D/asset/components/list/components/AssetListSidebarMetadata.vue` (nález 48). Riadky z dokumentov ukazujú do 18
z nich; do `LT0/support/fakeDam.ts`, nového testu a `DT/asset/bulkMetadata.test.ts` necituje žiadny riadok
(`DT/support/fakeDam.ts:353-365`, `:386` v jadre je súbor DAM, opravy sa ho nedotkli).

## 2. Citácie podľa krokov

### 2.1 K (jadro)

| dokument:riadok citácie | súbor | staré | nové | čo to je (meno prípadu alebo funkcie) |
|---|---|---|---|---|
| jadro:391 (A19) | `L-aa` | `:61-76` | `:64-79` | `fetchAsset` |
| jadro:391 (A19) | `D-aa` | `:171` | `:168` | `fetchAsset` |
| jadro:392 (A20) | `L-aa` | `:153-190` | `:141-178` | `fetchAssetListByIds` |
| jadro:392 (A20) | `D-aa` | `:143-158` | `:140-155` | `fetchWaitingAssets` |
| jadro:394 (A22) | `L-aa` | `:90-100` | `:93-103` | `fetchAssetByFileId` |
| plán:514 (K6) | `DT/queue/overlaySave.test.ts` | `:510-520` | `:592-602` | „the overlay of the assets picked for mass edit › its close button › asks first, then empties the queue, unticks the assets and hides the overlay, saving nothing" (jediný `nextTick` po vyčistení) |
| plán:729 (K6, stráže) | `overlaySave.test.ts` | `:510-520` | `:592-602` | ten istý prípad |
| jadro:997 (2.4, pravidlo 5) | `DT/queue/overlaySave.test.ts` | `:510-520` | `:592-602` | ten istý prípad |
| jadro:1639 (R4) | `DT/queue/overlaySave.test.ts` | `:510-520` | `:592-602` | ten istý prípad |

### 2.2 F

| dokument:riadok citácie | súbor | staré | nové | čo to je (meno prípadu alebo funkcie) |
|---|---|---|---|---|
| jadro:73 (Z26, PV13; F4) | `UploadQueueDialogSingle.vue` | `:448-453` | `:464-469` | prekrytie chyby: text `item.error.message`, inak `AssetFileFailReasonChip` |
| jadro:1720 (Z26; F4) | `UploadQueueDialogSingle.vue` | `:448-453` | `:464-469` | to isté |
| jadro:1611 (PV9; F5) | `asset/components/footer/AssetFooterSelectedFull.vue` | `:198` | `:202` | `disable-done-animation` fronty hromadnej úpravy |
| jadro:1719 (Z25) | `asset/components/footer/AssetFooterSelectedFull.vue` | `:198` | `:202` | to isté |
| plán:519 (F-C) | `L/assetDetail/components/AssetDetailSidebarMetadata.vue` | `:48-90` | bez zmeny `:48-90` | `onSave` a šablóna (obsah záložky „Info"); v rozsahu oprava 48 zmenila `:64` na `showMetadataSaveError(error, props.extSystem)` |
| plán:1040 (F-C) | `L/assetDetail/components/AssetDetailSidebarMetadata.vue` | `:48-90` | bez zmeny `:48-90` | to isté |
| komp:1251 (49, F-C) | `L/assetDetail/components/AssetDetailSidebarMetadata.vue` | `:48-90` | bez zmeny `:48-90` | to isté |
| plán:517 (50) | `AssetFooterSelectedFull.vue` | `:62-79` | `:66-83` (zmenené) | `onSave` pravého panela hromadnej úpravy; catch `:78-80` dnes `showMetadataSaveError(error)` |
| plán:519 (50) | `D/asset/components/detail/components/AssetDetailSidebarMetadata.vue` (v pláne len `:60-62`) | `:60-62` | bez zmeny `:60-62` | `if (view.value === 'queue') uploadQueueStore.updateAssetMetadata(…)` v `onSave` |
| plán:519 (50) | `D/asset/components/list/components/AssetListSidebarMetadata.vue` (v pláne len `:62-86`) | `:62-86` | bez zmeny `:62-86` | `onSave` pravého panela; v rozsahu `:82` dnes `showMetadataSaveError(error)` |
| plán:1049 (F-B, 50) | `AssetDetailSidebarMetadata.vue` (DAM) | `:60-62` | bez zmeny `:60-62` | to isté ako plán:519 |
| plán:1049 (F-B, 50) | `AssetListSidebarMetadata.vue` | `:62-86` | bez zmeny `:62-86` | to isté ako plán:519 |
| plán:1049 (F-B, 50) | `D/asset/components/footer/AssetFooterSelectedFull.vue` | `:62-79` | `:66-83` (zmenené) | to isté ako plán:517 |
| jadro:1392 (F-B, 50) | `AssetDetailSidebarMetadata.vue` (DAM) | `:60-62` | bez zmeny `:60-62` | to isté ako plán:519 |
| jadro:1392 (F-B, 50) | `AssetListSidebarMetadata.vue` | `:62-86` | bez zmeny `:62-86` | to isté ako plán:519 |
| jadro:1392 (F-B, 50) | `asset/components/footer/AssetFooterSelectedFull.vue` | `:62-79` | `:66-83` (zmenené) | to isté ako plán:517 |

### 2.3 U

| dokument:riadok citácie | súbor | staré | nové | čo to je (meno prípadu alebo funkcie) |
|---|---|---|---|---|
| komp:769 (U1, U5a) | `AssetFooterUploadOverlayFull.vue` | `:239-244` | `:243-248` | `<AssetFooterUploadButtonStop data-cy="button-close" …>` |
| plán:515 (U6) | `LT0/consumerProfileUploadDialogSingle.test.ts` | `:252-275` | `:266-289` | describe „the editor of the region of interest" a jeho prípad `'%s'` (len CMS): „can be edited by a user of the DAM who may update regions of interest", „only shows the image to a user of the DAM without that grant" |
| plán:811 (U6, stráže) | `LT0/consumerProfileUploadDialogSingle` | `:252-275` | `:266-289` | to isté |
| komp:1152 (U6) | `LT0/consumerProfileUploadDialogSingle` | `:252-275` | `:266-289` | to isté |
| komp:1335 (R-K7) | `LT0/consumerProfileUploadDialogSingle.test.ts` | `:252-275` | `:266-289` | to isté |
| komp:1335 (R-K7) | `UQDS` | `:406` | `:422` | `:readonly="!roiEditable"` |
| komp:221 (0.1, R16) | `UploadQueueDialogSingle.vue` | `:82-127` | `:87-132` | computed `asset` (vymyslený `AssetDetailItemDto`) |
| komp:473 (JS1) | `UQDS` | `:326-396` | `:342-412` | `VDialog` po koniec `VToolbar` |
| komp:474 (JS2) | `UQDS` | `:331-334` | `:347-350` | načítavanie (`loading`, alebo riadok chýba) |
| komp:475 (JS3) | `UQDS` | `:347-360` | `:363-376` | nadpis „Nahrávanie" / „Nahrávanie ukončené" |
| komp:476 (JS4) | `UQDS` | `:389-394,219-223` | `:405-410,224-228` | `UploadQueueButtonStop` v paneli; `onStopConfirm` |
| komp:477 (JS5) | `UQDS` | `:362` | `:378` | `<div class="pr-3">` |
| komp:478 (JS6) | `UQDS` | `:399-408` | `:415-424` | editor oblasti záujmu vľavo (`enableRoiTab`) |
| komp:479 (JS7) | `UQDS` | `:157-177` | `:162-182` | computed `imageProperties` |
| komp:480 (JS8) | `UQDS` | `:414-430` | `:430-446` | obrázok so stavmi uploadu, percentami a pomerom 16:9 |
| komp:481 (JS9) | `UQDS` | `:413` | `:429` | `<div class="position-relative">` |
| komp:482 (JS10) | `UQDS` | `:431-461` | `:447-477` | prekrytie chyby nad obrázkom |
| komp:484 (JS12) | `UQDS` | `:82-127` | `:87-132` | computed `asset` |
| komp:485 (JS13) | `UQDS` | `:305-318` | `:321-334` | `watch`: načítanie assetu po dokončení, potom „Fókus" |
| komp:486 (JS14) | `UQDS` | `:320-322` | `:336-338` | `onMounted`: záložka „Info" |
| komp:487 (JS15) | `UQDSS` | `:109-115` | `:112-118` | `VTab` „Fókus" |
| komp:488 (JS16) | `UQDSS` | `:58` | `:61` | computed `simpleMode` |
| komp:489 (JS17) | `UQDS` | `:486-499` | `:503-516` | slot `#prepend-sidebar` (oznam duplikátu, „Jednorazová licencia") |
| komp:491 (JS19) | `UQDSS` | `:135-175` | `:139-180` (zmenené) | obsah „Fókus" a cieľ teleportu tlačidiel; pribudol `:saving="saving"` (`:160`) |
| komp:492 (JS20) | `UQDSS` | `:60-88` | `:63-91` | „Obnoviť": `waitsFor`, čakanie, `refresh` |
| komp:494 (JS22) | `LT/uploadQueueDialogSingle.test.ts` | `:172-186` | `:173-187` | `mountSidebar` (vlastnosti, ktoré podá dialóg) v describe „the sidebar of the single-file upload dialog" |
| komp:495 (JS23) | `ADSM` | `:48-68` | bez zmeny `:48-68` | `onSave` detailu; v rozsahu `:64` dnes `showMetadataSaveError(error, props.extSystem)` |
| komp:495 (JS23) | `UQDSM` | `:70-100` | `:73-105` (zmenené) | `AssetDetailSidebarActionsWrapper` s tlačidlami „Obnoviť", „Uložiť", „Uložiť a použiť"; pribudli `:loading` a `:disabled` podľa `saving` |
| komp:495 (JS23) | `UQDS` | `:253-303` | `:261-319` (zmenené) | `onSave`, `onSaveAndApply`; pred nimi nový `saving` (`:258-259`) |
| komp:496 (JS24) | `ADSM` | `:44` | bez zmeny `:44` | `useVuelidate({ …, $stopPropagation: true })` |
| komp:496 (JS24) | `UQDSM` | `:46` | `:49` | `useVuelidate({ $scope })` |
| komp:503 (JS31) | `UQDS` | `:212-216,406` | `:217-221,422` | `roiUpdateAcl`, `roiEditable`; `:readonly` |
| komp:846 (2.8, kód) | `UQDS` | `:82-204` | `:87-209` | od computed `asset` po výpočty obrázka (komentár `assetDetailViewOfUploadItem`) |
| komp:856 (2.8) | `UQDS` | `:82-84,135-142` | `:87-89,140-147` | `asset` bez riadku; typ, stav a `mainFile` z detailu |
| komp:859 (2.8) | `UQDS` | `:202-204,427` | `:207-209,443` | percentá a zvyšný čas |
| komp:880 (2.8, kód) | `UQDS` | `:212-216` | `:217-221` | `roiEditable` |
| komp:896 (2.8) | `UQDS` | `:253-303` | `:261-319` (zmenené) | ukladanie (`onSave`, `onSaveAndApply`, `saving` `:258-259`) |
| komp:902 (2.8) | `LT/uploadQueueDialogSingle.test.ts` | `:172-196` | `:173-197` | `mountSidebar` (montuje `UQDSS`) |
| komp:903 (2.8) | `LT/uploadQueueDialogSingle.test.ts` | `:499` | `:500` | `$emit(event)` v „sends the single-use switch of the item on %s" |
| komp:1408 (ZK23) | `L/uploadQueue/components/UploadQueueDialogSingle.vue` | `:362` | `:378` | `<div class="pr-3">` |
| komp:516 (IM4; U7) | `L/imageWidget/components/ImageWidgetMultipleInner.vue` | `:293-315` | `:294-316` | `assetSelectConfirmMap`, vlastné mapovanie aplikácie |
| komp:517 (IM5; U7) | `ImageWidgetMultipleInner.vue` | `:325-347` | `:326-348` | `assetSelectConfirmMap`, predvolené mapovanie |
| komp:518 (IM6; U7) | `ImageWidgetMultipleInner.vue` | `:545-555` | `:546-556` | `createImageStoreItem` |

### 2.4 Nálezy (plán 2.9, komponenty 4.5 a 5.2)

| dokument:riadok citácie | súbor | staré | nové | čo to je (meno prípadu alebo funkcie) |
|---|---|---|---|---|
| komp:1030 (20, N20V) | `ImageWidgetMultipleInner.vue` | `:354-363` | `:355-364` | kópia do licencie v `onAssetSelectConfirm` |
| plán:1031 (25) | `UploadQueueDialogSingleSidebar.vue` | `:59-88` | `:62-91` | „Obnoviť" (`waitsFor`, `refresh`) |
| plán:1031 (25) | `LT/uploadQueueDialogSingle.test.ts` | `:328-348` | `:329-349` | „says nothing when the refresh itself fails the item, and no longer offers it" |
| plán:1031 (25) | `LT/uploadQueueDialogSingle.test.ts` | `:347` | `:348` | `expect(refreshButton().exists()).toBe(false)` v tom istom prípade |
| plán:1031 (25) | `LT/uploadQueueDialogSingle.test.ts` | `:401-412` | `:402-413` | „does not offer it for an item that %s" (riadok „has failed") |
| komp:1238 (25) | `L/uploadQueue/components/UploadQueueDialogSingleSidebar.vue` | `:59-88` | `:62-91` | to isté ako plán:1031 |
| komp:1238 (25) | `LT/uploadQueueDialogSingle.test.ts` | `:328-348` | `:329-349` | to isté ako plán:1031 |
| komp:1238 (25) | `LT/uploadQueueDialogSingle.test.ts` | `:347` | `:348` | to isté ako plán:1031 |
| komp:1238 (25) | `LT/uploadQueueDialogSingle.test.ts` | `:346` | `:347` | `expect(showWarningT).not.toHaveBeenCalled()` v tom istom prípade |
| komp:1238 (25) | `LT/uploadQueueDialogSingle.test.ts` | `:401-412` | `:402-413` | to isté ako plán:1031 |
| plán:1036 (30) | `ImageWidgetMultipleInner.vue` | `:197-204` | `:198-205` | `onFileInput` |
| komp:1239 (30) | `ImageWidgetMultipleInner.vue` | `:197-204` | `:198-205` | `onFileInput` |
| plán:515 (31) | `UploadQueueDialog.vue` | `:130-140` | `:141-151` | `storeItems` v `onSaveAndApply` (`maxPosition.value++`) |
| plán:515 (31) | `consumerProfileImageWidgetMultipleUpload.test.ts` | `:329-331` | `:338-340` | `[1, 2, 5, 6]` v „"save and apply" of its queue dialog › adds an image of each uploaded file after the images the widget has, closes the dialog and empties the queue" |
| plán:1037 (31) | `ImageWidgetMultipleInner.vue` | `:404-416` | `:405-417` | `onAssetUploadConfirm` |
| plán:1037 (31) | `UploadQueueDialog.vue` | `:130-140` | `:141-151` | to isté ako plán:515 |
| plán:1037 (31) | `LW/consumerProfileImageWidgetMultipleUpload.test.ts` | `:329-331` | `:338-340` | to isté ako plán:515 |
| komp:1240 (31) | `L/imageWidget/components/ImageWidgetMultipleInner.vue` | `:404-416` | `:405-417` | `onAssetUploadConfirm` |
| komp:1240 (31) | `L/uploadQueue/components/UploadQueueDialog.vue` | `:130-140` | `:141-151` | to isté ako plán:515 |
| komp:1240 (31) | `LW/consumerProfileImageWidgetMultipleUpload.test.ts` | `:329-331` | `:338-340` | to isté ako plán:515 |
| komp:1301 (31) | `UploadQueueDialog.vue` | `:130-139` | `:141-150` | `storeItems` v `onSaveAndApply` |
| komp:1301 (31) | `ImageWidgetMultipleInner.vue` | `:404-418` | `:405-419` | `onAssetUploadConfirm` |
| komp:1302 (32) | `ImageWidgetMultipleInner.vue` | `:446-462` | `:447-463` (zmenené) | cyklus autorov v `saveImages`; nález 32 je opravený v N32 (`:451`), riadok tabuľky 5.2 „opraviť samostatne pred krokom 5" je hotový |
| plán:516 (36) | `damAssetApi.ts` | `:230` | `:260` | `mainFileSingleUse:` v `listItemsToMetadataBulkItems` |
| plán:516 (36) | `consumerProfileImageWidgetMultipleUpload.test.ts` | `:421-428` | `:430-437` | telo `bulkUpdateImages` v „the save of the widget › writes the images, old and new, through the image API of the application, and hands the form their ids" |
| plán:517 (36) | `LT0/damAssetApiBulkMetadata.test.ts` | `:99-106` | `:115-122` | „the bulk save of the metadata of a queue › sends the single-use switch of a row also when it %s" |
| plán:1038 (36) | `LT0/damAssetApiBulkMetadata.test.ts` | `:99-106` | `:115-122` | to isté |
| komp:1241 (36) | `L/api/damAssetApi.ts` | `:230` | `:260` | to isté ako plán:516 |
| komp:1241 (36) | `consumerProfileImageWidgetMultipleUpload.test.ts` | `:421-428` | `:430-437` | to isté ako plán:516 |
| komp:1241 (36) | `LT0/damAssetApiBulkMetadata.test.ts` | `:99-106` | `:115-122` | to isté ako plán:517 |
| plán:363 (43) | `DT/queue/overlaySave.test.ts` | `:329,361` | `:397,429` | `dialogButton('Close')` v „the overlay of the uploads › its close button › empties the queue and hides the overlay at once when every row is settled, and saves nothing" a „… › asks first while an upload is under way, and stops the uploads when the answer is yes" |
| plán:514 (43) | `overlaySave.test.ts` | `:329` | `:397` | prvý z nich |
| plán:514 (43) | `overlaySave.test.ts` | `:361` | `:429` | druhý z nich |
| komp:1236 (43) | `DT/queue/overlaySave.test.ts` | `:329,361` | `:397,429` | to isté ako plán:363 |
| komp:1236 (43) | `overlaySave` | `:106` | `:126` | otvárajúce tlačidlo `close: () => buttonsNamed(toolbar, 'Close')[0]` v `mountOverlay` (ostáva) |
| plán:1024 (44) | `LT/uploadQueueDialogSingle.test.ts` | `:436-447` | `:437-448` | „offers the author conflicts of the item" |
| komp:1233 (44) | `LT/uploadQueueDialogSingle.test.ts` | `:436-447` | `:437-448` | to isté |
| komp:1292 (47) | `UQDSS` | `:63` | `:66` | `const uploadQueuesStore = …`; prvá položka fronty (`item = …[0]`) je o riadok nižšie: pred opravami `:64`, dnes `:67` |

### 2.5 Opravy pred krokom 5 (plán 2.1; kroky sú uzavreté, citácie opisujú stav pred nimi)

| dokument:riadok citácie | súbor | staré | nové | čo to je (meno prípadu alebo funkcie) |
|---|---|---|---|---|
| plán:538 (N32) | `L/imageWidget/components/ImageWidgetMultipleInner.vue` | `:450` | `:451` (zmenené) | podmienka zápisu autorov v `saveImages`; dnes s `&& image.damAuthors.length > 0` |
| plán:539 (N32b) | `ImageWidgetMultipleInner.vue` | `:478` | `:479` | `assetId: undefined` v `items` po `bulkUpdateImages` (`saveImages`; nezmenené) |
| plán:539 (N32b) | `ImageWidgetMultipleInner.vue` | `:495` | `:496` (zmenené) | `assetId:` v `getUpdatedItem`; dnes `matchedImage ? matchedImage.assetId : item.assetId` |
| plán:543 (N32) | `consumerProfileImageWidgetMultipleUpload.test.ts` | `:434-447` | `:443-446` (zmenené) | tvrdenie zápisu autorov v „the save of the widget › writes the images, old and new, …"; otočené na „žiadny PATCH" (`toEqual([])`) |
| plán:546 (N32, stráž) | `consumerProfileImageWidgetMultipleUpload.test.ts` | `:453-476` | `:452-475` | „first saves the authors picked in a row into the asset of the DAM, with their names as the source of the image" (len CMS) |
| plán:555 (N39-L) | `L/api/damAssetApi.ts` | `:102-132` | `:105-120` (zmenené) | `bulkUpdateAssetsMetadata`: dnes `async`, `useMetadataBulkUpdate` a `saveMetadataInBatches` |
| plán:555 (N39-L) | `L/api/damAssetApi.ts` | `:195-211` | zaniklo | `updateMetadataSequence` (časť 4) |
| plán:556 (N39-L) | `L/api/damAssetApi.ts` | `:354-392` | zaniklo | `updateAuthorsSequence` a telo `bulkUpdateAssetsAuthors` (časť 4) |
| plán:556 (N39-L) | `L/uploadQueue/components/UploadQueueDialog.vue` | `:106-108` | `:112-113` (zmenené) | catch v `onSave`: `console.error` preč, `showMetadataSaveError(error, props.extSystem)` |
| plán:557 (N39-L) | `UploadQueueDialog.vue` | `:142-144` | `:153-156` (zmenené) | vonkajší catch `onSaveAndApply` (`showErrorsDefault` už len pre mapovanie, s komentárom); hláška uloženia vo vnútornom catch `:133-136` |
| plán:557 (N39-L) | `UploadQueueDialogSingle.vue` | `:258-260` | `:267-271` (zmenené) | catch a nový `finally` (`saving`) v `onSave` |
| plán:557 (N39-L) | `UploadQueueDialogSingle.vue` | `:300-302` | `:313-318` (zmenené) | vonkajší catch a nový `finally` v `onSaveAndApply`; hláška uloženia vo vnútornom catch `:284-287` |
| plán:558 (N39-L) | `UploadQueueDialogSingleSidebarMetadata.vue` | `:82-99` | `:85-104` (zmenené) | tlačidlá „Uložiť" (`:loading`, `:disabled` `:89-90`) a „Uložiť a použiť" (`:99-100`) |
| plán:559 (N39-L) | `LT0/consumerProfileUploadDialogActions.test.ts` | `:245-265` | `:259-276` (zmenené) | „"save" › says nothing when the DAM refuses the save: …", dnes „says the save failed when the DAM refuses it: the button stops spinning, and can be pressed again"; nové vedľa: „says the user may not, when the DAM forbids the save" `:278-285`, „names the fields the DAM refuses as the form of the rows does, each once" `:289-319` |
| plán:559 (N39-L) | `LT0/consumerProfileUploadDialogActions.test.ts` | `:366-381` | `:419-432` (zmenené) | „"save and apply" › hands over nothing when the DAM refuses the save, and says nothing", dnes „…, and says the save failed"; nové (len UGC) „says nothing of the save when the map of the application fails after it" `:437-449` |
| plán:560 (N39-L) | `LT0/consumerProfileUploadDialogSingle.test.ts` | `:400-421` | `:414-430` (zmenené) | „"save and apply" › hands over nothing, keeps the dialog and says nothing when the DAM %s", dnes „… says the save failed when the DAM %s"; nové: (len UGC) „says only that the save succeeded when the map of the application fails after it" `:435-448`, v „"save"" `:472-543` |
| plán:562 (N39-L) | `LT0/damAssetApiBulkMetadata.test.ts` | `:164-173` | `:180-189` | „is refused when a request is answered with %s" (obsah bez zmeny, ako plán chcel) |
| plán:565 (N39-L, 48) | `L/api/damAssetApi.ts` | `:285-290` | zaniklo | `.then` v `updateAssetMetadata` (časť 4) |
| plán:565 (N39-L, 48) | `L/api/damAssetApi.ts` | `:296-298` | zaniklo | vetva 422 v `.catch` `updateAssetMetadata` (časť 4) |
| plán:572 (N39-D) | `D/asset/api/assetApi.ts` | `:228-265` | zaniklo | `updateMetadataSequence` a telo `bulkUpdateAssetsMetadata` (časť 4) |
| plán:573 (N39-D) | `D/asset/components/footer/AssetFooterUploadOverlayFull.vue` | `:87-89` | `:91-93` (zmenené) | catch v `onSave`: `showMetadataSaveError(error)` |
| plán:573 (N39-D) | `AssetFooterUploadOverlayFull.vue` | `:108-110` | `:112-114` (zmenené) | catch v `onSaveAndClose` |
| plán:573 (N39-D) | `AssetFooterSelectedFull.vue` | `:74-76` | `:78-80` (zmenené) | catch v `onSave` |
| plán:574 (N39-D) | `AssetFooterSelectedFull.vue` | `:94-96` | `:98-100` (zmenené) | catch v `onSaveAndClose` |
| plán:576 (N39-D) | `DT/queue/overlaySave.test.ts` | `:253-271` | `:273-290` (zmenené) | „the overlay of the uploads › its save button › keeps the queue, reads no list and says nothing when the save fails: %s", dnes „… says why when the save fails: %s"; nové vedľa: „says why a later batch failed, the batches before it sent and the queue kept" `:294-314`, „names each refused field once, by the asset of the batch it belongs to" `:316-339` |
| plán:576 (N39-D) | `overlaySave.test.ts` | `:304-318` | `:372-386` (zmenené) | „… › its "save and finish" button › keeps the queue and the overlay, and says nothing, when the save fails: %s", dnes „…, and says why, …" |
| plán:576 (N39-D) | `overlaySave.test.ts` | `:492-503` | `:575-585` (zmenené) | „the overlay of the assets picked for mass edit › its "save and finish" button › keeps them all, and says nothing, when the save fails: %s", dnes „…, and says why, …"; nové „… › its save button › keeps them all, and says why, when the save fails: %s" `:535-548` |
| plán:577 (N39-D) | `overlaySave.test.ts` | `:63-68` | `:71-75` (zmenené) | riadok `'a validation error'` zoznamu `refusals`; kľúč dnes `'[0].customData.title'`, tretí stĺpec je hláška |
| plán:580 (N39-D, 48) | `D/asset/api/assetApi.ts` | `:317-331` | zaniklo | `.then` a `.catch` v `updateAssetMetadata` (časť 4) |

## 3. Počty prípadov a veľkosti súborov

| dokument:riadok citácie | čo | staré | nové | zdroj, poznámka |
|---|---|---|---|---|
| plán:514, plán:810, komp:1189 | `LT0/consumerProfileUploadDialogSingle` | 34 | **47** | CK N32 / CK N39-L-c1 (JSON) |
| komp:1182 | `LT0/consumerProfileUploadDialogActions` | 22 | **27** | to isté; 13 prípadov pod oboma profilmi, jeden len pod UGC |
| komp:1184 | `DT/queue/overlaySave` | 30 | **43** | CK N39-D (JSON) |
| plán:576 | „9 prípadov `:253-271`, `:304-318`, `:492-503`" | 9 (3 × 3 odpovede) | **15** (3 × 5 odpovedí: 500, 403, 422, 204, vypršanie) | pribudlo navyše 7: „its save button" hromadnej úpravy (5) a dva prípady „its save button" prekrytia uploadov |
| plán:810, komp:1189, komp:135, komp:1356 | `LT/uploadQueueDialogSingle` | 21 | 21 | bez zmeny (súbor zmenený len o náhradu `:45`) |
| komp:1177, jadro:1361, jadro:1497, jadro:1564 | vlna 4 knižnice | 12 súborov, 261 prípadov | **12 súborov, 286** | `consumerProfileUploadDialogActions` +5, `consumerProfileUploadDialogSingle` +13, `consumerProfileImageWidgetMultipleUpload` 16 → 23 (+3 N32, +4 N39-L) |
| komp:1177, jadro:1364, jadro:1530, jadro:1564 | vlna 4 admin-dam | 10 súborov, 201 prípadov | **10 súborov, 214** | `overlaySave` +13; „200 z 201 očervenelo" je záznam ohýbania z 18:32, neprepočítava sa |
| jadro:27, jadro:1361 | celá sada LIB (`test:browser`) | 295 súborov, 3 565 testov | **296 súborov, 3 643 testov** | CK-LIB po N39-L-c1 (15:50); nový súbor `L/assetDetail/__tests__/consumerProfileAssetDetailSave.test.ts` (16) |
| jadro:27 | celá sada DAM | 67 súborov, 1 153 testov | **67 súborov, 1 205 testov** | CK-DAM po N39-D (13:22) |
| plán:1449, plán:1452 (5.2) | ranné čísla | 295 / 3 565, 67 / 1 153 | ostávajú | plán ich drží na porovnanie; nové čísla patria do stĺpca „Východisko (S0-B)" (5.3, B2) |
| komp:465 (1.10) | `UploadQueueDialogSingle.vue` (`UQDS`), riadkov | 506 | **523** | `wc -l` |
| komp:466 (1.10) | `UploadQueueDialogSingleSidebar.vue` (`UQDSS`) | 178 | **183** | |
| komp:466 (1.10) | `AssetDetailSidebarMetadata.vue` (`ADSM`) | 90 | 90 | bez zmeny |
| komp:467 (1.10) | `UploadQueueDialogSingleSidebarMetadata.vue` (`UQDSM`) | 106 | **111** | |

## 4. Citácie bez náprotivku

### 4.1 Kód zanikol (6)

| dokument:riadok citácie | súbor | staré | čo tam bolo | čo to nahradilo (nové riadky) |
|---|---|---|---|---|
| plán:555 | `L/api/damAssetApi.ts` | `:195-211` | `updateMetadataSequence`: dávky po desať cez `client().patch`, odpovede bez kontroly | `metadataBulkUpdate` `:184-191` (úspech len 200, `validateStatus` `:190`), `useMetadataBulkUpdate` `:194-195` (s odpoveďou, `useApiFetchItems`), `useMetadataBulkCommand` `:198-199` (bez odpovede, `useApiCommand`), `AssetMetadataValidationError` `:207-216`, `saveMetadataInBatches` `:222-241` (zlyhaná dávka zastaví ďalšie) |
| plán:556 | `L/api/damAssetApi.ts` | `:354-392` | `updateAuthorsSequence` (`:354-366`) a `bulkUpdateAssetsAuthors` ako `Promise` (`:368-392`) | `bulkUpdateAssetsAuthors` `:403-410` (`useMetadataBulkCommand` a `saveMetadataInBatches`); hlášku ukáže widget (`ImageWidgetMultipleInner.vue`, catch v `saveImages`, `showMetadataSaveError`) |
| plán:565 | `L/api/damAssetApi.ts` | `:285-290` | `.then` v `updateAssetMetadata`: `resolve` pri 200, inak `reject()` bez dôvodu | `updateAssetMetadata` `:337-355`: `useMetadataBulkCommand` a `saveMetadataInBatches` `:353-354`; iná odpoveď než 200 je chyba cez `validateStatus` `:190` |
| plán:565 | `L/api/damAssetApi.ts` | `:296-298` | vetva 422: `handleMetadataValidationError` (hláška v API) a `reject(new AnzuApiValidationError…)` | 422 hádže `saveMetadataInBatches` ako `AssetMetadataValidationError` (`:233-236`); hlášku ukáže raz volajúci cez `showMetadataSaveError` `:293-308` (detail `ADSM:64`). `handleMetadataValidationError` ostáva `:310-334` pre `updateAssetAuthors` (`:384`) |
| plán:572 | `D/asset/api/assetApi.ts` | `:228-265` | `updateMetadataSequence` (`:228-242`) a `bulkUpdateAssetsMetadata` ako `Promise` (`:244-265`) | `useUpdateMetadataBulk` `:226-235` (úspech len 200), `AssetMetadataValidationError` `:239-246`, `metadataFieldName` `:248-265`, `withNamedFields` `:270-285`, `bulkUpdateAssetsMetadata` `:287-301`; hláška `showMetadataSaveError` `:306-312` |
| plán:580 | `D/asset/api/assetApi.ts` | `:317-331` | `.then` so stavom a `.catch` s triedami chýb a `handleMetadataValidationError` v `updateAssetMetadata` | `updateAssetMetadata` `:314-338`: `useUpdateMetadataBulk` a `withNamedFields` `:332-337`; hlášku dáva volajúci cez `showMetadataSaveError` (detail `AssetDetailSidebarMetadata.vue:65`, panel `AssetListSidebarMetadata.vue:82`) |

### 4.2 Prepísané opravou, vec na novom mieste existuje

Riadky s `(zmenené)` v časti 2. Okrem ôsmich, v ktorých oprava zmenila len jeden riadok rozsahu alebo pridala
vlastnosť (`AssetFooterSelectedFull.vue:62-79` trikrát, `UQDSS:135-175`, `UQDSM:70-100`, `UQDS:253-303` dvakrát,
`ImageWidgetMultipleInner.vue:446-462`), sú to ciele samotných opráv z plánu 2.1: N32 `:450`, `:495`,
`consumerProfileImageWidgetMultipleUpload.test.ts:434-447`; N39-L `damAssetApi.ts:102-132`,
`UploadQueueDialog.vue:106-108`, `:142-144`, `UploadQueueDialogSingle.vue:258-260`, `:300-302`,
`UploadQueueDialogSingleSidebarMetadata.vue:82-99`, `consumerProfileUploadDialogActions.test.ts:245-265`,
`:366-381`, `consumerProfileUploadDialogSingle.test.ts:400-421`; N39-D `AssetFooterUploadOverlayFull.vue:87-89`,
`:108-110`, `AssetFooterSelectedFull.vue:74-76`, `:94-96`, `overlaySave.test.ts:253-271`, `:304-318`, `:492-503`,
`:63-68`. Šesť prípadov testov pritom dostalo nové meno (`consumerProfileUploadDialogActions` dva,
`consumerProfileUploadDialogSingle` jeden, `overlaySave` tri); nové mená sú v tabuľke 2.5.

## 5. Poznámky pre zadania

- **U6:** dialóg jedného súboru má od N39-L vlastnosť `saving` (`UQDS:259`, podáva ju `:499`; `UQDSS` ju prijíma
  `:38-39` a podáva `UQDSM` `:133`, `:160`; `UQDSM` `:23-24`, `:89-90`, `:99-100`). Veta komponentov 2.8 „mená
  komponentov, ich vlastnosti a udalosti ostávajú" platí s touto vlastnosťou navyše; rámec sidebaru ju musí
  podať ďalej. Stráž `LT/uploadQueueDialogSingle` (21) je „bez zmeny" voči stavu po opravách (náhrada
  `showMetadataSaveError` `:45`).
- **F-C a nález 50:** všetky ich citácie (`ADSM:48-90`, DAM `AssetDetailSidebarMetadata.vue:60-62`,
  `AssetListSidebarMetadata.vue:62-86`) platia číslom; zmenil sa len riadok catch v rozsahu. Posunulo sa len
  `AssetFooterSelectedFull.vue:62-79` → `:66-83` (o 4, nový import).
- **Nález 47:** `UQDSS:63` už v pôvodnom stave ukazoval na `useUploadQueuesStore()`; prvá položka fronty je
  `:64`, dnes `:67`.
- Plán 2.0 uvádza pri nálezoch 50 len `:60-62` a `:62-86`; sú to DAM `AssetDetailSidebarMetadata.vue` a
  `AssetListSidebarMetadata.vue`, nie súbor knižnice spomenutý v tej istej vete.

## 6. Súhrn

- **Citácie riadkov skontrolované: 135** (plán 59, jadro 14, komponenty 62).
  - **bez zmeny: 11** (`ADSM:48-90` trikrát, `ADSM:48-68`, `ADSM:44`, DAM `AssetDetailSidebarMetadata.vue:60-62`
    trikrát, `AssetListSidebarMetadata.vue:62-86` trikrát);
  - **posunuté: 118**, z toho 90 s rovnakým obsahom a 28 so zmeneným obsahom (`(zmenené)`; 20 z nich sú ciele opráv
    z plánu 2.1);
  - **zaniknuté: 6** (časť 4.1, všetky v pláne 2.1, v API uloženia metadát LIB a DAM).
- **Počty a veľkosti skontrolované: 14** riadkov časti 3; zmenené: `consumerProfileUploadDialogSingle` 34 → 47,
  `consumerProfileUploadDialogActions` 22 → 27, `overlaySave` 30 → 43, „9 prípadov" → 15, vlna 4 knižnice 261 →
  286, vlna 4 admin-dam 201 → 214, celé sady LIB a DAM, veľkosti `UQDS`, `UQDSS`, `UQDSM`; bez zmeny
  `uploadQueueDialogSingle` 21, `ADSM` 90 riadkov a ranné čísla v pláne 5.2 (zámerne).
