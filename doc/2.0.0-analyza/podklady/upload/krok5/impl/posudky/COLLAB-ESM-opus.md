# COLLAB-ESM review (Claude Opus, adversarial): uncommitted diff of collaboration `next` on 7262b58

Read-only; C = `/home/volar/projects/petit/collaboration`. Old transport read from `~/.yarn/berry/cache/winston-transport-sentry-node-npm-
3.0.0-f017b03f01-10.zip` (`src/transport.ts`), adapter 0.2.3 from the scratchpad `pkgs/rsa-023`. Only one `@ioredis/commands` lookup was run.
Codex (`collab-esm-codex.md`) and the HOCUS4 reviews were read; their points are repeated only where I disagree or add to them.

## High
None found.

## Medium
**M1. A2 scopes membership by version, but room state stays env-scoped. During a rollout, the first join on a new pod wipes the room of
editors who are still on old pods.** Codex #1 found the auth split but not the purge.
- Channels are `${redisKeyPrefix}collab-${version}#/#` (C/src/server/collaboration.ts:38-44 → adapter.js:140-141). `serverCount()` is NUMSUB
  on that channel (adapter.js:226-228), so `fetchSockets()` (socket.io-adapter cluster-adapter.js:367-402) reaches only pods with the same
  env and version. 7262b58 pods listen on `socket.io#/#` (adapter.js:71). The room keys carry only the env prefix: `data:${room}`
  (roomDataManager.ts:13), `locks:/lockSockets:/lockTransfers:` (roomLockManager.ts:18-25), `${room}:moderator` (roomUserManager.ts:45),
  `${room}:options` (roomOptionsManager.ts:11).
- Scenario: RollingUpdate with maxUnavailable 0 (docker/kubernetes/app-deployment.yaml:11-15). A is moderator and holds field locks on
  an old pod. B opens the same article, and her join lands on a new pod. `fetchInfo()` lists nobody (joinCollabRoomListener.ts:73), so
  `purgeCollabStorage()` runs (77-78 → roomUserManager.ts:245-247) and deletes A's room data, locks, moderator and options. B becomes
  moderator (roomUserManager.ts:104-106). A goes on editing without locks and still thinks she is moderator; B starts from empty room data,
  and both can save. If B's socket.io socket is on an old pod, her Hocuspocus connection on a new pod is refused (authorizeDocument.ts:16-27).
  This lasts until the last old pod is gone.
- Calibration (Codex rates this High). Before 7262b58 the adapter was 0.2.3 (`git show 7262b58~1:package.json`, line 50). It sent requests
  and responses through the versioned stream (`rsa-023/package/dist/adapter.js:84-90`), so every version change already behaved this way;
  7262b58 hid it only by accident, through its global default channel. For 7262b58 → new it happens whatever APP_VERSION is. If the version
  does not change, old and new pods even share the stream: joins and broadcasts cross, membership queries do not. The deploy pipeline sets
  `VERSION = $(Build.SourceBranchName)` (azure-deploy-pipeline.yaml:88); whether GIT_VERSION follows it is not verified.
- Fix: replace all pods at once for this release, which HOCUS4 H2 requires anyway. For later releases, either keep that procedure or drop
  the version from the prefix (`${redisKeyPrefix}socket.io`), so membership stays visible across versions. Env isolation holds either way.

## Low
**L1. The test meant to cover A1's `level: 'warn'` proves nothing.** `test/logger.test.ts:73-77` runs with `LOG_LEVEL: 'warn'`
(vitest.config.mts:14 → appLogger.ts:94). winston-transport falls back to the logger level when the transport sets none
(`winston-transport/modern.js:78`). `sentryTransport.test.ts:10-11` calls `log()` directly and skips `_write`. So removing `level: 'warn'`
(appLogger.ts:100-102) keeps 50/50 green, while with `LOG_LEVEL` info or debug (docker/kubernetes/configuration.yaml:16) every record
would become a Sentry issue. The runtime filter is correct (verified). Fix: run this case with LOG_LEVEL=debug (stubEnv and resetModules).
**L2. The reason given for moving `tsx` into `dependencies` (COLLAB-ESM.md §4: "the validator can run in a pod") is wrong.** The k8s
image copies only dist, node_modules, package.json, yarn.lock and .yarnrc.yml (docker/app/kubernetes/Dockerfile:11-14), and
`command:article:validate` points at `src/…ts` (package.json:25). In a pod it fails with ERR_MODULE_NOT_FOUND, as it did with ts-node.
Nothing breaks; the dist build (`node dist/command/articleValidatorCommand.js`) is the one that would run there.
**L3. `SentryTransport.log` has no try/finally** (sentryTransport.ts:36-53). A synchronous throw from the Sentry API would skip
`callback()` and bring back the H1 stall: the transport stays `writing`, and after 16 records the logger pauses, console included. I found
no throw path in 11.8. Hardening only.
**L4. Thin real-time margin in the keepalive test.** Each round gives the pong 100 ms of real time (keepalive.test.ts:67-71). A later
pong makes the next sweep `terminate()` the socket (crossws `_chunks/node.mjs:89-95`), so the test fails with `[1006]`. Rare, on a
starved agent.

