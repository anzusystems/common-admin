# Posudok Opus: implementácia optimalizácií (A 1b9163b..b16bb39, B 66106b2..ddc01b6)

Zadanie: `krok5-praca/zadania/posudok-opt-impl-prompt.md`. Agent `posudok-opt-impl` (deep-reviewer), 24. 10. 2026. Text
agenta (doslova, poskladaný z troch správ, lebo prvá bola useknutá).

**Verdict: no blocking finding.** A (8 commits) and B (10 commits) do what OPTIMALIZACIE.md and HEAP-LOCK.md describe. I checked them against the dependencies installed in both repos, which have the same versions: socket.io 4.8.4, socket.io-adapter 2.5.8, redis-streams-adapter 0.3.1, redlock 1.4.0, ioredis 5.11.1, mongoose 9.11.2, winston 3.19.0, ws 8.22.0. I found no High or Medium finding. The residual risks below are all Low.

How I checked: I read the full diffs and the affected files, and ran three small measurements with Node 24.15 inside a 600 MiB cgroup (`systemd-run -p MemoryMax=629145600`). I wrote nothing to either repo; the merge simulation ran on extracted copies in my scratchpad.

**1. Heap 400 under a 600 Mi limit**
- **Measured:** `heap_size_limit` is 448 MiB with `--max-old-space-size=400` (semi-space 16, young generation 48), 248 MiB with 200, and 348 MiB with no flag. So V8's own default for this limit is 300 old.
- **Measured:** the Yarn 4.18 parent that supervisord keeps alive (`yarn run prod`, `node-server.conf:3`) holds about 74 MiB anonymous and 51 MiB file-backed memory in the same cgroup.
- **Before V8 collects?** No. V8 collects when the live set grows, not at the cap; measurement 3 (M3) shows 212 MB RSS at heap 400 with semi-space 16 (`STATS-PERF.md:506`).
- **Before V8 gives up?** Possibly, right at the end. 448 MiB of heap plus Yarn plus node's non-heap memory and buffers plus nginx/supervisord comes to about 600 Mi. So at roughly 350–400 MiB of live old space the kernel may kill the process first.
- **Worse than 200?** Not in when it happens: 200 aborts earlier, at about 200 MiB live (container about 400–450 Mi, derived). Only in how: a SIGKILL with no V8 heap report. On cgroup-v2 nodes with Kubernetes 1.28 or later, the whole container restarts rather than supervisord restarting node (I did not verify the cluster).
- If V8 must stay the component that fails: use a value of 350 or less (one value; effect on the M3 gain unmeasured).
- **Changelog:** `heap-room-lock-retry.md:6` ("no mark-compact every few seconds near the cap; RSS ~335 MB") comes from the semi-space-64 runs. M3 contradicts it (`STATS-PERF.md:514`: heap 200 with semi 16 does not collapse; RSS 212 MB). This is a text fix only.

**2. Room lock, 25 ± 25 ms with 80 or 320 retries**
- Redlock makes `retryCount+1` attempts, each waiting 0–49 ms (`build/index.js:215,225-228`).
- Mean give-up is 1,960 ms + 81 round trips, against 1,995 ms + 11 before: about +70 ms at 1 ms RTT, more under event-loop lag.
- That is still well under the client's 5 s join timeout (`common-admin collabRoom.ts:52`). The 2 s requestToJoin timeout (`collabRoom.ts:340`) still sits at the server's ~2 s give-up, as before.
- Unaffected, because they set their own settings: release (`exectionLockHelper.ts:40`, retryCount 0), extension (`:12`), field lock (`:176-180`), build lock (`:207`) and the failed-acquire cleanup.
- Every room caller uses either 80 or 320 (`changeFieldDataListener.ts:78`, `joinCollabRoomListener.ts:202`, `leaveCollabRoomListener.ts:94`). No caller relied on the old timing.
- Redis load: about 38 attempts per second per waiter instead of about 5. Only discrete widgets send changeFieldData (`collabAnyDataChange.ts:64`), so there are few waiters per room.
- A dead holder's 1 s lease now always expires inside the wait (about 7σ away; it failed about 0.3 % of the time before).

**3. perMessageDeflate removed**
- It is off unless passed (`engine.io server.js:39-52,64-68`).
- ws applies the 1e6 limit to the decompressed size (`receiver.js:438-452,542-561`), so nothing that passed before is refused now. nginx only tunnels the connection (`proxy.conf.template:37-41`).
- The only message whose wire size depended on it is the moderator's startCollab acknowledgement. It carries the whole body as JSON (`admin-cms articleEditCollab.ts:167`), is now sent raw, and has to arrive within `timeout(5000)` under the join's lock (`roomUserManager.ts:285`). It gets near 5 s only with a very large body over an uplink below 1 Mbps. Low.

