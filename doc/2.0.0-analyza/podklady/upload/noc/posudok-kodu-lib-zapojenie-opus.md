# Review of the LIB store wiring (Opus, read-only), 2026-10-08

BUG 0, MISMATCH 0, TEST 1, PROPOSAL 4. Read-only, nothing run. Tree as of 10:51.
Root R = `src/domains/dam`.

## TEST

**T1 — the lower bound of D5 ("a row whose chunk failed is not polled") is pinned by nothing, and the case that
claims it cannot fail for it.**
`R/uploadQueue/__tests__/uploadStatusFallback.test.ts:367-381` ("a row that failed before its finish request went
out is not asked about", comment "A chunk the server never took") refuses the START request. That row has no
assetId, and `track()` drops such a row by itself (`R/uploadQueue/settlement/uploadSettlement.ts:618`), so the case
stays green with `finishAttempted() &&` deleted from `R/uploadQueue/store/uploadQueuesStore.ts:288`. The row the
plan means has its asset and fails on a chunk; the only case that builds it
(`R/uploadQueue/__tests__/uploadQueueClientFailure.test.ts:79-91`) asserts nothing about reads, and under its
`holdLongWaits(10_000, { passFrom: 1_000 })` (:39) a tracked row would make every wait of the poll pass at once and
the case would still pass. Mutation "track every Failed row in the catch": a chunk-refused row is polled at 5, 10,
16 s ... for as long as it stays; no test red (inferred from reading every real-store test, not run).
Fix: in the "finish request" group of `uploadStatusFallback.test.ts` refuse the chunk as invalid (422 with
`fields` is not retried, so no 13 s of real pauses), assert the row has its assetId, `clock.waiting() === 0` and no
read in a minute; correct the comment of the start-refused case.

## PROPOSAL

1. `uploadQueuesStore.ts:408` — call `settlement.dropQueue(queueKey)` before the empty-queue return: a queue
   emptied row by row and then closed keeps its idle poller, so `uploadSettlement.ts:659` never runs and the
   tab/connection subscriptions stay for the life of the store (no timer, no request; only untidy).
2. Ask for a single waiting asset through the list endpoint too: a gateway 404 on `GET {asset}/{id}` during a
   deploy is three D7 misses in 16 s and a row failed for good; a 404 of the list request is only a failed read.
3. `R/__tests__/consumerProfileNotifications.test.ts:243-269` ("%s for an asset of no row") — also assert no
   request went out: the listed change "an event for an asset no queue has asks for nothing" is pinned only inside
   `settlement/__tests__`, not through the store.
4. `lib-krok2b.md` deviation 8 says the store hands on `event.data.id ?? null`; the code hands `fileId: null` for
   all five events (`uploadQueuesStore.ts:99-119`, pinned by `uploadNotificationEvents.test.ts:170-185`). Correct
   it before the DAM wiring reads it; it is also an unrecorded departure from design 5.3 (behaviour equals HEAD:
   rows matched by asset).

## Checked and found sound (read at the cited lines)

- Tracking: copy when added, in its queue with its asset (store :183-184); upload only when Processing after
  `await upload()` (:274); catch only `finishAttempted() && Failed` (:288-289); a stopped/removed row is out of
  its queue before any catch runs (`stopUpload`/`stopItemUpload`/`removeByIndex` are synchronous) and track drops
  it (`uploadSettlement.ts:616`).
- `untrack` only from `stopRemoved` <- `removeByIndex`, row spliced right after (:333, :347-348). `dropQueue`
  before the queue is replaced (:441-442); rows are Stop by then, so no waiting notification read survives.
- Listener not awaited (:133) and added in the store's scope (:122, :137). Verified in node_modules: pinia 4.0.3
  runs setup inside the store's own effectScope (`pinia/dist/pinia.js:1177`); VueUse 15.0.0 `useEventBus.on()`
  calls `tryOnScopeDispose` at the call (`@vueuse/core/dist/index.js:3412-3418`). So deviation 1 of lib-krok2b is
  right and needed.
- Connection: on only for true/"true" with a trimmed non-empty address
  (`R/composables/commonAdminCoreDamOptions.ts:87-94`); alive only on OPEN, false on dispose
  (`R/composables/damNotifications.ts:54-57`, :79); `onChange` in a detached scope
  (`R/composables/damNotificationsConnection.ts:19-20`).
- Upload slots: every way out of Uploading reaches `processUpload` (:275, :292, `onRowFinal` :91, :362);
  `uploadInit` still leaves Waiting before its first await (`R/uploadQueue/composables/uploadService.ts:242`) —
  no double start beyond the old empty-file case.
- No unhandled rejection: `notify` / `refreshAsset` / `settleKnown*` never reject (`uploadSettlement.ts:468-472`,
  :497-499, :563-566; `uploadSettle.ts:514-518`).
- Refresh: 'pending' only when the main file is not final (same warning as HEAD), 'error' silent as HEAD's empty
  catch.
- 404: `fetchAsset` -> `AnzuApiAxiosError` / `AnzuApiResponseCodeError` -> `apiErrorStatus` 404 -> null (store
  :55-62; `src/domains/api/utils/apiErrors.ts:102-107`, :190). A 403 stays a failed read.
- Backend, read not run (core-dam-bundle 1.52.0): the bulk read is `findBy(['licence','id'])` with NO status
  filter (`Repository/AssetRepository.php:82-92`), so a draft asset still being processed IS in the answer — this
  settles "Not verified 1" of lib-krok2b: a multi-file upload will not fail by D7 for that reason. Answer is
  `{data,totalCount}`; 50 ids allowed, >50 refused (`Controller/Api/Adm/V1/AssetController.php:55`, :139-150;
  common-bundle `ArrayStringValueResolver.php:33`); the same route with the same voter subject exists under
  `/api/ugc/v1` (`core-dam/src/Controller/Api/Ugc/V1/AssetController.php:75-86`). `row.licenceId` is the licence
  of the start URL (`R/api/damImageApi.ts:32`) and of the copy target in all three widgets and in both admin-ugc
  wrappers.
- Round-1 fixes 1, 3, 4, 6, 7, 8, 9 traced through the LIB profile: consistent, nothing half-done found.
- Public API: only additions in `src/lib.ts`; the option type only widened. `useUploadQueuesStore`,
  `useCommonAdminCoreDamOptionsGlobal`, `damUploadFinish`, `fetchAssetListByIds` are not exported, so their
  changed shapes reach no application. admin-dam never calls `addByFiles`/`addByCopyToLicence` of the LIB store
  (its two `AAssetSelect` uses do not mount `AAssetListInner`); neither admin-cms nor admin-dam calls `dispose()`
  on a notifications handle.

## Could not verify

- Nothing was run: no test, no tsc, no lint. "No test goes red" in T1 is from reading.
- Whether asset reads can hit a lagging replica (D7), and the backend version actually deployed (limit 50).
- The value of `NOTIFICATION_ENABLED` in admin-dam's variable group: the template quotes it
  (`petit/admin-dam/public/config.json.cf.dist:20`); "True" with a capital would be off after this step (by the
  logged decision, so not raised as a finding).
- A widget unmounted with its queue dialog open leaves the queue in the store as before; a row that never settles
  is now polled without end (HEAD stopped at 550 s). By plan rule 1; not traced whether any route in admin-cms
  does this.
