# COLLAB-OPRAVY3: kolaboračný server – tretí cyklus opráv (8 bodov z posudkov pred pushom)

Zadanie `krok5-praca/zadania/zadanie-collab-opravy3.md`, body z `posudky/collab-final-codex.md` (High, Medium) a
`posudky/COLLAB-FINAL-opus.md` (L1–L4); body 7–8 (L5, L6) doplnil vedúci po schválení vlastníkom. Repozitár `/home/volar/projects/petit/collaboration`, vetva `next`, HEAD
`bb09e4e` + tieto opravy. **Nič necommitnuté**, žiadne vetvy, `stash`, `reset` ani `checkout`; vlastníkova zmena
`.gitignore` nedotknutá. Skripty a logy (mimo `/tmp`): `/home/volar/projects/anzusystems/krok5-praca/collab-opravy3/`.

**Ako sa potvrdzovalo:** stav pred = HEAD `bb09e4e`. Nové testy bežali aj proti src z HEAD (`overenie-stary-kod.sh` →
`overenie-stary-kod.log`): **23 červených / 74 zelených**: 19 z 20 nových testov (zelený je len test rýchlej akcie bez
predlžovania) a 4 upravené (`$setOnInsert` 2 ×, purge 12,8 s, Sentry 1500). Časť z nich je na starom kóde červená len preto, že starý kód signál nepredáva, funkciu nemá alebo loguje
iný text (uvoľnenie zámku miestnosti, ktoré starý kód už ošetroval). Skutočné správanie pred/po ukazujú skripty s
dvoma servermi, so skutočným Redisom a so skutočným procesom. Na opravenom kóde **97/97** (16 súborov).

**Skript s dvoma `Server` (body 1–3):** `zamok.mts` + `zamok-all.sh pred|po`. Dva Hocuspocus servery s Redis extension
v jednom procese (dva pody), vlastné `fetch`/`store` danej verzie src, **skutočný Redis** (`fix3-collab-redis`, 6389) aj
**skutočné MongoDB 8.0.20** (`fix3-collab-mongo`, 27327). Čítanie room data na A sa pozdrží (stavba trvá tak dlho), zámok
sa stratí zmazaním kľúča `fix3z_collab:lock:document:…` v Redise počas stavby; C1 otvorí dokument na A po skončení
načítania na A. Logy `zamok-pred-*.log`, `zamok-po-*.log`.

| scenár | pred (`bb09e4e`) | po |
|---|---|---|
| `lost-before-extension` (stavba A 4 s, kľúč zmazaný v 0,5 s, B postaví zmenený JSON, editor B upraví) | A v 4,06 s **prepísal** v Mongo dokument B (aj s úpravou) pôvodnou stavbou; A1 **odmietnutý** (`permission-denied`, zlyhané uvoľnenie); C1 načíta prepísaný → B1 aj C1 **90 uzlov, 2 telá** | A v 4,04 s `$setOnInsert` → nechal dokument B a načítal ho; A1, B1, C1: 46 uzlov, zmenený JSON + úprava B; Mongo rovnako |
| `lost-after-extension` (to isté, stavba A 6 s) | prepis v 6,03 s; A zlyhá až v 16,7 s (čaká na ~10 s opakovaní predĺženia, potom uvoľnenie); B1, C1 **2 telá** | A nezapísal nič (signál prerušený po zlyhanom predĺžení), načítal dokument B; všetci rovnako, bez zdvojenia |
| `release-fails` (stavba A 1 s, kľúč zmazaný v 0,5 s, nikto iný) | uložené, ale A1 **odmietnutý** | A1 synchronizovaný v 1,07 s; len `warn` „Could not release execution lock …" |
| `stuck-holder` (stavba A 20 s, B otvorí v 1 s, zmenený JSON) | B čaká 12,3 s, **B1 odmietnutý** v 13,4 s; A1 až v 20 s | A uvoľní v 8 s, B postaví v 8,15 s, B1 v 8,3 s; A v 20 s nezapísal, načítal dokument B; všetci 45 uzlov, zmenený JSON |

## Body

### 1. (Codex High) Stratený zámok neprepíše novší dokument – **potvrdené, opravené**
- Stav: `executeDocumentBuildAction` (`redlock.using`) signál zahadzoval, `fetchDocument.ts` zapisoval
  `findOneAndReplace` bez podmienky. Potvrdené skriptom (riadky 1–2 tabuľky): prepis novšieho dokumentu aj s úpravou
  editora, následné zdvojenie tela.
