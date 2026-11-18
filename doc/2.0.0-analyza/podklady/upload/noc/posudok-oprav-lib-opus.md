# Review of the LIB fixes (Opus, read-only), 2026-10-08

BUG 2, MISMATCH 0, TEST 1, PROPOSAL 4. Read-only; nothing was run, every claim is from reading the cited lines.
Paths are under `src/domains/dam/uploadQueue/` unless they start with `src/` or `doc/`.

## BUG

**B1. Change A removes the only way back for a row left failed because a duplicate's original could not be read.**
- Where: `settlement/uploadSettle.ts:465-479`. The failure branch of `becomeOriginals` untracks every untouched row
  (`:469`) and fails only a `Processing` one (`:471-477`).
- Chain: `untrack` calls `hooks.onUntracked` (`uploadSettle.ts:246`), the store drops its mark
  (`store/uploadQueuesStore.ts:127-129`), `serverMayFinish` is false (`:372-374`), and the row shows no Refresh
  (`components/UploadQueueItemEditable.vue:160-163`).
- Scenario (a), client-given-up row:
  1. The finish request times out, but the server has the file. The row is Failed, tracked and marked.
  2. The tick at 5 s reads the asset; its main file is `duplicate`.
  3. `GET asset/asset-file/{origin}` fails once.
  4. The row is untracked and the mark dropped. It stays "unknown error" with the trash only, and nothing asks
     again, although the server holds a plain duplicate.
- Scenario (b), a copy the licence already has (`src/domains/dam/imageWidget/components/ImageWidgetInner.vue:335-336`,
  `ImageMediaWidgetInner.vue:343-344`, `ImageWidgetMultipleInner.vue:226-227`):
  1. `queueItemDuplicate` reads the origin, and the read fails once.
  2. The row is Failed (O3), untracked, trash only, although its asset is processed.
- Before A, both rows had Refresh (step 1 at once, `doc/2.0.0-analyza/podklady/upload/noc/lib-krok1.md:45`; HEAD
  after at most 20 s). Refresh recovers them: `refreshAsset` -> `applyAssetRead` -> `becomeOriginals` again for (a),
  `settleProcessed` for (b).
- This is not Codex 4 again; the untrack stands. But its rejection rests on "ručné „Obnoviť" ostáva"
  (`doc/2.0.0-analyza/upload-postup.md:200-202`), which A made untrue.
- The notes of A list three classes without refresh (`lib-krok2b.md:371-375`); this is a fourth nobody listed. In
  (a) the finish request did fail, which is the owner's own condition for Refresh.
- The current behaviour is pinned by `settlement/__tests__/uploadSettlement.test.ts:743-773` and
  `__tests__/uploadStatusFallback.test.ts:860-870`. There is no store-level case for (a).
- Fix: let the settlement say why tracking ended (for example a third argument of `onUntracked`), and have the
  store keep or set the refresh mark for "original unreadable". Otherwise confirm with the owner that these rows
  are trash-only and correct the logged reason.

**B2 (low). "First of a streak" counts what was let report, not what the logger wrote down.**
- Where: `settlement/uploadSettlement.ts:342-348`, `:362-363`, `:470`. `failing` and `state.reported` are set
  whenever a request with `report: true` rejects.
- `report()` never writes down a timeout, a 401/403 or an expired session (`src/domains/api/utils/apiErrors.ts:95`,
  `:132-136`, `:188`; `AnzuApiTimeoutError` extends `AnzuError` only).
- Scenario:
  1. The backend stalls. The first failed read is a timeout: let report, not logged, and the streak begins.
  2. The next reads get 502 with `report: false`.
  3. Nothing of the outage reaches the logger. Before B every 502 did, and decision 2 wanted exactly one.
- The same holds through the list reader (`store/uploadQueuesStore.ts:81-92`). The row's `reported` then keeps it
  quiet even after other rows end the streak.
- Fix: begin the streak and set `reported` only when the reader confirms it handed the failure over, for example an
  optional callback in `UploadReadOptions` that the store calls where `report()` logged.

## TEST

