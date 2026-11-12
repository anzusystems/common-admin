# COLLAB-OPRAVY4: kolaboračný server – štvrtý cyklus opráv (8 bodov, schválené vlastníkom)

Zadanie `krok5-praca/zadania/zadanie-collab-opravy4.md`, podklad `posudky/collab-opravy3-codex.md` (High, Medium) a
`posudky/COLLAB-OPRAVY3-opus.md` (7a–7d, L1–L3, Q2). Repozitár `/home/volar/projects/petit/collaboration`, vetva `next`,
HEAD `4314471` + tieto opravy. **Nič necommitnuté**, žiadne vetvy, `stash`, `reset` ani `checkout`; vlastníkova zmena
`.gitignore` nedotknutá. Skripty a logy (mimo `/tmp`): `/home/volar/projects/anzusystems/krok5-praca/collab-opravy4/`.

**Ako sa potvrdzovalo:** stav pred = HEAD `4314471`. Testy tohto cyklu bežali aj proti src z HEAD
(`overenie-stary-kod.sh` → `overenie-stary-kod.log`): **16 červených / 96 zelených**. Z nich 12 pre správanie (dokument 2,
join 4, leave 1, purge 1, `purgeCollabStorage` 2, `changeFieldData` 2); oba testy bodu 3 a dva staré testy zámku, ktoré
teraz volajú `assertLockHeld`, sú na starom kóde červené len preto, že funkcia neexistuje. Na opravenom kóde
**112/112** (19 súborov; predtým 97).

**Skript s dvoma podmi (body 1–3 a 7):** `miestnost.mts` + `overenie-all.sh pred|po`. Dve kópie src v jednom procese
(`pody/pred-a`, `pred-b` z `4314471`; `pody/po-a`, `po-b` z pracovného stromu): každý pod má vlastný socket.io server s
Redis streams adaptérom, vlastného klienta Redis, zámok miestnosti aj manažérov; **skutočný Redis 7.2.4**
(`fix4-collab-redis`, 6390) a **MongoDB 8.0.20** (`fix4-collab-mongo`, 27328); klienti socket.io-client 4.8.4 s
podpísaným JWT v cookies. Zámok sa stratí zmazaním alebo prevzatím kľúča v Redise; pomalý pod = zadržané odpovede
`fetchSockets()`; zaseknutá slučka = aktívne čakanie 1,5 s na pode A hneď po odpovedi `fetchSockets()`; pod C je
samostatný proces. Logy `miestnost-pred-*.log`, `miestnost-po-*.log`.

| scenár | pred (`4314471`) | po |
|---|---|---|
| `join-moderator-answer` (U na B čaká 3 s na dáta moderátora M; zámok zmazaný, purge na A miestnosť vyprázdni) | join zlyhá, ale dáta M **zapísané do vyprázdnenej miestnosti** (`data ["title"]`) | join zlyhá, `data []` |
| `join-existing-moderator` (A odpovedá o 2 s; zámok prevzatý počas druhej otázky, moderátor existuje) | U v 4,03 s **`ok`** po strate zámku, v miestnosti [1,2] | U `failed`, upratovanie ho vyviedlo, v miestnosti [1] |
| `leave-moderator` (odchod moderátora M1 na A, B odpovedá o 1,5 s; po odovzdaní moderovania zámok zmazaný, nová karta M2 na B vezme pole `title`) | M1 v 6,05 s `ok` a **uvoľní `title` karte M2** (`{"title":null}`), zámky `{}` | M1 `failed`, `title` ostal M2 (`lockSockets` = M2) |
| `stall` (join na A do prázdnej miestnosti, slučka A stojí 1,5 s; pod C vezme miestnosť po vypršaní lease a nastaví moderátora 9) | A po zaseknutí **purge počas zámku C** – C v 3,0 s vidí moderátora `null` | A: „The lease of execution lock … ran out", nič nezmazal, C vidí `9` |
| `change-during-kick` (kick na A, B neodpovedá – `fetchSockets()` zlyhá po 5 s; zmena poľa na A o 100 ms neskôr) | zmena v 1,78 s `failed` (vyčerpané opakovania), nič uložené | zmena v 5,07–5,22 s `ok`, `title` uložený |

**Skript s dvoma Hocuspocus servermi (bod 6):** `zamok.mts` z cyklu 3 (porty a prefix `fix4z_`), nový scenár `cap-alone`.

