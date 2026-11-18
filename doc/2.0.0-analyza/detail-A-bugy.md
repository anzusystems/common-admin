# A — Bugy knižnice (detail)

Opravy a testy sú v spojenej kópii `batch2/all`. Patche: `batch2/all-out/fixes.patch` (71 súborov), `batch2/all-out/tests.patch` (65 súborov). Celá sada 1961 testov `--retry 0` prechádza, plus vue-tsc, oxlint, eslint, stylelint, oxfmt, lib build. Cesty k zdrojom sú relatívne k `src/` knižnice.

---

## A1 — Upload queue nedrží limit paralelných uploadov · TEST ✓
- **Kde:** `components/damImage/uploadQueue/composables/uploadQueuesStore.ts:170-177` (`processUpload`).
- **Scenár:** funkcia skončí len keď `uploadingCount === QUEUE_MAX_PARALLEL_UPLOADS`, inak cyklus spustí až `MAX` čakajúcich bez ohľadu na bežiace. `processUpload` sa volá po pridaní súboru aj po každom dokončení/notifikácii. Pri 6 súboroch: po prvom dokončení bežia 3, po jeho notifikácii 5.
- **Dopad:** cms a ugc multi-upload; delené pásmo, riziko 420 s chunk timeoutu. dam má vlastný store a robí to správne.
- **Oprava:** `const free = MAX - uploadingCount; for (i < free) start()`.
- **Test:** `src/test/composables/uploadQueueParallelLimit.test.ts` — po dokončení prvého očakáva 2 bežiace (dnes 3, resp. 5).
- **Poradie:** nasadiť s A5, inak 0-bajtový súbor obsadí slot natrvalo.

## A2 — Multi-image widget prenesie obrázky z článku A do B · TEST
- **Kde:** `components/damImage/uploadQueue/composables/imageStore.ts:5-29` (globálny store, `reset()` sa nevolá a nenuluje `maxPosition`), `ImageWidgetMultipleInner.vue:120-123` (pri prázdnom `modelValue` skončí skôr).
- **Scenár:** článok A má obrázky 1,2,3, článok B žiadne → B ukáže obrázky A a uloženie zapíše ich id do B (`:412,425,460`).
- **Dnes latentné** len preto, že admini volajú `reset()` sami; pri konzumentovi, ktorý zabudne, je to strata dát.
- **Oprava:** reset v setupe komponentu + nulovať `maxPosition`. Súvisí s B2 (knižnica resetuje sama).
- **Test:** `src/test/components/ImageWidgetMultipleInner.test.ts`.

## A3 — Zlyhaný DAM config sa tvári ako `ready` · TEST
- **Kde:** `AImageWidget.vue:103-108`, `AImageWidgetMultiple.vue:84-89`, `AImageMediaWidget.vue:106-111`, `AssetDistributionServiceNameFilter.vue:44`.
- **Scenár:** `Promise.allSettled` nikdy nevyhodí, `catch` je mŕtvy. Pri 5xx/timeoute configu je stav `ready`, chunk size 0 → uploady zlyhajú alebo bežia nekonečné 0-bajtové chunky.
- **Oprava:** `Promise.all`.
- **Test:** `src/test/components/damWidgetConfigLoadFailure.test.ts`.

## A4 — `loadDamPrvConfig` nuluje zlý flag · TEST
- **Kde:** `damConfigState.ts:64` nastaví `damPubConfig = false` vnútri `loadDamPrvConfig`.
- **Dopad:** prvá navigácia po štarte v dam načíta pub config zbytočne znova (`admin-dam/src/router/beforeEachRoute.ts:36`); ak ten request zlyhá, dam to ošetruje workaroundom s komentárom. (Pôvodne uvedené „pri každej navigácii“ — nesprávne, opravené 2026-09-26.)
- **Oprava:** riadok zmazať.
- **Test:** `src/test/composables/damConfigState.test.ts`.

