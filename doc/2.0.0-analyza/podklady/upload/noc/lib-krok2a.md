# LIB, step 2a: the settlement modules (L2, L3, L4 of `navrh-krok2.md`)

Written 2026-10-07 on `next`, in a working tree another agent was patching at the same time. Only new files, all
under `src/domains/dam/uploadQueue/settlement/`. No existing file was edited, nothing imports the new modules yet,
nothing was committed. Steps L1 and L5 to L8 are not done here.

## Result

```
npx vitest run src/domains/dam/uploadQueue/settlement
 Test Files  3 passed (3)
      Tests  103 passed (103)
```

Three consecutive runs with `--retry=0` were green, about 2 s each. `yarn lint:tsc`, `oxfmt --check`, `oxlint` and
`eslint` are clean on the 12 files. No `vi.useFakeTimers()`, no `vi.mock`: the tests fake only what is injected
(the profile, `uploadSettlementRuntime.scheduler`, `uploadSettlementRuntime.visibility`).

The tests were checked against 18 deliberately broken versions of the modules. 13 were caught at once; three
showed a weak test and are caught now (the test was strengthened); two are not observable (see "Not pinned").

No independent review of the code was made.

## Files

| File | Purpose |
|---|---|
| `uploadSettlementTypes.ts` | the types of section 2 of the design: role, policy, profile, event, outcome, `UploadSettlement` |
| `uploadPollSchedule.ts` | the one table of the rhythm and every other time constant; `firstDelay()`, `delayAfterRead()` |
| `uploadSettlementRuntime.ts` | the default scheduler and tab visibility, as writable fields of one object |
| `uploadPoller.ts` | `createQueuePoller()`: the timer of the ticks of one queue, the error ladder, the hidden tab |
| `uploadSettle.ts` | the writes: a read asset or a known state into the rows (section 3), and what is remembered about rows |
| `uploadSettlement.ts` | `createUploadSettlement(profile)`: tracking, one coordinator of reads, tick, notification, refresh |
| `__tests__/support/manualScheduler.ts` | `manualScheduler()`: a clock the test moves; nothing global is patched |
| `__tests__/support/immediateScheduler.ts` | `immediateScheduler()`: waits up to 2 s pass in a microtask, longer ones never; for the store tests of L5 |
| `__tests__/support/settlementFixtures.ts` | rows, assets, a recording server behind the readers, the LIB profile and the DAM profile as the design gives them |
| `__tests__/uploadPoller.test.ts` | N-P1 to N-P13 (21 cases) |
| `__tests__/uploadSettle.test.ts` | N-S1 to N-S11 (35 cases) |
| `__tests__/uploadSettlement.test.ts` | N-Z1 to N-Z21 and nine cases beside them (47 cases) |

Imports of the production modules: `vue` (`toRaw`), the DAM types, `@/shared/utils/common`,
`uploadQueue/composables/assetSuggestions` (pure), and each other. Not the store, not the plugin options, not the
notification composable, no API module.

## The API as built

### `uploadSettlementTypes.ts`

Exactly section 2.1 to 2.3 of the design, names and members unchanged: `UploadRowRole`, `UploadRowRoleType`,
`UploadSettlePolicy`, `UploadSettlementTarget`, `UploadSettlementProfile`, `UploadSettlementEvent`,
`UploadRefreshOutcome`, `UploadSettlement`.

### `uploadPollSchedule.ts`

```ts
export type UploadPollMode = 'dense' | 'sparse'                      // added: the design writes the union inline
export interface UploadPollModeSchedule { marksMs: number[]; tiers: Array<{ untilMs: number; everyMs: number }>; tailEveryMs: number }
export const UPLOAD_POLL_SCHEDULE: Record<UploadPollMode, UploadPollModeSchedule>
export const UPLOAD_POLL_MIN_GAP_MS = 2000
export const UPLOAD_POLL_ERROR_LADDER_MS = [15000, 30000, 60000, 120000, 300000]
export const UPLOAD_POLL_SLOW_TEXT_AFTER_MS = 1200000
export const UPLOAD_POLL_MISSING_LIMIT = 3
export const UPLOAD_POLL_READ_FAILURE_LIMIT = 3
export const UPLOAD_NOTIFY_FILE_DELAY_MS = 250
export const UPLOAD_NOTIFY_METADATA_DELAY_MS = 2000
export const UPLOAD_READ_BATCH_LIMIT = 50
export const firstDelay: (mode: UploadPollMode) => number
export function delayAfterRead(ageMs: number, mode: UploadPollMode): number
```

The table is the plan's 3.2: dense marks 5, 10, 16, 23, 31, 40, 50, 60 s, then 30 s to 5 min, 60 s to 20 min,
120 s to 60 min, then 600 s; sparse marks 10, 30, 60 s, then 60 s to 5 min, 180 s to 20 min, 300 s to 60 min,
then 600 s.

### `uploadSettlementRuntime.ts`

```ts
export interface UploadSettlementScheduler { now(): number; setTimeout(callback: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
export interface UploadSettlementVisibility { isVisible(): boolean; onChange(callback: () => void): () => void }
export const uploadSettlementRuntime: { scheduler: UploadSettlementScheduler; visibility: UploadSettlementVisibility }
```

### `uploadPoller.ts`

```ts
export interface QueuePollerDeps { youngestAgeMs(): number | null; mode(): UploadPollMode; read(trigger: 'tick' | 'visible'): Promise<void> }
export interface QueuePoller { rowAdded(): void; readNow(trigger: 'visible'): void; reschedule(): void; stop(): void }
export function createQueuePoller(deps: QueuePollerDeps): QueuePoller
```