| scenár | pred | po |
|---|---|---|
| `cap-alone` (stavba A 10 s, nikto iný) | v 10,05 s „Lost the build lock … before it was stored!", **A1 `permission-denied`**, nič uložené | v 10,05 s `$setOnInsert` vložil, A1 synchronizovaný, uložených 44 uzlov |
| `stuck-holder` (A 20 s, B v 1 s, zmenený JSON) | B postaví v 8,1 s; A v 20 s načíta dokument B | to isté; A v 20 s `updateOne` bez vloženia, načíta dokument B |
| `lost-before-extension` / `lost-after-extension` (zámok zmazaný v 0,5 s, B postaví zmenený JSON a upraví) | všetci 46 uzlov, úprava B, bez zdvojenia | to isté; A po strate zámku `updateOne` bez vloženia, načíta dokument B |

Všetky scenáre `po` zopakované na konečnom (naformátovanom) kóde s rovnakým výsledkom.

## Body

### 1. (Codex High) Join zapisuje po strate zámku – **potvrdené, opravené**
- Stav: v `startCollaboration` sa po odpovedi moderátora (do 5 s) volal `storeAllData` bez kontroly; v `joinUserSocket` sa
  zámok kontroloval po `fetchInfo()` len pri chýbajúcom moderátorovi. Potvrdené skriptom (riadky 1–2 prvej tabuľky).
- Oprava `roomUserManager.ts`: `startCollaboration(moderatorSocket, signal)` po odpovedi `assertLockHeld(signal)`, pri
  zlyhaní `reject` bez zápisu (join ho volá so signálom). `joinUserSocket`: kontrola po `fetchInfo()` vždy, a po
  `switchModerator` znova (join potom odpovedá na to, čo pody povedali).
- Testy `joinCollabRoomListener.test.ts`: strata zámku počas čakania na moderátora (4,9 s) → `storeAllData` sa nevolá,
  `Failed`; strata počas druhého `fetchInfo()` pri existujúcom moderátorovi → `Failed`, upratovanie vyvedie soket,
  moderátor ostane. Oba na starom kóde červené.

### 2. Leave moderátora uvoľní zámky polí bez kontroly – **potvrdené, opravené**
- Stav: po `leaveUserSocket` (pri odovzdaní moderovania ešte dve otázky na pody) `leaveCollabRoomListener` uvoľnil zámky
  polí bez kontroly. Skript `leave-moderator`: starý odchod uvoľnil pole, ktoré medzitým vzala nová karta toho istého
  používateľa.
- Oprava `leaveCollabRoomListener.ts`: `assertLockHeld(signal)` hneď po `leaveUserSocket`, pred oznámením aj uvoľnením.
- Test `leaveCollabRoomListener.test.ts` (nový): odchod 9,8 s pod zámkom → uvoľnenie pod zámkom, `Ok`; zámok stratený →
  `releaseAllUserLocks` sa nevolá, `Failed`, `error` „Failed to leave user from a room." (starý kód červený).

### 3. Spoločná kontrola zámku – **potvrdené, opravené**
- Stav: akcie kontrolovali len `signal.throwIfAborted()`; signál prerušujú časovače, ktoré po zaseknutej slučke bežia
  neskoro, a pokračovanie I/O pred nimi signál ešte vidí neprerušený. Skript `stall`: starý join po 1,5 s zaseknutia
  prešiel kontrolou a vymazal miestnosť, ktorú medzitým držal pod C.