## A5 — 0-bajtový súbor / Stop medzi chunkmi · TEST
- **Kde:** `uploadService.ts:243-247` (`failUpload()` bez `await` → promise sa nevyrieši, queue nikdy neskončí); `:162,274` (Stop medzi chunkmi prepíše nový token → asset sa aj tak vytvorí; Stop počas chunku sa retryuje ~13 s).
- **Odlišné od commitu c32bf36a**, ktorý riešil len Stop pred prvým chunkom.
- **Oprava:** `reject(new Error('Empty file'))`; kontrola Stop po `readFile`, pred novým tokenom a pred finišom; cancel neretryovať.
- **Test:** `src/test/composables/uploadEmptyFile.test.ts`, `uploadStopBetweenChunks.test.ts`.

## A6 — Kontrola veľkosti súboru pre `*`/`.ext` obrátená · TEST ✓
- **Kde:** `components/file/composables/formatAndSizeCheck.ts:73,76` — `sizes[k] <= file.size` prijme súbory nad limit a odmietne menšie; `.ext` neporovnáva príponu.
- **Reach:** interné volania posielajú MIME kľúče (fungujú), rozbité sú formy z JSDoc a `AFileInput` (verejné API). dam má vlastnú opravenú kópiu s `>=` (rozdiel na presnej hranici → ROZHODNI).
- **Súvis:** nastavenia sa čítajú raz pri mounte (`AFileDropzone.vue:42`, `AFileInput.vue:58`, `AAssetListInner.vue:196`); config načítaný neskôr sa neaplikuje. Oprava: `MaybeRefOrGetter` + `toValue`.
- **Test:** `src/test/composables/formatAndSizeCheck.test.ts`, `components/AFileInput.test.ts`.

## A7 — Fallback polling skončí po 1 sieťovej chybe · TEST
- **Kde:** `uploadApi.ts:79-119` (`notificationFallbackCallback` bez try/catch); súvisí: copy-to-licence položky nemajú fallback timer (`UploadQueueItemFactory.ts:51`), `queueItemDuplicate` (`uploadQueuesStore.ts:281-283`) hodí `Fatal error` z listenera.
- **Dopad:** položka ostane „processing“ navždy, „Save and apply“ sa neukáže. Týka sa cms a ugc (`uploadStatusFallback: true`).
- **Oprava:** try/catch, znovunasadenie pollingu kým je položka Processing; copy-to-licence dostane timer; duplicate označí Failed namiesto throw.
- **Test:** `src/test/composables/uploadStatusFallback.test.ts`, `uploadQueuesStore.test.ts`.

## A8 — Filter hash: história, typy, splice · TEST
- **Kde:** `labs/filters/filterFactory.ts:388,393` (`window.location.hash =` pridáva do histórie, Back neobnoví filter — v Chrome dokonca spustí všetky `beforeEach` guards pri každom submite); `:469-479` (obnova z hashu aj localStorage ignoruje `type:'string'` → `'0905'`→`905`, `'007'`→`7`); `:216-230` (`splice(-1,1)` pri `findIndex === -1` zmaže zlý chip).
- **Dopad:** blog `UserFilter.phone`, inhouse `phoneNumber`/`postcode`, `docId` polia; zoznam vráti nesprávne výsledky.
- **Oprava:** `history.replaceState` + update `current` vo vue-router state; pri `type:'string'` nekonvertovať; splice preskočiť pri -1.
- **Test:** `src/test/labs/filterFactory*.test.ts`.

## A9 — `useApiQueryBuilder` zlé pole · TEST
- **Kde:** `labs/api/useApiQueryBuilder.ts:62` — `fields[fromName]` namiesto `untilName` → `filter_gte=FROM&filter_lte=FROM`, nulové časové okno.
- **Dnes latentné** cez UI (mandatory interval s absolútnym defaultom nevyrobí null pár), ale je to reálna chyba.
- **Oprava:** `fields[untilName]`.
- **Test:** `src/test/labs/queryBuilderContract.test.ts`.

