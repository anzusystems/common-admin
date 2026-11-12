# Review of `navrh-krok2.md` (Opus, read-only, nothing run)

Path prefixes: `LIB/` = `common-admin/src/domains/dam/`, `LT/` = `LIB/uploadQueue/__tests__/`,
`DAM/` = `admin-dam/src/domains/coreDam/`, `DT/` = `admin-dam/src/test/`,
`BE/` = `core-dam/vendor/anzusystems/core-dam-bundle/src/`, `N:` = line of the design, `store` = the upload store of that side.
Only test files tracked at HEAD were used as evidence; today's untracked ones were not opened.

## 1. Open questions

- **O1 DISAGREE as the default; it is a product change not covered by R/D.** R4 says "with the service ... as today", and today a
  `processed` event alone leaves the row uploaded with no form: `LT/uploadQueueItemRefresh.test.ts:95-100`,
  `DT/queue/slotNotifications.test.ts:314-329`. Keep: a read triggered only by `processed` settles without metadata (except a
  client-failed row, R6), and so do the later reads of an `awaitingRead` row; a pending `metadata` trigger merged into the same read
  (N:238) still loads it, which keeps N:363-365 true. For the owner later: "yes" is safe on
  the backend (metadata and `processed` commit together, the event goes out after commit, `BE/Domain/AssetFile/AbstractAssetFileStatusFacade.php:302-318`).
- **O2 DISAGREE with the interim `false`: clear in LIB now, drop the flag.** LIB prints the message in place of the reason chip
  (`LIB/uploadQueue/components/UploadQueueItemEditable.vue:258-263`); DAM already fixed it (`DAM store:574-575`), so it is a one-sided bug.
  With R7 and the 20-minute text the settlement itself writes messages a later `failed` must remove. No LIB test pins the old text.
- **O3 AGREE.** But the failure path must also `untrack` (today it clears the timer, `LIB store:350`); see E7.
- **O4 AGREE**, two edits. EN: "the item's refresh button", as the neighbour `common-admin/src/locales/en/common/damImage.json:212`.
  DAM: `metadataFailed` sends the user to a refresh button a slot row does not have (`DAM/asset/api/fileApi.ts:131-136`); today a slot
  never gets that warning (`DAM store:603`). Keep that: no R7 warning on rows with `metadata: 'none'`.
- **O5 AGREE.** D5 gives no limit; 20 minutes is an implementation bound, and "Refresh" stays on the row (R8).
- **O6 AGREE.** The bulk endpoint returns the same detail DTO (`BE/Repository/Decorator/AssetAdmRepositoryDecorator.php:36-45`), also
  under UGC (`core-dam/src/Controller/Api/Ugc/V1/AssetController.php:75-85`). 250 ms instead of the plan's 2 s keeps today's latency.
- **O7 AGREE, with E3 fixed.** The LIB row key is not unique today (`LIB store:128`), so identity is the safer handle.
- **O8 AGREE.** The LIB store is not exported from `src/lib.ts`; the wrappers serve the three widgets and the tests only.
- **O9 AGREE.** No message arrives before `OPEN`; the code uses `CONNECTING` only to avoid reopening
  (`LIB/composables/damNotifications.ts:65`). The cost is a 5 s first read instead of 10 s while it connects.
- **O10 AGREE; a one-sided bug fix, not a product change.** LIB refresh already decides on the main file
  (`LIB/uploadQueue/composables/uploadQueueItemRefresh.ts:24`). The backend sets `with_file` when any file of the asset is processed
  (`BE/Domain/AssetFile/AssetFileStatusManager.php:65-69`), so the two criteria differ only when another slot finished first.
- **O11 AGREE.** The slot queue renders through `DAM/asset/components/queue/AssetQueueItemList.vue`, which reads only `displayTitle`,
  `error`, `isDuplicate`, `progress`, `status`; the single reader of `item.assetStatus` is `AssetQueueItemEditable.vue:186`.
- **O12 AGREE with a limit.** Not failing such a row is today's behaviour (a failed read is only logged, `DAM store:538-545`).
  Warn only while the row has no metadata; a row with its form is left silent, as today (`DAM store:605`,
  `DT/queue/slotNotifications.test.ts:331-344`). The same limit for the R7 warning on any `awaitingRead` row.
- **O13 AGREE on the lazy subscribe, DISAGREE on unsubscribing.** `notify` already ignores an event no row matches, so an idle listener
  costs nothing. Six test mocks return the callback or `undefined` as the "off" handle (`LT/uploadQueuesStore.test.ts:18`,
  `LT/uploadQueueStartsEachFileOnce.test.ts:44`), and `LT/uploadQueueItemRefresh.test.ts:81` empties the queue after every test.
- **O14 AGREE.** One flag disables the button of every row while a refresh runs (`LIB/uploadQueue/components/UploadQueueEditable.vue:36,137`,
  `DAM/asset/components/queue/AssetQueueEditable.vue:25,98`).
