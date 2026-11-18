# OPTIMALIZACIE: menšie zmeny servera kolaborácie na meranie

Zadanie: `krok5-praca/zadania/zadanie-optimalizacie.md`. Vlastník schválil „vyskúšať podľa odporúčaní".

- Podklady: `posudky/OPT-server-opus.md`, `posudky/OPT-stats-opus.md` a `posudky/opt-codex-codex.md`.
- Skripty a logy: `/home/volar/projects/anzusystems/krok5-praca/optimalizacie/`.
- Nič nie je commitnuté. Každý bod je samostatná zmena, dá sa merať zvlášť.

| časť | kde | vetva | nad čím |
|---|---|---|---|
| A, body 1–6 | worktree `krok5-praca/collab-next-wt` | `feature/collab-heap-lock-retry` | 1b9163b a necommitnuté heap 400 a zámok 25/25 (`HEAP-LOCK.md`) |
| B, bod 7 a prenos 1–6 | `petit/collaboration` | `feature/collab-stats` | 66106b2 a necommitnutá dávka finalizéra 50 |

## 1. Časť A (next)

### Bod 1: kompresia socket.io vypnutá

- `src/server/collaboration.ts`: riadok `perMessageDeflate: true` je preč. engine.io má predvolene kompresiu vypnutú a ws
  servera tiež.
- **Prečo** (OPT-server 1): v profile rotácie bolo 16,7 s z 337,7 s v zlib (≤ 4,9 % jadra). Kompresia bežala pri
  každom pakete socket.io, aj pri ack a ping. Hocuspocus kompresiu nedohaduje, preto som ho nemenil.
- **Riziko**: väčšie rámce len pri veľkých správach (odpoveď `startCollab` s telom, dáta miestnosti pri vstupe).
- **Test** `collaboration.test.ts`: `engine.opts.perMessageDeflate` je vypnuté.

### Bod 2: pole bez hľadania naprieč podmi

V `acquireFieldLockListener`, `releaseFieldLockListener` a `changeFieldDataListener` sa najprv overí
`socket.rooms.has(room)`. `hasNotUserId` (`fetchSockets()`, `PUBSUB NUMSUB` a pri viacerých podoch čakanie na ostatné)
sa volá len pre soket, ktorý v miestnosti nie je.

- **Výsledok je pre soket v miestnosti rovnaký**: lokálna časť `fetchSockets()` je tá istá pamäť adaptéra.
- **Soket mimo miestnosti** (iná karta toho istého používateľa) ide po starej ceste:
  - zmenu a uvoľnenie povolí, keď je používateľ v miestnosti iným soketom;
  - zámok nepovolí, lebo zámok vyžaduje soket v miestnosti, ako doteraz.
- **Testy** `changeFieldDataListener.test.ts` (+3) pokrývajú všetky tri poslucháče:
  - soket v miestnosti sa ostatných inštancií nepýta;
  - soket mimo miestnosti sa pýta (3×): zmena a uvoľnenie prejdú, zámok nie;
  - používateľ bez soketu v miestnosti je odmietnutý všade.
- **Úpravy existujúcich testov**: testové sokety dostali `rooms`.
  - Kontrola „preskočené pred opýtaním sa inštancií" je teraz „pred čítaním zámku poľa" (`getLock`).
  - Oneskorenie staršieho uvoľnenia je teraz na `releaseLock`, nie na `hasNotUserId`.

### Bod 3: debug logy bez formátovania

`src/logger/appLogger.ts`:

- **Guard**: `debug` volá winston len pri `isDebugEnabled()`.
  - winston pustí záznam celým formátom (aj `Object.assign` metadát) a až potom ho transporty zahodia podľa úrovne.
  - `isLevelEnabled` vo winstone 3.19 berie do úvahy úroveň loggera aj transportov.
- **Stringify**: `configure({ maximumDepth: 10 })` je raz na úrovni modulu, nie pri každom zázname.

**Testy** `logger.test.ts` (+2):

- pri `LOG_LEVEL=info` sa getter v metadátach debug záznamu nezavolá a nič sa nezapíše;
- pri `debug` je riadok v konzole presne v doterajšom tvare (`<čas> [modul] debug: správa {"metadáta"}`).

