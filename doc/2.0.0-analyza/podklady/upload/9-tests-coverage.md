# 9 - Upload tests: what is pinned today, what is not, what to add first

Read-only analysis, 2026-10-07. Nothing was changed, built or run; no test was executed, so "covered" means
"a test asserts it", not "the test passes". Both repos on `next` (LIB `49bd815b`, DAM `ba8a66ec`).
Behaviour inventory used as input, not redone: reports `1-notif-fe.md`, `3-upload-store.md`, `4-upload-service.md`,
`5-upload-ui.md` in this directory. Their item numbers are quoted as `r3 C2`, `r5 R6` and so on.

## Legend

Roots: `LIB/` = `/home/volar/projects/anzusystems/common-admin/src/`, `DAM/` = `/home/volar/projects/anzusystems/admin-dam/src/`,
`E2E/` = `/home/volar/projects/anzusystems/admin-dam/e2e/`.

Source aliases:

| alias | file |
|---|---|
| `L-store` | `LIB/domains/dam/uploadQueue/store/uploadQueuesStore.ts` |
| `L-svc` | `LIB/domains/dam/uploadQueue/composables/uploadService.ts` |
| `L-api` | `LIB/domains/dam/api/uploadApi.ts` |
| `L-img` | `LIB/domains/dam/api/damImageApi.ts` |
| `L-asset` | `LIB/domains/dam/api/damAssetApi.ts` |
| `L-cs` | `LIB/domains/dam/uploadQueue/composables/damUploadChunkSize.ts` |
| `L-refresh` | `LIB/domains/dam/uploadQueue/composables/uploadQueueItemRefresh.ts` |
| `L-row` | `LIB/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue` |
| `L-list` | `LIB/domains/dam/uploadQueue/components/UploadQueueEditable.vue` |
| `L-dlg` | `LIB/domains/dam/uploadQueue/components/UploadQueueDialog.vue` |
| `L-single` | `LIB/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue` |
| `L-notif` | `LIB/domains/dam/composables/damNotifications.ts` |
| `D-store` | `DAM/domains/coreDam/asset/store/uploadQueuesStore.ts` |
| `D-svc` | `DAM/domains/coreDam/shared/services/upload/uploadService.ts` |
| `D-ep` | `DAM/domains/coreDam/shared/services/upload/externalProviderImportService.ts` |
| `D-api` | `DAM/domains/coreDam/asset/api/fileApi.ts` |
| `D-img` | `DAM/domains/coreDam/asset/api/imageApi.ts` (audio/video/document siblings alongside) |
| `D-asset` | `DAM/domains/coreDam/asset/api/assetApi.ts` |
| `D-listen` | `DAM/domains/system/composables/appNotificationListeners.ts` |
| `D-row` | `DAM/domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue` |
| `D-list` | `DAM/domains/coreDam/asset/components/queue/AssetQueueEditable.vue` |

Test aliases (LIB: `LIB/domains/dam/uploadQueue/__tests__/` unless a path is given; DAM: `DAM/test/`):

| alias | file | | alias | file |
|---|---|---|---|---|
| `LT-store` | `uploadQueuesStore.test.ts` | | `DT-slot` | `queue/slotNotifications.test.ts` |
| `LT-poll` | `uploadStatusFallback.test.ts` | | `DT-poll` | `fallback/notificationFallback.test.ts` |
| `LT-settled` | `uploadQueueSettledItemFailure.test.ts` | | `DT-listen` | `appInitialize/appNotificationListeners.test.ts` |
| `LT-refresh` | `uploadQueueItemRefresh.test.ts` | | `DT-lazy` | `queue/lazyMetadata.test.ts` |
| `LT-once` | `uploadQueueStartsEachFileOnce.test.ts` | | `DT-ext` | `queue/externalProviderImport.test.ts` |
| `LT-abort` | `uploadStopAbortsChunk.test.ts` | | `DT-stop` | `upload/uploadStop.test.ts` |
| `LT-between` | `uploadStopBetweenChunks.test.ts` | | `DT-bulk` | `asset/bulkMetadata.test.ts` |
| `LT-hash` | `uploadStopWhileHashLoads.test.ts` | | `DT-saveNothing` | `queue/saveNothing.test.ts` |
| `LT-massops` | `uploadQueueMassOperations.test.ts` | | `DT-rowValid` | `queue/queueRowValidation.test.ts` |
| `LT-dlgSave` | `uploadQueueDialogSave.test.ts` | | `DT-massSidebar` | `queue/massOperationsSidebar.test.ts` |
| `LT-single` | `uploadQueueDialogSingle.test.ts` | | `DT-fileValid` | `upload/fileValidation.test.ts` |
| `LT-rowRefresh` | `uploadQueueRowRefresh.test.ts` | | `DT-metaValid` | `asset/assetMetadataValidation.test.ts` |
| `LT-rowValid` | `queueRowValidation.test.ts` | | `DT-detailReq` | `list/detailRequests.test.ts` |
| `LT-massValid` | `massOperationsValidation.test.ts` | | `DT-extList` | `list/externalProviderList.test.ts` |
| `LT-chunkTimeout` | `LIB/domains/dam/__tests__/damImageApiChunkTimeout.test.ts` | | | |
| `LT-notif` | `LIB/domains/dam/__tests__/damNotifications.test.ts` | | | |
| `LT-copyMulti` | `LIB/domains/dam/imageWidget/__tests__/ImageWidgetMultipleCopyToLicence.test.ts` | | | |
| `LT-collab` | `LIB/domains/dam/imageWidget/__tests__/ImageWidgetCollab.test.ts` | | | |

Profile column of the LIB matrix (the socket is never real in a LIB unit test - `useDamNotifications` is mocked and
the test hands events to the captured listener):

- **ev** - the test delivers a notification event. Only the CMS profile has this path.
- **poll** - the row is settled by the fallback timer, flag on, no event. This is all the UGC profile has; CMS has it as the backstop.
- **ev+poll** - both are live in the test (the CMS profile as deployed).
- **direct** - the test calls the store action the poll and the refresh button call (`queueItemFullyProcessed`,
  `queueItemDuplicate`, `queueItemFailed`). Profile-neutral, but it does not prove the poll gets there.
- **-** - does not care (no settlement involved).

---

## 0. Headline findings

1. **The UGC path has no test of an uploaded file.** No LIB test takes a `File` row from `addByFiles` through the
   finish request into `Processing` and lets the poll settle it. The poll is exercised on copy-to-licence rows
   (`LT-poll:196-252`, `LT-settled:61-87`) and on one hand-made item that never settles (`LT-poll:91-111`). The
   main store suite runs with the flag **off** and `armNotificationFallback` replaced by a spy (`LT-store:44`,
   `:64`), so every settlement it pins comes from an event or a direct store call.
2. **The poll's `duplicate` and `failed` answers are not tested in LIB** (`L-api:122-125`), and `failed` is not
   tested in DAM (`D-api:169-171`). Only `processed` (both repos) and `duplicate` (DAM, `DT-poll:283-296`) are.
3. **`asset_file_failed` is never delivered through the LIB listener.** `queueItemFailed` is reached only by a direct
   call (`LT-store:329`) and through refresh (`LT-refresh:115`); the listener case `L-store:54-56` and the fail reason
   on the row have no assertion.
4. **DAM's manual refresh has no test at all** (`D-list:29-53`): the `with_file` criterion (r3 C18), the duplicate
   and failed branches, the "still processing" toast and the shared disable flag are unpinned. It is the only way
   out for a row the poll gave up on.
5. **DAM's poll and DAM's store are never tested together.** `DT-poll` mocks the store by module path
   (`DT-poll:29-36`), `DT-slot` calls the handlers directly. What a row looks like after a poll read (two
   un-awaited store calls, `D-api:153-158`) is asserted nowhere; neither is the same asset sitting in two of the
   three queues (every store test seeds one queue: `DT-slot:57`, `DT-lazy:48`).
6. **Request shapes are unpinned in both repos** except DAM's bulk metadata PATCH (`DT-bulk:40-94`) and LIB's chunk
   timeout (`LT-chunkTimeout:32-39`). LIB's `bulkUpdateAssetsMetadata` is mocked in every test that reaches it
   (`LT-dlgSave:19-22`, `LT-single:31-38`). No test asserts a start URL, a chunk form, a finish PATCH, or that the
   configured endpoints (`/ugc/v1/...` in UGC, `admin-ugc/src/main.ts:62-64`) are the ones used.
7. **LIB's chunk loop has no retry test** (4 attempts, 1/3/9 s, 422, 400) and no progress/speed test; DAM has both
   for its copy (`DT-stop:85-151`, `:269-289`). The shared `useDamUploadChunkSize` is mocked in every test of both
   repos (`LT-store:72`, `DT-stop:23`) and has no test of its own.
8. **LIB queue operations stop-one, stop-all and clear are untested** (`L-store:505-514`, `:555-597`); `stopUpload`
   appears only as test cleanup (`LT-refresh:81`, `LT-single:112`). DAM pins stop-one and remove
   (`DT-slot:466-527`), not stop-all nor the public `clearQueue`.
9. **The "apply" half of the LIB widgets is almost unpinned**: `mapUploadMetadataToImages` has no test, the widget
   handlers `onAssetUploadConfirm` (`LIB/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue:402-416`,
   `ImageWidgetInner.vue:606-618`) have none; `LT-dlgSave:81-88` asserts only which asset ids are emitted.
10. **DAM's e2e for a silent socket is marked `test.fail()`** (`E2E/tests/upload/uploadNotificationFallback.spec.ts:33`)
    and the slot e2e specs wait for a slot-list re-read that the code fires only when the queue row settles
    (`E2E/pages/assets/assetSlotsPage.ts:226-232`, `DAM/domains/coreDam/asset/components/detail/components/slots/AssetSlotListItem.vue:88-92`) -
    i.e. on the notification (inferred, see section 6).
11. **Existing tests that the agreed changes will break** (so they must be rewritten, not kept green):
    exact poll delays `LT-poll:107`, `:131`, `:205`, `:220`, `:241` and `DT-poll:218-228` (change (e));
    DAM's "recovered row stays without its form" `DT-slot:678-696` (change (f)); the allowed import cycle
    `LIB/test/importCycles.test.ts:100-108`.

---

## 1. Inventory of upload-related tests

### 1.1 LIB - conventions

Vitest in real Chromium (`common-admin/vitest.config.mts`, `LIB/test/README.md`: "Browser Mode"); tests live in
`__tests__/` next to the code. Fake timers are not used ("Fake timers stall the browser runner", `LT-poll:68-69`):
suites patch `window.setTimeout` and shorten or hold only the long waits (`LT-poll:70-83`, `LT-settled:53-54`,
`LT-single:85-108`, `LT-rowRefresh:23-45`). `damAssetApi` is mocked with every export spelled out, because
"`importOriginal` here closes an import cycle and stalls the browser runner" (`LT-poll:24`). Rows are made by the
real store actions and then mutated; component suites use the item factory (`LT-rowRefresh:57-67`) or raw literals
when the store itself is mocked (`LT-dlgSave:53-58`, `LT-massops:11`).

Flag and event set-up per file (this decides the profile):

| file | `uploadStatusFallback` in the mock | events delivered | poll real |
|---|---|---|---|
| `LT-store` | off (`:64`) | yes (`:15-20`) | no - `armNotificationFallback` is `vi.fn()` (`:44`) |
| `LT-poll` | on, switchable (`:12`, `:41`, `:75`) | in some cases (`:229`, `:268-272`, `:304`) | yes |
| `LT-settled` | on (`:32`) | yes (`:35`) | yes |
| `LT-refresh` | off (`:40`) | yes (`:42-46`) | no |
| `LT-single` | off (`:53`) | yes (`:55-59`) | no |
| `LT-once`, `LT-between`, `LT-hash` | off (`:40`, `:28`, `:26`) | listener dropped / no store | no |
| `LT-dlgSave`, `LT-massops` | store mocked by module path (`:7-13`, `:7-9`) | - | - |
| `LT-rowRefresh`, `LT-rowValid`, `LT-massValid` | no store | - | - |

### 1.2 LIB - files

