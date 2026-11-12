# Review of `doc/2.0.0-analyza/upload-plan.md` (Opus, read-only, nothing run)

Path roots: `LIB/` = common-admin `src/domains/dam/` (other LIB paths written from `src/`), `DAM/` = admin-dam `src/domains/coreDam/` (others from `src/`), `BE/` = core-dam `vendor/anzusystems/core-dam-bundle/src/`, `APP/` = core-dam, `NS/` = `anzusystems/notification-server` (it is checked out locally). "l.N" = line of the plan. Every path:line below was opened.

## ERROR (most severe first)

**E1. The rhythm as written starves every row of a batch except the last one (breaks R15; regression for UGC at step 2, for CMS and DAM at step 4).**
Evidence: l.79 counts age from the youngest waiting row and rule 2 (l.92-93) lets every newly finished row restart the rhythm, first read at 5 s. Uploads run two at a time (`LIB/uploadQueue/store/uploadQueuesStore.ts:33,177-189`; `DAM/asset/store/uploadQueuesStore.ts:55,387-401`), so in a batch a row finishes every 1-3 s and the 5 s mark is not reached until the last file is sent. Today each row has its own timer, 10 s after its own finish (`LIB/api/uploadApi.ts:91-100`; `DAM/asset/api/fileApi.ts:114-116,185-191`). 50 files, 60-100 s of sending: row 1 is first read at about 65-105 s instead of 10 s, and with R4 no form opens meanwhile.
Correction: keep one poller per queue, but compute the due time per row from its own finish and tick at the earliest due row; or let a new finish only pull the next read forward (`next = min(next, now + 5 s)`), never push it back. Rewrite l.79 and rule 2.

**E2. 3.3 bullet 1 ("the status a notification carries is written at once", l.128) breaks LIB copy-to-licence rows and contradicts risk 5.2.**
Evidence: a copy row has no `fileId` until the asset is read (`LIB/uploadQueue/store/uploadQueuesStore.ts:96-104,243`). "Save and apply" shows as soon as all rows are Uploaded or Failed (`LIB/uploadQueue/components/UploadQueueDialog.vue:67-69,221`) and drops rows without a file id without a word (`LIB/imageWidget/utils/metadataToImageMap.ts:63`, pinned at `LIB/uploadQueue/__tests__/uploadStatusFallback.test.ts:203-205`). `asset_file_copied` carries `processed` (`BE/Domain/Image/ImageCopyFacade.php:122-124`). DAM needs the opposite order (`DAM/asset/store/uploadQueuesStore.ts:511-513`).
Correction: make settle order a property of the row role. Status straight from the event only for DAM upload and slot rows; for LIB upload and copy rows an event only triggers the read and `Uploaded` comes from the read. Delete the blanket sentence.

**E3. Step 2 switches the push off for DAM production, two steps before its config is repaired and before step 3 exists.**
Evidence: 3.1 / step 2.1 start the service only on `enabled === true`. The DAM deploy template has `"enabled": "#{NOTIFICATION_ENABLED}#"` (a string) and no `uploadStatusFallback` (`petit/admin-dam/public/config.json.cf.dist:19-22`); DAM copies both verbatim (`DAM src/shared/EnvConfigService.ts:44-46`, `src/main.ts:46-50`); today the string is truthy (`LIB/composables/damNotifications.ts:21`). The template is fixed in step 4.1. Until step 3, distribution statuses, YouTube authorisation and `user_updated` have the push only (`DAM src/domains/system/composables/appNotificationListeners.ts:47-67`).
Correction: fix the template (and `EnvConfig` type) before step 2, or keep accepting `"true"` until step 4, or do step 3 first. For step 4.2(b) name the key: in CMS it is `dam.notification.enabled`; `notification.enabled` there is another product (`admin-cms/public/config.json.cf.dist:72,87`).

