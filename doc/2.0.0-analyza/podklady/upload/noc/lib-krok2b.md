# LIB, step 2b: the upload store on the settlement (L1, L5 to L8 of `navrh-krok2.md`)

Written 2026-10-08 on `next`, in the uncommitted working tree, while `lib-c1a` was repairing review findings in
`uploadQueue/settlement/**` and `lib-b` was finishing `api/damAssetApi.ts` and `uploadQueueDialogDrop.test.ts`.
Nothing under `settlement/` was edited here, `uploadQueueDialogDrop.test.ts` was not touched, nothing was committed.

## Result

```
npx vitest run src/domains/dam src/test --retry=0
 Test Files  81 passed (81)
      Tests  1050 passed (1050)
```

Two consecutive runs after the review round of the wiring (about 80 s each). Before it: three runs with 1045 of
1045 on the reviewed `settlement/**`, and three with 1044 of 1044 before those fixes had landed. Before the first edit the same command gave 80 files, 938 of
939 (the one red case was `src/test/i18nLiteralKeys.test.ts` on `settlement/uploadSettle.ts`, repaired by
`lib-c1a` meanwhile).

`yarn lint:tsc` exits 0. `oxfmt --check`, `oxlint` and `eslint` are clean on the 29 source and test files touched
and on the three locale files.

The upload queue settles its rows through `createUploadSettlement(profile)` only. `api/uploadApi.ts` holds no
timer and imports neither the store nor the asset API; `src/test/importCycles.test.ts` finds no cycle.

## What was built

### L1 — configuration and the state of the connection

| File | Change |
|---|---|
| `src/AnzuSystemsCommonAdmin.ts` | `uploadStatusFallback?` optional and `@deprecated`; `notification?: { enabled?: boolean \| string; webSocketUrl?: string }` |
| `composables/commonAdminCoreDamOptions.ts` | `DamNotificationOptions`, `normalizeDamNotificationOptions()`; `useCommonAdminCoreDamOptionsGlobal()` returns `{ apiTimeout, notification, adminDomain }` with `notification` normalised, and no `uploadStatusFallback` |
| `composables/damNotificationsConnection.ts` (new) | `setDamNotificationsPushAlive()`, `useDamNotificationsConnection()`: `isPushAlive()`, `onChange(callback)` |
| `composables/damNotifications.ts` | reads the normalised options; a `watch` of the socket status (sync, immediate, in the scope of the singleton) writes the connection state, `dispose` writes `false` |
| `__tests__/damNotificationsConnection.test.ts` (new, 28 cases) | N-K1 to N-K4 |

On only with `enabled` exactly `true` or `"true"` and a non-empty address (trimmed). Alive only while the status
is `OPEN`.

### L5 — the store

`uploadQueue/store/uploadQueuesStore.ts`:

- the profile of design 5.1, with `readers.asset` returning `null` on 404 (`apiErrorStatus`);
- `queueItemProcessed`, `queueItemFullyProcessed`, `queueItemDuplicate`, `queueItemFailed` are wrappers
  (`notify` processed, `settleKnownProcessed` with metadata, `settleKnownDuplicate`, `settleKnownFailed`);
  `queueItemCopied`, `queueItemMetadataProcessed`, `settleWithMetadata`, `clearError` and the store's
  `metadataLoaded` are gone;
- tracking: a copy when it is added; an upload after `await upload()` when it is `Processing`; in the `catch`,
  a `Failed` row whose finish request went out (`{ clientFailed: true }`);
- `stopRemoved` (so `removeByIndex` and `stopItemUpload`) calls `untrack`, `clearQueue` (so `stopUpload`) calls
  `dropQueue` before it replaces the queue;
- the notification listener is added with the first `addByFiles` / `addByCopyToLicence`, once, never removed; it
  hands `toSettlementEvent(event)` to `settlement.notify()` without awaiting it. Every event and every target the
  store builds carries `fileId: null`;
- new store function `refreshAsset(assetId): Promise<UploadRefreshOutcome>`.

`uploadQueue/composables/uploadService.ts`: `finishUpload` reads no flag; `useUpload()` also returns
`finishAttempted()`, set right before the finish request.
`api/uploadApi.ts`: `damUploadFinish(client, _endPointAsset, endPointImage, item, sha)`: five parameters, the
second kept in its place and unread; after the answer only `Uploading -> Processing`.
`types/UploadQueue.ts`: `notificationFallbackTimer` and `notificationFallbackTry` are `@deprecated`.

### L6 — Refresh

`uploadQueue/composables/uploadQueueItemRefresh.ts`: `refreshItem` awaits `store.refreshAsset()` and warns on
`'pending'`. The parameter (`_configName`) stays for the callers and is not read.

### L7 — the fallback out

- `api/uploadApi.ts`: `armNotificationFallback`, `calculateFallbackTime`, `notificationFallbackCallback`, both
  constants and the imports of `fetchAsset`, the store and `commonT` are gone.
- `api/damAssetApi.ts`: `FETCH_BY_IDS_MAX_LIMIT` 25 -> 50; `fetchAssetListByIds` rejects when `data.data` of an
  answer is no array (two targeted edits, lines 29 and 169-172; the rest of the diff of that file is `lib-b`'s).
- `src/test/importCycles.test.ts`: expects no cycle.
- `uploadQueue/__tests__/uploadStatusFallback.test.ts`: rewritten whole, no `vi.mock`: the real store, the
  recording client through the real options, the socket stub, `manualScheduler()`. 47 cases at first, 52 after
  the review round of the wiring.

### L8 — text and exports

- `uploadErrors.readFailed` in `src/locales/{en,sk,cs}/common/damImage.json` (the three files that hold
  `uploadErrors.*`). SK as design O4, EN as given, CS: "Údaje se nepodařilo načíst. Použijte tlačítko obnovení
  položky nebo položku odstraňte a zkuste to znovu."
- `src/lib.ts`: values `createUploadSettlement`, `uploadSettlementRuntime`, `UPLOAD_POLL_SCHEDULE`,
  `UploadRowRole`, `useDamNotificationsConnection`; types `UploadSettlement`, `UploadSettlementProfile`,
  `UploadSettlementEvent`, `UploadSettlementTarget`, `UploadSettlePolicy`, `UploadRefreshOutcome`,
  `UploadRowRoleType`, `UploadSettlementScheduler`, `UploadSettlementVisibility`.
  `src/test/publicExportsAdded.test.ts` has a case for them.

### Test support

`__tests__/support/longWaits.ts`: `LONG_WAIT_FROM_MS` 10 000 -> 2 500 (see deviation 5).

## The six checks after L5 (design 8.1)

| Check | Outcome |
|---|---|
| the 9.2 adaptations are made | yes, see "Existing tests changed"; three items of 9.2 needed nothing, see deviation 6 |
| `importCycles.test.ts` still shows exactly the one old cycle | not observed on its own: L5 and L7 were made in one pass. After both: no cycle |
| a row whose `processed` beat the finish answer is not tracked | pinned: `uploadStatusFallback.test.ts` › "a row its processed notification has settled by then is not asked about" (no timer left, no read in the next minute), both profiles; the same for a `failed` notification and for a stop |
| after a copy the licence has already, no tracked row and no later request | pinned: "that the licence has already: the row becomes that asset at once, and nothing is asked about it later" |
| after `stopUpload` and `removeByIndex` no timer and no read | pinned: "removed / stopped with the whole queue while it waits: no timer is left, and nothing is asked", and "removed while its read is on the way" |
| with two tracked rows the bulk address carries the licence of the row under `/adm/v1` and `/ugc/v1` | pinned: "asks about every row that waits in one request, by the licence of the rows", both profiles |

"Upload works with the notification service not configured at all": pinned by "an application that configures no
notification service at all" (options without `notification` and without `uploadStatusFallback`: no socket is
constructed, `openConnection()` does not throw, the poll settles the file at 5 s).

## Deviations from the design