## A10 — List editory, 8 bugov · TEST
- **A10a Move-to-position o jednu mimo:** `ANestedSortableListEditor.vue:1369` posiela finálny index, `moveTo` čaká index pred odobratím (`useNestedListEditor.ts:454`). Latentné (žiadny admin nemá `show-move-to-position` na nested).
- **A10b Escape počas Apply:** `useKeyboardNav.ts:233`/`useReorderMode.ts:163` — server uloží nové poradie, UI ukazuje staré. ugc `BlogRubricSortable`.
- **A10c Nested ignoruje `position:false`/`strategy`:** `useNestedListEditorController.ts:188-212` vždy prečísluje 1..n. Latentné.
- **A10d Legacy aliasy commitnú celý strom** (`ANestedSortableListEditor.vue:1451-1485`): **strata dát v cms `LinkedListManage`** — aplikovaný reorder sa po reloade stratí, leave guard stíchne. Rieši B1.
- **A10e Inline Save bez guardu:** `AListEditor.vue:596`, `ASortableListEditor.vue:1036`, `ANested…:1099` — dvojklik = 2× POST.
- **A10f Baseline pri async load:** editor si čistý stav zoberie raz pri vytvorení; s `loading` propom riadky po načítaní čítajú ako „added“.
- **N1 Zrušený reorder vráti zmazaný riadok:** `get: () => modelValue.value` číta v-model prop, ktorý zaostáva za emitom. cms `LinkedListManage` nested `delete-mode="immediate"`.
- **N2 Dva zápisy v jednom ticku:** prvý sa stratí. Koreňová oprava: `customRef` vracajúci posledný emit.
- **Oprava:** 6 súborov, `acceptRows` + `customRef`. **Testy:** 8 súborov v `src/test/components/` a `composables/`.

## A11 — Unsaved guard prečíta `Ref` len raz · TEST
- **Kde:** `labs/unsavedGuard/useUnsavedChangesGuard.ts:179,197` — `guardRoute`/`guardWindowUnload` prijímajú Ref, čítajú ho raz pri setupe.
- **Oprava:** registrovať vždy okrem literálu `false`, `resolveBool` volať v handleri.
- **Test:** `src/test/…/useUnsavedChangesGuard.test.ts`.

## A12 — Remote switch/checkbox · TEST
- **Kde:** `components/form/AFormRemoteSwitch.vue`, `AFormRemoteCheckbox.vue` — bez try/finally `loading` po chybe navždy (`~:55`); id `'…-'+Date.now()` (`:79`) → dve inštancie v tej istej ms zdieľajú id, v blogu klik na label prepne iný riadok.
- **Oprava:** try/catch/finally + `useId()`.
- **Test:** `src/test/components/AFormRemoteSwitch.test.ts`.

## A13 — `<Acl>` hádže pri AllowOwner bez subjectu · TEST ✓
- **Kde:** `components/permission/Acl.vue:60` → `canHelper` → `defineAuth.ts:196` vyhodí `Error`. Výnimka v computed rozbije render tej časti, práve pre používateľov s owner grantom. `Acl` je pritom dokumentovaný ako nehádžuci variant.
- **Dnes latentné** (backend default grants ALLOW/DENY, nikto nemá AllowOwner), rozbije sa deň, keď taký grant vznikne.
- **Oprava:** v `Acl` chytiť a vrátiť `false`; `can()` naďalej hádže pre guardy.
- **Súvis:** `defineAuth().can()` hádže pre nenačítaný systém (zámer, footgun); `fetchCurrentUser` pri chybe drží starého usera → ROZHODNI.
- **Test:** doplnené do `src/test/components/Acl.test.ts`.

## A14 — `useLoginStatus` sa nevyčistí · TEST
- **Kde:** `composables/system/loginStatus.ts:12-49` — stav v modulovom refe, ktorý sa nikdy nevyčistí; neúspešný login ostane „failed“ → redirect loop na `/unauthorized`. inhouse a dam forkli, blog/forum obchádzajú.
- **Oprava:** jednorazové čítanie (vzor inhouse), exportovať `LoginState`/`LoginStateType`, premenovať zle nazvaný typ `JobStatusType`.
- **Test:** `src/test/composables/loginStatus.test.ts`.

