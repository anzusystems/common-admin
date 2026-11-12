# COLLAB-ESM: kolaboračný server – testy, opravy po upgrade a prechod na ESM

Zadanie `krok5-praca/zadania/zadanie-collab-esm.md`. Repozitár `/home/volar/projects/petit/collaboration`, vetva `next`,
HEAD 7262b58 (upgrade Hocuspocus 4.7.1, Sentry 11.8, tiptap 3.32). **Nič necommitnuté**; lokálna zmena `.gitignore`
(vlastníkova) nedotknutá. Node v24.15.0 lokálne (obraz `node24:2.0.0` má 24.21). Logy a pomocné skripty (prežijú reštart):
`/home/volar/projects/anzusystems/krok5-praca/collab-esm/`. Posudky: `posudky/HOCUS4-opus.md`, `hocus4-codex.md`,
`HOCUS4-overenie-ABC.md`, `HOCUS4-overenie-schema.md`.

## Poradie a výsledky behov testov

| Beh | Kód | Výsledok | Log |
|---|---|---|---|
| 1 | CJS, pred opravami | 10 súborov, **36 zelených / 10 červených** (46 testov; `sentryTransport.test.ts` sa nenačítal, modul ešte neexistoval) | `test-1-cjs-pred-opravami.log` |
| 2 | CJS, po opravách | **49 / 50**, červený len C7 (zatvorenie 4408) | `test-2-cjs-po-opravach.log` |
| 3 | ESM | **50 / 50** | `test-3-esm.log` |
| 4 | ESM, finálny (po `lint:fix`, `dedupe`) | **50 / 50**, 10 súborov, ~5 s | `test-4-esm-final.log` |

Beh 1, čo bolo červené a prečo (všetko očakávané): logger 4× – `TypeError: scope.clear is not a function` z
`winston-transport-sentry-node/src/transport.ts:74` pri prvom `warn`, potom do Sentry neodišlo už nič (test „keeps
logging" dostal 0 udalostí, konzola písala ďalej) = H1 reprodukovaný; schéma 3× (D1–D4); adaptér 1× (bez
`channelPrefix`); config 1× (dotenv bez `quiet`); C7 1× (`[4408]`).

## 1. Testy (vitest 5.0.5, Node prostredie)

Pridané: `vitest ^5.0.5` + jeho peer `vite ^8.3.5` (ako admin-cms), `@hocuspocus/provider ^4.7.1` (dev), skript
`"test": "vitest run"` (nahradil mŕtvy `jest`, ktorý nebol nainštalovaný). `vitest.config.mts`: `include
test/**/*.test.ts`, celá konfigurácia cez `test.env` (lokálny `.env` ju neprebije, dotenv neprepisuje), `mockReset`,
`unstubEnvs`, `testTimeout` 30 s. Testy sú mimo `src` (tsc ich neemituje do `dist`); `lint:prettier(:fix)` rozšírené na
`{src,test}`, eslint ich lintuje už teraz. Žiadny test nepotrebuje Mongo, Redis ani MySQL (mockované moduly
`document.model`, `storage/redis`, `roomDataManager`, `util/authorization`, `server/collaboration`). Ad hoc typová
kontrola testov (dočasný tsconfig, zmazaný) prešla bez chyby.