- Oprava `exectionLockHelper.ts`: `export assertLockHeld(signal?)` – ak signál nie je prerušený a `Date.now() >=
  lock.expiration`, preruší ho („The lease of execution lock … ran out"), potom `throwIfAborted()`. Podpis je
  `(signal)`, nie `(lock, signal)`: zámok je po každom predĺžení iný objekt, pomocník si aktuálny drží cez `WeakMap`
  signál → kontrola, takže volajúci ďalej podávajú len signál. Nahradené **všetky** `throwIfAborted` v akciách miestnosti
  (13 listenerov, procesor moderovania, `roomUserManager`); v akcii dokumentu po bode 6 kontrola netreba – zápis je len
  `$setOnInsert`, signál sa tam už nečíta.
- Testy: `exectionLockHelper.test.ts` „fails the check of an action whose lease ran out before its timers could tell it"
  (`vi.setSystemTime` +1,5 s, časovače posunuté, nebežali: `signal.aborted` false, kontrola zlyhá) a „passes the check of
  an action whose lock it extended" (3 s); join so zaseknutím po prvom `fetchInfo()` → bez purge; purge, ktorého acquire
  Redis potvrdil o 1,1 s (lease už vypršal) → nič nezmazané.

### 4. Čakanie na odchody z `kickOtherUserSocketsIfInRoom` – **potvrdené, opravené**
- Stav: join odpovedal a uvoľnil zámok, kým odchody nahradených soketov (ich `fetchInfo()`, prípadne zmena moderátora)
  ešte bežali.
- Oprava `joinCollabRoomListener.ts`: `joinUserSocket` v `try`, vo `finally` `await Promise.all(left)` – odchody sa
  dokončia vnútri zámku úspešného joinu; navyše aj keď `joinUserSocket` zlyhá (inak by bežali bez zámku až do
  upratovania). Odchody bežia súbežne s `joinUserSocket`, čas joinu sa predĺži len o ich zvyšok.
- Test „waits, under its lock, for the leave of the socket of the user it replaced": odpoveď odchodu v 5000 ms pod
  zámkom, join odpovie až po nej (starý kód: odpoveď v 0 ms, odchod v 5000 ms bez zámku).

### 5. Purge ako jedna transakcia – **potvrdené, opravené**
- Stav: `Promise.all` štyroch `DEL` bez kontroly; zaseknuté mazanie mohlo doraziť medzi zápisy ďalšej akcie a vziať časť
  miestnosti.
- Oprava: `purgeCollabStorage` = `redis.multi()` so štyrmi mazaniami (`data:`, `locks:`/`lockSockets:`/`lockTransfers:`,
  moderátor, options) a jedným `exec()`; chyba príkazu v transakcii sa vyhodí. `removeAllData`, `removeAllLocks`,
  `removeRoomOptions` teraz len pridajú `DEL` do transakcie (používa ich iba purge). Hneď pred ňou `assertLockHeld`:
  v `purgeRoomListener` nová kontrola pred purge, v joine je kontrola po `fetchInfo()` priamo pred ňou. Fencing nie.
- Testy `roomUserManager.test.ts` (nový): poradie príkazov `multi`, 4 × `del`, `exec`, nič mimo; zlyhaný príkaz →
  odmietnuté (oba na starom kóde červené). Purge s neskorým acquire (bod 3).

### 6. Prerušená stavba dokumentu – **potvrdené, opravené**
- Stav: po strate zámku alebo strope 8 s stavba nezapisovala; ak nebolo nič uložené, load zlyhal (`permission-denied`,
  provider neopakuje). Skript `cap-alone`: A1 odmietnutý.
- Oprava `fetchDocument.ts`: vždy `updateOne` s `$setOnInsert` (bezpečné, nič neprepíše); ak nevložil, vráti uložený.
  Ak `updateOne` zlyhá, skúsi načítať uložený; chyba len ak sa nedá ani uložiť, ani načítať. Signál sa nečíta, zámok
  ďalej drží stavby po jednej a v 8 s pustí čakajúcich.
- Testy `document.test.ts`: stavba po strope 8 s bez uloženého → uloží a vráti ju (starý kód červený); prerušená, iný pod
  uložil → nič neprepíše, vráti jeho; `updateOne` zlyhá, uložený existuje → vráti uložený (starý kód červený); nedá sa
  uložiť ani načítať → chyba Mongo.

### 7. `changeFieldData` počas pomalej akcie – **potvrdené, opravené, 40 opakovaní ≈ 8 s**
- Stav: 10 opakovaní (0–4 s, priemer 2 s); zmena počas akcie, ktorá čaká na pody, zlyhala potichu (klient na odpoveď
  nečaká – `collabField.ts:228`, `collabAnyDataChange.ts:64`). Skript `change-during-kick`: zmena `failed` v 1,8 s.
- Oprava `changeFieldDataListener.ts`: `executeRoomManagementAction(…, 40)`. `changeCollabAnyData` je len v klientovi
  (common-admin) a posiela ten istý `changeFieldData`, samostatný listener nemá.
- Zdôvodnenie: jedno čakanie na pody trvá najviac 5 s (`requestsTimeout` adaptéra; pod, ktorý neodpovie, potom
  `fetchSockets()` zlyhá – tak skončí aj kick), plus 1 s lease držiteľa, ktorý zomrel ⇒ zmena musí čakať > 6 s.
  Redlock: oneskorenie 200 ± 200 ms, 40 × ⇒ priemer 8 s, ±2σ ≈ 6,5–9,5 s, teda spoľahlivo nad 6 s; rovnaký počet ako
  upratovanie joinu. Viac nie: čakanie bez vedomia klienta, viac zmien čaká naraz a Redlock nie je FIFO (pozri otvorené).
- Testy `changeFieldDataListener.test.ts` (nový, `Math.random` = 0,5): kick, ktorému pod neodpovie (zlyhá v 5 s), zmena
  o 100 ms → `Ok`, uložená pod zámkom; miestnosť držaná → v 7,9 s ešte bez odpovede, v 8,1 s `Failed`.

### 8. Drobnosti – **hotové**
- Nestabilný test „stops an action at 20 s…": `vi.spyOn(Math, 'random').mockReturnValue(0.5)` – opakovania presne po
  200 ms (náhodne ~0,25 % behov skúšalo menej než 1 s do 20 s a vzdalo sa). `opakovanie.sh`: testy zámkov 30 × za sebou
  (8 súborov, 40 testov) → 30/30 zelené.
- Komentár `exectionLockHelper.ts:16-19`: pod, ktorý neodpovie, zlyhá čakanie v 5 s a s ním akciu; štyri čakania blízko
  5 s len od podov, ktoré odpovedajú tesne včas; strop 20 s nezmenený.
- `package.json` `engines.node`: `^24.14.0 || >=25.4.0`. `yarn install`: `yarn.lock` bez zmeny.

## Kontroly (`kontroly.sh`, `VITEST_MAX_WORKERS=2`, pred každou > 9,7 GB voľných)
`yarn install` ok (staré YN0086, `yarn.lock` bez zmeny), `yarn dedupe --check` ok, `yarn lint:fix` ok, `yarn ci` ok,
`yarn test` 3 × za sebou **112/112** (6–7 s), `yarn build` ok, `yarn tsc` ok. Prod štart z `dist` (`start-prod.sh`):
až na `getaddrinfo ENOTFOUND mongo-anzu`, exit 1 po 31 s. Docker: len `fix4-collab-redis` a `fix4-collab-mongo`, na
konci `docker rm -f -v` doslovnými menami; `perf-collab-*` nedotknuté.

## Zmenené súbory (collaboration)
`src/util/helper/exectionLockHelper.ts`, `src/manager/roomUserManager.ts`, `roomDataManager.ts`, `roomLockManager.ts`,
`roomOptionsManager.ts`, `src/server/document/fetchDocument.ts`, `src/bullmq/processor/moderationRequestProcessor.ts`,
listenery v `src/server/event/listener/` (joinCollabRoom, leaveCollabRoom, purgeRoom, changeFieldData, kickUserFromRoom,
disconnecting, transferModeration, requestToJoin, requestToTakeModeration, approve/reject RequestToJoin a
RequestToTakeModeration), `package.json`; testy `exectionLockHelper.test.ts`, `joinCollabRoomListener.test.ts`,
`purgeRoomListener.test.ts`, `document.test.ts`, nové `leaveCollabRoomListener.test.ts`,
`changeFieldDataListener.test.ts`, `roomUserManager.test.ts`.

## Neoverené / otvorené
- Dva pody v jednom procese (oddelené kópie modulov), nie dva skutočné pody; zaseknutie slučky simulované aktívnym
  čakaním; Kubernetes ani obraz sa nespúšťali.
- Bez fencingu sa purge (jedna transakcia) stále môže dostať do Redisu po strate zámku – celá naraz, nie po častiach.
- Stavba prerušená po vymazaní dokumentov (`removeEditorsData` pri joine neaktívnej miestnosti) môže cez `$setOnInsert`
  vložiť stavbu zo starších dát miestnosti; okno: držiteľ > 8 s a mazanie medzi jeho čítaním a zápisom.
- Zmeny jedného poľa, ktoré čakajú na zámok naraz, sa môžu uložiť v obrátenom poradí (Redlock nie je FIFO); bolo to tak
  aj pri 10 opakovaniach, dlhšie čakanie okno zväčšuje.
- Pod, ktorý neodpovedá, zostane v adaptéri ~10–15 s (heartbeat); dovtedy zlyhá každé `fetchSockets()`, teda aj zmena,
  ktorá sa dočkala zámku.