**T1. `src/domains/dam/__tests__/consumerProfileNotifications.test.ts:243-271` ("%s for an asset of no row: changes
nothing and asks for nothing", wiring fix 4).**
- The new request-count assertion looks 150 ms after the frame (`:265`).
- A read asked for by `processed` or `copied` is due after 250 ms, and by `metadata` after 2 s
  (`settlement/uploadPollSchedule.ts:47-49`).
- That is real time here: `holdLongWaits` holds only waits of 2.5 s and more
  (`src/domains/dam/__tests__/support/longWaits.ts:11`).
- So for three of the five names the assertion passes whatever the settlement would ask. `duplicate` asks nothing
  either way (no candidate rows), so only `failed` could ever trip it.
- Fix: run the case on `manualScheduler()` and advance past 2 s, as N-Z12 does
  (`settlement/__tests__/uploadSettlement.test.ts:469-491`).
- The same 150 ms window is in `:219-229` and `__tests__/uploadNotificationEvents.test.ts:245-260` (older cases).

## PROPOSAL

1. `settlement/uploadSettlement.ts:96`: clear `failing` when the last poller goes (`dropQueue`, `:712`); a streak
   now outlives the rows it was about, so the first failure of the next upload session is silent.
2. `settlement/uploadSettlement.ts:484`: skip `retryNamed` when no concerned row is left; after `stopUpload`, a
   notification read on the wire that fails leaves a 15 s timer and may set `failing`.
3. `store/uploadQueuesStore.ts:331`: a finish request the server answered with a refusal (4xx; `finishUpload`
   validates) is as final as a failed chunk, yet the row is polled without end and its Refresh can only say "still
   uploading".
4. `store/uploadQueuesStore.ts:82-86`: the list report's `url` lacks the client's base URL, unlike
   `useApiRequest`'s `requestedUrl`; render it from `failure.config` when there is one.

## Checked and found sound

- **1a**: `uploadSettle.ts:114-122`; the LIB store hands `fileId: null` and ticks hand the main file. Tests
  `uploadSettle.test.ts:779-846` go red without it.
- **1b, 1j (poller)**: `uploadPoller.ts:51-57`, `:124-133`, `:143-169`. All four writers of `nextAt` traced; an idle
  queue keeps no plan or ladder. Tests `uploadPoller.test.ts:433-523` each fail on the reverted line.
- **1c**: `uploadSettle.ts:453-459`, `:467`, `:482`; marks are taken synchronously (`Promise.all`, `:526-529`). Two
  concurrent original reads for the same row end right in every order.
- **1d**: `uploadSettlement.ts:92`, `:327-336`, `:359`, `:645-646`, `:709`.
- **1e**: every await in the tick, the named read, the immediate read and both duplicate paths is followed by a
  dispose check.
- **1f**: `uploadSettlement.ts:473-485`, consistent with the tick's rule (`:374-375`).
- **1g**: `uploadSettlement.ts:683-698`, `:713`; the store calls `untrack` only from `stopRemoved`
  (`store/uploadQueuesStore.ts:385`), before the splice.
- **1h, 1i**: `uploadSettle.ts:183-186`, `:222`, `:324-326`; equal to HEAD's `settleWithMetadata` /
  `queueItemProcessed`. The switch is inside the disabled form, so the user cannot set it before the metadata.
- **1k**: `uploadSettle.ts:261-302`, `:474`. No failed row left with the settlement's text is reachable in LIB.
- **1l**: `uploadSettle.ts:580-607`; LIB rows are bumped only by `failed` (refused at `:551`) and by becoming the
  original (no longer matched).
- **1m**: types are additive (`settlement/uploadSettlementTypes.ts:38-48`, `:64-68`, `:100-104`). `onUntracked`
  fires on every `tracked.delete` except dispose. The 11 report cases each pin `failing` or `reported` separately.
- **2a**: dispose in the store's scope; empty-queue `dropQueue`; `failedByServer` (only the settlement can have
  failed the row before the catch); the reactive `WeakSet` mark works in the installed Vue 3.5.43; readers: a 404
  maps to `null` after the one report.
- **2b**: `UploadQueueItemEditable.vue:155-167`, `:193-221`; all status transitions traced.
  `UploadQueueEditable.vue:138` is the only parent.
- **2c**: `execute({ report })` defaults to true and changes nothing else
  (`src/domains/api/composables/useApiRequest.ts:104`, `:164-166`). `fetchAsset`'s fourth parameter is optional; its
  one consumer in the fleet passes three (`petit/admin-cms/src/domains/dam/api/assetApi.ts:8`). The
  `AssetMetadataBulkItem` diff adds only the private body type. `src/lib.ts` has additions only.
- **Tests**: apart from T1, each fails for the reason it names.

## Could not verify

- Anything that needs a run: the green counts, tsc, lint, and "goes red without" (all inferred from reading).
- A real backend or browser: how often the origin read fails alone (B1), and the timeout-then-5xx sequence (B2).
- admin-dam beyond its reader signatures (already adapted to `UploadReadOptions`); the other applications.
