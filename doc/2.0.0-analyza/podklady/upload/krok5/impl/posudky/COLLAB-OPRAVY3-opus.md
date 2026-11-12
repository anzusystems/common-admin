# COLLAB-OPRAVY3: overenie 4314471 (Claude Opus, len čítanie)

Uložené vedúcim zo správy recenzenta (dve časti). Verdikt: **safe to push, nothing High or Medium.**

## Earlier findings
1. RESOLVED – `$setOnInsert` + upsert, on no insert loads the stored doc (`fetchDocument.ts:71-87`).
2. RESOLVED – failed release only logged (`exectionLockHelper.ts:63-74, 104-106`).
3. RESOLVED – document lock released at 8 s (`:20-21, 91-98`). Note: COLLAB-OPRAVY3 wrongly says abort always releases at once; only at the cap (harmless).
4. RESOLVED – purge via shared helper, checks before notifications and kicks (`purgeRoomListener.ts:32, 39`).
5. RESOLVED – nit: exact range `^24.14.0 || >=25.4.0` (25.0–25.3 lack `#/`).
6. RESOLVED – local `stopwaitsecs=35`.
7. PARTLY – all 14 room actions get `signal`; gaps:
   - (a) join: `startCollaboration` waits ≤5 s for the moderator, then `storeAllData` unchecked (`roomUserManager.ts:270-275`); join's check comes after (`joinCollabRoomListener.ts:102`). Lost lock + purge → late write restores room data into the purged room.
   - (b) leave, moderator path: two more cross-pod calls (`roomUserManager.ts:146-147`), then field locks released unchecked (`leaveCollabRoomListener.ts:46-51`) → stale leave can release locks a new tab just took.
   - (c) signal aborted only from timers; after a long event-loop block an I/O continuation can pass `throwIfAborted()` first. Fix: also check `Date.now() < lock.expiration`. Without fencing no lease lock fully closes this.
   - (d) pre-existing: leaves started by `kickOtherUserSocketsIfInRoom` (`roomUserManager.ts:193`) not awaited in a successful join; `release()` never aborts the signal.
8. RESOLVED – 28 s race, step logged, `Sentry.close(1500)` (can take ~3 s: flush waits for processing then transport), worst ~31 s < 32 s backstop < 35 s stopwaitsecs; exit codes right.

## New findings (Low)
- L1. Aborted document build skips the write and throws if nothing stored (`fetchDocument.ts:71-85`): Mongo slow ≥8 s → permission-denied, provider does not retry (`ArticleBodyEditor.vue:185-187`), unsynced until reload; before this commit it would be stored. Fix: on abort still try `$setOnInsert` when nothing stored.
- L2. Flaky test `exectionLockHelper.test.ts:254-274` (~0.25 % runs; random retry jitter). Fix: start at 19 500 ms or stub `Math.random`.
- L3. Comment `exectionLockHelper.ts:16-19` inaccurate (unresponsive pod rejects at 5 s); cap itself fine.

## Q2 lease tuning
Extension ~488 ms after acquire; lease ends ~988 ms. Spurious loss needs ≥~0.5 s block/latency at the extension point (~10× measured 45 ms max) → Redis failover/reconnect, huge encodes, GC near 200 MB heap. User sees: join "Unexpected error"; leave resolves but room half-done; kick without kickedFromRoom; changeFieldData Failed (ignored by client, `collabAnyDataChange.ts:64-66`), change reaches others with the later lock release; moderation job dropped. Cost of holding the room for the whole action: concurrent actions retry only 10× (~2 s avg, ≤4 s) — e.g. changeFieldData during a slow kick now fails silently (before: fixed 1 s). 3 s lease would not help (tolerance comes from the extension lead), and a dead holder would block 3 s. Keep 1 s + add `Date.now() < lock.expiration`. 20 s cap fine.

## Q3 document cap vs waiters
Both build only after the holder passes 8 s or loses its lease; one result stored, both return it (except L1). Waiter never fails when the holder succeeded (holder releases ≤8 s / key expires ~9.4 s; waiter waits ≥9 s, ~11.3 s typical). Redis down: acquire hangs (pre-existing, `maxRetriesPerRequest: null`).

## Q4 shutdown — see 8.
## Q5 tests
`yarn test` needs no Redis (`test/support/lockRedis.ts` is an in-memory fake). Real old-code failures: join under lock, 12.8 s purge, lease-ran-out document, 28 s shutdown. Flaky only L2. Not covered: 7(a)–(c), L1.
## Q6 nothing High or Medium.
