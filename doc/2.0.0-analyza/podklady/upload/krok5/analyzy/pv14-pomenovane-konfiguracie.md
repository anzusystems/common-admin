# PV14: pomenovaná konfigurácia DAM, analýza (9. 10.)

Zadanie: jadro B32 a 5.2 PV14, denník nález 23, rozhodnutie vlastníka (denník, „Otvorené témy…", bod 4):
**analyzovať**, knižnica **má** podporovať viac konfigurácií. Len čítanie kódu; testy, buildy ani aplikácie som
nespúšťal.

Skratky: `L/` = `common-admin/src/domains/dam/`, `L-st` = `L/uploadQueue/store/uploadQueuesStore.ts`, `L-us` =
`L/uploadQueue/composables/uploadService.ts`, `L-sm` = `L/uploadQueue/settlement/uploadSettlement.ts`, `L-se` =
`L/uploadQueue/settlement/uploadSettle.ts`, `L-sty` = `L/uploadQueue/settlement/uploadSettlementTypes.ts`. Čísla
riadkov sú dnešný (neskomitnutý) stav po krokoch 0 až 3.

## 0. Zhrnutie

- Dnes meno konfigurácie putuje **len cez prop `configName`** (predvolene `'default'`), bez provide/inject. Kde ho
  rodič nepodá alebo kód číta `useCommonAdminCoreDamOptions()` bez mena, ide sa pod `default`. Takých miest je v DAM
  doméne knižnice **asi 35** (časť 2): celý upload (služba, sklad, dopytovanie, „Obnoviť"), oba dialógy uploadu,
  výbery autorov a kľúčových slov, výber assetu (napevno `'default'`), uloženie detailu assetu, `AImagePublicInput`,
  hromadné operácie obrázkov, validácie.
- **admin-cms, admin-ugc ani admin-dam inú konfiguráciu nemajú** (len `configs.default`); nikto nepodáva iné meno.
  Dnes sa teda nič neláme a navrhnuté zmeny im nič nezmenia (každá cesta vyjde na `'default'`).
- Návrh: meno nesie **fronta** (mapa v sklade knižnice; služba a usadzovanie ho berú z kľúča fronty) a **strom
  komponentov** (kľúč inject, výslovný prop má prednosť). Spoločné pre stránku ostávajú notifikácie, cache mien,
  konfigurácia ext systémov, sklady výberu a detailu, preto platí obmedzenie **jedna stránka = jeden core-dam**.
- Rozhranie len pribúda (nepovinné pole `UploadReadOptions.queueKey`, nepovinné parametre, nepovinný prop).
- Veľkosť asi **10 h** v dvoch krokoch v LIB po U6/U7, pred C3; cache na konfiguráciu (4 h) môže počkať.

## 1. Ako pomenovaná konfigurácia funguje dnes

**Voľby pluginu.** `coreDam.configs[meno]` (`src/AnzuSystemsCommonAdmin.ts:63-115`): klient (`damClient`), päť adries
(`endPointAsset`, `endPointImage`, `endPointRoi`, `endPointAuthor`, `endPointKeyword`), dve ACL, prepínače, texty,
validácie, dve mapovania na obrázok, filtre, jednoduchý sidebar. Pre celú stránku (mimo `configs`) sú `apiTimeout`,
`notification` a `adminDomain` (`:99-115`). Obrázkové voľby majú vlastné `image.configs[meno]` (`:35-55`).

**Výber.** `useCommonAdminCoreDamOptions(configName = 'default')` (`L/composables/commonAdminCoreDamOptions.ts:37-82`)
a `useCommonAdminImageOptions(configName = 'default')` (`L/imageWidget/composables/commonAdminImageOptions.ts:14-20`)
hodia výnimku, keď meno chýba. Widget pod menom `x` preto potrebuje `coreDam.configs.x` **aj** `image.configs.x`
(test to tak robí, `L/__tests__/damAuthorKeywordEndpoints.test.ts:80-82`). `default` je v praxi povinná: veľa ciest
číta bez mena.

**Odovzdávanie.** Prop `configName?: string` s `withDefaults` `'default'` má 34 komponentov (widgety, výber assetu,
detail, dialógy uploadu, ROI, filtre). Žiadny provide/inject mena nie je; existujúce kľúče sú len
`ImageWidgetUploadConfigKey` a `ImageWidgetExtSystemConfigs` (`L/imageWidget/utils/imageWidgetInkectionKeys.ts`).

**Spoločné pre stránku (nezávisle od mena):**
- sklad konfigurácie DAM, kľúčovaný ext systémom a licenciou (`L/config/store/damConfigStore.ts:36-76`); načítava sa
  klientom, ktorý dá volajúci (`L/config/composables/damConfigState.ts:24`);
- cache mien autorov, kľúčových slov a používateľov, modulové (`L/author/composables/cachedAuthors.ts:19-28`,
  `L/keyword/composables/cachedKeywords.ts:17-26`, `L/author/composables/cachedUsers.ts:21-26`) a ext system cache,
  „posledný zápis vyhráva" (`L/composables/extSystemIdForCached.ts:4`);
- jeden socket notifikácií (`L/composables/damNotifications.ts:92-114`);
- sklad fronty (`L-st:56`), sklad výberu, detailu, otvorený dialóg (`L/uploadQueue/composables/useUploadQueueDialog.ts:4`).

Z toho vyplýva nevyslovené obmedzenie: všetky konfigurácie jednej stránky hovoria s **tým istým core-dam** (rovnaké ID
assetov, autorov, ext systémov; jeden zdroj notifikácií). Core-dam má pre to aj cesty `/api/ugc/v1/` popri
`/api/adm/v1/` (`core-dam/config/routes/dam.php:61-66`), teda pomenovaná konfigurácia = iný klient alebo iné adresy toho
istého DAM.

Mimo konfigurácie sú pevné adresy `/adm/v1/configuration`, `asset-licence`, `asset-custom-form`, `user`, `podcast`,
`cms/asset` (`L/config/api/damConfigApi.ts:7`, `L/api/damAssetLicenceApi.ts:6`, …); idú klientom konfigurácie. To nie
je PV14, len hranica toho, čo konfigurácia vie zmeniť.

## 2. Inventár: kde DAM doména knižnice ignoruje meno alebo používa `default`

Druh: **A** číta `default` napevno; **B** má prop `configName`, ale na tomto mieste ho nepoužije; **C** rodič meno
nepodá (dieťa padne na `'default'`); **S** spoločné pre stránku zámerne.

| Oblasť | Miesto | Čo ide pod `default` | Druh |
|---|---|---|---|
| služba | `L-us:31` (`finishUpload`), `L-us:88` (`useUpload`) | klient a `endPointImage` štartu, kúskov aj dokončenia | A |
| služba | `L-us:103` | `apiTimeout` | S (koreňová voľba) |
| sklad | `L-st:68`, čitatelia `L-st:74-106,119` | dopyt, čítanie po notifikácii, „Obnoviť", originál duplikátu | A |
| sklad | `L-st:206,239` (`addByCopyToLicence`, `addByFiles`) | fronta nevie, pod akou konfiguráciou vznikla | A |
| sklad | `L-st:315` | beh riadku je `useUpload` bez mena | A |
| sklad | `L-st:432` (`updateFromDetail`) | čítanie assetu po uložení detailu | A |
| sklad | `L-st:57-58` | cache mien | S |
| usadzovanie | `L-sty:37-47,62-71`; volania `L-sm:233,244,487,560`, `L-se:480` | čitateľ nedostane nič, podľa čoho by vybral konfiguráciu | architektúra |
| „Obnoviť" | `L/uploadQueue/composables/uploadQueueItemRefresh.ts:25-27` | `_configName` sa nečíta (volajú ho `UploadQueueEditable.vue:36`, `UploadQueueDialogSingleSidebar.vue:85` s menom) | B |
| notifikácie | `L/composables/damNotifications.ts:20,97` | jeden socket, koreňová voľba | S |
| dialóg fronty | `L/uploadQueue/components/UploadQueueDialog.vue:83` (prop `:33`) | uloženie `:104,125`, mapovanie na obrázok `:128-129` (aj `customUploadMetadataToImageMap`), detail `:158` | B |
| otvorenie dialógov | `L/imageWidget/components/ImageWidgetInner.vue:940-948`, `ImageMediaWidgetInner.vue:1114-1122` (jeden súbor), `ImageWidgetMultipleInner.vue:713-724`, `L/assetSelect/components/AAssetListInner.vue:425-435` (fronta) | dialóg dostane `'default'`: v dialógu jedného súboru klient, adresy, mapovanie, `simpleAssetSidebar`, `roiUpdateAcl` (`UploadQueueDialogSingle.vue:207-214`), v jeho sidebari `mainFileSingleUseEnabled`, `showFileInfoEnabled` | C |
| limit fronty | `ImageWidgetMultipleInner.vue:732-736` → `ImageWidgetMultipleLimitDialog.vue:58` | `addByFiles` bez mena | C |
| riadok, zoznam, sidebar | `L/uploadQueue/components/UploadQueueEditable.vue:124,151` | riadok a sidebar hromadných operácií meno nedostanú | C |
| výbery autora a KS | `L/author/composables/authorActions.ts:13`, `L/keyword/composables/keywordActions.ts:13`, `L/keyword/components/KeywordRemoteAutocompleteWithCached.vue:79` (vytvorenie), `L/author/components/AuthorCreateButton.vue:50` | hľadanie, čítanie podľa ID, vytvorenie | A |
| … kde sa montujú | `UploadQueueItemEditable.vue:402,426`, `AssetQueueSelectedSidebar.vue:167,223`, `UploadQueueDialogSingleSidebarMetadataContent.vue:116,141`, `L/assetDetail/components/AssetMetadata.vue:125,150`, `ImageWidgetMultipleItem.vue:116`, `ImageDetailDialogMetadata.vue:158,248`, `ImageMassOperations.vue:141` | (to isté) | C |
| filtrové výbery | `L/author/components/DamAuthorFilterRemoteAutocomplete.vue:22`, `L/keyword/components/DamKeywordFilterRemoteAutocomplete.vue:21` | filter výberu assetu | A |
| cache | `cachedAuthors.ts:25-27`, `cachedKeywords.ts:24`, `cachedUsers.ts:25` | mená podľa ID | S |
| hromadné operácie | `L/uploadQueue/composables/uploadQueueMassOperations.ts` | nič (len sklad, bez požiadavky) | — |
| hromadné operácie obrázkov | `L/imageWidget/composables/useImageMassOperations.ts:33`, `ImageMassOperations.vue:62` (`AImageMassOperations` prop nemá) | autori, validácie, `sourceLabel` | A |
| výber assetu | `L/assetSelect/components/AAssetSelect.vue:80`, `AAssetSelectMedia.vue:80`, `AAssetListInner.vue:75`: `useAssetSelectActions('default', …)` | zoznam, detail po kliknutí, klient pre `useDamConfigState` (`AAssetSelect.vue:84,86`) | A |
| … deti | `AssetSelectFilter.vue:31`, `AssetSelectFilterForm.vue:35`, `AssetSelectListTiles.vue:16`, `AssetSelectListTable.vue:16` | to isté | A |
| … zmes | `AAssetListInner.vue:180` | klient `default` (`:75`) s adresou pomenovanej (`:80`) | B |
| … deti bez mena | `AssetMetadata` v `AAssetSelect.vue:326`, `AAssetSelectMedia.vue:326`, `AAssetListInner.vue:362,401`; `AssetDistributionServiceNameFilter` (`AssetSelectFilterForm.vue:146`); `DamUserFilterRemoteAutocomplete` (`:119`) | prepínače a texty detailu, klient filtrov | C |
| detail assetu | `L/assetDetail/components/AssetDetailSidebarMetadata.vue:46` (prop `:26`) | uloženie metadát `:58`; potom `updateFromDetail` (`:60`) | B |
| … otvorenie | `AAssetListInner.vue:419-423` | detail bez mena | C |
| obrázkové widgety | vlastné požiadavky widgetov idú pod ich menom (`ImageWidgetInner.vue:506-519`, `ImageMediaWidgetInner.vue:619-630`, `ImageWidgetMultipleInner.vue:376-426`) | — | OK |
| … | `L/imageWidget/components/AImagePublicInput.vue:48-49` (prop `:24`, obrázkové voľby pod menom `:46`) | klient, adresa, texty, validácie | B |
| … | `ImageWidgetMultipleItem.vue:52` (prop `:23`); `ImageDetailDialogMetadata.vue:97` | validácia popisu a zdroja | B, C |
| … | `ImageDetailDialogMetadata.vue:299` (`DamAdminAssetLink`) | text „upraviť v DAM" | C |
| kópia do licencie | požiadavka pod menom widgetu (`ImageWidgetInner.vue:432`, `ImageMediaWidgetInner.vue:552`, `ImageWidgetMultipleInner.vue:356`); potom `addByCopyToLicence` a `queueItemDuplicate` (`ImageWidgetInner.vue:333-336`, `ImageMediaWidgetInner.vue:341-344`, `ImageWidgetMultipleInner.vue:224-227`) | dopyt kópie a originál duplikátu cez sklad | A |

Pravidlo „bez mena = `default`" je dnes zámerne zapísané v `doc/changelog/2.0.0.md:70` (dialógy, cache, výbery,
tlačidlá vytvorenia, hromadné operácie) a v komentároch (`cachedAuthors.ts:25`, `uploadQueueItemRefresh.ts:25`).
Výber assetu napevno `'default'` je staršie, z `e5cc06f4`.

## 3. admin-cms a admin-ugc

- **admin-cms** `src/main.ts:57-69`: `coreDam.configs.default = { damClient }`, `image.configs.default`. **admin-ugc**
  `src/main.ts:48-80`: len `default` (adresy `/ugc/v1/*`, texty, prepínače, vlastné mapovania, `simpleAssetSidebar`).
  **admin-dam** `src/main.ts:39-41`: len `default`.
- **Iné meno nikto nepodáva.** Obaly admin-ugc majú prop `configName` = `'default'` a posúvajú ho
  (`domains/blog/image/components/ImageWidget.vue:24,40` a `ImageWidgetMultiple.vue:17,25,141-145` cez `v-bind="props"`,
  `ImageWidgetSimple.vue:57`, `AssetList.vue:146`); nikto ich s iným menom nemontuje. admin-cms má prop len v
  `domains/dam/components/damMediaPlayback/DamMediaPlayback.vue:9-29` (obrázkové voľby). Žiadny `config-name="…"`
  s literálom v produkčnom kóde ani jednej aplikácie.
- **Kde by sa to zlomilo** (príklad: admin-cms pridá `configs.ugc` s klientom UGC a adresami `/ugc/v1/*` a
  `<AImageWidget config-name="ugc">`): výber z DAM vypíše assety cez klienta a adresu `default`; upload pôjde na
  `/adm/v1/image` klientom CMS; dopyt, notifikácia aj „Obnoviť" čítajú `/adm/v1/asset`; dialóg jedného súboru uloží
  metadáta cez `default`, s mapovaním `default` (vlastné mapovanie UGC sa nepoužije, teda sa do obrázka uloží iný text)
  a s prepínačmi `default` (ukáže sa prepínač jedného použitia, ktorý UGC vypína); autori a kľúčové slová idú na
  adresy `default`. Bez `image.configs.ugc` widget hodí výnimku už v `setup`.

## 4. Návrh plnej podpory

### 4.1 Čo nesie meno

1. **Fronta.** Sklad knižnice si drží `Map<UploadQueueKey, string>`. Meno zapíše `addByFiles(…, configName?)` a
   `addByCopyToLicence(…, configName?)` (nepovinný posledný parameter, predvolene `'default'`). Kľúč fronty patrí
   jednému widgetu; ak do fronty s riadkami príde iné meno, sklad ho nezmení a napíše varovanie do konzoly. Zvažované
   a zamietnuté: meno na riadku (typ riadku je spoločný s admin-dam a čitatelia usadzovania riadok nedostávajú) a sklad
   na konfiguráciu (asi 20 čitateľov skladu by potrebovalo meno, dve usadzovania a dvaja poslucháči notifikácií,
   proti návrhu jadra 3.1 s jedným skladom).
2. **Služba.** `libraryUploadPreset(configName = 'default')` číta `useCommonAdminCoreDamOptions(configName)`.
   Sada jadra knižnice dostane od skladu `configOf(queueKey)` a `runnerFor(item, queueKey)` vráti
   `useUpload(item, cb, libraryUploadPreset(configOf(queueKey)))`. Jadro to predvída (jadro 2.3 pravidlo 2, 3.3 bod 11).
   `apiTimeout` ostáva koreňová voľba.
3. **Usadzovanie.** `UploadReadOptions` dostane nepovinné `queueKey?: UploadQueueKey` (dokumentácia typu už hovorí:
   „čitateľ, ktorý ho ignoruje, sa správa ako predtým", `L-sty:36`). Usadzovanie ho podá: dopyt fronty kľúč svojej
   fronty (`readQueue`, `L-sm:345-350`; jednotky sú vždy z jednej fronty); čítanie po notifikácii a „Obnoviť" kľúč
   prvého dotknutého riadku (`concernedRows`, `L-sm:175-187`, pri „Obnoviť" spočítané pred čítaním, nie po ňom);
   originál duplikátu `duplicateOriginAsset(originFileId, options?)` kľúč prvého kandidáta (`L-se:470-480`). Riadok
   bez fronty → `'default'`. Čitatelia skladu knižnice si klienta a adresu zistia v okamihu volania. Asset v dvoch
   frontách rôznych konfigurácií sa prečíta raz, cez prvú (jeden core-dam). Testy usadzovania zapisujú z volieb len
   `report` (`settlement/__tests__/support/settlementFixtures.ts:146,161`), nové pole ich nezasiahne; admin-dam ho
   nečíta.
4. **`updateFromDetail(asset, configName?)`**: detail podá svoje meno.
5. **Strom komponentov.** Nový interný kľúč `DamConfigNameKey` a funkcia `useDamConfigName(explicit?)`: výslovný
   prop, inak zdedené meno, inak `'default'`; komponent s propom `configName` meno zistí a poskytne potomkom. Prop
   stratí predvolenú hodnotu `'default'` v `withDefaults` (typ ostáva `string | undefined`), inak by prekryl zdedené
   meno. Meno poskytne asi 14 vstupných komponentov (3 widgety, 3 vnútorné widgety, ktoré admin-ugc montuje priamo,
   `AAssetSelect`, `AAssetSelectMedia`, `AAssetListInner`, `AImagePublicInput`, `AImageMassOperations`, oba dialógy
   uploadu, `AssetDetailDialog`). Všetky miesta „C" z časti 2 (aj budúce) sa tým opravia bez ďalšieho prop drillingu.
   `inject` len v `setup`; sklad, cache a funkcie API meno dostávajú výslovne. Výbery autora a kľúčového slova,
   tlačidlo vytvorenia a filtrové výbery: nepovinný prop `configName`, inak zdedené meno;
   `useAuthorSelectActions(extSystem, configName?)`, `useKeywordSelectActions(extSystem, configName?)`.
6. **Miesta A a B mimo uploadu:** `useAssetSelectActions(useDamConfigName(props.configName), …)` v troch výberoch a
   zdedené meno v ich štyroch deťoch; `UploadQueueDialog.vue:83`, `AssetDetailSidebarMetadata.vue:46`,
   `AImagePublicInput.vue:49`, `ImageMassOperations.vue:62`, `useImageMassOperations.ts:33`, validácie
   `ImageWidgetMultipleItem.vue:52`, `ImageDetailDialogMetadata.vue:97` (`useImageValidation` meno už berie,
   `L/composables/uploadValidations.ts:38-43`).

### 4.2 Sklady, cache, notifikácie

- **Sklad fronty** jeden; na konfiguráciu len mapa mien (4.1, bod 1). Sklady konfigurácie DAM, výberu a detailu
  ostávajú jeden na stránku (kľúčované ext systémom, licenciou, kľúčom fronty).
- **Cache mien** (autori, kľúčové slová, používatelia): odporúčam nechať jednu na stránku cez `default`. Údaje podľa
  ID sú v jednom core-dam rovnaké; výber pod menom pridáva do cache nájdené položky sám (`addManualMinimal`), takže
  cez `default` sa pýtajú len mená ID, ktoré prišli s assetom. Cache na konfiguráciu (krok PV14c) treba až vtedy,
  keď klient `default` nebude vedieť mená čítať: `Map<meno, defineCached>`, `useDamCached*(configName?)`, profil
  usadzovania `caches.add*(ids, queueKey?)` a `fetch*(queueKey?)` (`L-se:164-166,524-540`, `L-sm:144-146`), chipy cez
  zdedené meno. admin-dam by ostal na `default`.
- **Notifikácie**: jeden socket na stránku, ako dnes (koreňová voľba). Udalosť sa páruje podľa assetu so všetkými
  frontami a čítanie potom ide cez konfiguráciu fronty (4.1, bod 3). Ak pomenovaná konfigurácia nahráva pod iným
  používateľom DAM, jej udalosti socket nedostane; riadky usadí dopytovanie, ktoré beží vždy (pri živom sockete
  redšie: 10 s, 30 s, 60 s, potom raz za minútu; `L/uploadQueue/settlement/uploadPollSchedule.ts:25-33`).
  Notifikácie na konfiguráciu (nová voľba v `configs`, viac socketov, „push žije" na konfiguráciu) nenavrhujem.

### 4.3 Verejné rozhranie (len pribúda)

- `UploadReadOptions.queueKey?` (vyvezený typ, `src/lib.ts:415,1069`); `readers.duplicateOriginAsset?(originFileId,
  options?)`.
- Nepovinný prop `configName` na `AImageMassOperations` a na výberoch a tlačidle, ktoré návrh komponentov vyváža v U1
  (`ADamKeywordRemoteAutocompleteWithCached`, `ADamAuthorRemoteAutocompleteWithCached`, `ADamAuthorCreateButton`,
  komponenty 2.11).
- Pri PV14c nepovinný parameter `useDamCachedAuthors(configName?)`, `useDamCachedKeywords(configName?)`.
- Sklad knižnice ani `useCommonAdminCoreDamOptions` sa nevyvážajú; `DamConfigNameKey` vyvážať netreba (vstupné
  komponenty majú prop).
- Nič sa nepremenúva ani neodoberá. Zmena predvolenej hodnoty propu z `'default'` na „nezadané" je vnútorná: bez
  poskytnutého mena vyjde to isté.

### 4.4 Ako to zapadne do návrhov kroku 5

- **Jadro:** `libraryUploadPreset` (K2) dostane parameter, sada jadra knižnice (K4) člen `configOf`, sklad LIB (K5)
  mapu a čitateľov podľa kľúča fronty; jadro samo meno nečíta. Usadzovanie (jadro 1.4: „v kroku 5 sa nemení") dostane
  len nepovinné pole. Sada admin-dam ani sklad DAM sa nemenia.
- **Komponenty:** väzba zoznamu `useLibraryUploadQueueListBinding(queueKey, configName)` meno už berie (komponenty
  2.3), „Obnoviť" ide cez sklad a kľúč fronty, takže `useUploadQueueItemRefresh(configName)` môže ostať s dnešným
  podpisom (komponenty 2.3, pravidlo 6). Riadok a sidebar (U4) dostanú meno zdedením; admin-dam nič neposkytuje, jeho
  obaly ostanú na `default` (ako pri `UploadQueueSuggestionsKey`, komponenty 2.5). Rámec detailu
  (`AssetDetailDialogFrame`, U6) prop `configName` už má. `createDamImage` (U7) dostáva klienta a adresu od dialógu.
  Nové kľúče `keywordCreateAcl`, `authorCreateAcl` (komponenty 2.12) sa budú čítať z konfigurácie výberu, nie z
  `default`; pre všetky tri aplikácie to vyjde rovnako.
- **Nález 20** (kópia do licencie, adresa obrázka) mení tie isté tri volania widgetov; s PV14 sa nebije (widget podá
  svoju `endPointImage` a svoje meno skladu).

### 4.5 Testy a dokumentácia

- Nový súbor testov v LIB: widget pod konfiguráciou `own` (iný klient, iné adresy) — štart, kúsky, dokončenie,
  dopyt, čítanie po notifikácii, „Obnoviť", originál duplikátu, uloženie oboch dialógov a mapovanie, hľadanie a
  vytvorenie autora a kľúčového slova, výber assetu, uloženie detailu; fronta `default` popri pomenovanej. Test
  usadzovania: čitatelia dostanú `queueKey` pri dopyte, notifikácii, „Obnoviť" a duplikáte.
- Prejsť `L/__tests__/damAuthorKeywordEndpoints.test.ts:232-520`: rátajú požiadavky na mená pod konfiguráciou `own`
  a pod `default`; nová cesta môže počet zmeniť (neoverené). Prípady „by the default configuration" (`:372`, `:414`)
  montujú bez mena a ostávajú platné.
- Testy admin-dam bez zmeny (pole nečíta; výbery bez poskytnutého mena).
- Prepísať `doc/changelog/2.0.0.md:70` a doplniť `doc/guide/installation.md:62`: jedna stránka = jeden core-dam;
  widget pod menom potrebuje aj `image.configs` s tým istým menom; cache mien a notifikácie sú spoločné.

## 5. Veľkosť a kroky

| Krok | Obsah | Strom, kedy | Odhad |
|---|---|---|---|
| PV14a | 4.1 body 1 až 4: mapa mien vo fronte, sada služby, `configOf` v sade jadra, `UploadReadOptions.queueKey` a päť volaní v usadzovaní, čitatelia skladu, `updateFromDetail`; testy | LIB, po U6 (a U7, ak je v LIB), pred C3 | 4,5 h |
| PV14b | 4.1 body 5 a 6: kľúč a zdedenie mena, 14 vstupných komponentov, podanie mena do `addBy*` (8 volaní), miesta A a B (výbery, výber assetu, detail, `AImagePublicInput`, hromadné operácie obrázkov, validácie), dokumentácia; testy | LIB, hneď po PV14a | 5,5 h |
| PV14c | cache mien na konfiguráciu (4.2) | môže počkať, kým to aplikácia nebude potrebovať | 4 h |
| — | notifikácie na konfiguráciu | nenavrhujem | (4–6 h) |

- **Prečo nie v krokoch K a U:** PV14 mení tie isté súbory, ktoré K5, U4, U6 a U7 prepisujú (sklad, dialógy, riadok,
  sidebar); robilo by sa dvakrát. Rozhrania K2 a K4 ho nechávajú otvorené, takže stačí neskôr.
- **Kritická cesta:** dráha LIB po C2 má dnes asi 13 h (U6, U7, nález 20, U8-L), dráha DAM asi 27 h (K6 až U5c);
  PV14a a PV14b (10 h) sa zmestia do dráhy LIB bez predĺženia kritickej cesty. Zámok behov v prehliadači môže pridať
  čakanie.
- **Do admin-dam** prinesie C3 len nepovinné pole typu a výbery so zdedením mena; správanie DAM sa nemení, overí
  CK-DAM v C3.
- **Dokumenty:** v pláne 2.9 nahradiť riadok PV14 („nepodporovať", 0,5 h) krokmi PV14a a PV14b; v jadre B32, 2.3
  pravidlo 2, 3.1 a 5.2 PV14; v komponentoch 2.12 (ACL z konfigurácie výberu).

## 6. Čo som neoveril

- Nič som nespúšťal; scenár z časti 3 je odvodený z kódu, nie vyskúšaný proti core-dam.
- Či UGC klient vie čítať `/adm/v1/author` a `/adm/v1/keyword` (cache cez `default` by to v zmiešanej stránke
  potrebovala); UGC autorov a kľúčové slová nezobrazuje, takže dnes to nehrá rolu.
- Či sa po K5 a U4 až U7 posunú čísla riadkov citované v časti 2 (citujem dnešný kód); obsah miest sa podľa návrhov
  nemení.
- Odhady sú podľa tempa plánu (7. a 8. 10.), vrátane cielených testov a posudkov, bez čakania na zámok.

## Pre vlastníka

1. Podporiť pomenovanú konfiguráciu v celom uploade a v DAM komponentoch knižnice: meno nesie fronta a strom
   komponentov, výslovný prop má prednosť. Odporúčam áno; 10 h, kroky PV14a (4,5 h) a PV14b (5,5 h) v LIB po U6/U7,
   pred C3; nahrádza riadok PV14 „nepodporovať" v pláne 2.9.
2. Potvrdiť obmedzenie: všetky konfigurácie jednej stránky hovoria s tým istým core-dam. Odporúčam áno; len zápis do
   dokumentácie (v PV14b).
3. Cache mien autorov, kľúčových slov a používateľov ostáva jedna na stránku a pýta sa cez `default`. Odporúčam áno;
   cache na konfiguráciu ako PV14c (4 h), až keď ju aplikácia bude potrebovať.
4. Notifikácie ostávajú jeden socket na stránku; riadky konfigurácie s iným používateľom DAM usadí dopytovanie (do
   minúty). Odporúčam áno; 0 h.
5. Opraviť v PV14b aj miesta mimo uploadu, ktoré meno dnes strácajú: výber assetu (napevno `'default'`), uloženie
   detailu assetu, `AImagePublicInput`, hromadné operácie obrázkov, validácie. Pre admin-cms, admin-ugc a admin-dam sa
   nič nezmení (všetko vyjde na `default`). Odporúčam áno; v odhade PV14b.
6. `AImageMassOperations` a výbery a tlačidlo vyvážané v U1 dostanú nepovinný prop `configName`; kľúče
   `keywordCreateAcl` a `authorCreateAcl` sa čítajú z konfigurácie výberu, nie z `default`. Odporúčam áno; 0 h navyše.
7. Widget pod pomenovanou konfiguráciou potrebuje aj `image.configs` s tým istým menom (dnešný stav, bez zmeny).
   Potvrdiť; len zápis do dokumentácie.
