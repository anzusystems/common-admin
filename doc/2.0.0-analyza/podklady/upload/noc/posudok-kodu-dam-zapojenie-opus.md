# Review of the admin-dam store wiring (Opus, read-only), 2026-10-08

BUG 1 · MISMATCH 1 · TEST 2 · PROPOSAL 5. Nothing was run; all of it is read from the code.
Sources read: the admin-dam working tree against HEAD, the library source and its build in `node_modules`,
core-dam-bundle 1.52.0. Paths are relative to `admin-dam/` unless they start with `common-admin/` or name a PHP
file.

## MISMATCH

**M1 — service on: an upload ends `uploaded` without its form when the processed notification arrives while the
read of its metadata notification is on the wire** (inferred from code, not run)
- Where: policy `settleOn: 'event'` at `src/domains/coreDam/asset/store/uploadQueuesStore.ts:104`, wrappers
  `:652-662`. Library, `common-admin/src/domains/dam/uploadQueue/settlement/`: `uploadSettle.ts:570` skips a stale
  row whole, so `tryLoadMetadata` at `:596` never runs; `:318` loads metadata only with
  `intent.metadata || wasFailed`; `uploadSettlement.ts:396` takes a fired read out of `pending`, so nothing merges
  into it; `:533-538` gives the processed read `metadata: false`.
- Sequence:
  1. Upload row R, no form yet. At t0 `asset_metadata_processed` arrives; its read is planned for t0+2 s.
  2. t0+2.00 s: the read goes out with mark m.
  3. t0+2.05 s: `asset_file_processed` arrives. R is `uploaded` at once, its revision rises above m, and a new read
     is planned for +250 ms with `metadata: false`.
  4. The first answer arrives: R is stale for it and is skipped, metadata included.
  5. The second read runs `settleProcessed` without metadata.
- Result: R is `uploaded`, `canEditMetadata: false`, no error, untracked, and nothing asks again. The bulk save
  skips it without a word (`src/domains/coreDam/asset/api/assetApi.ts:169-170`); the only way out is the refresh
  button, offered after 20 s.
- At HEAD the two handlers were independent (`HEAD:…/uploadQueuesStore.ts:510-565` and `:587-662`) and the
  metadata was read at once, so both notifications always gave the form.
- Window: the duration of one `GET asset/{id}`, opening exactly 2 s after the metadata notification. The two
  notifications come from separate workers (first chunk: `core-dam-bundle/src/Domain/Chunk/ChunkFacade.php:58`;
  processing: `AbstractAssetFileStatusFacade::process`), so for a one-chunk file their distance is roughly the time
  the server needs to store and process it.
- Same root cause: a refresh or a sparse tick that is on the wire when the processed notification arrives loses the
  metadata it would have loaded.
- Not in design 10/11, the notes or the log. Library N-Z8 pins only a processed notification that comes before the
  read is sent; N-Z3 compares orders under the LIB profile only.
- Fix (library): in `applyAssetRead`, keep the stale check for the state and decorate block and let
  `tryLoadMetadata` run. It changes no state, loads once, and already refuses a failed row and a marked duplicate.
  Pin it with the DAM profile: metadata read held open, processed notification, then the answer.

## BUG

**B1 — a slot upload whose asset is gone is never given up on: the 404 of the slot list counts as a failed read,
not as "missing"** (read in code; the 404 itself is inferred from the controller signature)
- Where: `src/domains/coreDam/asset/api/assetSlotApi.ts:32-38` (axios rejects), profile `uploadQueuesStore.ts:164`;
  library `uploadSettlement.ts:319-322` (a rejected unit raises `readFailures`, never `misses`).
- Scenario: a file is sent into a slot of asset X (row S `processing`, tracked). X is then deleted, by the delete
  button of its upload row, from the detail, or by someone else. Every tick `GET asset-slot/asset/X` answers 404
  (`AssetSlotController::list(Asset $asset)`).
- Result: S stays `processing` for good and is asked on the error ladder, at most every 300 s. Its role has
  `metadata: 'none'`, so R7 says nothing either; only the "takes too long" text comes at 20 minutes. The slots
  overlay counts it as unfinished until the queue is stopped. An upload row in the same position fails at the third
  read (`readAsset`, `:109-116`).
- HEAD hung here too, so this is not a regression, but D7 is not met for slots. No case covers it: the fake answers
  404 here (`src/test/support/fakeDam.ts:159`), and "cannot be read" at
  `src/test/queue/slotUploadWithoutSocket.test.ts:386` throws a plain `Error`.
- Fix: in the profile, answer a 404 of the slot list with `[]`, as `readAsset` answers `null`. The file is then
  missing from a list that was read, and D7 fails the row at the third read. The log's open worry about a 404
  during a deployment applies here as it does to the asset read.

## TEST

**T1 — five cases still fail the read once and then assert "no warning"; since R7 that is true of every row**
(traced by hand; `vi.clearAllMocks()` semantics checked in `node_modules/@vitest/spy/dist/index.js:163-172`)
- `src/test/queue/slotNotifications.test.ts:349` "says nothing to a row that already has its metadata": one failed
  read warns nobody, so it stays green with the `!row.canEditMetadata` condition gone.
- `:364` "takes the warning back once the metadata does arrive": no warning is ever on the row; `hasError` is
  `false` before and after.