The poller reads the time and the visibility from `uploadSettlementRuntime` at each use. `stop()` is final; a
queue that tracks nothing is only idle and wakes with the next `rowAdded()`.

### `uploadSettle.ts`

The design names this file and its content ("the write functions of section 3") but gives no signatures. Built:

```ts
export interface UploadTrackState { queueKey; eligibleSince: number; clientFailed: boolean; misses: number; readFailures: number }
export interface UploadRowNotice { slow: boolean; readWarning: boolean; shown: 'slow' | 'readWarning' | null }
export interface UploadReadIntent { hint: 'processed' | null; metadata: boolean; early: boolean; seen: boolean }
export interface UploadSettleMemory { tracked; revision; metadataLoaded; reviveWithMetadata; notices; clock: number }   // the WeakMaps of 2.4
export const createUploadSettleMemory: () => UploadSettleMemory
export interface UploadSettleRow { queueKey: UploadQueueKey; queue: UploadQueue; row: UploadQueueItem }
export interface UploadSettleOptions { onUntrack?(queueKey: UploadQueueKey): void }

export const isFinalFileStatus: (status) => status is 'processed' | 'duplicate' | 'failed'
export const resolveReadStatus: (asset, intent: Pick<UploadReadIntent, 'hint'>) => AssetFileProcessStatusType | undefined   // 3.3
export const clearRowError: (row) => void
export const isEmptyMetadataValue: (value: unknown) => boolean
export function mergeLoadedMetadata(queue, row, asset, caches: Pick<Profile['caches'], 'addAuthors' | 'addKeywords'>): void   // 3.7
export function decorateRow(row, asset, mainFile: AssetFile, role: UploadRowRoleType): void                                  // 3.5

export function createUploadSettle(profile, memory = createUploadSettleMemory(), options: UploadSettleOptions = {}): UploadSettle
```

`UploadSettle` (the return value) has: `memory`, `policyOf(row)`, `rows()`, `isLive(row)`, `bump(row)`,
`isStale(row, startedAt)`, `startRead()`, `trackStateOf(row)`, `untrack(row)`, `noticeOf(row)`,
`syncNotice(row, { clear? })`, `applyAssetRead(asset, target, intent, startedAt): Promise<void>` (3.4),
`settleProcessedByEvent(target)` (the synchronous block of 3.10), `announceProcessed(target)` (the
`onProcessedSeen` of the `never` rows at the event), `settleFailed({ queueKey, row }, failReason)`,
`settleKnownFailed(target, failReason)`, `settleDuplicate(target, originFileId, assetType, eligible?)`,
`settleKnownDuplicate(target, originFileId, assetType): Promise<void>`, `giveUpOnMissing({ queueKey, row })` (D7).

`settleProcessed`, `tryLoadMetadata`, `markDuplicates`, `becomeOriginals` are internal to it. Only the settlement
and the tests use `createUploadSettle`; the store codes against `createUploadSettlement` alone.

### `uploadSettlement.ts`

```ts
export function createUploadSettlement(profile: UploadSettlementProfile): UploadSettlement
```

## Deviations from the design

None changes a public name or signature of section 2 or 4. In the order I would want them read:

1. **`tryLoadMetadata`: the gate lifts only the "failed" bar, never the "duplicate" one** (3.6 lets `'load'` through
   for both). Today's DAM returns on a duplicate before it looks at `metadataFailures`
   (`admin-dam … uploadQueuesStore.ts:623`), and N-S10 says "the gate lets a failed row through". Today's behaviour
   kept.
2. **`track` also ignores a row without `assetId`, a stopped row, and a `slots` row when the profile has no
   `slotFiles` reader** (4.8 names only "not in the queue" and `reader: 'none'`). None of them can be read, and
   each would hold the poller of its queue for good. Today's fallback stops at `!item.assetId` as well.
3. **A read a notification asked for is not sent when, at its time, no row it concerns is left** (4.5 would send
   it and write nothing). It follows "an event for an asset no queue has asks for nothing" and the L5 check "after
   `stopUpload` and `removeByIndex` no read remains". Its timer does stay until it is due, as 4.8 says.
4. **`dropQueue` also forgets the tracking of the rows of that queue**, not only its poller. Otherwise a row left
   in a queue that is dropped and then tracked again would be read without having been tracked again.
5. **The failure path of `becomeOriginal` stops tracking every row of the target, not only the `Processing`
   one.** The state is changed only for `Processing` as designed. Without this a row the client gave up on (D5),
   whose file is a duplicate with an unreadable original, would ask for that original at every tick, for ever.
6. **A successful `refreshAsset` / `settleKnownProcessed` resets `misses` and `readFailures` of the tracked rows
   it concerns and takes their read warning away** (4.6 says nothing). It is the general rule of 3.12; without it
   the row would say "data could not be loaded, use refresh" for minutes after a refresh that worked, until the
   next tick of an error ladder. A failed manual read is not counted, as 4.6 has it.
7. **`applyAssetRead` does not call `caches.fetchAuthors/fetchKeywords`; its callers do, once per read** (tick,
   notification read, immediate read). 3.4 ends with "once per read", and a tick applies up to 50 assets.
8. **The duplicate's original is read once per `applyAssetRead`**, by a flag; the pseudo-code of 3.4 would call
   `settleDuplicate` for every matching row (harmless when the first call bumps the others, not when the original
   cannot be read: one failing request per row).
9. **A tick's requests go out together and their answers are written one after another, in the order of the
   groups** (4.4: "groups run at once"). Same requests, a fixed order of writes.
