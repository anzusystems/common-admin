# COLLAB-OPRAVY review (Claude Opus, adversarial): fix cycle on collaboration `next` (7262b58 + working tree)

Read-only, nothing run. C = /home/volar/projects/petit/collaboration, nm = C/node_modules. Cycle isolated by `diff -ruN` of
`krok5-praca/collab-opravy/zaloha-rozbalena` against the tree (= `zmeny-src.diff`). Read in nm: @hocuspocus 4.7.1 (server, database, redis,
provider), crossws 0.4.15, ws 8.22, @ladjs/graceful 5.0.0, socket.io 4.8 with its cluster and redis-streams adapters, yjs 13.6.33,
y-prosemirror 1.3.7, @sentry/core. All claims come from those sources unless marked "inferred" or "not verified".

## High
None found.

## Medium
**M1. Pre-existing, in H5's shutdown and untouched by it: the room cleanup runs on a closed adapter and tells the other replica the room is
empty.** `io.close()` fires each socket's async `disconnecting` handler unawaited, then closes the adapter (nm/socket.io/dist/index.js:511-516,
socket.js:532-536), which disconnects its subscriber (redis-streams-adapter/dist/adapter.js:96-98,103-107): NUMSUB stops counting this pod
(:226-227) and `fetchSockets()` returns local sockets only, none by then (socket.io-adapter/dist/cluster-adapter.js:367-376).
disconnectingListener.ts:18-36 then releases all the user's locks, deletes `${room}:moderator` because the room looks empty
(roomUserManager.ts:131-146) and broadcasts `{users: [], moderator: null, status: inactive}`, still sent by XADD (cluster-adapter.js:242-249,
adapter.js:153-162). Scenario, 2 replicas: moderator A on pod B, editor U on pod A, pod A stops (scale-down, eviction, same-version rollout).
A's client stores the empty room (common-admin collabInit.ts:72-76); U's rejoin on B finds A without a moderator, deletes the editor
documents, skips `startCollaboration` (joinCollabRoomListener.ts:95-101) and makes U moderator (roomUserManager.ts:104-106), so a body
unloaded meanwhile is rebuilt from the room data last gathered, not from A's text. With 3+ replicas the request is never answered (aborted
stream): 5 s timeout (cluster-adapter.js:20) inside the 5 s room lease, rejoins elsewhere wait or fail. Redis command order against the
disconnect and the admin-cms reaction: inferred, not run. Fix: run this cleanup before `io.close()` (disconnect the sockets, await their
handlers), or skip it for reason `server shutting down` and leave it to the rejoin.

**M2. X1 is still no authorization (pre-existing, acknowledged in COLLAB-OPRAVY.md:77-79).** `subscribeCollabRoomInfo` joins `${room}:info`
unchecked (subscribeCollabRoomInfoListener.ts:15); the server reads only `sub` from the JWT (authorization.ts:22-24). Any CMS user can emit
`subscribeCollabRoomInfo(r)` and `purgeRoom(r)` from the admin origin: every editor of r is kicked, its data, locks, moderator and options go.

## Low
**L1. H6 refuses without an `error` listener on the raw socket** (onUpgradeHook.ts:15-20). ws adds one before any upgrade work
(nm/ws/lib/websocket-server.js:244-245) and its README in the `upgrade` handler (nm/ws/README.md:306-317), node leaving that socket without
one (inferred). A client resetting during the 403 then throws: `fatal` + Sentry event after `gracefulShutdown.listen()` (graceful
index.js:111-114), a crash before it (index.ts:44 vs :73). Fix: `socket.on('error', () => socket.destroy())` first.
**L2. Signals.** Graceful listens `once` on SIGTERM/SIGHUP/SIGINT only (graceful index.js:129-133); Hocuspocus's persistent
SIGINT/SIGQUIT/SIGTERM handlers are gone (esm.js:1704-1711, hocuspocus.ts:39); no other SIGTERM listener in the runtime deps (Sentry's only
under VERCEL, @sentry/node/build/esm/sdk/index.js:115-117). A second SIGTERM mid-shutdown now kills node with stores in flight (before, it
awaited `destroy()`); SIGQUIT kills with no shutdown at all. Whether anything sends two (`pre-stop-container`, app-deployment.yaml:31-34,
lives in the base image): not verified; yarn 4.18 forwards one SIGTERM to its child (local corepack copy, not the image).
**L3. Sentry is neither last nor bounded.** Redis and Mongo close after it (graceful index.js:298-303), so their errors are lost;
`Sentry.close()` without a timeout waits for every send (nm/@sentry/core/build/esm/client.js:268-282) and now starts after `destroy()`; a
hanging destroy (Mongo down) runs into Graceful's 5 s (index.js:20,267-281; not set in index.ts:56-71) and exits 1 with nothing flushed.
`sentryCloseTimeout` (index.ts:17) serves only the init path.
**L4. H2 needs APP_VERSION to change with every change of cmsArticleBodyExtensions or y-prosemirror.** The ID hashes version + JSON
(fetchDocument.ts:25): two same-version pods with different schemas building at once give one ID to different items, which Yjs then keeps
diverged without error. APP_VERSION = `$(GitVar.shortVersion)` (Dockerfile:6-7, template-docker-build.yaml:43), defined outside: not verified.
**L5. X1 can now fail silently.** Default 1000 ms lease and retries of "~0-4000 ms" (exectionLockHelper.ts:22-34) against a moderated join
holding the lock up to ~10 s (joinCollabRoomListener.ts:98,126); the purge has no acknowledgement (common-admin collabRoom.ts:402-405), so a
super admin's click meanwhile only logs an error.

