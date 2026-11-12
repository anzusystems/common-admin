# Posudok B2 – Opus (deep-reviewer), collaboration d7fe2f7, admin-cms 290185d11

## PART 1/2: verdict and Medium findings

VERDICT: B2 does what the owner asked:
- body edits come from onChange with the connection origin;
- a field edit is compared with the room's value, else with the baseline;
- the baseline lives only in stats:s:<sid>:base, never in data:<room> or the article;
- the L1 lock check is removed;
- edits go memory → one Lua per room on the stats client, with caps and `incomplete`;
- COLLAB_STATS_ENABLED=false turns B2 fully off.
Nothing is over-engineered. Two Medium problems: one breaks the hard constraint "nothing on the hot path waits on stats I/O", the other is a double count that the tests never run into.

M1 (Medium): the hot path waits on stats I/O before mayStore().
- Where: readFieldBefore (collabStatsEditManager.ts:261-272) does HGET data:<room> and, if that is null, then calls collabStatsFieldBase on the stats client, one after the other. It is awaited:
  - in changeFieldDataListener.ts:46, inside the room lock (:38), before mayStore (:58);
  - in releaseFieldLockListener.ts:87, before mayStore (:89), the store, the broadcast and the ack.
- When it happens: on every write of a field the room's data does not hold yet. That means the first write of each field, and every new dynamic name: comment:<uuid> through changeCollabAnyData, and embed:<uuid>, which is released with null (admin-cms extensionHelpers.ts:21-22).
- Normal cost: one extra stats round trip, under the room lock for a change.
- Degraded cost: up to 500 ms (collabStatsRedis.ts:352). The read can also queue behind a flush burst, because the flush sends every room's EVALSHA at once on the same connection (collabStatsEditManager.ts:174-186), or behind the finalizer's pipelines.
- Scenario: the stats connection is stuck, which is the case B1's 500 ms client was built for. Then:
  - each first edit of a field holds the room lock +500 ms, which delays the room's joins and leaves and the change's broadcast;
  - a release's store, broadcast and ack slip about 500 ms, against the client's 1 s ack timeout (common-admin collabField.ts:186).
- B1 awaits its stats call only after the answer; this read comes before it.
- It is avoidable: these handlers never write :base. Only the HGET of data:<room> (owner decision 4) has to come before the HSET. The base can be read after the answer, without waiting, when that HGET returned null.

M2 (Medium, counting): a change and a release of one value, sent back to back by one socket, count as 2 edits.
- Cause: deviation 8.1 (STATS-B2.md:222-224).
  - The release reads the field at releaseFieldLockListener.ts:69, right after hasNotUserId.
  - The change from the same socket must first take the room lock (Redlock), do its HGET and its own fetchSockets before its HSET (changeFieldDataListener.ts:38-62).
  - So the release reads the old value. Both then store, because fieldWriteOrder lets the later release store (:89). Both compare with the old value (:114 and changeFieldDataListener.ts:78).
  - The design reads after releaseLock (COLLAB-STATS.md:1307). With that order the release would very likely see the change's value.
- Real flows:
  - Alternate links, Apply then save. After Apply the lock stays held (ArticleWidgetRedirect.vue:212-220). The save replaces the array with the response (articleEditActions.ts:394-396). The saveTick watcher then sends changeFieldData and releaseFieldLock with it at once (ArticleWidgetRedirect.vue:255-265). Result: fieldEdits 2 and alternateLinks n=2 for one edit.
  - The articlePreviewExpires picker (ArticleWidgetPublicPreview.vue:181-189) sends the change, then the release one tick later (common-admin AFormDatetimePicker.vue:95-101, 149-153).
- Two claims in STATS-B2 are wrong for these flows: §1.1 ("Select ... 1 úprava", line 60) and §9 (alternateLinks echo counted once, lines 263-264).
- The tests that "prove" one edit wait for the change's ack before they send the release: collabStatsEditEvents.test.ts:172-179, collabStatsEdits.test.ts:192-193, integracia.mjs:275-277. The real interleaving is never run.
- Impact: only fieldEdits and fieldsChanged. `edited` and the category stay right.
- Fix: skip a value equal to the last one this socket stored for the field (fieldWriteOrder already keeps per-socket, per-field state), or at least read after releaseLock as designed.