10. **The settlement checks itself that a bulk answer and a slot list are arrays**, although the reader contract
    says the reader throws. A non-array would otherwise crash the tick after other groups were answered.
11. **The subscriptions to tab visibility and to the connection are made with the first poller and dropped with
    the last** (the design does not say when). So a store that never tracks anything (the LIB store inside DAM)
    listens to nothing, and a test that replaces `uploadSettlementRuntime.visibility` before the first row is
    honoured.
12. **`mergeLoadedMetadata` and `becomeOriginal` copy the lists and `customData`** instead of assigning the
    asset's own objects, which two rows of one asset shared until now. Server `customData` that is no object
    becomes `{}`. An empty key of the row that the server does not have is dropped (the design: "starts with the
    server's values").
13. **When the original of a duplicate cannot be read and the row carried a text of the settlement** ("takes too
    long", the read warning), that text is erased from `error.message`; `hasError` stays as designed.
14. **A `failed` event without `failReason` is written as `unknown`** (the field is optional in the event type).
15. `uploadSettlementRuntime.visibility.onChange` returns a no-op when there is no `document`.
16. Added exports: `UploadPollMode`; the internal types of 2.4 (`UploadTrackState`, `UploadRowNotice`,
    `UploadReadIntent`) are exported from `uploadSettle.ts` because its functions take them.

## Where the design was ambiguous, and what I chose

- **Mode change, rule 6 of 4.4** (`nextAt = min(nextAt, lastReadEndedAt + delayAfterRead(age, new mode))`).
  "Age" is taken at the end of the last read, and the 2 s gap applies. When the youngest row came after the last
  read, or no read was made yet, the candidate is that row's first mark in the new mode. So sparse to dense pulls
  a read planned for the 30 s mark to the 16 s one; dense to sparse never moves a planned read.
- **`reschedule()` is the one entry for "hidden", "mode changed" and "nothing tracked"**, since the interface has
  no other: hidden drops the timer and keeps the time; nothing tracked drops both; otherwise rule 6.
- **N-P7, "two within 2 s are one read"**: a `readNow` less than 2 s after the end of a read is planned for the
  end of that gap, and a second one lands on the same time. A `readNow` after the gap reads at once.
- **A follow-up asked for during a read beats the error ladder**: it comes 2 s after the read even when that read
  failed. A new row during the wait of the ladder brings the read closer as well (N-P10).
- **Re-tracking a tracked row** starts its age and its counters anew. Nothing in the design does it.
- **Merging of intents is per target** (`fileId ?? ''`), as `PendingNamedRead.targets` is typed. A `metadata`
  event (no file) and a `processed` event (a file) are two targets of one read, applied in the order they came;
  the metadata is loaded by the first, whichever the read shows.
- **`onProcessedSeen` is called twice for a `processed` event**: at the event (3.10) and by the read after it
  (3.4, `seen`). Both are in the design. The DAM hook is idempotent.
- **A retry of a notification read, when a new event for the same asset waits already**, joins that read: its
  targets are merged in, the failure and miss counts carried over, the earlier time kept.
- **`failures` and `misses` of a notification read are consecutive**: an answered read resets `failures`; a
  failed one leaves `misses`.
- **A tick that finds a slot's file processed** calls the event block for the target `{ assetId, fileId of the
  row }`, so it writes every `event` row that passes `settle` for that file, then asks for the asset with delay 0
  through the same coordinator (so after the tick).
- **`hasTracked()`** counts only rows a tick would read: in a queue, not stopped, with an asset.
- **`dispose()`** stops the pollers, cancels the waiting notification reads (their `notify` promises resolve),
  drops the subscriptions, and makes `track` and `notify` no-ops. A read already on its way still writes.

## The tests

Ids are in the case names. `%s` cases are counted once per row of their table.

`__tests__/uploadPoller.test.ts`

| Id | Cases |
|---|---|
| N-P1 | comes 5 s after its first row when the poll is the only channel · comes 10 s after its first row when the notifications are alive |
| N-P2 | rows that keep coming every 2 s do not put the read off: it comes every 5 s at the latest |
| N-P3 | after the last row the reads come at 10, 16, 23, 31, 40, 50 and 60 s of its age |
| N-P4 | thins out: every 30 s to 5 min, … · with the notifications alive: every minute to 5 min, … (90 minutes each, every read time asserted) |
| N-P5 | is not read when its timer is due, and holds no timer after · plans no further read after the one its last row was settled by · gives its timer up at once when it is told so, and reads again for a new row |
| N-P6 | whatever asks for a read while one is on its way gets exactly one more, 2 s after it |
| N-P7 | a read at once does not make the rhythm faster, and two within 2 s are one read |
| N-P8 | reads nothing, and on the return reads at once and goes on by the age · a row that comes while the tab is hidden is read on the return, not before |
| N-P9 | are tried again after 15, 30, 60, 120, 300 and 300 s, and a read that succeeds starts the ladder anew |
| N-P10 | a new row during the wait after a failure brings the read closer |
| N-P11 | the dense rhythm brings the next read closer; the sparse one does not put a planned read off · a first read not yet made is planned by the mode of now as well |
| N-P12 | the wait after a read and the first wait follow the table |
| N-P13 | keeps its first mark when the read ends: by a failure it is not pushed down the ladder · keeps its first mark when the read succeeds, and is never read sooner than 2 s after it |
| — | holds no timer and plans nothing once it is stopped, whatever a read on its way answers |

`__tests__/uploadSettle.test.ts`

| Id | Cases |
|---|---|
| N-S1 | with its metadata: the state, the file, the preview, the switches, the metadata and the form |
| N-S2 | on its event alone: the state, the preview and the switches, and no form · a read that shows no final state and carries no hint writes nothing |
| N-S3 | a row that has its metadata keeps what the user has typed since, the switches too |
| N-S4 | a row the client gave up on gets its form at once on the event alone, with the metadata it never had · …which had its metadata by then, gets the form back as the user left it · a row that settles on the event: uploaded at once, and the read after it brings the metadata and the form · a row that never failed gets no metadata from the read after its event |
| N-S5 | keeps what a mass operation has put into the row, and fills what is still empty · two rows of one asset do not share what was loaded into them |
| N-S6 | the row fails with the reason of the file, loses its form, and the text it had is gone · a failure the caller knows of is written without a read, also over an uploaded row |
| N-S7 | the row becomes the original: … · the original is read once for all the rows of the asset, and a known duplicate goes the same way · an original that cannot be read fails only the row that still waits · a duplicate that (names no original / is no image / has no type) changes nothing and asks for nothing |
| N-S8 | the row is uploaded and marked at once, and completed once the original file is read · an original file that cannot be read leaves the row as it was marked · a row written into or taken out while the original file was read is not completed · a read that shows the file a duplicate settles the row the same way |
| N-S9 | a read that shows the file not final yet leaves a row that is (uploaded / failed) as it is · a final state a read shows is written over another final state of the row · a stopped row is written by nothing · a read that started before an event wrote into the row does not write over it |
| N-S10 | opens the form of a row whose file is still sent, and leaves the state of the row alone · gives nothing to a failed row, nor to a duplicate · gives a failed row its metadata when the gate of the profile says so, never a duplicate · a read after it that shows the file processed settles the row as well |
| N-S11 | is only completed by a processed file, and told about it · is not told by a read the metadata notification asked for · a failed file fails the row that has that file, not the one without a file · a duplicate file marks the row that has that file, not the one without a file |

`__tests__/uploadSettlement.test.ts`

| Id | Cases |
|---|---|
| N-Z1 | is settled by a tick with no notification at all, with its metadata |
| N-Z2 | is settled by its notification, and no tick asks about it after |
| N-Z3 | ends the same whether the tick or the notifications come first (tick first; metadata then processed; processed then metadata) |
| N-Z4 | a tick sent before the failed notification and answered after it does not bring the row back |
| N-Z5 | a row taken out of the queue while its read is on the way is not written · nor is a row of a queue that was cleared while its read was on the way |
| N-Z6 | a row whose finish request failed is asked about for as long as it stays, and settles when the server is done |
| N-Z7 | fails with the text of an unknown error once its asset was missing from three reads · counts from nothing again once the asset was there · a bulk answer that is no list is a failed read, not missing assets · when every read of a tick fails, the queue waits as after a failed read |
| N-Z8 | the read after a metadata notification comes 2 s later · a processed notification meanwhile brings that read to 250 ms, and the metadata is loaded with it |
| N-Z9 | a processed notification with no metadata notification leaves the row uploaded without its form |
| N-Z10 | warns after three failed reads on a row without its form, not on one that has it · a read that succeeds takes the warning away, and brings back the text of a long processing · a read that succeeds leaves no text on a row that had only the warning · (the slot: last case of N-Z20) |
| N-Z11 | says its processing takes too long after 20 min, is read on, and loses the text when it settles |
| N-Z12 | a (processed / copied / metadata / failed / duplicate) notification about an asset no queue has asks for nothing and changes nothing · a notification whose rows have left their queue before its read is due asks for nothing |
| N-Z13 | a tick asks by licence and by fifty, and for a single asset by itself · a notification asks for the asset it names and no other |
| N-Z14 | one group of a tick that fails does not stop the other |
| N-Z15 | a read a notification asks for during a tick waits for it; never two at once |
| N-Z16 | the refresh of a row during a read is sent right after it, with no wait of its own |
| N-Z17 | the refresh says whether the file is settled, still pending, or could not be read · the refresh of a mass-edit row answers by the state of the file, and only completes the row |
| N-Z18 | a read after the copied notification that fails leaves the row waiting, and a later read settles it · with nothing else to ask, the read of the notification is tried again by itself |
| N-Z19 | one asset in the upload and in the mass edit: its processed file settles the first and completes the second |
| N-Z20 | a slot row is settled from the list of the slots of its asset, then completed from the asset · a slot row that is not the main file takes the state of the asset, not the preview of another file · a slot row whose file is missing from three lists fails; one whose list cannot be read never warns |
| N-Z21 | a row uploaded by its event stays uploaded when its asset is missing three times, and warns while it has no form |
| — | the read a notification asks for, when it fails: is tried three times, 15 and 30 s apart, and then the row without its form warns · joins the read of a notification that came meanwhile, … |
| — | a duplicate whose original cannot be read: fails the row that waits and leaves alone the one the client gave up on; neither is asked about again |
| — | a duplicate notification marks the row at once and reads only the original file (DAM profile) |
| — | which rows a settlement tracks: not a row of another queue, … · a row untracked or a queue dropped leaves no timer, and a disposed settlement none at all |
| — | the tab and the notifications: a hidden tab stops the ticks, not the read a notification asks for; the return reads at once · reads by the sparse rhythm while the notifications are alive, and by the dense one once they die |
| — | under the immediate scheduler: a notification is settled by awaiting it alone, and no tick ever comes |

Every id of 9.1 for L2 to L4 has at least one case. None could not be written. N-K1 to N-K4 belong to L1.

### Not pinned

- N-Z3 compares the orders under the LIB profile only.
- N-Z11's "shown once" is asserted as "the text is there at 20 min and still the same 30 min later", not as a
  count of writes: the settlement writes the same text again at every tick.
- Two of the broken versions pass every test because nothing can observe them: a row the client gave up on is
  never `Processing`, so marking it slow shows nothing; and a tracked row whose asset is missing from three
  notification reads has failed (D7) by the time the read warning would be set on it.
- The default scheduler and the default visibility (real timers, `document`) are not exercised.

## What the wiring step (L5) must know that the design does not say

1. **`profile.queues()` must yield the reactive queues** (`queues.value.entries()` does). The settlement writes
   through whatever it yields and keys its memory by `toRaw(row)`, so `track`/`untrack` take a row raw or
   reactive alike.
2. **Order of calls.** `track(queueKey, row)` only after the row is in that queue and has its `assetId`.
   `dropQueue(queueKey)` before the queue object is replaced (it forgets the tracking of the rows it still finds).
   `untrack(row)` before or after the splice, either works; a row removed without `untrack` is skipped by itself.
3. **`notify()` writes synchronously what it writes at once**: `failed` completely, `duplicate` with
   `markDuplicate` up to the read of the original, `processed` for `settleOn: 'event'` rows. The promise of
   `processed`, `copied` and `metadata` resolves only after the delayed read (250 ms, 2 s), and after its first
   try when that fails. The listener must not await it; tests that await the old wrappers need
   `immediateScheduler()` set **before** the store tracks or is notified, and the queue stopped before the
   original scheduler is put back (a timer is cancelled on the scheduler that is current then).
4. **`hooks.onRowFinal` is called more than once per row**: at the event and again by the read that completes
   the row; in the slot flow twice as well. Today's `processUpload` + `recalculateQueueCounts` are fine with it.
5. **`readers.asset` must return `null` for a 404.** If it throws instead, a single tracked row whose asset is
   gone never fails by D7: it warns by R7 and is polled on the error ladder for ever. `readers.assets` is called
   only when a queue tracks two or more assets of one licence; one asset always goes through `readers.asset`.
6. **`caches.fetchAuthors/fetchKeywords` are called after every read**, also one that wrote nothing. They are
   debounced no-ops then; a test that counts name lookups is not affected, one that counts calls would be.
7. **`refreshAsset` and `settleKnownProcessed` never reject**; `'error'` is both "the read failed" and "no such
   asset". `settleKnownDuplicate` never rejects either (the original that cannot be read is the row's failure).
8. **Texts.** `messages.readFailed` is first needed 45 s after a notification whose read keeps failing, or at the
   third failed tick: the key `uploadErrors.readFailed` (L8) must exist by the time L5's tests reach that.
9. **`dispose()` exists and nothing calls it.** A store thrown away with a queue still tracked (a new pinia per
   test) leaves its poller timer on the real scheduler; today's per-row fallback timers have the same life.
   `stopUpload` in `afterEach` (already there in the step 0 tests) drops the poller.
10. **For D2 (DAM):** a tick's target is `{ assetId, fileId: the asset's main file }`. Under the DAM
    `notificationMatches` a tracked upload row without `fileId` is therefore never matched by a tick (today's
    fallback passes the row's own `fileId`, and `null` matches). Upload and import rows have their `fileId` before
    they are tracked, so nothing changes as long as that holds.
11. The LIB profile's `matches` ignores `fileId`, so `fileId: null` in the wrappers is enough. The metadata
    notification carries no file id at all (`DamNotificationAssetData` has only `asset`).

## Not done, not verified

- Nothing outside `settlement/` was run: no existing test, no build, no whole suite.
- The modules are not exported from `src/lib.ts` and not used by the store; behaviour of the application is
  unchanged.
- The existing step 0 tests were read only by their titles, to check the direction of each rule; whether they
  pass on the wired store is L5's first run.

---

## Review round 1 (2026-10-08)

The fix list the team lead drew from the two reviews (`posudok-kodu-lib-moduly-codex.md`,
`posudok-kodu-lib-moduly-opus.md`). Only files under `settlement/` were edited. The public interface of
`createUploadSettlement` and every type in `uploadSettlementTypes.ts` are unchanged.

```
npx vitest run src/domains/dam/uploadQueue/settlement      (--retry=0, three runs)
 Test Files  3 passed (3)
      Tests  141 passed (141)        poller 27, settle 47, settlement 67   (before: 103 = 21 + 35 + 47)
```

`oxfmt --check` and `oxlint` are clean on the 12 files; `yarn lint:tsc` reports nothing in `settlement/` (and
nothing at all at the last run). Every fix was reverted alone, one at a time, with the tests run against it: each
turns at least one test red (26 reverts, the table below names the test). Two tests were too weak for that at
first and were strengthened (2a, T2 for a slot row).

### What was done

| # | Item | Done | The change | The test that goes red without it |
|---|---|---|---|---|
| 1 | Opus B1 | yes | `resolveReadStatus(asset, target, intent)`: when `target.fileId` is set and is not `asset.mainFile.id`, the status is `intent.hint ?? undefined` | settle: "a read asked for about a file that is not the main file of its asset" (5 cases: main file failed / a duplicate, with and without a hint; the main file's own row still written). settlement: "two slot uploads of one asset at once" (tick × 2, notification × 2) |
| 2 | Opus B2 | yes | poller: `reschedule` asks "nothing tracked?" before the hidden tab; `readNow` and the timer clear the plan when nothing is tracked (`goIdle`) | poller: "a queue that empties while the tab is hidden" (4 cases: told / not told, dense +5 s / sparse +10 s). settlement: "a queue whose rows are gone while the tab is hidden" |
| 3 | Codex 1 = Opus B3 | yes | `becomeOriginals` notes its rows and the revision of each before the original is asked for; after the wait, in the success and in the failure branch, it writes only a row whose revision is the same, which is still in its queue and not stopped. Not routed through the coordinator | settle: "a duplicate in the library, while its original is being read": "a failed notification that comes meanwhile stands…", "an original that cannot be read does not fail a row an event has written into meanwhile" |
| 4 | Codex 2 | yes | a generation per queue key, raised by `dropQueue`; a tick takes it when it is queued and checks it when its turn comes and after its requests are answered | settlement: "a tick that waits for its turn behind another read is not run for a queue dropped meanwhile, whose key another queue has by then" |
| 5 | Codex 3 | yes | `dispose()` is asked about when a queued read gets its turn and after every wait, before any write, hook, retry or follow-up: in the tick, the notification read, the immediate read, and (through `UploadSettleOptions.isDisposed`) after the read of a duplicate's original | settlement: "a settlement disposed of" (6 cases) |
| 6 | Codex 5 | yes | after a failed notification read a tracked row is warned when its own `readFailures` reaches the limit; an untracked row when the read is exhausted. The count of the read still times the retries | settlement: "the warning of a row whose reads keep failing" (2 cases: two ticks + one notification read; answered ticks between three failed notification reads) |
| 7 | Codex 6 | yes | `untrack(row)` and `dropQueue(queueKey)` cancel a waiting notification read that no row other than the leaving ones needs: timer cleared, removed from `pending`, waiters released | settlement: "a read a notification asked for, when its rows are taken out" (3 cases) |
| 8 | Opus M1 + proposal 1 | yes | `decorateRow` writes the switches only into a row with no form whose metadata was never loaded; `settleProcessed` loads no metadata into a row whose form is on | settle: N-S4 "…gets the form back as the user left it" (now sets and asserts both switches, T3), N-S3 "a row whose form is on is given nothing by a processed file…" |
| 9 | Opus M2 | yes | the four `!row.isDuplicate` tests are now "not a marked duplicate" (`row.isDuplicate && policy.duplicate === 'markDuplicate'`) | settle: "a row that became its original, then failed, gets its form back with what the user typed…" |
| 10 | Opus proposal 2 | yes | poller: `reschedule` plans by the rhythm of the mode only when the last read did not fail; `consecutiveFailures` is reset whenever the queue goes idle | poller: "the wait after a failed read" (2 cases) |
| 11 | Opus proposal 3 | yes | a throw while one asset (or one slot row) of a tick is written is caught, logged, and the tick goes on | settlement: "an asset of a tick that cannot be written does not stop the other assets…" |
| 12 | tests | yes | Codex TEST 8: N-S11 rewritten into two cases, rows start `Failed` and `Uploaded`, a not-final read without a hint first. T1: "a read that shows the file a duplicate asks for the original once for all its rows, whether it answers or not". T2: "a stopped row, in the DAM application" (event block, `announceProcessed`), "a slot row stopped while the list of its slots is read" (file processed / failed). T3: with item 8 | — |

Rejected by the lead and not done: Codex 4, Codex 7, Opus proposal 4. Not mine: Opus M3, proposal 5.

### Things in it that were not on the list

- **`settleDuplicate` starts `markDuplicates` and `becomeOriginals` together** (`Promise.all`), where it awaited
  the first before it began the second. Needed for item 3: with the await in between, `becomeOriginals` noted its
  rows one microtask after the call, so an event handled right after the duplicate one was not seen as "written
  meanwhile". Under a profile that mixed both duplicate policies the two original reads would now go out together;
  no profile does.
- **After `dispose()` everything the settlement is asked for is a no-op**: `settleKnownFailed` and
  `settleKnownDuplicate` too (they wrote before), `refreshAsset` answers `'error'` without a request,
  `settleKnownProcessed` resolves without one, `hasTracked()` is `false`.
- The catch of item 11 also wraps each slot row of a tick.
- `decorateRow` got a fifth parameter (`hadMetadata`), `resolveReadStatus` a second (`target`),
  `UploadSettleOptions` a member (`isDisposed`). All three are internal to the folder.

### What the wiring agent must know

1. **`untrack(row)` now means "the store is taking this row out".** Besides ending the ticks of the row it cancels
   every waiting notification read that only this row needed, and the `notify()` promise of such a read resolves
   at once, without a read. The design calls `untrack` only from `stopRemoved`, `removeByIndex` and
   `stopItemUpload`, where that is right. Do not call it for a row that stays in its queue and still waits for a
   notification's read (the settlement untracks a row it settles by itself).
2. **`dropQueue(queueKey)` does the same for the rows of that queue**, and must still be called before the queue
   object is replaced: it finds the rows through `profile.queues()`. Called after, it only stops the poller and
   invalidates a waiting tick; reads of notifications then end when they are due, as before.
3. **A read asked for with a `fileId` that is not the asset's main file takes its state from the event alone.**
   For the LIB profile (which matches by asset): a `processed` or `copied` event passed on with `fileId` =
   `event.data.id` is unaffected as long as that id is the asset's main file, which it is for an upload. If the
   `copied` event's id were anything else, a copy whose main file failed would be settled as uploaded (the hint
   stands); `fileId: null` in `toEvent` avoids the question, since the LIB `matches` ignores the file.
   `refreshQueueItem(item)` in DAM, for a row whose file is not the main one, now writes nothing into the row and
   still answers by the state of the main file.
4. **A row handed over with its form on (`canEditMetadata: true`) gets no metadata and no switches from the
   settlement**, whether or not the settlement loaded its metadata. Existing store tests that seed such a row keep
   what they seeded.
5. **A LIB row that became its original** (`isDuplicate`, policy `becomeOriginal`) is an ordinary editable row for
   everything after: it gets its form back after failed → processed, it can carry the read warning.
6. **`dispose()`** is now complete (see above): safe to call from the store's disposal; a read on its way writes
   nothing afterwards.
7. Unchanged and worth repeating: `notify()` writes what it writes at once synchronously and resolves after its
   read; `refreshAsset` and the `settleKnown…` calls never reject.

### What in the notes above no longer holds

- "The API as built": `resolveReadStatus(asset, target, intent)`, `decorateRow(row, asset, mainFile, role,
  hadMetadata)`, `UploadSettleOptions { onUntrack?, isDisposed? }`.
- Deviation 3: the timer of a notification read whose rows are gone no longer always stays until it is due;
  `untrack` and `dropQueue` cancel it (item 7). A row spliced out without either still leaves it, and it still
  asks for nothing when due.
- "Where the design was ambiguous": "a follow-up … beats the error ladder" still holds; a **mode change** no
  longer does (item 10). "`dispose()` … a read already on its way still writes" is no longer true (item 5).
- "The tests": the counts (now 27 / 47 / 67); N-S11 has two rewritten cases; N-S4's second case asserts the
  switches.
- "Not pinned", second point: a tracked row is now warned by its own count, so "a tracked row whose asset is
  missing…" still stands, but the equivalent for failed reads is pinned by item 6's tests.

### Not verified in this round

- Nothing outside `settlement/` was run, and the store is being wired by another agent at the same time: whether
  the existing store tests pass on these modules is that agent's run.
- Item 9 changes four places; only `settleProcessed` is reached by a test. `settleProcessedByEvent` and
  `tryLoadMetadata` need a profile with `becomeOriginal` and `settleOn: 'event'` (or a failed original with an
  open gate), which neither store has; `syncNotice` needs a became-original row without a form whose reads fail.
- Whether the id of the `asset_file_copied` notification is the copy's main file (point 3 above).

### After the round: a guard test of the library

`src/test/i18nLiteralKeys.test.ts` › "upload queue item error messages are not raw literals" was red on
`uploadSettle.ts` (reported by lib-c1b): its pattern `.error.message = '<literal>'` also catches the empty string
with which the failure branch of `becomeOriginals` took the settlement's own text away. That line now writes the
whole `error` object (`{ ...row.error, hasError: true, message: shown ? '' : row.error.message }`); what it does is
the same. Pinned by a new case, "the text of a row that fails for a duplicate whose original cannot be read: goes
when it was the settlement's own, and stays when the row had it from elsewhere".

`npx vitest run src/domains/dam/uploadQueue/settlement src/test/i18nLiteralKeys.test.ts --retry=0`: 4 files,
145 tests passed (settlement 142: poller 27, settle 47, settlement 68; the guard file 3). `oxfmt --check`, `oxlint`
clean; `yarn lint:tsc` reports nothing in `settlement/`.

Left on disk on purpose (rule: no deleting): `node_modules/.cache/vitest-tmp-lib-c1a/`.


### After the round: a text of the settlement the store wrote over (found by the admin-dam wiring)

`syncNotice` took an error away whenever `notice.shown` was set, whoever had written into `row.error` since. A row
that carried the read warning while its file was sent, and whose upload then failed, lost the error of that
failure at the next tick: `failed` with `{ hasError: false, message: '' }`.

What changed, all in `uploadSettle.ts`:

- `UploadRowNotice` has a new member `text`: the message the settlement wrote together with `shown`.
- `syncNotice`, without `clear`: the error is touched only while `row.error.message` is still that text
  (`showsOwnText`). Otherwise only `shown` and `text` are reset and the row's error is left alone. `clear: true`
  means what it meant: the row settled as processed, every error goes.
- **Beyond the instruction, same assumption:** when the text is still the settlement's but the row has become
  `Failed` meanwhile, only the message is erased and `hasError` and the reason stay. This is what the LIB store's
  `catch` produces: it sets `hasError` and `Failed` and writes no message (`uploadQueuesStore.ts`, the `catch` of
  `queueItemUploadStart`), so the text on the row is still the settlement's and the compare-the-message rule alone
  would still have wiped the flag of the failure.
- The failure branch of `becomeOriginals` erases the message by the same test (`showsOwnText`) instead of by
  `shown`.

The other places that write or erase `row.error` were checked and left: `settleFailed` (always erases the old text,
decision O2), `giveUpOnMissing` (writes its own text, D7), `markDuplicates` and both `clear: true` callers (the row
is settled; a settled row shows no error, as before step 2).

Tests (`__tests__/uploadSettlement.test.ts`, LIB profile, through `createUploadSettlement`):

| Case | Goes red without |
|---|---|
| "a row that warned while its file was sent, and whose upload then failed": "keeps the error the store wrote over the warning, when the reads still fail" / "…are answered again" | the compare-the-message rule |
| same block: "loses the warning and keeps the flag of its failure, when the store wrote no text of its own" | the "failed row keeps its flag" rule |
| same block: "and is uploaded with no error at all when the server finished its file all the same" | (pins `clear: true`) |
| "a text of the settlement that nobody wrote over is taken away, flag and all, once it no longer holds…" | (pins that the own text still goes) |
| "the text of a row that fails for a duplicate whose original cannot be read": now three rows, one whose text the store wrote over | the `showsOwnText` test in `becomeOriginals` |

Each of the three rules was reverted in place, the tests run, and the rule put back (the three red cases above).

`npx vitest run src/domains/dam/uploadQueue/settlement --retry=0`, three runs: 3 files, 147 tests passed (poller 27,
settle 47, settlement 73). `oxfmt --check` and `oxlint` clean, `yarn lint:tsc` exit 0.

Not changed, and worth knowing: a text of the settlement that still holds is written again at the next sync over
whatever the row says (a row still `Processing` after 20 minutes says "takes too long" again even if a store wrote
another message into it meanwhile). No store writes an error into a row that still waits, so nothing shows it.

### After the round: a row an event has overtaken still gets its metadata (review of the admin-dam wiring, Opus M1)

With the service on and `settleOn: 'event'`, an upload ended `uploaded` without its form when its `processed`
notification arrived while the read of its metadata notification was on the wire: the event wrote the state and
bumped the row above the mark of that read, the answer then skipped the row whole as stale, and the read the event
planned carries `metadata: false`. The row was uploaded, untracked, and nothing asked again.

The change, in `applyAssetRead` (`uploadSettle.ts`): the stale check now guards only the block that writes the
state of the file and completes the row. A stopped row is still skipped whole, and the `duplicateSettled &&
!isLive(row)` guard is as it was. The `intent.early` part (`tryLoadMetadata`) runs for a stale row too: it changes
no state, loads once, and refuses a failed row (but for the gate) and a marked duplicate by itself.

Tests (`__tests__/uploadSettlement.test.ts`, "a notification that arrives while the read of the metadata
notification is on the wire", through `createUploadSettlement`; the held answer says the file is processed):

| Case | What it shows |
|---|---|
| "processed, in the DAM application: the row is uploaded at once, and the answer still gives it its metadata and its form" | goes red without the fix (checked: reverted in place, this case alone failed, put back) |
| "failed, in the DAM application: the row stays failed, with no form and nothing loaded" | the stale answer, which says "processed", writes no state; a failed row is refused its metadata |
| "duplicate, in the DAM application: the row stays a marked duplicate, with no form and nothing loaded" | the same for a marked duplicate |
| "processed, in the library: as before, the answer settles the row with its metadata and its form" | LIB writes nothing at the event, so its row was never stale: unchanged |

`npx vitest run src/domains/dam/uploadQueue/settlement --retry=0`, three runs: 3 files, 151 tests passed (poller 27,
settle 47, settlement 77). `oxfmt --check` and `oxlint` clean, `yarn lint:tsc` exit 0.

One consequence to know: a row an event has brought back from a client failure (`processed` over `Failed`, R6) and
that is stale for a metadata read on the wire now gets its metadata from that answer already, not only from the
read the event planned. Same end state, one read earlier.

## Additions to the interface after the wiring (2026-10-08, by lib-c1b)

Two owner-approved changes needed the settlement to say more; both additions are optional members, so a profile
written before them compiles and behaves as before. Details and the rules are in `lib-krok2b.md`, "Two
owner-approved changes".

```ts
// uploadSettlementTypes.ts
export interface UploadReadOptions {
  /** Whether a failure of this request is to be reported: of a streak of failed reads only the first. */
  report: boolean
}
readers.asset(assetId, options?: UploadReadOptions)
readers.assets(licenceId, assetIds, options?: UploadReadOptions)
readers.slotFiles?(assetId, options?: UploadReadOptions)
hooks.onRefreshMayHelp?(queueKey, row, mayHelp: boolean) // whether a refresh may still change a failed row
```

Internal: `UploadTrackState.reported: boolean`; `UploadSettleMemory.refreshMayHelp` and
`setRefreshMayHelp(queueKey, row, mayHelp)` in `uploadSettle.ts`; `ReadUnit.read(options)`, and its answer for one
asset carries `missing`; a `failing` flag in `createUploadSettlement`, which the last `dropQueue` clears.
`untrack()` and `dropQueue()` do nothing after `dispose()`. A notification read that fails after its rows left is
not tried again. A row left failed without its original is told `false` once three reads in a row find no asset
(`missesOfLeft` in `uploadSettlement.ts`); the failure branch of `becomeOriginals` tells `true` only for a row it
fails itself or one that was marked before. Tests: 175 cases in the folder now (poller 27, settle 47, settlement
101); the fixture server
has `letReport()` and `failAsset()`, and the recorder of the hooks `calls.refreshMayHelp` (`+key` / `-key`).

(The first version of this addition had `hooks.onUntracked(queueKey, row)`; it was replaced in the review round
over the fixes, see `lib-krok2b.md`.)

### What `refreshAsset` answers (review cycle 1 of the five fixes, 2026-10-08, by lib-c1b)

The type `UploadRefreshOutcome` is unchanged; two of its answers changed, for every consumer of the settlement
(point 7 of "What the wiring step must know" above is no longer the whole of it):

- **`'error'` also when the read answered and a row is left without the original of its duplicate**, which could
  not be read: the file is settled, the row is not, and asking again may mend it. `becomeOriginals` answers
  whether it left such a row (one it failed itself, or one marked as refresh-may-help before), `settleDuplicate`
  and `applyAssetRead` pass that on (`Promise<boolean>`; the poll and the notification reads ignore it). Only
  a role whose policy is `duplicate: 'becomeOriginal'` can get there.
- **`'settled'` when the read found no asset and that miss was the one too many** for the rows it concerns: the
  tracked row is given up as by the poll (`giveUpOnMissing`), the row left without its original loses its
  refresh-may-help mark, and no row of the asset is still tracked or still marked. While any is, the answer
  stays `'error'`. `countMiss` and `countMissOfLeft` answer whether they gave the row up.

`readTargetNow` now answers the outcome itself (`settleKnownProcessed` ignores it). The settlement folder has 179
cases (poller 27, settle 47, settlement 105).

