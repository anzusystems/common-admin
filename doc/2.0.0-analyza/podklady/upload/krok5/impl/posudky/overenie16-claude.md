## 160 (knižnica): PLATÍ. Opraviť sa dá len detail, bočný panel konflikty neukáže nikdy

Korene: knižnica `/home/volar/projects/anzusystems/common-admin/src/domains/dam` (`dam/`), admin-dam `/home/volar/projects/anzusystems/admin-dam/src` (`A/`, `D/` ako v zadaní), backend `/home/volar/projects/petit/core-dam/vendor/anzusystems/core-dam-bundle/src`. Vuetify 4.2.1 a vue-router 5.3.1 som čítal z `admin-dam/node_modules`. Len čítanie, nič som nespúšťal.

**1. Pole aj cesty.** Pole `dam/assetDetail/store/assetDetailStore.ts:18` nikto nezapisuje. Prehľadal som knižnicu, admin-cms aj admin-ugc a sklad nie je ani v `lib.ts`. Čítajú ho `AssetMetadata.vue:46,141` a `ImageDetailDialogMetadata.vue:69,168,262`.

Cesty assetu do skladu:
- **`open()`** (`:45-64`): detail riadka fronty `UploadQueueDialog.vue:206-213`, „upraviť asset" `ImageWidgetInner.vue:706-725`, `ImageWidgetMultipleInner.vue:446-466`, `ImageMediaWidgetInner.vue:846-865`.
- **`readBesideDetail()`** (`:81-92`): klik v zozname `assetSelectListActions.ts:174-192` a čítanie po zatvorení detailu `:221-224`.
- **`setAsset()` priamo:** `UploadQueueDialogSingle.vue:91,198`. Jeho panel berie konflikty z riadka (`UploadQueueDialogSingleSidebarMetadataContent.vue:134`).
- **Iné:** `AAssetListInner.vue:167-170` otvorí detail nad assetom panelu **bez čítania** (`dialog = queueKey`). `reset()` volajú `assetSelectListActions.ts:256` a `AAssetSelectMedia.vue:211`.

Kto kreslí `AssetMetadata.vue`:
- **Upraviteľne len detail:** `AssetDetailSidebarMetadata.vue:111`, ktorý kreslí `AssetDetailDialog` v `ImageWidgetInner.vue:1218`, `ImageWidgetMultipleInner.vue:875`, `ImageMediaWidgetInner.vue:1422` a `AAssetListInner.vue:423`.
- **Bočné panely sú všetky len na čítanie:** `AAssetSelect.vue:346-350`, `AAssetSelectMedia.vue:349-353`, `AAssetListInner.vue:360-366,405-411` majú `readonly`, z toho `:disabled` (`AssetMetadata.vue:145`). Vypnuté pole konflikty nekreslí (`AuthorRemoteAutocompleteWithCached.vue:292`).
- **Hostitelia:**
  - admin-cms: widgety obrázka, napr. `GalleryEdit.vue:107`.
  - admin-ugc: `AssetList.vue:140` (`AAssetListInner`), `ImageWidget.vue:165`, `ImageWidgetMultiple.vue:141`.
  - admin-dam: len `AAssetSelect` s panelom na čítanie (`D/components/slots/AssetSibling.vue:90`, `A/components/ImagePreview.vue:214`, `ExtSystemTtsSettingsForm.vue:118`). V admin-dam sa preto nič nezmení.

**2. Tvar sedí.** `dam/types/Asset.ts:49,53-57,83` je presne vstup `assetSuggestions.ts:14`.
- `fetchAsset` aj `fetchAssetByFileId` (`dam/api/damAssetApi.ts:57-96`) vracajú `AssetAdmDetailDto` (`AssetController.php:168-187`, `AssetAdmDetailDto.php:45-46,57`).
- `authorSuggestions` má tvar `{meno: [id…]}` (`AssetMetadataAdmDetailDto.php:15-16`, `AbstractSuggester.php:57-67`), rovnako ako to, čo číta riadok.
- Rozsah je malý. Server návrhy zmaže pri každom uložení s `described: true` (`AssetMetadataBulkManager.php:138-140`) a knižnica ho posiela vždy (`damAssetApi.ts:251,316,330`). Konflikty teda majú len ešte neuložené assety, typicky detail riadka pred uložením fronty.

