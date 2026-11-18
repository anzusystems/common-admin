# HOCUS4: verification of the open points A (redis-streams-adapter), B (keepalive), C (Sentry cookies)

Scope: collaboration `next` 7262b58 (C = `/home/volar/projects/petit/collaboration`), admin-cms (A = `/home/volar/projects/petit/admin-cms`),
common-admin (CA = this repo). The old versions were unpacked with `npm pack` into the session scratchpad
(PK = `/tmp/claude-1000/-home-volar-projects-anzusystems-common-admin/2cf91bcd-ff9f-4776-a8b6-8682baecf8fb/scratchpad/pkgs`, which is gone
after a WSL restart): `rsa-023` (@socket.io/redis-streams-adapter 0.2.3), `hp-server-344`, `hp-provider-344`, `sentry-core-1070`,
`sentry-node-1070`, `sentry-node-core-1070`. Nothing was run except `node -e` calls into the installed Sentry 11.8 and @ioredis/commands
modules, and `require.resolve`.

## Verdicts

| | Claim | Verdict |
|---|---|---|
| A | 0.3.1 sends request/response traffic over Redis pub/sub with no env prefix, so environments on one Redis see each other's sockets, and one slow pod anywhere makes `onAuthenticate` time out after 5 s | **CONFIRMED.** New with 0.3.x. Fix: `channelPrefix`. |
| B | The Hocuspocus 4 server no longer pings at WebSocket level, so editors in background Chrome tabs may get disconnected | **CONFIRMED for this build.** The reason is new: the CJS bundle inlines crossws 0.4.4, which has no heartbeat. Disconnects are possible but occasional. Nothing is lost. |
| C | `anz_jp`/`anz_js` can reach Sentry with the v11 defaults | **CONFIRMED, narrow.** Only through plain HTTP requests, never through the WebSocket upgrades that browsers actually use. Not a regression: 10.70 with `sendDefaultPii: true` sent the same, with less filtering. Fix: `dataCollection: { cookies: false }`. |

## A. @socket.io/redis-streams-adapter 0.3.1

**(1) True in 0.3.1, and how the server creates the adapter.** `C/src/server/collaboration.ts:36-38` calls
`createAdapter(redisClient.duplicate(), { streamName: \`collab-${version}\` })` and passes no other option (`version` = `APP_VERSION`,
`C/src/config/config.ts:81`). The ioredis client has `keyPrefix: redisKeyPrefix` = `APP_ENV_PREFIX + REDIS_KEY_PREFIX`
(`C/src/storage/redis.ts:12`, `C/src/config/config.ts:82,89`).
- ioredis prefixes only command arguments that are keys. Checked with the installed `@ioredis/commands` 1.11.0 `getKeyIndexes`:
  `XADD`, `XREAD … STREAMS`, `XRANGE` and `SET` each have a key index, while `PUBLISH`, `SUBSCRIBE` and `PUBSUB NUMSUB` have none (`[]`).
  The code is at `C/node_modules/ioredis/built/Command.js:48-66, 301-316`. So the **stream** is env-scoped and version-scoped
  (`<env><prefix>collab-<version>`), but **pub/sub channels are not**.
- Adapter 0.3.1 (`C/node_modules/@socket.io/redis-streams-adapter/dist/adapter.js`): the defaults include `channelPrefix: "socket.io"` (68-80).
  `isEphemeral` (123-128) covers FETCH_SOCKETS, SERVER_SIDE_EMIT and every BROADCAST with an ack. These go out by `PUBLISH` to
  `socket.io#/#` (154-160). Every response goes to `socket.io#/#<requesterUid>#` (164-168). Each pod subscribes to both channels
  (140-152). `serverCount()` is `PUBSUB NUMSUB socket.io#/#` (226-228). The class is now a plain `ClusterAdapter` with no heartbeat (129).
- Redis docs, "Database & Scoping" (redis.io/docs/latest/develop/pubsub): *"Pub/Sub has no relation to the key space … including
  database numbers. Publishing on db 10, will be heard by a subscriber on db 1. If you need scoping … prefix the channels with the name of
  the environment."* So separate `REDIS_DB` values do not help either.
