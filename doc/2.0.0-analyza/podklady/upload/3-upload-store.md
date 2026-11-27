# 3 - Upload queue stores: admin-dam vs common-admin

Read-only analysis. Both repos on branch `next`, working trees clean for the files read
(DAM head `ba8a66ec`, LIB head `49bd815b`).

Legend for references:

- `D:n` = `admin-dam/src/domains/coreDam/asset/store/uploadQueuesStore.ts` line n
- `L:n` = `common-admin/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts` line n
- `dam:path:n` / `lib:path:n` = other files, relative to the repo's `src/`
- "inferred" = concluded without reading the deciding line; everything else was read.

Classes: STRUCTURAL, PRODUCT, DRIFT-BUG, UNKNOWN (as defined in the task).

---

## 0. Headline facts

1. **The item type, both enums and the item factory are already one source.** They live in the library
   (`lib:domains/dam/types/UploadQueue.ts:13-87`, `lib:domains/dam/uploadQueue/factory/UploadQueueItemFactory.ts:10-67`)
   and DAM imports them from `@anzusystems/common-admin` (`D:1-29`, `D:80`). DAM has no type, enum or factory of
   its own for the queue (grep for `interface UploadQueue`, `UploadQueueItemStatus =`, `UploadQueueItemType =` in
   `admin-dam/src` finds nothing). The duplication is the store, the upload service and the API/fallback layer.
2. **`Loading` is not missing from the library.** It is in the shared enum (`lib:domains/dam/types/UploadQueue.ts:34`).
   What differs: only DAM's store ever assigns it (`D:226`); the library store never does. See B.
3. **"Several queues vs one" is not about the key.** Both stores key queues by a string, both apply the
   parallel limit per queue, both notification handlers walk all queues. The real difference is the *roles* a
   queue row can have and how long a queue lives. See section G.
4. **`UploadQueueItemType.Asset` means two opposite things.** DAM: a mass-edit row whose status the batch load
   owns and that file events must not settle (`D:505`, `D:519`). LIB: a copy-to-licence row that is `Processing`
   and that file events must settle (`L:98-99`, `L:288`, `L:401-406`). This is the single hardest collision.
5. **The two stores can already be alive side by side in DAM** (inferred from the import chain): DAM mounts the
   library's `AAssetSelect` (`dam:domains/coreDam/asset/components/ImagePreview.vue:183`,
   `.../slots/AssetSibling.vue:82`, `dam:domains/coreDam/extSystem/components/ExtSystemTtsSettingsForm.vue:110`),
   which imports `AssetMetadata.vue` -> `AuthorRemoteAutocompleteWithCached.vue` ->
   `AuthorRemoteAutocompleteCachedAuthorChip.vue`, which calls the library's `useUploadQueuesStore()`
   (`lib:domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue:33`). The library store
   subscribes to the notification bus in its setup (`L:48-67`), so from then on every upload notification is
   handled (and its asset fetched) by both stores. Store ids differ (`D:72` `damUploadQueuesStore`, `L:36`
   `commonUploadQueuesStore`), so they do not share rows.
6. The library already carries a guard test that names this work: the only import cycle allowed is
   `uploadApi.ts` <-> `uploadService.ts` <-> `uploadQueuesStore.ts`, "which the shared upload core removes"
   (`lib:test/importCycles.test.ts:100-108`). DAM has the same cycle (`dam:domains/coreDam/asset/api/fileApi.ts:70`
   imports the store; the store imports `uploadService`, which imports `fileApi`, `D:48-52`).

History anchor: the library store was first committed in `2c202a9b` (2024-01-02, "Release/1.40.0 (#155)") as a
cut-down copy of DAM's store of that time (compare with DAM `e3c6e9b3`, 2024-01-03). Already different at the copy:
`Map` instead of object, the notification listener inside the store, `addByFiles(queueKey, extSystem, licence,
files)`, image only, the duplicate handler that turns the row into the original asset and makes it editable,
`updateFromDetail` (re-fetch) instead of `updateAssetMetadata`, mass operations in a composable, no slots / mass
edit / external provider. Everything else below is later drift.

---

## A. Inventory

### A.1 State and module-level pieces

