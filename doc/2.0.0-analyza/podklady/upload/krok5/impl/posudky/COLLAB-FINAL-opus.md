# COLLAB-FINAL: posudok c8d96a2..bb09e4e pred pushom (Claude Opus, len čítanie)

Uložené vedúcim zo správy recenzenta (dve časti). Rozsah: 4790c13, 61f483d, b03d20d, bb09e4e. C = /home/volar/projects/petit/collaboration, nm = C/node_modules.

## High
None found.

## Medium
None found.

## Low
**L1. A lost lease turns a stored build into a failed load (verified in source, not run).** `executeDocumentBuildAction` uses `redlock.using` (`C/src/util/helper/exectionLockHelper.ts:90-97`); its `finally` awaits a running extension, then `await context.lock.release()` unguarded (`nm/@sesamecare-oss/redlock/build/index.js:375-391`). Extension retries ~60× (9–15 s); release uses `retryCount: 0`. Scenario: first build > ~4.85 s and Redis loses the key or the event loop stalls ~150 ms at extension → extension fails, body already in Mongo (`fetchDocument.ts:69-78`), release returns 0, `ExecutionError` replaces the result → Hocuspocus sends permission-denied after authenticated; admin-cms does not retry (`ArticleBodyEditor.vue:185-187`) → empty, unsynced editor until reload; a second pod can build concurrently. Only a console line, nothing in Sentry; not covered by `test/exectionLockHelper.test.ts`. Fix: keep the action's result and swallow the release error, like `executeRoomManagementAction` (`exectionLockHelper.ts:38-46`).

**L2. Waiter gives up after 9–15 s; a stuck live holder can hold the lock indefinitely.** Waiting is bounded (`exectionLockHelper.ts:95`) but auto-extension has no limit (`index.js:344-364`). A hung Mongo op inside the build (socketTimeoutMS 0) keeps extending; every other pod's first load fails after 9–15 s like L1. Fix: cap (abort via signal after N s) or no extension with TTL > worst build.

**L3. `engines.node` `>=24` (`C/package.json:41-43`) but `#/` subpath imports need Node 24.14.0 / 25.4.0** (Node packages docs history). `yarn prod` on 24.0–24.13 fails with ERR_INVALID_MODULE_SPECIFIER; dev/vitest/tsc don't exercise Node's resolver for `#/`. Image is node 24.21.0 → prod fine. Fix: `>=24.14`.

**L4. Local docker supervisor still has default `stopwaitsecs` 10 s** (`docker/app/local/etc/supervisor/conf.d/node-server.conf`, replaces the k8s one via `docker/app/local/Dockerfile:13-14`). Shutdown can take 30 s; at 10 s supervisor kills only yarn, orphaned node keeps 3006/3007 → new `yarn run dev` EADDRINUSE. Dev only.

**L5. Purge fix is purge-only (pre-existing).** Other listeners keep the default 1000 ms room lock while doing cross-pod `fetchSockets` (5 s timeout): `kickUserFromRoomListener.ts:14-33` (up to 3 calls), `transferModerationListener.ts:13`, approve/reject listeners, `moderationRequestProcessor.ts:13`.

**L6. Already documented:** if the 30 s Graceful timeout fires, `exit(1)` before `Sentry.close` (`nm/@ladjs/graceful/index.js:267-281`); the event is lost.

## Answers
- Q1 aliases: no path lets prod load src or dev load dist; 36 `#/` specifiers in src/test all `.js` and exist; 159 `#/` imports in dist exist; `--conditions=development` changes no dependency (only socket.io-parser exports it, same build). Only gap L3.
- Q2 emit: no behaviour change; 6 classes, only NodeError/AnchorError declare fields (same result under define semantics); no tslib/helpers/decorators in dist.
- Q3 oxlint/oxfmt: CI still fails on lint/format errors (`run-s` fail-fast, rules "error"); template runs `yarn run build`/`test`. Nothing important lost.
- Q4 shutdown: fits 60 s (preStop 15 s sleep + supervisorctl stop + ~5–7 s; worst ≈ 52–57 s). supervisord → yarn (forwards SIGTERM) → node. Second signal/SIGQUIT correct. Minor: in dev a second Ctrl+C no longer kills.
- Q5 redlock: contention correct (waiter re-reads Mongo, w=majority, primary reads); holder death OK (5 s lease < 9–15 s give-up); Redis down → waits (as before); no deadlock; latency unchanged for stored docs. Commit message "never duplicate" overstates; code comment accurate.
- Q6: 403 listener correct and complete; 12 s purge lock covers 2 × 5 s + Redis (see L5).
- Q7: nothing else High/Medium.

Not verified: image build/run, supervisorctl/nginx timings, two-pod run, Azure CI.

Verdict: safe to push; cheap follow-ups L1 and L3; L2 and L4 worth a ticket.