- What follows (`C/node_modules/socket.io-adapter/dist/cluster-adapter.js`): `fetchSockets` waits for `serverCount - 1` responses (367-373).
  That count includes **every** pod on that Redis server that runs ALLOW_MULTIPLE_COLLAB_SERVER_INSTANCES=true, whatever its env or
  version. Every one of them answers with its own local sockets in a room of the same name (123-140). Room names have no env component:
  `cms:article:<id>` (`CA/src/domains/collab/composables/collabHelpers.ts:12-14`). So `authorizeDocument` (`C/src/server/document/authorizeDocument.ts:16-17`)
  and `fetchInfo`, `hasUserId`, `getUserIds` (`C/src/manager/roomUserManager.ts:51, 203-235`) count sockets from the other environments,
  wherever user and article IDs overlap. Each response also carries the other socket's `handshake`, including its Cookie header
  (cluster-adapter.js:126-136).
- The same applies to `startCollaboration`: `.to(socketId).timeout(5000).emit(…, ack)` (`C/src/manager/roomUserManager.ts:261-264`) is an acked
  broadcast. It waits for a client-count answer from every server in `serverCount()` (`C/node_modules/socket.io/dist/broadcast-operator.js:182-231`).
- APP_ENV_PREFIX exists so that "several environments can run against one Redis database", and it was applied to "the Socket.IO stream"
  and to "the Hocuspocus Redis pub/sub channels" (`C/doc/Collaboration-Changelog/1.14.0.md:9`; Hocuspocus does
  `prefix: \`${envPrefix}hocuspocus\``, `C/src/server/hocuspocus.ts:23`). The adapter channels are the one gap. Whether devel…devel4 really
  share one Redis server is not verified here, because it is infrastructure. The changelog states that this is the intended setup.

**(2) Was it the same in 0.2.3? No, so this came with the upgrade.** In 0.2.3 (`PK/rsa-023/package/dist/adapter.js`) the options have no
`channelPrefix` (18-25). The class is `ClusterAdapterWithHeartbeat` (75). `doPublish` is `XADD` to `streamName`, and `doPublishResponse`
calls `doPublish` (84-91), so requests **and** responses went through the prefixed, versioned stream. `serverCount` = `1 + nodesMap.size`,
counting the uids seen in that stream (cluster-adapter.js:512-519, 536-538). Each env and version was a closed cluster. Upstream
CHANGELOG 0.3.0, "Use PUB/SUB for fetchSockets() and serverSideEmit() requests" (commit dacb88d), introduced `channelPrefix` and
`useShardedPubSub`.

**(3) The option that fixes it:** `channelPrefix`. This is its exact name, and its default is `"socket.io"` (adapter.js:71; README table
line 137: "The prefix of the Redis PUB/SUB channels used to communicate between the nodes"). `streamName` has no effect on the channel
names (140-141, 165). ioredis does not prefix channels, so the prefix must be explicit. To keep the 0.2.3 semantics (isolated by env
**and** by version), use:
`createAdapter(redisClient.duplicate(), { streamName: \`collab-${version}\`, channelPrefix: \`${redisKeyPrefix}collab-${version}\` })`.
That puts the stream key and the channels under the same name.

**(4) Rolling deploy 0.2.3 ↔ 0.3.1: they do not interact at all.** Old and new pods have different `APP_VERSION` values
(`C/docker/app/kubernetes/Dockerfile:6-7`), so their streams differ (`…collab-<old>` vs `…collab-<new>`). The 0.2.3 pods never
subscribe to pub/sub, so they are not counted in NUMSUB and never get the 0.3.1 requests. The 0.3.1 pods never read the old stream. So
no message crosses, and wire compatibility never comes into play. The split by version during a rollout existed before as well:
a hocuspocus connection on a new pod does not see a socket.io connection of the same user on an old pod, and vice versa.
- If the stream name were the same (same version), the stream entries would be compatible, because the encoding is identical
  (0.3.1 `adapter.js:169-225` vs 0.2.3 `:92-146`). Request/response traffic would not be compatible. 0.3.1 answers a 0.2.3 FETCH_SOCKETS
  from the stream over pub/sub (164-168), which 0.2.3 does not listen to. 0.2.3 puts every stream sender into `nodesMap` (cluster-adapter.js:516-519)
  and expects its answer, so it would time out after 5 s.