**E4. Without the service, R6 recovery never happens by itself: a row that failed on the client is final for the poller.**
Evidence: a failed finish or chunk request makes the row Failed (`LIB/…/uploadQueuesStore.ts:202-214`; `DAM/…/uploadQueuesStore.ts:458-485`); Failed counts as done (`LIB/…/uploadQueuesStore.ts:166-168`) and a tick reads only rows "not in a final state" (l.74-75). Today the later `processed` event repairs such a row (`LIB/…:282-286`, `DAM/…:519-524`), which is the R6 case. With polling as the only channel only the R8 button is left.
Correction: keep a row that failed on the client after its file was created (asset id + file id, no server fail reason) in the polled set. State the ordering on server statuses (uploading < uploaded < stored < processed/duplicate < failed; `processed -> failed` is a legal backend transition) and say a client failure can be overridden. "A final state is never overwritten" (l.130) covers neither.

**E5. The option list of the single function (l.132-134) leaves out duplicates and the dependencies it must be handed in step 2.**
Evidence: LIB turns a duplicate row into the original asset: `assetId` and `fileId` rewritten, original's metadata, form on, images only (`LIB/…/uploadQueuesStore.ts:338,359-388`). DAM keeps the asset, sets `duplicateAssetId`, form off, reads the origin by file type (`DAM/…/uploadQueuesStore.ts:671-721`). No R1-R15 decides it. A duplicate needs a second request per row that the batch does not carry (`LIB/api/damAssetApi.ts:77-87`; `DAM/…/uploadQueuesStore.ts:691-704`), so "one batch read per tick" is not the whole cost. The function also writes an author/keyword cache: LIB's (`LIB/…/uploadQueuesStore.ts:37-38,260-262`) or DAM's own (`DAM/…/uploadQueuesStore.ts:82-83,646-648`), which DAM's chips read until step 5; message keys differ too (`DAM/asset/api/fileApi.ts:132-136`).
Correction: add a duplicate policy option and injected `readDuplicateOrigin`, cache adders and message resolver to 3.3, or get an owner decision that one duplicate behaviour wins.

**E6. R4 widens a data-loss window the plan never mentions: mass operations done before a row has its metadata are overwritten by the first metadata load.**
Evidence: mass operations write into every row whatever `canEditMetadata` says (`LIB/uploadQueue/composables/uploadQueueMassOperations.ts:13-44`; `DAM/…/uploadQueuesStore.ts:751-802`), the sidebar button is always there (`LIB/uploadQueue/components/UploadQueueDialog.vue:283`), and the first load replaces keywords, authors and custom data (`LIB/…/uploadQueuesStore.ts:250-256,428-432`; `DAM/…:632-635`). With the push the window ends at the first chunk; under R4 it lasts the whole upload, processing and the next read. UGC has this today; CMS and DAM get it when the service goes.
Correction: in the settle function fill only fields still empty on such a row (or block the mass action for rows without metadata); add a test; list it as a decision.

**E7. Step 0 pins things the plan says are not pinned and things step 2 deletes; step 2.6 understates the rewrite.**
Evidence (test ids: `podklady/upload/9-tests-coverage.md:564-639`, `8-tests-consumers.md:471-484`; all inside the waves at l.162-167):
- A4 pins the timers `[10000, 40000, 90000, 160000, 250000]` and the give-up; A2 pins "no read before the 10 000 ms timer" and `GET …/asset/{id}`; LS1 "a read of GET asset". l.171-173 says times are not pinned; the URL becomes the ids call.
- LS9 pins "flag off: no wait, no read" and the 6th argument of `damUploadFinish` (3.1 removes the flag). A7 pins "UGC failed row shows no refresh" (R8). LR8 and DR6 pin chunks of 25 (step 2.1). B1 pins `mainFileInternal: false` in the PATCH (R11).
- DS1 and DS4 assert calls of the four `queueItem…` functions on a mocked store; DS2 and DS3 extend `notificationFallback.test.ts`, whose subject (`DAM/asset/api/fileApi.ts:114-200`) step 2.4 deletes; DS3 pins "warning at once" (R7).
- "Only the edge is faked" (l.158) is not what those specs do: LS1-LS8 mock the module `damAssetApi`, so each one's mock changes in the step it should guard.
- Not in step 2.6: the `< 10_000` timer shims that assume a first wait of 10 s (`LIB/uploadQueue/__tests__/uploadStatusFallback.test.ts:79`, `uploadQueueDialogSingle.test.ts:102`, `uploadQueueRowRefresh.test.ts:39`, `uploadQueueSettledItemFailure.test.ts:54`), the flag assertions at `uploadStatusFallback.test.ts:160,190`, all 13 tests of `DAM src/test/fallback/notificationFallback.test.ts` (mocks `:16-29`, flag `:58,126,142`, slot hang `:157`), `src/test/queue/externalProviderImport.test.ts:5-10,58,75`, `src/test/appInitialize/appNotificationListeners.test.ts:57-67`.
- Unguarded when it changes: slot rows. Step 2 rewrites how they settle; the only guard (DC3, `DAM/asset/components/detail/components/slots/AssetSlotListItem.vue:73-92`) is in wave 4.
Correction: wave 1 drives a fake axios client and asserts "the row's asset was read, and what was written", never a function name, URL shape or delay. Drop A4, LS9, LR8, DR6 as written; reword A2, A7, LS1, B1; move DC3 and a slot-without-socket test to wave 1; redo the 2.6 list.