- **O15 DISAGREE: drop only the trailing flag, keep `endPointAsset` until step 5.** Mocks read the item by position
  (`LT/uploadQueuesStore.test.ts:36,43`); with the parameter gone `sha` lands there, and `:424` (`call[3].file?.name`) passes vacuously.
- **O16 AGREE to keep both exceptions, but the proposed gate is wrong**; see E1.

## 2. Errors in the design

**E1. Mass-edit rows: three statements about today's code are false (N:106, N:345-347, N:716-721).**
Today `failed` and `duplicate` do reach a mass-edit row that carries a file id: only the fileless one is refused
(`DAM store:505`, used at `:571` and `:673`). Today the metadata event loads any non-slot row without a form, not only one in
`metadataFailures` (`DAM store:620-640`; the set matters only for a `Failed` row, `:627`).
Pinned by `DT/queue/slotNotifications.test.ts:700-723` (`:713` form from the metadata event, `:715-721` failed by `file-2`) and
`:745-760`; the table cell N:347 "nothing" also contradicts N:287-288 and the gate itself.
Correction: `settleOn: 'never'` governs `processed` only (`DAM store:519`). `failed`/`duplicate` apply whenever
`matches(row, target, 'settle')`. Policy `metadata: 'load'` for mass edit; gate = `metadataFailures.has(key) ? 'load' : undefined`.
`metadata` on a `never` row schedules the delayed read. Run `afterDecorate` only for `processed`/`manual` reads.
Also keep `metadataFailures.delete` in `removeByIndex`/`clearQueue` (N:747 drops it; `DAM store:355,740`; the key is `asset_<id>`, `:224`).

**E2. `mergeLoadedMetadata` drops the switches (N:307-316).** Today the first metadata load also takes `mainFileSingleUse`
(and `mainFileInternal` in LIB): `LIB store:431-432`, `DAM store:635`. The design sets them only in `settleProcessed` step 4, which is
skipped once the form is open (N:298), and the metadata event normally comes first. The row then keeps the factory `null`
(`LIB/uploadQueue/factory/UploadQueueItemFactory.ts:59`) and sends it in the bulk PATCH (`LIB/api/damAssetApi.ts:214`). Pinned by `LT/uploadQueuesStore.test.ts:182-192`. Correction: take both switches in the first load.

**E3. The stale-read guard does not cover what it claims (N:255-256, N:268, N:535-537).** `applyAssetRead` reads
`stav.lastAppliedSeq`, but it must also write rows with no `TrackState`: an uploading row on the metadata event
(`LT/uploadQueuesStore.test.ts:212-226`), every seeded row in the DAM store tests (`DT/queue/slotNotifications.test.ts:90-98`), a
mass-edit row. `untrack` at settle drops the number, and event writes (`settleKnownFailed`, the status written at `processed`) take
none, so an older read showing `processed` can undo a later `failed` (`BE/Domain/AssetFile/AssetFileStatusManager.php:127-128`).
Correction: keep the last sequence in its own `WeakMap`, default 0, never deleted by `untrack`, bumped by event writes too.

**E4. A failed read after `copied` changes from "failed for good" to "retry", unlisted and undecided (N:344, N:367-369).**
Today `LIB store:467-478`; pinned by `LT/uploadQueuesStore.test.ts:100-117`, `:387-406`, `LT/uploadQueueSettledItemFailure.test.ts:61-74`.
The plan's rule 3.2-8 supports the retry and the old behaviour only guarded against "processing forever", so I vote for the design.
But it is a visible change outside R/D: it needs the second opinion, and the three tests are rewrites, not re-timings (N:673-678).

**E5. "Tests that fake `fetchAsset` stay valid" is false (N:604-605, N:271-274).** The design needs `mainFile.fileAttributes`; today
LIB settles on any `mainFile` (`LIB store:277,457`) and DAM decorates on any (`DAM store:546-551`). Fixtures without it:
`LT/uploadQueuesStore.test.ts:47-51,122-131` (eight tests from `:135` to `:385`), `DT/queue/slotNotifications.test.ts:5-10,785-790`
(asserts `:165`, `:795`). Production always has the field, so: complete the fixtures per test and move the `never` branch above the
`fileAttributes` check. Not globally: `LT/uploadQueuesStore.test.ts:195-209` then flips (a failed row revived by a metadata read).

**E6. LIB `failed` has two paths (N:345 named read, N:620 `settleKnownFailed`).** The event carries the reason
(`BE/Model/Domain/AssetFile/AssetFileStatusAdmNotificationDecorator.php:43-47`); the read today only re-derives the id and swallows
its failure (`LIB store:396-414`), which DAM already removed (`DAM store:568`). Correction: `notify` uses `settleKnownFailed` in LIB too.

**E7. `becomeOriginal` failure does not say `untrack` (N:328-330).** Without it the next tick reads `duplicate` again, retries the
origin and revives the row, which is the retry O3 rejects. Add `untrack` and `onRowFinal` there.