- **Every later deploy (0.3.1 → 0.3.1) without the fix:** the old-version and new-version pods share `socket.io#/#`. They answer each
  other's fetchSockets, but their broadcasts and joins go to different streams, so the room state is inconsistent. A pod that is still
  subscribed while it is shutting down counts in NUMSUB.

**(5) The 5 s timeout.** `authorizeDocument` calls `collaborationServer.in(roomName).fetchSockets()` with no `.timeout()`
(`authorizeDocument.ts:16`). `BroadcastOperator.fetchSockets` passes `flags` (broadcast-operator.js:297-303). `ClusterAdapter.fetchSockets`
uses `opts.flags.timeout || DEFAULT_TIMEOUT`, with `DEFAULT_TIMEOUT = 5000` (cluster-adapter.js:20, 378-385). On a timeout it rejects with
`timeout reached: only X responses received out of Y`. `onAuthenticate` throws, and Hocuspocus sends PermissionDenied
(`C/node_modules/@hocuspocus/server/src/ClientConnection.ts:571-582`). 0.2.3 had the same 5 s timeout (cluster-adapter.js:583-607), but only
toward its own env and version.

## B. Hocuspocus 4 keepalive

**v3.4.4 (before).** `ClientConnection` starts `setInterval(check, timeout)` and listens for `pong` (`PK/hp-server-344/package/src/ClientConnection.ts:95-97`).
`check` (120-136): if no pong came since the last run, it calls `close(ConnectionTimeout)` (4408); otherwise it calls `websocket.ping()`.
The default `timeout` is 30000 (`src/Hocuspocus.ts:29`). So there was a WebSocket-level ping every 30 s, with one interval of grace for the pong.