**E8. The R7 patches sit in step 1 but need the repeat that only step 2 brings.**
Evidence: step 1 LIB 9 and DAM 2. Before step 2 the metadata read runs once per event (`DAM/…/uploadQueuesStore.ts:587-616`, comment `:590-592`; `LIB/…/uploadQueuesStore.ts:417-450`, the catch does nothing) and DAM production has no fallback (E3). In step 1 this either removes DAM's present warning with nothing behind it, or adds a retry loop that step 2 throws away, against l.153-154.
Correction: move both to step 2; rule 7 already has the retry ladder.

**E9. Step 4.2(a) cannot be reached inside the plan's own limits.**
Evidence: (a) "all admins run LIB with step 2" (l.237) against "no write to CMS and UGC, no release or tag of the library" (l.299-301) and "the library reaches DAM by copy.sh" (l.34-35). CMS and UGC get a new LIB only by a release and a dependency bump. Risk 9 also wants a CMS e2e rewritten.
Correction: name the release and the two bumps as an external gate of 4.2(b)-(d), with an owner.

**E10. A first read at 20 s with the service contradicts R15 and is slower than today.**
Evidence: l.83; R15 calls 10 s a lot; both copies read 10 s after finish today (`LIB/api/uploadApi.ts:15,98-100`; `DAM/asset/api/fileApi.ts:73,114-116`). The backup matters when an event is lost, and the server loses them silently: no replay, ack regardless (`NS/src/pubsub/notification-pub-sub.ts:44-58`). Rule 5 detects a dead socket, not a mute one (for example 4.2(c) done before (b)).
Correction: 10 s, then 30 and 60 s with the service; keep the sparse tail.

**E11. Step 5 removes DAM files that non-upload code imports, and keeps one file that imports two removed ones; step 2 misses files.**
Evidence (DAM importers, tests excluded): `fileValidation.ts` is imported only by `DAM/shared/components/FileUpload.vue:7`, which stays (l.259); `windowFilesDragWatcher.ts` by `DAM src/App.vue:7` and `FileUpload.vue:6`; `AssetImage.vue` by 13 files, 11 outside the queue (podcast, podcast episode, external provider, list tile and table row, detail views, distribution preview); the author cache by 10 files (`assetLicenceActions.ts`, `authorCleanPhraseActions.ts`, `authorActions.ts`, `assetDetailStore.ts` …), the keyword cache by 7; `AuthorCreateButton.vue` by `AuthorListView.vue`; the author autocomplete by `AssetLicenceEditForm.vue` and `AssetMetadata.vue`. The caches are not drop-in: LIB's reads `cachedExtSystemId`, which each widget sets (`LIB/author/composables/cachedAuthors.ts:23-27`); DAM's reads the current ext system (`DAM/author/composables/cachedAuthors.ts:22-26`). Of these blocks `LIB src/lib.ts` exports only `fetchAsset` (`:516`) and `useDropzoneGlobalDragState` (`:869`).
`LIB src/test/importCycles.test.ts:100-108` turns red in step 2, not step 5: once the fallback leaves `api/uploadApi.ts` the imports at `uploadApi.ts:12` and `uploadQueuesStore.ts:14` go and the expected cycle is gone.
Step 2 LIB list misses: `LIB/uploadQueue/composables/uploadQueueItemRefresh.ts:20-38` (LIB's own copy of the refresh; only DAM's is named), the three direct `queueItemDuplicate` calls for copy result `exists` (`LIB/imageWidget/components/ImageWidgetInner.vue:336`, `ImageMediaWidgetInner.vue:344`, `ImageWidgetMultipleInner.vue:227`), `LIB/uploadQueue/composables/uploadService.ts:30-34`, `LIB/composables/damNotifications.ts:19-21,89-90` (reads `notification.*` unguarded).
Correction: split 5.4 into "upload-only, removed" and "shared block replaced across DAM" with importer lists; add the export list; move the cycle test to step 2; complete the step 2 list.