## A15 — Asset select race conditions · TEST
- **Kde:** `dam/assetSelect/composables/assetSelectListActions.ts:25-116` — `usePagination()` a `detailLoading` na úrovni modulu (všetky inštancie zdieľajú stránkovanie — to je zámer), nový `useFetchAssetList` pri každom volaní (`cancelPrevious` nefunguje, staršia odpoveď prepíše novšiu), detail A pre B, `fetchNextPage` zvýši page pred requestom a pri chybe nevráti.
- **Oprava:** modulový AbortController zdieľaný aj pre next page, counter pre detail, rollback page pri chybe.
- **Test:** `src/test/composables/assetSelectListActions.test.ts`.

## A16 — `:v` na `AFormSwitch` sa ignoruje · TEST
- **Kde:** `AFormSwitch` nedeklaruje `v`, takže sa na 6 miestach cms nezobrazujú validačné chyby. (Dam* autocomplete **vyvrátené** — `v` prejde cez `$attrs` na root.)
- **Oprava:** deklarovať `v` a napojiť ako `AFormTextField`.
- **Test:** `src/test/components/formUndeclaredV.test.ts`.

## A17 — Ostatné komponenty · TEST
- **`ACopyText.vue:29`:** `!isSupported` na ComputedRef je vždy false → toast „skopírované“ aj keď sa nič neskopírovalo. `:32` `copy().then` bez catch.
- **`AAdminSwitcher.vue:28`:** `useFetch` pri HTTP chybe nevyhodí → `data.value` null → `config.length` zhodí šablónu. Oprava: `Array.isArray(...) ? ... : []`.
- **`collabRoom.ts:413`:** chýbajúci `return` → TypeError v socket acku. **`collabInit.ts:138,145,161`:** reject `beforeReconnect` → connect/rejoin sa nespustí, collab mŕtvy. `:166` zahodená Sentry `message` (dať do `tags`).
- **`ACollabLockedByUser.vue:25,50-58`:** drží prvého usera, ignoruje `_unresolved` (spinner navždy).
- **Stale fetch:** `anzuUserActions.ts:101-116`, `permissionGroupActions.ts:100-110` — po zlyhaní fetchu usera 7 ostane vo formulári user 5 a Save pošle PUT na 5. Latentné (admini resetujú store, RouterView má `:key`). Oprava: reset store v catch + id guard.
- **`ACurrentUserDropdown.vue:42`:** `v-if="currentUser"` skryje aj logout, kým sa user načítava. Oprava: `v-if` len na user-header.
- **Testy:** 7 súborov.