| file (lines) | mounts / imports | mocks | tests by `describe` |
|---|---|---|---|
| `LT-store` (450) | real store + real `useUpload` | `rusha` (`:13`); listener captured (`:15-20`); `uploadApi` by path - start answers ids, chunk held per file name and rejects on abort, finish sets `Processing` (`:23-45`); `damAssetApi` partial (`:56-60`); options (`:62-65`); `damConfigState` (`:66-68`); `mimeTypeHelper` -> image (`:69-71`); `damUploadChunkSize` (`:72-74`) | **a zero-byte file in the upload queue** `:85`: fails the item `:86`. **an asset copied to the licence whose detail fails to load** `:100`: ends failed `:101`. **the metadata of an item in the queue** `:121`: keeps typed values once the notification loaded it `:135`; loses the give-up error on a late processed event `:159`; given once, keeps its switches `:173`; failed stays not editable `:195`; stops being editable when the upload fails after its metadata `:212`; uploaded again with metadata when its file turns out processed `:229`; ... with what the user typed `:252`; copy keeps typed values `:277`; `it.each` x3 keeps typed values through a failure (fallback / copy / duplicate) `:302`; stays uploaded when the request fails after the notification `:339`; ... while the notification is handled `:363`; stops being editable when the settling lookup fails `:387`. **an upload removed while it sends** `:411`: stops, next file takes its slot `:412`. **upload queue parallel limit** `:429`: never more than two `:430` |
| `LT-poll` (313) | real store, real `uploadApi`, item factory | `damImageApi` all exports (`:16-23`); `damAssetApi` all exports (`:27-38`); options with switchable flag (`:39-42`); listener (`:43-47`); `damConfigState` (`:48-50`); `setTimeout` >= 10 s recorded and shortened (`:70-83`); unhandled rejections collected (`:63-67`) | **upload status fallback poll** `:90`: keeps polling after a failed fetch, says so when it gives up `:91`. **an item removed while its poll waits** `:116`: polled no more `:117`. **an upload stopped while it finishes** `:138`: stays stopped, not polled `:139`. **an upload its notification settles while it finishes** `:166`: `it.each` Uploaded / Failed `:167`. **an asset copied to the licence** `:195`: polled, ends uploaded with its file `:196`; polls again when loading the processed asset fails `:209`; `it.each` x2 still polled after metadata notification / detail save `:226`; arms no poll when the fallback is off `:244`. **an item settled as a copy or as a duplicate** `:257`: shows no old error `:258`. **a duplicate whose origin asset cannot be loaded** `:281`: fails the item `:284`; via the notification, no unhandled rejection `:298` |
| `LT-settled` (88) | real store + real `uploadApi` | as `LT-poll`; flag on (`:32`); long waits -> 300 ms (`:53-54`) | **a failed asset fetch on a copied or duplicate item** `:60`: a copy the notification failed stays failed `:61`; a settled copy is not failed by a late notification `:75` |
| `LT-refresh` (161) | real store, `useUploadQueueItemRefresh`; mounts `UploadQueueEditable` with row and sidebar stubbed (`:147-151`) | `damImageApi`, `damAssetApi` (all), options, listener, `damConfigState`, `useAlerts().showWarningT` (`:50-57`) | **the refresh of an item** `:93`: uploaded item without metadata gets it `:95`; `it.each` x4 file status -> row status `:112`; can be asked again `:129`. **the upload queue** `:144`: refreshes the item whose row asked `:145` |
| `LT-once` (76) | real store + service | gated `rusha` (`:11-22`); `uploadApi` (`:31-36`); options; listener no-op (`:43-45`); config; mime helper; chunk size | **upload queue while rusha loads** `:59`: starts each selected file once `:60` |
| `LT-abort` (27) | real `imageUploadChunk` + real axios with a custom adapter (`:11-18`) | none | **Stop during a chunk request** `:9`: aborts, reads as a cancel `:10` |
| `LT-between` (79) | real `useUpload`, raw literal item (`:34-41`) | `rusha`, `uploadApi` (`:21-25`), options, chunk size 1024 on a 3000-byte file | **Stop on a multi-chunk upload** `:51`: no further chunk, no finish `:52`; gives up at once when Stop cancels the chunk in flight `:67` |
| `LT-hash` (78) | real `useUpload`, raw literal item | `rusha`, `uploadApi`, options, chunk size | **an upload stopped before its first chunk** `:42`: no asset while rusha loads `:43`; no chunk when stopped during start `:56`; uploads and finishes with the hash `:67` |
| `LT-massops` (52) | real `useUploadQueueMassOperations` | store by path, raw rows (`:7-11`) | **mass operations: a custom value** `:13`: fills what is empty `:24`; keeps a value, other asset type untouched `:35`; replaces on request `:47` |
| `LT-dlgSave` (89) | mounts `UploadQueueDialog` on `document.body`; stubs list, stop button, file input, dropzone (`:33-40`) | store by path with raw rows, processed == total (`:7-13`); options partial; `bulkUpdateAssetsMetadata` -> `[]` (`:19-22`) | **the upload dialog** `:63`: cannot be saved while nothing would be sent `:65`; can be saved once one item would `:70`; cannot be applied while nothing is uploaded `:75`; applies the uploaded items, leaves a failed one out `:81` |
| `LT-single` (323) | mounts `UploadQueueDialogSingleSidebar` or `UploadQueueDialogSingle` through a host; real upload, asset-detail and config stores; row = real copy row (`:126-150`) | `damImageApi`, `damAssetApi` (all; bulk spy `:31`), options (`mainFileSingleUseEnabled: true`, `simpleAssetSidebarEnabled` switchable, `:44-54`), listener; 20 s waits held (`:85-108`) | **the sidebar of the single-file upload dialog** `:152`: `it.each` x2 (with / without tabs) offers refresh on an uploaded item without metadata `:182`; not when metadata comes in time `:206`; goes on waiting while the other tab is open `:220`; keeps the single-use switch when the detail loads `:235`; offers the author conflicts of the item `:255`. **the single-file upload dialog** `:270`: `it.each` x2 duplicate notice says whether the original is single use `:272`; `it.each` x2 sends the item's single-use switch on save / saveAndApply `:303` |
| `LT-rowRefresh` (140) | mounts `UploadQueueItemEditable` with a factory row | options partial (`:11-14`); autocomplete stubbed; 20 s waits held | **the refresh button of an uploaded row still without its metadata** `:110`: offered after the wait, goes when metadata is there `:111`; `it.each` x2 not offered when metadata comes / the row fails first `:129` |
| `LT-rowValid` (157) | mounts the row under a vuelidate collector; `AssetCustomMetadataForm` | options partial | **a row of the upload queue** `:53`: validated only while editable `:56`. **the custom metadata form** `:125`: in the asset metadata scope by default `:128` |
| `LT-massValid` (73) | mounts `AssetCustomMetadataFormMassOperations` | none | **the mass operations form** `:38`: does not block the save `:41` |
| `LT-chunkTimeout` (40) | real `imageUploadChunk`, fake client `{post}` | none | **imageUploadChunk chunk timeout** `:22`: factory called without arguments `:23`; timeout in the request config `:32` |
| `LT-notif` (99) | real `initDamNotifications`, global `WebSocket` stubbed (`:18-31`) | none | **damNotifications singleton** `:16`: same handle `:40`; replaced on a new key `:47`; old handle cannot reopen `:56`; initialized flag reset `:67`; fresh handle after dispose `:78`; no reopen of an open socket `:90` |
| `LT-copyMulti` (110) | mounts `ImageWidgetMultipleInner`; queue dialog, limit dialog, dropzone stubbed (`:61-69`) | `damImageApi` with `copyToLicence` spy (`:12-21`); alerts; options; spies `addByCopyToLicence`, `queueItemDuplicate` on the real store (`:72-74`) | **copy to licence** `:88`: one message for the refused, no queue when none copied `:89`; still queues the copied next to a refused one `:99` |
| `LT-collab` (730), `ImageMediaWidgetCollab.test.ts` (763) | mount `ImageWidgetInner` / `ImageMediaWidgetInner`; collab mocked | `copyToLicence` held (`LT-collab:22-25`); queue dialog stubbed | upload-relevant cases only: takes no drop while another editor holds the field `:205` (media `:231`); keeps the lock while a picked asset is copied `:221`; asks once for two drops `:303`; **waits for its own lock before a drop uploads** `:712` (spy on `addByFiles`). The other ~35 cases are lock handling |
| others touching the area | `ImageWidgetMultipleInner.test.ts:69,87,98` (image store, read-only); `ImageWidgetInnerExpandMetadata.test.ts:87` (read-only offers no controls); `LIB/domains/dam/config/__tests__/damWidgetUploadAccess.test.ts:41-62,70,84,96` (who may upload); `LIB/domains/ui/file/__tests__/formatAndSizeCheck.test.ts:13-48`, `AFileInput.test.ts:13`, `AFileInputDialog.test.ts:14` (picker limits); `LIB/plugins/__tests__/pluginOptions.test.ts:46,63` (options reach the composables; `uploadStatusFallback: false` at `:38`); `LIB/test/importCycles.test.ts:100` (only the upload cycle is allowed) | | |

LIB has no e2e suite (no Playwright/Cypress spec in the repo).

### 1.3 DAM - unit (vitest, happy-dom: `admin-dam/vitest.config.mts:35`)

Conventions: tests under `DAM/test/<area>/`; each test does `vi.resetModules()`, a fresh pinia and a dynamic import
of the unit (`DT-slot:83-88`, `DT-poll:55-61`); DAM-local modules are mocked by path, the library partially through
`vi.mock('@anzusystems/common-admin', importOriginal)` (`DT-lazy:14-17`); store rows are **raw object literals written
into `store.queues[...]`** (`DT-slot:59-98`); fake timers for the poll (`DT-poll:71`); components are mounted with
`createApp` + Vuetify + i18n by hand (`DT-saveNothing:68-86`).

| file (lines) | imports / mounts | mocks | tests by `describe` |
|---|---|---|---|
| `DT-slot` (797) | real store | `assetApi` (`:12-15`), four file APIs (`:17-21`), import service (`:22-24`), `uploadService` - `useUpload` never settles unless a test fails it (`:27-42`), current ext system / licence, providers, both caches (`:43-55`); rows seeded raw | **slot uploads of one asset** `:104`: settles only the item holding the named file `:105`; leaves a queued upload alone `:120`, `:134`; mass-edit row decorated, not settled `:147`; not failed on another's file `:171`; fills only free slots `:191`; mass-edit row left alone while `Loading` `:207`; ordinary upload settled on the asset alone `:235`; never a slot upload `:247`. **a processed notification** `:261`: settles when the asset cannot be read `:262`; with no main file `:275`. **settling one item** `:294`: starts what waited `:295`; keeps the metadata warning `:314`; says nothing to a row with metadata `:331`; takes the warning back `:346`; clears the fallback's warning `:368`, `:387`; duplicate marked with unreadable origin `:404`. **a slot upload that fails** `:419`: only that item `:420`; no request `:435`. **the upload slots** `:449`: starts two `:450`. **stopping one item** `:466`: by identity `:467`. **the slot lookup** `:482`: newest upload `:483`; removes the first item `:495`; removes by asset through the teardown `:508`; nothing for an empty slot `:529`. **the metadata of an upload** `:538`: 12 ordering cases `:549`, `:572`, `:588`, `:612`, `:631`, `:653`, `:678`, `:700`, `:726`, `:745`, `:762`, `:779` |
| `DT-poll` (297) | real `fileApi` with `envConfig.uploadStatusFallback` set | `assetApi.fetchAsset` (`:16`), four `uploadFinish` (`:17-28`), **the store by path** (`:29-36`); raw item (`:38-48`); fake timers | **`describe.each` the finish response for <type>** `:69` (x4): leaves a settled item alone `:70`; arms nothing for a stopped upload `:91`; hands over to processing `:110`. **the notification fallback** `:125`: not armed when switched off `:126`; armed for an import regardless `:142`; says nothing about a slot whose file is not main `:157`; keeps trying after a failed request `:172`; stops when cleared mid-request `:188`; gives up out loud (schedule + slot wording) `:211`; stops when cancelled `:231`. **what the fallback settles an item with** `:253`: loads the metadata of a processed upload `:266`; not where the item has it, nor on a slot `:273`; tells a duplicate its origin file `:283` |
| `DT-listen` (114) | real listener module | library partial (`initDamNotifications`, `useDamNotifications`, `:7-11`); store by path (`:16-23`); distribution store empty (`:24-26`) | **what the listener passes on** `:41`: file id for processed `:56`, failed `:62`, duplicate `:68`. **notification listeners** `:75`: registers once `:76`; nothing on a second start-up `:85`; takes the listener off when open fails `:96` |
| `DT-lazy` (203) | real store | `fetchAssetListByIds` (`:5-10`); library partial for `useDamConfigState` (`:14-17`); upload/import services; rows through real `addByAssets` (`:93`) or raw (`:141`, `:186`) | **assets picked for mass edit** `:86`: fails the ones the batch left out `:87`; later batch clears the warning `:106`; fails all when the call fails `:122`. **mass operations: custom value** `:136`: `:152`, `:161`. **mass operations: keywords and authors** `:173`: only into enabled types `:194` |
| `DT-ext` (116) | real import service | `fileApi` (`:8-11`); library partial (`useAlerts`, `axiosErrorResponseHasValidationData`, `:14-18`); raw item | **importing from an external provider** `:46`: ids carried over, fallback armed `:47`; settled item left alone `:61`; failed when the provider refuses `:78`; duplicate marked silently `:92`; other validation error fails `:105` |
| `DT-stop` (305) | real `uploadService` | `fileApi` (`:11-19`); library partial (`useDamUploadChunkSize` -> 4 bytes, `:20-24`); `axios.isAxiosError` -> false (`:25-31`); `FileReader` stub (`:38-54`); raw item; fake timers | **measuring the speed** `:84`: never negative after a retry `:85`. **measuring a retry** `:117`: over its own time `:118`. **stopping an upload** `:154`: every chunk when nothing stops it `:155`; between chunks `:167`; during the back-off `:185`; while reading `:211`; while start is on the wire `:235`; while the last chunk is on the wire `:251`; gives up after the last attempt `:269`; cancels the chunk on the wire `:291` |
| `DT-bulk` (95) | real `assetApi` | `damClient` -> `{patch}` (`:8`); library partial | **bulk metadata update** `:39`: only the fields the form edits `:40`; the one flag once known `:57`; left out while unknown `:65`; batches counted from what is sent `:74`; split over the limit `:86` |
| `DT-saveNothing` (102) | mounts `AssetFooterUploadOverlayFull`, `AssetFooterSelectedFull` | store by path (`:11-17`); children mocked (`:38-47`) | **`describe.each` upload overlay / mass edit overlay** `:93`: cannot be saved while nothing would be sent `:95`; can once one item would `:99` |
| `DT-rowValid` (164) | mounts `AssetQueueItemEditable` under a collector | children by path (`:55-66`); raw reactive row | **a row of the upload queue** `:97`: validated only while editable `:101` |
| `DT-massSidebar` (124) | mounts `AssetQueueSelectedSidebar` | store by path (`:12-21`); autocompletes and form mocked | **mass operations: keywords and authors** `:84`: offered and written only when enabled `:85`; left out `:104`; both for mixed types `:114` |
| `DT-fileValid` (56) | pure `checkFormats`, `checkSizes` | none | **the size limit** `:7` (5 cases `:8-39`); **the accepted formats** `:45` (`:46`, `:53`) |
| `DT-metaValid` (187) | mounts the metadata forms | library partial | mass-operations form does not stop the save `:114`; overlay counts each failing field once `:136`; sidebar save rules `:163-182` |
| `DT-detailReq:573-589`, `DT-extList:76-89` | list actions | store by path (`DT-detailReq:38-44`, `DT-extList:36-44`) | tiles of the mass-edit selection follow the queue |