**3. Oprava (veľkosť S, riziko nízke), jediný súbor `AssetMetadata.vue`.**
- Namiesto poľa zo skladu `computed`: `readonly || !asset ? [] : getAuthorConflicts(asset.metadata.authorSuggestions ?? {})`.
- K tomu `watch(…, { immediate: true })`, ktorý zavolá `addToCachedAuthors(ids)` a `fetchCachedAuthors()`. Rovnako to robia `uploadSettle.ts:163-166,546` a `A/store/assetDetailStore.ts:174,291-293`.
- Bez pridania do vyrovnávacej pamäte by čip konfliktu len točil kolieskom bez mena (`AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:29,59-65`). `open()` vyrovnávaciu pamäť neplní a panel pridá len `asset.authors` (`assetSelectListActions.ts:181`).

Prečo práve tam:
- Pokryje všetky otvorenia detailu vrátane `AAssetListInner.vue:167-170`, ktoré nič nečíta. Pole skladu ostane nepísané, takže dialóg obrázka ostane ako dnes.
- Nie v `setAsset` / `open` / `readBesideDetail`: dialóg obrázka by ukázal konflikty assetu z panela (napr. posledného kliknutého v `AAssetSelect`). `reset()` (`:105-108`) ich navyše vôbec nemaže.
- Pre panel to neodporúčam: je len na čítanie a „+" by pridalo autora do formulára, ktorý sa neukladá.

Testy:
- Konflikty v detaile dnes nedrží žiadny test. Existujúce testy pokrývajú len riadok a vstup: `uploadQueueRowStates.test.ts:307-313`, `uploadQueueDialogSingle.test.ts:470-473`, `damNameInputs.test.ts:286-298`.
- Pridať do `assetDetailDialog.test.ts`: jeho `open()` je `setAsset` + `dialog`, teda presne cesta bez čítania. S `authorSuggestions: {X: ['a','b']}` čakať 2 čipy s menom.
- Panel na čítanie (`consumerProfileAssetListSidePanel.test.ts`) a dialóg obrázka (`consumerProfileImageWidgetLibrary.test.ts`) majú ukázať 0 čipov.

## 175 (admin-dam): PLATÍ. Vetva je mŕtva, dvojité čítanie však zmazanie neodstráni

**1. Prečo je nedosiahnuteľná.**
- Príznak píše len `A/composables/currentExtSystem.ts:96`. Volá ho len `createAppInitialize` (`domains/system/composables/appInitialize.ts:103`) a ten beží len kým platí `!isAppInitialized()` (`router/beforeEachRoute.ts:65-71`).
- `initialized` sa nikdy nevracia na `false` (jediný zápis je `appInitialize.ts:141`). Obe stránky sú `requiresAuth` (`pages/(coreDam)/assets/[id].vue:5-11`, `file/[id].vue:5-11`), takže sa pripoja až po štarte.
- Každé pripojenie najprv zruší príznak aj sklad (`D/AssetDetailView.vue:134-140,148-153`, `D/AssetFileDetailView.vue:137-143,151-156`) a `getDetail` príde až o 100 ms. Platí to aj pri návrate na stránku: `App.vue:26` má `<RouterView :key="route.path">` a `KeepAlive` je len okolo `AActionbarTarget` (`layouts/AppLayoutDrawer.vue:86-88`).
- Neskoršie volanie `getDetail` (`D/AssetDetailView.vue:123-125`) už vidí `false`. `AssetFileDetailView` pri zmene súboru volá `readAsset` (`:122-128`), nie `getDetail`.
- Teoreticky ostáva len súbeh dvoch štartov (Späť alebo Vpred počas štartu). Pomalší štart môže zapísať príznak, asset aj licenciu až po pripojení stránky. Po zmazaní stránka prečíta svoje id a nanajvýš ohlási nesúlad licencie (`:101-105`), teda nie horšie ako dnes.