| Súbor | Testov | Čo pokrýva |
|---|---|---|
| `config.test.ts` | 7 | hodnoty z env, `redisKeyPrefix` = prefix prostredia + `REDIS_KEY_PREFIX`, `.env` raz a s `quiet: true` (A5), `.env.<typ>`, chýbajúci `APP_ENV_PREFIX`, `ALLOW_MULTIPLE…` len pre `"true"`, nečíselná a chýbajúca hodnota |
| `authorizeDocument.test.ts` | 6 | cookie z `Headers` ide do `verifyCookie`, `isAuthenticated`, `readOnly` pre používateľa len v `:info`, cudzí používateľ, zlá cookie (sockets sa nepýta), bez cookie, bez `roomName` |
| `document.test.ts` | 5 | `fetchDocument`: z Mongo, z room-data JSON cez `TiptapTransformer` + upsert, bez dát, bez miestnosti; `storeDocument`: `findOneAndReplace` so stavom Y.Doc |
| `onRequestHook.test.ts` | 11 | skutočné HTTP na Hocuspocus `Server` z `useHocuspocusServer`: validate 200 valid/invalid/neznámy uzol, 400, 401 ×2; room-data 204 + `emit('collabRoomDataChanged', …)` s obálkou anonymného používateľa, 400, 401; 404 ×2 |
| `logger.test.ts` | 5 | `useAppLogger` so skutočným Sentry 11 (`beforeSend` zachytí, nič neodíde): warn → správa + metadata, error → výnimka, logovanie pokračuje, scope sa neprenáša, pod `warn` nič (A1) |
| `sentryTransport.test.ts` | 4 | transport priamo: tagy, user, extras, úroveň podľa nezafarbeného `LEVEL`, `Error` v zázname, výnimka zo záznamu |
| `collaboration.test.ts` | 2 | voľby adaptéra (A2): `{ streamName: 'collab-1.2.3', channelPrefix: 'devel2_collab:collab-1.2.3' }`; jedna inštancia bez adaptéra |
| `hocuspocus.test.ts` | 5 | integrácia v procese: `useHocuspocusServer` na porte 0 + provider 4.7.1 cez `ws` s cookie: prihlásenie (scope `read-write`, cookie z upgrade požiadavky), načítanie z JSON (normalizované = vstup), úprava → `store` (debounce 2 s) uloží dokument s úpravou, readOnly klient (scope `readonly`) nezapíše (ani do Mongo, ani k editorovi), odmietnutie bez socketu a so zlou cookie |
| `keepalive.test.ts` | 1 | C7, nižšie |
| `schema.test.ts` | 4 | bod 10: `button.external`, `link.external`, `link.inclusive`, `styledBoxContent`; ikona vždy |

## 2. C7: udržanie spojenia

**Test** (`test/keepalive.test.ts`): `useHocuspocusServer` (predvolený `timeout` 60 s, ako v produkcii) + provider bez
awareness a s vypnutým watchdogom klienta, takže po synchronizácii klient nič neposiela. Falošné sú len
`setInterval`/`clearInterval`/`Date` (`vi.useFakeTimers({ toFake: [...] })`): interval crossws (ping každých 30 s, v
Hocuspocus sa skrátiť nedá – `crossws({ serverOptions })` neposiela `idleTimeout`) aj kontrola `timeout` Hocuspocus
bežia na falošnom čase, sokety, ws a pong sú skutočné; 6 kôl × 30 s (180 s falošného času = 3 kontroly), po každom
100 ms skutočného času na ping/pong. Očakáva žiadne zatvorenie a 6 pingov. Beží ~0,65 s.

vitest sám vždy importuje ESM build `@hocuspocus/server`, takže na CJS by C7 nič nedokázal. Test preto `vi.mock`-om dá
aplikácii build, ktorý by jej dal node podľa `type` v `package.json`: pri `"module"` pôvodný import, inak
`createRequire(...)('@hocuspocus/server')` (CJS build s vloženým crossws 0.4.4). Strážiť to bude aj návrat na CJS.

**Výsledky:**
- **CJS (beh 1 a 2): zlyhal**, `expected [ 4408 ] to deeply equal []` – Hocuspocus zatvoril nečinné spojenie
  `ConnectionTimeout` (2. kontrola, 120 s). Na finálnom kóde overené znova dočasným prepnutím `type` na `commonjs`
  (`package.json` obnovený bajt po bajte): opäť `[4408]`.
- **ESM (beh 3, 4): zelený**, 6 pingov, žiadne zatvorenie.
- **Bez falošného času** (`keepaliveRealtime.mjs`, samotný `Server` + provider, 135 s): CJS build – 0 pingov,
  **zatvorené 4408 po 120,0 s**, provider sa znova pripojil; ESM build – pingy v 30/60/90/120 s, **spojenie otvorené**
  (`keepalive-realtime-cjs.log`, `-esm.log`).
- **Skutočný štart** (hook `resolveLog.mjs`): `prod` aj `dev` načítajú `@hocuspocus/server/dist/hocuspocus-server.esm.js`
  a `crossws/dist/adapters/node.mjs` → `_chunks/node.mjs` (crossws 0.4.15 z `node_modules`, `HEARTBEAT_PING`,
  `idleTimeout ?? 30`).

