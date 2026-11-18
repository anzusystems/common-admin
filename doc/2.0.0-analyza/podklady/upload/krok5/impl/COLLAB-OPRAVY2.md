# COLLAB-OPRAVY2: kolaboračný server – druhý cyklus opráv

Zadanie `krok5-praca/zadania/zadanie-collab-opravy2.md`, body z posudkov `posudky/COLLAB-OPRAVY-opus.md` a
`posudky/collab-opravy-codex.md`. Repozitár `/home/volar/projects/petit/collaboration`, vetva `next`, HEAD `b03d20d` +
tieto opravy. **Nič necommitnuté**, žiadne vetvy, `stash` ani `checkout`; vlastníkova zmena `.gitignore` nedotknutá.
Skripty a logy (mimo `/tmp`): `/home/volar/projects/anzusystems/krok5-praca/collab-opravy2/`. Ťažké kroky až po skončení
výkonového merania (`campaign.mjs`), vždy len jeden, pred každým > 10 GB voľných.

**Ako sa potvrdzovalo:** stav pred opravami = HEAD. Nové testy bežali aj proti src z HEAD (`git archive` do kópie
`overenie-stary/`, `overenie-stary-kod.sh` → `overenie-stary-kod.log`): **15 červených / 62 zelených**, červené sú presne
testy bodov a–f a H2 (dva staršie testy purge len preto, že teraz overujú aj dĺžku zámku). Na opravenom kóde **77/77**
(14 súborov). Skutočné procesy pred/po: `pred/dist` (build HEAD) proti novému `dist`, `pred-src/` proti repozitáru.

## Body

### a) `timeoutMs` Graceful — **potvrdené**
- Stav: `timeoutMs` nenastavený → 5000 ms (`@ladjs/graceful/index.js:20`), potom `process.exit(1)` (`:267-281`).
- Rozpočet z manifestu a skriptu: `app-deployment.yaml:31-34` volá `pre-stop-container --supervisor --node-server`
  zo základného obrazu `node24:2.0.0-nginx-browsers` (prečítané len na čítanie cez `az devops invoke`, repozitár
  `DevOps/node24`, tag `2.0.0`, `build/nginx-browsers/usr/local/bin/pre-stop-container`, kópia `node24-image/`):
  `sleep 15` (označený nezdravý) → `supervisorctl stop node-server` (supervisor 4.2.5 pošle `yarn run prod` SIGTERM,
  yarn ho pošle nodu; čaká `stopwaitsecs`, **predvolene 10 s**, potom SIGKILL len yarnu) → čakanie na PID po 1 s →
  `sleep 1` → `nginx -s quit` + čakanie po 1 s → `sleep 1` → `touch` + `sleep 1` → `pkill supervisord` → `start-command`
  ešte `sleep 1`. Mimo nodu ≈ 15 + ~7 s (+ spustenia `supervisorctl`) z 60 s → na node ~38 s.
- Oprava: `src/index.ts` `shutdownTimeout = 30000` (rezerva ~8 s) s komentárom výpočtu. **Navyše nutné:**
  `docker/app/kubernetes/etc/supervisor/conf.d/node-server.conf` `stopwaitsecs=35` – inak supervisor zabije yarn po
  10 s a 30 s by neplatilo. Najhorší prípad 15 + 35 + ~7 = 57 s < 60 s.