1. **The notification listener is added inside the scope of the store** (`getCurrentScope()` taken at store
   setup, `storeScope.run(...)` at the first row). Design 5.3 only says "call `subscribe()` from `addByFiles` and
   `addByCopyToLicence`". VueUse's event bus ties a listener to the effect scope that is active when `on()` is
   called (`tryOnScopeDispose`), and a store action runs in the scope of its caller: a listener added with the
   first row from a component (its setup, a lifecycle hook) was removed when that component unmounted, and the
   store never subscribed again. Reproduced by a test written for it, red before the repair
   (`uploadNotificationEvents.test.ts` › "still reaches the queue once the component that added its first row is
   gone"). The lifetime is now what it was when the store subscribed at its creation. Whether a widget of today
   adds its first row from such a place was not traced: a plain event handler has no active scope and was safe
   either way.
2. **`useDamNotificationsConnection().onChange` runs its watcher in a detached scope** (`effectScope(true)`), as
   decided. Checked by reverting it: two tests go red (`damNotificationsConnection.test.ts` › "still reaches a
   listener that subscribed inside a scope which has ended since", `uploadStatusFallback.test.ts` › "a socket
   that closes once the component that added the row is gone").
3. **`damUploadFinish`: the second parameter is named `_endPointAsset`.** Its place is kept (decision O15); the
   underscore is the repository's mark of a parameter that is not read.
4. **The locale key is in `cs` as well** (the design names `sk` and `en`); `src/test/i18nLiteralKeys.test.ts`
   requires every literal key in all three.
5. **`LONG_WAIT_FROM_MS` is 2 500, not 5 000** (`lib-krok0.md` expected 5 000). The poller plans a wait as
   "next mark minus the age of the row", and the age is real time in these tests: the first wait is 5 000 or
   4 999 ms, and the one after the first read about 4 800. At 2 500 every wait of the poll is held while a case
   needs less than 2.5 s of real time between a row starting to wait and its read; the two seconds of a metadata
   notification and of the gap between reads stay real. Also held now, as `lib-krok0.md` foresaw: the 5 s
   `maxWait` of the author and keyword caches.
6. **Three items of 9.2 needed no change**, because the design was written against `HEAD` and the tree had moved:
   - `uploadQueueRowRefresh.test.ts:39`: the shim there holds the row's own twenty-second wait before it offers
     refresh; the row is not in a store and the settlement is not involved. Left as it is.
   - `uploadQueueDialogSingle.test.ts:102`: the same shim, for the dialog's wait. Kept; the file got the
     immediate scheduler beside it.
   - `src/plugins/__tests__/pluginOptions.test.ts`: it casts its options and reads only `apiTimeout` and
     `adminDomain`; passes unchanged.
7. **`uploadStatusFallback.test.ts` keeps its name** although nothing in it is a fallback any more: the plan and
   the design refer to it by that name. A rename (`uploadQueuePoll.test.ts`) is a one-line follow-up.
8. **`toSettlementEvent` hands on no file id: `fileId: null` for all five events** (`processed`, `failed`,
   `duplicate`, `metadata`, `copied`), as in every target the wrappers and `refreshAsset` build. A recorded
   departure from design 5.3, which says "`fileId` from `event.data.id`". Since review round 1 of the settlement a read asked for about a file that is not the main
   file of its asset takes the state from the event unchecked; the LIB rows are matched by their asset alone, so
   the id could only do harm (a `copied` notification naming another file would settle a copy whose main file
   failed as uploaded). Pinned: `uploadNotificationEvents.test.ts` › "asset_file_copied that names another file
   than the main one: the row is settled by what its asset says", red when the id is handed on.
9. **L5 and L7 were made together**, so the intermediate state (store on the settlement, fallback still in
   `uploadApi.ts`) never ran.

## Existing tests changed, and why

Tests of step 0 (untracked, written the night before):

| File | Case | Change | Why |
|---|---|---|---|
| `__tests__/consumerProfileOptions.test.ts` | the two `useCommonAdminCoreDamOptionsGlobal()` cases | `uploadStatusFallback: true` out of the expected object; titles "have the notification socket on, at its address" / "have no notification socket" | design 7: the value is no longer returned. Announced in `lib-krok0.md` |
| `__tests__/consumerProfileUpload.test.ts` | "whose finish request fails › is not asked about again" (both profiles) | turned around: "is asked about all the same, and is uploaded with its form once the server has finished the file" | D5. Announced |
| `__tests__/consumerProfileNotifications.test.ts` | "gets its form with the metadata notification and is settled by the file notification" | fixture: the file is `stored` when the metadata notification comes, `processed` before the file notification | allowed change (end of design 11): a read after a metadata notification that already shows `processed` settles the row |
| `__tests__/damImageApiUploadRequests.test.ts:170` | "is not started, sent nor finished" | sixth argument of `damUploadFinish` dropped | signature |
| `uploadQueue/__tests__/uploadNotificationEvents.test.ts` | "a notification whose asset cannot be read › asset_file_failed: the row is as it was" | replaced by "asset_file_failed: the row fails with the reason all the same, and nothing is asked for" | design 3.8 / 3.10: `failed` is written from the event, without a read. Announced (pinned drift bug) |
| same | "the failed notification › leaves a message the row already had, and adds its reason beside it" | turned around: "takes away a message the row already had: its reason is what the row says" | O2. Announced |
| `uploadQueue/__tests__/uploadSettlementApply.test.ts` | "the metadata notification alone: the metadata and the form, nothing about the file" | fixture: the file is `stored`, not `processed` | the same allowed change as above |
| `__tests__/support/longWaits.ts` | — | `LONG_WAIT_FROM_MS` | first read at 5 s |

Older tests (tracked):

| File | Change | Why |
|---|---|---|
| `uploadQueue/__tests__/uploadQueuesStore.test.ts` | `immediateScheduler()` in `beforeEach`; queues stopped and the scheduler put back in `afterEach` | 9.2: a metadata event is read 2 s later on real timers |
| same, "an asset copied to the licence whose detail fails to load" | rewritten on `manualScheduler()`: "waits on rather than fail, and is settled by the next read of its queue" | decision: a failed read after `copied` does not fail the row |
| same, "stops being editable when the lookup that should settle it fails" | the duplicate half stays; the copy half now says the copy waits on with its form as it was | the same decision |
| same | `armNotificationFallback` out of the `uploadApi` mock; `useCommonAdminCoreDamOptionsGlobal: () => ({})` | the function and the flag are gone |
| `uploadQueue/__tests__/uploadQueueDialogSingle.test.ts` | `immediateScheduler()` in `beforeEach`, put back in `afterEach` after the queue is stopped; options mock `({})` | 9.2 |
| `uploadQueue/__tests__/uploadQueueSettledItemFailure.test.ts` | both cases on `manualScheduler()`; the shim that shortened waits of 10 s and more is gone; the first case turned around ("a copy whose read after its notification failed waits on, and the poll settles it") | 9.2 and the same decision |
| `uploadQueue/__tests__/uploadStatusFallback.test.ts` | rewritten whole | 9.2 |
| `uploadQueue/__tests__/uploadQueueStartsEachFileOnce.test.ts` | `armNotificationFallback` out of the mock; options mock `({})` | 9.2 |
| `uploadStopBetweenChunks.test.ts`, `uploadStopWhileHashLoads.test.ts`, `uploadQueueItemRefresh.test.ts` | options mock `({})` | the flag is not read (design 9.2, "cleaned in L7") |
| `src/test/importCycles.test.ts` | "finds none" | L7 |

Added to existing files: `uploadNotificationEvents.test.ts` › "still reaches the queue once the component that
added its first row is gone" and › "asset_file_copied that names another file than the main one: the row is
settled by what its asset says"; `uploadSettlementApply.test.ts` › "the metadata notification for a file processed
by then: the row is uploaded too"; `uploadQueuesStore.test.ts` › "the notifications › are listened to from the
first row of the store on, and not before" (also: once); `src/test/publicExportsAdded.test.ts` › "include the
settlement of the upload queue".

No existing case was changed to pass for a reason outside the 9.2 list, the announced list of `lib-krok0.md`, or
the list at the end of design 11.

## What the rewritten `uploadStatusFallback.test.ts` pins

Under both profiles (CMS, UGC): first read at 5 s and not at 4 999 ms, by `GET {asset}/{id}`; two waiting rows in
one `GET {asset}/licence/{licence}/ids/…`; eight reads in the first minute and two in the second; a failed read
leaves the row and is tried again 15 s later; `uploadErrors.readFailed` after three failed reads and gone after
one that answers; `uploadErrors.processingTooLong` at 20 min, reads go on, the row settles later;
`uploadErrors.unknownError` and `Failed` after three reads without the asset; a row removed or stopped leaves no
timer and no read; the five cases around the finish request (settled by `processed`, failed by `failed`,
stopped, given up by the client and polled without the "too long" text, failed before the finish request and not
polled).
CMS: an open socket moves the first read to 10 s; a connecting one does not; a socket that closes brings the
dense rhythm back, also after the component that added the row is gone; a notification settles the row and the
poll has nothing left.
A copy: polled from the moment it is added; one the licence has already; still polled after its metadata
notification and after a save in the asset detail; no error left once settled. A duplicate with an unreadable
original fails the row with no unhandled rejection. `damUploadFinish` itself: `Uploading -> Processing`, and a
row that is `Stop`, `Uploaded` or `Failed` by the time of the answer stays so.

## Looked wrong, left alone

1. **Every failed read of the poll is reported through the API error logger** (`fetchAsset` goes through
   `useApiRequest`, which reports before it throws): `console.error` by default, Sentry in an application that
   set `setApiErrorLogger`. The old fallback reported as well, but stopped after four tries; the poll tries again
   after 15, 30, 60, 120 and then every 300 s for as long as the row stays in the queue. A 404 is reported three
   times before D7 fails the row. The bulk read (`fetchAssetListByIds`) uses the client directly and reports
   nothing.
2. **`doc/changelog/2.0.0.md` describes the fallback** ("licence copies get a fallback timer", "fallback polling
   survives a network error", …) and says nothing of step 2. Not edited: not in the brief.
3. **`updateFromDetail` still reads the asset by itself**, outside the settlement's one-read-at-a-time order, and
   writes into rows that still wait without marking their metadata as loaded (finding 5 of `lib-krok0.md`).
   With D6 the first load after it keeps what the detail save wrote where it is not empty; before, the first load
   replaced it.
4. **A row a `failed` notification failed, whose finish request then fails too, is tracked as "given up by the
   client"** and read once more; the read finds the file failed and the row is settled and left. Repaired later:
   see "After the review of the admin-dam wiring" at the end.
5. **A read a notification asked for that failed is tried again 15 s later even when the poll has settled the
   row meanwhile**: one request for nothing. Seen before review round 1 of the settlement, not looked at again
   after it. In `settlement/`, not touched.
6. **`uploadQueuesStore.test.ts` never clears the call history of its `fetchAsset` mock**, so its
   `vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())` waits pass at once from the second case on. Only the
   rewritten case clears it for itself.
7. `__tests__/support/consumerProfiles.ts` and `src/playground/playground.ts` still pass
   `uploadStatusFallback: true`: the first mirrors what the applications pass today, and the option still
   type-checks.

## After review round 1 of the settlement

The four points of the round (`lib-krok2a.md`, "What the wiring agent must know") against the store:

| Point | In the store |
|---|---|
| `untrack(row)` means "the row is leaving its queue" | called in one place, `stopRemoved`, which only `removeByIndex` calls, right before the splice (`stopItemUpload` goes through it). Never for a row that stays |
| `dropQueue(queueKey)` before the queue object is replaced | in `clearQueue`, before `queues.value.set(...)`; `stopUpload` goes through it |
| no `fileId` in what the LIB store hands over | deviation 8 |
| a row handed over with its form on gets nothing; after `dispose()` every call is a no-op | nothing to do for the first: the store seeds no such row. `dispose()` is called when the store is disposed of (review round 1 of the wiring, below) |

The step-1 patches in the two files that were rewired are in place: `updateFromDetail` copies
`mainFileSingleUse`, the unique row key, `stopItemUpload` by identity (`uploadQueuesStore.ts`); `apiTimeout` for
the chunk size, the speed measured anew after a retry (`uploadService.ts`).

## To delete

Nothing in the repository. Left on disk on purpose (rule: no deleting): `node_modules/.cache/vitest-tmp-lib-c1b/`.

## Not verified here

1. **The bulk read against a real backend.** With one waiting row the poll asks `GET {asset}/{id}`, as the
   fallback did. With two or more it asks `GET {asset}/licence/{licence}/ids/{ids}`, which the upload queue never
   used for this. If that endpoint leaves out an asset whose file is still being processed (a draft), or under
   `/ugc/v1` anything the detail endpoint would return, every row of a multi-file upload fails with the unknown
   error text at the third read, 16 s after the last file was sent (D7). The plan (3.2) says a missing asset is
   only one that does not exist or is in another licence; the fake DAM of the tests answers so. Worth one manual
   upload of two files in admin-cms and in admin-ugc before anything is released.
2. Nothing ran in an application: no browser, no deployed backend, no `yarn build`, no whole suite (`src/domains/dam`
   and `src/test` only, as told).
3. The hidden tab: the poll does not read while the tab is hidden and reads at once on the return (plan 3.2,
   rule 5). The tests run in a visible page; `uploadSettlementRuntime.visibility` is exercised only by the tests
   of `settlement/`.

## What admin-dam must know for its own wiring

1. **Imports**: `createUploadSettlement`, `useDamNotificationsConnection`, `uploadSettlementRuntime`,
   `UPLOAD_POLL_SCHEDULE`, `UploadRowRole` and the nine types are exported from the public entry.
2. **`connection: useDamNotificationsConnection()`** needs no plugin options and no socket; a store that is
   loaded without the plugin configured reads nothing. Its `onChange` is safe to call from any scope.
3. **A listener on the notification bus must be added in a scope that lives as long as the store** (deviation 1).
   admin-dam subscribes in `appNotificationListeners.ts` at start-up, so it is not affected as long as that stays;
   a store that subscribes lazily must do what the LIB store does.
4. **`useCommonAdminCoreDamOptionsGlobal()`**: `notification` is always `{ enabled: boolean, webSocketUrl: string }`
   (normalised), `uploadStatusFallback` is not there. `CommonAdminCoreDamOptions.notification` is optional and
   `enabled` may be a text; only `true` and `"true"` switch the service on. An environment whose config says
   `"false"` in quotes had the service on until now and has it off after this step (plan: admin-dam must not be
   deployed with step 2 without step 3).
5. **`readers.asset` must answer `null` for a 404** (`apiErrorStatus(error) === 404` on what `useApiRequest`
   throws); **`readers.assets` must reject when the answer carries no list**. The LIB `fetchAssetListByIds` does
   that now and batches by 50; admin-dam's own `asset/api/assetApi.ts` needs both.
6. **The LIB store never listens and never polls inside admin-dam**: it gets no row there. Pinned by
   `uploadQueuesStore.test.ts` › "the notifications".
7. **Tests**: set `uploadSettlementRuntime.scheduler` before the store tracks or is notified, stop the queues
   before the original scheduler is put back. A shim over `window.setTimeout` that lets "long" waits pass at once
   turns the poll into a loop (every wait of the poll is 2 s or more): give such a test `immediateScheduler()`
   instead. Under `immediateScheduler()` a notification is written in the next microtask and no tick ever comes.
   A fixture the poll is to settle a row from needs `mainFile.fileAttributes.status` and `metadata`; a fixture
   without them works only through the events and the old wrapper names, which carry the state themselves.
8. **`hooks.onRowFinal` is called more than once per row**, and `caches.fetchAuthors` / `fetchKeywords` after
   every read (`lib-krok2a.md`, points 4 and 6): confirmed harmless for the LIB store's `recalculateQueueCounts` +
   `processUpload`.
9. **`damUploadFinish` of the library has five parameters.** admin-dam has its own `fileApi.uploadFinish`; nothing
   of the library's `api/uploadApi.ts` is exported.

## Review round 1 of the wiring (2026-10-08)

Codex and Opus over the wiring: no bug and no mismatch confirmed, four small fixes. Files touched:
`uploadQueue/store/uploadQueuesStore.ts`, `uploadQueue/__tests__/uploadStatusFallback.test.ts`,
`__tests__/consumerProfileNotifications.test.ts`. Nothing under `settlement/**`.

```
npx vitest run src/domains/dam src/test --retry=0      (two runs)
 Test Files  81 passed (81)
      Tests  1050 passed (1050)
```

`yarn lint:tsc` exits 0; `oxfmt --check`, `oxlint`, `eslint` clean on the touched files. Each of the three changes
of the store was taken back alone with the tests run against it; the table names the case that goes red.

| # | Item | The change | The case that goes red without it |
|---|---|---|---|
| 1 | Codex: the store never calls `settlement.dispose()` | `onScopeDispose(() => settlement.dispose())` at store setup, in the scope of the store (the one the notification listener is added in). A store disposed of through pinia (`$dispose()`) leaves no poller timer, no listener for the tab, no connection watcher | "an upload queue store that is disposed of › leaves nothing behind: no timer, no listener for the tab, and nothing is asked any more" (one timer and one tab listener before; none after; a socket that closes and a notification wake nothing; no read in the next minute) |
| 2 | Opus T1: the lower bound of D5 was pinned by nothing | no production change. New case: a chunk refused as invalid (422 with `fields`, not retried) leaves a `Failed` row **with its asset**, no finish request, no timer and no read within a minute. The old case (start request refused) is kept under a true name, "a row whose start request was refused has no asset, and is not asked about", and asserts `assetId` is `null`: `track()` drops such a row by itself, whatever the store does | "a row that failed on a chunk, before its finish request went out, is not asked about" (both profiles), with `finishAttempted() &&` deleted from the `catch`. The start-refused case stays green then, as the review said |
| 3 | Opus proposal 1 | `stopUpload` calls `settlement.dropQueue(queueKey)` before it returns for a queue with no row left. Nothing else of that branch changed: no `clearQueue`, no new file-input key | "a queue emptied row by row and then closed gives up its listener for the tab" (both profiles) |
| 4 | Opus proposal 3 | `consumerProfileNotifications.test.ts` › "%s for an asset of no row" also asserts that no request went out (the count of requests before and after the frame); title "…changes nothing and asks for nothing" | test only |

Test support added in `uploadStatusFallback.test.ts`: `watchedTab()` replaces `uploadSettlementRuntime.visibility`
by one that is visible and counts its listeners; `afterEach` puts the real one back.

Not done, as told: "Refresh ignores `configName`" (Codex) and "a single asset through the list endpoint" (Opus
proposal 2).

What this changes in the notes above: "nothing calls `dispose()`" no longer holds (item 1); the rewritten poll
test has 52 cases; deviation 8 now says in so many words that all five events carry `fileId: null`.

For admin-dam: a store that owns a settlement should hand `dispose()` to its own scope the same way; a pinia
store disposed of otherwise keeps its pollers, which keep its rows.

## After the review of the admin-dam wiring (2026-10-08)

One fix for both stores (Codex): the `catch` of `queueItemUploadStart` remembers at its top whether the row was
`Failed` already (`failedByServer`; only the settlement sets that before the request fails) and does not track
such a row. The server takes a failed file nowhere, so there was nothing to learn: one read for nothing while
reads worked, and the terminal row polled on the error ladder for as long as it stayed while they failed. The
rest of the `catch` is as it was. Pinned in `uploadStatusFallback.test.ts` › "a row its failed notification has
failed, whose finish request then fails too, is not asked about" (finish request held, `failed` notification, the
request answered 502: the row keeps the server's reason, no timer, no read within a minute; both profiles), red
without the condition. The D5 case ("a row the client gave up on when it failed is asked about…") stays green.

`npx vitest run src/domains/dam src/test --retry=0`: 81 files, 1061 of 1061 (the poll test has 54 cases; the rest
of the growth is `settlement/`'s own). `yarn lint:tsc` exits 0; `oxfmt --check`, `oxlint`, `eslint` clean on the
touched files.

## Two owner-approved changes (2026-10-08)

```
npx vitest run src/domains/dam src/test --retry=0      (two runs)
 Test Files  81 passed (81)
      Tests  1100 passed (1100)
npx vitest run src/domains/api --retry=0
 Test Files  12 passed (12)
      Tests  190 passed (190)
```

`yarn lint:tsc` exits 0; `oxfmt --check`, `oxlint`, `eslint` clean on the 40 touched files, `stylelint` on the two
components. Every change of production code below was taken back alone with the tests run against it.

### A. Refresh on a failed row (changes R8)

As it stands after the review round over the fixes (below); the first version had a hook `onUntracked` and the
names `serverMayFinish`, both gone.

**Rule.** A failed row offers refresh exactly while a refresh may still change it:

| The failed row | Trash | Refresh |
|---|---|---|
| given up by the client after its finish request went out and got no answer (network error, timeout) or a 5xx one; the server has said nothing final | at once | at once |
| failed because the original of its duplicate could not be read (an upload that waited, an upload the client gave up on, a copy the licence has already) | at once | at once |
| a chunk or the start request failed | at once | no |
| its finish request was answered by the server with a refusal (4xx) | at once | no |
| failed by the server (its notification, a read of the poll, a refresh) | at once | no |
| its asset missing from three reads | at once | no |

The refresh goes when a row of the first two kinds is settled for good or its asset is gone (three reads in a
row without it, counted also for a row that is no longer tracked); it stays when a refresh still cannot read the
original. A row the server had failed before a late duplicate with an unreadable original gets none. Rows that
have not failed are as they were.

**How the row learns it.** Three pieces:

1. The settlement owns the rule and tells the store whenever it changes for a row: a new optional hook of the
   profile, `hooks.onRefreshMayHelp?(queueKey, row, mayHelp: boolean)`. `true` at
   `track(…, { clientFailed: true })` and when a row is left failed without the original of its duplicate;
   `false` when the server's word is written (processed, failed, a settled duplicate), when the asset is gone
   from three reads, and when the store takes the row out (`untrack`, `dropQueue`). A row never told `true` is
   never told `false`. Not called by `dispose()`.
2. The store mirrors it in a reactive `WeakSet` and has a new function,
   `refreshMayHelp(item: UploadQueueItem): boolean` = the row is `Failed` and in that set.
3. `UploadQueueItemEditable` has a new optional prop `refreshMayHelp` (default `false`), which
   `UploadQueueEditable` fills with `uploadQueuesStore.refreshMayHelp(item)`. In the row, `showRefresh` is a
   computed: for a failed row `refreshMayHelp && it has an asset`, otherwise the timed offer as before (the old
   `showRefresh` ref is `refreshDue`).

A row shown outside a queue gets no prop and offers no refresh when failed.

Why the settlement tells it, and not the end of the tracking: a row left without its original is no longer
tracked, yet a refresh of it can still bring the server's final word (the file failed after all), and that must
take the button away; and a client-failed row whose asset is missing three times is only left alone, with no
state written and no `onRowFinal`.

**Tests.** `uploadQueueRowRefresh.test.ts`, "the buttons of a failed row" rewritten (12 cases).
`uploadStatusFallback.test.ts`: `refreshMayHelp` asserted on the finish-failed row (true until it is uploaded),
the chunk-failed, the start-failed and the notification-failed row (false); no longer once a read finds the
file failed, once its failed notification comes, once its asset is gone from three reads; and, in "a duplicate
whose origin asset cannot be loaded": a copy the licence has already keeps its refresh, which settles it from
its asset; an upload the client gave up on keeps it through a refresh that still cannot read the original and
becomes the original once it can; an upload that waited keeps it until a refresh finds the file failed.
`consumerProfileUploadDialog.test.ts` (real dialog, rows and store, both profiles): finish-failed shows both
buttons at once; the refresh goes when the poll finds the file failed; a chunk refused with 422 shows the trash
alone; a server-failed row shows the trash alone. `settlement/__tests__/uploadSettlement.test.ts`: "whether a
refresh may still change a failed row" (7 cases).

**Changelog.** The sentence of the "as admin-dam already had it" bullet is rewritten.

**Not done.** The single-file dialog offers no refresh on a failed item, as before.

### B. Failed reads of the poll are reported once per streak

**The interface addition, exactly as built** (`settlement/uploadSettlementTypes.ts`, additive):

```ts
export interface UploadReadOptions {
  report: boolean
}
readers: {
  asset(assetId: DocId, options?: UploadReadOptions): Promise<AssetDetailItemDto | null>
  assets(licenceId: IntegerId, assetIds: DocId[], options?: UploadReadOptions): Promise<AssetDetailItemDto[]>
  slotFiles?(assetId: DocId, options?: UploadReadOptions): Promise<AssetFileNullable[]>
  // duplicateOriginAsset, duplicateOriginFile: unchanged, no options
}
hooks: {
  onRefreshMayHelp?(queueKey: UploadQueueKey, row: UploadQueueItem, mayHelp: boolean): void // change A
}
```

`UploadReadOptions` is exported from the public entry. A reader that takes no `options` behaves as before.
Internal to the folder: `UploadTrackState.reported: boolean`.

**What `report` is, request by request.**

- A request of a tick: `true` when no streak runs and none of the rows it asks about has `reported` set.
- A read a notification asked for: `true` on its first try, when no streak runs and none of its tracked rows has
  `reported` set. Never on a retry.
- `refreshAsset` and `settleKnownProcessed`: always `true`.
- The streak (`failing`, one per settlement) begins when a request that was let report fails (for a tick: when all
  its requests failed and one of them was let report) and ends when any read answers; a 404 is an answer.
- A row's `reported` is set when a request about it that was let report fails or finds no asset, and when a
  refresh finds its asset missing; it is cleared when a read brings its asset (or its file among the slots).
  So one asset whose reads keep failing is reported once also while the reads of other rows answer in between.

Consequences worth knowing:
- The requests of one tick go out together, so the tick that begins a streak lets every one of its requests
  report: one per licence of the queue's rows (one, in the library) and, in admin-dam, one per asset with a slot
  upload. From the next tick on: none.
- A 404 exists only for the read of one asset. The list read has none: an asset it leaves out is silent, and D7
  fails the row after three reads without a report, as before.
- The read of a duplicate's original is asked for once and reports as before.

**The readers of the library's store.**

- One asset: `fetchAsset(client, endPoint, id, options?: { report?: boolean })`, new optional fourth parameter,
  handed to `useApiRequest`. The store calls it with three arguments, as before, unless it is to be quiet.
- **`useApiRequest` / `useApiCommand`: `execute({ report: false })`**, new optional member of
  `ExecuteRequestParams` (a public type): the failure of that one call is thrown as ever and not handed to the api
  error logger. This is the one edit outside the DAM domain (`src/domains/api/composables/useApiRequest.ts`,
  three lines and a comment). The helpers had no way to skip the logger, by design ("one switch for the whole
  family rather than a flag on each instance"); the new member is per call, not per instance, and its comment says
  what it is for. The alternative was a second, hand-written request for the quiet reads, which would have had to
  repeat the helper's checks of the status and of the body.
- The list: `fetchAssetListByIds` is untouched (two other callers use it and get no logging, as before). The
  store's reader catches its failure and, when `report` is `true`, hands it to the logger itself:
  `report(mapApiError(failure, context), context)` with `system: 'coreDam'`, `entity: 'asset'` and the url of the
  request. So a failed list read is now reported (the first of a streak) where it was never reported at all.

**Tests.** `settlement/__tests__/uploadSettlement.test.ts`, "which failed reads a reader is let report" (11
cases): first of a streak and again after a read answered; one request for several rows, and a row that joins the
streak; every request of the tick that begins a streak; a row whose own reads keep failing while another's
answer; a notification read's first try only; the poll inside a streak a notification began, and the reverse;
the refresh always, and one that answers ends the streak; a missing asset once per row; one the refresh found
missing; the list of slots. The fixture server records what each read was told (`letReport()`), and can fail the
requests of one asset (`failAsset`).
`uploadStatusFallback.test.ts`, "what is reported of the reads that fail" (5 cases, both profiles, the real
logger hook `setApiErrorLogger`): one row, logged once across four failed ticks, nothing while reads answer,
once more after an answer; two rows, the list request logged once with its url and status; the refresh logs each
failure; a missing asset logged once across three reads; nothing logged of an upload whose reads all answer.
`src/domains/api/__tests__/useApiRequestContract.test.ts`, "a call that asks not to be reported" (3 cases).
Red when the store ignores the flag for the single read (6 cases) and for the list (2 cases).

**Changelog.** One sentence added to the step-2 bullet, with `execute({ report: false })`.

### For admin-dam

- Its readers may take the new last argument: hand `options?.report === false` on to whatever makes the request
  quiet (`execute({ report: false })` when it goes through `useApiRequest`), and report the list and the slot
  reads by hand when they go to the client directly. Until then they report as today.
- A store that wants refresh on a failed row only where it can help needs the same three pieces as change A;
  `onRefreshMayHelp` is the part the library provides for it.

## Review round over the fixes (2026-10-08)

```
npx vitest run src/domains/dam src/test src/domains/api --retry=0      (two runs)
 Test Files  93 passed (93)
      Tests  1302 passed (1302)
```

`yarn lint:tsc` exits 0; `oxfmt --check`, `oxlint`, `eslint` clean on the 40 touched files, `stylelint` on the two
components. The settlement folder has 172 cases (poller 27, settle 47, settlement 98), the poll test 75.

| # | Item | The change | The case that goes red without it |
|---|---|---|---|
| 1 | Opus B1: a row left failed only because the original of its duplicate could not be read had lost its refresh | **`hooks.onUntracked` is gone; in its place `hooks.onRefreshMayHelp?(queueKey, row, mayHelp: boolean)`**, told by the settlement whenever it changes (section A above has the contract). The failure branch of `becomeOriginals` tells `true` for every row it leaves failed. The store only mirrors it; it no longer marks the row itself in the upload `catch`. Renamed with it: store `serverMayFinish` -> `refreshMayHelp`, the prop of `UploadQueueItemEditable` likewise | store: the three cases named in section A; settlement: "it may for a row left without the original of its duplicate…", "the same for a duplicate the caller knows of…", "no longer for a row left without its original, when a refresh then finds its file failed" |
| 2 | Codex: `untrack()` and `dropQueue()` after `dispose()` | both return at once when the settlement was disposed of | "a settlement disposed of › does nothing when it is told to take a row out or to drop a queue…" |
| 3 | Opus T1: "asks for nothing" was looked at 150 ms after the frame, before any read a notification asks for is due (250 ms, 2 s) | the cases run with the queue's time on `manualScheduler()` and move it 3 s on. `consumerProfileNotifications.test.ts`: the three groups of "a frame the queue does not act on" (15 cases). `uploadNotificationEvents.test.ts`: the unhandled names, the failed notification with an unreadable asset, the duplicate that names no original or is no image (7 cases). The other 150 ms waits there follow a read that was waited for, and stay | checked by having a metadata frame for another asset taken for the row's: the case goes red now, 2 s after the frame |
| 4a | Opus proposal 1 | `dropQueue` of the last queue ends the streak (`failing = false`) | "the first failure again once the last queue was dropped, although no read has answered" |
| 4b | Opus proposal 2 | a notification read that fails, or finds no asset, after its rows left is not tried again, is not counted and begins no streak | "is not tried again when it fails after they left, and begins no streak of failures" |
| 4c | Opus proposal 4 | the url of the list report goes through `requestedUrl` (`src/domains/api/composables/request.ts`), from the config axios kept on the failure or on the answer | "two rows: the report names the request with the address of the client it went to" |

Why item 1 is a new hook and not a third argument of `onUntracked`: a row left without its original is not
tracked any more, so no "untracked" comes for it when a later refresh finds its file failed, and the mark could
not be taken back. Tied to what the store needs to know, the hook is told on that path too. admin-dam does not
use either hook.

Not done, as told: Opus B2 (a streak that begins with a failure the logger itself drops) and proposal 3 (a finish
request the server refused with 4xx is final, yet tracked).

## Check of the review fixes (2026-10-08)

Three small things about the `onRefreshMayHelp` mark. `npx vitest run src/domains/dam src/test src/domains/api
--retry=0`: 93 files, 1305 of 1305, two runs; `yarn lint:tsc` 0; `oxfmt --check`, `oxlint`, `eslint` clean on the
touched files. The settlement folder has 175 cases (27 / 47 / 101). Each fix was taken back alone and turns
exactly its case red.

1. **Codex.** The failure branch of `becomeOriginals` told `true` for every row it found failed, also one the
   server had failed before. It now tells it only for a row it fails itself and for one that was marked before the
   row was let go (noted before `untrack`). Case: "not for a row the server had failed before the original of its
   duplicate could not be read".
2. **Opus.** A row left failed without its original is not tracked, so nothing counted the reads that found its
   asset gone and its refresh stayed for good. `uploadSettlement.ts` counts them for a marked row without a track
   state (`missesOfLeft`, a count of its own that a read with the asset resets), in both miss branches (the
   immediate read and the read a notification asked for), and tells `false` at three. Cases: "no longer for a row
   left without its original once three reads in a row find no asset" (with a read that answers in between), "the
   same when it is a notification that asks about it, and its three tries find no asset".
3. **Opus, test.** `uploadQueueRowRefresh.test.ts` › "is remove alone, at once, when the row failed before it had
   an asset" now runs with the queue saying a refresh may help, so the row's own "it has an asset" is pinned.

## A finish request the server refused is final (2026-10-08, owner-approved)

The finish request is sent once, so a 4xx answer to it cannot follow an attempt that succeeded on the server: the
server will not finish that file. The upload `catch` of the store no longer tracks such a row
`{ clientFailed: true }`: `isRefusal(e)` (module level in `uploadQueuesStore.ts`) reads the status off the error
the upload rejects with, the error of axios as it is, and is true for 400 to 499. A failure that carries no such
answer is as before: a 5xx, a network error, a timeout, and the bare rejections of `damUploadFinish` /
`imageUploadFinish` (a non-image row, an answer that is 2xx but not 200) are tracked and offer refresh. Nothing
else in the `catch` changed.

Tests, both profiles (`uploadStatusFallback.test.ts`, "and the finish request of the upload"): refused with 400,
404, 422 -> failed, one finish request, counted as done, `refreshMayHelp` false, no timer, no read within a
minute; answered with 500, 503, 204, lost to a network error, timed out -> `refreshMayHelp` true, one timer, and
the poll settles the row once the file is processed. Rendered (`consumerProfileUploadDialog.test.ts`): a finish
request refused with 422 shows the trash alone. Red without the condition (8 cases).

`npx vitest run src/domains/dam src/test src/domains/api --retry=0`: 93 files, 1323 of 1323, two runs;
`yarn lint:tsc` 0; `oxfmt --check`, `oxlint`, `eslint` clean on the touched files. The poll test has 91 cases.
The changelog's step-2 bullet and its failed-item sentence say which finish failures are final.

## Five fixes of older findings (2026-10-08, owner-approved)

Findings of `lib-krok0.md` that were recorded as outside the plan. The step-0 tests pinned today's behaviour, so
each fix turns its pinning case around on purpose.

```
npx vitest run src/domains/dam src/test src/domains/api --retry=0
 Test Files  95 passed (95)
      Tests  1365 passed (1365)
```

Before the last part of item 4 it was 94 files and 1350 cases, in two consecutive runs. A run before those had
two red cases in `cropper/__tests__/DamAssetImageRoiSelect.test.ts` (a selection read as 0 before the image had
its size), with the machine at a load of 18 from other work; that folder passed three times alone right after,
and nothing under `cropper/` is changed. `yarn lint:tsc` exits 0; `oxfmt --check`, `oxlint`, `eslint` clean on
the touched files, `stylelint` on the nine components. The five fixes were taken back together and each test file
named below went red (21 cases); the last part of item 4 was taken back by itself (12 cases).

### 1. Notification `enabled`, letter case

`normalizeDamNotificationOptions`: on for the boolean `true` and for a text that is "true" in any letter case
with whitespace around it ignored (`"True"`, `" TRUE "`), still only with a non-empty address. Everything else is
off. The comment of the option and the changelog sentence say so. Tests (`damNotificationsConnection.test.ts`):
on for `true`, `"true"`, `"True"`, `"TRUE"`, `" true "`, a tab and a newline around it; off for `"1"`,
`"false"`, `"False"`, `"yes"`, `"on"`, `"truee"`, `"t rue"`, empty, a space, `1`, `0`, `false`, `null`, missing.
Turned around: `"TRUE"` and `" true "` were in the "off" list.

### 2. Author and keyword endpoints in the configuration

**New public options, exactly:** `CommonAdminCoreDamConfig.endPointAuthor?: string` and
`CommonAdminCoreDamConfig.endPointKeyword?: string` (`src/AnzuSystemsCommonAdmin.ts`), beside `endPointAsset`,
`endPointImage`, `endPointRoi`. `useCommonAdminCoreDamOptions(configName)` returns both, `/adm/v1/author` and
`/adm/v1/keyword` when the configuration names none. No new export.

The requests take the address as their second argument, as the asset and image requests do (none of these is
exported from the public entry):
`fetchAuthorListByIds(client, endPoint, extSystemId, ids)`, `useFetchAuthorList(client, endPoint, extSystemId)`,
`createAuthor(client, endPoint, data)`, and the same three for keywords. `mapUploadMetadataToImages` (the default
map of an upload to images, internal) got a sixth parameter, `endPointAuthor`; the public type
`UploadMetadataToImageMapFn` of an application's own map is unchanged.

Who reads which configuration:

| Reader | Configuration |
|---|---|
| `ImageWidgetInner`, `ImageMediaWidgetInner`, `ImageWidgetMultipleInner` (the author names of a picked asset, of the metadata dialog, of the gallery) | the one they are given (`configName`), whose client they use |
| `UploadQueueDialogSingle` (the default map) | `default`: it has a `configName` of its own, but the two widgets that open it pass none (corrected in review cycle 1; it said "the one it is given") |
| `UploadQueueDialog` (the default map) | `default`, as its client |
| the caches of names (`cachedAuthors.ts`, `cachedKeywords.ts`) | `default` |
| `useAuthorSelectActions`, `useKeywordSelectActions` (the inputs), `AuthorCreateButton`, `KeywordRemoteAutocompleteWithCached` (create), `useImageMassOperations` | `default` |

The caches are one per page and no component hands them a configuration; they read `default`, the configuration
whose client they already used. So **an application that overrides the two addresses names them in its `default`
configuration**; in another named configuration they reach only the image widgets given that name, for the
authors of a picked asset and of an image that is saved. An upload, in either dialog, asks under `default`.

Tests: new `__tests__/damAuthorKeywordEndpoints.test.ts` (12 cases): the six requests go to the address handed
in; the options resolve to the defaults and to an override, each address by itself; and, once with the default
configuration and once with one that names its own, the inputs, the mass operation, the map, and the two caches
ask at the address of the configuration. The default-configuration pins of step 0 stand unchanged
(`uploadSettlementApply.test.ts`: names asked under `/adm/v1/…` for both profiles). Changed existing tests:
`consumerProfileOptions.test.ts` (the two whole-object expectations have the two new keys),
`damAssetApiBulkMetadata.test.ts` (the sixth argument), `imageWidget/__tests__/ImageMassOperations.test.ts` (its
options mock has `endPointAuthor`, and the lookup is asserted with it). `src/playground/tableView/authorActions.ts`
passes the address.

Not part of this: whether authors and keywords are shown at all (the owner: not in admin-ugc) is the ext system's
configuration (`authors.enabled`, `keywords.enabled`), not an address.

### 3. A refresh that fails says so

`uploadQueueItemRefresh.ts`: on the outcome `'error'` (the read failed, or the asset is gone) a warning,
`common.damImage.queueItem.refreshFailed`, in en / sk / cs: "The item's state could not be loaded. Try again." /
"Stav položky sa nepodarilo načítať. Skúste to znova." / "Stav položky se nepodařilo načíst. Zkuste to znovu."
`'pending'` and `'settled'` as before. Both the rows of the queue and the single-file dialog go through this
composable. Tests: `uploadQueueItemRefresh.test.ts` (the read fails: one warning, none after the refresh that
settles; the asset is gone: the same warning), `uploadQueueDialogSingle.test.ts` (the refresh button of the
dialog; the file got a spy on `showWarningT`).

### 4. Copy to licence, a success other than 200

`copyToLicence` (`api/damImageApi.ts`): a request answered with a 2xx that is not 200 throws
`AnzuApiResponseCodeError(status)`, so the whole copy rejects as it does when a request fails, where the assets
of that request were left out of the result without a word. The widgets hand the rejection to
`showErrorsDefault`, which shows the unknown-error alert for this class; nothing is added to the queue. Turned
around: `damImageApiCopyToLicence.test.ts` › "leaves out the assets of a request answered with a success other
than 'ok'" is now "is refused as a whole when one of its requests is answered with %i" (201, 202, 204).

**The older silent path, closed too (found on the way; the owner: the same defect).** A copy request that
axios itself rejects (a 4xx, a 5xx, a network error) reached the widgets as the bare error of axios, which
`showErrorsDefault` does not recognise (`isAnzuApiAxiosError` is an `instanceof` of the library's own class): a
failed copy added nothing and said nothing. `copyToLicence` now rejects with what `mapApiError` makes of it, as
the requests on `useApiRequest` do, so the alert knows it:

| The request | Rejects with | The widgets show |
|---|---|---|
| answered with 500 or 404, or never reaching the server | `AnzuApiAxiosError` | the unknown-error alert |
| answered with 403 | `AnzuApiForbiddenError` | the forbidden alert |
| not answered in time | `AnzuApiTimeoutError` | the timed-out alert |
| stopped (`ERR_CANCELED`) | `AnzuApiCancelledError` | nothing, as before |
| a 2xx other than 200 | `AnzuApiResponseCodeError` | the unknown-error alert |

The rest is `mapApiError`'s (a 422 that names fields becomes `AnzuApiValidationError` and is shown by its
fields); that is read from it, not pinned here.

Three things stay as they were. More than fifty assets reject with the text `'Exceeded max limit'` before
anything is asked, which the alert does not know either: the picker of the widget of several images lets fifty be
picked at most and the other two copy one, so no widget gets there. The failure is not written to the logger of
the api errors (`report`), as no hand-written request of this file is. And `copyToLicence` is not exported from
the public entry, so the class it rejects with is no change for an application.

Tests: `damImageApiCopyToLicence.test.ts`, on the second of the three requests of a copy of 45 assets, each
through the real `showErrorsDefault` into the real queue of alerts: the five failures of the table (one error
alert each), a stopped request (no alert), the three "not ok" successes (one alert). New
`imageWidget/__tests__/ImageWidgetsCopyToLicenceFailure.test.ts` (9 cases): each of the three widgets that copy
(`ImageWidgetInner`, `ImageMediaWidgetInner`, `ImageWidgetMultipleInner`), mounted with the real request against
the fake DAM and the real alert, a pick with a copy. Answered with 500, and never reaching the server: one copy
request, one error alert, `addByCopyToLicence` not called, no row, no dialog. Stopped: one copy request, no
alert, nothing added. Nothing pinned the silence, so no case was turned around: the one case there was ("is
refused as a whole when one of its requests fails") asserts the rejection only and stands. With the mapping
taken back 12 cases are red (6 and 6; the three "stopped" ones of the widgets pass either way, silence being what
was there).

### 5. A start answer without an identifier

`useUpload().uploadInit` rejects at once when the answer to the start request lacks the id of the file or the id
of the asset, and writes neither into the row: a failed row with no asset and no message, as when the start is
refused. Before, the upload went on through four tries of a chunk that sent nothing, with their pauses of 1, 3
and 9 s. Both identifiers are required, not only the file's: without the asset the row could never be asked
about. Turned around: `uploadServiceRetry.test.ts` › "a start request that answers without the id of the file"
is now "a start request that answers without an identifier" (three cases: no file id, no asset id, neither; no
pause asked for, no chunk, no finish). New: `uploadQueueClientFailure.test.ts` › "whose start request answers
without the id of the file" (both profiles: the row as a refused start leaves it, the next file is sent, no
pause of a retry).

### Asked: does the library's `clearQueue` leave a running upload going?

No. `clearQueue` is private to the store and reached only through `stopUpload`, which first sets every row to
`Stop` and aborts the chunk request of each row that is being sent; a row between two requests stops at its next
check of the status. The four callers (`UploadQueueDialog`, `UploadQueueDialogSingle`, `AAssetListInner`,
`ImageWidgetMultipleInner`) all call `stopUpload`. Pinned by `uploadQueueOperations.test.ts` › "a queue stopped"
› "cancels what is being sent, starts nothing more and is left empty…" (three rows `Stop`, both chunk requests
aborted, no third start and no finish afterwards) and by the `uploadStop*.test.ts` files. Nothing changed.

## Review cycle 1 of the five fixes (2026-10-08)

Codex and Opus read the five fixes; six items came back for the library. All six are done.

```
npx vitest run src/domains/dam src/test src/domains/api --retry=0
 Test Files  95 passed (95)
      Tests  1393 passed (1393)
```

1365 before the cycle, 28 cases more: settlement 4, `uploadStatusFallback.test.ts` 5, `uploadQueueItemRefresh.test.ts`
1, `damAuthorKeywordEndpoints.test.ts` 16, `uploadQueueClientFailure.test.ts` 2. `yarn lint:tsc` exits 0; `oxfmt
--check`, `oxlint`, `eslint` clean on the touched files (no component was edited).

| # | Item | The change | Red without it |
|---|---|---|---|
| 1 | Opus B2: a refresh that fails on the original of a duplicate said nothing | `refreshAsset` answers `'error'` when the read left a row without its original, so the row's refresh shows `queueItem.refreshFailed`. The failed read is told upward: `becomeOriginals` -> `settleDuplicate` -> `applyAssetRead` answer whether such a row was left | 5 cases |
| 2 | Opus B3: "try again" on the click that fails the row for good | a refresh whose read is the miss too many answers `'settled'`: no warning. Only when no row of the asset is still tracked or still marked | 6 cases; 1 more for the row that still waits |
| 3 | Codex: the playground passed `/adm/v1/author` itself | `src/playground/tableView/authorActions.ts` passes `useCommonAdminCoreDamOptions().endPointAuthor` | not tested (playground) |
| 4 | Codex + Opus T1: the endpoint tests did not mount what hands the address on | 16 cases more, see below | 7 + 7 cases, each call site by itself |
| 5 | Opus T2: "nothing is tried" could not fail | the service case runs the upload as the queue does (`uploadInit().then(upload)`); the queue case runs for both shapes and reads the chunk requests | 7 cases |
| 6 | Opus proposals 1 and 2 | the wording on the single-file dialog (changelog, the table above in this file); the warnings of the refresh are asserted by their keys | 7 cases with the two keys swapped |

### 1 and 2: what the refresh answers

The public type `UploadRefreshOutcome` is as it was (`'settled' | 'pending' | 'error'`); its comment says what
each now stands for. `'error'` is what asking again may mend. The change is in the settlement, so **admin-dam's
refresh answers the same way**: `'settled'` on the miss that gives its row up; the first point only reaches a
role with `duplicate: 'becomeOriginal'`. `lib-krok2a.md` has the interface note.

- The row left failed without the original of its duplicate (status `Failed`, refresh on): press, the asset is
  read, the file is a duplicate, the original cannot be read -> `'error'`, the warning, the row as before with its
  refresh; press once the original can be read -> the row becomes the original, `'settled'`, no warning.
  I chose to tell the failed read upward rather than to look at the mark of the rows after the read: a mark
  would also be found on a row the read only decorates (`settleOn: 'never'`) or one an event wrote into while
  the read was on its way, and neither is this failure.
- The third read in a row that finds no asset, when it is the refresh: the row is given up exactly as by the poll
  (a row that waited fails with the text of the missing asset; a row the client gave up on, or one left without
  its original, only loses its refresh) and the answer is `'settled'`. With two rows of one asset in two queues,
  of which one still waits, the answer stays `'error'`.

Existing cases turned around (the old outcome was pinned):
`uploadSettlement.test.ts` › "no longer for a row left without its original, when a refresh then finds its file
failed" (the refresh while the original is unreadable: `'settled'` -> `'error'`), › "no longer for a row left
without its original once three reads in a row find no asset" (the read that answers without the original:
`'settled'` -> `'error'`; the third miss: `'error'` -> `'settled'`); `uploadStatusFallback.test.ts` › "leaves an
upload the client gave up on with its refresh…" (asked while the original cannot be read: `'settled'` ->
`'error'`).

New cases: `uploadSettlement.test.ts` › "it may for a row left without the original…" asks while the original
cannot be read (both rows `'error'`, rows and marks unchanged) before it asks with it readable; › "N-Z7 a refresh
that is the third read to miss the asset gives the row up, and answers that it is settled" (two ticks of the
poll, then the refresh), › "N-Z7 a refresh that misses the asset before that leaves the row waiting…", › "N-Z7 a
refresh that gives one row up while another of the asset still waits…", › "no longer once it is a refresh that
finds its asset gone for the third time…". `uploadStatusFallback.test.ts`, the real store, the real composable
`useUploadQueueItemRefresh` and the real alerts: › "fails the row the same when the third read to miss its asset
is its refresh, without a word to try again" and › "a refresh that misses the asset before that says its state
could not be loaded…" (both profiles), › "tells the one who pressed refresh that it could not while the original
cannot be read, and nothing once it can". `uploadQueueItemRefresh.test.ts` › "does not say to try again on the
press that finds the asset gone for the third time".

### 4: the endpoint tests

`damAuthorKeywordEndpoints.test.ts`, 28 cases (12 before):

- the options: an override of the authors' address alone, and of the keywords' alone;
- "who asks…" runs for four configurations (none, both, only authors, only keywords); "the inputs" now ask for
  the lists too (`fetchItems`, `fetchItemsMinimal`), not only by ids;
- mounted, nothing of the library replaced but the picker, the dialog of the image and the remote input:
  - the three image widgets under a **second, named configuration** that names the addresses while `default`
    names none: the authors of a picked asset (`ImageWidgetInner.vue:457`, `ImageMediaWidgetInner.vue:572`,
    `ImageWidgetMultipleInner.vue:275`) and those added before the image is saved (`:552`, `:681`, `:456`);
  - `AuthorCreateButton` (`:92`) and `KeywordRemoteAutocompleteWithCached` (`:130`) under `default`: the `POST`;
  - `UploadQueueDialog` (`:129`) and `UploadQueueDialogSingle` (`:290`) under `default`: a file is uploaded
    through the real store, a read finds it processed with an author, "save and apply": the image handed over
    has for its source the name only the own address answers, and nothing was asked at `/adm/v1/author`.

Checked by handing `'/adm/v1/author'` (or the keyword one) at each of the twelve call sites, in two rounds so
that the two sites of a widget are each taken back alone: 7 cases red in each round.

### 5: the start answer without an identifier

`uploadServiceRetry.test.ts`: the three cases run `uploadInit().then(() => upload())`, as the queue does, so the
chunk and finish counts and the pauses are read after an upload that would have gone on. `uploadQueueClientFailure
.test.ts`: the case is an `it.each` over the two shapes (no `id`; `id` without `asset`, which at HEAD sent every
chunk and the finish), under both profiles, and reads the chunk requests: those of the two files behind it, none
of the first, and no finish. With the check taken out all 7 are red.

### New, not fixed

Nothing here was changed; these are for the owner.

- **20 (the lead's number): the copy asks `PATCH <endPointAsset>/copy-to-licence`**, and the backend serves it
  under the image controller. Left as it is, with the tests that pin the address.
- **The refresh answers of items 1 and 2 are the settlement's, so admin-dam has them too.** A test of admin-dam
  that pins `'error'` on the third missing refresh turns around; whether its refresh shows a text on `'error'`
  is its own.
- **An upload in a widget with a named configuration runs under `default`**: the widgets open both upload
  dialogs without `:config-name`, the store and the refresh ask with the default client. Known (the refresh
  part was logged before); the endpoints of authors and keywords follow the same rule now, and the wording says
  so.
- **`'error'` of a refresh is one text for three causes** (the read failed, no such asset, the original
  unreadable): "The item's state could not be loaded. Try again." fits all three, but does not tell them apart.
- **The playground still configures `uploadStatusFallback: true`**, the deprecated option that does nothing.

## Review cycle 2 of the five fixes (2026-10-08)

No blocker; three low findings that are one thing (the "could not be loaded, try again" warning after a press
that itself ended the row), and two gaps in the tests. All done.

### One rule for the warning, in the composable

`useUploadQueueItemRefresh().refreshItem(assetId, item?)`: the second argument is the item whose refresh was
pressed, where the caller has it. On the outcome `'error'` the warning is shown **unless that item's status
changed during the refresh into `Failed`, `Uploaded` or `Stop`**: the item shows that itself, and "try again"
would be about a refresh it may no longer offer. A change from `Uploading` to `Processing` is no ending, and an
item that was failed before and is failed after (the row left without its original) has not ended by the press:
both are warned. Without an item the composable behaves as before. The outcomes of the settlement and the type
`UploadRefreshOutcome` are untouched.

Who passes the item: `UploadQueueEditable.vue` (the row that emitted `refresh-item`) and
`UploadQueueDialogSingleSidebar.vue` (the item of its queue). `refreshItem` is not exported from the public
entry.

The three findings it answers:

| Finding | What happens now |
|---|---|
| Opus 1: the single-file dialog, an item processing, the refresh finds a duplicate whose original cannot be read | the item fails, no warning; the dialog offers no refresh on a failed item (item 25 for the owner, not changed) |
| Codex 2: two rows of one asset, the press is the third miss of the row pressed, the other still waits | the settlement answers `'error'` (for the other row), the row pressed fails, no warning |
| Opus 3: the press waits behind the tick that is the third miss | the tick gives the row up, the refresh's read finds nothing to give up and answers `'error'`, no warning |

Tests, each through the real store and the real composable, the alerts read from the real queue of alerts
(`uploadStatusFallback.test.ts`, the first three under both profiles):

- › "and a refresh that fails while the row pressed ends" › "says nothing when the tick it waited behind has
  given the row up" (the tick's read is held, the refresh pressed, both released: three ticks and the refresh,
  `'error'`, no warning);
- › "says nothing when the row pressed is given up by it while another row of the asset waits on" (two queues,
  one asset; `'error'`, the row pressed failed, the other processing, no warning);
- › "says the state could not be loaded when the row only went on from being sent to waiting" (pressed while
  being sent, the read held, the upload finished meanwhile, the read answered 502: the warning);
- › "a duplicate whose origin asset cannot be loaded" › "says nothing to the one whose press of refresh is what
  fails the row for want of the original" (`'error'`, row failed with its refresh, no warning), and › "says the
  state could not be loaded to a caller that names no row, also when the row failed by it";
- the cases of cycle 1 now pass the item: the miss before the third (processing before and after: warned), the
  row left without its original (failed before and after: warned).

Mounted: `uploadQueueDialogSingle.test.ts` › "says nothing when the refresh itself fails the item, and no longer
offers it" (the sidebar of the dialog: the button is pressed, the item fails, no warning, no button);
`uploadQueueItemRefresh.test.ts` › "hands the refresh the row that asked: one the refresh itself fails is not
told to try again" (`UploadQueueEditable`).

Red without it: the rule taken out, 7 cases (5 in the store file, the two mounted ones); any change of status
taken for an ending, the 2 "from being sent to waiting" cases; the item not handed over by the queue or by the
sidebar, the mounted case of each.

### The two gaps in the tests

- **Opus T1**: `uploadSettlement.test.ts` › "it may for a row its own refresh fails for want of the original,
  and that refresh answers that it failed": a processing row, no tick yet, the first read is `refreshAsset` ->
  `'error'`, the row failed and marked. With `leftWithout = mightHelp` in `becomeOriginals` it is red, and the
  two store cases of the first press with it.
- The comment in `uploadStatusFallback.test.ts` that said the single-file dialog presses refresh on a failed row
  is corrected: only a failed row of the queue offers it.

### Numbers

```
npx vitest run src/domains/dam src/test src/domains/api --retry=0
 Test Files  103 passed (103)
      Tests  1577 passed (1577)
```

Of these, 8 files are the new ones another agent (`lib-w4`) is adding in the same folders; mine went from 1393
to 1404 cases (settlement 1, `uploadStatusFallback.test.ts` 8, `uploadQueueDialogSingle.test.ts` 1,
`uploadQueueItemRefresh.test.ts` 1). `oxfmt --check`, `oxlint`, `eslint` clean on the seven touched files,
`stylelint` on the two components. `yarn lint:tsc` names no file of mine; when it was run it exited 2 with seven
errors in three of `lib-w4`'s new test files, which were being written (`consumerProfileUploadQueueRows.test.ts`,
`consumerProfileImageWidgetUpload.test.ts`, `consumerProfileImageWidgetMultipleUpload.test.ts`).

### New, not fixed

- **25 (the lead's number): the single-file dialog offers no refresh on a failed item**, also where the queue
  would (a row left without the original of its duplicate): its sidebar shows refresh only while the item waits.
- **A press that ends the row pressed says nothing at all**, also where the row keeps its refresh (the queue's
  row failed for want of the original): the row shows the failure and the refresh, the toast is not shown. That
  is the rule as given; whether such a row should be told something else is a wording question.
- **The rule goes by the row pressed only.** With two rows of one asset, a press on the row that still waits,
  whose read gives the *other* row up, is warned "try again", rightly; a press on a row that is neither tracked
  nor marked (settled long ago) is warned as before.

## Review cycle 3 of the five fixes (2026-10-08)

The rule of cycle 2 stands as built; one case it missed, and two gaps in its tests. All three done.

### 1. An item taken out of its queue counts as ended

The store stops only a row that waits, is being sent or is processing when it is removed (`stopRemoved`,
unchanged); a failed row with its refresh, or an uploaded row still without its metadata, keeps its status. So
a refresh pressed on such a row, the row deleted while the read was slow, the read failing: `'error'`, the
status as before, and "try again" about a row no longer there.

`refreshItem(assetId, item?, queueKey?)`: the third argument is the queue the item was pressed in. On `'error'`
no warning is shown when the item is no longer among the items of that queue, as when its status has turned
into an ended one. Read through `getQueueItems(queueKey)`, which the store already had: nothing of the store is
changed. Without a queue key the item is taken to be where it was (cycle 2's behaviour). Both callers pass
theirs: `UploadQueueEditable.vue` and `UploadQueueDialogSingleSidebar.vue`.

Tests: `uploadStatusFallback.test.ts` › "a refresh of a failed row whose read fails, the row taken out of its
queue meanwhile: nothing is said" and › "…still in its queue: the state could not be loaded" (the same row, the
read held and answered 502). Mounted, for the hand-over of the queue key: `uploadQueueItemRefresh.test.ts` ›
"says in which queue the row was pressed: one taken out of it meanwhile is not told to try again"
(`UploadQueueEditable`, an uploaded row without its metadata), `uploadQueueDialogSingle.test.ts` › "says nothing
when the item was taken out of its queue while its refresh was on its way" (the sidebar).
Red: the look into the queue taken out, 3 cases; the queue key not handed over by either caller, the 2 mounted.

### 2. `Uploaded` and `Stop` among the ended states

Every silent case had an item that turned `Failed`. Two more, the read held and then answered 502, the outcome
asserted `'error'`, under both profiles (`uploadStatusFallback.test.ts` › "and a refresh that fails while the row
pressed ends"):

- › "says nothing when the row pressed was stopped meanwhile, by being taken out of its queue": `removeByIndex`
  on a processing row. Called without the queue key, so that it is the status `Stop` that is read: with the key
  the row would count as ended by being gone, and `Stop` in the list would be pinned by nothing;
- › "says nothing when a duplicate notification has made the row pressed the original meanwhile": the
  notification is not kept behind the read of the refresh, the original can be read, the row is `Uploaded`.

Red with only `Failed` left in the list: all 4.

### 3. The row the queue hands over

`uploadQueueItemRefresh.test.ts` › "hands the refresh the row that asked…" has two rows now, of two assets; the
event comes from the second, the first waits on. With the first row handed over in its place the case is red.

### Numbers

```
npx vitest run src/domains/dam src/test src/domains/api --retry=0
 Test Files  107 passed (107)
      Tests  1673 passed (1673)
```

Mine went from 1404 to 1412 cases (`uploadStatusFallback.test.ts` 6, the two mounted files 1 each); the rest is
the files `lib-w4` added. `yarn lint:tsc` exits 0; `oxfmt --check`, `oxlint`, `eslint` clean on the six touched
files, `stylelint` on the two components.

### New, not fixed

- **28 and 37 (the lead's numbers)**: the `'pending'` warning for a row that ended meanwhile; a failed row that
  loses its refresh-may-help mark during a refresh that fails. Not touched.
- **`Stop` in the list of ended states is read only by a caller that passes no queue key.** Every way a row is
  stopped also takes it out of its queue (`removeByIndex`, `stopItemUpload`, `stopUpload`), so with the key the
  row already counts as ended by being gone. Both callers of the library pass the key. Kept, as the rule of
  cycle 2 names it.
- **The refresh of a removed row still runs to its end**: the read is not cancelled when the row is taken out,
  and when it answers it is applied to the rows that are left (none, for a single row). Only the warning is held
  back.

## Review cycle 4 of the five fixes (2026-10-08)

No bug and no mismatch; one gap in a test, closed in the test alone (no production change).

`uploadQueueItemRefresh.test.ts` › "says in which queue the row was pressed…" could fail only when the queue
handed over no key, not when it handed over a wrong one: no mounted case of `UploadQueueEditable` expected the
warning, so a key the row is not under would have taken every row for gone and lost every "could not be loaded"
of the queue. It is a pair now, as the one in `uploadStatusFallback.test.ts` is: the same press and the same
rejected read, the row left in its queue (the warning) and taken out of it (none). Checked with `'x'` for the key
in `UploadQueueEditable.vue`, put back by an edit: the first half red, the second green.

The sidebar of the single-file dialog needed nothing: its case "says the state could not be loaded when the
refresh cannot read the asset, and goes on offering it" already expects the warning for an item in its queue
(checked the same way, with `'x'` for the key in the sidebar: that case red).

`npx vitest run src/domains/dam src/test src/domains/api --retry=0`: 107 files, 1674 cases (one more);
`yarn lint:tsc` exits 0; `oxfmt --check`, `oxlint`, `eslint` clean on the file.