### Bod 4: telo bez stiahnutia predošlého

- `src/server/document/storeDocument.ts`: `findOneAndReplace` → `replaceOne`, s rovnakým filtrom, náhradou a `upsert`.
- **Overené v mongoose 9.11.2**: `schema.pre('replaceOne', …)` nastaví `updatedAt` (`setupTimestamps.js:83`), takže
  TTL index ostáva.
- **Testy**:
  - nový `storeDocument.test.ts` so skutočným modelom (kolekcia podstrčená): `replaceOne` 1×, `findOneAndReplace`
    nikdy, `upsert: true`, `updatedAt` je nastavené;
  - mocky `document.test.ts` a `hocuspocus.test.ts` som prepísal na `replaceOne`.

### Bod 5: menej ciest do Redisu pod zámkom

- **`storeAllData`** (`roomDataManager.ts`): `HSET` a `EXPIRE` idú jedným `multi()`, 1 cesta namiesto 2. Chyba príkazu
  v transakcii sa vyhodí ako doteraz (vzor z `purgeCollabStorage`).
- **`acquireLock`** (`roomLockManager.ts`):
  - `HGET` zámku ostáva pred zápisom, lebo rozhoduje;
  - potom 2× `HSET`, `HDEL` a 3× `EXPIRE` v jednom `multi()`: 2 cesty namiesto 7;
  - poradie aj výsledok sú rovnaké, navyše atomicky.
  - Kontrolu do tej istej cesty by dostal len Lua alebo `WATCH`, čo som nerobil.
- **Rozdiel**: pri chybe jedného príkazu MULTI ostatné prebehnú (Redis nevracia späť). Predtým zastavila ďalšie
  `await`. Dôsledok je len `EXPIRE` navyše.
- **Testy**: nový `roomRedisWrites.test.ts` (6) s Redisom, ktorý zaznamenáva príkazy a cesty.
  - poradie príkazov, 1 a 2 cesty;
  - opätovné vzatie vlastného zámku;
  - odmietnutie cudzieho zámku len po `HGET`, bez zápisu;
  - chyba príkazu v transakcii odmietne volanie.

### Bod 6: po odpovedi „obsadené" nebrať zámok druhýkrát

`joinCollabRoomListener.ts`: pri odpovedi Occupied, keď `roomInfoServer.moderatorSocket` existoval, sa upratovanie
po neúspešnom vstupe preskočí. Pokus nič nepripojil ani nenahradil a moderácia nemá kam prejsť. Upratovanie by len
znova vzalo miestnosť pred `requestToJoin` klienta.

- **Záchrana ostáva**: bez moderátora v miestnosti upratovanie beží, `passOnAbsentModerator` odovzdá moderáciu.
- **Testy** `joinCollabRoomListener.test.ts` (+2):
  - Occupied s moderátorom sa ostatných inštancií pýta len raz, upratovanie nebeží;
  - Occupied s chýbajúcim moderátorom moderáciu odovzdá.

### Changelog

`doc/Collaboration-Changelog/Unreleased/heap-room-lock-retry.md` má dátum 2026-10-24 a nadpis „Server memory, the wait
for a room and fewer round trips". Pribudlo 6 bodov k heapu a zámku.

### Kontroly A (`kontroly.sh`, `kontroly-next.log`, `kontroly-next-*.log`)

Všetko skončilo s 0: `yarn lint:fix`, `yarn ci`, `yarn test` 3× (21 súborov, **146 testov**, predtým 131), `yarn build`
a `yarn tsc`.

- Prvý beh testov zlyhal na mocku `findOneAndReplace` v `hocuspocus.test.ts`. Opravil som mock.

## 2. Časť B (feature/collab-stats)

### Prenos bodov 1–6, heapu a zámku

`prenos-a.sh`: trojcestné zlúčenie po súboroch (báza 1b9163b, naše = súbor vetvy štatistík, ich = worktree). Nové
súbory som skopíroval. Stav pred prenosom je uložený v `stats-pred-prenosom.patch`.

Ručne som riešil dva konflikty:

- **`changeFieldDataListener.ts`**: štatistiky čítajú zámok poľa spolu s hodnotou pred zápisom
  (`Promise.all([getLock, readFieldBefore])`). Podmienka bodu 2 je za tým, rovnako ako v A.
- **`joinCollabRoomListener.ts`**: pri Occupied štatistiky po odpovedi zapíšu udalosť `occupied`. `occupiedModerated`
  je nastavené pred odpoveďou, ako v A.
  - Preskočené upratovanie nemení štatistiky: `joinFailed` zapisovalo len vtedy, keď sa niekto pripojil, odišiel
    alebo prešla moderácia, čo pri Occupied s moderátorom nenastane.

Testy len vetvy štatistík:

- **`collabStatsBody.test.ts`**: mock `replaceOne`. Bez neho sa telo neuložilo a `afterAll` čakal 30 s.
- **`collabStatsEditEvents.test.ts`**: test dvoch používateľov naraz čakal na `hasNotUserId`, ktoré sa pre soket
  v miestnosti už nevolá. Teraz čaká na `getLock`, takže hodnotu pred zápisom stále číta pred uložením druhého.

### Bod 7: zápis členstva bez čakania pod zámkom

- **`void` namiesto `await`**: `await recordMembership(...)` je `void recordMembership(...)` na všetkých 10 miestach.
  - `joinCollabRoomListener` (occupied, join, joinFailed), `leaveCollabRoomListener` (2×);
  - `disconnectingListener`, `kickUserFromRoomListener`, `purgeRoomListener` a `transferModerationListener`;
  - `moderationRequestProcessor`.
- **Ostáva pod zámkom**: volanie ide stále pod zámkom a po odpovedi. ioredis zapíše skript do spojenia štatistík hneď
  pri volaní (`runMembership` pred ním nič nečaká), takže udalosti jednej inštancie idú do Redisu v poradí.
  Na odpoveď (≤ 500 ms timeout klienta štatistík) zámok už nečaká.
- **Pamäť zlyhaní** (`collabStatsSessionManager.ts`): úspešný zápis zmaže zapamätané zlyhanie miestnosti len vtedy, keď
  je stále to, ktoré sám niesol (`failedRecords.get(room) === failedAt`, ako flush v `collabStatsEditManager.ts`).
  Prekrývajúci sa zápis miestnosti mohol medzitým zlyhať.
- **Komentáre**:
  - `recordMembership` hovorí, že je volaný pod zámkom a nečakaný;
  - `collabStatsCommandTimeout` hovorí, že kolaborácia naň nečaká;
  - pri `occupied` a `leave` „sent still in the lock".
  - `COLLAB-STATS.md` (tabuľka ciest do Redisu) je upravený.
- **Testy**:
  - `collabStatsRedis.test.ts`: test zaseknutého Redisu očakával držanie zámku ≥ 500 ms. Teraz overuje, že zámok je
    voľný hneď (< 100 ms) a ďalšia akcia ho dostane hneď. EVAL odíde a po 500 ms príde `warn` „Command timed out".
  - `collabStatsMembership.test.ts` (+1): dva prekrývajúce sa zápisy miestnosti nesú to isté staršie zlyhanie, prvý
    znova zlyhá, druhý uspeje. Zlyhanie prvého ostane zapamätané a ďalší zápis označí reláciu `incomplete`.
    - Overené: so starou podmienkou test zlyhá.
- **Odchýlky** (rozhodnutie B1 mení vlastník):
  - **Poradie medzi inštanciami** sa už neopiera o odpoveď. Skript ide do zásuvky pred uvoľnením zámku, ale na inom
    spojení ako uvoľnenie. Udalosť ďalšej inštancie ho teoreticky predbehne len pri oneskorenom segmente na spojení
    štatistík. Prítomnosť relácie je potom nepresná do ďalšej udalosti alebo kontroly o 5 min a nie je označená
    `incomplete` (OPT-stats 1, riziko a).
  - **`NOSCRIPT`**: ioredis pošle skript znova až po `SCRIPT LOAD`, takže neskoršia udalosť tej istej inštancie ho
    môže predbehnúť. Nastane len po vyprázdnení skriptov Redisu bez nového spojenia (nové spojenie posiela najprv
    `EVAL`). Predtým to čakanie vylučovalo.

