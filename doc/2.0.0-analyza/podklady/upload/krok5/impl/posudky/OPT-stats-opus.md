# Optimalizácie – Opus (cena štatistík), po meraní 2

## PART 1/2 — ranked proposals

Ranked (expected gain, backed by M2 numbers):
1. Membership Lua: send it under the lock, don't await its reply before the release (S) — closes rot join p99 +2.8 / leave p99 +16 ms.
2. (outside stats) No 2nd room lock after an `occupied` answer (S) — request p50 28.6 → ~3.8 ms in both; needed so 1 doesn't give back on's 3.8 ms.
3. d CPU +3.6: no code change, re-measure — it is +7.6 in the first 40 s of the window, +1.5 after (passes).
4. (hypothesis) recordFieldBase after the join answer (XS). 5. (hypothesis) bounded fan-out of flush/reconcile (S).
6. No action: Redis +230/s, allocations, finalizer, dashboard — measured cost ≈ 0 (PART 2).
Context: M2 rot stats cost CPU +0.08 pt, GC 0.48→0.47 %, loop p99 +0.08 ms; b passes whole.

1. Don't await the membership Lua — S
- What: `await recordMembership(...)` → `void recordMembership(...)` at joinCollabRoomListener.ts:96,143,194, leaveCollabRoomListener.ts:71,97, disconnectingListener.ts:37, kickUserFromRoomListener.ts:58, purgeRoomListener.ts:48, transferModerationListener.ts:37, moderationRequestProcessor.ts:31; comment collabStatsSessionManager.ts:106. ioredis writes the EVALSHA synchronously when ready (ioredis/built/Redis.js:406-418), so it still leaves under the lock and after the answer; only the ~RTT wait goes. Calls of one room may overlap → collabStatsSessionManager.ts:120 deletes only an unchanged failure (`failedRecords.get(room) === failedAt`, as collabStatsEditManager.ts:207). collabStatsRedis.test.ts:90-91 (≥500 ms held) flips.
- Mechanism: the room is released after Lua reply + release RTT; Lua caller wait p50/p95/p99 0.72/1.32/1.63 ms (STATS-B1 §7.4). An action arriving in that window waits one retry. In rot mostly the generator's back-to-back leaves (generatorWorker.mjs:681-682), ≤~230 of ~1 210 leaves/run.
- Data: one extra retry for ~1 % of leaves: p95 15.3→15.6, p99 20.6→36.6 (off 20.6/27.3/20.0, on 30.3/54.3/36.6). The gap follows the retry delay, not CPU: leave +125 ms at 200±200 → +16 at 25±25, join +13.5 → +2.8; CPU/GC/loop equal. Expected: join/leave p99 inside the off spread (derived). Under Redis latency the post-answer hold becomes 1 round trip instead of 2 (today + up to 500 ms, collabStatsRedis.ts:351-362).
- Risk: (a) same-instance events stay FIFO on the stats connection; across instances a reversal needs a delayed segment on the stats socket; then one session's presence is off until its next event or the 5-min check, not marked incomplete. (b) Reverses the B1 decision "awaited under the lock" → owner. (c) request p50 in on falls back 3.8 → ~28.6 ms unless 2 is done (or keep `await` only at :96).
- Measure: 66106b2 + batch50 + heaplock + this; set hl2-stats-rot 3× off/on; compareGates → join/leave p99 and request p50.

2. (outside stats) No second room lock after an `occupied` answer — S
- What: joinCollabRoomListener.ts:157 (next :149) runs the failed-join cleanup after every Occupied answer, though that attempt joined and replaced nothing; all it can do is passOnAbsentModerator (roomUserManager.ts:229-240: NUMSUB + GET + HGETALL). Skip it when the answer was Occupied and roomInfoServer.moderatorSocket existed.
- Mechanism (derived): Redlock's scripts share the main connection (exectionLockHelper.ts:38). Off: the cleanup's acquire lands ahead of the client's requestToJoin, which waits one retry. On: the awaited occupied Lua delays the release; the request wins, the cleanup retries. That is the "on is faster" asymmetry.
- Data: request p50/p90/p95 off 28.6/~49/~52 ms = 3.8 + U(0,49); on 3.6-3.9 / 11-18 / 34-37. Same without stats: next 197 → 31 ms (M1). Expected ~3.8 ms in both.
- Risk: the absent-moderator net stays where it can act. Production: a browser's request comes ≥1 network RTT after the ack → 1 and 2 mostly buy the gate, not user latency (hypothesis).
- Measure: same rot set; request p50.

## PART 2/2 — d CPU, hypotheses, no-action list, caveats

3. d CPU +3.6 points: re-measure, no code change (tool config)
- Data (results/heaplock/hl-stats-d/*/result.json timelines, CPU summed over both instances): window 36.5 → 40.1; first 40 s 36.0 → 43.6 (+7.6, off spread 2.0); rest 36.6 → 38.1 (+1.5, spread 3.2 → passes). First measurement same shape: +4.6 / +1.8. b: +0.9 / +0.2. Not the flush (no 5-s phase), not GC, not the liveness check. RSS +30 MB: V8 kept the 128 MB new space in on, shrank it to 64 MB in 5 of 6 off instances — heap sizing, not a leak.
- Proposal: d with warmupMs 60_000 (lib/scenarios.mjs:101-110) or b's 5-min window; if the steady +1.5 stays outside the spread, a d set with cpuProf on both servers. update p50 +0.81: check in the same runs. Cause of the transient: not found.

4. (hypothesis) recordFieldBase after the join's answer — XS. roomUserManager.ts:296-304 runs in the startCollab callback before storeAllData, i.e. before the answer of the join that starts a collaboration (≤200 fields/64 KB of envelopes + JSON + Lua args). Production bases maybe 0.1-0.5 ms. Call it once storeAllData resolved; risk none. Measure: rot with a ~20 KB base, join p95.
5. (hypothesis) bounded fan-out — S. Flush (collabStatsEditManager.ts:188-200) and reconcile (collabStatsFinalizer.ts:190-200) send all rooms' Lua at once; Redis runs them back to back (~94 µs per membership Lua) → hundreds of rooms per pod would stall the shared Redis 10-20 ms per flush. Invisible at 30 rooms. Groups of ~20, only if production has that many open articles per pod.

No action — measured cost ≈ 0:
- Redis +230/s in b = the flush Lua's inner commands + live/rooms HMGET 16.5/s; b CPU +0.13 (spread 0.65); rot +774/s with CPU +0.08.
- Allocations under stats frames 212 MB/5 min = 2.4 % of 8 684 MB; at heap 400 rot GC 0.48 → 0.47 %.
- Finalizer: writeBatch 0.16 s + finalize 0.05 s per 337 s; gate 5 recovery CPU on 20-29 % vs off 18-27 %.
- Dashboard: live/rooms p99 12.5 → 18.1 ms is its own 2nd pipeline; collaboration CPU equal in b at 2 req/s (core-cms polls every 10 s). readFieldBefore costs no round trip.

Caveats / cross-ref:
- heap-compare rows "winston +121.8 MB" / "appLogger.js +41.1 MB" are inlining: all logging allocations off 363.7 vs on 362.4 MB. Not a stats cost.
- Logging is the largest avoidable item in the same profiles, both variants: 2.2 s CPU per 337 s (3-4 % of busy), ~360 MB allocated, ~90 % from debug calls. winston formats every record before the transports filter the level. Guard appLogger.ts:31 with appLogger.isDebugEnabled() → gone at LOG_LEVEL=info.
- Production is 2 pods with browser clients: the tails of 1/2 come from sub-ms back-to-back client sequences on loopback (hypothesis).