## 3. Opravy

- **A1** `src/logger/sentryTransport.ts` (nový, `SentryTransport extends winston-transport`): rovnaké mapovanie úrovní ako
  balík, `tags`/`user` (ak sú objekt) a zvyšok záznamu ako extras, `error` → `captureException` (prvý `Error` v zázname,
  inak `Error` s menom/správou/stackom záznamu), inak `captureMessage(message, level)`, každý záznam v
  `Sentry.withScope` (žiadne `Scope.clear()`, nič neostáva v aktuálnom scope – balík to tam nechával). `appLogger.ts`
  ho používa s `level: 'warn'`. Balík `winston-transport-sentry-node` odstránený, `winston-transport ^4.9.0` pridaný ako
  priama závislosť (importuje sa), `logFilters` v `.yarnrc.yml` odstránené (bol to jediný záznam). Pozn.: tagy a user sa
  cez `useAppLogger` nikdy nedostanú na vrch záznamu (formát `metadata` ich presunie do `metadata`, `printf` zmaže
  `metadata.error`) – ako doteraz.
- **A2** `src/server/collaboration.ts`: `channelPrefix: \`${redisKeyPrefix}${streamName}\`` (`streamName =
  collab-${version}`), teda presne kľúč streamu, ako ho prefixuje ioredis. Komentár prečo.
- **A3** `src/index.ts`: `dataCollection: { cookies: false }`.
- **A4** `dev` cez tsx, overené spustením (nižšie).
- **A5** `src/config/config.ts`: `dotenv.config({ path, quiet: true })`.
- **10** `src/tiptap/nodes/Button.ts` a `marks/Link.ts`: `external` predvolene `true`; `Link` `autolink: true` (z neho
  `inclusive()` = `true`, ako v cms); `nodes/StyledBoxContent.ts`: `(paragraph | list)+`. Ikona nezmenená.
- **11** `src/index.ts`: `init().catch` → `captureException`, `console.error`, `await Sentry.close(2000)`,
  `process.exit(1)`. Overené: štart bez Mongo skončí kódom 1 po ~31 s (časový limit výberu servera mongoose).

## 4. Prechod na ESM

- `package.json` `"type": "module"`; `tsconfig.json` `module`/`moduleResolution` `nodenext`.
- **Prípony:** `krok5-praca/collab-esm/addJsExtensions.py` (mení len špecifikátor, ku ktorému existuje `.ts` alebo
  `/index.ts`): 330 špecifikátorov v 67 súboroch (`src` + `test`); nezmenený len `import('../package.json')`.
- **tsconfig `baseUrl` + `paths: { "*": ["node_modules/*"] }` odstránené.** tsx tieto `paths` uplatňuje za behu a
  obchádza nimi `exports` balíkov: `safe-stable-stringify` sa rozriešil na koreňový `index.js` a `dev` padol na
  `does not provide an export named 'configure'` (`start-dev*.tsx-cjs-hooks.log`). tsc bez nich prejde, emit sa
  nemení.
- **Interop (tsc + skutočné načítanie, `checkCjsInterop.mjs`):** `ioredis` → `import { Redis as Client }` (pod nodenext
  je predvolený import celý modul); `@ladjs/graceful` – typy hlásia ES default, balík robí `module.exports = Graceful`,
  takže za behu je default trieda: `GracefulModule as unknown as typeof GracefulModule.default` s komentárom;
  `ansi-colors` → predvolený import (menný priestor CJS nemá `cyan`, validátor by padol pri behu, `--help` by to
  neodhalil); `socket.io/dist/...` (typy, `exports` ich nepúšťa) → `ExtendedError`, `DisconnectReason` z `socket.io`,
  `Socket['handshake']`, návratový typ `(reason: DisconnectReason) => Promise<void>`. Ostatné menné importy z CJS
  (`cli-progress`, `@socket.io/redis-streams-adapter`, `@sesamecare-oss/redlock`, `mysql2/promise`, `mongoose`, `winston`,
  `dotenv`, …) Node rozpozná.
