# Review of the settlement modules (Opus, read-only)

Base: common-admin `src/domains/dam/uploadQueue/settlement/` (short file names below). "LIB store" =
`src/domains/dam/uploadQueue/store/uploadQueuesStore.ts`, "DAM store" = admin-dam
`src/domains/coreDam/asset/store/uploadQueuesStore.ts`, "LIB test" = `src/domains/dam/uploadQueue/__tests__/uploadQueuesStore.test.ts`.
Read in full: the six modules, the three test files, the three support files, the design, the plan, the author's
notes, both stores, `api/uploadApi.ts`, DAM `fileApi.ts:60-320`. Nothing was run; every claim is from reading.

## BUG

**B1. The state of the asset's MAIN file is written into a row that holds another file (DAM slot rows).**
`uploadSettle.ts:101-107` takes the status from `asset.mainFile` alone, a final state there beats the hint (`:106`),
and `applyAssetRead` writes it to every row that matches the target (`uploadSettle.ts:512`, `:529-540`). The target
of a notification read and of the slot follow-up read is the row's own file (`uploadSettlement.ts:259`, `:417-419`,
`:482-487`), which need not be the main one.
Scenario: asset X, two slot uploads at once, A (the main file) and B. A fails, B is processed. Tick: list of slots ->
row A failed, row B uploaded (`uploadSettlement.ts:255-262`); follow-up read `{X, B}` answers `mainFile` = A, `failed`
-> row B passes `decorate` and `settle` -> `settleFailed(row B, A's reason)`. With the socket the same after
`processed(B)`. If A is a duplicate, row B is marked duplicate and its `fileId` becomes A's original
(`uploadSettle.ts:533`, `:391-394`).
Today that read only decorates (DAM store `:546-564`) and the fallback reads a state only when the main file is the
row's (DAM `fileApi.ts:148-150`). N-Z20 has the main file processed only (`uploadSettlement.test.ts:896-908`).
Fix: in `applyAssetRead`, when `target.fileId` is set and is not `mainFile.id`, the read says nothing about that
file: `status = intent.hint ?? undefined`.

**B2. A plan made for rows that are gone survives a queue that empties while the tab is hidden.**
`uploadPoller.ts:134-137` returns for a hidden tab before the "tracks nothing" branch (`:138-143`), so `onUntrack`
(`uploadSettlement.ts:115-117`) leaves `nextAt`; on the return `readNow` leaves at `uploadPoller.ts:121` without
clearing it; the next `rowAdded` takes `sooner(stale, now + first)` (`uploadPoller.ts:111`) and `arm` waits 0 ms (`:55`).
Scenario (sparse): t=0 row A tracked, read planned for 10 s; t=2 tab hidden; t=3 a notification settles A (named
reads run while hidden); t=60 tab visible; t=100 row B tracked -> tick at t=100, age 0, not at 110 (dense: not at
+5 s). Breaks "first read after 5 s / 10 s" (R15, D1) and `min(planned, now + first)`; a copy row can spend one of
its three D7 misses at age 0.
Fix: in `reschedule` test `age === null` before the hidden branch; in `readNow` set `nextAt = null` when nothing is
tracked. The visible case is pinned (`uploadPoller.test.ts:215-226`), the hidden one is not.

**B3 (low). A duplicate the caller knows of (LIB) overwrites what an event wrote while its original was read.**
`settleKnownDuplicate` runs outside the coordinator with `eligible = () => true` (`uploadSettle.ts:468`, `:481`);
after the await every row of the target is rewritten (`:427-455`) with no revision mark, unlike `markDuplicates`
(`:387-390`). `duplicate` event -> original on its way -> `failed` event (design 3.1 allows it): row Failed, bumped
-> the original answers -> row uploaded, original, form on. Today's LIB races the same way (LIB store `:363-397`),
so it is no mismatch. Fix: note `revisionOf` of the candidate rows before the await, skip those that moved.

## MISMATCH

