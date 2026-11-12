# Frontend dependency on notification-server (WebSocket push) — map of today's state

Read-only analysis, 2026-10-07. Nothing was changed, built or run. Every statement was read at the cited line unless it is marked **(inferred)**.

## Legend

Repositories (all on branch `next`):

| alias | path |
|---|---|
| `LIB/` | `/home/volar/projects/anzusystems/common-admin/` |
| `DAM/` | `/home/volar/projects/anzusystems/admin-dam/` |
| `CMS/` | `/home/volar/projects/petit/admin-cms/` |
| `UGC/` | `/home/volar/projects/petit/admin-ugc/` |
| `DAMDEPLOY/` | `/home/volar/projects/petit/admin-dam/` (deploy wrapper of admin-dam, branch `chore/ignore-playwright-cli`, `github.version` = 1.28.0) |
| `VUEUSE` | `LIB/node_modules/@vueuse/core/dist/index.js` (15.0.0, the library's own dependency) |

Most cited files:

| alias | file |
|---|---|
| `L-notif` | `LIB/src/domains/dam/composables/damNotifications.ts` |
| `L-bus` | `LIB/src/domains/dam/composables/damNotificationsEventBus.ts` |
| `L-opts` | `LIB/src/domains/dam/composables/commonAdminCoreDamOptions.ts` |
| `L-api` | `LIB/src/domains/dam/api/uploadApi.ts` |
| `L-store` | `LIB/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts` |
| `L-row` | `LIB/src/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue` |
| `L-queueDlg` | `LIB/src/domains/dam/uploadQueue/components/UploadQueueDialog.vue` |
| `L-singleDlg` | `LIB/src/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue` |
| `L-singleSide` | `LIB/src/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebar.vue` |
| `L-refresh` | `LIB/src/domains/dam/uploadQueue/composables/uploadQueueItemRefresh.ts` |
| `D-listen` | `DAM/src/domains/system/composables/appNotificationListeners.ts` |
| `D-api` | `DAM/src/domains/coreDam/asset/api/fileApi.ts` |
| `D-store` | `DAM/src/domains/coreDam/asset/store/uploadQueuesStore.ts` |
| `D-row` | `DAM/src/domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue` |
| `D-queue` | `DAM/src/domains/coreDam/asset/components/queue/AssetQueueEditable.vue` |
| `D-listRow` | `DAM/src/domains/coreDam/asset/components/queue/AssetQueueItemList.vue` |
| `D-slot` | `DAM/src/domains/coreDam/asset/components/detail/components/slots/AssetSlotListItem.vue` |
| `D-dist` | `DAM/src/domains/coreDam/asset/store/distributionListStore.ts` |

Queue item statuses: `loading, waiting, uploading, processing, failed, uploaded, stop` (`LIB/src/domains/dam/types/UploadQueue.ts:33-41`). Server file statuses: `uploading, uploaded, stored, duplicate, processed, failed` (`LIB/src/domains/dam/types/AssetFile.ts:4-10`).

---

## 0. The ten facts that matter most

1. **The poll is a 4-sample backstop, not a poll loop.** Both copies read the asset at **+10 s, +50 s, +140 s, +300 s** after the finish response and at **+550 s** only write an error text; the item stays `processing` for good (`L-api:15-16,98-109`; `D-api:73-74,114-139`). Both schedules are pinned by tests (`LIB/src/domains/dam/uploadQueue/__tests__/uploadStatusFallback.test.ts:107-108`; `DAM/src/test/fallback/notificationFallback.test.ts:218-228`).
2. **The poll starts only after the finish request.** The socket's `asset_metadata_processed` arrives while the file is still being sent and opens the metadata form then (`L-store:209` comment, `D-store:341-342` comment — backend timing itself **inferred** from those comments). Without the socket the form opens only after the file is fully processed *and* a poll sample hits.
3. **DAM slot uploads cannot be settled by the poll** unless the slot's file is the asset's main file (`D-api:148-150`, `D-store:502-504`); DAM's own changelog says "a slot upload usually needs its notification" (`DAM/doc/changelog/3.0.0.md:90`).
4. **Distribution statuses, YouTube authorisation and `user_updated` have no fallback at all** (`D-listen:47-67`; no timer, no poll anywhere in `D-dist`).
5. **LIB's single-file dialog (the one `AImageWidget` uses, i.e. most of CMS) has no manual refresh for a `processing` item** (`L-singleSide:63-65`), yet the give-up text tells the user to "use the item's refresh button" (`LIB/src/locales/en/common/damImage.json:212`).
6. **One `processing` item blocks "Save and apply" / "Save and close" for the whole queue**, because those buttons are `v-if="isFinished"` and `processing` is not counted as processed (`L-queueDlg:67-69,220-221`, `L-store:162-169`; `DAM/src/domains/coreDam/asset/components/footer/AssetFooterUploadOverlayFull.vue:54-56,165-166`, `D-store:730-735`).
7. **Once the socket fails 5 reconnects it is dead for the rest of the page's life** (`L-notif:33-35`, `VUEUSE:8432-8443`); nothing calls `openConnection()` again (`D-listen:19`, `CMS/src/App.vue:22-27`).
8. **No batching:** one timer and one `GET /asset/:id` per item per sample (`L-api:91-96,113`; `D-api:143,177-179`). A batch read exists (`…/asset/licence/:licenceId/ids/:ids`, 25 ids per call: `LIB/src/domains/dam/api/damAssetApi.ts:29,121-138`; `DAM/src/domains/coreDam/asset/api/assetApi.ts:61,89`).
9. **All four option fields are required in the public type and have no defaults** (`LIB/src/AnzuSystemsCommonAdmin.ts:91-102`, `L-opts:85-90`); `createDamNotifications` dereferences `notification.enabled` / `notification.webSocketUrl.length` unguarded (`L-notif:21`).
10. **admin-dam's deploy template has no `uploadStatusFallback` key** (`DAMDEPLOY/public/config.json.cf.dist:1-26`) and admin-dam overwrites its in-code default `true` with whatever the json holds (`DAM/src/shared/EnvConfigService.ts:11,46`) → `undefined` → fallback off. In the same template `notification.enabled` is a quoted string (`DAMDEPLOY/public/config.json.cf.dist:20`), so `"false"` would be truthy in `L-notif:21`.

---

## 1. Event table

Names: `L-bus:13-28`. Payload shapes: file events `{ id, asset, status, failReason, assetType, originAssetFile }` (`L-bus:42-49`), deleted file `{ id, asset }` (`L-bus:37-40`), asset deleted `{ asset }` (`L-bus:58-60`), distribution `{ id, asset, assetFile, status }` (`L-bus:51-56`), authorised `{ distributionService, success }` (`L-bus:117-123`), user updated `undefined` (`L-bus:125`).

Transport: `L-notif:44-49` parses `event.data` as JSON, parses `message.data` again when it is non-empty, and emits `{ name: message.eventName, data }` on a module-global VueUse event bus (`L-bus:7-11`). The LIB listener is registered when the Pinia store `commonUploadQueuesStore` is first instantiated (`L-store:36,48-67`); DAM's listener is registered once from the router guard (`DAM/src/domains/system/composables/appInitialize.ts:136-140` → `D-listen:18-27`).

DAM does **not** instantiate the LIB upload store: it mounts only `AAssetSelect` and `ADamAssetImageRoiSelect` from the DAM part of the library (`DAM/src/domains/coreDam/asset/components/ImagePreview.vue:183`, `.../slots/AssetSibling.vue:82`, `DAM/src/domains/coreDam/extSystem/components/ExtSystemTtsSettingsForm.vue:110`), and the LIB store is used only by `AAssetListInner` and the image widgets (`LIB/src/domains/dam/assetSelect/components/AAssetListInner.vue:193`, `LIB/src/domains/dam/imageWidget/components/ImageWidgetInner.vue:314`, `ImageMediaWidgetInner.vue:323`, `ImageWidgetMultipleInner.vue:224`) — **inferred** from those greps.

| # | event | LIB listener | DAM listener | handler does | user sees |
|---|---|---|---|---|---|
| 1 | `asset_file_processed` | `L-store:51-53` → `queueItemProcessed(asset)` `L-store:270-311` | `D-listen:30-32` → `queueItemProcessed(asset, fileId)` `D-store:510-565` | **LIB:** `GET asset` first (`:272`); every item with that `assetId`: clear fallback timer, `status = uploaded`, clear error, `assetStatus`, thumbnail `image_detail`, switches if metadata not yet loaded (`:287-298`); a row the client had marked `failed` is revived with metadata (`:282-286`). **DAM:** settle first without a request (`:514-536`: clear timer, `uploaded` unless a mass-edit row `:519`, clear error), then `GET asset` to decorate (`:538-564`). Matching by asset+file via `notificationMatches` (`D-store:492-508`). | Spinner on the tile becomes the done mark, thumbnail appears, counter advances, title turns "done" when all are processed; "Save and apply/close" appears (`L-queueDlg:221`; `AssetFooterUploadOverlayFull.vue:166`). LIB single dialog: detail is fetched and the ROI tab enabled (`L-singleDlg:297-310`). DAM slot tab: the progress row gives way to the file after a list refetch (`D-slot:73-77,88-92`). |
| 2 | `asset_file_failed` | `L-store:54-56` → `queueItemFailed` `L-store:396-415` | `D-listen:33-35` → `queueItemFailed(asset, failReason, fileId)` `D-store:567-585` | **LIB:** `GET asset` first (`:398`); then `failed`, `failReason`, form off; if that GET throws nothing is marked (`:412-414`). **DAM:** no request; `failed`, reason, form off. | Error overlay with the fail-reason chip (`L-row:241-271`; `D-row:329-359`); the item counts as processed. |
| 3 | `asset_file_duplicate` | `L-store:57-59` → `queueItemDuplicate` `L-store:332-394` | `D-listen:36-43` → `queueItemDuplicate(asset, originAssetFile, assetType, fileId)` `D-store:664-722` | **LIB:** images only (`:338`); `GET asset/asset-file/:origin` (`:341`); the row becomes the **original** asset (`assetId`, `fileId`, metadata, `canEditMetadata = true`, `:362-387`); failure of that GET fails the row (`:342-357`). **DAM:** settle first (`uploaded`, `isDuplicate`, form **off** `:675-677`), then fetch the origin file for link + thumbnail (`:688-721`). | "Duplicate" notice; LIB row is editable as the original (`L-row:351-358`), DAM row shows a warning overlay with a link to the original (`D-row:304-328`). |
| 4 | `asset_file_uploaded` | — | — | No listener in either repo (only the definition, `L-bus:17`). | Nothing. |
| 5 | `asset_file_deleted` | — | — | No listener (`L-bus:18`). | Nothing. |
| 6 | `asset_metadata_processed` | `L-store:60-62` → `queueItemMetadataProcessed` `L-store:417-450` | `D-listen:44-46` → `queueItemMetadataProcessed(asset)` `D-store:587-662` | `GET asset`; once per row: keywords, authors, custom data, switches, suggestions, author conflicts, `canEditMetadata = true` (`L-store:423-440`; `D-store:620-648`). Skips failed rows (`L-store:425`; `D-store:627-628`), DAM also duplicates (`:623`). DAM slot rows: sets the open detail's `mainFile` if it was `null` (`D-store:649-656`). Neither clears the fallback timer. | The row's form, its "edit asset" button and (single dialog) both save buttons become enabled (`L-row:283,359`; `LIB/.../UploadQueueDialogSingleSidebarMetadata.vue:86,95`; `D-row:372,419,437`). |
| 7 | `asset_deleted` | — | — | No listener (`L-bus:20`). | Nothing. |
| 8 | `distribution_distributing` | — | `D-listen:47-49` → `listItemMessageUpdate(id, Distributing)` `D-dist:50-60` | Sets `status` on the list row with that id, no request. | Status chip in the Distribution tab changes (`DAM/.../distribution/DistributionListItemJw.vue:58`, `...Youtube.vue:58`, `...Custom.vue:68-69`). |
| 9 | `distribution_remote_processing` | — | `D-listen:50-52` → same, `RemoteProcessing` | As above. | As above. |
| 10 | `distribution_distributed` | — | `D-listen:53-55` → `listItemMessageUpdate(id, Distributed)` `D-dist:61-70` | `GET distribution`, replaces the list row. | Chip turns "distributed", the distributed-only rows appear (`DistributionListItemJw.vue:74`), Redistribute availability changes (`DistributionListItem.vue:41-48`). |
| 11 | `distribution_failed` | — | `D-listen:56-58` → same, `Failed` | As 10. | Chip + fail reason (`DistributionListItemJw.vue:69-71`). |
| 12 | `distribution_authorized` | — | `D-listen:59-61` → `authorizationMessage(service, success)` `D-dist:38-48` | Sets the service's auth status `Success`/`Error`. | YouTube dialog leaves the login prompt and loads its form (`DAM/.../distribution/DistributionNewDialogYoutube.vue:239-249,272,417-441`). |
| 13 | `user_updated` | — | `D-listen:62-67` | `fetchCurrentUser(damClient, '/adm/users/current')`. | Permissions / licences of the signed-in user refresh without a reload. |
| 14 | `asset_file_copied` | `L-store:63-65` → `queueItemCopied` `L-store:452-480` | — | `GET asset`; settles the copy row as `uploaded` with file id, thumbnail and metadata (`settleWithMetadata`, `L-store:230-268`); a failed GET fails the row (`:468-478`). | The "copy to licence" row finishes. |

Totals: LIB listens to 5 names, DAM to 10; `asset_file_uploaded`, `asset_file_deleted`, `asset_deleted` have no listener anywhere in LIB or DAM (grep over both `src/` trees found only the definitions). CMS and UGC register no listener of their own (grep: only `CMS/src/App.vue:3,16`).

---

## 2. Life without the socket, today

### 2.1 The socket itself

- `createDamNotifications` (`L-notif:18-82`): `enabled = notification.enabled && notification.webSocketUrl.length > 0` (`:21`); `useWebSocket(url, { immediate: false, autoClose: false, autoConnect: false, autoReconnect: { retries: 5, delay: 5000, onFailed } })` (`:28-43`).
- Nothing connects until `openConnection()` (`:60-67`); with `enabled` false it only sets `damNotificationsInitialized` and returns (`:62-63`). That ref is read nowhere else (grep).
- Reconnect: on every non-explicit close VueUse retries while `retried < 5`, 5 s apart, else calls `onFailed` once (`VUEUSE:8432-8443`); `retried` is reset only on a successful open (`VUEUSE:8427`) or an explicit `open()` (`VUEUSE:8477-8482`). After `onFailed` no further attempt is scheduled.
- `onFailed` → 3 s later `showWarning('common.damImage.notificationsNotConnected')` (`L-notif:36-42`). So the warning shows roughly 25–30 s after the connection is lost or never established (5 × 5 s + 3 s + connect times), **once**, and only when `enabled` is true.
- Who opens it: DAM `D-listen:21,72` (guarded to once per document, `:19`), CMS `CMS/src/App.vue:16,25`, LIB playground `LIB/src/playground/App.vue:42-45`. The library itself never calls it. UGC, blog, forum, inhouse: no call (grep).
- A malformed URL throws synchronously from `new WebSocket` (`VUEUSE:8421`); DAM catches it and carries on (`D-listen:71-77`, `appInitialize.ts:136-140`). CMS has no catch around `openConnection()` in `onMounted` (`CMS/src/App.vue:22-27`).
- `JSON.parse` in `onMessage` is unguarded (`L-notif:46-47`).

### 2.2 The fallback in LIB, exactly

**Armed in two places, both behind `uploadStatusFallback`:**
1. After the finish request answers, only if the item is still `uploading`: `item.status = processing; if (uploadStatusFallback) armNotificationFallback(...)` (`L-api:75-85`). The flag is read per upload from the plugin options (`LIB/src/domains/dam/uploadQueue/composables/uploadService.ts:30-34`).
2. For each "copy to licence" row, right after it is added in status `processing` (`L-store:95-114`).

**Schedule** (`delay = 10 s × try²`, `try` starts at 1: `L-api:98-100`, `LIB/src/domains/dam/uploadQueue/factory/UploadQueueItemFactory.ts:56`):

| timer fires at | `try` | action |
|---|---|---|
| +10 s | 1 | `GET {endPointAsset}/:assetId` (`L-api:113`) |
| +50 s | 2 | GET |
| +140 s | 3 | GET |
| +300 s | 4 | GET |
| +550 s | 5 | no request: `error.hasError = true`, message `uploadErrors.processingTooLong`; no further timer; **status unchanged** (`L-api:105-109`) |

**Per server answer** (`L-api:118-127`, only if `asset.mainFile.fileAttributes` exists):

| `mainFile.fileAttributes.status` | store call | result |
|---|---|---|
| `processed` | `await queueItemFullyProcessed(asset.id)` `L-store:313-330` | a **second** `GET asset` (`:315`), then `settleWithMetadata` (`:230-268`): `uploaded`, error cleared, `fileId`, `assetStatus`, thumbnail, metadata loaded once, `canEditMetadata = true` |
| `duplicate` | `await queueItemDuplicate(asset.id, mainFile.originAssetFile, assetType)` `L-store:332-394` | `uploaded` + `isDuplicate`, row becomes the original; or `failed` if the origin cannot be read |
| `failed` | `await queueItemFailed(asset.id, failReason)` `L-store:396-415` | a second `GET asset`; `failed` with reason |
| `uploading` / `uploaded` / `stored` | — | nothing |
| request failed | — | swallowed (`L-api:112-116`), the try still counts |

Then: if the item is no longer `processing` the chain ends; otherwise `try++` and re-arm (`L-api:128-131`). If the inner GET of `queueItemFullyProcessed`/`queueItemFailed` fails (swallowed in the store: `L-store:327-329,412-414`), the item is still `processing` and the chain goes on (pinned: `uploadStatusFallback.test.ts:209-222`).

**Terminal states reachable by the fallback:** `uploaded` (with metadata), `uploaded`+duplicate, `failed`. **Non-terminal end:** `processing` + error text, for good.

**Timer is cleared** on every settle (`L-store:238,287,350,363,402,472`), on removal/stop (`:486`) and when the queue is cleared (`:589`); the dialogs clear the queue on close (`L-queueDlg:88-91`, `L-singleDlg:218-222`), so LIB polls only while the dialog is open.

**Manual refresh** (`L-refresh:20-38`): `GET asset`; `processed` → `queueItemFullyProcessed`, `duplicate` → `queueItemDuplicate(…, DamAssetType.Image)`, `failed` → `queueItemFailed`, else a warning toast "still uploading or being processed" (`:31`). It does not re-arm the fallback.
- Queue dialog row: the refresh button **and** a "remove from queue" button appear 20 s after the row enters `uploading` or `processing` (the timer restarts on each of those transitions), and 20 s after `uploaded` without metadata (`L-row:176-199,297-313,330-336`; `L-refresh:11`). Cancel is offered only for `loading/waiting/uploading`, not `processing` (`L-row:140-147`).
- Single-file dialog: refresh only for `uploaded && !canEditMetadata` after 20 s (`L-singleSide:63-77`). **Nothing for `processing`.**

### 2.3 The fallback in DAM, exactly

**Armed in two places:**
1. After the finish request of any of the four asset types, only if still `uploading`: `startProcessing` → `if (envConfig.uploadStatusFallback) armNotificationFallback(item)` (`D-api:196-200,202-241`). It reads `envConfig` directly, not the plugin option.
2. External-provider import, **not behind the flag**: after the import POST answers and the item is still `uploading` → `processing` + `armNotificationFallback` (`DAM/src/domains/coreDam/shared/services/upload/externalProviderImportService.ts:11-19`; reason in `D-api:182-184`: the item has no ids until then, so an earlier notification matches nothing).

`armNotificationFallback` refuses anything but `processing` (`D-api:185-191`).

**Schedule:** identical constants and formula (`D-api:73-74,114-116`) → GET at +10 / +50 / +140 / +300 s; at +550 s the error text, `processingTooLongSlot` for a slot row and `processingTooLong` otherwise (`D-api:127-139`); status unchanged.

**Per server answer** (`D-api:141-173`). Precondition `isOurFile = asset.mainFile && (item.fileId === null || asset.mainFile.id === item.fileId)` (`:149-150`):

| `mainFile.fileAttributes.status` | store call (not awaited) | result |
|---|---|---|
| `processed` | `queueItemProcessed(asset.id, item.fileId)` `D-store:510-565`; plus, unless a slot row or metadata already there, `queueItemMetadataProcessed(asset.id)` `D-store:587-662`; then `return` (`D-api:152-159`) | `uploaded` at once; two more `GET asset` (`D-store:540,595`); if the metadata GET fails the row is `uploaded` with error `metadataFailed`, form off (`D-store:596-616`) and offers refresh at once (`D-row:233-238`) |
| `duplicate` | `queueItemDuplicate(asset.id, originAssetFile, assetType, item.fileId)`; `return` (`D-api:160-168`) | `uploaded` + duplicate, form off |
| `failed` | `queueItemFailed(asset.id, failReason, item.fileId)`; `return` (`D-api:169-171`) | `failed` with reason, no request |
| other status, no main file, or main file is another file | — | nothing |
| request failed | — | logged (`D-api:144-147`), the try still counts |

Then: stop if `uploaded/stop/failed` (`D-api:119-122,175`), else `try++` and a new timer (`:176-179`).

**Manual refresh** (`D-queue:29-53`), full queue view only: `GET asset`; **`asset.attributes.assetStatus === with_file`** → `queueItemProcessed(asset.id)` + `queueItemMetadataProcessed` when the row has no metadata; else `duplicate` / `failed` by main-file status; else the same warning toast. Button after 20 s in `uploading/processing`, at once for `uploaded` with an error, after 20 s for `uploaded` without metadata (`D-row:132,217-258`). Cancel is offered for `loading/waiting/uploading/processing/failed` (`D-row:203-215`).
- Compact list rows and slot rows (`D-listRow`) have **no refresh**, only Cancel (`D-listRow:54-65,110-129`).

### 2.4 Per event: the message never arrives

(a) = `uploadStatusFallback` true, (b) = false.

| event | (a) fallback on | (b) fallback off |
|---|---|---|
| `asset_file_processed` | **LIB:** settled by a sample at +10/+50/+140/+300 s, with metadata. Never if processing ends after +300 s. **DAM:** same for the main file; external import too; a slot file that is not the main file: never (§2.5 D4). | **LIB:** `processing` for good, no error text ever. Queue dialog: per-row refresh after 20 s. Single dialog: nothing (the changelog says so: `LIB/doc/changelog/2.0.0.md:109` "for good in the single-file dialog, which offers none to a processing item"). **DAM:** `processing` for good except external import; refresh in the full view, Cancel elsewhere (pinned: `notificationFallback.test.ts:126-140`). |
| `asset_file_failed` | Shown as failed at the next sample (LIB needs a second GET, `L-store:398`). | Looks like endless processing; the reason appears only on manual refresh. |
| `asset_file_duplicate` | Settled as duplicate at the next sample. | Endless processing until manual refresh. |
| `asset_metadata_processed` | If the socket is absent altogether: metadata is loaded together with the processed state (`L-store:250-266`; `D-api:156-158`) — i.e. only after processing. If only this one message is lost while `asset_file_processed` arrives: the processed handler clears the timer (`L-store:287`; `D-store:517`), nothing polls; row `uploaded` with a disabled form until the refresh button, 20 s later (`L-row:186-196`, `L-singleSide:63-77`, `D-row:242-249`). | Same as the lost-single-message case. With no socket at all: see row 1. |
| `asset_file_copied` (LIB) | Polled like an upload, first sample +10 s after the row is created (`L-store:109-113`). | `processing` for good (`L-store:109` comment); queue dialog refresh only. The row is created only after the copy request answers (`LIB/.../ImageWidgetInner.vue:432-435,327-342`), so an event that beat the response matched nothing even with the socket (**inferred** race). |
| `distribution_distributing` / `_remote_processing` / `_distributed` / `_failed` (DAM) | No fallback exists. The list keeps the status it was fetched with. | Same. |
| `distribution_authorized` (DAM) | No fallback. Dialog stays on the login prompt. | Same. |
| `user_updated` (DAM) | No fallback. Current user stays as loaded at start-up (`appInitialize.ts:81`). | Same. |
| `asset_file_uploaded`, `asset_file_deleted`, `asset_deleted` | No listener → no difference. | No difference. |

### 2.5 Every flow that hangs or degrades without the socket, fallback ON

`[HANG]` = needs a manual step or never resolves; `[SLOW]` = resolves by itself, later; `[STALE]` = shows old data.

**Library (CMS, UGC):**

- **L1 `[SLOW]` Metadata form of a row.** Disabled until the file is processed and a sample hits, i.e. ≥ 10 s after finish, instead of during the upload (`L-row:359`, "edit asset" `L-row:283`; arming only after finish `L-api:83-84`; samples act only on processed/duplicate/failed `L-api:120-126`).
- **L2 `[STALE→data loss]` Mass operations before the metadata arrives are overwritten.** The mass-operation sidebar writes into every row regardless of `canEditMetadata` (`LIB/src/domains/dam/uploadQueue/composables/uploadQueueMassOperations.ts:13-22,26-34,36-44`; no gating in `AssetQueueSelectedSidebar.vue`, grep), and the first metadata load replaces keywords, authors and custom data (`L-store:250-256`, also `:428-432`). True with the socket too, but the window grows from "until the metadata event" to "until processed + sample". Read from code, not run.
- **L3 `[SLOW]` Completion latency.** First sample exactly 10 s after the finish response; a file not ready at 10 s waits until 50 s, then 140 s, then 300 s (§5).
- **L4 `[HANG]` Single-file dialog** (`AImageWidget`, `AImageMediaWidget`: `ImageWidgetInner.vue:937`, `ImageMediaWidgetInner.vue:1111`). Both saves are disabled until settle (`UploadQueueDialogSingleSidebarMetadata.vue:86,95`), ROI tab appears only after `isDone` (`L-singleDlg:297-310`). If processing outlasts +300 s: error overlay (`L-singleDlg:423-453`), status still `processing`, no refresh (`L-singleSide:63-65`); the only way out is to close the dialog (confirmation because `isUploading`, `UploadQueueButtonStop.vue:26-30`) and pick the asset from the library later.
- **L5 `[HANG until manual]` Queue dialog** (`AImageWidgetMultiple` `ImageWidgetMultipleInner.vue:706`, `AAssetListInner` `:425`). "Save and apply" is hidden while any row is `processing` (`L-queueDlg:67-69,221`); a row that outlived the samples must be refreshed or removed by hand (`L-row:297-313,330-336`) before the others can be applied.
- **L6 `[SLOW]` Copy to licence, result `copy`.** At least 10 s for something the push settles at once; up to 50 copies arm at the same instant (§5). Result `exists` is settled directly, no socket needed (`ImageWidgetInner.vue:334-336`, `ImageWidgetMultipleInner.vue:225-227`).
- **L7 `[SLOW]` Failed / duplicate files** are reported at the next sample, not when they happen (`L-api:122-126`).
- **L8 `[SLOW]`** A failed poll request uses up one of the four samples (`L-api:112-116,130`).

**admin-dam:**

- **D1 `[SLOW]` Metadata form of a row**, as L1 (`D-row:372,437`; arming `D-api:196-200`; metadata only in the processed branch `D-api:152-158`). The row's Delete button is also disabled until then (`D-row:419`). DAM uploads video, audio and documents too (`D-api:205-236`), where upload and processing are long (**inferred**), so this is the largest visible change: today the editor describes the files while they upload.
- **D2 `[STALE→data loss]` Mass operations before the metadata arrives are overwritten**, as L2 (`D-store:751-802` write without checking `canEditMetadata`; `D-store:631-635` replaces them; sidebar ungated, `D-queue:110-115`).
- **D3 `[HANG until manual]` Anything processed later than +300 s** (long video transcodes — **inferred**) ends as `processing` + "Processing is taking too long…" (`D-api:127-138`), keeps "Save and close" hidden (`AssetFooterUploadOverlayFull.vue:54-56,166`) and the overlay on "uploading k/N" (`:145-157`); the user must press refresh on each such row.
- **D4 `[HANG until manual]` Slot uploads** (asset detail → Slots tab, `DAM/src/domains/coreDam/asset/components/AssetUpload.vue:59-61` → `D-store:189-216`). The poll acts only when the asset's main file is this item's file (`D-api:148-150`), and the store lets a slot row be settled only by an event naming its own file (`D-store:502-504`; pinned `notificationFallback.test.ts:157-170`, `DAM/src/test/queue/slotNotifications.test.ts:247`). For every other slot: the slot row shows the progress line instead of the file and its menu (`D-slot:73-77,141-154`), a spinner for 550 s and then a warning icon whose tooltip says "Cancel the item and try again later" (`D-listRow:27-33,82-87`; `DAM/src/locales/en/system.json:105`). Cancel only removes the queue row (`D-store:423-436`), after which the list refetches and the already stored file appears (`D-slot:88-92`). The slots overlay stays "uploading" and hides "Clear" meanwhile (`DAM/.../footer/AssetFooterUploadSlotsOverlay.vue:47-49,157-166`). Four wasted GETs per slot upload.
  - *File replacement in a slot:* there is no in-place replace; upload is offered only for an empty slot (`D-slot:197-207`). Removing/unsetting, making main, duplicating and switching slots are plain REST calls followed by a list refetch (`DAM/.../detail/composables/assetDetailSidebarSlotsActions.ts:41-104`) and do not use the socket. The upload that follows is D4. Whether a file uploaded into a freed main slot becomes the main file is backend behaviour — **not verified**.
- **D5 `[STALE]` First file of an asset created empty.** The open detail's `mainFile` is filled only by the metadata notification's slot branch (`D-store:649-656`); the fallback never calls that for slot rows (`D-api:156`). Until the detail is reopened: no image for the ROI tab (`.../detail/components/AssetDetailSidebarROI.vue:72-75`), no download (`AssetDownloadButton.vue:31-32`), "Add distribution" disabled (`.../distribution/AssetDetailSidebarDistribution.vue:98`, fed from `mainFile` at `AssetDetailDialog.vue:294`).
- **D6 `[SLOW]` External-provider import.** Works without the socket even with the flag off (§2.3); first sample 10 s after the import answers; large media can run into D3.
- **D7 `[STALE]` Distribution statuses.** Updated only by the four events (`D-listen:47-58`). The list is fetched when the tab mounts (`AssetDetailSidebarDistribution.vue:85-87`; the tab is `v-if`, `AssetDetailDialogSidebar.vue:173-183`), when the new-distribution dialog closes (`DistributionNewDialog.vue:51-54` → `AssetDetailSidebarDistribution.vue:160`), after cancel (`:162`), manage upsert/delete (`:152-153`) and paging (`:134`). No refresh button, no timer. Redistribute and Cancel are offered from the stale status (`DistributionListItem.vue:41-48`, `DistributionListItemCustom.vue:79`).
- **D8 `[HANG]` YouTube authorisation.** `checkAuthorized` runs once on mount (`DistributionNewDialogYoutube.vue:173-183,259-262`); after the user logs in in the other tab only `distribution_authorized` flips the state (`:239-249`). The waiting state offers the login link and Cancel, no re-check (`:416-435,461-463`). Workaround: close and reopen the dialog. A refused authorisation (`Error`, `:436-441`) is set only by the event (`D-dist:38-48`).
- **D9 `[STALE]` `user_updated`.** The current user is read at start-up (`appInitialize.ts:81`) and on this event (`D-listen:62-67`) — nowhere else (grep). The user's own licence switch reloads the page (`DAM/.../toolbar/AssetToolbarExtSystemLicenceDialog.vue:138-141`), so only changes made by someone else go unseen until reload.
- **D10 (none)** Mass-edit rows: `loading` is resolved by a REST batch read (`D-store:218-249,308-331`), failures by `failStillLoading` (`:252-264`); notifications never touch a `loading` row (`:499-501`) and only decorate a mass-edit row (`:518-519,551-562`). No dependency.
- **D11 (none)** Asset / file delete: local "deleting" mark (`DAM/.../store/assetListStore.ts:64-68`, `AssetDetailDialog.vue:55-57`), no listener for `asset_deleted` / `asset_file_deleted`.
- **`Loading` status:** nothing in LIB ever sets it (it is only read: `L-row:105-108,140-144`, `L-singleDlg:183-186`); in DAM only mass-edit rows (D10).

**Both:**

- **X1** The socket dying mid-session is permanent (§2.1) — from then on the page is in the state described here until reload.
- **X2** A lost `asset_metadata_processed` with a live socket is not polled for (§2.4).
- **X3** The give-up text in LIB points at a refresh button the single dialog does not have (`LIB/src/locales/en/common/damImage.json:212` vs `L-singleSide:63-65`).

---

## 3. LIB vs DAM fallback, where they differ

| aspect | LIB | DAM |
|---|---|---|
| Flag source | function argument from plugin options, per upload (`L-api:68,84`; `uploadService.ts:32-33`) | `envConfig.uploadStatusFallback` read directly (`D-api:199`) |
| Armed for | image upload finish (`L-api:84`); copy to licence (`L-store:111-112`) — both behind the flag | finish of image/audio/video/document (`D-api:208,216,224,232`) behind the flag; external import **always** (`externalProviderImportService.ts:17`) |
| `armNotificationFallback` guard | none (`L-api:91-96`) | only for `processing` (`D-api:186`) |
| Entry check of a sample | returns only for `uploaded` (`L-api:104`) | returns for `uploaded`, `stop`, `failed` (`D-api:119-126`) |
| Give-up text | one key (`L-api:107`) | slot-specific key vs general (`D-api:132-136`) |
| Fetch | `fetchAsset(client, endPoint, id)`, endpoint configurable (`L-api:113`) | `fetchAsset(id)` (`D-api:143`) |
| Fetch error | silent (`L-api:114-116`) | `console.error` (`D-api:144-147`) |
| "Is it our file" | no check (`L-api:118`) | main file id must equal the item's file id, or the item has none (`D-api:149-150`) |
| `processed` | one awaited call that re-reads the asset and settles status + metadata together (`L-api:120-121` → `L-store:313-330`) | two un-awaited calls: status (`D-api:153`), then metadata unless slot / already loaded (`:156-158`); unconditional `return` (`:159`) |
| if the settle's own read fails | row stays `processing`, chain continues (`L-store:327-329`, `L-api:129-131`) | row is already `uploaded`; a failed metadata read leaves `metadataFailed` on it (`D-store:596-616`); chain has ended |
| `duplicate` | awaited; images only; row becomes the original, editable (`L-api:122-123`, `L-store:338,362-387`) | settled first, not editable, link fetched after (`D-api:162-167`, `D-store:671-721`) |
| `failed` | awaited; **re-reads the asset** before marking (`L-api:124-125`, `L-store:398`) | no request (`D-api:170`, `D-store:567-585`) |
| Reschedule test | only while `processing` (`L-api:129`) | unless `uploaded/stop/failed` (`D-api:175`) |
| Matching in the store | by asset id only (`L-store:277,319,362,401,423`) | asset id + file id + row type (`D-store:492-508`) |
| Requests on a happy settle | 2 GET (sample + `:315`), 3 in the single dialog (`L-singleDlg:302`) | 3 GET (sample + `D-store:540` + `:595`) |
| Manual refresh criterion | `mainFile.fileAttributes.status === processed` (`L-refresh:24`) | `asset.attributes.assetStatus === with_file` (`D-queue:33`) |
| Refresh offered | queue row: 20 s in `uploading/processing`, 20 s in `uploaded` w/o metadata (`L-row:176-199`); single dialog: only the latter (`L-singleSide:63-77`) | full view row: same plus at once for `uploaded` with error (`D-row:220-258`); compact and slot rows: never (`D-listRow`) |
| Cancel on a `processing` row | no (`L-row:140-147`); "remove from queue" appears with refresh (`:330-336`) | yes (`D-row:209-210`, `D-listRow:61`) |
| Polling lifetime | only while the upload dialog is open (`L-queueDlg:88-91`, `L-store:586-590`) | the global queue lives in the app shell (`DAM/src/domains/system/components/MainWrapper.vue:156-157`), polls run across navigation |
| Asset types | images only (`L-api:24-27,71-74`, `L-store:126`) | all four |

Identical: constants 10 s / 4 tries (`L-api:15-16`, `D-api:73-74`), formula (`L-api:98-100`, `D-api:114-116`), no reset of `notificationFallbackTry`, error text without a status change after the last timer.

---

## 4. Configuration

### 4.1 Semantics today

Public type (`LIB/src/AnzuSystemsCommonAdmin.ts:91-102`, exported as `CommonAdminCoreDamOptions`, `LIB/src/lib.ts:237,939`; announced as an export in `LIB/doc/changelog/2.0.0.md:67`):

```ts
export type CommonAdminCoreDamOptions =
  | undefined
  | {
      configs: { [key: string]: CommonAdminCoreDamConfig }
      apiTimeout: number
      uploadStatusFallback: boolean
      adminDomain: string
      notification: {
        enabled: boolean
        webSocketUrl: string
      }
    }
```

- `PluginOptions.coreDam` is optional (`AnzuSystemsCommonAdmin.ts:30`); once given, **`uploadStatusFallback`, `notification`, `notification.enabled`, `notification.webSocketUrl` are all required**.
- No defaults: `useCommonAdminCoreDamOptionsGlobal()` returns the raw values (`L-opts:80-91`) and throws when `coreDam` was not given (`L-opts:81-83`). The per-config options do have defaults (`L-opts:44-77`).
- `uploadStatusFallback`: tested for truthiness at two places (`L-api:84`, `L-store:111`). Missing at runtime → falsy → no fallback.
- `notification.enabled` + `notification.webSocketUrl`: combined into one boolean (`L-notif:21`). **`enabled: true` with an empty url is the same as disabled**: `openConnection` returns before `open()` (`L-notif:60-66`), no socket, no warning. A missing `notification` object throws a TypeError at `L-notif:21` and `:90`.
- The singleton is keyed by `` `${enabled}|${webSocketUrl}` `` (`L-notif:88-93`).
- Warning "notifications not connected": only when enabled with a url, only after `openConnection()`, after the 5 retries are exhausted + 3 s (`L-notif:33-42`), once per exhaustion. DAM carries an own, unused translation of the same text (`DAM/src/locales/en/system.json:120`, no reference in `DAM/src`, grep).
- The LIB store registers its listener unconditionally (`L-store:48-49`); without an open socket it simply never fires.
- Documentation: the installation guide names `coreDam` but none of these fields (`LIB/doc/guide/installation.md:62`).

### 4.2 Values each admin passes

| admin | `uploadStatusFallback` | `notification.enabled` | `notification.webSocketUrl` | opens the socket |
|---|---|---|---|---|
| admin-dam | `envConfig.uploadStatusFallback` (`DAM/src/main.ts:46`); json key `uploadStatusFallback` (`DAM/public/config.json:7` = `true`; template `config.json.dist:7` `${UPLOAD_STATUS_FALLBACK}` unquoted) | `envConfig.notification.enabled` (`main.ts:49`; `config.json:19` = `true`; template `:19` `${NOTIFICATION_ENABLED}` unquoted) | `envConfig.notification.webSocketUrl` (`main.ts:50`; `config.json:20` = `ws://notification-server.sme.localhost/ws`) | yes, router guard (`appInitialize.ts:137`, `D-listen:72`) |
| admin-cms | hard-coded `true` (`CMS/src/main.ts:64`) | `envConfig.dam.notification.enabled` (`main.ts:67`; local `CMS/public/config.json:72` = `true`; templates `config.json.dist:72`, `config.json.cf.dist:72`, unquoted) | `envConfig.dam.notification.webSocketUrl` (`main.ts:68`; local `config.json:73`) | yes, `App.vue:16,25` |
| admin-ugc | hard-coded `true` (`UGC/src/main.ts:72`) | hard-coded `false` (`:75`) | hard-coded `''` (`:76`) | no (grep) |
| admin-blog | no `coreDam` (`/home/volar/projects/petit/admin-blog/src/main.ts:27-33`) | — | — | — |
| admin-forum | no `coreDam` (`.../admin-forum/src/main.ts:27-33`) | — | — | — |
| admin-inhouse | no `coreDam` (`.../admin-inhouse/src/main.ts:45-51`); it has a DAM axios client only for users/logs (`.../admin-inhouse/src/domains/system/composables/system.ts:108`) | — | — | — |
| LIB playground | `true` (`LIB/src/playground/playground.ts:39`) | `true` (`:42`) | `ws://notification-server.sme.localhost/ws` (`:43`) | `LIB/src/playground/App.vue:42-45` |

Note for CMS: `envConfig.notification` (top level, `apiUrl`) is the *other* service called "notification" (`CMS/src/shared/types/EnvConfig.ts:91-95`, `CMS/src/shared/apiClients/notificationClient.ts:12`); the WebSocket server is `envConfig.dam.notification` (`EnvConfig.ts:76-79`).

Env-config handling:
- **admin-dam**: type `EnvConfig` has `uploadStatusFallback: boolean` and `notification: { enabled, webSocketUrl }` as required (`DAM/src/shared/types/EnvConfig.ts:7,18-21`). In-code defaults `uploadStatusFallback: true`, `notification.enabled: true`, url `''` (`DAM/src/shared/EnvConfigService.ts:11,22-25`) are **overwritten unconditionally** by the json (`:44-46`). A json without a `notification` object throws inside `setEnvConfig` → fatal start-up error (`:31-50`, `LIB/src/shared/utils/envConfig.ts:41-52`); a json without `uploadStatusFallback` silently yields `undefined` (`:46`).
- **admin-dam deploy template** `DAMDEPLOY/public/config.json.cf.dist`: has `notification` (`:19-22`), with `"enabled": "#{NOTIFICATION_ENABLED}#"` **quoted** (`:20`), and **no `uploadStatusFallback`** (whole file `:1-26`). It belongs to the released 1.28.0 line; how that version reads the key was not checked — for `next` the consequence is fact 10 in §0.
- **admin-cms**: `dam.notification` required in the type and read unconditionally (`CMS/src/shared/EnvConfigService.ts:186-187`); defaults `enabled: false`, `''` (`:68-71`). No json key for the fallback.
- **admin-ugc**: nothing in its json (grep over `UGC/public`, `UGC/src/shared`).

### 4.3 Places that would have to change for "polling is the default, the socket is opt-in" (not a design)

Library:
- `LIB/src/AnzuSystemsCommonAdmin.ts:96-101` — the four required fields.
- `L-opts:85-90` — where defaults would have to be applied (today none).
- `L-notif:19-21,89-90` — unguarded reads of `notification.*`; `:33-42` the outage warning, which stops making sense as a warning about a degraded app if polling is primary.
- `L-api:68,84` and `uploadService.ts:32-33`, `L-store:111` — the three places the flag gates arming; `L-api:15-16,98-109` — schedule and give-up.
- `L-singleSide:63-65`, `L-row:140-147,176-199` — refresh/cancel availability for `processing`.
- `LIB/src/locales/*/common/damImage.json:212,214` — texts.
- `LIB/src/playground/playground.ts:39-44`, `LIB/src/playground/App.vue:42-45`.
- `LIB/doc/guide/installation.md:62` — undocumented options.

admin-dam:
- `DAM/src/shared/types/EnvConfig.ts:7,18-21`, `DAM/src/shared/EnvConfigService.ts:11,22-25,44-46`, `DAM/public/config.json:7,18-21`, `DAM/public/config.json.dist:7,18-21`, `DAMDEPLOY/public/config.json.cf.dist:19-22`.
- `DAM/src/main.ts:46-51`.
- `D-api:73-74,114-200` (own copy of the fallback), `externalProviderImportService.ts:15-18`.
- `D-store:492-508` (slot rule), `:649-656` (detail main file only from the event).
- `D-listen:18-78`, `appInitialize.ts:133-140`.
- Distribution: `D-dist:38-72`, `DistributionNewDialogYoutube.vue:173-183,239-262`, `AssetDetailSidebarDistribution.vue:65-87`.
- `DAM/README-DEV.md:16-20,100` ("Start Notification-Server container … needed for websockets"), `DAM/docker-compose.yml:16`, `DAM/docker-compose.override.yml:20`.
- `DAM/doc/changelog/3.0.0.md:90,92` (already describes the fallback as flag-driven, "a slot upload usually needs its notification").

admin-cms: `CMS/src/main.ts:64-69`, `CMS/src/App.vue:3,16,25`, `CMS/src/shared/types/EnvConfig.ts:76-79`, `CMS/src/shared/EnvConfigService.ts:68-71,186-187`, `CMS/public/config.json:71-74`, `config.json.dist:71-74`, `config.json.cf.dist:71-74`.

admin-ugc: `UGC/src/main.ts:72-77`.

Constraints:
- **Public type.** The fields are required today; making them optional widens the input and breaks no caller that passes them. 2.0.0 is unreleased (`LIB/doc/changelog/2.0.0.md:1`) and newly exports the type (`:67`), so its shape becomes public API with that release.
- **What 2.0.0's changelog already says.** Only bug fixes: the upload-queue paragraph (`:109`: fallback survives a network error, keeps polling after metadata is loaded, licence copies get a timer, "with it off left there until refresh was pressed — for good in the single-file dialog"), the once-only metadata load "by its notification, the fallback or the refresh button" (`:115`), and the notifications handle (`:121`). Nothing announces the semantics or defaults of `uploadStatusFallback` / `notification.*`, and the migration section (`:32-53`) does not mention `coreDam` options.
- **A retired server with unchanged config** = a failed connection on every page load, then the "notification service temporarily down" toast after ~30 s (`L-notif:33-42`) in DAM and CMS.
- **Env json shape**: DAM and CMS both dereference the `notification` object without a guard (`DAM/src/shared/EnvConfigService.ts:44-45`, `CMS/src/shared/EnvConfigService.ts:186-187`), so the deployed json must keep it until the code tolerates its absence. Unquoted template placeholders (`DAM/public/config.json.dist:7,19`) make an unset variable invalid JSON → fatal start-up (**inferred** from the template form; the substitution tool was not read).
- **DAM has its own copy** of the fallback and reads its own `envConfig`, so a library default changes nothing in DAM.
- **Tests pin the current behaviour** (§6): the exact schedule in both repos, "arms no poll when the fallback is off" in both, and the slot rule in DAM.
- `UploadQueueItem.notificationFallbackTimer` / `notificationFallbackTry` are fields of a public type (`LIB/src/domains/dam/types/UploadQueue.ts:81-82`, exported `LIB/src/lib.ts:355,997`) and DAM's copy uses them (`D-api:115,125,127,176-177`).

---

## 5. Cost of polling as the main path

Queue size: at most 50 items (`DAM/src/shared/utils/BetaTestFeaturesService.ts:4`; `LIB/src/domains/dam/imageWidget/components/ImageWidgetMultipleLimitDialog.vue:22`); two uploads in parallel (`L-store:33,177-189`; `D-store:55,387-401`).

**Requests per item** (`GET {asset}/:id`, all for the same asset):

| | push today | poll, ready at the first sample | poll, never ready |
|---|---|---|---|
| LIB queue dialog | 2 (metadata event `L-store:420` + processed event `:272`) | 2 (sample `L-api:113` + `L-store:315`) | 4 |
| LIB single dialog | 3 (+ `L-singleDlg:302`) | 3 | 4 |
| DAM | 2 (`D-store:540`, `:595`) | 3 (sample `D-api:143` + `D-store:540` + `:595`) | 4 |

Plus the keyword/author cache fetches on each settle in both paths (`L-store:324-325`, `D-store:660-661`). With the socket working and the fallback on, a push that arrives within 10 s clears the timer and no sample is sent (`L-store:287`, `D-store:517`).

**When:** each item has its own timer started by its own finish response (`L-api:93-95`; `D-api:188-190`). N items → N independent chains; nothing is grouped. Uploads finish two at a time, so the samples are spread like the finishes. The burst case is LIB's copy to licence from the multi widget: up to 50 rows are created in one loop (`ImageWidgetMultipleInner.vue:222-231`; limit `LIB/src/domains/dam/api/damImageApi.ts:263`), all armed in the same tick (`L-store:109-113`) → 50 simultaneous GETs at +10 s, each followed by a second GET when processed.

**Latency against push:** the first check is exactly 10 000 ms after the finish response is handled (`L-api:99`, `try = 1`). An image the server finishes in a second or two (**inferred** typical) is shown done ~8–9 s later than with push. Because the gaps grow quadratically, missing a sample is expensive: ready at 11 s → shown at 50 s; ready at 51 s → 140 s; ready at 141 s → 300 s; ready after 300 s → never. For the metadata form the difference is larger still: push opens it during the upload, the poll after processing (§2.5 L1/D1).

**Existing batch read:** `GET {endPointAsset}/licence/{licenceId}/ids/{id,id,…}`, chunks of 25, sequential, returns `AssetDetailItemDto[]` — LIB `fetchAssetListByIds(client, endPoint, ids, licenceId)` (`LIB/src/domains/dam/api/damAssetApi.ts:29,121-177`), DAM `fetchAssetListByIds(ids, licenceId)` (`DAM/src/domains/coreDam/asset/api/assetApi.ts:61,81-123`). Already used for DAM's mass-edit rows (`D-store:308-331`) and LIB's multi widget (`ImageWidgetMultipleInner.vue:248`). Every queue item carries its `licenceId` (`UploadQueue.ts:64`). Not verified: (1) that the endpoint returns an asset whose file is still uploading/processing — DAM already has to handle "an asset the response did not carry" (`D-store:251-264`); (2) that the UGC endpoint family `/ugc/v1/asset` (`UGC/src/main.ts:62`) implements it; (3) that the list DTO carries `mainFile.fileAttributes.status` as the single read does (same TypeScript type, backend not read).

---

## 6. Tests that pin notification / fallback behaviour

### Library (`LIB/src/…`)

| file | pins |
|---|---|
| `domains/dam/__tests__/damNotifications.test.ts` | Singleton contract: same handle for the same `enabled\|url` (`:40`), new one on a changed key (`:47`), an old handle cannot reopen (`:56`), `damNotificationsInitialized` reset on destroy (`:67`), fresh handle after a direct dispose (`:78`), no reopen of an open socket (`:90`). |
| `domains/dam/uploadQueue/__tests__/uploadStatusFallback.test.ts` | **The schedule**: waits `[10,40,90,160,250] s`, 4 fetches, error text at the end, a failed fetch does not end the chain (`:91-111`); a removed item is polled no more (`:117`); an upload stopped during finish is not polled (`:139`); an item its notification settled during finish stays settled and is not polled (`:167`); a licence copy is polled and ends `uploaded` with its file id (`:196`); polls again when the settle's own read fails (`:209`); still polled after its metadata was loaded (`:226-242`); **"arms no poll when the fallback is off"** (`:244`); a settled copy/duplicate shows no old error (`:258`); a duplicate whose origin cannot be read fails the item (`:284,298`). |
| `…/uploadQueuesStore.test.ts` | Store reactions to the events: failed copy read → failed (`:101`); metadata loaded once, user input kept (`:135,173`); processed notification clears the fallback's give-up error (`:159`); failed rows stay uneditable whatever the event order (`:195,212`); a client-failed row revived by `processed` (`:229,252`); copy keeps typed input when metadata came first (`:277`); settle vs. failing request ordering (`:339,363,387`). |
| `…/uploadQueueItemRefresh.test.ts` | Refresh loads the metadata of an `uploaded` row (`:95`), can be retried after a failed read (`:129`), targets the row that asked (`:145`). |
| `…/uploadQueueRowRefresh.test.ts` | Row refresh button appears after the 20 s wait for an `uploaded` row without metadata and goes when it arrives (`:111`). |
| `…/uploadQueueSettledItemFailure.test.ts` | A copy failed by the notification path is not settled later by the fallback (`:61`); a settled copy is not failed by a late notification (`:75`). |
| `…/uploadQueueDialogSingle.test.ts` | Single dialog: refresh offered for `uploaded` without metadata after 20 s, both saves disabled until then (`:182-203`); not offered when metadata comes in time (`:206`); the wait survives a tab switch (`:220`); single-use switch and author conflicts are the item's (`:235,255,303`). |
| `…/uploadQueueDialogSave.test.ts`, `…/queueRowValidation.test.ts` | Save/apply and validation are gated on `canEditMetadata` / `uploaded` (`uploadQueueDialogSave.test.ts:65-81`, `queueRowValidation.test.ts:56`). |
| `plugins/__tests__/pluginOptions.test.ts` | Options (with `uploadStatusFallback: false`, notification disabled, `:38-39`) reach the composables; composables throw until configured (`:46,63`). |
| `test/publicExportsAdded.test.ts` | `destroyDamNotifications` is exported (`:22`). |
| `…/uploadStopWhileHashLoads.test.ts`, `uploadQueueStartsEachFileOnce.test.ts`, `uploadStopBetweenChunks.test.ts` | Not about the fallback; they mock the options with `uploadStatusFallback: false` (`:26`, `:40`, `:28`) and would need touching if the option's shape changes. |

### admin-dam (`DAM/src/test/…`, plus e2e)

| file | pins |
|---|---|
| `fallback/notificationFallback.test.ts` | For each asset type: a notification that beat the finish response is left alone, a stop during finish arms nothing, an untouched item goes to `processing` and is settled at the first sample (`:70,91,110`); **"is not armed at all where the deployment has it switched off"** (`:126`); **armed for an external import even with the flag off** (`:142`); **"says nothing about a slot upload, whose file is not the main one"** (`:157`); keeps trying after a failed request (`:172`); stops when the item is cleared mid-request (`:188`) or cancelled (`:231`); **reads at 10/50/140/300 s and gives up at 550 s with the slot text** (`:211-229`); a processed sample also loads the metadata (`:266`), not for a row that has it or a slot row (`:273`); a duplicate is told its origin file (`:283`). |
| `appInitialize/appNotificationListeners.test.ts` | The listener passes the file id for processed / failed / duplicate (`:56,62,68`); registers once and opens one connection (`:76,85`); takes the listener off when `openConnection` throws (`:96`). |
| `queue/slotNotifications.test.ts` | The matching rules: only the item holding the named file is settled (`:105`); **"never settles a slot upload on the asset alone"** (`:247`); mass-edit rows are decorated, not settled, and left alone while `loading` (`:147,171,207`); processed settles even if the asset cannot be read (`:262,275`); warnings left by the fallback / a failed metadata read are cleared when the data comes (`:314-387`); metadata loaded once, failed and duplicate rows stay uneditable, client-failed rows are revived (`:549-779`). |
| `queue/externalProviderImport.test.ts` | Import carries the ids over and arms the fallback behind them (`:47`); a notification that settled it first is left alone (`:61`); refusals and duplicates (`:78,92,105`). |
| `queue/lazyMetadata.test.ts` | Mass-edit rows left out by the batch read fail instead of loading for ever (`:87,106,122`). |
| `init/appInitializeClassification.test.ts` | Only mocks `initAppNotificationListeners` (`:35-36`). |
| `DAM/e2e/tests/upload/uploadNotificationFallback.spec.ts` | Silences the socket with `page.routeWebSocket(/notification-server/, () => {})` and expects the overlay to finish (`:38-51`); **marked `test.fail()`** with "DAM-B11: the fallback is never armed" (`:33`). The spec's last commit (f823337a, 2026-09-23) predates the fallback fixes (13812f57, 2026-10-07); the `KNOWN-BUGS.md` it names is not in the repo (grep). Whether the mark is stale or reflects an e2e config without the flag was not checked (no runs). |
| `DAM/e2e/tests/distribution/distributionYoutubeForm.spec.ts:57-59`, `distributionRedistribute.spec.ts:74`, `assets/assetDefaultSlot.spec.ts:64-67` | Comments only: these specs wait through the API because "the overlay … can sit on 'Nahrávanie 1/1' for ever when the server's notification is lost". |

---

## 7. Not verified

- Backend timing and content of each event (when `asset_metadata_processed` is sent, whether `asset_file_processed` follows a copy, what `with_file` means relative to `processed`) — read only from frontend comments.
- The batch endpoint's behaviour for assets still processing, and its existence under `/ugc/v1/asset`.
- What the production variable groups set for `UPLOAD_STATUS_FALLBACK`, `NOTIFICATION_ENABLED`, `DAM_NOTIFICATION_ENABLED` (not in the repositories).
- L2/D2 (mass operations overwritten by the first metadata load) is read from code, not reproduced.
- Browser timer throttling in background tabs, which would stretch the samples further, was not examined.

---

## 8. Proposals (mine — separate from the facts above)

1. **Do not promote the current fallback as it is.** Four samples in five minutes and a give-up that leaves `processing` behind is a backstop. A primary poll needs a short steady interval while anything in the queue is unsettled (e.g. 2 s for the first 30 s, then 5 s, then 15 s) and no hard stop while the dialog/queue is open — or a stop that ends in a real terminal state.
2. **One poller per queue, not one timer per item,** using the existing `…/licence/:licenceId/ids/:ids` read (25 ids per call), grouped by `licenceId`. This removes the 50-GET burst of licence copies and the 2–3 GETs per settle. First confirm the three open points of §5 with the backend; keep the single read as a fallback for assets the batch does not return.
3. **Start polling at upload start, not at finish,** and let a sample load the metadata as soon as the asset has it. That is the only way to keep today's "describe while it uploads" behaviour (L1/D1) and it shrinks the L2/D2 window back.
4. **Close the two L2/D2 holes independently of the socket decision:** either gate the mass operations on `canEditMetadata` or mark a row touched by them as `metadataLoaded`-equivalent so the first load merges instead of replacing.
5. **Give every `processing` row a way out:** refresh (or at least "remove") in LIB's single-file dialog, and a refresh on DAM's slot row. Fix the LIB give-up text meanwhile.
6. **DAM slots need their own read.** The asset's main file says nothing about a slot file; poll the slot list (`fetchAssetSlotList`, already used by the tab) or the file itself (`fetchImageFile` / `fetchVideoFile` … exist in DAM) by `item.fileId`. Same read can fill the detail's `mainFile` (D5).
7. **Distribution:** poll `fetchAssetDistributionList` while the tab is mounted and any row is in a non-final status; for YouTube, re-run `distributionIsAuthorized` on window focus / a short interval while `WaitingForLogin`, or add a "I have signed in" button. Neither needs the upload work and both are prerequisites for "admin-dam works without the service".
8. **`user_updated`:** re-read the current user on window focus or on a 403; low priority.
9. **Config shape:** make `uploadStatusFallback` and `notification` optional in `CommonAdminCoreDamOptions` with defaults applied in `useCommonAdminCoreDamOptionsGlobal` (polling on, socket off), before 2.0.0 is released, with a "Changed" entry. In DAM read the json with defaults (`data.uploadStatusFallback ?? true`, `data.notification?.enabled ?? false`) so an old deploy template cannot switch polling off by omission, and coerce `enabled` to a real boolean. Consider renaming: once polling is primary, "fallback" describes the socket.
10. **Collapse DAM's copy of the fallback into the library's** (or the reverse) while doing this; today every fix has to be made twice and §3 lists some twenty behavioural differences.
11. **Suppress or reword the "notification service down" toast** when polling is primary, and stop attempting a connection when the socket is not opted into.
12. **Tests to rewrite, not just adjust:** the two schedule pins, both "no poll when off" tests, DAM's slot pins, and the e2e spec, which is the natural acceptance test for "upload works with the socket silent" once its `test.fail()` is removed.
