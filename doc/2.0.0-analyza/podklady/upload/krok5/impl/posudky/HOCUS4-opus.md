# HOCUS4 review (Claude Opus): collaboration 7262b58, admin-cms 5da04120b

Method: read-only; installed sources in both node_modules; "before" versions (@hocuspocus/* 3.4.4 = "hp3", @sentry/* 10.70.0, adapter 0.2.3,
bullmq 5.81.3, dotenv 17.4.2) taken from ~/.yarn/berry/cache; Node internals from node v24.15.0. Nothing started. C = collaboration, A = admin-cms.

## High

**H1. Sentry 11 breaks winston-transport-sentry-node: the first warn/error log throws, after that all logging stalls.**
- `C/node_modules/winston-transport-sentry-node/dist/transport.js:64-65` calls `Sentry.getCurrentScope().clear()` for every record
  ≥ `warn` (`C/src/logger/appLogger.ts:100-103`). `Scope.clear()` is gone in 11 (MIGRATION.md:1539; `@sentry/core/build/cjs/scope.js` has
  no `clear`, 10.70 had it at scope.js:352; with 11.8.0 `typeof Sentry.getCurrentScope().clear` is `'undefined'`, checked). Nothing
  catches it: winston-transport `modern.js:82` → readable-stream `_stream_writable.js:385-392` (no try/catch) → winston `logger.js:336-339`.
- Scenario: the first `logger.warn/error` in prod, e.g. a `/ws` upgrade with a foreign Origin (`src/server/collaboration.ts:31`), a failed
  job (`src/bullmq/queue.ts:36`) or a process `warning` forwarded by @ladjs/graceful (`graceful/index.js:79-85`), throws `TypeError: scope.clear
  is not a function` at the call site. In `allowRequest` the callback never runs and the throw leaves the HTTP `upgrade` event as an uncaught
  exception (engine.io `build/server.js:153-162, 557-589, 676-679`, no try/catch); if the first such record is Graceful's own `logger.fatal`
  in its `uncaughtException` handler (index.js:111-114), Node exits with code 7. The transport stays `writing=true`, so every later record of
  any level (winston hands all levels to transports, `create-logger.js:71-83`) queues there; after 16 the pipe pauses the logger:
  node_server*.log go silent, no log reaches Sentry, buffers grow toward the 200 MB heap of `prod` (rate inferred, not measured). Unnoticed
  because the peer warning (`^8.13.0`) is filtered in `.yarnrc.yml:12`. Fix: own small TransportStream with `Sentry.withScope` +
  captureException/captureMessage, or `Sentry.createSentryWinstonTransport` (in 11.8; it sends Sentry Logs, not issues).

**H2. Rolling deploy with 3.4.4 and 4.7.1 pods together: edits made on new pods never reach old pods.**
- 4.x answers a peer's SyncStep1 only on the requester's private channel `${prefix}#reply:${id}` (`extension-redis/src/Redis.ts:289-291,
  744-756`) and puts only SyncStep1/awareness on the document channel (768-778, 535-537); 3.4.4 subscribes only to `${prefix}:${doc}` (hp3
  Redis.ts:197) and replies there (376-379). So v4→v3 content never arrives; v3→v4 only when the v4 pod publishes its own SyncStep1 (own
  change or load); v4's initial sync waits the full 1 s while v3 peers are subscribed (Redis.ts:383-394, 739-741).
- Scenario (ALLOW_MULTIPLE_COLLAB_SERVER_INSTANCES=true, RollingUpdate maxUnavailable 0, `docker/kubernetes/app-deployment.yaml:11-15`):
  editor A on an old pod, B on a new one; A does not see B's typing until A's pod dies, B sees A's only after B types; a save by A in that
  window sends A's editor JSON (`A/src/domains/cms/article/store/articleOneStore.ts:93-97`) without B's edits, and Mongo keeps whichever pod
  stored last (`storeDocument.ts:10-19`). Converges only when A reconnects to a v4 pod with its local Y.Doc. Mitigation: replace all pods at
  once for this release (Recreate / old ReplicaSet to 0 first) or deploy outside editing hours. Prod flag and replica values: not verified.

## Medium

**M1. redis-streams-adapter 0.3.1 sends fetchSockets/serverSideEmit over pub/sub channels with no env prefix and no version.**
- Default `channelPrefix: 'socket.io'` (`adapter.js:68-80`); FETCH_SOCKETS, SERVER_SIDE_EMIT, acked broadcasts go to `socket.io#/#`, answers
  to `socket.io#/#<uid>#`, server count = PUBSUB NUMSUB (adapter.js:123-128, 140-168, 226-228); 0.2.3 used only the stream (0.2.3
  adapter.js:75, 88-91). The app sets only `streamName` (`src/server/collaboration.ts:37`); the stream key gets the ioredis keyPrefix
  (`src/storage/redis.ts:12`, config.ts:82,89), channels do not (ioredis `getKeyIndexes` of publish/subscribe/pubsub is `[]`, checked), and
  pub/sub ignores Redis DB numbers. devel…devel4 read REDIS_HOST from one configmap in one namespace (app-deployment.yaml:50-59,
  azure-deploy-pipeline.yaml:105-106).
- Scenario: `onAuthenticate` (`authorizeDocument.ts:16`) and room info on devel also receive sockets of devel2…4 in a same-named room
  (ClusterAdapter filters only by namespace, socket.io-adapter `cluster-adapter.js:74-80, 123-146`) and wait for every pod of every
  environment; one slow or stopping pod anywhere → 5 s timeout (367-385) → Hocuspocus refuses the document. Prod: only if it shares the
  Redis server (not verified). Fix: pass a `channelPrefix` built from envPrefix and version.

**M2. `yarn dev`, `yarn watch` and the local docker supervisor (`docker/app/local/etc/supervisor/conf.d/node-server.conf`) no longer start.**
- `package.json:21` adds `--import` next to `-r ts-node/register`. Any `--import` routes the entry through the ESM loader (Node 24 `run_main`
  shouldUseESMLoader: `userImports.length > 0` → true); the `.ts` entry is type-stripped by Node and detected as ESM (`esm/get_format`:
  `${detectedFormat}-typescript`), ts-node's CJS hook is bypassed and `from './server/hocuspocus'` fails with ERR_MODULE_NOT_FOUND (read from
  Node v24.15.0 internals, not executed). Sentry is off for APP_DEPLOY_ENV=local (`src/index.ts:18`): drop `--import` from `dev`.

## Low
- L1 The 4.x server never pings (none in server/src; `ClientConnection.ts:193-214` closes after 60 s without an inbound message; 3.4.4 pinged
  every 30 s, hp3 ClientConnection.ts:124-132). admin-cms stays alive only through 15 s awareness renewals (JS timer); Chrome throttles timers
  of tabs hidden >5 min to ~1/min, so expect closes/reconnects of background editors (not verified in a browser).
- L2 Profiling inert: `profileLifecycle` defaults to `manual` (`profiling-node/build/cjs/index.js:137-138`), nothing starts the profiler;
  same in 10.70 (index.js:353).
- L3 Removing `sendDefaultPii: true` changes nothing: 10.70 mapped `true` to today's defaults (`defaultPiiToCollectionOptions.js:6` vs
  `resolveDataCollectionOptions.js:3-15`; frameContextLines 7→5, +queues). JWT cookies `anz_jp`/`anz_js` (`src/util/authorization.ts:16-22`)
  match no sensitive name (`filtering-snippets.js:4,27`) and go out in clear with request data (`requestdata.js:100,147`), but only HTTP
  `request` events are captured (`server-subscription.js:39`), not WS upgrades: small, pre-existing; `dataCollection.cookies: false` closes it.
- L4 Span streaming is the default (`sdk/index.js:179-188`); v11 supports self-hosted ≥ 26.4.2 (MIGRATION.md:26-28); version of
  sentrymonitor.smeonline.sk not verified (fallback `traceLifecycle: 'static'`). L5 dotenv 18 logs `◇ injected env (0) from .env` via
  console.error (`dist/index.cjs`; 17.4.2: console.log, lib/main.js:130-131); safe-stable-stringify 3 prints `[Circular: N]`.

## Answers
- **Q1** Covered: `requestHeaders: Headers` (types.ts:320-331), Cookie kept (crossws `new Headers(req.headers)`, hocuspocus-server.cjs:5662-5667);
  fetch keeps requestParameters (types.ts:545-554), store lost them (517-524), hook fixed; onRequest unchanged (572-576); readOnly/isAuthenticated
  honoured (ClientConnection.ts:531-563, 280; MessageReceiver.ts:234-283); `redis`/`prefix` unchanged (Redis.ts:57,76,210-212); Logger off in
  prod (index.ts:37); Redis-applied updates skip store (types.ts:40-50); timeout 30→60 s (Hocuspocus.ts:28). No server-side Y.Doc writers in
  src, so "store on every change" adds nothing; fetchDocument's upsert runs in onLoadDocument before `onUpdate` is attached
  (Hocuspocus.ts:419-451); a failed store keeps the doc, 4.7.1 has no timed retry (531-547). Pre-existing: two pods building the same new doc
  from JSON at once yield two Yjs histories that Redis merges into duplicated content (fetchDocument.ts:33-44). Gap: H2.
- **Q2** `--import` is the supported CJS path (`./preload` gone, MIGRATION.md:1652; injection registered before the app, server-runtime-injection
  register.js:138 or 151-156); a late `Sentry.init` subscribes to already injected modules (server-utils orchestrion/instrumentation.js:46):
  prod fine, dev broken (M2). 'Redis'/'Mongoose' still the names (integrations/redis/index.js:18, mongoose/index.js:12) and still needed:
  native `ioredis:command` spans need no parent (redis-dc-subscriber.js:33-64); Mongo/Mysql2 need one (mongodb/index.js:42,98;
  mysql2/index.js:43). PII L3, winston H1 (does not work), profiling L2.
- **Q3** commander 15: `"type": "module"`, engines ≥22.12, no top-level await (package.json:40,60-62): require(esm) works on the node24 image
  (both Dockerfiles line 1; minor not verified), only the validator uses it. npm-run-all2 9: engines `^24.15.0` (package.json:19-20), CI minor
  not verified. bullmq 5.81.3→5.81.5: `dist/cjs/scripts` and `commands` identical (diff -rq), safe next to old pods. Adapter: 0.2.3 and 0.3.1
  pods never see each other's sockets; as before when APP_VERSION differs (stream name), new for same-VERSION branch builds; plus M1.
- **Q4** Provider 4 vs server 3: Auth adds a version string (AuthenticationMessage.ts) that 3.4.4 ignores (hp3 ClientConnection.ts:325-327);
  provider only answers Ping (HocuspocusProviderWebsocket.ts:418-421); sessionAwareness false (HocuspocusProvider.ts:146); reconnect timeout
  30 s (…Websocket.ts:125). Server 4 vs provider 3: fine, keep-alive L1. `WebSocketStatus` values same; connected on open, untouched by
  `destroy()` in both (v4 214-216, 607-622; v3 203-205, 507+), so `ArticleBodyEditor.vue:205-210` behaves as before. Transformer removal
  safe: no reference in tracked files (git grep), @tiptap/starter-kit is a direct dependency (A/package.json:67).
- **Q5** Both on tiptap 3.32.0 (A/package.json:45-69), one copy each of @tiptap/core, pm, prosemirror-model, y-prosemirror, yjs in C: the bump
  removes the old 3.19-vs-3.32 drift; transformer 4 keeps `prosemirrorJSONToYDoc` (transformer/src/Prosemirror.ts). Equal on spot check:
  Table `variant`/`caption` (C/src/tiptap/nodes/Table.ts vs A table.ts:20-30); cms Heading adds only a shortcut. Not compared: Subscript
  (custom vs stock), Icon (cms: one site group), StyledBoxTitle `allowIcons`. Node.fromJSON drops unknown attrs, throws on unknown nodes.
- **Q6** H1 and M2 (outside the brief's list). Nothing else High.

## Verdict
Not ready: fix H1 before deploying, choose a deploy procedure for H2, add a channelPrefix (M1), repair `dev` (M2). The Hocuspocus 4 hook
migration itself is correct; the admin-cms commit is fine.