- Oprava `fetchDocument.ts`: stavba sa ukladá `updateOne({ name }, { $setOnInsert: { data } }, { upsert: true })`; ak
  `upsertedCount` je 0 (dokument medzitým uložil iný pod), načíta a vráti uložený. Pred zápisom `signal.aborted`: ak je
  zámok stratený, nezapisuje vôbec, vráti uložený dokument, a ak žiadny nie je, zlyhá („Lost the build lock of document
  … before it was stored!"). Signál dáva nový pomocník (bod 3), nie `using`.
- Overené na skutočnom Mongo: vložený dokument má rovnaký tvar (`data` pole s jedným reťazcom, `createdAt`/`updatedAt`,
  TTL index platí; navyše `__v: 0` od upsertu). Súbeh (`upsert-race.mts`): 200 kôl dvoch `$setOnInsert` naraz →
  200 vložených, 200 ponechaných, **0 chýb** (server opakuje upsert pri duplicitnom kľúči `name`), vždy jeden dokument.
- Testy `document.test.ts`: lease vypršal nepozorovane a iný pod medzitým uložil upravený dokument → vráti ten, Mongo
  nezmenené; signál prerušený → `updateOne` sa nevolá, vráti uložený; prerušený a nič uložené → chyba, bez zápisu.

### 2. (Opus L1) Chyba uvoľnenia neprepíše výsledok – **potvrdené, opravené**
- Stav: `using` v `finally` volá `release()` bez ošetrenia; skript `release-fails` pred: uložené, no A1 odmietnutý.
- Oprava `exectionLockHelper.ts`: `release()` pomocníka chybu len zaloguje (`warn`, ako `executeRoomManagementAction`).
- Test `exectionLockHelper.test.ts` „keeps the result of a build whose lock it could not release" (`releaseLock`
  zlyhá): výsledok ostane, `warn` zalogovaný. Skript po: A1 synchronizovaný.

### 3. (Opus L2) Predlžovanie zámku dokumentu obmedzené – **potvrdené, opravené, N = 8 s**
- Stav: `using` predlžuje bez limitu; skript `stuck-holder` pred: B1 odmietnutý po 12,3 s čakania.
- Oprava: vlastný `executeExtendedAction` namiesto `using` (`using` predlžuje s opakovaniami získania – 60 × ⇒ stratu
  ukáže až 9–15 s po prvom zlyhanom predĺžení, nevie prestať predlžovať a zlyhané uvoľnenie mení výsledok). Lease 5 s, predĺženie 500 ms pred
  koncom (3 opakovania po 100 ms); signál sa preruší, keď predĺženie zlyhá, keď sa nevráti do konca lease (časovač),
  alebo po `maxDuration`; vtedy sa zámok aj hneď uvoľní, akcia beží ďalej, ale už nezapisuje (bod 1).
- **N = 8 s:** čakajúci skúša 60 × 200 ± 50 ms, teda vzdá sa najskôr po 9 s. Čakajúci, ktorý prišiel s držiteľom alebo
  neskôr, dostane zámok uvoľnený v 8 s ešte pred vzdaním (rezerva ≥ 1 s minus RTT); bežná stavba trvá ďaleko pod 1 s
  (B v skripte ~40 ms, H2 sync 175–308 ms). Cena: legitímna stavba > 8 s, keď nikto iný neuloží, zlyhá u držiteľa
  (namiesto zlyhania u čakajúcich).
- Testy: zastavená stavba 20 s → signál v 8000 ms, čakajúci začne v 8000–9000 ms; prevzatý zámok → signál medzi 4400 a
  4948 ms (pri prvom predĺžení, pred koncom lease); predĺženie, ktoré sa nevráti → signál presne v 4948 ms. Pôvodné
  testy (jeden naraz, dva dokumenty, 7 s stavba, mŕtvy držiteľ, vzdanie po 9–15 s) bez zmeny zelené.

### 4. (Codex Medium) Zámok `purgeRoom` počas celého mazania – **potvrdené, opravené**
- Stav: pevný lease 12 s bez predlžovania; pomalší purge (Redis + 2 × `fetchSockets` do 5 s) kope sokety po vypršaní.
- Oprava: purge ide cez spoločný zámok miestnosti z bodu 7 (žiadna vlastná cesta): lease 1 s predlžovaný počas celého
  purge, najviac 20 s; `signal.throwIfAborted()` po `fetchInfo()` a po `fetchSockets()`, pri strate žiadne oznámenie ani
  kopanie, `error` „Failed to purge a room." Pod, ktorý zomrie počas purge, blokuje miestnosť ≤ 1 s (predtým 12 s).
  Autorizácia nezmenená.
- Testy (`purgeRoomListener.test.ts` teraz so skutočným Redlockom nad Redisom v pamäti, presunutým do
  `test/support/lockRedis.ts`): purge 12,8 s → mazanie aj kopanie pod platným zámkom (starý kód červený); zámok
  prevzatý joinom počas `fetchInfo` → purge zastavený, nič neodoslané, kľúč joinu nedotknutý (starý kód červený).