**E8. D5 condition differs between sections.** N:354-355 tracks only when the row is neither `Uploaded` nor `Stop`; N:614 and N:741
omit it. The LIB `catch` also runs for a stopped row and for one the notification already settled (`LIB store:202-214`). Use N:354.

**E9. "DAM tests work without changes" is false (N:552-553).** The `useUpload` mock has no `finishAttempted`
(`DT/queue/slotNotifications.test.ts:27-42`); five tests reject `upload()` (`:612-742`) and would throw inside the `catch`.
The file awaits `queueItemMetadataProcessed` 18 times on real timers: 2 s each under D8 unless DAM tests get an immediate scheduler
too, and that helper sits in LIB `__tests__/support`, not in the exports (N:822-826).
LIB: six files mock `composables/damNotifications` with `useDamNotifications` only (`LT/uploadQueuesStore.test.ts:16-20` and five
more), so a store importing `useDamNotificationsConnection` fails at creation. Not in N:673-678.

**E10. Detail `mainFile` on the socket path moves from the metadata event to `processed` (low).** Today `DAM store:649-656`. In the
design `notify(metadata)` reads nothing for an asset that has only slot rows: the wrapper passes `fileId: null` (N:745) and the
matcher refuses a slot without a file id (`DAM store:504`). Acceptable (the file is processed by then), but say so in 6.4.

**E11. Smaller gaps.** (a) Plan item 11 asks for "Refresh during a read" (`doc/2.0.0-analyza/upload-plan.md:295`); no such case in
N:941-957. (b) A successful read "cancels the warning" (N:367-369) on the same `error` fields the 20-minute text uses (N:507-509):
restore the slow text when it was shown. (c) `refreshAsset` has no outcome defined for a decorate-only row (N:186).

## 3. The three riskiest steps

**L5 (store onto the settlement).** First step that changes behaviour, and where E2-E9 surface at once.
Verify: the six `damNotifications` mocks and the incomplete fixtures are updated before reading any red test as a product bug;
`common-admin/src/test/importCycles.test.ts:100-108` still shows exactly the one old cycle (it goes only in L7);
a row whose `processed` beat the finish answer is not tracked; the "exists" copy path (`LIB/imageWidget/components/ImageWidgetInner.vue:335-336`)
leaves no tracked row and no later request; after `stopUpload`/`removeByIndex` no timer and no read remain;
with two tracked rows the bulk URL carries the row's licence under both endpoints, or D7 fails healthy rows 16 s after finish.

**D2 (DAM store onto the settlement).** Largest matcher surface: three queues, one asset in two queues, seeded untracked rows.
Verify: all of `DT/queue/slotNotifications.test.ts`, above all `:147-169`, `:700-723`, `:745-760`, `:779-796`;
`useDamNotificationsConnection()` reads no plugin options while no singleton exists (the tests load the store unconfigured, `:83-88`);
a mass-edit row never appears in a poll request; `DT/appInitialize/appNotificationListeners.test.ts` passes untouched.

**D3 (slots through the slot list).** A wrong response shape turns every slot read into "file missing", and D7 then fails every slot
upload after three reads: 16 s without the service, 60 s with it, before the notification arrives. The backend answers
`{ data: [...], totalCount }` with `assetFile` per slot (`BE/Domain/AssetSlot/AssetSlotFacade.php:33-43`,
`BE/Model/Dto/AssetSlot/AssetSlotAdmListDecorator.php:40-44`); the slot exists from upload start (`BE/Domain/AssetFile/AbstractAssetFileFacade.php:265-268`).
Verify: a miss is counted only on a parsed list; two slots of one asset settle separately; a duplicate slot file is found in the list;
`DAM/asset/components/detail/components/slots/AssetSlotListItem.vue:88-92` still emits `refreshList` when the row settles from a read.

## 4. Could not verify

- UGC and CMS sources: that UGC never calls `initDamNotifications()` (N:528), what `notification` it passes, and whether any
  consumer mounts the queue with a non-default `configName` (`LIB/uploadQueue/composables/uploadQueueItemRefresh.ts:14-15`: the
  refresh would move from that config's client to the default one).
- Whether asset reads can hit a lagging database replica. D7 (misses at 5, 10, 16 s) and "metadata written once" both assume
  read-your-writes.
- The file status of a copy when `asset_file_copied` goes out. `BE/Domain/Image/ImageCopyFacade.php:183-192` can fail a target slot
  and `:122-124` still sends the event for it; today LIB settles such a copy as uploaded, the design would fail it.
- The 404 shape for `isNotFound` (N:606); `common-admin/src/domains/api/utils/apiErrors.ts:117` has `apiErrorStatus`, not traced further.
- The copy target licence equals the widget's `config.licence` in all three widgets (only `ImageWidgetInner.vue` was read).
- Step 1 is not in the code yet (`LIB store:128`, `:505`); the design tolerates that, but R6 on the DAM side
  (`DT/queue/slotNotifications.test.ts:678-696`) is still pinned the old way.
- What the untracked test files added today pin, and anything that needs a run: no test, build or linter was executed.
