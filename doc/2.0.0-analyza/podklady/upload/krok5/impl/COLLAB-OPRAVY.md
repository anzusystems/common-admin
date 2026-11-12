# COLLAB-OPRAVY: kolaboračný server – cyklus opráv po posudkoch COLLAB-ESM

Zadanie `krok5-praca/zadania/zadanie-collab-opravy.md`. Repozitár `/home/volar/projects/petit/collaboration`, vetva `next`,
pracovný strom = 7262b58 + necommitnutá práca COLLAB-ESM + tieto opravy. **Nič necommitnuté**, žiadne vetvy, `stash` ani
`checkout`; lokálna zmena `.gitignore` (vlastníkova) nedotknutá. Záloha stavu pred opravami, skripty a logy (prežijú reštart):
`/home/volar/projects/anzusystems/krok5-praca/collab-opravy/` (`zaloha-pred-opravami.tar.gz`, `.diff`). `COLLAB-PERF.md` ešte
neexistuje; SENTRY podľa zadania preskočené (`Sentry.init` v `src/index.ts` nezmenený).

**Ako sa potvrdzovalo:** nové testy bežali aj proti kódu pred opravami (src zo zálohy v kópii mimo repozitára,
`overenie-stary-kod.sh` → `overenie-stary-kod.log`): **15 červených / 51 zelených**, červené sú presne testy opráv R2 (2),
R5, H2, H3, H4, H5 (2), H6 (2), X1 (4), X2. Na opravenom kóde **66/66** (13 súborov; predtým 50 v 10).

## Body

### R2 – Sentry dostane pôvodnú chybu — **potvrdené**
- Stav: `printf` v `src/logger/appLogger.ts` mazal `metadata.error` a `metadata.context` priamo v zázname, ktorý potom dostanú
  transporty; `SentryTransport` hľadal `Error` len na vrchu záznamu, takže `logger.error('Job failed.', { error })` (napr.
  `src/bullmq/queue.ts:35`) poslal do Sentry syntetický `Error: Job failed.`. Nový test na starom kóde: `type 'Error'`,
  `value 'Job failed.'` namiesto `TypeError: Lock lost.`.
- Oprava: `printf` pracuje s kópiou `metadata` (výstup na konzolu je rovnaký); `SentryTransport` berie prvý `Error` z vrchu
  záznamu, inak z `metadata.error`, inak syntetický ako doteraz. V extras Sentry je teraz aj `metadata.error` (a `context`).
- Testy: `logger.test.ts` „sends the error passed with the record as the exception" (cez `useAppLogger`: typ, správa, stack
  s rámcom z testu, extras); `sentryTransport.test.ts` „takes the Error from the metadata of the record".
- Súbory: `src/logger/appLogger.ts`, `src/logger/sentryTransport.ts`, oba testy.

### R3 – readOnly prípad podľa skutočnosti — **potvrdené (chybný test), kód nemenený**
- Stub `useCollaboration` v `test/hocuspocus.test.ts` vracia ako socket.io len sockety v danej miestnosti
  (`filter(socket.rooms.has(room))`). Prípad „keeps a read-only client from writing" nahradený prípadom „refuses a user who is
  only in the info room" (`permission-denied`, dokument sa nenačíta). `authorizeDocument.ts` nezmenený.
- Pozn.: jednotkový `test/authorizeDocument.test.ts` má stále prípad readOnly vetvy s nemožným stubom (pokrýva kód, ako je
  napísaný); zadanie ho nemenovalo, nechal som ho.

### R4 – „pod warn nič" s `LOG_LEVEL=debug` — **potvrdené (test nič nedokazoval)**
- Prípad v `test/logger.test.ts` nahradený: `vi.stubEnv('LOG_LEVEL', 'debug')` + `vi.resetModules()` + nový import
  `appLogger`, `debug` a `info` → 0 udalostí.