## A18–A33 — opravy v spojenom patchi, ktoré pôvodný index nemal · TEST (A30–A31 ČÍTANIE)
Doplnené 2026-09-26 pri prechádzaní bodov. Kód je v `batch2/all-out/fixes.patch`, testy v `tests.patch`: A18 `ImageWidgetInnerExpandMetadata`, A19 `ImageWidgetMultipleCopyToLicence` + `i18nLiteralKeys`, A20 `damWidgetUploadAccess`, A21 `damRoiLoaderOnFailure`, A22 `ImageMassOperations`, A23 `filterTimeIntervalOptions`, A24 `logFilterTimeWindow`, A25–A28 `remoteAutocompleteRaces`, A29 `defaultApiErrorLogger`, A32 `ListEditorMountInReorder`, A33 `string.test.ts`. A30–A31 (CSS) bez testu.
- **A18** `ImageWidgetInner.vue:601`, `ImageMediaWidgetInner.vue:743`: reset store v `onMounted` zmaže detail, ktorý immediate watcher zapísal ešte v setupe (`image` prop + `expandMetadata`). Latentné, admini posielajú id cez `v-model`. Oprava: reset v setupe pred watcherom.
- **A19** Hlášky: `showErrorT('damImage.queueItem.errorUnableToCopyToLicence')` bez `common.` (3×, ukáže surový kľúč); „Unable to lock image widget…“ (2×), `uploadService.ts:176` a `uploadApi.ts:97` natvrdo po anglicky; multi-widget hlási každý odmietnutý asset zvlášť a otvorí dialóg aj pri odmietnutí všetkých. Oprava: kľúče sk/cs/en, jedna hláška.
- **A20** `damFilterUserAllowedUploadConfigs.ts:40`: bez načítaného DAM usera vracia `[]` (truthy) → widget upload povolí. Len UI, backend odmietne. Oprava: `false` + `: boolean`.
- **A21** `DamAssetImageRoiSelect.vue:63-67,83-85`, `AssetDetailSidebarROI.vue:51-71`: chyba requestu → loader navždy, bez hlášky. Oprava: try/catch/finally.
- **A22** `ImageMassOperations.vue:28,139,153`: chyba lookupu mien autorov je unhandled, nič sa nevyplní. Oprava: `fillAuthors` s catch.
- **A23** `labs/filters/filterTimeIntervalTools.ts`: názvy volieb intervalu natvrdo po slovensky. Oprava: `common.filter.timeInterval.options.*` v sk/cs/en.
- **A24** `labs/log/logFilter.ts` (`useLogFilter`): filter cachovaný per systém ignoruje nové časové okno. Oprava: posunúť default aj hodnoty, ktoré user nezmenil.
- **A25** `labs/subjectSelect/useSubjectSelect.ts`: open a zmena radenia nevrátia stránkovanie na 1, chyba ďalšej strany ju nevráti.
- **A26** `labs/form/AFormRemoteAutocomplete.vue`, `labs/filters/AFilterRemoteAutocomplete.vue`: staršia odpoveď načítania vybraných položiek prepíše novšiu aj po resete; `loading` po chybe navždy; prefetch po načítaní sa nespustí (beží ešte pod `loading`). Oprava: počítadlo requestov, `finally`, poradie.
- **A27** `labs/form/AFormRemoteAutocompleteWithCached.vue`: staršie vyhľadávanie prepíše výsledky novšieho. Oprava: počítadlo.
- **A28** `labs/filters/AFilterRemoteAutocompleteWithMinimal.vue`: timer auto-fetchu sa pri unmounte nezruší.
- **A29** `labs/api/apiErrors.ts`: default logger vypíše 404 z user probe ako chybu. Oprava: preskočiť; `USER_PROBE_ENTITY` presunuté do `apiErrors.ts`, re-export z `userSystemProbe.ts` ostáva.
- **A30** `styles/components/table.scss:79`: dark mode selektor `.a-table__row` → `.a-datatable__row`.
- **A31** `styles/utils/text.scss`: `display: box` → `-webkit-box` (line-clamp; zmení log datatable v blog/forum/inhouse/dam, cms si to rieši sám).
- **A32** `labs/listEditor/composables/useReorderMode.ts:223`: snapshot pre Cancel sa robí len pri zmene režimu na reorder; editor namountovaný rovno s `mode="reorder"` ho nemá a Cancel presuny nevráti. Oprava: watch s `immediate: true`.
- **A33** `utils/string.ts:54-61` (`stringSplitOnFirstOccurrence`): bez oddeľovača (`indexOf` = −1) je `start` text bez posledného znaku. Latentné, všetci volajúci čítajú len `end`. Oprava: pri −1 `{ start: value, end: value }`.

## Skontrolované a v poriadku
labs api vrstva (abort, generácie), cross-system search anzuUser, cleanup pointermove/Sortable, globálne listenery dropzone, polling `ASystemBar`, `defineCached`, auth store. Vyvrátené: zdieľaná pagination asset selectu (zámer), `can()` throw pre nenačítaný systém (zámer), `:v` na Dam* autocomplete (prejde cez `$attrs`).