**v4.7.1 (now), source.** `ClientConnection.check` (`C/node_modules/@hocuspocus/server/src/ClientConnection.ts:194-214`) runs every `timeout`
(139). The default is now **60 000** (`src/Hocuspocus.ts:28`). It terminates with 4408 when `Date.now() - lastMessageReceivedAt > timeout`,
so after 60–120 s of silence. `lastMessageReceivedAt` is refreshed by every incoming message (604) and by `touch()` (83-90).
`Server.ts:67-77` calls `touch()` on a raw WebSocket `pong` (fix #1179 for issue #1171, both closed 2026-10-12). That fix assumes that
crossws sends heartbeat pings. **Hocuspocus itself sends no ping:** `MessageType.Ping = 9` / `Pong = 10` exist only as an enum
(`src/types.ts:72-73`), and `MessageReceiver.ts:51-174` handles neither. The `timeout` docstring "server sends a ping" (`types.ts:251`) is outdated.

**v4.7.1 as it runs here: no ping at all.** The server is CommonJS (`C/tsconfig.json:3`; `C/dist/server/hocuspocus.js:5` uses `require`).
`require.resolve('@hocuspocus/server')` resolves to `dist/hocuspocus-server.cjs`. That bundle **inlines crossws 0.4.4**
(`dist/hocuspocus-server.cjs:5565` `//#region node_modules/.pnpm/crossws@0.4.4/…/adapters/node.mjs`, 5566-5626). Its node adapter has
no idle timeout and no `ws.ping` (grep `idleTimeout|crossws-ping` in the .cjs: no hit). crossws gained its heartbeat in v0.4.9
("Detect half-open connections via a consistent `idleTimeout` option", #201). The crossws 0.4.15 in `C/node_modules` (`_chunks/node.mjs:14, 25-26, 82-98`:
ping every 30 s, terminate on a missed pong) is used **only by the ESM build** (`dist/hocuspocus-server.esm.js:13` imports it). So for
this server, `peer.websocket.on("pong", touch)` (`.cjs:5735-5737`) never fires. Liveness comes only from messages that the client sends.
4.7.1 is the latest version on npm. This bundling problem has no upstream issue (search "crossws cjs" returned nothing).

**Provider 4.7.1.** It answers a 1-byte app-level `[Ping]` with `[Pong]` (`A/node_modules/@hocuspocus/provider/src/HocuspocusProviderWebsocket.ts:414-437`),
but this server never sends one. Its own watchdog: `messageReconnectTimeout: 30000` (125), checked every 3 s (202-205). It closes the
socket when no message has **arrived** for more than 30 s (464-500), and reconnects after `delay` (578-603). This is unchanged from 3.4.4
(`PK/hp-provider-344/package/src/HocuspocusProviderWebsocket.ts:116, 191-193, 419`). What the client sends while idle is only the awareness
renewal: y-protocols checks every 3 s and renews a non-null local state every 15 s (`A/node_modules/y-protocols/awareness.js:13, 59-77`).
`CollaborationCaret` keeps the local state non-null. The client does not answer incoming awareness, because the origin is the provider
(`MessageReceiver.ts:105-109`, `HocuspocusProvider.ts:423-426`).

**Chrome (docs and Chromium source).**
- developer.chrome.com/blog/timer-throttling-in-chrome-88: in a hidden page, timers are checked "once per second". **Intensive
  throttling** applies when the page has been hidden for more than 5 minutes, the chain count is ≥5 ("With setInterval, each iteration is
  part of the chain"), the page has been silent for 30 s, and WebRTC is not in use. Then "the browser will check timers in this group
  once per minute".
- An open WebSocket does not opt the page out. The WebSocket channel registers a scheduler feature with only `DisableBackForwardCache()`
  (chromium `third_party/blink/renderer/modules/websockets/websocket_channel_impl.cc:309-315`). Intensive wake-ups are skipped only for
  `opted_out_from_aggressive_throttling_` (`…/scheduler/main_thread/page_scheduler_impl.cc:755-766`). WebSocket message tasks
  (`TaskType::kWebSocket`) are *not* throttled (`frame_scheduler_impl.cc:539, 558`: deferrable, not throttleable). JS timers are
  (`:494-495`). WebSocket ping frames are answered by the network stack (`net/websockets/websocket_channel.cc:766-775`), independently of the renderer.
- developer.chrome.com/blog/freezing-on-energy-saver: from Chrome 133, with Energy Saver on, CPU-intensive tabs that have been hidden and
  silent for more than 5 minutes are frozen. Freezing suspends "event handlers (input, network …), timers". WebSockets are not an exemption.

**Conclusion.**
- Tab hidden for less than 5 min: renewals still come every ~15 s, so nothing changes.
- Tab hidden for more than 5 min: the client sends one awareness renewal per minute, against a server limit of >60 s, checked every 60 s.
  That is borderline. A gap of 60 s plus a few ms of jitter is enough for the occasional check to fall in the window, so a 4408 close is
  **possible, intermittently over hours, not every minute**. This does not depend on how many other users are in the room, because only
  what this client sends counts.
- Frozen tab (Energy Saver, CPU-intensive): it sends nothing, so it is **certainly** cut after 60–120 s. In v3 the network stack kept
  answering WS pings even for a frozen renderer (it stops reading only once ~131 KB of unread data piles up,
  `services/network/websocket.cc:70-71`, `websocket_channel.cc:633`).
- This is a regression from v3. There, the WS-level ping kept every live socket open, whatever the throttling.
- The client-side watchdog is equally borderline in a lone hidden tab, in both versions. The server removes the client's awareness
  30–33 s after its last renewal and broadcasts that removal, so the client hears something about every 30 s.

**What the user would see.** The provider reconnects by itself. While the tab is hidden, the timer that delays the reconnect is
throttled, so it can wait until the next minute's wake-up. It then authenticates again (`onAuthenticate` → `fetchSockets`, see A) and
resyncs. **No edits are lost:** the Y.Doc keeps its state, and the sync handshake reconciles by state vector. admin-cms shows no
provider status (`A/src/domains/cms/article/components/bodyEditor/ArticleBodyEditor.vue`). Others see the user's caret vanish for up to
about a minute. The only real risk is a failed re-auth (A's timeout, or the user's socket.io socket missing). Then the document stays
unsynced until a later retry. The client watchdog closes a silent socket after ~30 s, and in v4 the server's pre-auth deadline also
closes it after 60–120 s (`ClientConnection.ts:200-214`).

**Confidence.** High for the mechanism: source, dist and the resolved file were all read. Medium for how often it happens. It was not
reproduced in a browser.

**Options.**
- Send a WS ping from the app, which then counts through the existing `touch()`. For example, an extension with a `connected` hook
  (`connection.webSocket`, `types.ts:368-379`) that pings each socket every 30 s.
- Or raise `timeout`, for example to 150 000, at the cost of slower dead-socket cleanup and a longer pre-auth deadline.
- Report the CJS bundling of crossws 0.4.4 upstream.

## C. Sentry cookies

**Setup.** `Sentry.init` has no `dataCollection` and, since 7262b58, no `sendDefaultPii` (`C/src/index.ts:17-30`; the diff removes
`sendDefaultPii: true`). The JWT is `anz_jp + '.' + anz_js` (`C/src/util/authorization.ts:16-22`).

**v11.8 defaults** (`C/node_modules/@sentry/core/build/cjs/utils/data-collection/resolveDataCollectionOptions.js:3-15, 31-36`):
`cookies: true`, `httpHeaders: { request: true, response: true }`, `httpBodies` all, `userInfo: true`. `sendDefaultPii` no longer
appears anywhere in core 11.8. The Sentry docs (Node, "Data Collected") say: *"By default, cookie collection is enabled. On the server,
the cookies of incoming requests are sent with error events and server spans … To disable cookie collection, set `dataCollection: { cookies: false }`."*

**Sensitive-name filter: these names pass.** `SENSITIVE_KEY_SNIPPETS` (auth, token, secret, session, password, passwd, pwd, key, jwt, …,
sid, identity, set-cookie, cookie) and `SENSITIVE_COOKIE_NAME_SNIPPETS` (.sid, sessid, remember, oidc, …, mfa, 2fa) are listed at
`filtering-snippets.js:57-107`. Neither matches `anz_jp` or `anz_js`. Run on the installed 11.8 with
`Cookie: anz_jp=eyJ…; anz_js=SIG; PHPSESSID=x`:
- span `http.request.header.cookie` = `["anz_jp=eyJ…", "anz_js=SIG", "PHPSESSID=[Filtered]"]`;
- event `request.cookies` = `{ anz_jp: "eyJ…", anz_js: "SIG", PHPSESSID: "[Filtered]" }`;
- event `request.headers.cookie` = `"[Filtered]"`, because the header key `cookie` is itself a sensitive snippet.

**When this server attaches request cookies.**
- *Error event during an incoming plain HTTP request:* **yes.** `instrumentServer` wraps only `emit("request")`
  (`integrations/http/server-subscription.js:36-41`) and stores `normalizedRequest` with all headers (52, 63). RequestData then adds
  `request.cookies` filtered only by name, and the headers with `cookie` set to `[Filtered]` (`integrations/requestdata.js:20-37, 97-108, 168-192`).
- *Server span of an incoming HTTP request:* **yes.** `httpServerSpansIntegration` sets `httpHeadersToSpanAttributes(…)`
  (`@sentry/node/build/cjs/integrations/http/httpServerSpansIntegration.js:71`; `utils/request.js:151-197`: cookie pairs filtered by name).
  With span streaming, `processSegmentSpan` adds `http.request.header.cookie` again (`requestdata.js:69-77, 142-150`). **Span streaming is
  the v11 default:** `traceLifecycle` falls back to `"stream"` (`@sentry/node/build/cjs/sdk/index.js:179-187`; `core client.js:101`).
  Spans need `SENTRY_TRACES_SAMPLE_RATE > 0`.
- *WebSocket upgrade (Hocuspocus and socket.io):* **no.** In Node 24, `parserOnIncoming` returns for an upgrade before the
  request-start channel and before `emit('request')` (nodejs/node `v24.x` `lib/_http_server.js:1167-1174` vs 1207, 1281/1293). Both servers
  take the upgrade path: Hocuspocus listens on `httpServer.on("upgrade")`, and socket.io uses `transports: ['websocket']`, which the client
  sets as well (`CA/src/domains/collab/composables/collabInit.ts:67-68`). So no `normalizedRequest` and no server span exist for them.
  Errors inside the WS handlers carry no request data.
- *socket.io:* there is no Sentry integration. The app's own captures (`C/src/index.ts:58`, `C/src/manager/roomOptionsManager.ts:27`) and the
  winston SentryTransport (`C/src/logger/appLogger.ts:100`) pass no headers.
- **In practice:** cookies arrive only on a plain HTTP request from a browser to the collaboration hosts (a direct visit, or an
  engine.io HTTP request). core-cms calls the sys API with `Authorization: Bearer`, and that header is filtered by the `auth` snippet.
  So the exposure is real but small.

**v10.70 with `sendDefaultPii: true` (before).** The data was the same, and the event path was less filtered.
- `defaultPiiToCollectionOptions(true)` gave `cookies: true` and headers `true` (`PK/sentry-core-1070/package/build/cjs/utils/data-collection/defaultPiiToCollectionOptions.js:5-17`,
  used by `resolveDataCollectionOptions.js:18`).
- The 10.70 RequestData copied the raw `headers` (Cookie included) and the parsed `cookies` into `event.request` without any filter
  (`integrations/requestdata.js:61-66, 111-134`).
- Spans got `http.request.header.cookie.anz_jp` / `.anz_js` through the same name filter (`utils/request.js:150-176`;
  `PK/sentry-node-core-1070/…/httpServerSpansIntegration.js:76`).
- It was likewise limited to `"request"` events (`server-subscription.js:36`).
- So this is **not a regression**. v11 is the same or slightly better, because it at least shows the Cookie header in events as `[Filtered]`.

**The option that removes them:** `dataCollection: { cookies: false }`. It also strips the Cookie header.
- Events: `include.cookies` becomes `false` (`requestdata.js:24`), so `delete headers.cookie` runs and `request.cookies` is not set (172-175, 189-192).
- Spans: `httpHeadersToSpanAttributes` skips `cookie` / `set-cookie` when `cookies === false` (`request.js:163-167`), and the segment-span
  cookie attribute is gated by `include.cookies` (`requestdata.js:142`).
- Checked by running the installed code: with `cookies: false`, the span attributes keep only `authorization: [Filtered]` and the user-agent.
- `dataCollection: { httpHeaders: false }` does **not** remove the cookie span attribute (checked: it still produces
  `http.request.header.cookie: ["anz_jp=…", "anz_js=…"]`). Cookies follow only the `cookies` behavior.
- To keep the names: `cookies: { deny: ['anz_'] }` gives `anz_jp=[Filtered]`, `anz_js=[Filtered]` (checked).

**Side notes.**
- The v11 defaults also collect incoming request bodies at the "medium" size, 10 KB (`server-subscription.js:56-62`). That includes the sys
  API article JSON. They also collect client IPs (`userInfo`).
- The Sentry server-side default scrubber list (password, secret, passwd, api_key, apikey, auth, credentials, mysql_pwd, privatekey,
  private_key, token, bearer; docs.sentry.io "Server-Side Data Scrubbing") does not cover these names either. Adding `anz_jp`, `anz_js` to
  the project's "Additional Sensitive Fields" is a cheap second line of defence. Whether the server side scrubs cookies by default is not verified.