- `:582-586` (a duplicate "misses nothing") and `:622-626` (a failed row's "fail reason is not replaced"): the same.
- `src/test/queue/notificationSettlesQueue.test.ts:270` "is what is wrong with the row from then on, not the
  metadata that could not be read before it": one failed read at 2 s, the retry 15 s away, so there is no metadata
  text for the failure to replace.
- All five behaviours still hold in the code; the cases just no longer show them. Design 9.3 listed only
  `:314-329`. Fix: fail the read three times as `:322-337` does, and assert the text before the step under test.

**T2 — `src/test/queue/notificationSettlesQueue.test.ts:190` "ends the asking about a row that waited for it" is
settled before its processed notification is sent** (traced, not run)
- `await metadata()` advances 5 s while the fake already shows the file processed. The metadata read at 2 s settles
  and untracks the row, which is the listed change of design 11. `await processed()` then changes nothing, and the
  case is green without that line.
- Fix: keep the file `stored` on the fake until `processed()`.

## PROPOSAL

1. `stopUpload` returns at `uploadQueuesStore.ts:537` for a queue emptied row by row and never drops it, and the
   store never calls `settlement.dispose()`: the idle poller and the `visibilitychange` and connection listeners
   stay. The library store does both (`common-admin/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:99`,
   `:412-415`).
2. `slotNotifications.test.ts`: `mockRejectedValue`/`mockResolvedValue` at `:275`, `:288`, `:372` survive
   `vi.clearAllMocks()`. From `:288` on every case reads an asset with no main file, and `:303` is green only
   because of that (with a main file `onRowFinal` runs twice and the mocked `uploadInit` leaves the row waiting, so
   it starts twice).
3. `uploadQueuesStore.ts:608-610`: a row failed by D7 carries the unknown-error text and raised no alert, so the
   next ordinary upload failure with that text counts as already reported and shows none.
4. `reset()` (`:775-778`) leaves `metadataFailures`; mass-edit keys are `asset_<id>` (`:357`), so a re-picked asset
   would start with the gate open. No production caller today.
5. A slot file the list shows failed or duplicate triggers no asset read, so `onAssetRead` does not run for it
   without the service (design 4.4 reads only after `processed`).

## Checked and found sound

- **Tracking.** Upload: after `await upload()` and only while `Processing` (`uploadQueuesStore.ts:595`). Import:
  after `importInit()` (`:576`). Client failure: only when the finish request went out (`:622`,
  `src/domains/coreDam/shared/services/upload/uploadService.ts:278`); a failed chunk is not tracked. Both ids are
  written before the row turns `Processing` (`uploadService.ts:241-242`,
  `externalProviderImportService.ts:12-17`), and the row comes from its queue (`:533`).
- **Leaving.** `untrack` only in `removeByIndex` (`:485`) and `stopItemUpload` (`:558`), both for rows that go.
  `dropQueue` comes before the replacement in `clearQueue` (`:699-700`) and `reset` (`:776-777`). The order is
  right but no case can pin it: called after, it would still stop the poller and cancel the reads.
- **Notifications.** The listener awaits nothing (`src/domains/system/composables/appNotificationListeners.ts:27-46`);
  the wrappers cannot reject; `queueItemFailed` stays synchronous.
- **Mass edit.** Its rows are never `Waiting`, so never reach `queueItemUploadStart`; policy `reader: 'none'`,
  `settleOn: 'never'` (`:102`). Their state changes only by `failed` or `duplicate` naming the file they hold, as
  HEAD's fallback and handlers did; `Loading` rows are passed by. `metadataFailures` is added to only in
  `failStillLoading` and removed on every path a row leaves or recovers by.
- **Slots.** List shape checked (`assetSlotApi.ts:35`). The backend answers every slot at once with the file in its
  detail view (`AssetSlotFacade.php:33-43`), and the slot exists from the start request
  (`AbstractAssetFileFacade.php:264-271`). A slot row answers only to its own file, also in the asset read that
  follows.
- **Queue places.** Every path out of `Uploading` reaches `processUpload`; the status is set synchronously at the
  start, so `onRowFinal` cannot start a row twice.
- **Refresh.** The clicked row and its `fileId`
  (`src/domains/coreDam/asset/components/queue/AssetQueueEditable.vue:30-35`, store `:675-679`); a warning only for
  `'pending'`; a 404 of the asset is `null`.
- **Detail.** `onAssetRead` (`:194-199`) runs for every asset read, including one a row was stale for.
- **Config.** `src/shared/EnvConfigService.ts:44-45` tolerates a missing block or field, `src/main.ts:47-50` hands
  the value on as it is, and the build's `normalizeDamNotificationOptions` accepts exactly `true` or `"true"` with a
  non-empty trimmed address. Nothing in `src`, `public/config.json.dist`, `e2e`, `docker` or `bin` still reads
  `uploadStatusFallback`.
- **Reads.** Bulk by 50 equals the backend `IDS_LIMIT` (`AssetController.php:55`) and is a DB query with the detail
  DTO; `fetchAssetListByIds` refuses an answer without a list.
- **Build.** `dist/domains/dam/uploadQueue/settlement/uploadSettlement.js` and `uploadSettle.js` in `node_modules`
  match the source; both were read whole.
- **HEAD comparison**, service on and off, per trigger (processed, failed, duplicate, metadata, tick against
  fallback, refresh): apart from M1, only the differences the plan, design 11 and `dam-krok2.md` list.

## Could not verify

- Nothing was run: no test, build, lint, browser or backend. M1, T1, T2 and proposal 2 are traced by hand.
- How often M1 happens in production; it depends on where the processing time falls against the 2 s mark.
- That `GET asset-slot/asset/{id}` answers 404 for a deleted asset: taken from the controller signature, not from a
  request.
- The e2e spec without its `test.fail()`, the bulk read and the slot list against a real server, and the hidden
  tab.