### Kontroly B (`kontroly-stats.log`, `kontroly-stats-*.log`)

Všetko skončilo s 0:

- `yarn lint:fix`, `yarn ci`, `yarn build` a `yarn tsc`;
- `yarn test` 3×: 33 súborov, **328 testov a 3 preskočené**;
- raz s `REDIS_TEST_URL=redis://127.0.0.1:6399/15` proti `opt-redis`: **331**. Kontajner je zmazaný.

Prvé behy zlyhali na mocku `findOneAndReplace` v `collabStatsBody.test.ts` (timeout `afterAll`). Opravil som mock.

## 3. Patche (`krok5-praca/perf/`)

- `collab-next-opt.patch`: celá časť A nad 1b9163b (heap, zámok a body 1–6), 23 súborov vrátane nových. Overené
  `git apply --check` na čistom `git archive 1b9163b` (`patch-a.sh`).
- `collab-stats-opt.patch`: celý stav vetvy štatistík nad 66106b2 (dávka 50, heap, zámok a body 1–7), 36 súborov
  vrátane nových, bez vlastníkovho `.gitignore`. Overené rovnako na `git archive 66106b2` (`patch-b.sh`).

## 4. Návrhy správ commitov

collaboration, časť A (`feature/collab-heap-lock-retry` → `next`). Heap a zámok majú svoju správu v `HEAP-LOCK.md` §4.

1. ```
   perf: socket.io sends its messages uncompressed (per-message deflate off, its default), no longer deflating every packet, acks and pings too, on the instance's core
   ```
2. ```
   perf: a field lock, release or change from a socket in the room no longer asks the other instances whether its user is in it; only another socket of the user still does
   ```
3. ```
   perf: a debug record is neither read nor formatted while debug is off, and the log format configures its stringify once; the output at debug is unchanged
   ```
4. ```
   perf: a body is stored with replaceOne instead of findOneAndReplace, which read the previous body back; upsert and the updatedAt of the TTL index stay
   ```
5. ```
   perf: the room data and its expiry are written in one transaction, and a field lock with its records and expiries in one after its read: one round trip each under the locks
   ```
6. ```
   perf: a join answered Occupied while the moderator is in the room skips its cleanup, which only took the room again ahead of the request to join; with the moderator gone it still passes moderation on
   ```

collaboration, časť B (`feature/collab-stats`). Dávka 50 má svoju správu v `HEAP-LOCK.md` §4. Body 1–6, heap a zámok
prídu s A (merge `next`) alebo s rovnakými správami.

7. ```
   perf: the membership script of the collaboration stats is sent under the lock of the room without awaiting its answer, so no room action holds the lock for it; a record forgets the failure of its room only if no overlapping record failed since
   ```

## 5. Commity

**Stav: commitnuté a pushnuté, PR nie je.** Commity aj push spustil vedúci so súhlasom vlastníka skriptami
`krok5-praca/optimalizacie/commity/commit.sh` a `push.sh`. Patche v `commity/` pripravil `priprava.py`, spolu dávajú
presne otestovaný stav. Otestovaný je len konečný stav, nie každý medzistav. Status je prázdny a trailerov je 0.

**A**: `feature/collab-heap-lock-retry` nad 1b9163b, nová vetva na origin s upstreamom.

| hash | správa (začiatok) |
|---|---|
| 2365de2 | perf: the production heap is 400 MB (was 200), and a room action waiting for the lock … |
| 04cc568 | perf: socket.io sends its messages uncompressed … (bod 1) |
| 08645d9 | perf: a field lock, release or change from a socket in the room … (bod 2) |
| ce67790 | perf: a debug record is neither read nor formatted while debug is off … (bod 3) |
| be9cdba | perf: a body is stored with replaceOne instead of findOneAndReplace … (bod 4) |
| 12488d2 | perf: the room data and its expiry are written in one transaction … (bod 5) |
| f6ea073 | perf: a join answered Occupied while the moderator is in the room … (bod 6) |
| b16bb39 | docs: changelog for the heap of 400 MB, the shorter wait for a room and fewer round trips |