- Test `index.test.ts` „waits for a destroy of 6 s instead of exiting with 1" (falošný čas): `exit` len `[0]`, žiadna
  chyba; starý kód `exit(1)` po 5 s. Skutočný proces (`sig-run.sh`, preload `sig-trace.mjs` oneskorí `destroy` o 6 s):
  pred `exit 1` po 5,0 s („Graceful exit failed, timeout of 5000ms"), Mongo neodpojené, Sentry nezatvorené
  (`sig-pred-term-destroy6s.log`); po `exit 0` po 6,0 s (`sig-po-term-destroy6s.log`).

### b) Zámok `purgeRoom` — **potvrdené**
- Stav: `executeRoomManagementAction` bez dĺžky → 1000 ms, purge pritom čaká dvakrát na `fetchSockets()` naprieč podmi
  (timeout adaptéra 5000 ms, `socket.io-adapter/dist/cluster-adapter.js:20`).
- Oprava `purgeRoomListener.ts`: `purgeRoomLockDuration = 12000` (2 × 5 s + Redis). Autorizácia nezmenená.
- Test `purgeRoomListener.test.ts` „keeps the room locked until it has kicked the sockets…": mock zámku s exspiráciou
  (1000 ms, ak akcia nepýta inú), `fetchInfo` aj `fetchSockets` po 4,9 s → vyhodenie pod platným zámkom; starý kód červený.

### c) Poradie vypínania — **potvrdené**
- Stav: Graceful zatvára `redisClients`/`mongooses` až po všetkých custom handleroch (`index.js:298-303`), teda po Sentry;
  `Sentry.close()` bez limitu.
- Oprava `src/index.ts`: jeden custom handler v poradí socket.io, Hocuspocus `destroy`, MySQL, fronta, worker (naraz,
  chyby sa logujú) → Redis + Mongo → `Sentry.close(sentryCloseTimeout)` (2000 ms) ako posledný; Graceful už Redis ani
  Mongo nedostáva.
- Test `index.test.ts` „closes everything on SIGTERM…": Redis/Mongo po všetkých serveroch, Sentry po oboch, limit 2000,
  posledné pred „Gracefully exited". Skutočný proces: trace `… mongoose.disconnect done → Sentry client.close start (2000)
  → Gracefully exited → process.exit(0)` (`sig-po-term.log`).

### d) Opakované signály a SIGQUIT — **potvrdené**
- Stav: Graceful počúva SIGTERM/SIGHUP/SIGINT cez `process.once` (`index.js:129-133`), SIGQUIT nikto
  (Hocuspocus `stopOnSignals: false`).
- Oprava: po štarte vypínania handler pridá trvalé listenery pre SIGTERM, SIGHUP, SIGINT, SIGQUIT (ďalší signál len
  zaloguje „Graceful exit already in progress"); `process.once('SIGQUIT', …)` spustí vypínanie.
- Testy `index.test.ts`: druhý SIGTERM (listener ostane, „already in progress" 1×, `destroy` 1×, `exit` `[0]`); SIGQUIT
  vypne. Skript s dvoma signálmi (`sig-all.sh`): pred – druhý SIGTERM po 1 s **zabil proces uprostred `destroy`
  (exit 143)**, SIGQUIT exit 131 bez vypnutia; po – exit 0 po 6 s v oboch, SIGQUIT exit 0. Cez `yarn run prod` yarn
  SIGTERM preposiela a končí kódom nodu (0).
- Kozmetické: iný druh signálu počas vypínania (SIGINT/SIGHUP/SIGQUIT po SIGTERM) zaloguje dvojicu riadkov dvakrát
  (zvyšný `once` listener + nový), `sig-po-term-quit-int-destroy6s.log`.

### e) `error` listener v `onUpgradeHook.ts` — **potvrdené, aj pád procesu**
- Node pred `upgrade` zoberie socketu svoj `error` listener (skript: „error listeners … before the hook: 0").
- Oprava: pred odpoveďou 403 `socket.on('error', () => socket.destroy())`.
- Overenie `e-upgrade.mts` (Hocuspocus len s týmto hookom): klient pošle upgrade s cudzím Origin a spojenie zruší (RST).
  Pred: zadržaný upgrade → **proces padol** „Unhandled 'error' event … write ECONNRESET", exit 1; prirodzený súbeh
  **210 z 300** klientov = nezachytená chyba. Po: 0 z 300, proces žije. V aplikácii po `gracefulShutdown.listen()` ju
  zachytí `uncaughtException` Graceful (`fatal` + udalosť Sentry za každého klienta), pred ním (štart) pád.
- Test `hocuspocus.test.ts` „refuses the upgrade of a client that has reset its connection already…": rozšírenie
  zadrží upgrade, klient RST, synchrónne `Atomics.wait` 50 ms (bez obrátky slučky, ktorá by RST prečítala skôr), potom
  odpoveď; žiadna `uncaughtException`. Stabilita `e-stabilita.log`: starý kód 3/3 červený, nový 3/3 zelený.

### f) `config.ts:142` — **potvrdené**: `config!}` → `config!`; `config.test.ts` porovnáva celú správu (starý červený).

### g) `typescript` `~7.0.2` — hotové
- `package.json`; `yarn install`: v `yarn.lock` len tri riadky deskriptora `^` → `~`, rozlíšenie ostáva 7.0.2
  (`kontrola-yarn-lock.diff`), staré varovanie YN0086; `yarn dedupe --check` čisté.

### H2 – súbeh prvého načítania so zmeneným JSON — **potvrdené, opravené**
- Oprava: `exectionLockHelper.ts` `executeDocumentBuildAction` – `redlock.using` na `lock:document:<dokument>`, 5000 ms s
  automatickým predlžovaním počas stavby (po páde držiteľa vyprší), čakanie 60 × 200 ± 50 ms = 9–15 s, teda dlhšie než
  zámok mŕtveho držiteľa; zámok na dokument, ostatné neblokuje. `fetchDocument.ts`: Mongo bez zámku; ak nič, pod zámkom
  znova Mongo, až potom JSON → stavba → uloženie. Druhý pod počká a načíta z Mongo. Odvodené `clientID` ostáva ako
  poistka (stavba proti staršej, ktorú drží klient, alebo po vypršanom zámku).
- Skript `h2-race2.mts` (dva `Server` + Redis extension v jednom procese, Mongo v pamäti, Redis `fix2-collab-redis`,
  pri `H2_CHANGE=1` sa JSON zmení hneď po prvom čítaní): pred – rovnaký JSON 0/12, **zmenený 4/12 a 5/8 (Mongo 20 ms)
  zdvojených** (89 uzlov, uložené 90); po – 0/12, 0/12, 0/8, room data čítané raz, čakajúci klient synchronizovaný po
  175–308 ms.
- Testy: `exectionLockHelper.test.ts` (5, skutočný Redlock nad Redisom v pamäti s jeho tromi skriptmi): jeden dokument
  postupne, dva naraz, predĺženie pri 7 s stavbe, prevzatie po 5 s mŕtveho držiteľa, vzdanie po 9–15 s bez spustenia.
  `document.test.ts`: dve inštancie, zmenený JSON → `getData` raz, rovnaká aktualizácia, telo raz.

## Kontroly (`kontroly.sh`, `VITEST_MAX_WORKERS=2`)
`yarn install` ok, `yarn dedupe --check` ok, `yarn lint:fix` ok, `yarn ci` ok, `yarn test` **77/77** (~7 s),
`yarn build` ok, `yarn tsc` ok. Prod štart z `dist` s `.env` (`start-prod.sh`): `getaddrinfo ENOTFOUND mongo-anzu`,
exit 1 po 32 s. Docker: len `fix2-collab-redis` (6289) a `fix2-collab-mongo` (27227), na konci `docker rm -f -v`;
`perf-collab-*` nedotknuté.

## Zmenené súbory (collaboration)
`src/index.ts`, `src/config/config.ts`, `src/server/document/fetchDocument.ts`, `src/server/document/onUpgradeHook.ts`,
`src/server/event/listener/purgeRoomListener.ts`, `src/util/helper/exectionLockHelper.ts`,
`docker/app/kubernetes/etc/supervisor/conf.d/node-server.conf`, `package.json`, `yarn.lock`; testy `index.test.ts`,
`hocuspocus.test.ts`, `document.test.ts`, `purgeRoomListener.test.ts`, `config.test.ts`, nový `exectionLockHelper.test.ts`.

## Neoverené / otvorené
- Supervisor a `pre-stop-container` len čítané (obraz sa nebuildoval); časy `supervisorctl` odhadnuté.
- H2 v jednom procese s Mongo v pamäti, nie dva skutočné pody.
- Krok vypínania, ktorý visí až po 30 s: Graceful `exit(1)`, Sentry sa nevyprázdni (zvyšok L3).
- Nezmenené mimo zadania: retry získania zámku purge ~0–4 s (L5), autorizácia purge (vlastník), M1, L4.
- Všimnuté, nemenené: `config.ts:131` `value === typeof 'object'` porovnáva s reťazcom `'string'`.