- Overené dočasným odstránením `level: 'warn'` (v kópii opraveného kódu, `overenie-bez-level.log`): tento test **červený**,
  ostatných 5 zelených; s `level: 'warn'` zelený.

### R5 – `callback()` vo `finally` — **potvrdené (spevnenie)**
- `SentryTransport.log`: `withScope` v `try`, `callback()` vo `finally` (výnimka ďalej prebuble, transport neostane `writing`).
- Test: `sentryTransport.test.ts` „calls back even when Sentry throws" (tagy ako `Proxy`, ktorého `ownKeys` hodí – Sentry ich
  rozbaľuje v `setTags`): `log` hodí a callback je zavolaný raz. Na starom kóde callback nezavolaný.

### R6 – keepalive čaká na skutočný pong — **potvrdené (test)**
- `test/keepalive.test.ts`: na serverovom konci spojenia
  (`server.hocuspocus.documents.get(…).getConnections()[0].webSocket`) počítadlo `pong`; po každom kole falošného času čaká
  skutočný čas, kým server pong nemá, najviac 2 s a nie po zatvorení. Očakáva 0 zatvorení, 6 pingov, 6 pongov.
- ESM: zelený, ~0,1 s. Kópia s `"type": "commonjs"` (CJS build bez heartbeatu, `overenie-cjs.log`): **červený**
  `expected [ 4408 ] to deeply equal []` po 6,2 s (nie na časovom limite testu).

### R7 – zdôvodnenie `tsx` v `dependencies` — **opravené v COLLAB-ESM.md §4**
- k8s obraz nemá `src` (`Dockerfile:11-14`), `command:article:validate` zo `src` by v pode padol rovnako ako s `ts-node`; v pode
  by validátor bežal z `dist` bez tsx. tsx je v `dependencies` len na mieste `ts-node`, mohol by byť v `devDependencies`.

### R8 – testy v CI — **zistené čítaním šablóny, upravené**
- Šablóna prečítaná cez `az devops invoke` (len čítanie; `DevOps/azure-ci-template`, `node-ci.yaml`, `_modules/ci/yarn.yaml`;
  kópie `template-*.yaml`): pri `runYarnBuild` + `runYarnTest` job „Yarn build and test": `yarn install`, `yarn run build`,
  `yarn run test`, potom `PublishCodeCoverageResults@2` (`**/cobertura-*.xml`) a `PublishTestResults@2` (JUnit,
  `**/TEST-*.xml`, `failTaskOnFailedTests: true`).
- `azure-pipelines.yml`: `runYarnTest: true`. Skript `test` (`vitest run`) už sedí. `vitest.config.mts`: pri `TF_BUILD`
  (Azure Pipelines) navyše reportér `junit` do `TEST-vitest.xml` (lokálne sa nič nezapisuje; overené v kópii,
  `overenie-junit.log`). Premenné pipeline (`MONGODB_URL`, `REDIS_URL`…) testy neovplyvnia – `test.env` ich prebije (overené,
  `overenie-ci-env.log`). Pokrytie (cobertura) sa negeneruje (chýba `@vitest/coverage-v8`); či úloha pokrytia bez súboru len
  varuje, **neoverené**.
- Typová kontrola testov: `test/tsconfig.json` (extends koreňový, `noEmit`, `resolveJsonModule`, `test/**` +
  `vitest.config.mts`), skript `lint:tsc:test` (`tsc -p test`) v `ci` aj `lint:fix` (teda aj v `build`). Prešla.

### X1 – `purgeRoom` — **potvrdené**
- Kto volá: common-admin `useCollabRoom().purgeRoom()` (`src/domains/collab/composables/collabRoom.ts:402-405`), tlačidlo v
  `ACollabManagement.vue:448-462` len pri `isAllowedToPurgeRoom`; admin-cms ho dáva len super adminovi
  (`ArticleTopbar.vue:109`, `BoxBuffer.vue:543-548`, `BoxTimeline.vue:619-624` cez `boxCollabRoom.ts:174-176`). Super admin
  nemusí byť ani moderátor, ani člen: v detaile článku je len v `${room}:info` (`ArticleDetailView.vue:129`), pri editácii a
  v boxoch v miestnosti. JWT nesie len `sub` (COLLAB-STATS §9.3), rolu server nevidí.