- `.prettierrc.js` → `export default` (pri `type: module` by `module.exports` padol).
- **Skripty:** `dev` = `NODE_OPTIONS="--import @sentry/node/import --import tsx/esm --max-http-header-size=65536" node
  src/index.ts`; `command:article:validate` = `NODE_OPTIONS="--import tsx/esm" node …`; `prod` bez zmeny (už má
  `--import @sentry/node/import`). `ts-node` (a nepoužívané `TS_NODE=true`) odstránené, `tsx ^4.23.15` v `dependencies`
  len preto, že tam bol `ts-node` (zdôvodnenie opravené v COLLAB-OPRAVY, R7): k8s obraz `src` nemá (kopíruje len `dist`,
  `node_modules`, `package.json`, `yarn.lock`, `.yarnrc.yml`, `docker/app/kubernetes/Dockerfile:11-14`), takže
  `command:article:validate` (`src/…ts`) by v pode padol na `ERR_MODULE_NOT_FOUND` ako predtým s `ts-node`; v pode by
  validátor bežal z `dist` (`node dist/command/articleValidatorCommand.js`), bez tsx. tsx potrebuje len `dev`, `watch` a
  validátor zo zdrojákov, teda mohol by byť v `devDependencies`. `watch` (nodemon → `yarn dev`) bez zmeny.
- **Poradie `--import` a `tsx/esm`:** Sentry najprv (dokumentácia Sentry cez ctx7: Sentry hook sa registruje pred
  modulmi aplikácie, až potom TS loader). Zistenie: s plným `--import tsx` Sentry injektoval v dev len `ioredis`, nie
  `mongodb` (v oboch poradiach) – tsx pre `require()` prepisuje `Module._extensions` (ctx7, `src/loader.ts`), čím obíde
  synchrónne `registerHooks` Sentry pre CJS, ktoré `require`-uje mongoose. S `tsx/esm` (len ESM hooky; `src` je celé
  ESM) dev injektuje `ioredis, mongodb` = rovnako ako `prod`. Lokálne je Sentry vypnutý (`APP_DEPLOY_ENV=local`), ide
  o zhodu dev s prod.
- **Spúšťače:** `bin/build` (`yarn install`, `yarn run build`), `bin/run` (`yarn dev|prod|watch`), `bin/release-sentry`
  (sentry-cli na `dist`), oba Dockerfile (`CMD ["start-command"]` → supervisor `yarn run prod` / lokálne `yarn run dev`;
  k8s obraz kopíruje `package.json` s `type: module`), `start-command` (`docker/app/*/bin/`), `azure-*.yaml` (šablóna,
  `runYarnBuild`) – nič z nich nevolá node priamo, zmena netreba. `sentry-cli sourcemaps inject` na kópii ESM `dist`:
  102/102 súborov s debug-id, `node --check` všetkých bez chyby, import funguje (`checkSentryInject.sh`).

## 5. Kontroly

- `yarn install` a `yarn dedupe` (lock: −1 balík; `dedupe --check` čisté). Peer varovania ostali len staré
  (`@hocuspocus/extension-*` → y-protocols/yjs); Sentry/winston-transport zmizlo.
- `yarn lint:fix` (preformátoval 3 testy), `yarn ci` (tsc, prettier `{src,test}`, eslint) **zelené**, `yarn build`
  (clean + lint + tsc) **zelené**, `yarn tsc` **zelené**, `yarn test` **50/50**.