### 5. (Opus L3) `engines.node` – hotové: `>=24.14` (subpath imports `#/`). `yarn install`: `yarn.lock` bez zmeny.

### 6. (Opus L4) Lokálny supervisor – hotové: `docker/app/local/.../node-server.conf` `stopwaitsecs=35` s komentárom ako
v Kubernetes. Obraz sa nebuildoval, nespúšťané.

### 7. (Opus L5) Zámok miestnosti pre všetky akcie – **potvrdené, opravené, strop 20 s**
- Stav: `executeRoomManagementAction` bral pevný lease (1 s, join/leave/disconnect 5 s, purge 12 s) bez predlžovania,
  hoci join, kick, transferModeration, approve/reject, `moderationRequestProcessor` a ďalšie čakajú na `fetchSockets()`
  naprieč podmi (do 5 s). Skutočný Redis (`pokoj.mts`, `pokoj-pred.log`): akcia 12 s – kľúč voľný už v 3 s, iná akcia
  dostala miestnosť v 5 s; po zmazaní kľúča akcia pokračovala; akcia 25 s – iná dostala miestnosť v 19 s.
- Oprava `exectionLockHelper.ts`: `executeRoomManagementAction(room, action(signal), retryCount?)` beží cez ten istý
  `executeExtendedAction` ako stavba dokumentu: lease **1 s** (toľko drží miestnosť pod, ktorý zomrel, pod ~0–4 s
  opakovaní čakajúcich), predĺženie 500 ms pred koncom, takže akcia hotová do ~0,5 s (väčšina) nepredlžuje nič;
  **strop 20 s**, potom signál a uvoľnenie. Zdôvodnenie: najdlhší join čaká na ostatné pody až 4 × (`fetchSockets()` a
  štart kolaborácie po 5 s), všetky štyri len keď pod neodpovedá; kick 3 ×, purge 2 ×; klient čaká na odpoveď 5 s
  (`ACK_TIMEOUT` v common-admin), akcia po 20 s je zaseknutá. Opakovania čakajúcich (10, joinov upratovanie 40) a
  ošetrenie zlyhaného uvoľnenia ostali. Parameter dĺžky zrušený (join, leave, disconnect, upratovanie joinu), `lock.extend
  (5000)` v joine zbytočný.
- Signál dostávajú všetky akcie; `signal.throwIfAborted()` pred zápisom po čakaní na ostatné pody: join (pred purge,
  pred vyhodením iných soketov, v `joinUserSocket` pred zmenou moderátora), upratovanie joinu, kick, leave, disconnect,
  transferModeration, approve/reject join a moderácie (pred `promote`/`remove`), requestToJoin/TakeModeration (pred
  `jobQueue.add`), changeFieldData (pred `storeData`), `moderationRequestProcessor` (pred `switchModerator`).
  `roomUserManager`: `leaveUserSocket`, `joinUserSocket`, `passOnAbsentModerator`, `kickOtherUserSocketsIfInRoom` majú
  voliteľný `signal` a kontrolujú ho po svojom `fetchInfo()` pred zmenou moderátora.
- Po (`pokoj-po.log`): akcia 100 ms – 0 predĺžení; akcia 12 s – miestnosť zamknutá každé 3 s (24 predĺžení), iná akcia
  sa po 1,5 s vzdala; zmazaný kľúč → signál o 0,77 s, akcia zastavená; akcia 25 s → signál v 20,0 s, iná akcia dostala
  miestnosť v 20,1 s.
- Testy: `exectionLockHelper.test.ts` – rýchla akcia bez `extendLock`, akcia 14 s drží miestnosť, strata → signál,
  strop 20 s a ďalšia akcia do 1 s, zlyhané uvoľnenie nemení výsledok. Join (`joinCollabRoomListener.test.ts`, skutočný
  zámok a manažéri): 3 × adaptér 4,9 s → Ok, každý zápis pod zámkom, moderátor zapísaný po 9 s; strata → Failed,
  miestnosť nevymazaná, soket nepripojený. Nové `kickUserFromRoomListener.test.ts` a `transferModerationListener.test.ts`:
  pod predĺženým zámkom po 4,9 s / 9,8 s, pri strate nič. Purge pozri bod 4.

### 8. (Opus L6) Vypínanie s vlastným limitom – **potvrdené, opravené**
- Stav: pri kroku, ktorý visí, Graceful po 30 s `exit(1)` bez `Sentry.close` a bez mena kroku. Skutočný proces
  (`sig-run.sh`, `destroy` Hocuspocus pozdržaný 40 s, `sig-pred-hang40s.log`): „Graceful exit failed, timeout of 30000ms"
  a exit 1 po 30,0 s, Sentry sa nezatvoril.