- Oprava (`purgeRoomListener.ts`): vyčistí len socket, ktorý je v miestnosti alebo v jej info miestnosti (inak `warn` a nič);
  moderátor sa nevyžaduje (čistenie je na pokazenú miestnosť, moderátor môže byť preč). Celé čistenie beží pod zámkom
  miestnosti `executeRoomManagementAction` ako ostatné listenery; zlyhanie (aj zámku) sa loguje ako doteraz.
- **Otvorené pre vlastníka:** skutočná kontrola super admina na serveri (volanie core-cms alebo `roles` z MySQL, ako v
  COLLAB-STATS §9.3). Dnešná kontrola zastaví len socket, ktorý miestnosť nemá otvorenú; info miestnosť si vie otvoriť
  ktokoľvek s platným JWT.
- Test `test/purgeRoomListener.test.ts` (4): čistí socket v miestnosti aj v info miestnosti, pod zámkom (záznam, či čistenie
  bežalo vnútri akcie), vyhodí sockety; odmietne socket bez miestnosti; zlyhanie zámku zaloguje a nič nezmaže.

### X2 – prvý vstup do prázdnej miestnosti zmaže voľby — **potvrdené**
- `joinCollabRoomListener.ts`: `upsertRoomOptions` → `fetchInfo` → pri prázdnej miestnosti `purgeCollabStorage`, ktorý maže aj
  `${room}:options` (`roomUserManager.ts:245-247`). Nový test na starom kóde: odpoveď na vstup `status: 'inactive'`,
  `allowedSameUser: false` namiesto `active` a zadaných volieb.
- Oprava: po vyčistení prázdnej miestnosti sa voľby tohto vstupu zapíšu znova (poradie: vyčistenie, potom voľby). Stav
  prvého `fetchInfo` sa počíta ako doteraz z volieb vstupu.
- Dopad: miestnosti s `allowedSameUser` – boxy DM (`distributionManagementCollab.ts:74-77`), scenáre
  (`articleScenarioJobCollab.ts:55`), inbox. Čo to robilo v UI, neoverené.
- Test `test/joinCollabRoomListener.test.ts`: skutočný listener, `roomUserManager`, `roomOptionsManager` a aktivita nad
  Redisom v pamäti; vstup s `allowedSameUser: true` do prázdnej miestnosti so starými voľbami → `active`, voľby vstupu v Redise.

### H2 – súbeh prvého načítania na dvoch podoch — **potvrdené, opravené**
- Skript `h2-race.mts` (`h2-run.sh`): dva Hocuspocus `Server` + Redis extension v jednom procese, `fetch`/`store` aplikácie,
  Mongo ako jedna zdieľaná mapa (2 ms na operáciu), dáta miestnosti v Redise (`fix-collab-redis`, Redis 7.2.4,
  127.0.0.1:6279), telo 44 uzlov, dvaja klienti na rôznych serveroch, po zhode klientov úprava prvého klienta.
- **Pred opravou** (`h2-pred-opravou.log`): pri súčasnom otvorení **5 z 5 zdvojených** – obaja klienti 88 uzlov, dva
  klientske ID stavby; po úprave Mongo **89 uzlov**. Pri odstupe 10/50/200 ms v poriadku. S 10 ms na operáciu Monga zdvojené
  aj pri 5 ms odstupe (`h2-pred-opravou-mongo10.log`) – okno ≈ čas od `findOne` po zápis.