**B**: `feature/collab-stats` nad 66106b2, push `9061330..ddc01b6`.

| hash | správa (začiatok) |
|---|---|
| 645a44b | perf: the finalizer of the collaboration stats writes 50 sessions in a transaction … |
| fc5d258 | perf: the production heap is 400 MB (was 200) … (ako A 2365de2) |
| 1f0c679 | bod 1 (ako A 04cc568) |
| ab6ad21 | bod 2 (ako A 08645d9; navyše `collabStatsEditEvents.test.ts`) |
| b34bd5e | bod 3 (ako A ce67790) |
| a0f371a | bod 4 (ako A be9cdba; navyše mock v `collabStatsBody.test.ts`) |
| db1ca18 | bod 5 (ako A 12488d2) |
| e8f8cbd | bod 6 (ako A f6ea073) |
| 0e5e98b | perf: the membership script of the collaboration stats is sent under the lock … (bod 7) |
| ddc01b6 | docs: changelog, rovnaký ako A b16bb39 |

Changelog štatistík v repozitári nie je, nebolo čo zosúladiť.

**Necommitnuté ostáva**: nič z repozitárov.

## 6. Po posudku OPT-IMPL (heap 300, štatistiky predvolene vypnuté)

Vlastník schválil Low a, b z `posudky/OPT-IMPL-opus.md`. `posudky/opt-impl-codex.md` sa neopravuje. Commity aj push
spustil vedúci, PR nie je:

- A: **f05281a** `perf:` heap 300 a changelog (`b16bb39..f05281a`);
- B: **4f2807e** `perf:` heap 300 a changelog, **0eca902** `feat:` predvolene vypnuté (`ddc01b6..0eca902`).

Status je prázdny, trailerov je 0.

- **Heap 300** (A aj B): v `package.json` `prod` je `--max-old-space-size=300`.
  - Je to hodnota, ktorú V8 sám zvolí pri limite podu 600 Mi (`heap_size_limit` 348 MiB).
  - Pri 400 mohol jadro proces zabiť skôr ako V8, lebo v tom istom kontajneri je aj rodič `yarn run prod` (~125 MiB).
  - Testy ani komentáre 400 nespomínali.
- **Changelog** `heap-room-lock-retry.md`, riadok o heape podľa merania 3 (`STATS-PERF.md`): rezerva nad ~65 MB živého
  heapu, RSS ~210 MB pri semi-space 16 MiB podu. Tvrdenia o mark-compact a RSS ~335 MB zo semi-space 64 sú preč. Text
  je v A aj B rovnaký.
- **Len B, predvolene vypnuté**: `config.ts` `collabStatsEnabled = COLLAB_STATS_ENABLED === 'true'`, komentár podľa
  toho.
  - Test configu má 3 prípady: chýba, `true`, `false`.
  - `.env.dist` ostáva `true` (lokálny vývoj), opravil som jeho komentár.
  - Testy štatistík si `true` nastavujú samy, `vitest.config.mts` má `false`.
  - V `configuration.yaml` je premenná zo skupiny: bez nej štatistiky v nasadení nebežia. `STATS-B1.md` (L6) je
    upravené.
  - README ani `doc/` repozitára prepínač nespomínajú.
- **Kontroly**: všetko skončilo s 0.
  - A: `lint:fix`, `ci`, `test` 3× (146), `build`, `tsc` (`kontroly2-next*.log`).
  - B: to isté, `test` 3× (330 a 3 preskočené) a raz s `REDIS_TEST_URL` proti `opt-redis` (333)
    (`kontroly2-stats*.log`). Kontajner je zmazaný.
- **Commity** pripravuje `krok5-praca/optimalizacie/commity2/commit.sh A|B`.
  - Overí vetvu, HEAD (b16bb39 / ddc01b6), prázdny index a to, že sa zmenili len otestované súbory.
  - Potom `git add` a `commit -F`. Vypíše `status`, `diff HEAD`, log a trailery.
  - `push.sh A|B` pushne bez PR.
- **Správy**:
  - A: `perf:` heap 300 a changelog;
  - B: ten istý `perf:` a potom `feat: the collaboration stats are off unless COLLAB_STATS_ENABLED is "true", …`.