**M1. A row the client gave up on gets its form back with the server's switches, not the user's.**
`settleProcessed` decorates before it gives the form back (`uploadSettle.ts:278`, then `:280-284`), and
`decorateRow` writes `mainFileSingleUse` / `mainFileInternal` whenever `!row.canEditMetadata` (`uploadSettle.ts:164-167`):
true for a row whose form a client failure took away (LIB store `:210-215`), although its metadata was loaded.
Scenario (LIB, socket alive): the metadata notification opens the form while the file is sent, the user switches
single use off; the finish request fails -> Failed, form off; `processed` -> read -> the switch is the asset's
again, and then the form comes back.
Today LIB writes the switches only inside the first load (LIB store `:254-270`; LIB test `:252-275`, asserted at
`:273`). DAM is safe on the event path (`uploadSettle.ts:329` gives the form back first), not on a tick or a refresh.
Inferred: that LIB test stays green after L5 only because its row's file id is not the mocked main file's
(`decorateRow` leaves at `uploadSettle.ts:160`); N-S4 asserts no switch (T3).
Fix: write the switches for a row that never had its metadata (`!metadataLoaded.has(raw)`), not for `!canEditMetadata`.

**M2. In LIB a row that became its original never gets its form back after failed -> processed.**
`uploadSettle.ts:280` keeps every `isDuplicate` row out of the metadata/form block. That is the DAM rule (a marked
duplicate is read-only); a LIB row that became its original is editable (`uploadSettle.ts:449`) and `settleFailed`
leaves `isDuplicate` set (`:294-306`). After `failed` then `processed` the row is uploaded with no form, and neither
the refresh (same block) nor a metadata notification (`uploadSettle.ts:491`) gives it one.
Today: LIB store `:286-290` -> `:254-270` gives it back.
Inferred: LIB test `:301-335`, case "the original of a duplicate brought", goes red at `:334` after L5.
Fix: bar only `row.isDuplicate && policy.duplicate === 'markDuplicate'` (`uploadSettle.ts:280`, and `:243`, `:329`, `:491`).

**M3 (low, shows at D2). A mass-edit row its batch load left out and whose file then failed is opened again by a
later metadata notification.** Today `queueItemFailed` drops the row from `metadataFailures` (DAM store `:576`), so
DAM store `:627-628` returns. `settleFailed` (`uploadSettle.ts:294-306`) cannot, and the gate of design 6.1 still
answers `'load'` at `uploadSettle.ts:493`: form on, error cleared by `afterMetadataLoaded`, status still Failed.
Fix in the DAM profile: `onRowFinal` deletes the key of a row that is Failed.

## TEST

- **T1** `uploadSettle.test.ts:350-362` (N-S7 "the original is read once for all the rows…") calls only
  `settleKnownDuplicate`, where a second read is impossible. The guard for a read (`uploadSettle.ts:531-537`,
  deviation 8) can be deleted with all tests green: LIB rows change their asset on success, DAM rows are bumped;
  only the LIB failure path would ask twice, and `uploadSettle.test.ts:364-385` counts no requests.
- **T2** `uploadSettle.test.ts:554-569` (N-S9 "a stopped row is written by nothing"): `settleProcessedByEvent` at
  `:562` runs under the LIB profile, where `settleOn !== 'event'` skips every row (`uploadSettle.ts:323`). No stopped
  row passes the DAM event block, `announceProcessed` (`uploadSettle.ts:341`) or `applySlotFiles` (`uploadSettlement.ts:246`).
- **T3** `uploadSettle.test.ts:146-167` (N-S4 "…gets the form back as the user left it") neither sets nor asserts a
  switch, so it passes over M1.

## PROPOSAL

1. `uploadSettle.ts:280-282`: keep today's outer guard, no load into a row whose form is on (LIB store `:254`); rows the existing tests seed with a form (LIB test `:135-157`, `:173-193`) otherwise get the server's switch at L5.
2. `uploadPoller.ts:149-153`: a mode change should not undercut a wait of the error ladder (it plans by the rhythm from a read that failed); reset `consecutiveFailures` when the queue goes idle (`uploadPoller.ts:88-92`).
3. `uploadSettlement.ts:228-236`, `:287`: catch per asset; a throw while one asset is written drops the rest of the tick and the notice/D7 loop (`:293-305`) and puts the queue on the ladder with no row warned.
4. `uploadSettlement.ts:349`: a metadata trigger merged into a file read is read 0-250 ms after its notification (3.10 and O1 allow it); as the metadata is latched once (`uploadSettle.ts:262`), keep "its notification + 2 s" as that target's earliest time.
5. Deviation 11 makes the connection subscription at the first `track()` (`uploadSettlement.ts:546`); the `watch` of design 5.5 then belongs to whatever effect scope is active there. Have 5.5 create it detached.

## The 16 deviations