**2. Čo zmazať.**
- Vetvy `D/AssetDetailView.vue:77-86` a `D/AssetFileDetailView.vue:100-109`.
- `nextTick` z importu (`:14` v oboch súboroch, inde sa nepoužíva).
- Riadky `directDetailLoad = false` (`:138` a `:141`).
- `A/store/assetDetailStore.ts:24,342`.
- V `currentExtSystem.ts` riadky 95-97 a import `:17`.

`setAsset(assetRes)` nemá zmysel nechať:
- Pred `onMounted` ho číta len prvé vykreslenie stránky (`D/AssetDetailView.vue:170`, `D/AssetFileDetailView.vue:173`). To `resetAllStores()` zahodí v tom istom prepláchnutí, takže sa nič nenamaľuje.
- Robí len zbytočnú prácu: `prefetchLazyData` (`A/store/assetDetailStore.ts:285-294`) a pripojenie celého detailu aj s obrázkom.
- Nič iné ho nečíta. Notifikácie sa zapnú až po ňom (`appInitialize.ts:137`) a bez `tellPage` nič nespravia.

Testy: zmazať mocky v `test/cached/cachedExtSystemInit.test.ts:18-20` a `test/init/deepLinkClassification.test.ts:18-20`. Na príznak ani na `setAsset` v nich nie je žiadna aserácia, iné testy ho nespomínajú.

**3. Viditeľné zmeny: žiadne.** Asset sa naďalej číta dvakrát: pri štarte kvôli licencii (`currentExtSystem.ts:67-71`) a na stránke (`D/AssetDetailView.vue:99`, `D/AssetFileDetailView.vue:116`). Veľkosť XS, riziko minimálne.

## 197 (admin-dam): PLATÍ, ale len cez Späť/Vpred na záznam histórie zapísaný cez `replace`