- Oprava `src/server/document/fetchDocument.ts`: Y.Doc z JSON sa stavia s `clientID` = prvé 4 B SHA-256 z `version` + JSON
  (`prosemirrorJSONToYXmlFragment` do vlastného `Y.Doc`, schéma raz pri štarte; `TiptapTransformer` tu už netreba). Rovnaká
  verzia a obsah dajú bajtovo rovnakú aktualizáciu, Yjs ju zlúči; iný obsah alebo iná verzia (iná schéma pri rolling
  deploy) dostane iné ID, takže sa položky rôznych stavieb nikdy nezrazia (pri inej verzii ostáva najhorší prípad zdvojenie).
- **Po oprave tým istým skriptom** (`h2-po-oprave.log`, `-mongo10.log`): **0 z 12** a **0 z 5** zdvojených, Mongo 45 uzlov.
- Testy `document.test.ts`: dve inštancie postavia rovnakú aktualizáciu a zlúčenie dá telo raz; iný obsah → iné ID; iná
  verzia → iné ID (`stubEnv` + `resetModules`).

### H3 – `state` z payloadu — **potvrdené čítaním**
- extension-database posiela `state` (`Database.ts:56-61`); `storeDocument.ts` ho ukladá namiesto druhého
  `encodeStateAsUpdate`. Test: `store` s prázdnym `document` a `state` iného dokumentu uloží `state` (starý kód uložil
  prázdny dokument).

### H4 – `debounce: 5000`, `maxDebounce: 30000` — hotové
- `src/server/hocuspocus.ts`. Test `hocuspocus.test.ts` „stores an edit … once the edits pause for 5 s": uloženie najskôr po
  4,9 s (starý kód: 2,0 s, červený). `maxDebounce` netestovaný (30 s nepretržitých úprav).

### H5 – `stopOnSignals: false` a poradie zatvárania — **potvrdené**
- Skript `h5-sigterm.sh` + `h5-trace.mjs` (prod z `dist`, `fix-collab-redis` + `fix-collab-mongo`, SIGTERM po štarte).
  **Pred opravou** (`h5-pred-opravou.log`): Hocuspocus vlastným handlerom `process.exit(0)` po 8 ms
  (`hocuspocus-server.esm.js:1707`) – `worker.close` nedobehol, hlavný Redis a Mongo sa nezatvorili, „Gracefully exited" chýba;
  `Sentry.close` bežal súčasne s ostatnými.
- Oprava: `stopOnSignals: false` (`hocuspocus.ts`); v `src/index.ts` graceful naďalej spúšťa handlery naraz, ale handler
  Sentry čaká na ostatné (`Promise.allSettled`), Redis a Mongo zatvára graceful až po všetkých. **Po oprave**
  (`h5-po-oprave.log`): socket.io, Hocuspocus `destroy`, fronta a worker → Sentry → Redis + Mongo → „Gracefully exited" →
  `process.exit(0)` z `Graceful.exit`.
- Testy: `test/index.test.ts` (SIGTERM cez `process.emit` na `index.ts` s mockami, poradie krokov; starý kód červený);
  `hocuspocus.test.ts` „leaves the signals to the graceful shutdown" (počet listenerov SIGINT/SIGQUIT/SIGTERM sa nezmení).

### H6 – `maxPayload` a kontrola `Origin` — hotové
- `websocketOptions.maxPayload` = **10 MiB** (predvolene 100 MiB). Zdôvodnenie: najväčšia správa klienta je celé telo
  (synchronizácia klienta so serverom, ktorý dokument stratil). Telo vstupuje do kolaborácie v potvrdení `startCollab` cez
  socket.io, ktorého `maxHttpBufferSize` je 1e6 B (engine.io `server.js:44`, u nás nemenené) a nesie dáta všetkých polí; stav
  Y.Doc je 1,06–1,07× JSON a po histórii úprav 0,87× (`h6-sizes.log`). 10 MiB je ~9× rezerva na rast tela počas relácie.
  Väčšia správa: ws zatvorí spojenie kódom 1009.
