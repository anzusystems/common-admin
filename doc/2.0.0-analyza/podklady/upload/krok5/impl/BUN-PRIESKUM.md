# BUN-PRIESKUM: server kolaborácie na Bune namiesto Node 24

Otázka vlastníka: čo keby server kolaborácie nebežal na Node, ale napríklad na Bune. Prieskum z 25. 10. 2026: čítanie
projektu `petit/collaboration` (vetva `feature/collab-stats`, HEAD 3e79449), meraní (`COLLAB-PERF.md`,
`STATS-PERF.md`, `perf/results/final/summary.md`) a verejných zdrojov. Nič som nespúšťal ani neinštaloval. Bun
nebežal ani raz, preto všetko o správaní nášho servera na Bune je **odvodené, nie zmerané**. Odhady sú označené.

Porovnávané verzie: Node 24 v obraze `node24:2.0.0-nginx-browsers` (`docker/app/kubernetes/Dockerfile:1`). Bun
**1.4.4** z 22. 10. 2026 je najnovší ([releases](https://github.com/oven-sh/bun/releases)).

## Verdikt

- **Neprechádzať.** Experiment len vtedy, ak vlastník chce tvrdé číslo. Úspech nečakám.
- **Bun 1.4 je dva mesiace starý prepis.** Bun 1.4.0 (20. 8. 2026) je prvé vydanie po prepise celého runtime zo Zigu
  do Rustu.
  - Odvtedy vyšli štyri opravné verzie a každá opravuje WebSocket alebo `node:http`.
  - Posledná, 1.4.4 z 22. 10., opravuje `ws` server, ktorý pri dávke veľkých správ doručil niektoré dvakrát a mimo
    poradia (§5.1).
  - Pre server, ktorého hlavnou prácou sú WebSockety, je to neprijateľné riziko pre produkciu.
- **Naše úzke miesta Bun nerieši.** Chvosty sú v round tripoch do Redisu, čakaní na zámok (Redlock 25 ± 25 ms),
  Lua a Mongu, a tie od runtime nezávisia.
  - GC je po vyladení 0,56–0,93 % času, slučka p99 1,6–1,7 ms. Nie je čo zobrať.
  - Zostáva CPU vrstvy WebSocketov. Tú Bun zrýchli len s prepisom oboch serverov na `Bun.serve`.
  - Odhad zisku: ~1–3 body jadra v c a rotácii (dnes 26,5 a 25,3 %), čo je blízko driftu medzi oknami (2–3 body).
- **Prechod stojí veľa práce aj diagnostiky:**
  - prepis spúšťania, Sentry, obrazu, CI a perf nástroja;
  - stratíme voľby V8 (heap 300, semi-space 16), GC metriky, Sentry profily a Chrome inspector;
  - všetko ladenie heapu a GC z posledných týždňov by sa robilo odznova.
- **Lacnejší zisk bez zmeny runtime** dáva awareness fast path Hocuspocus (PR
  [#1198](https://github.com/ueberdosis/hocuspocus/pull/1198), otvorený od 22. 10. 2026). V meraní b1-awarefinal
  dal CPU 16,7 → 14,4 % (−14 %) a p99 úpravy 11,5 → 7,4 ms (`posudky/OPT-server-opus.md:9`).

## 1. Východisko: čo server používa a ako dnes beží

| vrstva | v projekte | čo z Node potrebuje |
|---|---|---|
| Hocuspocus 4.7.1 | `src/server/hocuspocus.ts:39-53` `new Server({...})`, `listen()` | `Server` robí `node:http` `createServer` + `crossws/adapters/node` (`@hocuspocus/server/src/Server.ts:6,9,56-93`). Adaptér má vo svojom builde vlastnú kópiu `ws` (crossws 0.4.15, `dist/THIRD-PARTY-LICENSES.md`) |
| hooky Hocuspocus | `onUpgradeHook.ts:11-23` (CORS, odpoveď 403 priamo do `net.Socket`), `onRequestHook.ts:21-111` a `collabStatsRequest.ts:34-115` (sys API, štatistiky cez `IncomingMessage`/`ServerResponse`) | Node objekty požiadavky a socketu |
| udržanie spojenia | `Server.ts:71-77`: pong z `ws` volá `clientConnection.touch()` | udalosť `pong` surového `ws` |
| socket.io 4.8.4 (engine.io 6.6.9 → `ws` 8.22) | `src/server/collaboration.ts:26-52`, `listen(collaborationPort)`, adaptér `@socket.io/redis-streams-adapter` 0.3.1 | `node:http` + npm `ws` |
| Redis | ioredis 5.11.1 (`src/storage/redis.ts:12`), Redlock 1.4.0 (`exectionLockHelper.ts:38-45`), BullMQ 5.81.5, `@hocuspocus/extension-redis` (ioredis ~5.6) | `net` |
| Mongo, MySQL | mongoose 9.11.2, mongodb 7.7.0, bson 7.3.3, mysql2 3.24.6 | `net`, `node:v8` (bson, nižšie) |
| Sentry | `@sentry/node` 11.8 cez `--import @sentry/node/import` (`package.json:28`), `Sentry.init` v `src/index.ts:43-58`, `@sentry/profiling-node` (`index.ts:18,56`) | ESM loader hooky (`module.register`), natívny addon V8 |
| štart | `package.json:28` `NODE_OPTIONS="--max-old-space-size=300 --import @sentry/node/import --max-http-header-size=65536" node dist/index.js`; supervisord `yarn run prod` (`docker/app/kubernetes/etc/supervisor/conf.d/node-server.conf:3`) | voľby V8 a Node |
| konfigurácia | `dotenv` (`src/config/config.ts:76`) | – |
| testy | vitest 5, 35 súborov; `vi.mock` 135×, `vi.advanceTimersByTimeAsync` 92×, `vi.hoisted` 30×, `vi.resetModules` 15× | vitest |
| CI | `azure-pipelines.yml`: šablóna `node-ci.yaml@templates`, `containerDockerImageVersion: "node24"` | obraz Node |

**Výkon dnes** (finálne meranie 24. 10., PR f05281a = heap 300, semi-space 16, 1 jadro, medián 3 behov;
`STATS-PERF.md` „Finálne meranie", `perf/results/final/summary.md`):

| scenár | CPU [% jadra] | kľúčové latencie [ms] | slučka p99 [ms] | GC [% času] | RSS [MB] |
|---|---|---|---|---|---|
| b (30 × 3 editori) | 17,9 | úprava p50/p95/p99 1,87 / 3,20 / 4,27 | 1,64 | 0,56 | 203 |
| c (zámky, polia, vstup/odchod) | 26,5 | vstup p99 12,9, zámok p99 6,96, zmena p99 10,4 | 1,08 | 0,93 | 197 |
| rot (rotácia článkov) | 25,3 | úprava p99 4,74, vstup p99 23,1, odchod p99 20,9, zámok p99 10,7 | 1,71 | 0,86 | 210 |

V c je 6 934 príkazov Redisu za sekundu a priepustnosť 390 potvrdených operácií za sekundu bez chýb. Latencie sú pod RTT
prehliadača (5–20 ms).

## 2. Kompatibilita závislostí s Bunom 1.4.4

Dva spôsoby behu:
- **A, cez kompatibilitu:** bez prepisu serverov. Hocuspocus aj socket.io bežia na Bunovom `node:http`.
- **B, natívne:** Hocuspocus cez `Bun.serve` a `crossws/adapters/bun`, socket.io cez `@socket.io/bun-engine`.

### 2.1 Hocuspocus 4.7.1 (crossws)

- **Oficiálne beží na Bune.** Vydanie Hocuspocus 4 (stabilné 8. 5. 2026) uvádza: „It now runs on Bun, Deno, Cloudflare
  Workers, and Node with uWebSockets“ ([release notes](https://tiptap.dev/blog/release-notes/hocuspocus-4-stable-release)).
- **A:** `Server` na Bune použije Bunov `node:http` a kópiu `ws` z crossws v čistom JS nad socketom z Bunovho
  `node:http`.
  - Cesta je podporovaná, ale nedávno mala chyby. Bun 1.4.3 (10. 10. 2026) opravil: „Writes to upgrade/connect sockets
    stayed buffered on reused keep-alive connections, which stalled the npm `ws` package“
    ([v1.4.3](https://bun.com/blog/bun-v1.4.3)).
  - Výkonový zisk tu nečakám: rámce WebSocketu ďalej kóduje JS kód `ws`, len nad iným socketom.
- **B:** dokumentácia Hocuspocus má príklad pre Bun: `new Hocuspocus(...)`, `crossws/adapters/bun`, `Bun.serve`
  ([examples](https://tiptap.dev/docs/hocuspocus/server/examples)). Treba však:
  - obísť chybu väzby `this` na `ServerWebSocket` vlastným objektom (príklad to robí);
  - presunúť `onUpgrade` a `onRequest` do `fetch`. Volá ich len trieda `Server` (`Server.ts:99-145`), pri vlastnom
    serveri sa nespúšťajú (dokumentácia to výslovne uvádza pri Express, Hono a Koa);
  - preniesť udržanie spojenia: `pong` hook crossws → `touch()` (dnes `Server.ts:71-77`). Bun posiela pingy sám
    (`sendPings`), adaptér má `idleTimeout` 30 s (`crossws/dist/adapters/bun.mjs:25`);
  - preniesť `maxPayload` 10 MB (`hocuspocus.ts:17`) do `maxPayloadLength` (predvolené v Bune 16 MB);
  - prepísať `destroy()` (`Server.ts:215-249`: zavrieť server, `closeConnections`, `flushPendingStores`, `onDestroy`).

### 2.2 socket.io 4.8.4

- **A:** engine.io importuje `ws` a Bun ho nahrádza vlastným vstavaným `ws`. Poznámky 1.4.1 hovoria o „the built-in
  `ws` package“ ([v1.4.1](https://bun.com/blog/bun-v1.4.1)). Chyby tohto shimu po prepise do Rustu:
  - [#39766](https://github.com/oven-sh/bun/issues/39766) (otvorené 20. 8., zavreté 22. 8. 2026): `handleUpgrade()`
    po `await` hodí `TypeError` a klient sa nikdy nepripojí. Regresia 1.4.0, opravená v 1.4.1;
  - 1.4.4 (22. 10. 2026): „a `ws` server sending a burst of large messages delivered some twice and some out of order“
    ([v1.4.4](https://bun.com/blog/bun-v1.4.4)).
- **B:** [`@socket.io/bun-engine`](https://github.com/socketio/bun-engine):
  - verzia 0.1.2 z 1. 9. 2026, šesť vydaní od 8/2025, stále pred 1.0;
  - [blog socket.io](https://socket.io/blog/bun-engine/) z 22. 8. 2025: predtým beh „relied on Bun's polyfill for the
    Node.js HTTP server“;
  - „Any existing adapter can be used without any modification“ a `idleTimeout` musí byť väčší ako `pingInterval`
    ([server-installation](https://socket.io/docs/v4/server-installation/));
  - README uvádza `path`, `pingInterval`, `maxHttpBufferSize`, `allowRequest`, `cors`. `transports` neuvádza: náš
    `transports: ['websocket']` (`collaboration.ts:27`) treba overiť;
  - žiadne benchmarky ani uvedené obmedzenia.
- **Adaptér `@socket.io/redis-streams-adapter` 0.3.1:** čistý JS nad ioredis (závislosti `@msgpack/msgpack`, `debug`).
  Podľa vyjadrenia socket.io funguje bez zmeny. Na Bune som ho neoveroval.

### 2.3 Redis: ioredis, Redlock, BullMQ, extension-redis

- **BullMQ:** autori spúšťajú celú testovaciu sadu na Bune v CI („is now part of our continuous integration process“,
  [BullMQ, 30. 1. 2026](https://bullmq.io/articles/benchmarks/bunjs-vs-nodejs/)). Tým je nepriamo overené aj ioredis.
  Od 5.77 BullMQ vie použiť aj Bunov klient Redisu, ioredis však ostáva závislosťou
  ([pluggable clients, 25. 5. 2026](https://bullmq.io/articles/guides/pluggable-redis-clients/)).
- **ioredis 5:** konkrétny problém s Bunom som nenašiel (hľadal som issues oven-sh/bun 2026).
- **Bunov `Bun.redis`:** nie je náhradou. Redlock, `@hocuspocus/extension-redis` aj adaptér socket.io potrebujú ioredis.
- **Redlock a extension-redis:** čistý JS nad ioredis, žiadny zdroj o Bune. Pravdepodobne v poriadku (odvodené).

### 2.4 Mongo a MySQL

- **bson:** bson 7.3.3 pri načítaní volá `v8.startupSnapshot.isBuildingSnapshot()`
  (`node_modules/bson/lib/bson.node.mjs:2618`).
  - Staršie Buny tu hádzali `ERR_NOT_IMPLEMENTED` a mongodb 7.3 / mongoose 8–9 pri štarte padali
    ([Railway](https://station.railway.com/questions/functions-throwing-not-implemented-error-eefb43c4),
    [Medium](https://medium.com/@zehan9211/why-mongoose-crashes-in-bun-and-how-to-fix-the-v8-startupsnapshot-bug-d8eb5e5ef385)).
  - Dnešná tabuľka kompatibility hovorí, že `startupSnapshot` je implementovaný
    ([nodejs-compat](https://bun.com/docs/runtime/nodejs-compat)).
  - Od ktorej verzie, som nezistil. Overiť štartom.
- **mongodb a mongoose:** Bun ich v návode uvádza ako funkčné
  ([mongoose guide](https://app.unpkg.com/bun-types@1.3.14/files/docs/guides/ecosystem/mongoose.mdx)). Oficiálne
  vyhlásenie MongoDB o testovaní na Bune som nenašiel.
- **mysql2:** zdroj som nenašiel. Pool sa pripája až pri prvom dotaze (validátor). Neoverené.

### 2.5 Sentry

- **`@sentry/node` s `--import @sentry/node/import` na Bune nefunguje tak ako na Node:**
  - Bun nečíta `NODE_OPTIONS` (`src/jsc/bindings/BunProcess.cpp`: „Bun does not parse the NODE_OPTIONS environment
    variable“);
  - `module.register` je no-op ([nodejs-compat](https://bun.com/docs/runtime/nodejs-compat)), takže ESM inštrumentácia
    OpenTelemetry sa nezavesí.
- **Náhrada je `@sentry/bun` 11.9.0 so štartom `bun --preload ./instrument.js`.** Balík sám závisí od `@sentry/node`
  11.9.0 a má engines `bun >=1.3.14` (npm).
  - Bez pluginu `sentryBunPlugin` dostaneme chyby, vlastné spany a spany `Bun.serve`, `node:http` a `fetch`
    ([Sentry Bun](https://docs.sentry.io/platforms/javascript/guides/bun/)).
  - Inštrumentácia závislostí (DB) chýba, my však Redis aj Mongoose vypíname (`index.ts:54-57`), takže pokrytie je
    rovnaké.
  - Cena jadra SDK ostáva pravdepodobne rovnaká (rovnaké `@sentry/core`/`node`, odvodené). COLLAB-PERF §2.1 ju meria
    na 1,7–4,8 bodu CPU.
- **Profilovanie:** `@sentry/profiling-node` „won't run in environments like Deno or Bun“
  ([Sentry](https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/)). Odstrániť; dnes aj tak
  nič nerobí (COLLAB-PERF §4.2).

### 2.6 Ostatné

- **Čisté JS bez rizika (odvodené, bez zdroja):** yjs 13.6.33, lib0, y-protocols, Tiptap/ProseMirror, winston/logform,
  `reflect-metadata`, `safe-stable-stringify`, `js-base64`.
- **`@ladjs/graceful` 5:** používame len `customHandlers` a signály (`index.ts:152-171`). Jeho `lil-http-terminator` sa
  nepoužije. Pravdepodobne v poriadku.
- **`jsonwebtoken` (ES256):** `node:crypto` je v Bune 🟡: chýba `encapsulate`/`decapsulate`, overenie podpisu je
  implementované. Overiť testom `authorizeDocument`.
- **`dotenv`:** Bun sám načítava `.env`, `.env.<NODE_ENV>` a `.env.local` ešte pred kódom. Na zachovanie dnešného
  správania štartovať s `--no-env-file` alebo `env = false` v `bunfig.toml`
  ([env](https://bun.com/docs/runtime/environment-variables)).
- **`tsx`:** netreba, Bun spúšťa TS sám. `--conditions=development` Bun podporuje (`#/*` importy).
- **`--max-http-header-size=65536`** (veľké cookies s JWT): pre `node:http` v Bune platí, pre `Bun.serve` som
  ekvivalent nenašiel. Overiť požiadavkou so 64 KB hlavičkou.

## 3. Výkon: čo by sa reálne zrýchlilo

### 3.1 Čo hovoria overiteľné zdroje

| zdroj | čo meral | výsledok | prečo to pre nás veľa neznamená |
|---|---|---|---|
| [Bun docs, WebSockets](https://bun.com/docs/runtime/http/websockets) | chat, Bun 0.2.1 proti Node 18.10 + `ws`, 16 klientov | ~700 000 proti ~100 000 správ/s (7×) | starý syntetický test; naša vrstva `ws`+crossws je ~1 s z ~37 s (3.2) |
| [BullMQ, 30. 1. 2026](https://bullmq.io/articles/benchmarks/bunjs-vs-nodejs/) | Bun 1.3.3 proti Node 24.13, M2, lokálny Redis | pridávanie +25 až +83 %, spracovanie +12 % / ~0 %, „CPU work“ +31–33 % | syntetické. Autor: spracovanie je I/O, rozdiel mizne |
| [Trigger.dev, 27. 3. 2026](https://trigger.dev/blog/firebun) | long-poll broker | 2 099 → ~10 700 req/s | najväčší krok bola zmena kódu (SQLite → `Map`, 2,2×). Krok `Bun.serve` (~2×) už obsahuje čistenie, Bun sám izolovaný nie je |
| [Bun 1.4, 20. 8. 2026](https://bun.com/blog/bun-v1.4) | HTTP servery, hello world | pamäť pod záťažou −13 až −48 %, nečinné CPU 5× nižšie | proti Bunu 1.3, nie proti Node |
| [Platformatic](https://blog.platformatic.dev/bun-is-fast-until-latency-matters-for-nextjs-workloads) (bez dátumu, vydavateľ konkurenčného runtime) | Next.js, EKS, pody s 1 CPU, 1 000 req/s | priemer Bun ~246 ms, Node ~20 ms; p99 974 / 174 ms | iná záťaž. Ukazuje však, že na jednom jadre v K8s nemusí byť Bun rýchlejší |

Benchmark Yjs, Hocuspocus ani socket.io na Bune proti Node som nenašiel. Pre náš server preto neexistuje overiteľné
číslo a dá sa len zmerať.

### 3.2 Kam ide CPU nášho servera

Profil rotácie z 23. 10. (`perf/results/stats/stats-rot-cpuprof/profile-compare.txt`, beh off):
- zaneprázdnené hlavné vlákno 60,4 s z 337 s;
- profil je ešte so zlib socket.io (16,7 s v natívnom čase) a s GC heapu 200/semi 64 (9,4 s). Obe sú dnes preč, GC
  ~0,86 % času, takže zvyšok je odhadom ~37 s.

Vlastný čas podľa balíkov:

| čo | s | Bun natívne (B) by to |
|---|---|---|
| node:internal (streamy, časovače, …) | 4,37 | čiastočne nahradil |
| ioredis | 3,15 | nechal (rovnaký JS) |
| yjs + lib0 + y-protocols | 3,85 | nechal (iný JIT, výsledok neznámy) |
| @hocuspocus/server + extension-redis | 1,81 | nechal |
| logform (winston) | 0,93 | nechal |
| redis-streams-adapter | 0,68 | nechal |
| mongodb + mongoose | 0,98 | nechal |
| node:net + node:events + node:buffer | 1,23 | z väčšej časti nahradil |
| `ws` (socket.io) + crossws (Hocuspocus) | 0,96 | nahradil (uWebSockets v Bune) |
| natívny čas bez zlib (zápisy, syscally, Sentry) | ~7,4 | syscally ostávajú |

**Odhad:**
- Natívny `Bun.serve` nahradí ~2–4 s z ~37 s hlavného vlákna, teda **~5–10 % CPU, v c a rotácii ~1–3 body jadra**.
- Pri behu A (kompatibilita) zisk nečakám, môže byť aj strata (emulovaný socket pre `ws`).
- O zvyšku (aplikačný JS na JSC proti V8) nevieme nič spoľahlivé. BullMQ ukazuje +30 % v syntetickej práci, Platformatic
  opak v reálnej záťaži.

### 3.3 Naše úzke miesta: čo by Bun riešil a čo nie

| úzke miesto (meranie) | rieši Bun? | prečo |
|---|---|---|
| CPU v c (26,5 %) a rot (25,3 %) | čiastočne, len v B | ~1–3 body z vrstvy WebSocketov (odhad). Aplikačný JS neznámy |
| zlib | už nie je | `perMessageDeflate` socket.io vypnutá (`OPTIMALIZACIE.md` bod 1). Bun.serve má kompresiu tiež voliteľnú |
| GC a pauzy | nie | GC 0,56–0,93 %, slučka p99 1,6–1,7 ms. JSC má súbežný GC, ale nie je čo zobrať. Na Bune sa GC nedá merať ako dnes (§4.6) |
| chvosty zámkov (zmena p99 10,4, zámok p99 7–11 ms) | nie | čakanie Redlocku 25 ± 25 ms (`exectionLockHelper.ts:42-43`) a RTT Redisu, nie runtime |
| round tripy do Redisu (6 934 príkazov/s v c) | nie | počet aj latencia sú v sieti a Redise. Klient ostáva ioredis (Redlock, adaptér, extension-redis) |
| Lua (štatistiky, zámky) | nie | beží v Redise |
| I/O do Monga (ukladanie dokumentov, finalizér) | nie | sieť a Mongo |
| chvost úprav Hocuspocus 4 (awareness, nový `Y.Doc` na správu) | nie | algoritmus Hocuspocus. Rieši PR #1198 (−14 % CPU) |
| cena SDK Sentry (1,7–4,8 bodu) | nie | `@sentry/bun` = rovnaké jadro SDK |
| štart (~0,85 s, COLLAB-PERF §1) | áno, nepodstatné | Bun načítava moduly rýchlejšie. startupProbe má 10 s oneskorenie (`app-deployment.yaml`), na rolling update to nevplýva |
| pamäť (RSS ~200–210 MB pri limite 600 Mi) | neznáme | JSC + mimalloc. Pre našu záťaž neexistuje číslo. Pamäť nie je úzke miesto |

## 4. Čo by sa zmenilo v kóde a nasadení

### 4.1 Spúšťanie

- **Prod:** `package.json:28` napr. `bun --no-env-file --preload ./dist/instrument.js dist/index.js`. `NODE_OPTIONS`
  Bun ignoruje, voľby idú do argumentov alebo `BUN_OPTIONS`.
- **Dev:** `bun --conditions=development --preload ./src/instrument.ts src/index.ts` bez `tsx`.
- **Supervisord** (`node-server.conf:3`): `bun ...` priamo namiesto `yarn run prod`. Yarn 4 potrebuje Node.
  - Odpadne tým aj proces Yarnu v pode. To isté sa dá urobiť aj na Node; pri porovnaní RSS to treba oddeliť.
  - `stopwaitsecs=35` a poradie vypínania (`index.ts:25-30`) ostávajú.

### 4.2 Pamäť: voľby V8 neplatia

- `--max-old-space-size=300` a semi-space 16 (vypočítané z limitu podu, commit f05281a) v Bune nemajú obdobu.
  `v8.setFlagsFromString` ignoruje všetko ([nodejs-compat](https://bun.com/docs/runtime/nodejs-compat)).
- **JSC veľkosť heapu volí sám.** „Bun adjusts the garbage collector's heap size based on the available memory
  (accounting for cgroups and other memory limits)“; `--smol` len spomalí rast heapu za cenu výkonu
  ([runtime docs](https://github.com/oven-sh/bun/blob/main/docs/runtime/index.mdx)).
- **Pevný strop heapu neexistuje.** Pri úniku nespadne V8 s „heap out of memory“, ale OOM killer zabije proces
  (exit 137) a supervisord ho reštartuje.
- **Premenné `BUN_JSC_*`** (napr. `forceRAMSize`) sú nedokumentované, poznám ich len z komunity
  ([reddit, 8/2024](https://www.reddit.com/r/bunjs/comments/1enfpxf/how_to_set_a_runtime_max_memory)).
  Nespoliehať sa na ne.

### 4.3 Kód (len variant B)

- **`src/server/hocuspocus.ts`:**
  - vlastné prepojenie `Bun.serve` ↔ `Hocuspocus.handleConnection` podľa príkladu v dokumentácii (~100–150 riadkov
    vrátane pongu, `maxPayloadLength`, `destroy`);
  - CORS z `onUpgradeHook.ts` ako `Response` 403 vo `fetch`.
- **`onRequestHook.ts` a `collabStatsRequest.ts`:** `IncomingMessage`/`ServerResponse` → `Request`/`Response` (telo
  cez `await request.json()`). Rovnaké správanie a kódy 401/404/429/503 treba udržať.
- **`collaboration.ts:48-52`:** `new Engine({ path: '/ws', ... })`, `io.bind(engine)`,
  `Bun.serve({ port, idleTimeout: 30, ...engine.handler() })`.
  - `allowRequest` aj adaptér ostávajú;
  - `collabServer.close()` pri vypnutí overiť.
- **`index.ts`:** vypínanie serverov (`server.stop()`), Sentry do `instrument.ts`, preč `nodeProfilingIntegration`.
- **nginx v pode** (`proxy.conf.template`) ostáva: porty 3006 a 3007 sa nemenia.

### 4.4 Docker, Kubernetes, CI

- **Obraz** `petitpress.azurecr.io/node24:2.0.0-nginx-browsers` (`Dockerfile:1`) patrí CloudOps a nesie nginx,
  supervisord, logrotate, `health`, `pre-stop-container`.
  - Bun treba doň pridať (binárka ~100 MB, odhad), alebo spraviť nový základný obraz.
  - Node v ňom ostane kvôli Yarnu a buildu.
- **K8s manifest** (`docker/kubernetes/app-deployment.yaml`) sa nemení. Sondy sú TCP/HTTP na nginx a port aplikácie.
- **CI:** šablóna `node-ci.yaml@templates` s obrazom `node24` (`azure-pipelines.yml`) je v repozitári DevOps. Testy na
  Bune by potrebovali jej zmenu alebo vlastný krok.

### 4.5 Testy

- **`bun test` nie.** 35 súborov stavia na `vi.mock`/`vi.hoisted`/`vi.resetModules`/falošných časovačoch, prepis by
  bol veľký.
- **Vitest pod Bunom:** Bun 1.4 uvádza „Vitest runs under Bun, including `--coverage` and the threads and forks pools“
  ([v1.4](https://bun.com/blog/bun-v1.4)). Spustenie `bun --bun vitest run`, neoverené na našej sade.
- **V B treba prepísať testy, ktoré stavajú na `Server` a node adaptéri:** `hocuspocus.test.ts`, `keepalive.test.ts`
  (heartbeat crossws), `onRequestHook.test.ts`, `collaboration.test.ts`.

### 4.6 Perf nástroj (`krok5-praca/perf`)

| časť | na Bune | úprava |
|---|---|---|
| štart servera `lib/run.mjs:276-280` (`node` + `NODE_OPTIONS`, `POD_SEMI_SPACE` `:248`) | `NODE_OPTIONS` ignorované | spúšťať `bun --preload <sentry> --preload lib/monitor.cjs dist/index.js`, bez volieb V8 |
| CPU a RSS z `/proc/<pid>` | funguje | – |
| `monitorEventLoopDelay` (`lib/monitor.cjs:46`) | implementované | – |
| GC cez `PerformanceObserver` `gc` (`monitor.cjs:59-68`) | „Bun never emits `gc` … entries“ | GC % a mark-compact nebudú. Porovnávať slučku, CPU a RSS |
| `getHeapSpaceStatistics` (`:6`, `:69-75`) | jeden heap JSC, bez new/old space | len informatívne |
| `--trace-gc` cez `setFlagsFromString` (`:36`) | ignorované | – |
| vzorkovanie heapu cez `node:inspector` `HeapProfiler` (`:14-33`) | „the `HeapProfiler` domain [is] not implemented“ | `--heap-prof` (snímka pri skončení, 1.4) |
| `--cpu-prof` (sady `*-cpuprof`) | od 1.4, formát Chrome DevTools ([benchmarking](https://bun.com/docs/project/benchmarking)) | `profileSummary.mjs` overiť: iné názvy uzlov, chýba „(garbage collector)“ (odhad) |
| `bun:jsc` `heapStats()` | existuje | nevolať každú sekundu: blokuje 15–22 ms pri produkčných heapoch ([Trigger.dev](https://trigger.dev/blog/firebun)), skreslilo by slučku p99 |

## 5. Riziká a prevádzka

### 5.1 Zrelosť

- **Prepis do Rustu.**
  - Blog „Bun in Rust“ (8. 7. 2026): port z 535 496 riadkov Zigu, posledné vydanie v Zigu 1.3.14 (13. 5. 2026).
  - „19 known regressions, each of which has been fixed“, sada testov prešla v CI
    ([bun-in-rust](https://bun.com/blog/bun-in-rust)).
  - 1.4.0 vyšlo 20. 8. 2026 ([v1.4](https://bun.com/blog/bun-v1.4)). Vercel podľa
    [tretej strany](https://ecorpit.com/bun-1-4-rust-rewrite-breaking-changes-production-2026/) robí prechod na 1.4
    len na výslovnú žiadosť.
- **Opravy v našej oblasti po 1.4.0:**
  - **1.4.1 (4. 9.):** `ws` `handleUpgrade()` po `await` hádzal `TypeError` (#39766). `ServerWebSocket` navždy zastal
    pri backpressure v `drain`. Únik reťazcov v module loaderi a natívnych API.
  - **1.4.3 (10. 10.):**
    - npm `ws` zastal na upgrade socketoch;
    - `Bun.serve` zahadzoval rámce prijaté pred odpoveďou 101;
    - `server.close()` nečakal na keep-alive spojenia;
    - chýbal `'drain'` po `res.write()`;
    - `util.promisify(setTimeout)` sa vyriešil okamžite;
    - päť únikov pamäte ([v1.4.3](https://bun.com/blog/bun-v1.4.3)).
  - **1.4.4 (22. 10.):**
    - `ws` server pri dávke veľkých správ doručil niektoré dvakrát a mimo poradia;
    - callback `write()` na `node:net` sa pri zavretí nikdy nezavolal;
    - únik pri `server.reload()` s WebSocketmi ([v1.4.4](https://bun.com/blog/bun-v1.4.4)).
- **Pre nás:** prvé dva body z 1.4.4 sú presne naša cesta (veľké telá pri synchronizácii, potvrdenia socket.io,
  zápisy do Redisu). Chyby takéhoto druhu sa opravovali ešte pred troma dňami.

### 5.2 Pamäťové úniky

- **Autumn (29. 8. 2026, Bun 1.3.14):**
  - Hono na node adaptéri (`node:http`) narástol o ~34 MiB RSS za 100 000 požiadaviek, natívny `Bun.serve` o 0,6 MiB;
  - natívny únik `fetch` ([#30415](https://github.com/oven-sh/bun/issues/30415),
    [#18488](https://github.com/oven-sh/bun/issues/18488));
  - úniky nakoniec obišli pravidelným reštartom procesov ([blog](https://useautumn.com/blog/eliminating-memory-leaks)).
- **Trigger.dev:** nevyriešený `Promise<Response>` v `Bun.serve` držal stav požiadavky. RSS ~250 MiB, po oprave
  85 MiB.
- **Pre nás:** variant A (oba servery cez `node:http`) je presne tá cesta, kde Autumn úniky videl. Variant B je
  nový kód. 15-min beh `e` je pri prechode nutnosť.

### 5.3 Kubernetes

- Bun beží v kontajneroch (oficiálny obraz `oven/bun`). Heap sa riadi cgroup limitom (4.2).
- Správanie pri CFS kvóte 1100m (počet vlákien GC a mimalloc proti 1 jadru) som v zdrojoch nenašiel. Overiť v pode.
  Naše merania na `taskset` 1 jadre to tiež nezachytia.

### 5.4 Debugovanie a profilovanie

- **Inšpektor:** Bun hovorí „WebKit Inspector Protocol“ (debug.bun.sh, experimentálne rozšírenie VS Code), nie
  Chrome DevTools Protocol ([debugger](https://bun.com/docs/runtime/debugger)).
- **Profily:** `--cpu-prof` a `--heap-prof` od 1.4. `node:inspector` vie `Profiler`, nie `HeapProfiler`.
- **Chýba v `node:v8`:** `startCpuProfile`, `startHeapProfile`, `queryObjects`.
- **`perf_hooks`:** `eventLoopUtilization()` vracia nuly ([nodejs-compat](https://bun.com/docs/runtime/nodejs-compat)).
- **Sentry profily nebudú** (2.5).

### 5.5 Ľudia a postup

Celé ladenie z posledných týždňov stojí na V8:
- heap 300 a semi-space 16 podľa limitu podu;
- mark-compact a scavenge, `--trace-gc`, `--cpu-prof` s balíkmi a GC (`STATS-PERF.md` §5, meranie 3).

Na Bune by sa robilo odznova s menej nástrojmi. Rozbiehanie a riešenie incidentov by bolo pomalšie.

## 6. Odporúčanie

### 6.1 Rozhodnutie

**Neprechádzať.** Prechod nesplní ani jednu z priorít vlastníka:
- **rýchlosť:** odhad zisku je ~1–3 body jadra a len s prepisom oboch serverov. Chvosty sú v Redise a zámkoch;
- **spoľahlivosť:** WebSocket a `node:http` v Bune 1.4.x sa opravujú každý mesiac;
- **jednoduchosť:** druhý runtime v obraze a CI, iný Sentry, iný perf nástroj;
- **žiadne riziko:** runtime vydaný pred dvoma mesiacmi.

Pre rýchlosť má väčší a bezpečnejší účinok:
- awareness fast path Hocuspocus (PR #1198, −14 % CPU, p99 −36 % v b1-awarefinal) z vydania alebo cez `yarn patch`;
- ďalšie kroky z `OPTIMALIZACIE.md`.

**Kedy otázku otvoriť znova:**
- Bun 1.4.x/1.5 aspoň 3 mesiace bez opráv správnosti WebSocketu a `node:http` v poznámkach k vydaniu;
- `@socket.io/bun-engine` ≥ 1.0;
- Hocuspocus s vlastnou triedou servera pre Bun (dnes len príklad v dokumentácii).

### 6.2 Ak vlastník chce číslo: experiment

**E1, beh cez kompatibilitu (variant A): ~1,5 pracovného dňa, z toho ~4,5 h strojového času** (36 behov po ~6,5
min a dva 15-min behy).

1. **Kópia servera** `perf/collab-bun-a` z 3e79449 (`git archive` ako `build-final.sh`) s patchom:
   - `src/instrument.ts` s `@sentry/bun` (voľby z `index.ts:43-58` bez profilovania);
   - `Sentry.init` preč z `index.ts`, preč `@sentry/profiling-node`;
   - `@sentry/node` aj kontrolný Node build na rovnakú verziu ako `@sentry/bun` (11.9), aby sa SDK nelíšilo.
2. **Bun 1.4.4** ako binárka v `perf/` (nie globálne).
3. **`lib/run.mjs`:** verzia s `runtime: 'bun'`, štart `taskset -c N bun --no-env-file --preload <instrument>
   --preload lib/monitor.cjs dist/index.js`, bez volieb V8.
4. **`lib/monitor.cjs`:** GC polia na Bune `null`, bez `HeapProfiler` a `--trace-gc`.
5. **Smoke pred meraním** (bez neho výsledky nemajú význam):
   - 100 % doručených úprav, 0 chýb;
   - 64 KB cookie prejde na oboch portoch;
   - cudzí origin dostane 403 na oboch portoch;
   - vypnutie do 35 s s uloženými dokumentmi.
6. **Sady** `final-b`, `final-c`, `final-rot` (3 behy, 5 min, striedavo s PR na Node heap 300/semi 16):
   - raz so Sentry vypnutým (`APP_DEPLOY_ENV=local`, čistý runtime);
   - raz ako finálne meranie (traces 0).
7. **Únik:** `e` 15 min, jeden beh na runtime.

**E2, natívny beh (variant B): ~3–4 pracovné dni.** Robiť len ak E1 ukáže CPU aspoň −10 % bez horších chvostov,
alebo ak vlastník chce hornú hranicu zisku.

1. Kód podľa 4.3 a prepísané testy z 4.5, vitest pod Bunom zelený.
2. Sady `final-b`, `final-c`, `final-d`, `final-rot` (3 behy), `e` 15 min a brána 5 (Mongo 2 min, rotácia), všetko
   proti PR na Node v tom istom okne.

**Čo by musel experiment ukázať, aby sa prechod oplatil** (všetko naraz, proti Node v tom istom okne):
- **CPU:** v c aj v rotácii aspoň −20 % (c 26,5 → ≤ 21 %, rot 25,3 → ≤ 20 %), v d nie horšie.
  - Prečo −20 %: drift medzi oknami je 2–3 body (~10 %) a PR #1198 dá −14 % bez zmeny runtime.
- **Latencie:** p50/p95/p99 úprav, vstupu, odchodu, zámku, zmeny a uvoľnenia a slučka p99 nie horšie, ako dovolí
  kritérium brány 4 (rozptyl troch behov Node).
- **Pamäť:** RSS priemer ≤ ~230 MB. V `e` sklon RSS nie väčší ako na Node (~0,4 MB/min) a minimum heapu bez sklonu
  (COLLAB-PERF §1, scenár e).
- **Spoľahlivosť:**
  - 100 % doručených úprav, 0 chýb;
  - brána 5 ako na Node: breaker 1×, jeden warn, všetky relácie zapísané raz.
- **Mimo merania:** 3 mesiace Bunu bez opráv správnosti WebSocketu a `node:http` (6.1). Potom devel/stage, nie hneď
  produkcia.

**Môj odhad výsledku (nemerané):**
- E1: CPU v rozmedzí ±10 %, chvosty rovnaké alebo horšie;
- E2: CPU −5 až −15 %, chvosty rovnaké (Redis a zámky).

Teda pravdepodobne „neoplatí sa“. Experiment by potvrdil rozhodnutie, ktoré sa dá urobiť už teraz.

**Alternatíva**, ak by raz vrstva WebSocketov naozaj bola úzkym miestom: Node + uWebSockets.js.
- Hocuspocus 4 ho uvádza („Node with uWebSockets“) a socket.io ho podporuje od 4.4.0 (`io.attachApp`).
- V8, Sentry aj nástroje by ostali.
- uWebSockets.js sa však inštaluje z tagu na GitHube, nie z npm, a nesie vlastné riziko. Dnes ho neodporúčam.

## 7. Neoverené

- Nič z tohto dokumentu nebežalo. Kompatibilita je z dokumentácie, poznámok k vydaniam a issues.
- Odhady zisku CPU (3.2) sú z profilu pred odstránením zlib a pred heapom 300. Podiely sú orientačné.
- Prechod na Rust (1.4) a jeho regresie poznám z blogu Bunu, poznámok 1.4.1–1.4.4 a jednej tretej strany. Úplný
  zoznam otvorených issues 1.4.x som neprechádzal.
- mysql2, Redlock, `@ladjs/graceful`, `jsonwebtoken` a adaptér socket.io na Bune som nenašiel v žiadnom zdroji.
- `startupSnapshot` (bson) je podľa dnešnej dokumentácie implementovaný, od ktorej verzie neviem.
- Správanie Bunu pod CFS kvótou a veľkosť heapu JSC v pode 600 Mi.

## 8. Tabuľka: závislosť | stav na Bune | zdroj

| závislosť (verzia v projekte) | stav na Bune 1.4.4 | zdroj |
|---|---|---|
| `@hocuspocus/server` 4.7.1 (crossws 0.4.15) | **A:** funguje cez `node:http` + kópiu `ws`, cesta opravovaná v 1.4.3. **B:** oficiálny príklad `crossws/adapters/bun` + `Bun.serve`, `onUpgrade`/`onRequest` sa nespúšťajú, vlastné prepojenie | [release 4](https://tiptap.dev/blog/release-notes/hocuspocus-4-stable-release), [examples](https://tiptap.dev/docs/hocuspocus/server/examples), [v1.4.3](https://bun.com/blog/bun-v1.4.3) |
| `@hocuspocus/extension-redis`, `-database`, `-logger` 4.7.1 | čistý JS nad ioredis / Hocuspocus, pravdepodobne OK | odvodené |
| `socket.io` 4.8.4 / `engine.io` 6.6.9 / `ws` 8.22 | **A:** Bun nahrádza `ws` vlastným (regresie #39766 v 1.4.0, duplicitné a preusporiadané správy opravené v 1.4.4). **B:** `@socket.io/bun-engine` 0.1.2 (pred 1.0) | [#39766](https://github.com/oven-sh/bun/issues/39766), [v1.4.4](https://bun.com/blog/bun-v1.4.4), [bun-engine](https://github.com/socketio/bun-engine), [blog 22. 8. 2025](https://socket.io/blog/bun-engine/) |
| `@socket.io/redis-streams-adapter` 0.3.1 | „any existing adapter can be used“ (s bun-engine), čistý JS | [server-installation](https://socket.io/docs/v4/server-installation/) |
| `ioredis` 5.11.1 | funguje (BullMQ ho na Bune testuje v CI), konkrétne issues nenájdené | [BullMQ 30. 1. 2026](https://bullmq.io/articles/benchmarks/bunjs-vs-nodejs/) |
| `@sesamecare-oss/redlock` 1.4.0 | čistý JS nad ioredis, pravdepodobne OK | odvodené |
| `bullmq` 5.81.5 | oficiálne podporovaný, celá sada v CI na Bune | [BullMQ](https://bullmq.io/articles/benchmarks/bunjs-vs-nodejs/), [pluggable clients](https://bullmq.io/articles/guides/pluggable-redis-clients/) |
| `mongoose` 9.11.2 / `mongodb` 7.7.0 / `bson` 7.3.3 | predtým pád na `startupSnapshot.isBuildingSnapshot`, dnes podľa dokumentácie implementované. Overiť štartom | [Railway](https://station.railway.com/questions/functions-throwing-not-implemented-error-eefb43c4), [nodejs-compat](https://bun.com/docs/runtime/nodejs-compat), [Bun mongoose guide](https://app.unpkg.com/bun-types@1.3.14/files/docs/guides/ecosystem/mongoose.mdx) |
| `mysql2` 3.24.6 | bez zdroja, neoverené | – |
| `@sentry/node` 11.8 + `--import` | nefunguje ako na Node (`NODE_OPTIONS` ignorované, `module.register` no-op) → `@sentry/bun` 11.9 s `--preload` (errors + spany `node:http`/`Bun.serve`/`fetch`) | [BunProcess.cpp](https://github.com/oven-sh/bun/blob/main/src/jsc/bindings/BunProcess.cpp), [Sentry Bun](https://docs.sentry.io/platforms/javascript/guides/bun/), npm `@sentry/bun` 11.9.0 |
| `@sentry/profiling-node` 11.8 | nefunguje (natívny addon V8) → odstrániť | [Sentry profiling](https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/) |
| `winston` 3.19 / `logform` | čistý JS, pravdepodobne OK | odvodené |
| `@ladjs/graceful` 5.0 | signály a vlastné handlery, pravdepodobne OK | odvodené |
| `jsonwebtoken` 9 (ES256) | `node:crypto` 🟡, overenie podpisu implementované, overiť testom | [nodejs-compat](https://bun.com/docs/runtime/nodejs-compat) |
| `yjs` 13.6.33, `lib0`, `y-protocols`, Tiptap | čistý JS, OK (výkon JSC proti V8 neznámy) | odvodené |
| `dotenv` 18 | funguje, ale Bun načíta `.env` sám → `--no-env-file` | [env vars](https://bun.com/docs/runtime/environment-variables) |
| `tsx` | netreba (Bun spúšťa TS) | [module resolution](https://github.com/oven-sh/bun/blob/main/docs/runtime/module-resolution.mdx) |
| `vitest` 5 | podľa Bunu 1.4 beží pod Bunom, neoverené na našej sade. `bun test` by vyžadoval prepis | [v1.4](https://bun.com/blog/bun-v1.4) |
| voľby V8 (`--max-old-space-size`, semi-space, `--max-http-header-size`) | heap bez obdoby (JSC podľa cgroup, `--smol`). Hlavičky pre `node:http` áno, pre `Bun.serve` neoverené | [runtime docs](https://github.com/oven-sh/bun/blob/main/docs/runtime/index.mdx), [nodejs-compat](https://bun.com/docs/runtime/nodejs-compat) |
| perf nástroj (`perf_hooks`, `node:v8`, `node:inspector`, `--cpu-prof`) | slučka áno, GC záznamy nie, `HeapProfiler` nie, `--cpu-prof` áno (1.4) | [nodejs-compat](https://bun.com/docs/runtime/nodejs-compat), [benchmarking](https://bun.com/docs/project/benchmarking) |