### 1.4 DAM - e2e (Playwright against a deployed environment: `E2E/.env.dist`, `E2E/playwright.config.ts:24-31`)

Real backend, real socket, except the one spec that silences it.

| spec | what it drives | asserts |
|---|---|---|
| `tests/upload/uploadImages.spec.ts:24-35`, `uploadAudio.spec.ts:23-34`, `uploadVideo.spec.ts:23-34`, `uploadDocument.spec.ts:23-34` | every fixture type x `select` / `drag-drop` (`pages/shared/upload.ts:95-130`) | overlay title turns "done" (`upload.ts:133-135`), stored mime type through the API |
| `uploadImages.spec.ts:37-54` | animated GIF | `animated` flag, detail text |
| `uploadNotificationFallback.spec.ts:32-52` | socket silenced with `page.routeWebSocket` (`:38`) | overlay finishes - **`test.fail()`** (`:33`, "DAM-B11: the fallback is never armed") |
| `tests/licence/{image,audio,video,document}LicenceDuplicate.spec.ts` (image `:34`), `pages/licence/licenceDuplicatePage.ts:25-40` | same bytes uploaded twice in three licences | duplicate icon in the compact list on the second upload only |
| `tests/errors/errorPaths.spec.ts:149`, `:170`, `:198` | refused type; over the size limit; chunk answered 422 | nothing queued, no write; row failed, title "done", message readable in the full view |
| `tests/assets/assetBulkEdit.spec.ts:89-194`, `assetBulkEditKeywords.spec.ts:85-138` | three uploads; mass edit of the selection | fill-empty / replace-all / clear; **the trash button of a row deletes the asset** `:172-190` |
| `tests/assets/audioSlots.spec.ts:85`, `assetSlotActions.spec.ts:61`, `tests/assetEmpty/*AssetEmpty.spec.ts` (image `:54`) | slot upload (`pages/assets/assetSlotsPage.ts:226-232`, `pages/assetEmpty/emptyAssetPage.ts:41-47`) | slot rows after the slot list is re-read |
| `tests/assets/externalProviderUnsplash.spec.ts:72`, `:89` | import of one photo and of a selection | asset stored, titles (`:62` is `test.fail()`, DAM-B1) |

---

## 2. Coverage matrix

Gap ids (`LS1`, `DR2`, ...) point to the proposed tests in section 3. "TBA" = target behaviour to be agreed (section 4).

### 2.1 LIB

#### A. Chunk upload service and upload start

