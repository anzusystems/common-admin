# COLLAB-OPRAVY4: overenie 8eaad75 (Claude Opus, len čítanie)

Uložené vedúcim zo správy recenzenta (dve časti). Verdikt: **nothing High; items 1–6 and 8 RESOLVED; item 7 brings M1 (Medium); L1–L3 Low.** Recommendation: add the M1 guard and its test before pushing, otherwise push and record M1 as accepted residual risk.

## Earlier findings
1. RESOLVED – check inside the startCollab ack before `storeAllData` (`roomUserManager.ts:288-293`); `joinUserSocket` after both `fetchInfo` (`:107,110`).
2. RESOLVED – `leaveCollabRoomListener.ts:43` before broadcast and lock releases (side effect L1).
3. RESOLVED – `exectionLockHelper.ts:25-33,75-79`; no `throwIfAborted` left outside the helper (L2).
4. RESOLVED – `joinCollabRoomListener.ts:108-120`; `left` promises never reject.
5. RESOLVED – one `multi()/exec()`, lock checked right before; EXECABORT/per-command errors throw.
6. RESOLVED – `fetchDocument.ts:72-95`.
7. RESOLVED as specified (40 retries) but see M1; an action with several slow waits (join up to 20 s) still outlasts ~8 s.
8. RESOLVED.

## Q1–Q2
No storage write follows a cross-pod wait without a check (all traced). Remaining: L3, and join's broadcast/Ok after awaiting the leaves (`:119→:127-132`) unchecked — negligible. Check stays correct across extensions (closure reads the reassigned `let lock`; WeakMap cycle collectable; `release()` sets expiration 0).

## M1 (Medium) – late changeFieldData overwrites a field's final value
Scenario: kick holds the room ~5 s (slow pod); editor picks 1 then 2 (two changeFieldData wait); tabs out → `releaseFieldLock(f,2)` stores and broadcasts 2 outside the room lock (`releaseFieldLockListener.ts:66-94`); after the kick the two changes acquire in random order (Redlock jitter, R:227), pass the check because f is unlocked (`changeFieldDataListener.ts:39`) → ~50 % last stored is 1; sender still sees 2 (broadcast skips sender), everyone else and Redis keep 1. Variant: another editor's later value overwritten every time. Before item 7, the changes gave up within 4 s.
Guard (server only, ~12 lines), new `src/util/helper/fieldWriteOrder.ts`: per socket+room+field monotonically increasing `order` taken synchronously on arrival; `mayStore()` called in the same tick as the HSET skips a write older than the latest stored. Use in `changeFieldDataListener` (skip → answer Ok) and `releaseFieldLockListener` (store data only if `mayStore()`, still release the lock). Relies on socket.io in-order handler dispatch and same-tick HSET on the shared client. Cost: one Map entry per socket+field (WeakMap), no Redis call. Limits: only orders one socket's writes (not two tabs); a change can still land over another user's value if the sender's lock was freed without its own release. Test: kick setup + second change + release; expect the release's value last.

## Low
- L1: a leave failing the new check leaves the user's field locks held (room already removed from `socket.data.collabRooms`, disconnect skips it; locks until the room empties or 24 h TTL). Fix: on failure take a new room lock and release this socket's locks, like the join cleanup (`joinCollabRoomListener.ts:172`).
- L2: stale read right after each extension (`extend()` zeroes the old lock's expiration before the helper reassigns `lock`) → false "lease ran out" (fail-safe). Fix: keep a `leaseEnd` number.
- L3: some actions write before their first check (join options `joinCollabRoomListener.ts:69`, cleanup leave deletes activity key). Fix: one check in `executeExtendedAction` right before `action()`.

## Q4–Q6
Q4: two concurrent builds cannot duplicate the body (unique `name`, one upsert inserts, the other reads); residual: a stale build inserted after `removeEditorsData` (consistent but stale; pre-existing). Unique index in the deployed DB not verified.
Q5: tests assert what they claim, no Redis/Mongo needed, nothing flaky found; M1 and L3 not covered.
Q6: nothing High; inference: 40-retry changes outlast 10-retry join/leave/disconnect waiters (the guard's early exit reduces this).