## Answers
**Q1 ESM.** Verified: `src` has no `require`, `__dirname`, `__filename`, `module.exports`, `import()` or JSON import (grep). Every import
is static, so the prod and dev starts that reached Mongo (`krok5-praca/collab-esm/start-*.log`) and the validator `--help` linked the whole
graph. Runtime uses of CJS default imports match the packages: `@ladjs/graceful/index.js:323` (so the cast at index.ts:15 is right),
ansi-colors index.js:183, cli-table lib/index.js:302, jsonwebtoken index.js:1, winston-transport modern.js:18. Type-only named imports
(MongoError, FieldPacket, Room, Job, Lock, ExtendedError, DisconnectReason) are elided. yjs, prosemirror-model, winston-transport and
triple-beam are installed once each. The CJS bundle of @hocuspocus/server inlines only crossws (`hocuspocus-server.cjs:1657-5626`), so the
module switch changes exactly crossws 0.4.4 → 0.4.15 (`esm.js:13`). The image has dist and package.json with `type: module`
(Dockerfile:11-14); supervisor runs `yarn run prod` (kubernetes node-server.conf:3); no bin or azure file calls node directly.
Sentry: `--import @sentry/node/import` registers the diagnostics-channel injection through `Module.registerHooks` before the app loads
(server-runtime-injection esm/register.js:121-124, `module.register` fallback at :136), and the late `Sentry.init` only subscribes.
start-prod-resolve.log shows ioredis and mongodb injected. The 'Redis' and 'Mongoose' names are unchanged (server-utils
integrations/redis/index.js:16, mongoose/index.js:10). Not verified: image build and run, the Node minor version in the image,
`sentry-cli sourcemaps inject` on the ESM dist (the implementer's check was not repeated), symbolication in Sentry.
**Q2 A1.** Compared with the old `transport.ts:61-116`, the level map, the tags/user/extras split, the first Error of the record or a
synthetic one, and `captureMessage` for warn are the same. `withScope` replaces the missing `clear()`, so nothing stays on the current
scope (the old code left the extras there). Dropped: the `end()` override that called `Sentry.flush()`; graceful calls `Sentry.close()`
instead (index.ts:56). The level comes from the uncolorized `Symbol.for('level')`, and `callback()` runs synchronously after
`withScope`. The level filter works (modern.js:78) but no test covers it (L1). Codex #2 (the original error is lost) is not a regression:
printf deletes `metadata.error` (appLogger.ts:77-83) before any transport sees it, the old one included. Tags and user never reach the top
level of a record either, as before.
**Q3 A2.** The naming is consistent. `@ioredis/commands` gives publish, subscribe and pubsub no key index (checked), while xadd, xread,
xrange and set are prefixed. Publish, both subscriptions, the response channel and NUMSUB all derive from the same `channelPrefix`
(adapter.js:140-141, 159, 165, 227). So pods with the same env and version talk, and a different `redisKeyPrefix` isolates them. Pub/sub
ignores Redis DB numbers, so isolation needs a distinct APP_ENV_PREFIX + REDIS_KEY_PREFIX per Redis server (values not verified).
Rolling deploy: M1.
**Q4.** A3 is complete for the JWT. With `cookies: false`, events lose `request.cookies` and the Cookie header (requestdata.js:22,
171-173, 187-190), and spans skip cookie and set-cookie (utils/request.js:163-165). `Authorization` is filtered by the `auth` snippet,
and no warn/error log call carries headers (grep). 11: `init()` can fail only before `gracefulShutdown.listen()` (index.ts:61), so
graceful never acts on that path. Hocuspocus signal handlers exist only after `listen()` (esm.js:1704-1711); a SIGTERM during the 2 s
close would exit 0 through them, which is harmless. Supervisor restarts the process (node-server.conf:5). A5: dotenv 18 honours `quiet`.
10 matches admin-cms (link.ts:251-259, 293-294; button.ts:70-71; styledBoxContent.ts:10), with no runtime effect: the cms JSON always
carries `external`.
**Q5.** The keepalive test does separate the builds. The CJS bundle never pings (`.cjs:5566-5626`); the ESM build sweeps and pings
every 30 s (node.mjs:26, 88-101), and Hocuspocus calls `touch()` on each pong (esm.js:1680-1682). Fake setInterval and Date drive both,
and the sockets are real; the implementer's 4408 failure on CJS fits the code. The integration test is real (port 0, a real provider, the
cookie taken from the upgrade request); only its read-only case uses an impossible fixture (Codex #3; in-memory-adapter.js:251-269). The
A2 test only checks the adapter options. Gaps: L1 and L4. The tests are also outside `tsc` (tsconfig includes only `src`), so `yarn ci`
does not type-check them.
**Q6.** Nothing else High or Medium.

## Verdict
The change does what it claims, and nothing is High. Fix the L1 test before merging. Settle M1 before deploying: replace all pods at once
for this release, then choose a version-scoped or env-only prefix.