## PART 2/2: Low findings, answers, not verified

L1 (Low): the start's baseline handling has no guard and no cap.
- Where it runs: roomUserManager.ts:296-297 calls separate/recordFieldBase synchronously inside the socket.io ack callback. socket.io calls that callback from process.nextTick, outside its try/catch (node_modules/socket.io/dist/client.js:213-215).
- The throw: recordFieldBase spreads all field/value pairs as the arguments of one call (collabStatsEditManager.ts:247-253). About 65,000 base fields fit in the 1 MB packet and give 130,000+ arguments. Node then throws RangeError synchronously. Checked: 130,000 spread arguments throw RangeError on Node 24.
- Consequence: storeAllData, resolve and reject never run; the join awaiting startCollaboration (joinCollabRoomListener.ts:102) never finishes, the room lock is held until the 20 s cap (exectionLockHelper.ts:116-119), and endJoining (:31) never runs; the process stays up (graceful/index.js:111-114).
- Trigger: a crafted answer from a moderator's client. Before B2 nothing in that callback could throw.
- No cap on the number or size of base fields; Lua does one HSET per field (collabStatsRedis.ts:326-328).
- Fix: try/catch, pass the pairs as one array, cap the field count and bytes.

L2 (Low): field names from the client reach the flush Lua unchecked.
- A name that is not a string or has a lone surrogate (\ud800): once counted (recordEdit :122-133), redis.call (collabStatsRedis.ts:297-300) or cjson.decode (:263) raises an error.
- That room's flush fails every 5 s, everyone's edits in the room are lost and the session is marked incomplete. One room member can wipe a room's edit stats.
- Fix: String(field), drop names that are not well-formed.

L3 (Low):
- A save echo COLLAB_STATS_SYSTEM_FIELDS does not cover: multiTitleBoxItemsOverride {ids:[], ts: Date.now()} is sent on save and on autosave (articleEditActions.ts:448, :723). The ts always differs, so it counts as a field edit of whoever saved.
- The baseline adds a few KB to the startCollab ack, which shares the 1e6 B limit with the body (hocuspocus.ts:14-17).

Answers (verified unless marked):
- Q1: intent and B2 decisions met; not over-engineered.
- Q2: body hook never rejects (collabStatsExtension.ts:14-24), not awaited (Hocuspocus.ts:309). Lock and request counters memory only. No await between mayStore and HSET (roomDataManager.ts:50-67, order test). Main-client HGET alongside getLock. Off switch complete (hocuspocus.ts:35-37, index.ts:66-71, :131, counted() false, no stats client created). Only hot-path issue M1.
- Q3: Hocuspocus 4.7.1: Update and SyncStep2 carry the connection origin (MessageReceiver.ts:258-291), relay the redis origin (extension-redis Redis.ts:145-147), onUpdate only on change. Integration with socket.io and body on different pods: 4 edits, not 8. Rejoin gets no baseline. Problems: M2, L3.
- Q4: flush swaps the map before I/O (:166-169), one at a time (:206-214), never resends; failure → incomplete (:188-196, Lua :260-262); caps hold; shutdown flush after servers close, before Redis disconnects; memory bounded; no double count in the flush. Flush burst shares the connection with B1's membership calls under the room lock: a few ms at today's scale.
- Q5: only the moderator's admin-cms sends the baseline; server strips the key even with stats off; TTL 7 d renewed by membership (Lua :232), deleted with the session (collabStatsFinalizer.ts:101); never reaches Mongo or live/rooms. Risks: L1, L3.
- Q6: real-Lua vs TS-mirror parity covers flush, base and fieldBase but only with REDIS_TEST_URL. Untested: change + release back to back (M2), field-write latency with a stuck stats connection (M1), synchronous throw at start (L1), bad field names (L2). Nothing flaky seen.

Not verified: perf gate (10.13/4), Mongo-down gate (10.13/5), a CI run with REDIS_TEST_URL, whether the real TipTap/y-prosemirror client writes into the Y.Doc when it renders a synced body (e.g. TrailingNode appendTransaction, admin-cms anzutap/extensions/trailingNode.ts) — tests use bare Y.Docs, a spurious body edit on each load would go unnoticed.
