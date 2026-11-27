# Optimalizácie – Opus (server bez štatistík), po meraní 2

## PART 1/3: ranked core optimizations (stats off)
Lines refer to petit/collaboration 66106b2 (next is 2–3 lines lower). "Hypothesis" = no A/B run exists.

1. Turn off socket.io permessage-deflate: src/server/collaboration.ts:28 (remove `perMessageDeflate: true`; engine.io's default is off).
   Rot profile, stats off: 16.7 s of 337.7 s in zlib `write` = 4.9 % of the core and 28 % of the main thread's busy time. b: 1.05 s. Every attributable sample sits under engine.io's ws. Hocuspocus never negotiates deflate, so STATS-PERF §5 ("ws Hocuspocus") and opt-codex #2 (hocuspocus.ts:46) target a server where it is already off.
   Gain: rot 1–5 points (4.9 upper bound), c probably more (≈5× rot's socket.io messages), b ~0.3; RSS lower (hypothesis). Risk: bigger frames for big payloads only. Size: 1 line.
2. Awareness fast path (Hocuspocus PR #1198, already known). b1-awarefinal: CPU 16.7 → 14.4 %, keystroke p99 11.5 → 7.4 ms, loop p99 −31 %, GC −26 %. Not shipped yet (hocuspocus-server.esm.js:202). If the release lags, `yarn patch` the PR build.
3. Pin the young generation: `--max-semi-space-size=64` in `prod` (package.json:28). Every run had a 64 MiB semi-space (new_space 128 MB); a 600 Mi pod gets 16 MiB. So both the heap-200 pathology and the heap-400 cure were measured on a GC configuration production does not run. Gain: hypothesis; makes M1/M2 hold for the pod. Risk: RSS as measured (~330 MB) instead of up to ~96 MiB less. Size: one flag.
4. Skip the cluster-wide membership lookup in the field listeners when the sending socket is already in the room: `!socket.rooms.has(room) && await hasNotUserId(…)` in acquireFieldLockListener.ts:41, releaseFieldLockListener.ts:47, changeFieldDataListener.ts:47 (inside the room lock). Drops ~360 of c's 435 PUBSUB NUMSUB/s; with several pods also one cross-pod FETCH_SOCKETS round trip per field operation. Gain: hypothesis (c +12 % CPU and d +17 % vs 1.14.1 attributed to this path, never isolated). Size: 3 lines.
5. Logging: `debug` a no-op unless enabled (appLogger.ts:31), configure the stringify once (:62). At info, rot allocates 373 MB/5 min under the logger and spends 2.2 s on it (0.65 % of the core). Gain ~0.7 point in rot at info. Size ~5 lines, output unchanged.
6. Room lock: keep 25 ± 25. The c regression (field change p99 9 → 24 ms) fits the generator's phase-locked 1 s cycles, not the server; check with jittered cycles. The lever in production is shorter lock holds (4 and 7).
7. One round trip instead of several under locks: storeAllData HSET→EXPIRE (roomDataManager.ts:67-68) inside every changeFieldData room lock; acquireLock's 7 sequential awaits (roomLockManager.ts:62-71). Hypothesis: gain depends on Redis RTT.
8. storeDocument.ts:10: findOneAndReplace → replaceOne, a store no longer downloads and hydrates the previous body. 0.3 s of 337 s here (5 kB bodies); grows with real bodies. Hypothesis.
Not worth it now: Sentry trimming, flushDelay:false, the Hocuspocus Redis relay (upstream only), a JWT key cache.

## PART 2/3: evidence and how to measure items 1, 3 and 4

1. Deflate
- engine.io passes {threshold: 1024} (engine.io/build/server.js:64-67); ws applies it only with server_no_context_takeover (ws/lib/sender.js:371-384). engine.io sends with compress:true (ws/lib/websocket.js:475) → every packet deflated, acks and pings included.
- Each socket keeps its DeflateRaw for life (permessage-deflate.js:406-457); each message = two threadpool jobs (write + Z_SYNC_FLUSH :430); at most 10 at a time per process (:24, :65-70) → broadcast fan-out queues.
- socket.io's once-per-broadcast frame (in-memory-adapter.js:167-185) is never used while perMessageDeflate is set (engine.io/build/transports/websocket.js:80-85).
- Profile rot off: 12.7 s under ws `_compress`, 4.2 s in zlib callbacks, nothing under crossws/@hocuspocus. Hocuspocus hands crossws only {maxPayload} (hocuspocus.ts:46 → hocuspocus-server.esm.js:1674-1675 → crossws node.mjs:20-24); ws's server default is off.
- 4.9 % is an upper bound (pinned core: `write` absorbs preemption; grew 16.9 → 20.7 s off→on while socket.io traffic fell 3 %).
- RSS (hypothesis): ≈ 300 KiB per socket that received a message (256 KiB deflate + 16 KiB buffer + ~40 KiB inflate).
- Risk: only big frames grow (startCollab answer with the body, room data on join). {threshold, serverNoContextTakeover} not worth it.
- Measure: next-heaplock-nodeflate variant; c, rot, b 3× alternating vs next-heaplock + one cpuProf rot; CPU, ack/broadcast p50/p99, RSS.

3. Young generation (Node 24.15, V8 13.6)
- Node sizes V8 from min(RAM, cgroup limit) (environment.cc:209-219); `--max-old-space-size` replaces only the old generation (heap.cc:4946-4990).
- 600 Mi pod: old gen 300 MiB ÷ 32 → 9.5 → 16 MiB semi-space (heap.cc:212-227, 4909-4937, 4983). WSL host (no cgroup limit, constrainedMemory 2^64): 64 MiB = the measured 128 MB new space.
- Heap 200 collapse in the runs: after a GC V8 caps the old-gen limit at (live + max)/2 (heap-controller.cc:140-153); marking starts once headroom ≤ nursery (heap.cc:2476, 5536) → nonstop marking once live old ≥ max − 2 × semi. Runs: 200 − 128 = 72 MiB vs 64–81 MiB live → 216–306 mark-compacts/5 min; at 400 threshold 272 MiB → 20–27. That's why the stats' +2 MB multiplied collections 1.8×.
- In the pod the threshold at 200 is 168 MiB → **production probably never had the pathology; the heap-400 gain need not appear there.** Instead the pod scavenges ~4× as often and promotes 0.5–2 s objects. Unmeasured, sign unknown.
- Risk of 64: RSS as measured; the pod also holds supervisord, nginx and a resident Yarn 4 process (node-server.conf runs `yarn run prod`). Keep max-old ≥ live + 2 × semi + margin.
- Measure: variants with `--max-semi-space-size=16` / `=64`; rot, b, d 3× alternating; gcByKind, GC %, CPU, loop p99, RSS. In a pod `node -p "process.constrainedMemory()"` should print 629145600.

4. Membership fast path
- Adapter 0.3.1: fetchSockets() sends PUBSUB NUMSUB on every call (cluster-adapter.js:367-403, redis-streams-adapter adapter.js:226-228); with N pods it then waits for N−1 answers; in changeFieldData inside the room lock.
- socket.rooms is the same in-memory answer as fetchSockets' local part → identical result when the sender is a member; otherwise the old path (another tab). admin-cms uses one socket per tab (common-admin collabState.ts:17).
- Evidence: c 435 NUMSUB/s, CPU +12 %, ack p99 +30–50 %; d CPU +17 %, cross-instance p99 31 vs 18 ms (COLLAB-PERF §1, §2.5); rot profile 0.71 s in fetchSockets (sync part).
- Measure: variant with the patch; c (NUMSUB/s, acks, CPU) and d (CPU both instances, cross-instance p99).

## PART 3/3: items 5–8, not worth it, verified

5. Logging: winston runs the whole format chain before the transports filter by level (winston/lib/winston/logger.js:337); level methods (create-logger.js:71-96) do no level check. Rot off at info: 373 MB of 8,536 MB under the wrapper — storeAllData "Storing data…" logs the whole data (90 MB), field-lock debug (58), "Emitting data change" (39), releaseFieldLock (34), getLock (25). At debug (today) only switching to info pays off: next b debug vs info loop p99 5.23 vs 3.47 ms, GC 0.72 vs 0.57 % (COLLAB-PERF b1prod-final vs b1-final); mongoose also stops printing whole documents (storage/mongodb.ts:14).
6. Room lock and c: with memoryless arrivals a shorter retry cannot raise the colliding share, yet m1-c-heap400 shows it (change p99 8.5–9.1 → 23.7–36 ms, inside the 0–49 ms window; max ~400 → 66–86 ms). Inferred: fieldCycle (generatorWorker.mjs:278-294) starts every 1 s from a fixed phase (every(), :324-336), ~765 ms long; a 200 ± 200 wait over ~235 ms re-phases the editor, a 0–49 ms wait never does → coinciding editors keep colliding every second. The rotation gain has the same kind of artifact: requestToJoin 197 → 31 ms is a localhost race (occupied answer inside the lock, joinCollabRoomListener.ts:91; release in finally, exectionLockHelper.ts:124-126; request ~0.1 ms later). A browser's RTT exceeds the release time → production sees less of both. Verify: ±10 % jitter per period in every(), m1-c-heap400 3× again.
7. Round trips: changeFieldData holds the room lock across acquire, HGET, NUMSUB, HSET, EXPIRE, release; item 4 removes NUMSUB, one multi()/Promise.all for HSET+EXPIRE (roomDataManager.ts:67-68) another. acquireLock awaits 7 commands in a row under the field lock (roomLockManager.ts:62-71) while the user waits (1 s client timeout): one MULTI. Local Redis (~0.1 ms) hides this; measure with ~1 ms netem on Redis.
8. replaceOne: findOneAndReplace returns the old document by default (mongoose/lib/query.js:3806) → every store downloads and hydrates the previous base64 body. replaceOne keeps upsert and updatedAt for the TTL index (setupTimestamps.js:83).

Not worth it: Sentry 11 (no variant beat the noise; only nodeProfilingIntegration() at index.ts:57 is dead weight, memory only); flushDelay:false (p50 −0.52, p99 −1.52 ms, CPU −0.27, n.s.); Hocuspocus Redis relay (rot one instance: flushPublish 537 MB/5 min, 1.74 s CPU for SyncStep1 publishes that come back to the same instance and are dropped, hocuspocus-redis.esm.js:28-29; with several pods every peer answers each change with encodeStateAsUpdate; upstream only: skip the publish while the channel has one subscriber, NUMSUB already asked at :158-165); JWT createPublicKey per verify 0.26 s of 337 s.

Verified: deflate owner (stacks), ws/engine.io paths, crossws options, Node/V8 sizing code and the 128 MB new space, winston order, NUMSUB per fetchSockets, mongoose defaults, per-run c figures (scripts krok5-praca/posudky-tmp/opt-core). Inferred: the pod's 16 MiB, the real deflate saving, the c artifact, RTT gains, Yarn RSS.