- `onUpgrade` (`src/server/document/onUpgradeHook.ts`): `new RegExp(collaborationCors).test(origin)` ako socket.io; inak
  `warn` „WebSocket upgrade from origin … blocked", odpoveď 403 a zamietnutie bez chyby (Hocuspocus upgrade nespraví). nginx
  posiela `Origin` obom upstreamom rovnako. Testovací WebSocket posiela povolený `Origin` (`test/support/hocuspocus.ts`).
- Testy `hocuspocus.test.ts`: povolený Origin → 101; cudzí → 403 + `warn`; správa 10 MiB + 1 B → zatvorenie 1009. Starý kód:
  cudzí Origin 101; správu zavrel až Hocuspocus kódom 4205 (limit fronty neautentifikovaného spojenia 5 MiB, po prijatí celej
  správy) – autentifikovaný klient by limit nemal žiadny okrem 100 MiB.

### R10 – Docker obraz — **preskočené**
- Základ `petitpress.azurecr.io/node24:2.0.0-nginx-browsers` nie je lokálne, `docker pull` → `authentication required`
  (`r10-pull.log`). Neprihlasoval som sa, nebuildoval, kontajner `fix-collab-run` nevznikol. Staticky: Dockerfile kopíruje
  `dist`, `node_modules`, `package.json` (`type: module`), `yarn.lock`, `.yarnrc.yml`; supervisor `yarn run prod`.
  `.dockerignore` vylučuje `dist` a `node_modules`, release šablóna má na to `dockerBuiltDirs: 'dist node_modules'` (ako ich
  vracia, neoverené). Node verzia v obraze neoverená.

## Kontroly (`kontroly.sh`, VITEST_MAX_WORKERS=2, pred každým krokom > 11 GB voľných)
- `yarn install`: bez zmeny `yarn.lock` (porovnané so zálohou), staré peer varovanie YN0086. `yarn dedupe --check`: čisté.
- `yarn lint:fix`: prettier preformátoval 3 nové testy. `yarn ci` (tsc, tsc testov, prettier, eslint): zelené.
- `yarn test`: **66/66**, 13 súborov, ~5,6 s. `yarn build`: zelený. `yarn tsc`: zelený.
- Prod štart z `dist` s `.env` bez služieb (`start-prod.sh`): všetky moduly načítané, `MongooseServerSelectionError: getaddrinfo
  ENOTFOUND mongo-anzu`, **exit 1 po 31 s**.
- Docker: vznikli len `fix-collab-redis` a `fix-collab-mongo`, na konci zmazané (`docker rm -f -v`); `perf-collab-*` nedotknuté.

## Zmenené súbory (collaboration)
`src/index.ts`, `src/logger/appLogger.ts`, `src/logger/sentryTransport.ts`, `src/server/hocuspocus.ts`,
`src/server/document/fetchDocument.ts`, `src/server/document/storeDocument.ts`, nový `src/server/document/onUpgradeHook.ts`,
`src/server/event/listener/joinCollabRoomListener.ts`, `src/server/event/listener/purgeRoomListener.ts`; testy
`hocuspocus.test.ts`, `keepalive.test.ts`, `logger.test.ts`, `sentryTransport.test.ts`, `document.test.ts`,
`support/hocuspocus.ts`, nové `index.test.ts`, `joinCollabRoomListener.test.ts`, `purgeRoomListener.test.ts`,
`test/tsconfig.json`; `package.json` (len skripty), `vitest.config.mts`, `azure-pipelines.yml`. V common-admin
`doc/…/COLLAB-ESM.md` (R7) a tento súbor.

## Neoverené / otvorené
Kontrola super admina pri `purgeRoom` (rozhodnutie vlastníka); obraz a kontajner (R10); `maxDebounce`; skutočné dva pody
s Mongo a sieťou (H2 overené v jednom procese s Mongo v pamäti); dopad X2 v UI; správanie úlohy pokrytia v CI bez súboru.