**4. `socket.rooms` check before `hasNotUserId`**
- `socket.rooms` is the adapter's `sids` map (`socket.js:792-793`). Join, leave and leaveAll update both of the adapter's maps together (`in-memory-adapter.js:46-99`).
- The local part of `fetchSockets` is taken synchronously when it is called (`cluster-adapter.js:367-372`).
- A remote kick or purge arrives as a SOCKETS_LEAVE message applied to those same maps (`:329-347`); leave and disconnect are local. So for a socket of this instance the answer is identical at the same moment.
- Another socket of the same user still takes the old path (`acquireFieldLockListener.ts:38-50`, `releaseFieldLockListener.ts:44-56`, `changeFieldDataListener.ts:45`), and acquire still refuses it.
- One shift: the old acquire re-read `socket.rooms` after the cross-pod wait (1b9163b `acquireFieldLockListener.ts:50`). A remote kick landing within those milliseconds was refused; now it can get the field lock, which stays until the socket disconnects or the TTL expires. Field operations were never under the room lock, so this race already existed. Low.

**5. Logger**
- `isDebugEnabled` reads the logger and transport levels on every call (`winston logger.js:175-198`, `create-logger.js:98-99`), so a runtime level change would be followed; `src` never changes the level.
- JavaScript still evaluates the arguments; only winston's copy and format, including any getters, are skipped.
- With debug on, the same `appLogger.debug` call runs, so output is unchanged.
- The shared stringify keeps no state between calls (`safe-stable-stringify index.js:702-734`).

**6. `replaceOne`**
- It builds the replacement document the same way as `findOneAndReplace` (`query.js:4333-4355` vs `:3887-3893`).
- Both operations get the same timestamp hook (`setupTimestamps.js:9-12,81,83`), which sets `updatedAt` for replaces (`applyTimestampsToUpdate.js:28-38`), so the TTL index still works. Upsert is still passed.
- The return value was never used (`storeDocument.ts:11`). The only skipped step is the cast-error check (`query.js:3890`), which cannot trigger for two strings.

**7. MULTI in `storeAllData` and `acquireLock`**
- Errors from individual commands are checked (`roomDataManager.ts:65-68`, `roomLockManager.ts:65-78`). An error at queue time aborts EXEC and rejects.
- Command order is the same. The window between the HGET read and the write is unchanged, still under the field lock, and now takes 2 round trips instead of 7 inside its 1 s lease.
- On reconnect, ioredis aborts a partly answered transaction rather than resending EXEC alone (`event_handler.js:119-135,160-169`). There is no new way for two lockers to both win.

**8. Skipping the cleanup after Occupied with a moderator**
- The flag comes from the same fetch that decided Occupied (`joinCollabRoomListener.ts:90`), and that branch returns before any socket is kicked (`:108`).
- So the cleanup could only call `passOnAbsentModerator`, which returns false while a moderator socket is present (`roomUserManager.ts:228-239`). Skipping it takes one lock less, so nothing can be left locked.
- With no moderator socket, the cleanup still runs (`:153`). requestToJoin fails without a moderator (`requestToJoinListener.ts:39-46`), so the client's next join reaches the rescue path.

**9. B: `void recordMembership` and finalizer batches of 50**
- ioredis writes the script synchronously when the connection is ready (`Redis.js:356-413`). The stats client has no offline queue and no resend (`collabStatsRedis.ts:356-362`).
- So per-instance order is kept, nothing queues while Redis is down, and a stall leaves one command per event, as before.
- `recordMembership` cannot reject (`collabStatsSessionManager.ts:115-126`), so there are no unhandled rejections. The failure memory is cleared only if unchanged (`:122`), which is correct.
- Cross-instance ordering and the NOSCRIPT resend are the documented deviations and affect only the stats.
- Finalizer: it goes on only after a full batch (`collabStatsFinalizer.ts:432`). An open breaker or a failed write ends the run (`:435,:459`). At most 4 batches run (`:476-487`), so up to 200 per run.
- Committed batches are cleaned up (`:466-470`), and a retry skips them by their markers (`:220-230`): no loss and no double write.

**10. Port parity**
- I simulated the later three-way merge of `next` into the stats branch with `git merge-file` (base d211edd) for the 23 paths both branches changed.
- 21 merge to exactly B's content.
- Two conflict where B's side already contains both changes: B `changeFieldDataListener.ts:44-50` and B `joinCollabRoomListener.ts:94-100`. Resolve both with B's side, otherwise the stats reads and the 'occupied' record are lost.
- Apart from those, A and B differ only by stats lines that were already on the stats branch. Nothing is doubled or undone.

**Findings:** no blocking finding (no High or Medium). Optional Low items:
- **(a)** Changelog line 6 (`heap-room-lock-retry.md:6`): correct the text (1 line).
- **(b)** Heap 350 or less, if V8 rather than the kernel must be what fails: 1 value; needs one more rotation run to check the gain.
- **(c)** Merge: take B's side in the 2 hunks above.