## Answers
**Q1.** R2 ✓: printf formats a copy (appLogger.ts:69-88), console output unchanged; the transport takes a top-level Error, else
`metadata.error` (sentryTransport.ts:49-51); extras now also carry `metadata.error`/`context`. R4 ✓ (red without `level: 'warn'`,
overenie-bez-level.log:44). R5 ✓ (:37-59). R6 ✓. R8 ✓: the CI job runs `yarn run build`, then `yarn run test` (template-yarn.yaml:106-142);
build → lint → `yarn ci`, now with `tsc -p test` (package.json:9,13,20); JUnit only under TF_BUILD (vitest.config.mts:39-40). Not verified:
TF_BUILD inside the container job, the coverage task without a cobertura file (template-yarn.yaml:143-153).
X1 callers verified: common-admin collabRoom.ts:402-405 ← ACollabManagement.vue:245-247,448-462; admin-cms ArticleTopbar.vue:109
(`isSuperAdmin`), BoxBuffer.vue:542-549, BoxTimeline.vue:619-624 → boxCollabRoom.ts:174-176. The detail subscribes the info room on mount and
reconnect (ArticleDetailView.vue:128-143), edit and boxes join the room (articleEditCollab.ts:126-130, boxCollabRoom.ts:196-213): the check
passes on every UI path, and the purge cannot delete its own lease (roomLockManager.ts:272-273). Gaps: M2, L5. X2 ✓
(joinCollabRoomListener.ts:77-81); the first join of an `allowedSameUser` room now answers `active`, like every later one.
H2 ✓ per case. Same version and JSON: byte-identical update (y-prosemirror lib.js:280-320, utils.js:20), Yjs skips known IDs. Other JSON:
other ID, duplication as before, no corruption. Later client edits reference identical items. A client on the same ID: IDs are
random.uint32 (yjs Doc.js:23) and Yjs renews its own when a remote update writes under it (Transaction.js:361). GC: deletions travel in the
delete set, GC'd ranges are skipped by clock. Mongo wins over JSON (fetchDocument.ts:37-42); old random-ID documents untouched; old-code and
new-code pods still duplicate. Gain: a rebuild of the same JSON while a client keeps the earlier build now merges. Risk: L4.
H3 ✓ (extension-database esm.js:28-33). H4 ✓: shutdown and the last disconnect run pending stores at once (esm.js:1362-1367,1754,1396-1400);
only fetch, store and removeEditorsData touch the Mongo documents.
H5: order ✓: the six handlers start together, the first five register before the sixth runs (graceful index.js:240-246, index.ts:50-68);
Redis and Mongo after them (:284-303). Timeouts: L3; destroy takes ≥1 s with open documents (redis esm.js:341-347). Double signals: L2.
Clients: socket.io sockets get `server shutting down` and reconnect; Hocuspocus sends CLOSE (esm.js:421-429,1371-1378), the provider drops
auth and sync (provider esm.js:466-474,902-911), its socket stays open until exit, then reconnects; a reconnect that beats the socket.io
rejoin is refused (authorizeDocument.ts:16-27), as before. The other replica sees M1.
H6 ✓: no legitimate client refused: core-cms posts HTTP (AnzuCollaborationClient.php:42,83, i.e. onRequest), probes are TCP and nginx HTTP
(app-deployment.yaml:76-93), nginx passes Origin (proxy.conf.template:22-48), socket.io refuses the same origins (collaboration.ts:28-35) and
Hocuspocus auth needs a socket.io socket in the room. Bypass: a loose COLLABORATION_SERVER_CORS (production value not in the repo;
`.env.dist:11` has unescaped dots, `http://evilsme.localhost` passes) or an XSS on an allowed origin. Each refusal is a Sentry warning with
the origin, as socket.io's (collaboration.ts:32). maxPayload reaches ws (crossws node.mjs:20-24). 10 MiB: a body enters through the
startCollab ack under maxHttpBufferSize 1e6 (engine.io server.js:44, roomUserManager.ts:261-275), ~9x headroom; real sizes not verified.
**Q2.** Per the implementer's run on the pre-fix src (overenie-stary-kod.log:8-103), consistent with the code: every new case fails there
except the test-only R3/R4/R6 changes, "upgrades a request from an allowed origin" and the two H2 ID cases (document.test.ts:90-114), which
random IDs pass too (they guard the hash inputs only). index.test.ts drives the real Graceful; only its Sentry assert fails on the old code.
Untested: maxDebounce, the two-pod Redis path (script only), L1, L2.
**Q3.** M1 and M2, both pre-existing; nothing else High or Medium in the diff. The ESM work still holds (crossws merges the ws options).

## Verdict
The fixes do what they claim; nothing High. Cheap before merge: L1 and L3 (`Sentry.close(sentryCloseTimeout)`). Before relying on graceful
stops with 2 replicas, fix M1; M2 stays the owner's decision.