**E12. Small false statements.**
- 3.1: `fileApi.ts:73-74` are the two poll constants. The env flag is read at `DAM/asset/api/fileApi.ts:199` (also `DAM src/main.ts:46`, `EnvConfigService.ts:11,46`, `types/EnvConfig.ts:7`, `public/config.json.dist:7`).
- Step 1 DAM 4 "`#id` as in LIB": LIB's chips have no such fallback, they spin (`LIB/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue:70,93`; keyword chip `:59,74`); only `LIB src/domains/cached/components/ACachedChip.vue:70` prints `#id`. It is new visible behaviour on both sides, not drift.
- R9 / step 1 LIB 3 "as '+', including the limit of 50": true for the multiple widget only. `AAssetListInner` (UGC's asset page) adds without any limit (`LIB/assetSelect/components/AAssetListInner.vue:205-209`). Do not add one unnoticed.
- Risk 9: the CMS flow does not fail with a first read at 5 s; the click after the fixed wait auto-waits 30 s (`admin-cms/e2e/playwright.config.ts:49`).
- Rule 9: a copy does get an event, `asset_file_copied` (`BE/Domain/Image/ImageCopyFacade.php:122-124`, heard at `LIB/…/uploadQueuesStore.ts:63-65`); only the metadata event never comes.

## PROPOSAL

**P1. "Taking too long": a floor per type instead of 20 min for all, and drop `n x D`.** The text no longer stops anything (rule 6), so showing it early costs nothing. `D` = ack deadline is not a per-file time: a worker pulls up to 10 messages under one deadline (`APP/vendor/petitpress/gps-messenger-bundle/src/Transport/GpsConfigurationResolver.php:76`), the lock is shared by every user of the licence (`BE/Domain/AssetFile/AbstractAssetFileStatusFacade.php:207`) and expires after 60 s (`APP/vendor/anzusystems/common-bundle/src/Util/ResourceLocker.php:81`), and external imports go through the video queue whatever their type (`BE/Domain/AssetFile/AbstractAssetFileFacade.php:181`). After a killed worker the first redelivery is at deadline + 2 s, not + 600 s (`BE/DependencyInjection/AnzuSystemsCoreDamExtension.php:174-178`). 50 images give 52 min by the formula. Suggest image and document 3-5 min, audio 12, video 20. Trade-off: the hint can show during a real backlog.
**P2. Read what the event names, not the whole pending set.** With the service each file sends two handled events, and "same as a poll tick" (l.128) re-reads up to 50 full detail DTOs for each. Trade-off: two read paths into one apply function.
**P3. Delay the read a metadata event triggers (trailing 2 s).** The event can be published before its transaction commits (`BE/…/AbstractAssetFileStatusFacade.php:302-309`, `BE/Domain/AssetFile/FileProcessor/MetadataProcessor.php:39-43`) and metadata is applied once. Trade-off: the form opens up to 2 s later.
**P4. Slots: one `GET /asset-slot/asset/{asset}` per asset** (`BE/Controller/Api/Adm/V1/AssetSlotController.php:38-45`, files in detail view) instead of one file read per row. Trade-off: a new helper against the existing per-type file reads.
**P5. Give rule 7 an end state for a missing asset** (after N misses: Failed, "asset no longer exists"). Otherwise the row stays Processing, is polled for good and keeps "Save and apply" hidden (`UploadQueueDialog.vue:221`).
**P6. Add two one-sided LIB bugs to step 1:** row keys are not unique (`'file_' + file.name`, `LIB/…/uploadQueuesStore.ts:128`, used as `:key` at `LIB/uploadQueue/components/UploadQueueEditable.vue:126`; fixed in DAM `:67-69`) and a row is stopped by index (`LIB/…:505-514`; DAM by identity `:432-434`). Trade-off: touches LQ2 and LC2.
**P7. Let the dense rhythm also follow the backend's own flag** `notificationsEnabled` per ext system (`BE/Model/Decorator/ExtSystemAdmGetDecorator.php:41-45`), which no frontend reads today. It covers a mute socket.

## Claims checked and found correct

- Batch read: 50 ids (`BE/Controller/Api/Adm/V1/AssetController.php:55,139-163`), UGC twin with the same decorator (`APP/src/Controller/Api/Ugc/V1/AssetController.php:47,75-86`); only `mainFile` is serialized (`BE/Model/Dto/Asset/AssetAdmDetailDto.php:147-151`), so rule 8 is right; ids that do not exist or sit in another licence are left out without error (`BE/Repository/AssetRepository.php:82-92`); 51 ids throw (`APP/vendor/anzusystems/common-bundle/src/Request/ValueResolver/ArrayStringValueResolver.php:33-35`). A duplicate comes back as its own asset with `status: duplicate` and the origin file id only.
- Helpers chunk by 25 at the cited lines. Store sizes 632 and 863, 22 DAM importers, `fileApi.ts:114-191`, `AssetQueueEditable.vue:29-53`, DAM store `:649-656`, LIB PATCH lines `215-216` and `267-268`, the test and e2e line references.
- Rule 9 core fact: `MetadataProcessor::process` has two callers, neither in the copy path.
- Lock name, ack deadlines 60/120/300/500 s, backoff 2-600 s, no dead-letter or retry strategy in `APP/config`.
- Step 4 order (c) before (d): `notify()` has no try/catch (`BE/Notification/AbstractNotificationDispatcher.php:55-83`), runs inside the `storeAndProcess` try, the Google client maps 404 to an exception (`APP/vendor/google/cloud-core/src/RequestWrapper.php:419-420`); only core-dam publishes to that topic (grep over `petit/*`).
- R11 is safe on the backend for `/adm` and `/ugc`: each flag is guarded by `isXUndefined()` (`BE/Domain/Asset/AssetMetadataBulkManager.php:77-111`; the UGC facade uses the same manager).
- Both stores can be alive in DAM (`LIB/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue:33`). Only CMS, UGC and DAM configure `coreDam`. UGC never opens the socket.
- One batch per queue is enough in DAM: a licence switch reloads the page (`DAM/asset/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue:141`).
- Step 1 LIB 6 changes nothing visible today: no ext system configures 0 (`APP/config/packages/anzu_systems_core_dam_ext_systems.php`). Step 1 LIB 7: the default 30 is at `LIB/uploadQueue/composables/damUploadChunkSize.ts:7`.

## Could not verify

- Real processing times; whether the worker extends ack deadlines (a `keepalive` exists at `…/gps-messenger-bundle/src/Transport/GpsReceiver.php:122-130`, the consume flags live in the base image).
- The HTTP status for more than 50 ids; production values of `NOTIFICATION_ENABLED`; whether a DAM build with step 2 would be deployed before steps 3 and 4.
- Step 3 (distribution polling, YouTube re-check): only skimmed; the manage dialog and blocked-by flows were not traced.
- Step 5 component claims (four slots, 4 400 lines, 45 files) and reports 5-7 line by line.
- Step 1 LIB 4 and 8, DAM 3: spot-checked only.
- Whether the browser test runner and happy-dom report the tab as visible for rule 4.