- Oprava `src/index.ts`: kroky (socket.io, hocuspocus, mysql, queue, worker → redis, mongoose) majú vlastný limit
  **28 s**; každý zaloguje „Shutdown: <krok> closed in N ms", chyba sa zaloguje s menom kroku, po limite `error`
  „Shutdown timed out after 28000 ms, still closing: <kroky>". Potom vždy `Sentry.close(1500)` ako posledný, pri limite
  `process.exit(1)`, inak Graceful exit 0. Graceful `timeoutMs` **32 s** ako poistka.
- Výpočet: preStop 15 s → `supervisorctl stop` (stopwaitsecs 35) → ~7 s pauz a zastavení nginx/supervisord. Proces
  skončí najneskôr po ~29,5 s (28 + 1,5), poistka 32 s je pod 35 s supervisora; najhoršie 15 + 32 + 7 = 54 s z 60 s.
  Komentáre `stopwaitsecs` v oboch `node-server.conf` teraz uvádzajú 32 s.
- Po (`sig-po-hang40s.log`): v 28,0 s „still closing: hocuspocus", `Sentry client.close (1500)`, `process.exit(1)` z
  nášho handlera, exit 1 po 28,0 s; bežný SIGTERM (`sig-po-term.log`) exit 0 hneď, Sentry posledný.
- Test `index.test.ts` „stops waiting for a step that hangs after 28 s…": v 27 999 ms ešte nič, v 28 000 ms chyba s menom
  `hocuspocus`, `Sentry.close` po nej s 1500, exit 1, Redis/Mongo sa už nezatvárajú. Ostatné testy vypínania zelené
  (limit Sentry 1500).

## Kontroly (`kontroly.sh`, `VITEST_MAX_WORKERS=2`, pred každou > 10 GB voľných)
Po bodoch 1–8 jedným behom: `yarn install` ok (staré YN0086, `yarn.lock` bez zmeny), `yarn dedupe --check` ok,
`yarn lint:fix` ok, `yarn ci` ok, `yarn test` **97/97** (~7 s), `yarn build` ok, `yarn tsc` ok. Skript s dvoma servermi
(body 1–3) zopakovaný na konečnom kóde s rovnakým výsledkom. Prod štart z `dist` (`start-prod.sh`): až na `getaddrinfo ENOTFOUND mongo-anzu`,
exit 1 po 32 s. Docker: len `fix3-collab-redis` a `fix3-collab-mongo` (spúšťané dvakrát), na konci vždy
`docker rm -f -v`; `perf-collab-*` nedotknuté.

## Zmenené súbory (collaboration)
`src/util/helper/exectionLockHelper.ts`, `src/server/document/fetchDocument.ts`, `src/index.ts`,
`src/manager/roomUserManager.ts`, `src/bullmq/processor/moderationRequestProcessor.ts`, listenery v
`src/server/event/listener/` (purgeRoom, joinCollabRoom, leaveCollabRoom, disconnecting, kickUserFromRoom,
transferModeration, changeFieldData, requestToJoin, requestToTakeModeration, approve/reject RequestToJoin a
RequestToTakeModeration), `package.json`, `docker/app/{local,kubernetes}/etc/supervisor/conf.d/node-server.conf`;
testy `exectionLockHelper.test.ts`, `document.test.ts`, `purgeRoomListener.test.ts`, `joinCollabRoomListener.test.ts`,
`index.test.ts`, `hocuspocus.test.ts` (mock `updateOne` a signál), nové `kickUserFromRoomListener.test.ts`,
`transferModerationListener.test.ts`, `test/support/lockRedis.ts`.

## Neoverené / otvorené
- Dva servery v jednom procese, nie dva skutočné pody; Kubernetes ani lokálny obraz sa nespúšťali.
- V súbehu (dokument už uložený) mongoose timestamps pridajú `$set: { updatedAt }` – obsah sa nemení, TTL sa posunie.
- Zámok miestnosti s lease 1 s sa predlžuje každých ~0,5 s: slučka udalostí zaseknutá > ~0,5 s práve vtedy (napr. veľká
  stavba dokumentu na tom istom pode) preruší dlhšiu akciu – zastaví sa pred ďalším zápisom.
- Zastavená akcia nechá miestnosť v polovici (napr. soket odišiel, moderátor sa nepreniesol); napraví ju až ďalšia akcia
  pod zámkom (join/upratovanie joinu) – vedome, namiesto zápisu bez zámku.
- Krok vypínania, ktorý visí, beží po `exit(1)` ďalej len do konca procesu; čo neuložil, je stratené ako predtým.
- Všimnuté: `automaticExtensionThreshold` v nastavení Redlocku už nič nepoužíva (len `using`); ponechané.