| behaviour | code | covered by | profile |
|---|---|---|---|
| start -> chunk -> finish for a one-chunk file, hash handed to finish | `L-svc:229-283` | `LT-hash:67-77` | - |
| multi-chunk: offsets advance by the size sent; chunk `File` carries name and type; `hash.update` per chunk | `L-svc:147-171`, `:273-278` | NOT covered (`LT-between` has 3 chunks, asserts call counts only `:63`, `:77`) -> LR2 | |
| `assetId` / `fileId` taken from the start answer | `L-svc:251-253` | `assetId` used indirectly (`LT-store:220`, `:240`); `fileId` not asserted -> LR2 | |
| status `Uploading` before the first await | `L-svc:230-232` | `LT-once:60-75` | - |
| empty or missing file rejects before any request | `L-svc:244-247` | `LT-store:85-98` | - |
| `updateChunkSize` before each chunk and after a failed attempt, re-read on change | `L-svc:148`, `:187-192` | NOT covered (composable mocked: `LT-store:72`, `LT-once:55`, `LT-between:30`, `LT-hash:29`) -> LR3, LR4 | |
| `useDamUploadChunkSize`: thresholds timeout/5, /4, /2; clamp to min/max; one module-level size; LIB passes no timeout (30) | `L-cs:5-46`, `L-svc:100` | NOT covered -> LR4 | |
| retry: 4 attempts, waits 1/3/9 s, then "max tries exceeded" | `L-svc:21-24`, `:163-198` | NOT covered in LIB -> LR3 | |
| 422 with fields: no retry, field message on the row | `L-svc:181-185`, `:36-61` | NOT covered -> LR3 | |
| 400 on the last attempt: `chunkValidationFailed` | `L-svc:175-178` | NOT covered -> LR3 | |
| missing `fileId` rejects the chunk | `L-svc:124-127` | NOT covered -> LR3 | |
| cancel while rusha loads | `L-svc:241` | `LT-hash:43-54` | - |
| cancel while the start request runs | `L-svc:271` | `LT-hash:56-65` | - |
| cancel between chunks | `L-svc:159` | `LT-between:52-65` | - |
| cancel of the chunk in flight: rejects at once, no retry; abort reaches axios | `L-svc:173`, `L-img:176` | `LT-between:67-78`, `LT-abort:10-26` | - |
| cancel during the retry back-off | `L-svc:173`, `:194` | NOT covered in LIB -> LR3 | |
| cancel after the last chunk, before finish | `L-svc:281` | NOT covered in LIB -> LR3 | |
| cancel while finish runs: stays `Stop`, not polled | `L-api:79-82` | `LT-poll:138-161` | - |
| progress percent per chunk; speed = mean of last 15 samples; remaining time; 1 s tick; `stopSpeedCheck` | `L-svc:107-120`, `:201-227`, `:277`; `L-store:217-221` | NOT covered (no LIB test reads `progress.*`) -> LR2 | |
| speed baseline not reset per attempt (negative sample after a retried chunk) | `L-svc:115-116` | not pinned - drift bug (r4 A.2 #14); my recommendation: do not pin the negative value | |
| two uploads at once | `L-store:33`, `:177-189` | `LT-store:429-449`, `LT-once:68-74`, `LT-store:411-426` | ev / direct |
| the limit is per queue | `L-store:183-184` | NOT covered -> LQ1 | |
| next file starts after a resolve, a failure, a settle | `L-store:201`, `:213`, `:267`, `:299`, `:387`, `:407` | resolve + processed `LT-store:440-448`; removal `:411-426`; after a failure NOT covered -> LR9 | |
| finish request fails: row `Failed`, form off, no message, no alert | `L-store:202-211` | `LT-store:212-226` (status + form); "no message / no alert" not asserted -> LR9 | ev |
| start request fails / chunk gives up: row `Failed` | `L-store:202-214` | NOT covered -> LR9 | |

#### B. Requests

| behaviour | code | covered by |
|---|---|---|
| start: `POST {endPointImage}/licence/{licenceId}`, body `{mimeType, size}`, 201 or reject | `L-img:30-57` | NOT covered -> LR1 |
| chunk: `POST {endPoint}/{fileId}/chunk`, FormData `file` + `chunk = {offset,size}`, `Content-Type: undefined`, `signal`, 201 | `L-img:137-186` | timeout `LT-chunkTimeout:32-39`; client factory `:23-30`; abort `LT-abort:10-26`; URL, form, header NOT covered -> LR1 |
| chunk pre-checks reject (not a Blob, empty, bad size / offset) | `L-img:70-135` | NOT covered -> LR1 |
| finish: `PATCH {endPoint}/{fileId}/uploaded` `{checksum}`, 200 | `L-img:213-241` | NOT covered -> LR1 |
| start / chunk / finish reject for any non-image type | `L-api:24-27`, `:48-51`, `:71-74` | NOT covered -> LR1 |
| the configured client and endpoints are used (UGC: `/ugc/v1/image`, `/ugc/v1/asset`) | `L-svc:31`, `:89`; `L-store:47` | NOT covered: options are mocked to `/image`, `/asset` and no URL is asserted (only the asset id, `LT-refresh:159`) -> LR1, LS1 |
| `fetchAsset` `GET {endPointAsset}/:id`; `fetchAssetByFileId` `GET .../asset-file/:id` | `L-asset:53-87` | NOT covered (mocked everywhere) -> LR1 |
| `fetchAssetListByIds`: 25 ids per call | `L-asset:121-177` | NOT covered -> LR8 |
| `copyToLicence`: batches of 20, more than 50 rejected | `L-img:263-298` | NOT covered (mocked `LT-copyMulti:12-21`, `LT-collab:22-25`) -> LR7 |

#### C. Store transitions per event (r3 C.2) and where LIB and DAM disagree (r3 C.3)

| event x row state | LIB today (code) | covered by | profile |
|---|---|---|---|
| metadata x row without metadata | fields + form on, status untouched (`L-store:417-446`) | `LT-store:173-193`, `:212-221`, `LT-single:235-239` (customData, single-use, form); keywords / authors / `mainFileInternal` / author conflicts / suggestions not asserted -> LS5 | ev |
| metadata x row that has metadata | skipped (`L-store:427`) | `LT-store:173-193` | ev |
| metadata x `Failed` row | skipped (`L-store:425`) | `LT-store:195-209` | ev |
| metadata does not stop the poll | no `clearTimeout` in `L-store:417-450` | `LT-poll:226-242` | ev+poll |
| metadata, asset unreadable (C8, LIB half: silent) | `L-store:447-449` | NOT covered -> LS6 | |
| processed x `Uploading` / `Processing` row | `Uploaded`, error cleared, asset status, preview, switches while no metadata, next upload (`L-store:287-299`) | status + error `LT-store:159-170`; switches `:173-193`; next upload `:429-449`; form stays off until metadata `LT-refresh:98-100`; preview and asset status not asserted -> LS5 | ev |
| processed x copy row (C3, LIB half: settles it) | `L-store:288` | `LT-store:159-170` | ev |
| processed x `Failed` row never given metadata (C2; change (f): LIB is the target) | `L-store:282-286`, `:250-266` | `LT-store:229-249` (one request), `:363-385` (race) | ev |
| processed x `Failed` row that had metadata | form back, typed values kept | `LT-store:252-274`, `:302-336` | ev |
| processed x row whose switch the user set | not overwritten (`L-store:295-298`) | `LT-store:173-193`, `LT-single:303-322` | ev |
| processed, asset unreadable or without a main file (C1, LIB half: unchanged) | `L-store:273`, `:277`, `:308-310` | NOT covered for the event (only `queueItemFullyProcessed`: `LT-poll:209-222`) -> LS6 | |
| processed naming another file of the asset (C4: matched anyway) | `L-store:52`, `:277` | NOT covered -> LS4 | |
| finish request fails after the event settled the row | `L-store:206` | `LT-store:339-360` | ev |
| finish answer does not overwrite a settled row | `L-api:79-82` | `LT-poll:166-193` (status set by hand) | - |
| failed -> `Failed`, reason, form off, next upload | `L-store:396-411` | only by direct call `LT-store:329-330` and refresh `LT-refresh:115`; reason not asserted; **never through the listener** -> LS4, LS8 | direct |
| failed, asset unreadable (C6, LIB half: unchanged) | `L-store:398`, `:412-414` | NOT covered -> LS6 (drift bug r3 #8) | |
| failed x row with an older message (C7: message kept, hides the reason) | `L-store:403-406` | NOT covered -> LS8 (drift bug r3 #8) | |
| failed x `Uploaded` row (flips it) | `L-store:401` | NOT covered -> LS8 | |
| duplicate -> the row becomes the original: `assetId`, `fileId` = origin file, `duplicateAssetId`, metadata, form on (C11, LIB half) | `L-store:359-388` | status + error `LT-poll:257-278`; `isDuplicate` `LT-refresh:114`, `LT-single:291-295`; single-use of the original `LT-single:272-300`; form on `LT-store:302-336`; **id swap, file id, metadata not asserted** -> LS7 | ev / direct |
| duplicate, origin unreadable -> `Processing` rows `Failed` (C12) | `L-store:342-357` | `LT-poll:281-313`, `LT-store:387-406` | direct / ev |
| ... a row settled meanwhile is not flipped | `L-store:349` | NOT covered for duplicate -> LS7 | |
| duplicate without origin file, or not an image -> nothing (C13) | `L-store:338` | NOT covered -> LS6 | |
| copied -> `Uploaded`, file id, metadata once, form | `L-store:452-466` | `LT-store:277-299` | ev |
| copied, asset unreadable -> `Processing` rows `Failed`, timer cleared | `L-store:467-479` | `LT-store:100-117`, `:387-406`; timer `LT-settled:61-74` | ev, ev+poll |
| late failing copied event leaves a settled copy | `L-store:470` | `LT-settled:75-87` | ev+poll |
| manual refresh: file status -> row | `L-refresh:20-38` | `LT-refresh:95-110`, `:112-127`, `:129-141`, `:145-160` | direct |
| refresh reports any duplicate as an image (C19) | `L-refresh:27` | not distinguishable today (LIB rows are images) | |

Orderings pinned on purpose (r3, end of C.3) and where: metadata once `LT-store:173`; failed is not editable `:195`;
failure after metadata takes the form `:212`; recovered row keeps typed values `:252`, `:302`; settled row survives a
late client failure `:339`, `:363`; finish answer does not overwrite `LT-poll:139`, `:167`.

#### D. Polling fallback

| behaviour | code | covered by | profile |
|---|---|---|---|
| armed after finish only when the flag is on and the row is still `Uploading` | `L-api:79-85` | flag on `LT-poll:91-111`; row stopped / settled during finish `:138-193`; **flag off for an upload row NOT covered** (`LT-poll:244` is the copy row) -> LS9 | poll |
| the flag is read from the plugin options for each upload | `L-svc:30-34` | NOT covered (`LT-hash:76` asserts the hash argument only) -> LS9 | |
| armed for a copy row when the flag is on, not when off | `L-store:109-113` | `LT-poll:196-207`, `:244-252`, `LT-store:107-108` | poll |
| a read happens: one `GET asset` per sample | `L-api:110-116` | `LT-poll:91-111`, `:196-207` | poll |
| exact delays and the count of four | `L-api:15-16`, `:98-100` | `LT-poll:107`, `:131`, `:205`, `:220`, `:241` - TBA (e): pinned today, to be rewritten | |
| read `processed` -> `queueItemFullyProcessed`: `Uploaded`, file id, metadata, form | `L-api:120-121`, `L-store:313-330`, `:230-268` | copy row `LT-poll:196-207` (status, file id, count); metadata + form only by direct call `LT-store:135-157`; **an upload row settled by the poll: NOT covered** -> LS1 | poll / direct |
| read `duplicate` -> `queueItemDuplicate` | `L-api:122-123` | NOT covered through the poll -> LS2 | |
| read `failed` -> `queueItemFailed` (a second read) | `L-api:124-125` | NOT covered through the poll -> LS2 | |
| read with another status, or without a main file -> nothing, armed again | `L-api:118`, `:129-131` | status `uploaded` `LT-poll:102-108`; no main file NOT covered -> LS2 | poll |
| a failed read is swallowed, the chain goes on | `L-api:112-116` | `LT-poll:101`, `:108` | poll |
| the settle's own read fails -> still `Processing`, polled again (C15, LIB half) | `L-store:327-329`, `L-api:129-131` | `LT-poll:209-222` | poll |
| nothing more once the row left `Processing` | `L-api:104`, `:129` | removed mid-read `LT-poll:116-134`; failed by an event `LT-settled:61-74`; **a processed event while armed -> no read: NOT covered** -> LS3 | |
| give-up: error flag and text | `L-api:105-109` | `LT-poll:105-109`; that the row stays `Processing` is not asserted - TBA (e) | poll |
| the give-up error is cleared by a later settle | `L-store:224-226`, `:241`, `:289` | `LT-store:159-170`, `:135-157` | ev / direct |
| timer cleared on remove | `L-store:486` | `LT-poll:116-134` | poll |
| timer cleared on stop-one | `L-store:505-512` | NOT covered -> LS10 | |
| timer cleared on stop-all / clear | `L-store:589` | NOT covered -> LS10 | |
| polling lives only while the dialog is open (close -> `stopUpload`) | `L-dlg:88-91`, `L-single:218-222` | NOT covered -> LC3, LC7 | |

#### E. Notification handling

| behaviour | code | covered by |
|---|---|---|
| transport: a message is parsed and emitted as `{name, data}`; nothing is opened or emitted when `enabled` is false or the url is empty | `L-notif:21`, `:44-49`, `:60-66` | NOT covered (`LT-notif:40-99` pins the singleton only) -> LS11 |
| the store subscribes at set-up to five events | `L-store:48-67` | processed `LT-store:166`; metadata `:183`; duplicate `:314`, `LT-poll:269`; copied `LT-store:110`; **failed NOT covered** -> LS4 |
| matching: asset id only, across every queue | `L-store:275-277`, `:401`, `:423`, `:457` | positive cases only; an event for another asset, the same asset in two queues: NOT covered -> LS4 |
| the file id of the event is dropped | `L-store:52`, `:55`, `:58` | NOT covered -> LS4 |
| `asset_file_uploaded`, `asset_file_deleted`, `asset_deleted` and unknown names do nothing | `L-store:50-66` | NOT covered -> LS4 |

#### F. Queue operations

| behaviour | code | covered by |
|---|---|---|
| add files: `File` / `Waiting` row, title, licence, asset type; only images are kept | `L-store:117-142` | rows are created and started in every `addByFiles` case; fields and the filter not asserted (mime helper mocked to image `LT-store:69`) -> LQ1 |
| add throws when the ext system config is missing | `L-store:91-94`, `:120-123` | NOT covered -> LQ1 |
| row keys `file_<name>`, `asset_<id>` (not unique) | `L-store:97`, `:128` | not pinned - known drift (r3 A.3 #1); my recommendation: do not pin the collision |
| add copy: `Asset` / `Processing` / image row with the asset id | `L-store:83-115` | status `LT-store:106`; rest not asserted -> LQ8 |
| the 50 limit (multiple widget only): over the limit asks, "first N" on confirm, cancel resets the file input | `LIB/domains/dam/imageWidget/components/ImageWidgetMultipleLimitDialog.vue:22`, `:52-83` | NOT covered (stubbed `LT-copyMulti:68`) -> LQ5 |
| remove: an active row is stopped and aborted, spliced, counts recalculated | `L-store:485-503` | `LT-store:411-426`, `LT-poll:116-134`; a settled row and the counts after it NOT covered -> LQ4 |
| stop one | `L-store:505-514` | NOT covered -> LQ2 |
| stop all: every row `Stop`, uploading ones aborted, queue replaced, file input key +2 | `L-store:555-597` | NOT covered (cleanup only: `LT-refresh:81`, `LT-single:112`) -> LQ3 |
| counts: processed = `Uploaded` + `Failed` | `L-store:162-169` | `LT-store:95`, `:115`, `LT-poll:206`, `:295` |
| detail save back into the row: keywords, authors, custom data re-read | `L-store:516-541` | only "does not stop the poll" `LT-poll:231`; fields NOT covered -> LQ6. Single-use switch not synced: TBA (d) |
| mass operations: custom value rule | `LIB/domains/dam/uploadQueue/composables/uploadQueueMassOperations.ts:9-24` | `LT-massops:24-51` |
| mass operations: keywords / authors into every row | same file `:26-44` | NOT covered -> LQ7 |
| queues are separate per `queueKey` | `L-store:40` | NOT covered -> LQ1 |

#### G. Metadata save

| behaviour | code | covered by |
|---|---|---|
| bulk PATCH body `{id, keywords, authors, described: true, customData, mainFileSingleUse}` | `L-asset:201-222` | NOT covered - the function is mocked wherever it is reached (`LT-dlgSave:19-22`, `LT-single:31-38`) -> LR5 |
| `mainFileInternal: false`, `mainFileOverrideInternal: false` in that body | `L-asset:215-216`, `:267-268` | not pinned - TBA (c) |
| `mainFileSingleUse` always sent, also `null`; the override argument wins | `L-asset:214` | the single dialog passes the item's switch `LT-single:303-322`; body NOT covered -> LR5 |
| which rows are sent: asset id present and `canEditMetadata` | `L-asset:198-199`, `:207` | buttons `LT-dlgSave:65-73`; validation scope `LT-rowValid:56-122`; the filter itself NOT covered -> LR5 |
| batches of 10, sequential | `L-asset:179-195` | NOT covered -> LR5 |
| nothing to send resolves `[]` with no request; a non-200 rejects | `L-asset:99-111` | NOT covered -> LR5 |
| queue dialog "save": validate, PATCH, "updated" alert | `L-dlg:93-112` | NOT covered -> LC3 |

#### H. Row UI, dialogs, apply, copy to licence

| behaviour | code | covered by |
|---|---|---|
| row is validated only while editable | `L-row:101-103`, `:359` | `LT-rowValid:56-122` |
| uploaded row without metadata: refresh after 20 s, gone when metadata comes | `L-row:186-207` | `LT-rowRefresh:111-127`, `:129-139` |
| uploading / processing row: refresh **and** remove-from-queue after 20 s | `L-row:176-185`, `:297-336` | NOT covered -> LC1 |
| cancel shown for `Loading` / `Waiting` / `Uploading`, not for `Processing` | `L-row:140-147`, `:314-329` | NOT covered -> LC1 |
| failed row: buttons | `L-row:181-185` | TBA (a) - `LT-rowRefresh:129-139` pins only "an uploaded row that fails gets no refresh" |
| edit button disabled without metadata; emits `showDetail` | `L-row:152-155`, `:280-287` | NOT covered -> LC1 |
| duplicate notice line; form stays enabled | `L-row:352`, `:359` | NOT covered in the row -> LC1 |
| error overlay: message, else fail-reason chip, else unknown error | `L-row:242-263` | NOT covered -> LC1 |
| single-use switch only when `mainFileSingleUseEnabled` (UGC passes `false`: `admin-ugc/src/main.ts:52`) | `L-row:419`, `L-list:33` | NOT covered (`LT-single:50` mocks `true`) -> LC10 |
| list: cancel -> `stopItemUpload(queueKey, item, index)`, remove -> `removeByIndex` | `L-list:44-50` | NOT covered -> LC2 |
| list: refresh wired to the asking row | `L-list:36` | `LT-refresh:145-160` |
| list: mass-operations sidebar whenever the list is not empty | `L-list:147` | NOT covered -> LC2 |
| queue dialog: save / apply disabled rules | `L-dlg:72-76`, `:226`, `:239` | `LT-dlgSave:65-79` |
| queue dialog: "save and apply" hidden while any row is unfinished; title and n/N | `L-dlg:63-69`, `:187`, `:221` | NOT covered (store mock reports processed == total, `LT-dlgSave:10-11`) -> LC3 |
| queue dialog: apply emits the uploaded rows mapped to images | `L-dlg:114-147` | asset ids only `LT-dlgSave:81-88`; positions, `damAuthors`, `showDamAuthors`, the custom mapper hook NOT covered -> LC6 |
| `mapUploadMetadataToImages`: description, source from author names, rows without asset or file id dropped, `dam.internal` from the save answer | `LIB/domains/dam/imageWidget/utils/metadataToImageMap.ts:28-98` | NOT covered -> LC5 |
| queue dialog: close stops the queue (confirm while uploading); "+" re-emits files | `L-dlg:88-91`, `:255`, `:301-305`; `LIB/domains/dam/uploadQueue/components/UploadQueueButtonStop.vue:24-39` | NOT covered -> LC3, LC4 |
| files dropped onto the open queue dialog | `L-dlg:317-323` | TBA (b) |
| multiple widget: apply adds the images, closes, stops the queue | `ImageWidgetMultipleInner.vue:402-416` | NOT covered -> LC8 |
| asset list: apply closes, stops, reloads the list | `LIB/domains/dam/assetSelect/components/AAssetListInner.vue:213-217` | NOT covered -> LC8 |
| single dialog: refresh offered, saves disabled until metadata; survives a tab switch | `LIB/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebar.vue:63-78` | `LT-single:182-232` |
| single dialog: the item's own switch is shown and sent | `L-single:239`, `:255`, `:269` | `LT-single:235-251`, `:303-322` |
| single dialog: duplicate notice follows the original | `L-single:243-250`, `:480-486` | `LT-single:272-300` |
| single dialog: author conflicts of the item | | `LT-single:255-267` |
| single dialog: once uploaded the detail is read and the focus tab enabled | `L-single:297-310` | detail set `LT-single:315`; the tab NOT covered -> LC7 |
| single dialog: apply emits one image at position 1, then closes and stops; an empty save answer is an error | `L-single:262-295` | NOT covered -> LC7 |
| single dialog: no refresh for a `Processing` row; error overlay | `UploadQueueDialogSingleSidebar.vue:63-65`, `L-single:424` | NOT covered -> LC7 |
| single widget: apply puts the image into the widget and opens the metadata dialog | `ImageWidgetInner.vue:606-618` | NOT covered -> LC8 |
| drop on a single widget waits for the collab lock, then adds and opens the dialog | `ImageWidgetInner.vue:294-325` | `LT-collab:205-219`, `:303-314`, `:712-729` |
| file picker of the widgets -> add + open | `ImageWidgetInner.vue:344-350`, `ImageWidgetMultipleInner.vue:197-204` | NOT covered -> LC8 |
| copy to licence, multiple widget: `copy` queued, refused reported once | `ImageWidgetMultipleInner.vue:215-235` | `LT-copyMulti:89-108` |
| copy to licence: `exists` is queued and settled as a duplicate at once | same `:225-227`; `ImageWidgetInner.vue:334-336` | NOT asserted (`LT-copyMulti:74` only spies) -> LC8 |
| copy to licence, single widget | `ImageWidgetInner.vue:327-342` | lock only `LT-collab:221-243` -> LC8 |
| mass-operations sidebar: which inputs, which buttons write what | `LIB/domains/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue:32-105`, `:114-125` | NOT covered (form only: `LT-massValid:41`) -> LC9 |
| who may upload; read-only widget | | `damWidgetUploadAccess.test.ts:41-96`, `ImageWidgetInnerExpandMetadata.test.ts:87` |

### 2.2 DAM

#### A. Chunk upload service and upload start

| behaviour | code | covered by |
|---|---|---|
| start -> chunks -> finish | `D-svc:226-280` | `DT-stop:155-165` |
| ids from the start answer; hash to finish; percent per chunk | `D-svc:239-240`, `:270`, `:276` | NOT covered -> DR3 |
| chunk size from the shared composable with `envConfig.dam.apiTimeout` | `D-svc:115`, `:152`, `:184` | composable mocked (`DT-stop:20-24`) -> LR4 (the composable), DR3 (the argument) |
| retry: 4 attempts, 1/3/9 s, no sleep after the last | `D-svc:160-193` | `DT-stop:269-289` |
| 422 with fields: no retry, field message | `D-svc:175-179` | unit NOT covered (`isAxiosError` mocked to false, `DT-stop:25-31`); e2e `E2E/tests/errors/errorPaths.spec.ts:198-230` -> DR3 |
| speed is never negative after a retry; a retry is measured over its own time | `D-svc:121-135`, `:164-167` | `DT-stop:85-114`, `:118-151` |
| cancel: between chunks, in the back-off, while reading, while start runs, on the last chunk, in flight | `D-svc:151-154`, `:189`, `:241-246`, `:267`, `:274`, `:282-286` | `DT-stop:167-183`, `:185-209`, `:211-233`, `:235-249`, `:251-267`, `:291-304` |
| cancel while finish runs | `D-api:196-200` | `DT-poll:91-108` (x4 types) |
| a missing file rejects; a 0-byte file is started | `D-svc:228-235` | NOT covered -> DR3 |
| two uploads at once | `D-store:387-401` | `DT-slot:191-205`, `:449-463`; freed by a settle `:295-312`; by a removal `:508-527` |
| an import row takes a slot, runs `importInit`, then the next starts | `D-store:440-446` | service `DT-ext:47-115`; the store branch NOT covered -> DQ5 |
| client failure: message, `Failed`, form off | `D-store:467-479` | `DT-slot:612-629`, `:631-650` |
| one alert per distinct message | `D-store:468-482` | NOT covered -> DR5 |
| nothing on `Stop`; nothing when already `Uploaded` | `D-store:460-466` | `Uploaded` `DT-slot:726-742`; `Stop` NOT covered -> DR5 |
| `resolveUploadErrorMessage`: forbidden operation, validation, unknown | `D-svc:57-77` | NOT covered (mocked `DT-slot:41`, `DT-lazy:32`) -> DR4 |

#### B. Requests

| behaviour | code | covered by |
|---|---|---|
| start URL (licence or slot), body, 201 - four types | `D-img:40-67` and siblings | unit NOT covered; e2e against the real API (`E2E/tests/upload/upload*.spec.ts`, slots `audioSlots.spec.ts:85`) -> DR1 |
| chunk form, timeout, signal, multipart header | `D-img:69-112` | NOT covered -> DR1 |
| finish PATCH | `D-img:114-137` | NOT covered -> DR1 |
| dispatch per type: finish | `D-api:202-241` | `DT-poll:69-123` |
| dispatch per type: start, chunk, external import; an unsupported type rejects | `D-api:77-112`, `:243-294`, `:296-334` | NOT covered -> DR2 |
| external import `POST .../licence/{id}/external-provider` `{id, externalProvider}` | `D-img:159-183` | unit NOT covered; e2e `externalProviderUnsplash.spec.ts:72`, `:89` -> DR1 |
| bulk metadata body, the one flag when known, batches of 10 from what is sent | `D-asset:171-205` | `DT-bulk:40-94` |
| bulk rejects when nothing is sent or on a non-200 | `D-asset:207-228` | buttons `DT-saveNothing:95-101`; the API NOT covered -> DR6 |
| `fetchAssetListByIds`: 25 per call, rejects for no ids | `D-asset:81-123` | NOT covered (mocked `DT-lazy:5-10`) -> DR6 |

#### C. Store transitions per event (r3 C.1)

| event x row state | code | covered by |
|---|---|---|
| metadata -> fields + form, once | `D-store:618-648` | `DT-slot:572-586`, `:346-366` |
| metadata unreadable -> warning on the row; not on a row with metadata, a duplicate, a failed row (C8, DAM half) | `D-store:596-616` | `DT-slot:314-329`, `:331-344`, `:549-569`, `:588-609` |
| metadata x duplicate: skipped (C9) | `D-store:623` | `DT-slot:549-569` |
| metadata x failed: skipped, except a mass-edit row that failed for want of it | `D-store:627-628` | `DT-slot:588-609`, `:745-760`, `:762-776` |
| metadata x slot row -> fills the open detail's `mainFile` when it is `null` | `D-store:649-656` | NOT covered -> DS7 |
| processed: which rows match | `D-store:492-508` | `DT-slot:105-145`, `:147-169`, `:207-233`, `:235-259` |
| processed settles before and without the read (C1, DAM half) | `D-store:514-546` | `DT-slot:262-291` |
| processed x mass-edit row: status untouched, decorated, switch kept (C3) | `D-store:519`, `:559` | `DT-slot:147-169` |
| processed x failed row that had metadata -> form back | `D-store:522-524` | `DT-slot:653-675` |
| processed x failed row without metadata -> `Uploaded`, no form (C2, DAM half) | `D-store:522` | `DT-slot:678-696` - TBA (f): to be flipped, do not extend |
| processed x duplicate / failed mass-edit row -> no form | | `DT-slot:700-723` |
| processed clears the error unless a metadata warning stands | `D-store:527-532` | `DT-slot:368-402`, `:314-329` |
| processed decoration: asset status; preview and switch only for the main file | `D-store:551-562` | asset status `DT-slot:165`; switch `:779-796`; preview and the main-file gate NOT covered -> DS8 |
| processed frees the slot | `D-store:533` | `DT-slot:295-312` |
| failed: matched rows only, no request, reason | `D-store:567-585` | `DT-slot:171-189`, `:420-446` |
| failed empties the message, drops the metadata warning, also flips an `Uploaded` row (C7, DAM half) | `D-store:572-579` | NOT covered directly -> DS8 |
| duplicate: settled read-only before the read; still settled with an unreadable origin (C11, C12) | `D-store:671-709` | `DT-slot:404-416`, `:700-723` |
| duplicate decorated from the origin file - file id, original asset id, switch, preview - for each asset type | `D-store:689-721` | NOT covered (`fetchImageFile` answers `null`, `DT-slot:19`; the other three are bare `vi.fn()`, `:17-21`) -> DS5 |
| duplicate x mass-edit row without a file id: not matched (C10) | `D-store:505` | failed only `DT-slot:171-189`; duplicate NOT covered -> DS5 |
| a settled row survives a late client failure | `D-store:466` | `DT-slot:726-742` |
| manual refresh | `D-list:29-53` | NOT covered -> DS1 |
| mass-edit row a file event failed, then processed: error cleared, status stays `Failed` | `D-store:519`, `:527-532` | status and form only `DT-slot:700-723`; the cleared error not asserted (r3 F.14) -> DS8 |

#### D. Polling fallback

| behaviour | code | covered by |
|---|---|---|
| armed after finish (four types) only with the flag on and the row still `Uploading` | `D-api:196-200` | `DT-poll:70-122` (x4), `:126-140` |
| armed after an external import whatever the flag | `D-ep:15-18`, `D-api:185-191` | `DT-ext:47-59`, `DT-poll:142-155` |
| arming refuses a row that is not `Processing` | `D-api:186` | NOT covered -> DS2 |
| a read happens | `D-api:143` | `DT-poll:110-122` |
| exact schedule and give-up time | `D-api:73-74`, `:114-116` | `DT-poll:211-229` - TBA (e): pinned today, to be rewritten |
| read `processed` -> `queueItemProcessed(asset, file)`, plus metadata unless a slot row or one that has it | `D-api:152-159` | `DT-poll:110-122`, `:266-281` |
| read `duplicate` -> with the origin file and the row's file id | `D-api:160-168` | `DT-poll:283-296` |
| read `failed` -> `queueItemFailed(asset, reason, file)` | `D-api:169-171` | NOT covered -> DS2 |
| "is it our file": a slot whose file is not the main one -> nothing | `D-api:149-150` | `DT-poll:157-170` |
| another status, or no main file -> nothing, armed again | `D-api:150`, `:175-179` | NOT covered explicitly -> DS2 |
| a failed read does not end the chain | `D-api:144-147` | `DT-poll:172-186` |
| stops on `Stop` / `Failed` / `Uploaded`, checked before and after the read | `D-api:119-126`, `:175` | `DT-poll:188-209`, `:231-249` |
| give-up text: slot wording / general wording | `D-api:127-138` | slot `DT-poll:227-228`; general NOT covered -> DS2 |
| what the real store holds after a `processed` read; metadata read fails -> `Uploaded` + warning, no more polls (C15, DAM half) | `D-api:153-159` with `D-store:510-662` | NOT covered together -> DS3 |
| timer cleared by remove, stop-one, stop-all, clear, each settle | `D-store:352`, `:408`, `:426`, `:517`, `:572`, `:674`, `:739` | NOT covered at the store (`DT-poll:231-249` covers the status check in the callback) -> DS3, DQ2 |

#### E. Notification handling

| behaviour | code | covered by |
|---|---|---|
| processed / failed / duplicate carry the file id | `D-listen:30-43` | `DT-listen:56-72` |
| metadata event -> `queueItemMetadataProcessed(asset)` | `D-listen:44-46` | NOT covered -> DS4 |
| distribution x4, authorised, user updated | `D-listen:47-67` | NOT covered -> DS4 |
| registered once; taken off when the connection cannot open | `D-listen:18-27`, `:71-77` | `DT-listen:76-113` |
| matching rules | `D-store:492-508` | section C |

#### F. Queue operations, metadata save

| behaviour | code | covered by |
|---|---|---|
| add files: every enabled type, unique key per file, current licence | `D-store:161-187`, `:67-69` | NOT covered -> DQ1 |
| the 50 limit and the over-limit dialog | `DAM/domains/coreDam/asset/components/AssetUpload.vue:53-58`, `:94-101`; `DAM/shared/utils/BetaTestFeaturesService.ts:4` | NOT covered -> DQ4 |
| remove by asset through the teardown | `D-store:333-361` | `DT-slot:508-527` |
| stop one, by identity | `D-store:423-436` | `DT-slot:466-480`, `:495-506` |
| stop one / remove call the stop handle and abort | `D-store:353`, `:427-431` | NOT covered -> DQ2 |
| stop all | `D-store:403-421` | NOT covered -> DQ2 |
| clear without stopping (mass edit) | `D-store:737-749` | NOT covered (mocked `DT-detailReq:44`, `DT-extList:42`) -> DQ2 |
| detail save back into the rows, single-use included | `D-store:804-815` | NOT covered -> DQ3 |
| mass operations | `D-store:751-802` | `DT-lazy:136-202`, `DT-massSidebar:85-123` |
| metadata save | | section B, `DT-bulk` |

#### G. Row UI and overlays

| behaviour | code | covered by |
|---|---|---|
| row validated only while editable | `D-row:103-105` | `DT-rowValid:101-163` |
| cancel for `Loading` / `Waiting` / `Uploading` / `Processing` / `Failed` | `D-row:203-215` | NOT covered -> DC1 |
| refresh: after 20 s while running (status re-read when the timer fires); at once on an uploaded row with an error; after 20 s on an uploaded row without metadata, never for a duplicate; never on failed / stopped | `D-row:220-270` | NOT covered -> DC1 |
| trash: disabled unless metadata or duplicate; deletes the asset, then removes the row by asset id | `D-row:167-177`, `:416-422` | unit NOT covered; e2e `assetBulkEdit.spec.ts:172-190` -> DC1 |
| edit hidden for a duplicate; duplicate overlay with the link | `D-row:304-328`, `:369` | NOT covered -> DC1 |
| error overlay: message, else chip, else unknown | `D-row:329-359` | e2e `errorPaths.spec.ts:221-225` -> DC1 |
| list: cancel -> `stopItemUpload(queueId, item)`, remove -> `removeByAssetId`; sidebar only for more than one row | `D-list:59-65`, `:111` | NOT covered -> DC1 |
| compact row: cancel statuses, the text behind the icon | `DAM/domains/coreDam/asset/components/queue/AssetQueueItemList.vue:27-65` | unit NOT covered; e2e duplicate icon `licenceDuplicatePage.ts:16-18`, failed icon `errorPaths.spec.ts:221` -> DC2 |
| overlays: save disabled when nothing would be sent | `AssetFooterUploadOverlayFull.vue:64`, `AssetFooterSelectedFull.vue:52` | `DT-saveNothing:95-101` |
| upload overlay: "save and close" hidden while unfinished; save -> validate -> PATCH -> list reload; close -> stop | `DAM/domains/coreDam/asset/components/footer/AssetFooterUploadOverlayFull.vue:54-61`, `:74-113`, `:166` | unit NOT covered; e2e `pages/shared/upload.ts:147-156` -> DC4 |
| mass-operations sidebar | | `DT-massSidebar:85-123` |

#### H. DAM only

| behaviour | code | covered by |
|---|---|---|
| slot add: `SlotFile` row with asset, slot name, type | `D-store:189-216` | NOT covered -> DQ1 |
| slot lookup answers the newest upload | `D-store:131-145` | `DT-slot:483-493`, `:529-535` |
| slot events match by file id only | `D-store:504` | `DT-slot:105-145`, `:247-258`, `:420-433` |
| slot row in the asset detail: progress row while unfinished, list re-read when the upload leaves | `AssetSlotListItem.vue:73-92` | unit NOT covered; e2e `audioSlots.spec.ts:85-89`, `assetSlotActions.spec.ts:61-77`, `imageAssetEmpty.spec.ts:54` -> DC3 |
| slot upload over the limit confirms through `addByFiles` | `AssetUpload.vue:94-101` | NOT covered; looks like a defect (r5 side findings) - listed, not to pin |
| slot overlay: stop / clear | `DAM/domains/coreDam/asset/components/footer/AssetFooterUploadSlotsOverlay.vue:43` | NOT covered -> DC5 |
| mass edit: rows `Loading` -> `Uploaded` / `Failed` by the batch | `D-store:218-264`, `:308-331` | `DT-lazy:87-133`, `DT-slot:745-760` |
| mass edit: row fields (file id, switch, list preview) | `D-store:231-237` | NOT covered -> DQ1 |
| mass edit: selection add / remove / clear, limit of 50 | `DAM/domains/coreDam/asset/components/list/composables/assetListActions.ts:343-383`, `:463` | tiles follow the queue `DT-detailReq:573-589`; add and limit NOT covered -> DQ6 |
| mass edit save | `AssetFooterSelectedFull.vue:62-100` | buttons `DT-saveNothing`; e2e `assetBulkEdit.spec.ts:111-194`, `assetBulkEditKeywords.spec.ts:110-138` |
| external import: service outcomes | `D-ep:6-40` | `DT-ext:47-115` |
| external rows: import (`Waiting`) or selection (`Uploaded`), preview, provider name | `D-store:266-301` | NOT covered -> DQ1 |
| external import limits; a selection goes to `global` and empties `edit` | `DAM/domains/coreDam/externalProvider/composables/externalProviderAssetImport.ts:25-74` | unit NOT covered; e2e `externalProviderUnsplash.spec.ts:72-107` -> DQ4 |
| three queues: the same asset in two queues; every handler walks all queues | `D-store:514`, `:569`, `:599`, `:671` | NOT covered -> DS6 |
| the parallel limit is per queue | `D-store:393` | NOT covered -> DS6 |
| non-image types: finish | | `DT-poll:69-123` |
| non-image types: start / chunk dispatch, duplicate origin read | | unit NOT covered; e2e `uploadAudio/Video/Document.spec.ts` -> DR2, DS5 |
| upload without the socket, end to end | | `uploadNotificationFallback.spec.ts:32-52`, marked `test.fail()` -> DS9 |

---

## 3. Proposed characterization tests

Two rules for all of them:

- **Mock at the HTTP edge, drive the real store and the real poll.** The tests that survive the rewrite are the ones
  that do not name the seam being removed. `LT-store` mocks `@/domains/dam/api/uploadApi` (`:40`) and `DT-poll` mocks
  the store (`:29`): both sit on the import cycle the shared core removes (`LIB/test/importCycles.test.ts:100-108`),
  so they will need new mocks whatever happens. New settlement tests should mock only `damImageApi` + `damAssetApi`
  (LIB) or `assetApi` + the four type APIs (DAM) and the listener, as `LT-poll` and `LT-settled` already do.
- **Timers.** LIB: no fake timers; patch `window.setTimeout` for waits >= 10 s as `LT-poll:70-83` does, and assert
  "a long wait was armed" (`polls.length > 0`), never its length. DAM: fake timers, advance far enough for one read
  (`vi.advanceTimersByTimeAsync(20_000)` as `DT-poll:118`), assert "at least one read".

### 3.1 Settlement (first to be rewritten)

| id | file | asserts | mocks |
|---|---|---|---|
| **LS1** | new `LIB/domains/dam/uploadQueue/__tests__/uploadSettlementWithoutSocket.test.ts` | UGC profile: flag on, the listener is never called. `addByFiles('q', 1, 1, [file])` -> start called once with the configured image endpoint -> row `Uploading` -> after finish `Processing` and a long wait armed -> a read of `GET asset` answering `processed` -> row `Uploaded`, `fileId` still the start's, `assetStatus`, `imagePreview`, keywords / authors / customData / switches from that read, `canEditMetadata` true, no error, processed count == total. Variant: first read `stored`, later read `processed` -> settles on the later one. Variant with three files: the third starts when the first finishes. The read goes to the configured asset endpoint with the row's asset id | `rusha`; `damImageApi` (start -> ids, chunk -> `{}`, finish -> `{}`); `damAssetApi` all exports; options with `endPointImage: '/ugc/v1/image'`, `endPointAsset: '/ugc/v1/asset'`, flag on; listener captured but unused; `damConfigState`; `mimeTypeHelper`; `damUploadChunkSize` |
| **LS2** | `LT-poll`, new `describe('what a poll read applies')` | table over the file status of the read, on an upload row and on a copy row: `duplicate` -> row is a duplicate, `Uploaded`, editable, `fetchAssetByFileId` asked with `originAssetFile`; `failed` -> `Failed` with the read's `failReason`, form off; `stored` / `uploading` / no `mainFile` / no `fileAttributes` -> row unchanged and another long wait armed; after any settle no further wait is armed | as `LT-poll` |
| **LS3** | `LT-poll` | CMS profile, flag on: (1) a processed event while the wait is armed settles the row and no read by the poll follows; (2) a failed event likewise; (3) a metadata event during `Uploading` opens the form while the status stays `Uploading`, and the poll still settles the file later (`LT-poll:226` has this for copies only) | as `LT-poll` |
| **LS4** | new `LIB/domains/dam/uploadQueue/__tests__/uploadNotificationEvents.test.ts` | each of the five event names delivered through the listener reaches its handler: `asset_file_failed` -> `Failed` with the event's `failReason` (the missing one); an event for another asset changes nothing; rows of the same asset in two queues are both settled; an event whose `id` names another file still settles the row (today's rule, r3 C4); `asset_file_uploaded`, `asset_file_deleted`, `asset_deleted` and an unknown name do nothing and ask for nothing | as `LT-poll`, flag off |
| **LS5** | `LT-store`, new `describe('what a read asset gives a row')` | one full asset fixture, three entry points (processed event; `queueItemFullyProcessed`; copied event): `assetStatus`, `imagePreview` from `mainFile.links.image_detail`, `fileId` only when the row had none, `keywords`, `authors`, `customData`, `mainFileSingleUse`, `mainFileInternal`, `authorConflicts`, the queue's suggestion sets. For the processed event on a row without metadata: only status, asset status, preview and the two switches | as `LT-store` |
| **LS6** | `LT-store` | unreadable asset: on a processed event, a failed event, a metadata event -> the row is exactly as before (status, error, form). Asset without `mainFile` on processed -> unchanged. Duplicate event without `originAssetFile`, or with a non-image type -> unchanged, no request | as `LT-store` |
| **LS7** | `LT-store` | duplicate with a readable original: `assetId` becomes the original's, `fileId` the origin file, `duplicateAssetId`, metadata of the original, `canEditMetadata` true, `isDuplicate`; an unreadable original does not flip a row that is already `Uploaded` | as `LT-store` (`fetchAssetByFileId` answering another asset id) |
| **LS8** | `LT-store` | failed: the reason lands in `error.assetFileFailReason`; a message already on the row stays (today, r3 C7); an `Uploaded` row is flipped to `Failed`; the next waiting file starts | as `LT-store` |
| **LS9** | `LT-poll` + `LT-hash` | `damUploadFinish(..., false)` on an `Uploading` row -> `Processing`, no long wait armed, no read. In `LT-hash`: the sixth argument of `damUploadFinish` is the option's `uploadStatusFallback`, for both values | as the two files |
| **LS10** | `LT-poll` | a copy row with a wait armed: `stopItemUpload` and `stopUpload` each leave no later read (as `:117` does for remove) | as `LT-poll` |
| **LS11** | `LT-notif` | with `enabled: false`, and with `enabled: true` and an empty url: `openConnection()` constructs no `WebSocket` and sets `damNotificationsInitialized`. With a url: a message `{eventName, data: '<json>'}` reaches `addDamNotificationListener` as `{name, data}`; an empty `data` arrives as `undefined` | global `WebSocket` stub that records construction and exposes `onmessage` |
| **DS1** | new `DAM/test/queue/queueRefresh.test.ts` | mounts `AssetQueueEditable` with the row stubbed, emits `refreshItem`: `assetStatus with_file` -> `queueItemProcessed(asset)` with no file id, then `queueItemMetadataProcessed` only while the row has no metadata; main file `duplicate` -> `queueItemDuplicate(asset, origin, real asset type)`; `failed` -> `queueItemFailed(asset, reason)`; anything else -> warning `common.damImage.queueItem.stillUploadingOrProcessing`; `refreshDisabled` true while it runs and false after a failed read; `with_file` is tested before `duplicate` (today's order, r3 C18) | `assetApi.fetchAsset`; store by path with spies (as `DT-saveNothing:11-17`); `useAlerts` |
| **DS2** | `DT-poll` | read `failed` -> `queueItemFailed('asset-1', reason, 'file-main')`; an upload row (type `file`) gives up with `system.uploadErrors.processingTooLong`; `armNotificationFallback` on a row that is not `Processing` arms nothing; a read with status `stored`, and one without `mainFile`, call no store action and a later read follows | as `DT-poll` |
| **DS3** | new `DAM/test/fallback/fallbackSettlesQueue.test.ts` | real `fileApi` **and** real store: an upload row in `global`, finish answered, one poll read `processed` -> row `Uploaded`, then its metadata and form (two store calls); metadata read fails -> row `Uploaded` with `system.uploadErrors.metadataFailed`, form off, no further read; the same for an external-import row with the flag off; `removeByAssetId`, `stopItemUpload`, `stopUpload`, `clearQueue` on an armed row each leave no further read | `assetApi`, four type APIs, upload service as `DT-slot:27-42`; `envConfig` |
| **DS4** | `DT-listen` | `asset_metadata_processed` -> `queueItemMetadataProcessed('asset-1')`; the four distribution events -> `listItemMessageUpdate(id, status)`; `distribution_authorized` -> `authorizationMessage(service, success)`; `user_updated` -> `fetchCurrentUser(damClient, '/adm/users/current')`; `asset_file_copied` and unknown names call nothing | distribution store and `useAuth` with spies |
| **DS5** | `DT-slot` | duplicate with a readable origin file: `fileId`, `duplicateAssetId`, `mainFileSingleUse` from the file's flag, preview; one case per asset type proving which of the four file APIs is asked; a mass-edit row without a file id is not made a duplicate | `fetchImageFile` etc. answering a file |
| **DS6** | `DT-slot` (new `describe('one asset in two queues')`) | the same asset as an upload row in `global` and a mass-edit row in `edit`: processed with the file id settles the first and only decorates the second; failed with that file id fails the first only; metadata fills the first and leaves the second (already editable); two waiting rows in each of two queues -> two started per queue | as `DT-slot`, seeding two queue ids |
| **DS7** | `DT-slot` | a slot row and the asset detail store holding that asset with `mainFile: null`: the metadata event writes the read asset's main file into the detail and leaves the row untouched; with another asset open, or a main file already there, nothing is written | real or stubbed `assetDetailStore` |
| **DS8** | `DT-slot` | processed: preview and switch taken only when the row's file is the main file; `assetFileFailReason` reset with the error. Failed: `error.message` emptied, metadata warning dropped, an `Uploaded` row flipped. A failed mass-edit row after a processed event: error cleared, status still `Failed` (today, r3 F.14) | as `DT-slot` |
| **DS9** | `E2E/tests/upload/uploadNotificationFallback.spec.ts` and two new specs beside it | first establish whether `test.fail()` at `:33` still holds (section 6). Then, with the socket silenced as at `:38`: an upload finishes and "save and close" works; a slot upload (expected to hang today - mark it as the known gap, as `:33` does); an external import finishes | real environment |

### 3.2 Requests and service

| id | file | asserts | mocks |
|---|---|---|---|
| **LR1** | new `LIB/domains/dam/__tests__/damImageApiUploadRequests.test.ts` (beside `LT-chunkTimeout`) | with a fake client `{post, patch, get}` and endpoint `/ugc/v1/image`: start -> `POST /ugc/v1/image/licence/7` body `{mimeType, size}`; a `SlotFile` row with slot and asset -> the slot URL; non-201 rejects. Chunk -> `POST .../file-1/chunk`, FormData with `file` and `chunk === '{"offset":0,"size":5}'`, header `Content-Type: undefined`, the item's `signal`; an empty Blob, a non-integer size, a negative offset reject without a request. Finish -> `PATCH .../file-1/uploaded` body `{checksum}`; non-200 rejects. `damUploadStart/Chunk/Finish` reject for a non-image row. `fetchAsset` / `fetchAssetByFileId` URLs under `/ugc/v1/asset` | `useSentry` if it needs the plugin; nothing else |
| **LR2** | new `LIB/domains/dam/uploadQueue/__tests__/uploadServiceSequence.test.ts` | a 3000-byte file at 1024 per chunk: one start, chunks with offsets 0 / 1024 / 2048 and sizes 1024 / 1024 / 952, each chunk a `File` with the source's name and type, `hash.update` three times, finish with the digest; `assetId` and `fileId` from the start answer; the callback reports rising percentages and a non-negative speed after two progress events | as `LT-between` (`uploadApi`, `rusha`, options, chunk size) |
| **LR3** | new `LIB/domains/dam/uploadQueue/__tests__/uploadServiceRetry.test.ts` | a chunk that always fails with a plain error is tried 4 times, then rejects (waits shortened by patching `setTimeout` for >= 1000 ms - do assert there were three of them, this schedule is not under change); 422 with `fields.size` -> one attempt, row message set; 400 on every attempt -> four attempts, `chunkValidationFailed` message; a cancelled chunk is not retried; Stop set during a back-off wait -> no further attempt; Stop after the last chunk -> no finish; a row without `fileId` rejects | as `LT-between` |
| **LR4** | new `LIB/domains/dam/uploadQueue/__tests__/damUploadChunkSize.test.ts` | pure: `null` speed -> false; a chunk slower than timeout/2 shrinks to `timeout/2 x speed`; faster than timeout/5 grows to `timeout/4 x speed`; clamped to the config's min and max; default timeout 30; a second instance starts from the last size (module-level). Serves DAM too - it imports this composable | `damConfigStore` with `imageChunkConfig` |
| **LR5** | new `LIB/domains/dam/__tests__/damAssetApiBulkMetadata.test.ts` | fake client `{patch}`: body per row has `id`, `keywords`, `authors`, `described: true`, `customData`, `mainFileSingleUse` (also when `null`; the override argument replaces it) - asserted with `toMatchObject` so the two internal fields stay unpinned (change (c)); rows without asset id or with `canEditMetadata` false are left out; 23 editable rows -> three PATCHes of 10 / 10 / 3 to `{endPointAsset}/metadata-bulk-update`; nothing to send -> resolves `[]`, no request; a non-200 rejects. Same shape check for `updateAssetMetadata` | none beyond the client |
| **LR7** | new `LIB/domains/dam/__tests__/damImageApiCopyToLicence.test.ts` | 45 items -> three PATCHes of 20 / 20 / 5 to `{endPoint}/copy-to-licence`, answers flattened; 51 items reject without a request | fake client |
| **LR8** | new `LIB/domains/dam/__tests__/damAssetApiListByIds.test.ts` | 60 ids -> three GETs of 25 / 25 / 10 to `{endPoint}/licence/{id}/ids/a,b,...`; no ids -> `[]` without a request. Worth having before any batch poll is built on it | fake client |
| **LR9** | `LT-store` | start rejects -> row `Failed`, `error.message` still empty, form off, counted as processed, the next waiting file starts; the same when a chunk gives up | as `LT-store` |
| **DR1** | new `DAM/test/upload/uploadRequests.test.ts` | `describe.each` over image / audio / video / document: start URL `/adm/v1/<type>/licence/1` and the slot URL for a `slotFile` row, body `{mimeType, size}`; chunk URL, FormData parts, `timeout: 420000`, the row's `signal`, multipart header; finish PATCH `{checksum}`; `externalProviderUpload` -> `POST .../licence/1/external-provider` `{id, externalProvider}`; non-201 / non-200 reject | `damClient` -> `{post, patch}` as `DT-bulk:8` |
| **DR2** | new `DAM/test/upload/fileApiDispatch.test.ts` | `uploadStart`, `uploadChunk`, `externalProviderUpload` call the API of the row's asset type and no other; an unknown type rejects with `fileApi: unsupported asset type` | the four type APIs by path, as `DT-poll:17-28` |
| **DR3** | `DT-stop` | `uploadInit` writes `assetId` / `fileId`; finish receives a 40-character hex digest; progress percent reaches 100; a 422 with fields ends after one attempt with the field message (un-mock `isAxiosError` for this case); a row without a file rejects; a 0-byte file is started and finished with no chunk (today, r4 A.2 #18) | as `DT-stop` |
| **DR4** | new `DAM/test/upload/uploadErrorMessage.test.ts` | `resolveUploadErrorMessage`: forbidden-operation answer with a known `detail` -> its translation key, unknown detail -> `error.apiForbiddenOperation.noTranslation`; validation answer -> field messages joined; anything else -> `system.uploadErrors.unknownError` | none (keys come back as keys, as in `DT-lazy:103`) |
| **DR5** | `DT-slot` | three uploads failing with the same message -> `showError` once; a different message -> a second alert; a failure on a row already `Stop` changes nothing and alerts nothing | `useAlerts` spy through the partial library mock |
| **DR6** | `DT-bulk` | nothing to send -> rejects without a PATCH; a 500 in the second batch rejects. `fetchAssetListByIds`: 60 ids -> 25 / 25 / 10, no ids rejects | as `DT-bulk` |

### 3.3 Store queue operations

| id | file | asserts | mocks |
|---|---|---|---|
| **LQ1** | new `LIB/domains/dam/uploadQueue/__tests__/uploadQueueOperations.test.ts` | `addByFiles`: a row per image file with type `File`, title = file name, the licence given, status leaving `Waiting`; a non-image file is skipped (un-mock `mimeTypeHelper`, give a real ext-system config); a missing ext-system config throws; two queue keys keep separate rows, counts and two uploads each | as `LT-store`, upload held |
| **LQ2** | same file | `stopItemUpload` on an uploading row: aborted, removed, next waiting file starts, counts updated; on a waiting row: removed, never started | as `LT-store` |
| **LQ3** | same file | `stopUpload`: every row `Stop`, uploading ones aborted, `getQueueItems` empty, counts 0, the queue's `fileInputKey` two higher than before; on an unknown or empty queue nothing happens; `getQueueItemsTypes` | as `LT-store` |
| **LQ4** | same file | `removeByIndex` of an `Uploaded` row keeps its status and updates the counts; an out-of-range index does nothing | as `LT-store` |
| **LQ5** | new `LIB/domains/dam/imageWidget/__tests__/ImageWidgetMultipleLimitDialog.test.ts` | 49 queued + 3 picked -> dialog opens, nothing added; confirm adds exactly one file; cancel adds none and moves the file input key; 10 + 5 -> added at once, `afterAdd` emitted | store with a spy on `addByFiles`; inject `ImageWidgetUploadConfigKey` as `LT-copyMulti:53-60` |
| **LQ6** | `LT-store` | `updateFromDetail`: keywords, authors, custom data of every row of that asset replaced by the re-read; a failed re-read changes nothing. No assertion on `mainFileSingleUse` (change (d)) | as `LT-store` |
| **LQ7** | `LT-massops` | keywords and authors: fill only rows whose list is empty; replace on request; today into rows of every asset type | as `LT-massops` |
| **LQ8** | `LT-store` | `addByCopyToLicence`: `Asset` / `Processing` / image row with the asset id, no file, no title; a missing ext-system config throws | as `LT-store` |
| **DQ1** | new `DAM/test/queue/queueAdd.test.ts` | `addByFiles`: one row per file whose mime type the ext system knows, of that asset type, current licence; two files of one name get different keys; an unknown type is skipped. `addByFilesAsSlotUpload`: `slotFile` row with asset id, slot name, the type given. `addByAssets`: `fileId` from the main file, the asset's switch, the list preview. `addByExternalProviderAsset`: `Uploaded` for a selection, `Waiting` and started for an import; provider name, preview url | as `DT-lazy` (`useDamConfigState` through the partial library mock) |
| **DQ2** | `DT-slot` | `stopUpload`: rows `Stop`, stop handles called, queue emptied, file input key +2. `clearQueue` alone: queue emptied, key +1, nothing stopped, a queue that did not exist is created. `stopItemUpload` calls the row's stop handle | `useUpload` returning a spy as `stop` (`DT-slot:37`) |
| **DQ3** | `DT-slot` | `updateAssetMetadata(asset)`: keywords, authors, custom data **and** `mainFileSingleUse` copied into every row of that asset, in every queue, with no request | as `DT-slot` |
| **DQ4** | new `DAM/test/upload/assetUploadLimit.test.ts`, new `DAM/test/queue/externalProviderImportLimit.test.ts` | `AssetUpload`: 48 queued + 5 picked -> dialog, confirm adds 2; a slot instance calls `addByFilesAsSlotUpload` with its asset, slot and type. Import: one more at the limit -> warning, nothing added; a selection that fits exactly is taken, then `edit` is cleared | store by path with spies; `useAuth`; `useDamConfigState` |
| **DQ5** | `DT-slot` | an `externalProviderAsset` row started by the queue calls `importInit`, not `useUpload`; when it resolves the next waiting row starts | `externalProviderImport` returning a controllable `importInit` (`DT-slot:22-24`) |
| **DQ6** | `DT-detailReq` | toggling a tile adds it to `edit` / removes it by asset id; at 50 selected nothing is added | as `DT-detailReq:38-44` with spies |

### 3.4 Components

| id | file | asserts | mocks |
|---|---|---|---|
| **LC1** | new `LIB/domains/dam/uploadQueue/__tests__/uploadQueueRowStates.test.ts` | table over the row state, as mounted in `LT-rowRefresh:57-104`: `Waiting` -> cancel, no refresh, edit disabled; `Uploading` -> cancel, and after the 20 s wait refresh + remove; `Processing` -> **no** cancel, after the wait refresh + remove; `Uploaded` with metadata -> edit enabled, none of the three; duplicate -> notice line, form enabled; error with a message -> the message; with only a fail reason -> the chip; neither -> the unknown-error text. Clicks emit `cancelItem {index,item,queueKey}`, `removeItem(index)`, `showDetail(assetId)`. The `Failed` state is left out (change (a)) | as `LT-rowRefresh` |
| **LC2** | `LT-refresh` (its second `describe`) | the row's `cancelItem` reaches `stopItemUpload(queueKey, item, index)`, `removeItem` reaches `removeByIndex`; `showDetail` is re-emitted; the sidebar renders for one row and not for an empty queue | as `LT-refresh` |
| **LC3** | `LT-dlgSave` | with one row unfinished the "save and apply" button is absent and the title shows n/N; "save" touches validation, calls the bulk save with the rows and alerts "updated"; an invalid form sends nothing; the stop button's `confirm` calls `stopUpload` and clears the open-dialog ref; the file input's `files-input` is re-emitted as `filesInput` | as `LT-dlgSave`, store mock with real counts |
| **LC4** | new `LIB/domains/dam/uploadQueue/__tests__/UploadQueueButtonStop.test.ts` | not uploading -> a click emits `confirm` at once; uploading -> a dialog, confirm emits, cancel does not | none |
| **LC5** | new `LIB/domains/dam/imageWidget/__tests__/metadataToImageMap.test.ts` | description = trimmed `customData.description` of the save answer, else empty; source = names of the answer's authors joined by ", ", fetched once and only when there are ids; a row without asset id or file id is dropped; `dam.damId` = row file id, `licenceId` as given, `dam.internal` = the answer's `mainFileInternal` (note for change (c): the mapper reads this from the **answer**, `metadataToImageMap.ts:42`, `:92`) | `authorApi.fetchAuthorListByIds` |
| **LC6** | `LT-dlgSave` | apply: items carry rising `position` from the image store, `damAuthors`, `showDamAuthors` true only without authors; when the options carry `customUploadMetadataToImageMap` it is called instead of the default mapper (UGC passes one, `admin-ugc/src/main.ts:65`) | as `LT-dlgSave` |
| **LC7** | `LT-single` | `saveAndApply`: `apply` emitted with one image at position 1, then the queue is stopped and the dialog ref cleared; an empty save answer emits nothing and the dialog stays; once the row is uploaded the focus tab is offered; a `Processing` row shows no refresh button (today, r1 L4); the stop button's confirm empties the queue and the detail | as `LT-single` |
| **LC8** | new `LIB/domains/dam/imageWidget/__tests__/ImageWidgetUploadApply.test.ts` | multiple widget: the dialog's `apply` adds the images to the image store, clears the dialog ref, stops the queue; file input -> limit check -> dialog ref set. Single widget: `apply` puts the first image into the widget store (keeping the current id) and opens the metadata dialog; file input -> `addByFiles` + dialog ref; copy answer `exists` -> `addByCopyToLicence` and `queueItemDuplicate(targetAsset, targetMainFile, image)`. Asset list: `apply` clears, stops and re-reads the list | as `LT-copyMulti`, dialogs stubbed, store spies |
| **LC9** | new `LIB/domains/dam/uploadQueue/__tests__/massOperationsSidebar.test.ts` | keyword / author inputs only when the ext system enables them for images; "fill" and "replace" call the composable with `forceReplace` false / true; "clear" empties the scratch form | composable by path, as `DT-massSidebar` does for the store |
| **LC10** | `LT-rowRefresh` or `LC1` | with `mainFileSingleUseEnabled: false` the row has no switch; with the default it has | as `LT-rowRefresh` |
| **DC1** | new `DAM/test/queue/queueRowStates.test.ts` | table as LC1 for `AssetQueueItemEditable`, mounted as `DT-rowValid:102-121`: cancel for the five statuses and not for `Uploaded`; refresh after 20 s while running, at once for `Uploaded` with an error, after 20 s for `Uploaded` without metadata, never for a duplicate, never for `Failed` / `Stop`; trash disabled unless metadata or duplicate; trash click -> `deleteAsset(assetId)` then `removeItem(assetId)`; edit absent for a duplicate; duplicate overlay present. In `AssetQueueEditable`: cancel -> `stopItemUpload(queueId, item)`, remove -> `removeByAssetId`; sidebar only for two or more rows | as `DT-rowValid`; `assetApi.deleteAsset`; fake timers |
| **DC2** | new `DAM/test/queue/queueListRow.test.ts` | `AssetQueueItemList`: spinner for waiting / uploading / loading / processing; cancel for the five statuses; the icon's text is the fail-reason title when there is a reason, else the message | fail-reason composable |
| **DC3** | new `DAM/test/queue/slotUploadRow.test.ts` | `AssetSlotListItem`: with an unfinished row for its slot and asset the progress row is shown in place of the file; when that row becomes `Uploaded` or leaves the queue `refreshList` is emitted once | store by path with a reactive `getQueueItemForSlotItem` |
| **DC4** | `DT-saveNothing` | upload overlay: "save and close" absent while a row is unfinished; save -> PATCH with the list, list reload, alert; save and close -> also `stopUpload('global')`; an invalid form sends nothing. Mass-edit overlay: save and close -> `clearQueue('edit')` | as `DT-saveNothing`, `assetApi.bulkUpdateAssetsMetadata` spy |
| **DC5** | new `DAM/test/queue/slotsOverlay.test.ts` | stop -> `stopUpload('slots')`; "clear" hidden while a row is unfinished | store by path |

---

## 4. Listed, but **not** to be pinned - target behaviour to be agreed

| | what | where it is today | already pinned by a test? |
|---|---|---|---|
| (a) | LIB failed row gets Refresh + Remove only because the running-row timer is not re-checked; a row that fails without ever uploading (0-byte file) has no button | `L-row:176-185`, `:297-336`; `L-svc:244-247` | no. `LT-rowRefresh:129-139` pins only that an *uploaded* row that fails gets no refresh; `LT-store:85-98` pins the store side of the 0-byte file. Leave the `Failed` row out of LC1 |
| (b) | files dropped onto the open LIB queue dialog are discarded | `L-dlg:317-323`; hosts bind no `@drop` (`ImageWidgetMultipleInner.vue:706-717`, `AAssetListInner.vue:425-435`) | no (`LT-dlgSave:38` stubs the dropzone). Add nothing |
| (c) | LIB sends `mainFileInternal: false`, `mainFileOverrideInternal: false` in the metadata PATCH | `L-asset:215-216`, `:267-268` | LIB: no. DAM pins the target already - "sends only the fields this form edits" `DT-bulk:40-55`. LR5 must use `toMatchObject` so it does not pin them |
| (d) | LIB does not copy the single-use switch into the row after a detail save | `L-store:516-541` against `D-store:811` | no (`LT-single:235-251` is about the detail *load*, not the save). LQ6 asserts the other three fields only; DQ3 pins DAM's side |
| (e) | the poll's schedule (reads at +10 / +50 / +140 / +300 s, text at +550 s, row left `Processing`) | `L-api:15-16`, `:98-109`; `D-api:73-74`, `:114-139` | **yes, in both repos**: `LT-poll:107`, `:131`, `:205`, `:220`, `:241`; `DT-poll:218-228`. These lines are to be rewritten to "a read happens / an error is said"; new tests (LS1-LS3, LS9, LS10, DS2, DS3) assert reads and what they apply, never the delays |
| (f) | a failed row the server finished after all: form at once (LIB) or after refresh (DAM); LIB is the target | `L-store:282-286` against `D-store:522-524` | LIB target pinned: `LT-store:229-249`, `:363-385`. DAM pins the opposite: `DT-slot:678-696` - to be flipped with the change; add no further DAM test of "no form" |

Related, not on the list above but in the same spirit (my reading, the lead decides): LS6's "failed event with an
unreadable asset leaves the row alone" and LS8's "old message kept" are LIB drift bugs that report 3 proposes to
port away (r3 P3). Pinning them is cheap and makes the port show up as a deliberate red test; if that is unwanted,
drop those two assertions.

---

## 5. Priority order

**P1 - settlement (polling + notification + "apply the asset read to the row").**

1. **LS1** - the only test that would notice the UGC profile breaking; nothing covers an uploaded file settled by the poll.
2. **LS2** - the poll's `duplicate` / `failed` / "not yet" answers in LIB.
3. **LS4** - every event through the listener, incl. the untested `asset_file_failed`, and the matching rule.
4. **LS5** - the field-by-field result of applying a read asset to a row (the function being rewritten).
5. **DS1** - DAM's manual refresh, entirely untested.
6. **DS3** - DAM's poll with the real store, incl. the metadata-read-fails end state and timer clearing.
7. **DS2** - DAM's poll: `failed` answer, general wording, arm guard.
8. **LS6 + LS7** - unreadable asset / missing main file / duplicate becomes the original.
9. **DS5 + DS6** - DAM duplicate decoration per type; one asset in two queues.
10. **DS4** - DAM listener: metadata, distribution, authorisation, user events (all socket-only today).
11. LS3, LS9, LS10, LS11, LS8, DS7, DS8.
12. DS9 (e2e) - as soon as someone can run it; it is the acceptance test of "works without the socket".

**P2 - requests and service.** LR5 (bulk payload, the one request that writes data and is mocked everywhere) ->
LR1 / DR1 (start / chunk / finish shapes and endpoints) -> LR3 (LIB retry) -> LR2 -> LR4 -> DR2, DR3, DR4, DR5 ->
LR9, LR7, LR8, DR6.

**P3 - store queue operations.** LQ3, LQ2 (stop-all, stop-one: untested in LIB) -> DQ2 -> DQ1, LQ1 -> LQ5, DQ4
(the 50 limit) -> DQ3, LQ6 -> DQ5, DQ6, LQ4, LQ7, LQ8.

**P4 - components.** LC5 + LC6 + LC8 (apply into the CMS widgets) -> LC1, DC1 (row states) -> LC3, LC7, DC4 ->
DC3, DC2, LC2, LC4, LC9, LC10, DC5.

---

## 6. Could not determine from reading

- **Whether any of the existing tests pass.** Nothing was run.
- **Whether `test.fail()` in `uploadNotificationFallback.spec.ts:33` is stale.** The spec predates the fallback fixes
  (`f823337a` against `13812f57`), the `KNOWN-BUGS.md` it names is not in the repo, and the outcome depends on the
  deployed `uploadStatusFallback` value of the environment the suite targets (`E2E/.env.dist`: devel), which is not
  in the repository.
- **Whether the slot e2e specs really depend on the socket.** `uploadIntoSlot` waits for a re-read of the slot list
  (`assetSlotsPage.ts:226-232`); the only code path I found that re-reads it after an upload is the watcher that
  fires when the queue row settles (`AssetSlotListItem.vue:88-92`), and a slot row is settled only by an event
  naming its file (`D-store:504`). Inferred; another trigger of that request may exist.
- **Backend facts several proposed pins lean on:** whether a duplicate's asset can have `assetStatus = with_file`
  (DS1 pins DAM's order of checks either way); whether a duplicate event can come without an origin file (LS6);
  what core-dam answers to `size: 0` (DR3); whether the bulk answer always carries `mainFileInternal` (LC5).
- **Real chunk bytes and the real hash are checked nowhere.** LIB mocks `rusha` in every service test
  (`LT-hash:12`, `LT-between:7`, `LT-store:13`); DAM runs the real `rusha` over zero-filled buffers from a stubbed
  `FileReader` (`DT-stop:38-54`). Whether a unit test can read a real `File` under happy-dom was not tried.
- **Whether the proposed LIB tests can mock `damAssetApi` partially.** `LT-poll:24` says `importOriginal` stalls
  the browser runner there because of the import cycle, while `LT-store:56-60` does use it. I did not establish
  which combinations of mocks are safe; the proposals follow the "all exports spelled out" form where the real
  `uploadApi` is loaded.
- **Tests in the consuming admins (CMS, UGC).** Out of scope here; UGC's own `customUploadMetadataToImageMap` and
  its `/ugc/v1` endpoints are covered by no LIB test (LC6, LR1, LS1 are the nearest).
- **`AssetQueueSelectedSidebar` in LIB, `ExternalProviderAssetQueue*Readonly`, the DAM footer view-state composables**
  were not read line by line; their rows in section 2 rest on report 5 and on greps for test references.