- **Štarty** (`runStartChecks.sh`, `HOSTNAME` exportovaný ako v docker/k8s, služby z `.env` sú mená docker siete):
  všetky moduly sa načítali, nič nepadlo na importe; zastavia sa až pri pripojení.
  - `yarn prod`: `MongooseServerSelectionError: getaddrinfo ENOTFOUND mongo-anzu`, **exit 1 po 31 s** (bod 11).
    S hookom: ESM `@hocuspocus/server` + crossws 0.4.15, Sentry injektoval `ioredis, mongodb`.
  - `yarn dev` (tsx/esm): to isté, **exit 1 po 32 s**. S hookom v oboch poradiach `--import`: ESM build, crossws 0.4.15,
    Sentry `ioredis, mongodb`.
  - `yarn watch`: nodemon spustí `yarn dev`, ten padne na Mongo, nodemon „app crashed - waiting for file changes";
    ukončený `timeout` (exit 124 po 60 s).
  - `yarn command:article:validate --help`: nápoveda, exit 0. `--ids=1`: prejde načítaním modulov aj vytvorením
    progress baru (`colors.cyan`), padne na `getaddrinfo ENOTFOUND mysql-anzu` a **skončí kódom 0**. Tak isto pred ESM:
    koniec súboru je nezmenený (`execute().then(() => process.exit()).catch((error) => console.error(error))`, diff
    mení len importy), `catch` chybu iba vypíše a proces dobehne s 0. Neopravované (mimo zadania).
  - Pred prepnutím `HOSTNAME` (shell ho neexportuje) sa `prod` zastavil na konfigurácii (`Config value at path hostname
    not defined!`, exit 1 po 1 s), tiež až po načítaní všetkých modulov.
- **Schéma** (`dumpServerSchema.cjs` upravený pre ESM `dist` – `getSchema` z ESM buildu `@tiptap/core`, pôvodná verzia
  `collab-esm/dumpServerSchema.pred-esm.cjs`): proti `cms-schema-icons.json` **žiadny rozdiel** okrem poradia (D6);
  proti `cms-schema-noicons.json` len `icon` a `styledBoxTitle.content` (D5). D1–D4 zmizli (pred zmenou ich
  `compare.cjs` hlásil všetky štyri). `schema-compare-esm*.txt`.

## Zmenené súbory (collaboration)

`package.json`, `yarn.lock`, `.yarnrc.yml`, `.prettierrc.js`, `tsconfig.json`, nový `vitest.config.mts`, nový `test/`
(10 testov + `fixtures/articleBody.ts`, `support/hocuspocus.ts`), nový `src/logger/sentryTransport.ts`; vecné zmeny v
`src/index.ts`, `src/config/config.ts`, `src/logger/appLogger.ts`, `src/server/collaboration.ts`, `src/storage/redis.ts`,
`src/types/Socket.ts`, `src/server/event/listener/disconnectingListener.ts`,
`src/server/middleware/authorizationMiddleware.ts`, `src/command/articleValidatorCommand.ts`,
`src/tiptap/nodes/Button.ts`, `src/tiptap/marks/Link.ts`, `src/tiptap/nodes/StyledBoxContent.ts`; ostatné súbory v `src`
len prípony `.js`. Spolu 65 sledovaných súborov + 3 nové cesty. Changelog (`doc/Collaboration-Changelog/Unreleased`)
nepísaný – nebolo v zadaní.

## Poznámky mimo zadania (nemenené)

- **readOnly vetva `authorizeDocument` je zrejme nedosiahnuteľná:** `collaborationServer.in(roomName).fetchSockets()`
  vráti len sockety v `roomName`, a tie ho majú v `rooms`; socket len v `${room}:info` sa nevráti vôbec, používateľ
  dostane „User not connected". Test pokrýva kód, ako je napísaný (stub vráti socket bez `roomName`). Neoverené proti
  živému socket.io s reálnym klientom.
- Sentry 11 (`attachStacktrace` predvolene `true`): aj `captureMessage` pre `warn` nesie syntetický stack (vidno v
  teste) a podľa MIGRATION.md označí session ako errored. Platí pre každý `logger.warn`.
- CI (`azure-pipelines.yml`) má `runYarnTest: false`; testy sa v CI nespúšťajú, kým to vlastník nezapne.
- Hocuspocus `Server` má `stopOnSignals: true` (vlastný SIGTERM → `destroy` + `exit(0)`) popri `@ladjs/graceful` –
  existovalo predtým.

## Neoverené

Nasadenie a build Docker obrazu, beh v kontajneri (node 24.21) a supervisor; skutočné pripojenie k Mongo/Redis/MySQL
(štart končí na Mongo); viac inštancií s Redis adaptérom a `channelPrefix` naživo; Sentry server (odoslanie udalostí,
debug-id upload); prehliadač (admin-cms) proti ESM serveru; `yarn watch` reštart po zmene súboru.