| Piece | DAM | LIB | Verdict |
|---|---|---|---|
| `queues` | `ref<{[queueId]: UploadQueue}>({})` `D:85`, **exposed** `D:822` | `ref<Map<UploadQueueKey, UploadQueue>>` `L:40`, **not exposed** (`L:614-631`) | cosmetic in behaviour; a real API difference (DAM tests seed `store.queues[id] = ...`) |
| `metadataLoaded` WeakSet (raw item) | `D:78` | `L:43` | identical mechanism (DAM `ba8a66ec`, LIB `9d6f62ca`, same day) |
| `metadataFailures` Set + key `queueId/item.key` | `D:74-75` | none | exists only in DAM; see A.3 #7 |
| `uploadStopHandles` WeakMap (module level) | `D:58` | none | exists only in DAM; belongs to the service design (LIB's `useUpload` returns no `stop`, it reads `item.status`: `lib:domains/dam/uploadQueue/composables/uploadService.ts:28`, `:159`, `:241`, `:271`, `:281`) |
| `queueItemSequence` / `uniqueQueueItemKey` | `D:68-69` | none | DRIFT-BUG, see A.3 #1 |
| `translate` (app i18n) | `D:61-65` | none (LIB uses `commonT` in `uploadApi.ts:107`) | STRUCTURAL (message catalogue differs) |
| parallel limit 2 | `D:55` | `L:33` | identical |
| chunk size 10485760 | `D:70` | `L:34` | identical |
| store id | `damUploadQueuesStore` `D:72` | `commonUploadQueuesStore` `L:36` | differs |
| notification subscription | outside, `dam:domains/system/composables/appNotificationListeners.ts:27-45` | inside store setup `L:48-67`, the `off` handle is dropped | STRUCTURAL |
| API binding | module imports `D:33-37`, `D:54` | `useCommonAdminCoreDamOptions()` of config `default`, read once at setup `L:47` | STRUCTURAL |
| author/keyword cache | DAM-local `useCachedAuthors`/`useCachedKeywords` `D:45-46`, `D:82-83` (own `defineCached` over the current ext system, `dam:domains/coreDam/author/composables/cachedAuthors.ts:18-26`) | `useDamCachedAuthors`/`useDamCachedKeywords` `L:37-38` (`lib:domains/dam/author/composables/cachedAuthors.ts:19-27`) | STRUCTURAL: two different caches |
| HMR accept | `D:861-863` | none | cosmetic |

### A.2 Getters and helpers

| Member | DAM | LIB | Verdict |
|---|---|---|---|
| `getQueueFileInputKey` | `D:88-93`, exposed | `L:580-584`, internal only | identical logic |
| `getQueue` | `D:95-100` -> queue or `null` | `L:69-74` -> queue, `undefined` or `null` | cosmetic (type) |
| `getQueueItems` | `D:102-107` | `L:76-81` | identical |
| `getQueueItemsByStatus` | `D:109-114`, exposed | `L:171-175`, internal | identical |
| `getQueueTotalCount` / `getQueueProcessedCount` | `D:116-128` | `L:543-553` | identical |
| `getQueueItemsTypes` | `D:147-158` | `L:599-612` | identical |
| `getQueueItemForSlotItem` | `D:131-145` | none | only DAM, STRUCTURAL (slots) |
| `createQueue` | `D:371-381`, exposed | `L:150-160`, internal | identical |
| `addQueueItem` | `D:383-385` (throws on a missing queue), exposed | `L:144-148` (guards), internal | cosmetic |
| `recalculateQueueCounts` | `D:730-735` (throws on a missing queue), exposed | `L:162-169` (guards), internal | identical formula: processed = `Uploaded` + `Failed` |
| `setUploadSpeed` | `D:724-728`, exposed | `L:217-221`, internal | identical |
| `forceReloadFileInput` | `D:303-306` | `L:573-578` | identical |
| `clearQueue` | `D:737-749`, **exposed and called from outside** (mass-edit "clear": `dam:.../footer/AssetFooterSelected.vue:48`, `.../list/composables/assetListActions.ts:362`, `:463`, ...). Creates the queue when missing. Also drops `metadataFailures`. Does not stop anything. | `L:586-597`, internal, only reached through `stopUpload`. Returns when the queue is missing. | behavioural, STRUCTURAL: DAM needs "empty a queue that has no uploads" as a public action |
| `clearError` | none (mutates the three fields in place, `D:528-531`, `D:679-681`) | `L:224-226` replaces the whole `item.error` object | cosmetic (object identity of `item.error` changes in LIB only) |
| `notificationMatches` | `D:492-508` | none (every handler compares `item.assetId` only) | only DAM, STRUCTURAL (slots, mass edit, `Loading`) |
| `settleWithMetadata` | none | `L:230-268` | only LIB; see #5 and #6 below |
| `stopRemoved` | none (inline in `removeByIndex`) | `L:485-495` | see #11 |
| `failStillLoading` | `D:252-264` | none | only DAM, STRUCTURAL (mass edit) |
| `assetTypeHas` | `D:772-778` | none | only DAM, STRUCTURAL (asset types) |
| `reset` | `D:817-819`; no caller found in `admin-dam/src` (grep) | none | only DAM, dead as far as grep shows |

### A.3 Actions, matched

Numbered so that later sections can refer to them.

**#1 `addByFiles`** - `D:161-187` `(queueId, files)` vs `L:117-142` `(queueKey, extSystem, assetLicence, files)`

- Signature: DAM reads the ext system and licence from app-global composables (`D:163-165`); LIB is given them
  (`L:117`). STRUCTURAL (a widget has its own ext system and licence; original at the copy).
- Type filter: DAM takes every type the ext system config knows (`D:171`); LIB only images (`L:126`). STRUCTURAL.
- Row key: DAM `uniqueQueueItemKey('file_' + name)` (`D:173`); LIB `'file_' + file.name` (`L:128`), used as the
  Vue `:key` of the row (`lib:domains/dam/uploadQueue/components/UploadQueueEditable.vue:126`).
  **DRIFT-BUG, DAM is right.** DAM `3a242125` ("fix(dam): refs #86567 upload queue, list and start-up fixes with a
  test suite"): "A file name is not unique, and a duplicate `:key` lets Vue's keyed diff patch the wrong tile".
  Two files of one name in a LIB queue get the same key. The same holds for `'asset_' + assetId` in
  `addByCopyToLicence` (`L:97`) and, on the DAM side, for `'asset_' + asset.id` in `addByAssets` (`D:224`), which
  DAM did not make unique (and `metadataFailures` is keyed by that key, `D:75`).
- Otherwise identical: create, `createQueue`, `addQueueItem`, recalc, `processUpload` per file.

**#2 Only-here "add" actions**

| Action | Where | Class |
|---|---|---|
| `addByFilesAsSlotUpload` | `D:189-216` | STRUCTURAL (slots) |
| `addByAssets` + `fetchLazyAdditionalMetadata` + `failStillLoading` | `D:218-264`, `D:308-331` | STRUCTURAL (mass edit of existing assets) |
| `addByExternalProviderAsset` | `D:266-301` | STRUCTURAL (external providers) |
| `removeByExternalProviderAssetId` | `D:363-369` | STRUCTURAL |
| `addByCopyToLicence` | `L:83-115` | STRUCTURAL / PRODUCT (library feature `1dd7e822` "Copy asset image to licence (#197)"); arms the fallback itself (`L:110-113`, `aef095d0`) |
| `queueItemCopied` | `L:452-480` | same; DAM's listener has no case for `AssetFileCopied` (`dam:domains/system/composables/appNotificationListeners.ts:27-45`) |

**#3 `processUpload`** - `D:387-401` vs `L:177-189`: same behaviour (start the first `2 - uploading` waiting
rows). Both were fixed separately from the same original (`for i < 2` regardless of what runs): DAM `b825c77e`
("fix(upload): stop an upload when it is cancelled, and stop collecting interceptors"), LIB `aef095d0`. Verdict:
cosmetic. Pinned on both sides.

**#4 `queueItemUploadStart`** - `D:438-486` vs `L:191-215`

- External provider branch `D:440-446`: only DAM, STRUCTURAL.
- Stop handle registry `D:449-452`, `D:456`, `D:459`: only DAM, service design.
- On failure, a row the notification already settled stays `Uploaded`: both (`D:466`, DAM `13812f57`; `L:206`,
  LIB `8c51327f`). Identical intent. DAM returns before recalc/`processUpload`, LIB still runs them (`L:212-213`):
  no visible effect, the processed handler has already done both.
- A stopped row: DAM returns early (`D:460-463`); LIB has no such branch and marks the (already detached) row
  `Failed` (`L:206-211`). No visible effect (inferred: in LIB a row is set to `Stop` only in the same tick it is
  spliced or the queue replaced, `L:493`, `L:508-512`, `L:559-569`).
- **Error message and alert: only DAM.** `item.error.message = resolveUploadErrorMessage(e)` and one `showError`
  per distinct message among the failed rows of the queue (`D:467-482`). LIB sets no message and shows no alert
  (`L:207-210`). **PRODUCT**: added by the feature commit `0ff4cd9b` ("Feature/#85974/naxos photo migration
  (#271)") for a licence that refuses uploads.
- Both: `hasError = true`, `Failed`, `canEditMetadata = false`, recalc, `processUpload`.

**#5 `queueItemProcessed`** - `D:510-565` `(assetId, fileId = null)` vs `L:270-311` `(assetId)`

| # | Aspect | DAM | LIB | Class |
|---|---|---|---|---|
| 5a | order | settles synchronously, then fetches and "decorates" (`D:514-536`, then `D:538-564`); a failed fetch or an asset without a main file still leaves the row `Uploaded` (`D:541-546`) | fetches first; settles only when `asset.mainFile` is there (`L:272-277`); a failed fetch changes nothing (`L:308-310`) | **DRIFT-BUG, DAM right for upload rows** (`3a242125`: "gating the transition on that fetch left the item running whenever it failed, or whenever the asset had no main file"; before it the two were the same, DAM `e3c6e9b3:359-375` vs LIB `2c202a9b:169-190`). **But not portable as is**: a LIB copy row and a LIB recovered row need data from that very response, see 5d and F.4 |
| 5b | which rows | `notificationMatches(item, assetId, fileId, true)` (`D:516`) | `item.assetId === asset.id` (`L:277`); the listener drops `event.data.id` (`L:52`) although the event carries it (`lib:domains/dam/composables/damNotificationsEventBus.ts:42-49`) | STRUCTURAL |
| 5c | status of a type-`Asset` row | untouched (`D:519`) | set to `Uploaded` like any row (`L:288`) | STRUCTURAL, headline fact 4 |
| 5d | a row that was `Failed` | `Uploaded`; gets its form back only if its metadata had been loaded before (`D:522-524`, `ba8a66ec`). One that never had metadata stays without a form until refresh or the fallback loads it | `settleWithMetadata`: `Uploaded`, and the metadata is loaded from this same response when it was never loaded, `canEditMetadata = true` at once (`L:282-286`, `L:250-266`, `8c51327f` + `9d6f62ca`) | **UNKNOWN (two fixes of the same day, opposite result, each pinned by a test)**: `dam:test/queue/slotNotifications.test.ts:678-696` vs `lib:.../__tests__/uploadQueuesStore.test.ts:229-249`. Visible difference: in DAM the user gets a refresh button after 20 s (`dam:.../queue/AssetQueueItemEditable.vue:242-249`), in LIB the form is there at once. Settled by an owner decision |
| 5e | error on the row | cleared, unless a missing-metadata warning is recorded for the row (`D:527-532`) | always cleared (`L:289`) | follows from #7 |
| 5f | preview | only when the row is the main file (`D:553-556`) | always (`L:291-293`) | STRUCTURAL (slots) |
| 5g | `mainFileSingleUse` | not on a type-`Asset` row, not once the row has its metadata (`D:559-561`) | not once the row has its metadata (`L:295-298`); also `mainFileInternal` | first half STRUCTURAL (mass edit), `mainFileInternal` see B |
| 5h | cached authors/keywords | not touched | fetched when a row was recovered (`L:304-307`) | follows from 5d |

**#6 Fallback / refresh entry point**

- LIB has `queueItemFullyProcessed` (`L:313-330`, added in `e5cc06f4` "New image widget + several changes
  (#212)"): one fetch, then `settleWithMetadata` for every row of the asset. Called by the poll
  (`lib:domains/dam/api/uploadApi.ts:121`) and by the refresh composable
  (`lib:domains/dam/uploadQueue/composables/uploadQueueItemRefresh.ts:25`).
- DAM has no such action: the poll and the refresh call `queueItemProcessed` and then, while the row has no
  metadata and is not a slot, `queueItemMetadataProcessed` (`dam:domains/coreDam/asset/api/fileApi.ts:153-158`,
  `dam:domains/coreDam/asset/components/queue/AssetQueueEditable.vue:34-40`).
- End state of an ordinary processing upload row is the same on both sides (`Uploaded`, error cleared, metadata
  loaded once, form enabled). Verdict: behavioural only in the number of requests (LIB 1, DAM 2 after the
  poll's own) and in what a failed request leaves behind (LIB: nothing changed, the poll re-arms; DAM: row
  `Uploaded`, metadata warning on it). Class: follows from 5a and #7.

**#7 `queueItemMetadataProcessed`** - `D:587-662` (exposed, `D:848`) vs `L:417-450` (**not exposed**, only the
listener reaches it, `L:60-61`)

| Aspect | DAM | LIB | Class |
|---|---|---|---|
| fetch fails | writes a warning on the row: `metadataFailures.add`, `hasError`, message `system.uploadErrors.metadataFailed` (`D:596-617`), taken back when the metadata arrives (`D:642-645`), kept by the processed handler (`D:527`) | swallowed (`L:447-449`) | **UNKNOWN / drift, both remedied differently**: DAM `3a242125` says it on the row; LIB `9d6f62ca` offers a refresh button on an uploaded row still without metadata after 20 s (`lib:.../components/UploadQueueItemEditable.vue:190-196`). DAM offers that button too (`dam:.../queue/AssetQueueItemEditable.vue:242-249`), so DAM has both and LIB only the button |
| rows | not slots (`D:620`); slot branch writes the asset detail store's main file (`D:649-656`) | `item.type` is always truthy, so every row of the asset (`L:423`) | STRUCTURAL (slots, DAM asset detail store) |
| duplicate row | skipped (`D:623`) | no explicit guard; a LIB duplicate is editable, so the `canEditMetadata` guard covers it (`L:427`, `L:386`) | follows from #9 |
| failed row | skipped, except a mass-edit row that failed for want of this metadata (`D:627-628`) | skipped (`L:425`) | identical for uploads; the exception is STRUCTURAL (mass edit) |
| row that has metadata | skipped (`D:631`) | skipped (`L:427`) | identical (DAM `13812f57`, LIB `8c51327f`) |
| fields | keywords, authors, customData, `mainFileSingleUse` (`D:632-635`) | the same plus `mainFileInternal` (`L:428-432`) | see B |
| cache fetch | once per call (`D:660-661`) | once per queue, inside the loop (`L:444-445`; same in `L:324-325`, `L:391-392`, `L:464-465`, `L:535-536`) | cosmetic |

**#8 `queueItemFailed`** - `D:567-585` sync `(assetId, failReason, fileId = null)` vs `L:396-415` async
`(assetId, failReason)`

- LIB fetches the asset first and uses only its id (`L:398-401`); when that fetch fails the row is not failed
  (`L:412-414`). DAM dropped the fetch (`3a242125`: "No fetch: the caller carries everything, and a failed one
  left the item looking alive"). **DRIFT-BUG, DAM right** (the id fetched equals the argument - inferred from
  `fetchAsset(assetId)`).
- DAM clears `error.message` (`D:575`: "The row prints the message over the fail reason chip, and the old one
  is not why"); LIB keeps it (`L:403-406`). The LIB row prints the message in preference to the chip exactly as
  DAM's does (`lib:.../components/UploadQueueItemEditable.vue:258-263`,
  `dam:.../queue/AssetQueueItemEditable.vue:346-351`), so a LIB row that carries the fallback's "processing too
  long" (`lib:domains/dam/api/uploadApi.ts:107`) or a chunk validation message
  (`lib:.../composables/uploadService.ts:176`, `:183`) and is then reported failed shows the stale text and no
  fail reason. **DRIFT-BUG, DAM right.**
- Matching: `notificationMatches` without `matchAssetWithoutFile` (`D:571`) vs asset id (`L:401`). STRUCTURAL.
  Under DAM's rule a type-`Asset` row without a file id is never failed (`D:505`) - a LIB copy row is exactly
  that (`L:98-104`) and must be failable (`lib:domains/dam/api/uploadApi.ts:125`).
- Common: clear the fallback timer, `hasError`, `Failed`, fail reason, `canEditMetadata = false`,
  `processUpload`, recalc.

**#9 `queueItemDuplicate`** - `D:664-722` `(assetId, origin, assetType, fileId = null)` vs `L:332-394`
`(assetId, origin, assetType)`

**PRODUCT, original at the copy** (DAM `e3c6e9b3:423-465` vs LIB `2c202a9b:192-236`):

| Aspect | DAM | LIB |
|---|---|---|
| what the row becomes | stays the uploaded asset, marked duplicate, **not editable** (`D:675-677`, "todo check with product"); then `fileId` and `duplicateAssetId` point at the original, single-use flag and preview come from the original *file* (`D:714-719`) | **becomes the original asset**: `assetId = original.id` (`L:382`), the original's metadata, `canEditMetadata = true` (`L:373-386`) |
| what it reads | the origin file through the per-type file API (`D:691-704`) | the origin's asset by file id (`L:341`) |
| asset types | all four | image only; any other type or a missing origin returns without touching the row (`L:338`) |
| origin unreadable | still a settled duplicate (`D:705-709`) | rows of the asset still `Processing` become `Failed` (`L:342-357`, `aef095d0`) |
| order | settle first (`D:671-685`, `3a242125`) | fetch first |
| other callers | notification, fallback, refresh | also called directly after "copy to licence" answers `exists` (`lib:domains/dam/imageWidget/components/ImageWidgetInner.vue:335-336`, same in `ImageMediaWidgetInner.vue:343-344`, `ImageWidgetMultipleInner.vue:226-227`) |

One sub-item is **UNKNOWN**: in LIB a duplicate event without `originAssetFile` leaves the row `Processing`
(`L:338`); DAM settles it (`D:671-685`). Settled by knowing whether the backend can send a duplicate without an
origin file.

**#10 `stopItemUpload`** - `D:423-436` `(queueId, queueItem)` vs `L:505-514` `(queueKey, queueItem, index)`

DAM removes by identity (`D:433-434`, `3a242125`: "By identity: an index the caller has held across an await
takes out a different item"); LIB by the index the row was rendered with (`L:512`). The one LIB caller passes
the index synchronously from the click (`lib:.../components/UploadQueueEditable.vue:44-46`), so no live defect
was found in LIB. Class: DRIFT-BUG on DAM's side fixed, LIB merely unhardened; identity is safe for both.
Same name, different signature.

**#11 `removeByIndex` / `removeByAssetId`** - `D:346-361` (async) and `D:333-344` vs `L:497-503` (sync) and
`L:485-495`

- DAM sets `Stop` for a row of any status (`D:350`); LIB only for `Waiting`/`Uploading`/`Processing`
  (`L:487-493`). The row is spliced in the same tick on both sides, so nothing on screen differs (inferred).
- DAM refills the freed slot itself (`D:359`, needed because its catch returns early on `Stop`, `D:460-463`); LIB
  relies on the aborted upload's catch (`L:212-213`). Same effect; LIB pins it
  (`lib:.../__tests__/uploadQueuesStore.test.ts:411-427`), DAM pins its own
  (`dam:test/queue/slotNotifications.test.ts:508-527`).
- `removeByAssetId` exists only in DAM (first row with that asset id, `D:335`); LIB rows are removed by index
  (`lib:.../components/UploadQueueEditable.vue:48-50`). Class: cosmetic / STRUCTURAL (mass-edit deselect by
  asset, `dam:.../list/composables/assetListActions.ts:343`).
- async vs sync: same name, different return type.

**#12 `stopUpload`** - `D:403-421` vs `L:555-571`: same skeleton (all rows `Stop`, abort the uploading ones,
`clearQueue`, `forceReloadFileInput`; the file input key therefore moves by 2 on both). DAM also clears the
timers and calls the stop handles per row (`D:408-410`); LIB clears the timers in `clearQueue` (`L:589`).
Verdict: cosmetic.

**#13 Detail save back into the queue** - `updateAssetMetadata` `D:804-815` vs `updateFromDetail` `L:516-541`

Same caller on both sides (asset detail sidebar after a save:
`dam:.../detail/components/AssetDetailSidebarMetadata.vue:61`,
`lib:domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue:60`).

- DAM: synchronous, copies from the object it is given: keywords, authors, customData **and
  `mainFileSingleUse`** (`D:808-811`; the last one since `1f0bedca` "update (#195)").
- LIB: re-fetches the asset, copies keywords, authors, customData, refreshes the suggestions, the author
  conflicts and the caches (`L:519-531`); **does not touch `mainFileSingleUse`**; a failed fetch is swallowed.
- Class: **UNKNOWN**. Different since the copy. Settled by reading, on each side, what the detail's single-use
  switch writes and whether the queue's bulk save then sends the row's older value (components agent).

**#14 Mass operations** - in the store `D:751-802` vs in a composable
`lib:domains/dam/uploadQueue/composables/uploadQueueMassOperations.ts:10-45`

- Custom value: the same emptiness rule, word for word (`D:760-766` vs `uploadQueueMassOperations.ts:17-22`).
  Identical.
- Keywords and authors: DAM writes only into rows whose asset type has the feature enabled (`D:772-778`,
  `D:785`, `D:797`, `13812f57`); LIB writes into every row (`uploadQueueMassOperations.ts:26-44`). In LIB every
  row is an image of one ext system (`L:126`) and the sidebar offers the input only when it is enabled
  (`lib:.../components/AssetQueueSelectedSidebar.vue:114-125`), so no defect today. STRUCTURAL (asset types).

### A.4 What each store exports

DAM returns everything, internals included (`D:821-858`). LIB returns 16 members (`L:614-631`):
`getQueue, getQueueItems, addByFiles, addByCopyToLicence, queueItemProcessed, queueItemFullyProcessed,
queueItemDuplicate, queueItemFailed, removeByIndex, stopItemUpload, getQueueTotalCount, getQueueProcessedCount,
stopUpload, getQueueItemsTypes, updateFromDetail, forceReloadFileInput`.
The library does not export its store from `lib.ts` (grep for `useUploadQueuesStore` in `lib:lib.ts` finds
nothing); it exports the types, the factory, `useAssetSuggestions`, `getAssetTypeByMimeType`,
`useDamUploadChunkSize`, `damFileTypeFix` and the notification composables (`lib:lib.ts:354-360`, `:395-407`).

---

## B. The item type

Where it lives: `lib:domains/dam/types/UploadQueue.ts`. DAM imports `UploadQueue`, `UploadQueueItem`,
`UploadQueueItemStatus(+Type)`, `UploadQueueItemType`, `useUploadQueueItemFactory`, `useAssetSuggestions`,
`useDamConfigState`, `getAssetTypeByMimeType`, `damFileTypeFix` from the library (`D:1-29`); it already did at
`e3c6e9b3` (2024-01-03). The type file entered the library in `9ecb8086` (2023-11-13, "new release (#151)"),
before the library had a store.

| Field (`UploadQueue.ts` line) | Written by DAM | Written by LIB | Note |
|---|---|---|---|
| `key` :45 | unique for files and external rows `D:173`, `D:199`, `D:275`; `asset_<id>` `D:224` | `file_<name>` `L:128`, `asset_<id>` `L:97` | A.3 #1 |
| `file` :46 | `D:180`, `D:206` | `L:135` | same |
| `status` :47 | store, upload service, import service, `fileApi` | store, `uploadService.ts:232`, `:249`, `uploadApi.ts:83` | see enum below |
| `assetStatus` :48 | `D:231`, `D:282`, `D:551` | `L:244`, `L:290`, `L:369` | same |
| `isDuplicate` :49 | `D:675`, import service `:27` | `L:364` | meaning differs, A.3 #9 |
| `type` :50 | all four values | `File` and `Asset` only | `Asset` collides, headline 4 |
| `assetType` :51 | any type | always image (`L:100`, `L:126`) | STRUCTURAL |
| `displayTitle` :52 | file name / asset title | file name; empty for a copy row (`L:96-104`) | same |
| `assetId` :53 | upload start, `D:208`, `D:233` | upload start, `L:104`; **overwritten with the original's id on a duplicate `L:382`** | PRODUCT |
| `duplicateAssetId` :54 | `D:715`, read by the row (`dam:.../queue/AssetQueueItemEditable.vue:321-322`) | `L:368`, no reader found (grep) | - |
| `fileId` :55 | upload start, `D:234`, `D:714` | upload start, `L:243`, `L:367` | - |
| `externalProviderAssetId/Name/Metadata` :56-58 | `D:284-286` | never | only DAM |
| `latestChunkAbortController` :60 | DAM upload service | LIB upload service | same |
| `chunkSize` :61, `chunkTotalCount` :63 | set by the factory, no DAM reader (grep) | sent in the image API payloads (`lib:domains/dam/api/damImageApi.ts:80-81` ...); `chunkTotalCount` never set above 0 (grep) | inferred from grep |
| `currentChunkIndex` :62 | written, never read | written, never read | same |
| `licenceId` :64 | current licence at add time | parameter | - |
| `imagePreview` :65 | `D:237`, `D:287-295`, `D:555`, `D:718` | `L:246`, `L:292`, `L:371` | - |
| `canEditMetadata` :66 | store | store | same rules for uploads |
| `keywords/authors/customData/authorConflicts` :67-70 | store | store | same |
| `progress` :71-75 | `D:724-728` | `L:217-221` | same |
| `error` :76-80 | mutated in place | replaced by `clearError` `L:225` | cosmetic |
| `notificationFallbackTimer/Try` :81-82 | `fileApi.ts` | `uploadApi.ts` | same fields |
| `slotName` :83 | `D:209` | never written; the LIB image API can already post to a slot (`lib:domains/dam/api/damImageApi.ts:33-34`) | only DAM writes |
| `image` :84 ("todo check") | never | never | dead on both sides (grep) |
| `mainFileSingleUse` :85 | `D:236`, `D:317`, `D:560`, `D:635`, `D:716`, `D:811` | `L:255`, `L:296`, `L:383`, `L:431` | - |
| `mainFileInternal` :86 | **never read or written in `admin-dam/src`** (grep: 0 hits) | `L:256`, `L:297`, `L:384`, `L:432`; read by the widget mappers | LIB feature `389af36e` "set mainFile internal in upload and select". PRODUCT/UNKNOWN whether DAM wants it; a shared store that writes it does not change DAM (inferred from the 0 hits) |

Status enum (`UploadQueue.ts:33-41`), shared:

| Status | DAM sets it at | LIB sets it at |
|---|---|---|
| `Loading` | **only `D:226`** (a row added by `addByAssets`) | never |
| `Waiting` | factory argument `D:175`, `D:201`, `D:277` | `L:130` |
| `Uploading` | `dam:.../upload/uploadService.ts:235`, import service `:9` | `lib:.../uploadService.ts:232`, `:249` |
| `Processing` | `dam:.../api/fileApi.ts:198`, import service `:16` | `lib:domains/dam/api/uploadApi.ts:83`; copy rows start in it `L:99` |
| `Failed` / `Uploaded` / `Stop` | store, import service | store |

`Loading` in full:

- Purpose: a mass-edit row whose metadata batch (`fetchAssetListByIds`) is still on the wire.
- Set: `D:226`. Left: to `Uploaded` by the batch (`D:318`), to `Failed` by `failStillLoading` (`D:255-258`) when
  the batch fails (`D:245-248`) or leaves the asset out (`D:329`).
- Read by the store: `D:255`, and `D:501` - a `Loading` row answers to no file event at all ("Never while the
  batch load owns the row").
- Read by DAM components: spinner `dam:.../queue/AssetQueueItemEditable.vue:116`, cancel shown `:206`;
  `AssetQueueItemList.vue:40`, `:57`; `AssetQueueSelectedItemSimple.vue:25`.
- Read by LIB components although nothing in LIB sets it: `lib:.../components/UploadQueueItemEditable.vue:107`,
  `:141`, `UploadQueueDialogSingle.vue:185`. LIB's `stopRemoved` does not list it among the active statuses
  (`L:487-491`).
- Not counted as processed on either side (`D:732-734`, `L:166-168`).

---

## C. Event ordering

Row kinds: DAM has upload rows (`File`), slot rows (`SlotFile`), mass-edit rows (`Asset`), external rows
(`ExternalProviderAsset`). LIB has upload rows (`File`) and copy rows (`Asset`).

### C.1 DAM

| Event | Entry | What it does |
|---|---|---|
| metadata notification | `queueItemMetadataProcessed(asset)` `D:587` | Fetch. **OK**: every non-slot row of the asset that is not a duplicate (`D:623`), not failed (unless failed for missing metadata, `D:627`) and has no metadata yet (`D:631`) gets keywords/authors/customData/single-use, `canEditMetadata = true`, its metadata warning removed (`D:632-648`). Status and timer untouched (a `Loading` row is not excluded here). Slot row: only the asset detail store's main file (`D:649-656`). **Fetch fails**: the same rows get the warning instead (`D:599-614`) |
| file processed | `queueItemProcessed(asset, file)` `D:510` | Rows matched by `D:492-508`: never `Loading`; a slot only by its own file id; a mass-edit row without file id yes; others when the event names no file or their file. Then, before any request: timer cleared; status `Uploaded` unless the row is a mass-edit row (`D:519`) - from `Uploading`, `Processing`, `Failed` alike; form back if metadata had been loaded and it is no duplicate (`D:522`); error cleared unless a metadata warning stands (`D:527`); `processUpload`; recalc. After the fetch: asset status; preview and single-use only for the main file, single-use not on mass-edit rows nor rows with metadata (`D:551-562`) |
| failed | `queueItemFailed(asset, reason, file)` `D:567` | Matched rows (a mass-edit row without file id never): timer cleared, `Failed`, reason, message emptied, form off, metadata warning dropped, `processUpload`. No request. Also flips an `Uploaded` row |
| duplicate | `queueItemDuplicate(asset, origin, type, file)` `D:664` | Matched rows: duplicate, `Uploaded`, form off, error cleared, `processUpload` (`D:671-685`). Then, when the origin file can be read: file id, original asset id, single-use, preview (`D:710-721`) |
| copied | - | not handled |
| fallback poll | `dam:.../api/fileApi.ts:124-180` | Nothing for a row already `Uploaded`/`Stop`/`Failed` (`:126`, `:175`). After 4 tries: error + message, slot wording for slots (`:127-138`). Only when the asset's main file is the row's (`:149`): processed -> `queueItemProcessed(asset, file)` and, for a non-slot row without metadata, `queueItemMetadataProcessed` (`:153-158`); duplicate -> `queueItemDuplicate` with the file (`:162-167`); failed -> `queueItemFailed` (`:170`). Not awaited, no re-arm after a hand-over. Armed after finish only when the flag is on (`:199`), after an external import always (`dam:.../upload/externalProviderImportService.ts:15-18`), and only for a `Processing` row (`:186`) |
| manual refresh | `dam:.../queue/AssetQueueEditable.vue:29-53` | `assetStatus === WithFile` -> `queueItemProcessed(asset)` (no file: reaches upload, external and mass-edit rows, never slots) then metadata if the row still has none; main file duplicate -> `queueItemDuplicate`; failed -> `queueItemFailed`; else a warning toast |
| client request failure | catch `D:458-485` | `Stop`: nothing. `Uploaded`: nothing. Else message, `Failed`, form off, metadata warning dropped, one alert per distinct message, recalc, `processUpload`. An import: handled in the service (`Failed`; a duplicate import is `Failed` + `isDuplicate` without error) |
| stop one | `stopItemUpload` `D:423` | `Stop`, timer, stop handle, abort, removed by identity, `processUpload` |
| remove | `removeByAssetId` -> `removeByIndex` `D:333-361` | first row of that asset: `Stop`, timer, stop handle, metadata warning dropped, spliced, recalc, `processUpload`. External selection: bare splice (`D:363-369`) |
| queue clear | `stopUpload` `D:403`; `clearQueue` `D:737` | `stopUpload`: everything stopped and aborted, queue replaced, file input key +2. `clearQueue` alone (mass edit): timers and warnings dropped, queue replaced, nothing stopped |

### C.2 LIB

| Event | Entry | What it does |
|---|---|---|
| metadata notification | `queueItemMetadataProcessed(asset)` `L:417` | Fetch. **OK**: every row of the asset that is not `Failed` (`L:425`) and has no metadata yet (`L:427`) gets keywords/authors/customData/single-use/internal, `canEditMetadata = true`. Status and timer untouched. **Fetch fails**: nothing |
| file processed | `queueItemProcessed(asset)` `L:270` | Fetch; on failure or without a main file nothing. Rows of the asset: a `Failed` one -> `settleWithMetadata` (`Uploaded`, error cleared, file id if missing, preview, metadata loaded if never loaded, form on) (`L:282-286`); any other -> timer cleared, `Uploaded`, error cleared, asset status, preview, switches while no metadata, `processUpload` (`L:287-299`) |
| failed | `queueItemFailed(asset, reason)` `L:396` | Fetch; on failure nothing. Rows of the asset: timer cleared, `Failed`, reason, form off, message kept, `processUpload` |
| duplicate | `queueItemDuplicate(asset, origin, type)` `L:332` | No origin or not an image: nothing. Origin's asset unreadable: rows still `Processing` -> `Failed` (`L:345-356`). Else every row of the asset: duplicate, `Uploaded`, error cleared, becomes the original asset with its metadata, form on (`L:359-388`) |
| copied | `queueItemCopied(asset)` `L:452` | Fetch OK with a main file: `settleWithMetadata` for the rows of the asset. Fetch fails: rows still `Processing` -> `Failed`, timer cleared (`L:467-479`) |
| fallback poll | `lib:domains/dam/api/uploadApi.ts:102-132` | Nothing for an `Uploaded` row (`:104`). After 4 tries: error + message (`:105-109`). Processed -> awaits `queueItemFullyProcessed`; duplicate -> awaits `queueItemDuplicate`; failed -> awaits `queueItemFailed` (`:118-127`). Then re-arms only while the row is still `Processing` (`:129-131`) - so also when the handler's own request failed. Armed after finish when the flag is on and the row is still `Uploading` (`:79-84`), and for a copy row when the flag is on (`L:110-113`) |
| manual refresh | `lib:.../composables/uploadQueueItemRefresh.ts:20-38` | main file `Processed` -> `queueItemFullyProcessed`; `Duplicate` -> `queueItemDuplicate(..., Image)`; `Failed` -> `queueItemFailed`; else a warning toast |
| client request failure | catch `L:202-214` | Not `Uploaded`: `hasError`, `Failed`, form off. No message, no alert. Recalc, `processUpload` |
| stop one | `stopItemUpload` `L:505` | `Stop`, abort, removed by index, `processUpload` |
| remove | `removeByIndex` `L:497` | timer cleared; an active row -> `Stop` + abort; spliced; recalc |
| queue clear | `stopUpload` `L:555` | all rows `Stop`, uploading ones aborted, timers cleared, queue replaced, file input key +2 |

### C.3 Cells where the two disagree

| # | Event x row state | DAM | LIB | Class |
|---|---|---|---|---|
| C1 | processed, the asset cannot be read / has no main file | `Uploaded` | unchanged | DRIFT-BUG (5a), with the F.4 caveat |
| C2 | processed x `Failed` row that never had metadata | `Uploaded`, no form | `Uploaded`, metadata + form | UNKNOWN (5d) |
| C3 | processed x type-`Asset` row | status untouched | `Uploaded` | STRUCTURAL (headline 4) |
| C4 | processed, event names another file of the asset | not matched | matched | STRUCTURAL |
| C5 | processed x row carrying a metadata warning | warning kept | no such warning | follows from C8 |
| C6 | failed, the asset cannot be read | `Failed` | unchanged | DRIFT-BUG (#8) |
| C7 | failed x row with an older message | message emptied, reason shown | old message shown instead of the reason | DRIFT-BUG (#8) |
| C8 | metadata, the asset cannot be read | warning on the row | silent, refresh button after 20 s | UNKNOWN / drift (#7) |
| C9 | metadata x duplicate row | ignored | n/a (already editable) | PRODUCT (#9) |
| C10 | failed / duplicate x type-`Asset` row without a file id | never matched | matched | STRUCTURAL (headline 4) |
| C11 | duplicate, any state | settled read-only, same asset | becomes the original, editable | PRODUCT (#9) |
| C12 | duplicate, origin unreadable | still a settled duplicate | `Failed` | follows from C11 |
| C13 | duplicate without origin / not an image | settled | unchanged | UNKNOWN (#9) |
| C14 | copied | ignored | settled with metadata | STRUCTURAL / PRODUCT |
| C15 | fallback finds the file processed, the store's request then fails | row `Uploaded` with a metadata warning, no more polls | row unchanged, polled again | follows from C1 + C8; pinned in LIB (`lib:.../__tests__/uploadStatusFallback.test.ts:209-222`) |
| C16 | fallback on a slot / on a file that is not the main one | never settles, slot wording at the end | n/a | STRUCTURAL |
| C17 | fallback armed with the flag off | yes for an external import | never | STRUCTURAL |
| C18 | refresh: what counts as processed | `asset.attributes.assetStatus === WithFile`, tested **before** duplicate | `mainFile.fileAttributes.status === Processed` | UNKNOWN: settled by whether a duplicate's asset can be `with_file` (backend). Components agent |
| C19 | refresh of a duplicate | asset's own type | `Image` hard-coded | STRUCTURAL |
| C20 | client failure | message + one alert per reason | red state only | PRODUCT (#4) |
| C21 | stop one | by identity | by index | drift, DAM safer (#10) |
| C22 | queue emptied without stopping | public `clearQueue` | not available | STRUCTURAL |

Agreeing on purpose and pinned on both sides: two parallel uploads; metadata loaded once; a failed row is not
editable; an upload that fails after its metadata came loses its form; a recovered row that had metadata gets
the form back with what the user typed; a row the notification settled stays `Uploaded` when the finish request
fails afterwards; the single-use switch is the user's once the row has metadata; the finish answer does not
overwrite a settled or stopped row; the poll survives one failed request and gives up out loud.

---

## D. Extension points a shared core would need

Derived only from the differences above; each names the difference that forces it.

| # | Extension point | Kind | Forced by |
|---|---|---|---|
| X1 | Context of an add: ext system, licence, accepted asset types | parameters of the core action (DAM's wrapper fills them from its current ext system / licence) | #1 signature and type filter |
| X2 | Row role independent of `UploadQueueItemType.Asset`: "status owned by a batch load" (mass edit) vs "waits for file events" (copy) | a new discriminator on the row or a per-queue role, read by the handlers | headline 4, C3, C10 |
| X3 | Event matching `(item, assetId, fileId, event) => boolean` | one shared function driven by X2 and the row type, with the file id passed through by every caller | 5b, #8, #9, C4; the LIB listener must start passing `event.data.id` |
| X4 | Who subscribes to the notification bus | subscription outside the store (a `bind` function the app or the library plugin calls once), including `AssetFileCopied` | A.1, headline 5, F.2 |
| X5 | Injected API functions: read an asset; read the original of a duplicate; read assets by ids (mass edit); the upload runner (`uploadInit`/`upload`/stop); the external import runner | injected at store creation (or per queue) | A.1 API binding, #2, #4, #9; also the only way DAM's tests can keep faking them (E) |
| X6 | Duplicate policy: "stay, read-only, link to the original" vs "become the original, editable", including what an unreadable or missing origin does | per-queue option / strategy | #9, C11-C13 |
| X7 | Settle order per row role: settle on the event, or only once the asset has been read | part of X2's role definition | 5a, C1, C15, F.4 |
| X8 | Recovered-row policy (load metadata from the settling answer or not) | option, or one behaviour after an owner decision | 5d, C2 |
| X9 | Missing-metadata reporting: a hook the core calls when the metadata of a row could not be read, and the matching "taken back" | callback + translate function / message keys | #7, C8, 5e |
| X10 | Client-failure reporting: resolve a message, alert once per reason | callback | #4, C20 |
| X11 | Metadata field mapper (`mainFileInternal`) | shared field list; harmless superset (inferred) or a mapper | B |
| X12 | Author/keyword caches | injected `{add, fetch}` pairs | A.1 two caches |
| X13 | Slot side effect on the metadata event (asset detail's main file) | callback | #7 |
| X14 | Asset-type feature lookup for mass operations | injected `(feature, assetType) => boolean`; LIB passes "always" | #14 |
| X15 | Fallback rules: flag source, "arm regardless" for imports, "only my main file", wording per row type | options on the shared poll (API agent) | C16, C17 |
| X16 | Detail-save sync: copy from the given asset incl. single-use vs re-fetch with suggestions | two actions or one with options, after #13 is settled | #13 |
| X17 | Public surface for apps: `queues` as a seedable container, `clearQueue`, `removeByAssetId`, `queueItemMetadataProcessed`, `processUpload`, `queueItemUploadStart`, `getQueueFileInputKey` | export list | A.4, E |
| X18 | DAM-only actions kept as an app-side extension over the core: slot add and lookup, mass-edit add + batch load + `Loading`, external provider add/remove/import | actions registered on top of the core (they only need `createQueue`/`addQueueItem`/recalc/`processUpload` and X2) | #2 |
| X19 | Config per queue instead of `default` read at setup | the queue (or the add call) carries the config name / client | A.1; today `useUpload` and the store use `default` (`lib:.../uploadService.ts:31`, `:89`, `L:47`) while the refresh and the single dialog take `configName` (`lib:.../uploadQueueItemRefresh.ts:14-15`, `lib:.../components/UploadQueueDialogSingle.vue:206-212`) |

Plainly shareable as it is (same on both sides today):

- the types, enums and the factory (already shared);
- `getQueue`, `getQueueItems`, `getQueueItemsByStatus`, the two counts, `getQueueItemsTypes`,
  `getQueueFileInputKey`, `forceReloadFileInput`, `createQueue`, `addQueueItem`, `recalculateQueueCounts`,
  `setUploadSpeed`;
- `processUpload` and the two constants;
- the skeleton of `stopUpload` and `clearQueue`;
- the `metadataLoaded` mechanism and the rules "loaded once", "failed is not editable", "a settled row survives
  a late client failure", "the form comes back with what the user typed";
- the custom-value emptiness rule of the mass operations;
- `useAssetSuggestions` (already imported by DAM, `D:13`);
- `envConfig.uploadStatusFallback` is already handed to the library as its `uploadStatusFallback` option
  (`dam:main.ts:46`), so the flag has one source.

---

## E. Tests

### E.1 Library (vitest in a browser)

Set-up: `lib:../vitest.config.mts` runs Chromium through Playwright (`browser.enabled: true`), `setupFiles`
installs a global pinia into `@vue/test-utils` (`lib:test/setup.ts:36-39`); the store suites still call
`setActivePinia(createPinia())` per test (`lib:.../__tests__/uploadQueuesStore.test.ts:79`). Rows are made by the
real actions (`addByFiles`, `addByCopyToLicence`) and then mutated. Notifications are delivered through the
listener captured from a mocked `useDamNotifications` (`uploadQueuesStore.test.ts:15-20`). Library-internal
module paths are mocked (`@/domains/dam/api/uploadApi`, `damAssetApi`, `commonAdminCoreDamOptions`,
`damConfigState`). Real timers: `window.setTimeout` is patched for waits of 10 s and more, because "Fake timers
stall the browser runner" (`uploadStatusFallback.test.ts:68-83`).

| File | Pins |
|---|---|
| `uploadQueuesStore.test.ts` | zero-byte file fails (`:85-98`); copy whose detail fails ends failed (`:100-117`); metadata once, typed values kept through fully-processed / notifications / copy / duplicate (`:135-193`, `:277-336`); failed stays not editable (`:195-226`); recovered row gets metadata and form from one request (`:229-249`), keeps typed values (`:252-274`), race variant (`:363-385`); settled row survives a late failure (`:339-360`); failed lookup takes the form away (`:387-406`); removed upload stops and frees its slot (`:411-427`); never more than two (`:429-450`) |
| `uploadStatusFallback.test.ts` | poll schedule and give-up (`:90-112`); removed row polled no more (`:116-134`); stopped / settled during finish (`:138-193`); copy polled, ends with its file id (`:195-207`); **polls again when the store's own request fails** (`:209-222`); still polled after metadata or a detail save (`:226-242`); no poll with the flag off (`:244-252`); copy / duplicate clear an older error (`:257-279`); duplicate with unreadable origin fails, no unhandled rejection (`:281-313`) |
| `uploadQueueSettledItemFailure.test.ts` | failed copy stays failed (`:61-74`); settled copy not failed by a late failing notification (`:75-87`) |
| `uploadQueueItemRefresh.test.ts` | refresh loads metadata of an uploaded row (`:95-110`); file status -> row status table (`:112-127`); can be asked again (`:129-141`); the list wires it (`:144-161`) |
| `uploadQueueStartsEachFileOnce.test.ts` | each file started once while rusha loads (`:59-76`) |
| `uploadStopAbortsChunk`, `uploadStopBetweenChunks`, `uploadStopWhileHashLoads` | the service's stop points (service agent) |
| `uploadQueueMassOperations.test.ts` | custom-value emptiness rule, with the store mocked (`:7-9`, `:13-52`) |
| `uploadQueueRowRefresh`, `uploadQueueDialogSave`, `uploadQueueDialogSingle`, `queueRowValidation`, `massOperationsValidation` | components (components agent); `uploadQueueDialogSingle.test.ts:235-253` pins that the row's single-use switch survives the detail being loaded |
| `lib:test/importCycles.test.ts:100-108` | the one allowed cycle is the upload one |

### E.2 admin-dam (vitest with happy-dom)

Set-up: `dam:../vitest.config.mts:35` (`environment: 'happy-dom'`). Every store test calls
`vi.resetModules()`, makes a fresh pinia and imports the store dynamically
(`dam:test/queue/slotNotifications.test.ts:83-88`), which also resets the module-level key sequence and stop
handles. Rows are **raw object literals written into `store.queues[QUEUE]`** (`:59-98`), not factory rows.
Handlers are called directly. DAM-local modules are mocked by path (`assetApi`, the four file APIs,
`uploadService`, `externalProviderImportService`, `currentExtSystem`, the caches, `:12-55`); the library is
mocked partially through `vi.mock('@anzusystems/common-admin', importOriginal)`
(`dam:test/queue/lazyMetadata.test.ts:14-17`). Fake timers for the poll
(`dam:test/fallback/notificationFallback.test.ts:71`).

| File | Pins |
|---|---|
| `queue/slotNotifications.test.ts` | file-id matching for slots (`:104-145`, `:235-259`); mass-edit rows decorated, not settled, not failed on another's file, left alone while `Loading` (`:147-233`); settle even when the asset is unreadable or has no main file (`:261-292`); settling frees the slot (`:295-312`); metadata warning kept / not on a row with metadata / taken back (`:314-366`); fallback's warning cleared (`:368-402`); duplicate marked with unreadable origin (`:404-416`); failed needs no request (`:419-446`); two at a time (`:191-205`, `:449-464`); stop by identity (`:466-480`); slot lookup (`:482-535`); remove by asset through the teardown (`:508-527`); the metadata rules (`:538-797`) |
| `queue/lazyMetadata.test.ts` | batch leaves an asset out / fails -> `Failed` with `system.uploadErrors.metadataUnavailable` (`:86-134`); mass operations in the store, incl. keywords/authors by enabled type (`:136-203`) |
| `queue/externalProviderImport.test.ts` | import service outcomes (`:46-116`) |
| `fallback/notificationFallback.test.ts` | finish vs notification race per asset type (`:69-123`); flag off (`:126-140`); armed for an import regardless (`:142-155`); slot is not the main file (`:157-170`); retry, stop conditions, give-up with the slot wording (`:172-251`); processed -> processed + metadata (`:266-281`); duplicate with its file (`:283-296`) |
| `appInitialize/appNotificationListeners.test.ts` | the listener passes the file id (`:56-73`), registers once (`:75-110`) |
| `queue/massOperationsSidebar`, `queueRowValidation`, `saveNothing`, `upload/uploadStop`, `list/detailRequests`, `list/externalProviderList` | components / service with the store mocked |

### E.3 Pinned on one side only

Only DAM: everything about slots, mass-edit rows and `Loading`; settle-before-fetch (C1); "failed needs no
request" (C6); the metadata warning (C8); recovered row without metadata stays without a form (C2, DAM's
half); duplicate is never editable (C9, C11); stop by identity; unique-key consequences are **not** pinned
(no test adds two files of one name).

Only LIB: copy rows and `queueItemCopied`; duplicate becomes the original; duplicate/copy failure paths;
recovered row gets its metadata from one request (C2, LIB's half); poll re-arms when the store's request fails
(C15); zero-byte file; "each file once while rusha loads".

Opposite pins (cannot both hold in one code path): C2 and C15.

---

## F. Risks of merging

1. **Same name, different signature or result**
   - `addByFiles(queueId, files)` vs `(queueKey, extSystem, licence, files)` (`D:161`, `L:117`).
   - `stopItemUpload(queueId, item)` vs `(queueKey, item, index)` (`D:423`, `L:505`).
   - `queueItemProcessed(assetId, fileId?)` vs `(assetId)`; `queueItemFailed` sync with `fileId?` vs async;
     `queueItemDuplicate` with a 4th `fileId` (`D:510`, `D:567`, `D:664-669`; `L:270`, `L:396`, `L:332-336`).
   - `removeByIndex` async vs sync (`D:346`, `L:497`).
   - `getQueue` -> `null` vs `undefined | null` (`D:95-100`, `L:69-74`).
   - `queues`: plain object, exposed (`D:85`, `D:822`) vs `Map`, private (`L:40`).
2. **Double handling of notifications.** LIB subscribes inside the store (`L:48-67`), DAM in the app
   (`dam:domains/system/composables/appNotificationListeners.ts:27-45`, guarded against a second registration at
   `:19-20`). One store with both subscriptions handles every event twice; today both stores already run in
   DAM once the library chip is rendered (headline 5, inferred).
3. **One meaning for `Asset` rows.** Applying DAM's matcher to LIB makes a copy row unfailable and never a
   duplicate (`D:505`); applying LIB's handler to DAM settles mass-edit rows the batch load owns (`L:288`), which
   DAM's tests forbid (`dam:test/queue/slotNotifications.test.ts:147-169`, `:207-233`).
4. **Settle-first is not free for LIB.** A copy row has no file id until the asset is read (`L:243`), and "the
   image is built from the file id: without it the copied item is dropped on confirm"
   (`lib:.../__tests__/uploadStatusFallback.test.ts:203-204`). Settling a copy before the fetch would produce an
   `Uploaded` row that cannot be applied. LIB's recovered row likewise takes its metadata from that response.
5. **Row identity.** Both `metadataLoaded` sets are keyed by `toRaw(item)` (`D:522`, `D:639`, `L:251`, `L:263`),
   but DAM's `uploadStopHandles` is keyed by whatever it is handed (`D:452`, `D:353`, `D:409`, `D:427`) - reactive
   proxy from the store, raw object from a test. `metadataFailures` is keyed by `queueId/item.key` (`D:75`) and
   so depends on keys being unique within a queue, which `asset_<id>` is not when an asset is added twice
   (`D:224`; `dam:test/queue/lazyMetadata.test.ts:106-120` does add one twice).
6. **Key format.** Making LIB keys unique changes `file_<name>` to `file_<name>_<n>`; no LIB reader of the
   format was found besides the Vue `:key` (grep), so the risk is low but it is a visible change in tests that
   seed keys.
7. **Timers.** The poll timer lives on the reactive row. LIB arms without looking at the status
   (`lib:domains/dam/api/uploadApi.ts:91-96`), DAM only for `Processing` (`dam:.../api/fileApi.ts:186`). LIB
   tests patch `window.setTimeout` at run time and DAM tests use fake timers, so shared code must call the
   global `setTimeout` at call time (a reference captured at module load would escape both).
8. **Ordering assumptions in callers.** DAM callers rely on the row being settled in the same tick
   (`fileApi.ts:153-159` does not await and does not re-arm); LIB's poll awaits the handlers and decides on the
   status afterwards (`uploadApi.ts:118-131`). One poll cannot serve both without X7.
9. **DAM's tests cannot reach into the bundle.** They fake DAM-local modules by path and seed `store.queues`
   directly. Once the store is library code, `vi.mock('@/domains/coreDam/asset/api/assetApi')` no longer
   intercepts what the store calls unless those functions are injected by DAM (X5); and raw literal rows that
   lack factory fields (`assetType`, `chunkSize`, ...) meet library code that may read them.
10. **Two caches and two message catalogues.** The shared code calling the library's author/keyword cache
    would leave DAM's chips, which read DAM's cache, without names (`D:82-83` vs `L:37-38`). DAM tests pin
    message keys (`system.uploadErrors.metadataUnavailable`, `...processingTooLongSlot`), LIB uses
    `common.damImage.uploadErrors.*`.
11. **Config binding at setup.** The LIB store throws at first use when the library has no `default` DAM config
    (`lib:domains/dam/composables/commonAdminCoreDamOptions.ts:36-42`) and keeps that config's client for its
    whole life (`L:47`).
12. **The import cycle guard** (`lib:test/importCycles.test.ts:100-108`) expects exactly the present cycle; any
    restructuring changes that test's expected value.
13. **DAM-only cross-store write** in the metadata handler (`D:649-656`) and DAM-only global reads at add time
    (`D:163-165`, `D:196`, `D:219`, `D:271-272`, `D:773-775`) must not move into library code.
14. **Processed on a mass-edit row that a file event had failed** clears its error but leaves it `Failed`
    (`D:519`, `D:527-532`; not pinned - `slotNotifications.test.ts:700-723` checks status and form only). A DAM
    oddity to carry over unchanged or to settle before the merge (inferred from the code).

---

## G. What "several queues vs one" means in the code

Same on both sides: the queue key is a string (`D:85`, `lib:domains/dam/types/UploadQueue.ts:11`); the limit of
two is per queue (`D:393-395`, `L:183-184`); every notification handler walks all queues (`D:514`, `L:275`).

DAM:

- Three fixed queues with different jobs, alive at the same time and across navigation
  (`dam:domains/coreDam/shared/services/upload/uploadQueueIds.ts:1-3`): `global` (uploads and external imports,
  `dam:.../externalProvider/composables/externalProviderAssetImport.ts:35-39`), `slots` (slot uploads,
  `dam:.../detail/components/slots/AssetSlotListItem.vue:74`), `edit` (the mass-edit selection,
  `dam:.../list/composables/assetListActions.ts:351`).
- Each has its own always-mounted UI (footer overlays reading by fixed id, e.g.
  `dam:.../footer/AssetFooterUploadOverlay.vue:28-31`, `AssetFooterUploadSlotsOverlay.vue:30-33`,
  `AssetFooterSelected.vue:32`).
- One asset can sit in two queues, or twice in one, with different roles: uploaded in `global` and picked in
  `edit`; several slot rows of one asset in `slots`. Hence the file-aware matcher (`D:492-508`) and the
  `type !== Asset` guards (`D:519`, `D:559`).
- A queue is emptied without being stopped (`clearQueue` from outside).

LIB:

- The key is a prop of each widget instance (`lib:domains/dam/imageWidget/components/AImageWidget.vue:21`, ...),
  so the map can hold many queues - but only one is ever shown: the open dialog is one module-level ref
  (`lib:domains/dam/uploadQueue/composables/useUploadQueueDialog.ts:4`), and the mass-operations sidebar flag is
  one module-level boolean (`:5`).
- A queue lives exactly as long as its modal dialog: every close path calls `stopUpload`, which empties it
  (`lib:.../components/UploadQueueDialog.vue:88-91`, `UploadQueueDialogSingle.vue:218-222`,
  `lib:domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue:414-415`,
  `lib:domains/dam/assetSelect/components/AAssetListInner.vue:214-215`).
- One role only: rows waiting to be settled, all images, each answering to its asset id alone (`L:277`,
  `L:401`).
- One DAM configuration for the store and the upload service (`default`, `L:47`,
  `lib:.../composables/uploadService.ts:31`, `:89`).

So: "one" = one live queue at a time, one row role, one configuration. Not one key.

---

## H. Open questions (UNKNOWN), and what settles each

| # | Question | Settled by |
|---|---|---|
| U1 | Recovered row without metadata: form at once (LIB) or after refresh (DAM)? (C2) | owner decision; both are pinned |
| U2 | Unreadable metadata: warning on the row (DAM) or only the late refresh button (LIB)? (C8) | owner decision |
| U3 | Can the backend send a duplicate without an origin file? (C13) | backend / notifications agent |
| U4 | Can a duplicate's asset have `assetStatus = with_file`? If so DAM's refresh settles it as processed (C18) | backend; components agent |
| U5 | After a detail save, must the row's single-use switch follow? (#13) | reading both detail sidebars and the bulk save payload (components agent) |
| U6 | Does any admin use a non-default DAM config with upload? If so the LIB store already uses the wrong client for it (X19) | grep of the consuming admins |
| U7 | Does DAM want `mainFileInternal` on rows? (B) | owner |
| U8 | Does the library chip really mount inside DAM's `AAssetSelect` at run time (headline 5)? | reading the `v-if`s on that path, or one run of the app |

---

## PROPOSALS (mine, not facts)

P1. Treat the store as three layers: (a) a pure queue core (container, counts, slots, stop/remove/clear, the
    metadata-once and form rules), (b) event handlers parameterised by a row-role table (X2, X3, X6, X7),
    (c) app actions. LIB's widget actions (`addByFiles`, `addByCopyToLicence`) and DAM's (`slot`, mass edit,
    external) both sit in (c); DAM's stay in admin-dam as an extension that calls the core (X18).

P2. Resolve headline 4 first, before any code moves: introduce an explicit role for the two `Asset` rows (for
    example a new item type for the copy row, or a `settledBy: 'events' | 'batch'` field set at creation).
    Everything in C3/C10 follows from it, and it is invisible to users.

P3. Port as bug patches, each with the other side's test as the model:
    - to LIB: unique row keys (#1); `queueItemFailed` without the fetch and with the message emptied (#8,
      C6, C7); stop/remove by identity (#10);
    - to LIB for upload rows only: settle on the event (C1) - not for copy rows (F.4);
    - to both: make `asset_<id>` keys unique too, so `metadataFailures` cannot collide (F.5).
    None of these changes what a user sees when nothing goes wrong.

P4. Do not unify C2, C8, C11, C20 without an owner answer (U1, U2); carry them as options defaulting to each
    side's present behaviour, so both test suites keep passing unchanged.

P5. Move the notification subscription out of the store (X4) and have the library plugin (for widgets) or
    DAM's `initAppNotificationListeners` (for DAM) do it once. That also ends the double handling of headline 5.

P6. Inject the API functions, caches, translate and reporting hooks at store creation (X5, X9, X10, X12). This
    is what lets DAM's existing tests survive: they would hand their fakes to the factory instead of
    `vi.mock`-ing paths the bundle never imports (F.9).

P7. Keep `queues` reachable for DAM (X17) but hide the container type behind `getQueue`/a small seeding helper,
    so the object-vs-`Map` choice stops leaking; DAM's tests then need one helper changed, not every seed.

P8. Order of work that keeps both products green: P2 -> P3 (bug patches on each side separately, still two
    stores) -> extract the core in the library with LIB as its first consumer -> export it -> DAM consumes it
    with its options and extension actions -> delete DAM's copy. The import-cycle guard
    (`lib:test/importCycles.test.ts:100-108`) is the natural acceptance check for the extraction step.