1. ACCEPT - today's DAM returns on a duplicate before it looks at `metadataFailures` (DAM store `:623-628`).
2. ACCEPT - none of the three can be read; today's polls stop at `!item.assetId` too (`api/uploadApi.ts:110`, DAM `fileApi.ts:140`).
3. ACCEPT - follows 3.10; the open DAM detail then gets no `onAssetRead`, as today without a slot row.
4. ACCEPT - both stores drop a queue only where they replace it (LIB store `:594-605`, DAM store `:737-749`).
5. ACCEPT - O3 ends the tracking on this path anyway; the refresh of the row asks for the original again.
6. ACCEPT - R7 of 3.12; side effect: an asset read also resets a slot row's count of lists without its file.
7. ACCEPT - all three callers do it (`uploadSettlement.ts:290`, `:420`, `:445`); the LIB duplicate does its own (`uploadSettle.ts:456-457`).
8. ACCEPT - but nothing pins it for a read (T1).
9. ACCEPT - the same requests as 4.4, a fixed order of writes.
10. ACCEPT.
11. ACCEPT - with proposal 5.
12. ACCEPT - ends rows of one asset sharing a list (LIB store `:256-258`) and a non-object `customData` becoming the row's.
13. ACCEPT.
14. ACCEPT.
15. ACCEPT.
16. ACCEPT.

## Checked and found sound

- The constants are the plan's 3.2 table and design 4.1 (`uploadPollSchedule.ts:15-50`); `delayAfterRead` at the marks and the tier borders.
- Poller: `nextAt` has four writers (`uploadPoller.ts:97`, `:111`, `:124`, `:153`); each keeps 2 s after the end of the last read and none moves a plan later; `inFlight` covers the wait in the coordinator; ladder index `:94`; a stopped poller arms nothing (`:52`, `:83`); a visible queue that tracks nothing holds no timer.
- Coordinator (`uploadSettlement.ts:120-127`): one chain, `startedAt` taken at the turn. No rejection is left unhandled: `readNamed` `:421-425`, `readTargetNow` `:447-449`, `notify` `:512-514`, `settleKnownDuplicate` `uploadSettle.ts:480-484`, the poller `uploadPoller.ts:77-81`.
- Stale answers: every event write bumps (`uploadSettle.ts:313`, `:332`, `:375`, `:452`), every read write checks (`uploadSettle.ts:518`, `uploadSettlement.ts:246`); rows are looked up live and checked again after each await (`uploadSettle.ts:389`, `:517`, `:536`). The N-Z4 and N-Z5 paths hold.
- Named reads: the earlier time wins, 250 ms / 2 s, retries after 15 and 30 s, at most three failures and three misses, waiters always released (`uploadSettlement.ts:423-425`, `:600`). A row that left costs no request (`:386`); its timer ends when due.
- A row removed without `untrack` or a queue replaced without `dropQueue` (DAM `reset`): the timer fires once, finds nothing, and is not armed again (`uploadPoller.ts:61-64`).
- D5 (`uploadSettlement.ts:302`), D6 (`uploadSettle.ts:128-138`), D7 (`uploadSettle.ts:552-564`, `uploadSettlement.ts:134-137`, `:295`), R6 (`uploadSettle.ts:274`, `:326`), R7/O4 (`uploadSettle.ts:240-246`), O1 (`uploadSettlement.ts:72`, `:485`, `:494`, `:502`), O12 (`uploadSettlement.ts:403-414`) are coded as decided.
- `uploadSettlementTypes.ts` equals design 2.1-2.3.
- Tests: I followed the assertions of all three files through the code; apart from T1-T3 each fails for the reason it names. The read times of N-P4 are the plan's table.

## Could not verify

- Anything that needs a run: the 103 green tests, tsc and lint, and what I say existing tests do after L5 (M1, M2, proposal 1).
- Backend: that the bulk read answers the detail shape (`metadata`, `mainFile.fileAttributes`, `links`); that an asset can be read right after start, copy and import (D7 fails a row 16 s after it is tracked at the earliest); that the list of slots carries a file from its start, and a duplicate one; that a failed or duplicate main file stays the main file (the trigger of B1; the code path itself is certain).
- Wiring that is not written yet: `damNotificationsConnection.ts`, `toEvent`, both profiles (M3 rests on 6.1 as designed, proposal 5 on 5.5).
- After `dispose()` a read on its way that fails still arms its retry (`uploadSettlement.ts:365-367`) and a slot tick its follow-up (`:259`); the read is dropped at `:386`. Nothing calls `dispose` in production, so I did not count it.
- The default runtime (real timers, `document`) is read only, as the author says.