**1. Kto príznak nastavuje.**
- `true` píšu tri miesta:
  - `A/composables/assetFooterSelected.ts:72-76` (zoznam DAM, „Upraviť" v `AssetFooterSelected.vue:87`).
  - `A/composables/externalProviderAssetFooterSelected.ts:75-79` (stránka poskytovateľa, `ExternalProviderAssetFooterSelected.vue:104`). **V zadaní chýba.**
  - `assetFooterUpload.ts:53-57` (upload, `AssetFooterUploadOverlay.vue:145`, na oboch stránkach cez `MainWrapper.vue:157`).
- `assetFooterUploadSlots.ts` píše len `false`.
- Slot plnia jediní dvaja používatelia `MainWrapper`: `AssetListView.vue:262-267` a `ExternalProviderAssetListView.vue:186-193`.
- Príznak aj polohy pásu sú modulové. DAM a poskytovateľ majú každý vlastnú polohu (`assetFooterSelected.ts:36`, `externalProviderAssetFooterSelected.ts:37`), upload má spoločnú (`assetFooterUpload.ts:18`).

**2. Cesty von zo stránky.**
- **Bežné Späť, Vpred aj Alt+← von nepustia.** VDialog je `persistent` z predvolieb knižnice (`plugins/vuetify.ts:7`, v nainštalovanej knižnici `dist/plugins/commonVuetifyConfig.js:56-60`). Stráž Vuetify navigáciu zruší a dialóg nechá (`VOverlay.js:297-305`), Esc tiež nič nespraví (`:279-291`). Staršie overenie tu malo pravdu.
- **Ale popstate na záznam s `history.state.replaced` Vuetify ignoruje** (`vuetify/lib/composables/router.js:104-105`) a navigácia prejde.
  - Vue-router zapisuje prvý záznam aplikácie cez `replace` s `replaced: true` (`vue-router.js:101-108,131,1403-1406`) a `push` mu ho ponechá (`:134-142`).
  - To isté platí pre `/` → `/assets` (`HomepageView.vue:9`).
- **Stráže odchodu to nezastavia.** Stránka poskytovateľa nemá žiadnu. DAM `beforeResolve` (`AssetListView.vue:107-112`) sa pýta len na neuložený detail alebo panel a `beforeunload` (`:117-122`) pokrýva len obnovenie a zatvorenie.
- **Ostatné cesty neprekážajú.** Odhlásenie a zmena licencie načítajú stránku celú znova (`currentUser.ts:2`, `AssetToolbarExtSystemLicenceDialog.vue:157`), notifikácie nenavigujú a jediné skratky sú šípky.

**3. Postupnosť krokov.**
1. Otvoriť ADAM v novej karte → `/assets` (prvý záznam, `replaced`).
2. „Integrácie" → poskytovateľ (`AssetToolbarIntegrations.vue:23`, push; treba právo `DAM_ASSET_EXTERNAL_PROVIDER_ACCESS`).
3. Označiť dlaždice a na páse kliknúť „Upraviť".
4. Stlačiť Späť.

Výsledok:
- `/assets` sa pripojí s `customDialog = true` a `MainWrapper.vue:134-143` hneď kreslí dialóg cez celú obrazovku.
- Slot DAM nemá čo ukázať, lebo ani jeho poloha, ani upload nie sú `Full`. Redaktor vidí **prázdnu kartu bez jediného tlačidla**.
- Pás (`v-else` na `:144-163`) chýba aj s prekrytiami uploadu (`:156-157`) a šípky nefungujú (`assetListActions.ts:560`).
- Esc nič nespraví. Vpred Vuetify zruší, lebo ten záznam nie je `replaced`.
- Pri pripojení príznak nič nevracia (`assetListActions.ts:534-549`). `AssetFooterSelected.vue:49-51` sedí v páse, ktorý sa nekreslí.
- Pomôže len obnovenie stránky alebo odchod z aplikácie.

Ďalšie varianty:
- Zrkadlovo to isté: prvý záznam je stránka poskytovateľa, na `/assets` sa otvorí plná hromadná úprava a príde Späť.
- Plný upload sa prenesie súdržne (poloha je spoločná) a dá sa zbaliť.
- Na stránku rovnakého typu sa vráti jej vlastný plný pohľad, ktorý sa dá zavrieť.

**4. Oprava (veľkosť S, riziko nízke): `MainWrapper.vue`, `onBeforeUnmount`.**
- Nie `onUnmounted`: pri `RouterView :key` by ďalšia stránka raz vykreslila dialóg.
- Plnú polohu zbaliť jej vlastným setterom, ktorý zapíše príznak aj výšku pásu naraz:
  - výber DAM aj výber poskytovateľa cez `hideSelected()`; fronta `QUEUE_ID_MASS_EDIT` sa aj tak vyprázdni v ďalšom `listMounted` (`assetListActions.ts:535`, `externalProviderAssetListActions.ts:413`);
  - upload cez `setCompactUpload()`.
- `Full` môže byť naraz najviac jedna poloha, lebo tlačidlá do plného pohľadu sú v páse, ktorý dialóg skryje. Návrat na stránku potom ukáže skrytý výber a kompaktný upload.
- Alternatíva: to isté v `onBeforeUnmount` oboch stránok (2 súbory).

Testy:
- Nový test pre stránku poskytovateľa aj DAM: `setFull…`, odpojiť. Čakať `customDialog = false` a polohu `Hidden` alebo `Compact`. Ďalšia stránka má byť bez `.v-dialog--fullscreen` a s pásom.
- Znova spustiť `test/queue/overlaySave.test.ts`, `test/list/detailDeleteQueueRows.test.ts` a `test/list/mainRouteChange.test.ts`.
