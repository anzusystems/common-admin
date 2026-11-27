# STATS-B1: relácie kolaborácie v kolaboračnom serveri (časti B1 a B3)

Zadanie: `krok5-praca/zadania/zadanie-stats-b1b3.md`, návrh `COLLAB-STATS.md` (§8 rozhodnutia vlastníka a §10 záväzné).
Repozitár `/home/volar/projects/petit/collaboration`, vetva `feature/collab-stats` nad `20a94b5` (časť A), nič
necommitnuté. `.gitignore` je zmenený vlastníkom, nie mnou. Skripty, logy a výstupy v `krok5-praca/stats-b1/`. Cesty
bez prefixu sú v repozitári collaboration. **Overené** = test, kontrola alebo beh proti skutočnému Redisu a Mongu;
**odvodené** = môj záver bez merania.

## 1. Čo pribudlo

| Súbor | Obsah |
|---|---|
| `src/storage/collabStatsRedis.ts` | kľúče relácie (`collabStatsKeys`), Lua `collabStatsMembership` (členstvo, zosúladenie, grace) a `collabStatsUnlock` (mutex), registrácia cez `defineCommand` |
| `src/manager/collabStatsSessionManager.ts` | `recordMembership()` (horúca cesta, nikdy nehodí) a `reconcileSession()` (kontrola živosti finalizéra) |
| `src/manager/collabStatsFinalizer.ts` | finalizér: mutex, preskórovanie `pending`, kontrola živosti, zahodenie po 24 h, transakcia, breaker |
| `src/util/helper/collabStatsSessionHelper.ts` | čisté výpočty: uzavretie relácie, kategórie, stropy, BSON, deň a hodina v Europe/Bratislava, prírastky dní a ľudí |
| `src/mongoose/collabStats.model.ts` | 4 schémy a modely na inštancii štatistík, indexy, `prepareCollabStatsCollections()` |
| `src/storage/statsMongodb.ts` | samostatná inštancia mongoose, spojenie, `runStatsTransaction()` |
| `src/bullmq/collabStatsQueue.ts` | rada `collab-stats`, worker `concurrency: 1`, scheduler každých 30 s |
| `src/util/helper/dampedLogHelper.ts` | tlmený `warn` (najviac raz za 15 min, inak `debug`) |
| listenery `join`, `leave`, `disconnecting`, `kick`, `purge`, `transferModeration`, `moderationRequestProcessor` | jedno `await recordMembership(...)` pod zámkom miestnosti |
| `src/manager/collabStatsLiveManager.ts` | `fetchMembers()`: ten istý snímok ako `live` aj pre finalizér, s časom `takenAt` |
| `src/index.ts`, `src/config/config.ts`, `.env.dist`, `vitest.config.mts` | štart a vypnutie, prepínač `COLLAB_STATS_ENABLED` |

**Prepínač pre meranie**: `COLLAB_STATS_ENABLED=false` vypne relácie (žiadne volanie Lua v handleroch), finalizér (rada
sa nezaloží) aj spojenie štatistík do Monga. Predvolene zapnuté (`!== 'false'`), v nasadení netreba nič meniť. Živé
endpointy časti A ostávajú. Vo vitest je `false`, testy štatistík ho zapínajú.

**`sessionStartedAt` v `live/rooms`** (§10.9, krok 2 pipeline): časť A ho číta z `stats:s:<sid>` → `startedAt` v ms;
B1 ho zapisuje v tomto tvare, takže pole je teraz vyplnené (overené integráciou, bod 7.1). `presentSince` je z mapy
podu plnenej udalosťami adaptéra (STATS-A §4.2, §15.1), nie zo `socket.data`.

## 2. Kľúče v Redise (prefix `<APP_ENV_PREFIX>collab:` z ioredis)

| Kľúč | Typ | Obsah | TTL |
|---|---|---|---|
| `<room>:stats:session` | string | id relácie miestnosti | 7 dní pri `n > 0`, 60 s (grace) od `n = 0` |
| `stats:s:<sid>` | hash | `room`, `entity`, `entityId`, `version`, `startedAt`, `lastEventAt`, `lastChangeAt`, `n`, `peakUsers`, `copresenceMs`, `copresenceUsersMs`, `firstCopresenceAt`, `pcount`, `moderator`, `zeroAt`, `endKind`, `c:<počítadlo>`, `p:<pod>` | 7 dní, obnovuje každá udalosť |
| `stats:s:<sid>:users` | set | `userId` účastníkov | 7 dní |
| `stats:s:<sid>:u:<userId>` | hash | `order`, `joins`, `presentSince`, `presentMs`, `wasModerator`; **B2** pridá `bodyEdits`, `fieldEdits`, `locksAcquired`, `locksRefused`, `firstEditAt`, `lastEditAt` | 7 dní |
| `stats:s:<sid>:u:<userId>:min`, `…:fields` | set, hash | **B2** (minúty s úpravou, úpravy na pole); finalizér ich už číta | B2 |
| `stats:pending` | zset | `sid` → čas ďalšej kontroly | – |
| `stats:finalizer:lock` | string | mutex behu (`SET NX PX 120000`) | 120 s |
| `stats:dropped` | set | `<sid>\|<entity>:<deň>` zahodených | – |
| `stats:breaker` | hash | `failures`, `openUntil`, `warnedAt` (breaker naprieč podmi) | – |

- **Lua členstva** (`collabStatsRedis.ts:49-194`, jedna cesta do Redisu na udalosť): ukazovateľ → relácia (nová len pri
  vstupe; pri vstupe do prázdnej miestnosti, ktorej relácia nikdy neklesla na 0, nová a stará ide hneď do `pending`
  na uzavretie ako `stale`); **zosúladenie všetkých** podľa celého `userIds` (kto chýba, má zavretú prítomnosť; kto je
  v `userIds` a je účastník, má otvorenú; účastníka zakladá len `join` a `reconcile`); `n`, `peakUsers`,
  spoluprítomnosť z predošlého `n`; moderátor (`wasModerator`, `c:transfers`, `c:moderationExecuted`,
  `c:moderatorPassedOn` podľa zmeny); `c:occupied`, `c:kicks`, `c:purges`, `c:collabStarts`; pri `n = 0` grace a
  `pending` o 61 s; čas sa nikdy nevracia (`max(now, lastEventAt)`).
- **Počítadlá žiadostí** (`joinRequested`, `joinApproved`, `joinRejected`, `joinExecuted`, `moderationRequested/Approved/
  Rejected`) v B1 nie sú: pridali by I/O do ďalších handlerov. Doplní ich B2 pamäťovým agregátorom a flushom do
  `c:<počítadlo>` bez I/O na udalosť (odchýlka 8.4).

## 3. Mongo: schémy, indexy, spojenie

Štyri kolekcie s prefixom `${envPrefix}` na samostatnej inštancii mongoose (`collabStats.model.ts`), tvary presne
§10.5.1 a §10.5.2 (`ICollabSession`, `ICollabParticipant`, `ICollabDaily`, `ICollabDailyUsers`,
`ICollabStatsFinalized`). Vnorené súčty dní sú `Mixed` (finalizér ich mení `$inc` po bodkovaných cestách),
`minimize: false`.

| Kolekcia | Indexy (meno) |
|---|---|
| `collab_sessions` | `stats_list_time` `{entity, peakBucket, category, startedAt: -1, _id: -1}`, `stats_list_duration` `{…, durationMs: -1, startedAt: -1, _id: -1}`, `stats_list_joint` `{…, jointActiveMinutes: -1, startedAt: -1, _id: -1}`, `stats_user_time` `{entity, participants.userId, startedAt: -1, _id: -1}`, `stats_ttl` `{startedAt: 1}` 2 592 000 s |
| `collab_daily` | `stats_daily_ttl` `{day: 1}` 2 592 000 s |
| `collab_daily_users` | `stats_daily_users_ttl` `{day: 1}` 2 592 000 s |
| `collab_stats_finalized` | `stats_finalized_ttl` `{at: 1}` 172 800 s |

TTL presne 30 dní (rozhodnutie 11). Kolekcie a indexy vytvorí `prepareCollabStatsCollections()` raz za proces pred prvou
transakciou (transakcia ich vytvoriť nevie); existujúce ostanú.

**Spojenie (B3, kritérium /6)** (`statsMongodb.ts`): `new Mongoose()` s `debug: false`, `bufferCommands: false`,
`strictQuery`; `connect` s `maxPoolSize 3`, `serverSelectionTimeoutMS 2000`, `connectTimeoutMS 5000`,
`socketTimeoutMS 10000`, `autoIndex/autoCreate false`. Pri štarte sa nečaká (`index.ts`), neúspešné spojenie skúsi
znova ďalší beh finalizéra, zatvára sa v graceful shutdown po svojej rade (druhá skupina s Redisom a hlavným Mongom).
Hlavné spojenie s `LOG_LEVEL=debug` zapína debug len globálnej inštancii (`storage/mongodb.ts:14`), inštancia
štatistík ho má vypnutý aj vtedy (test), takže inserty relácií s `userId` sa nelogujú.

## 4. Finalizér a transakcia

Rada `collab-stats` (`removeOnComplete/removeOnFail` na jobe aj ako predvolené), worker `concurrency: 1`,
`upsertJobScheduler('collabStatsFinalize', { every: 30 000 })`. Beh (`collabStatsFinalizer.ts:305-380`):

1. mutex `SET stats:finalizer:lock <uuid> NX PX 120000`, uvoľnenie Lua „zmaž, ak je token môj“; druhý beh skončí
   `{ ran: false }`;
2. `ZRANGEBYSCORE stats:pending -inf <teraz> LIMIT 0 200`, jeden pipeline `HGETALL` + `SMEMBERS`, jeden `GET`
   ukazovateľov;
3. roztriedenie: chýba v Redise → zmazať; ukazovateľ = sid a `n > 0` → kontrola živosti; ukazovateľ = sid a `n = 0` →
   preskórovať na koniec grace; inak skončená; skončená pred viac ako 24 h → `SADD stats:dropped`, kľúče preč;
4. **kontrola živosti** (§10.4.3): jeden snímok `fetchMembers()` (spoločný s `live`, cache 5 s) pre všetky obsadené;
   Lua `reconcile` so skutočnými `userIds` k času snímku. Kontrola sa preskočí, keď udalosť miestnosti prišla neskôr ako
   1 s pred snímkom (tá mala novšie `userIds`). Obsadené relácie sa preskórujú na **5-minútovú mriežku**, takže
   prídu na rad v tom istom behu a stačí jeden snímok. Bez odpovede iného podu → preskórovanie o 60 s a tlmený `warn`;
5. breaker otvorený → koniec bez Monga; inak `HGETALL` účastníkov (+ B2 kľúče), `finalizeCollabSession()`, a
6. **jedna transakcia** (`runStatsTransaction`: `startSession` + `withTransaction(…, { readPreference: 'primary',
   timeoutMS: 10 000 })`):
   1. `collab_stats_finalized.find({ _id: { $in } })` – relácie s markerom sa preskočia; zahodená sa preskočí, ak má
      marker `dropped:<sid>` alebo (zapísaná, len Redis neupratal) `<sid>`;
   2. `insertMany` markerov `{ _id: sid | 'dropped:'+sid, at }` (aj sólo);
   3. `insertMany` `collab_sessions` (len 2+);
   4. `bulkWrite` `$inc` + `$setOnInsert {entity, day}` do `collab_daily` (sólo: `solo.*`, `byHour.<h>.solo`; 2+:
      `multi.*` a `multi.byPeakUsers.<kôš>.*`, `byHour.<h>.multi/realCollab`; `stale`, `dropped`);
   5. `find` dnešných `collab_daily_users` (kľúče kvôli stropu) a `bulkWrite` `$inc` `byUser.<id>.*`, `byPair.<a_b>.*`;
      nový kľúč nad 1 000 / 2 000 ide do `other`;
7. **až po commite** jeden `MULTI`: `DEL` kľúčov relácií, `ZREM pending`, `SREM stats:dropped`.

Pád medzi commitom a krokom 7: ďalší beh nájde markery a len uprace Redis (unit test aj integrácia so `SIGKILL`, bod 7.2).
Výpadok Monga: relácie čakajú v `pending`, po 24 h od konca sa zahodia a ďalšia úspešná transakcia ich pripočíta do
`dropped` svojho dňa raz. **Breaker** v Redise (jeden pre všetky pody): 3 zlyhané dávky za sebou → otvorený 60 s, potom
jedna skúšobná; `warn` len pri otvorení a najviac raz za 15 min (`warnedAt`), `info` pri zatvorení, inak `debug`.

Uzavretie relácie (`finalizeCollabSession`): `endedAt` = `zeroAt` (miestnosť sa vyprázdnila; `endReason` `purge` po
purge, `stale` po kontrole živosti, inak `empty`), inak `lastEventAt` a `stale`; otvorené prítomnosti a
spoluprítomnosť sa dopočítajú k `endedAt`; účastníci ≤ 50 (najaktívnejší, zoradení podľa `order`,
`participantsOverflow`), `fieldsChanged` ≤ 50 a `other`, minúty ≤ 480, BSON ≤ 256 KB (inak `fieldsChanged`
najmenej aktívnych na `{ other }`). Deň a hodina podľa **začiatku** relácie v Europe/Bratislava (aj cez zmenu času).

**Kategórie a B2** (zadanie: „zvoľ a zdôvodni, ako to v kóde označiť“): klasifikácia §10.1/7 je celá v čistej
funkcii `classifyCollabSession` a testovaná na syntetických úpravách (12 min oddelené, 4 min skutočná, 2 úpravy tela
pod prahom, 1 úprava poľa). Jej vstupy z úprav sú **polia hashu účastníka a kľúče `:min`, `:fields`**, ktoré zapíše flush
B2 a ktoré finalizér už číta (komentár pri `collabStatsKeys` a `CollabStatsSessionState`). V B1 chýbajú, takže každá
relácia 2+ nad 30 s je `presenceOnly`. Príznak v dátach nie je, lebo B1 bez B2 do produkcie nejde (rozhodnutie 10);
B2 doplní len zber a flush, finalizér, tvar v Mongu ani testy klasifikácie sa nemenia.

## 5. Horúca cesta

| Handler | Pribudlo | Kde |
|---|---|---|
| `joinCollabRoom` | 1× Lua po odpovedi Ok (aj po odpovedi „obsadené“, aj v upratovaní neúspešného vstupu) | `joinCollabRoomListener.ts:96`, `:143`, `:194` |
| `leaveCollabRoom` | 1× Lua po odpovedi (aj v upratovaní neúspešného odchodu) | `leaveCollabRoomListener.ts:71`, `:97` |
| `disconnecting` | 1× Lua na miestnosť, na konci jej akcie | `disconnectingListener.ts:37` |
| `kickUserFromRoom`, `purgeRoom`, `transferModeration` | 1× Lua na konci akcie | `kickUserFromRoomListener.ts:58`, `purgeRoomListener.ts:48`, `transferModerationListener.ts:37` |
| `moderationRequestProcessor` (job) | 1× Lua | `moderationRequestProcessor.ts:31` |

Volanie je **čakané pod zámkom miestnosti, ale až po odpovedi klientovi** (ack vstupu a odchodu nečaká na štatistiky),
nikdy nehodí (chyba → tlmený `warn`), pre nepočítané miestnosti (boxy, stránky, `:info`) a pri vypnutí nič nepošle.
Žiadne Mongo, žiadne ďalšie I/O; navyše len `new ObjectId()` (kandidát na id relácie). `HGET` pred `mayStore` a
`onChange` sú B2. **Cena Lua** (bod 7.4): 94 µs času Redisu na volanie a 0,7 ms (p50) / 1,3 ms (p95) čakania
volajúceho pri miestnostiach s 1–3 ľuďmi; či to pohne latenciou vstupu a odchodu pod záťažou, rozhodne až brána /4.

## 6. Testy

`yarn test`: **27 súborov, 233 testov a 1 preskočený** (skutočný Redis bez `REDIS_TEST_URL`; pred B1 21 súborov, 167
testov). Nové:

- `collabStatsMembership.test.ts` (15): Lua cez zrkadlo v TS (`test/support/statsRedis.ts`, ten istý Redis v pamäti
  používajú aj ďalšie testy): otvorenie, spoluprítomnosť 2 a 3 ľudí, odchod nahradenej karty, neskoré odpojenie a
  neúspešný vstup bez zmeny, odchod nezakladá účastníka, grace (návrat do 60 s, nová po nej), nová relácia po páde
  podu, moderátor a jeho odovzdania, počítadlá, žiadna relácia bez vstupu, nepočítané miestnosti a vypnutie, tlmený
  `warn`; `reconcile`: otvorí a zavrie podľa snímku, prázdna → grace ako `stale`, preskočí novšiu udalosť a cudziu
  reláciu. **Ten istý scenár (18 udalostí, 2 miestnosti, všetky vetvy) proti skutočnému Lua na Redise 7.2.4**
  (`REDIS_TEST_URL`) dá ten istý stav ako zrkadlo (kľúče, hodnoty, TTL); bez premennej sa preskočí (CI).
- `collabStatsFinalizer.test.ts` (14), Redis v pamäti a Mongo v pamäti s transakciami (`test/support/statsMongo.ts`):
  zápis relácie 2+ a jej dňa, sólo len do dňa, **pád po commite pred zmazaním v Redise → nič dvakrát**, zlyhaný commit
  → nič zapísané a relácie čakajú, dva behy naraz → jeden, kontrola živosti (jeden snímok, zavretie, prázdna → grace,
  preskočená novšia udalosť, preskórovanie), bez odpovede podu, pád podu → `stale`, grace sa preskóruje, chýbajúca
  relácia, **zahodenie po 24 h a jedno `dropped`**, **breaker: 3 zlyhania → jeden `warn`, otvorený nič neskúša,
  skúška zlyhá → `debug`, návrat → `info` a zápis raz**, strop 1 000 ľudí → `other`, chyba Redisu nehodí.
- `collabStatsSessionHelper.test.ts` (20): kategórie §10.11/4, tvar dokumentu §10.5.1, `stale` k `lastEventAt`,
  `purge`, sólo, **stropy /7** (50 účastníkov a `participantsOverflow`, 50 polí a `other`, 480 minút), **BSON**
  (dokument 560 KB orezaný pod 256 KB; stropový dokument 50 × 50 polí `comment:<UUID>` a 480 minút bez orezania),
  dni a hodiny cez zmenu času, prírastky sólo, multi a košov, ľudia a páry, `other`.
- `collabStatsMongo.test.ts` (6): **kritérium /6** – samostatná inštancia, `debug` vypnutý aj pri zapnutom hlavnom,
  `bufferCommands`, pool a timeouty, `connect` s nimi raz, transakcia `primary` s `timeoutMS` 10 000; **skutočné
  spojenie na `mongodb://127.0.0.1:1`: finalizér nehodí, breaker sa otvorí raz s jedným `warn`, 3 behy pod 10 s**;
  mená kolekcií; indexy s menami, `_id` na konci, TTL presne 30 dní.
- `collabStatsQueue.test.ts` (1): rada `collab-stats`, `removeOnComplete/removeOnFail`, scheduler 30 s, `concurrency 1`.
- `collabStatsEvents.test.ts` (2) a doplnené `join…`, `leave…`, `kick…`, `purge…`, `transferModeration…` testy:
  každý handler zapíše členstvo pod zámkom miestnosti a po odpovedi, s `userIds` po udalosti; `index.test.ts` (+2):
  štart nečaká na Mongo štatistík, vypnutie poradie; `config.test.ts` (+1); `collabStatsLive.test.ts` (+1)
  `fetchMembers`.

## 7. Integrácia (2 pody z `dist`, `stats-b1-redis` 7.2.4, `stats-b1-mongo` 8.0.20 replica set)

`integracia.sh` → `integracia.mjs` (klienti socket.io 4.8.4 s JWT z `krok5-praca/perf/keys`, moderované vstupy so
žiadosťou a schválením ako admin-cms), výstup `integracia-vystup.txt`, logy `server-a.log`, `server-b.log`. Dva behy:
`…-1` na prvom builde, druhý na finálnom (po `yarn build` z bodu 10). **Výsledok oboch: 21/21 OK.**

### 7.1 Relácie (fáza 1)

| Miestnosť | Čo sa stalo | Výsledok v Mongu |
|---|---|---|
| 1 | 101 sám 35 s | sólo, `lt5m` |
| 2 | 201 (A) moderátor, 202 (B) obsadené → žiadosť → schválenie → vstup; 50 s spolu | `collab_sessions`: 201 a 202, `presenceOnly`, `counters {occupied: 1, collabStarts: 1}`, `pods` A aj B |
| 3 | 301 dá reload (socket preč, o 5 s nový cez B) | tá istá relácia, sólo |
| 4 | 401 otvorí druhú kartu cez B (prvú vyhodí) | tá istá relácia, sólo |
| 5 | 501 (A) a 502 (B); **A zabité `SIGKILL`**; 501 sa o 5 s vráti cez B | jedna relácia 2+, `joins 1` oboch (`clickThrough`, spolu 27 s) |
| 6 | 601 (A) a 602 (B); A zabité, 601 sa nevráti | **kontrola živosti** na najbližšej 5-min hranici zavrela 601 k času snímku (`presentMs` 35 936 / 215 505 v behoch 1 / 2), miestnosť ostala otvorená; po odchode 602 `empty` |
| 7 | 701 sám na A; A zabité; 701 cez B do prázdnej miestnosti | nová relácia; stará uzavretá ako `stale` k poslednej udalosti |

`live/rooms?bucket=twoPlus` počas miestnosti 2: `sessionStartedAt` = `startedAt` relácie v Redise. Po zápise:
`collab_daily` 5 sólo (2 `lt30s`, 3 `lt5m`), 3 relácie 2+, `stale 1`, `byHour."20"` (Bratislava), súčty `multi.totalMs` a
`multi.participants` sa rovnajú dokumentom; `collab_daily_users` 201, 601 (`moderated`), 202, 602 (miestnosť 5 je
preklik, nerátá sa); Redis bez kľúčov relácií a s prázdnym `pending`.

### 7.2 Zabitie finalizéra medzi commitom a zmazaním v Redise (fáza 2)

Relácia 801 skončí, oba pody sa zastavia. `harness/finalizer.mjs` spustí finalizér z `dist` s loader hookom
(`harness/hooks.mjs`), ktorý `runStatsTransaction` obalí: po commite proces zabije `SIGKILL`. Výsledok: commit
`{"written":1}`, marker a `solo.sessions +1` v Mongu, relácia ostala v Redise aj v `pending`. Druhý beh (zámok zmazaný
ako po vypršaní): `{"written":0}`, Redis upratal, `solo.sessions` a počet markerov bez zmeny.

### 7.3 Mongo zastavené na 2 min (fáza 3)

Relácie 9 (2+) a 10 skončia 50 s pred zastavením (čakajú od 11. s výpadku), 13 a 11 skončia počas neho, 14 začne
počas neho a skončí po ňom. `docker stop stats-b1-mongo` na 120 s:

- počas výpadku: `1101 join ok, 1301 leave ok, 1101 leave ok, 1401 join ok` (vstupy do prázdnych miestností a odchody);
- zlyhané dávky ~2 s každá (`ECONNREFUSED` po výbere servera), tretia 98 s (beh 1) a 85 s (beh 2) po zastavení →
  **jediný `warn`** v logoch oboch podov („Failed to write the collaboration stats to MongoDB 3 times in a row…“),
  žiadny `error`;
- po návrate: skúšobná dávka → `info` „written to MongoDB again“, všetkých 5 relácií zapísaných raz; spolu 14 markerov,
  4 dokumenty, `multi.sessions 4`, `solo.sessions 10`, súčty `totalMs` a `copresenceMs` sa rovnajú dokumentom; Redis
  prázdny.

### 7.4 Cena skriptu členstva (`meranie-lua.sh`, `meranie-lua.txt`)

`recordMembership()` z `dist` proti `stats-b1-redis`: 100 miestností × 10 kôl (vstup 1, 2, 3 ľudí, odchod na 2, 1, 0),
6 000 volaní čakaných za sebou: **p50 716 µs, p95 1 317 µs, p99 1 632 µs** čakania volajúceho (WSL a docker sieť);
`INFO commandstats`: **`evalsha` 94 µs na volanie** v Redise, 0 zlyhaní.

### 7.5 Prod štart

`start-prod.sh` (lokálny `.env`): všetky moduly sa načítajú, štart skončí až na Mongo (`MongooseServerSelectionError:
getaddrinfo ENOTFOUND mongo-anzu`, `start-prod.log`); spojenie štatistík sa pred hlavným Mongom nezakladá.

## 8. Odchýlky od návrhu a rozhodnutia

1. **Finalizér každých 30 s, nie 60 s.** S breakerom po 3 zlyhaných dávkach a behom každých 60 s sa počas 2-min
   výpadku (kritérium /5) zmestia do okna najviac 2 behy, breaker by sa neotvoril nikdy. Pri 30 s sa otvorí po troch
   behoch od prvej čakajúcej relácie (zlyhaný beh trvá ~2 s), v integrácii 98 a 85 s po zastavení Monga (bod 7.3). Cena:
   jeden `ZRANGEBYSCORE` navyše za minútu.
2. **Kontrola živosti bez zámku miestnosti.** Snímok klastra je vždy starší ako zámok, ktorý by sa bral až po ňom, takže
   poradie nerieši zámok, ale čas: Lua kontrolu preskočí, keď posledná udalosť miestnosti prišla neskôr ako 1 s pred
   snímkom (tá zosúladila s novšími `userIds`). Zámok by len pridal Redlock na každú obsadenú miestnosť každých 5 min
   a súperil s akciami ľudí. Obsadené relácie sú na 5-minútovej mriežke, takže na snímok stačí jedna požiadavka
   klastra na beh; snímok je ten istý ako pre `live` (cache 5 s).
3. **Transakcia cez `startSession()` a `withTransaction(…, { readPreference: 'primary', timeoutMS: 10 000 })`**,
   nie `connection.transaction()` s `maxCommitTimeMS 5000`: typy `transaction()` v mongoose 9.11 `timeoutMS` nepustia
   a jeho obal len vracia stav mongoose dokumentov (tu žiadne). `timeoutMS` (CSOT) ohraničí opakovania
   `TransientTransactionError`/`UnknownTransactionCommitResult` aj commit spolu na 10 s (§10.4.4 „vlastný strop 10 s“).
4. **Počítadlá žiadostí do B2** (bod 2): `joinRequested` až `moderationRejected` by v B1 pridali I/O do ďalších
   handlerov; zadanie pripúšťa na horúcej ceste len jedno volanie Lua. `moderationExecuted`, `transfers`,
   `moderatorPassedOn`, `occupied`, `kicks`, `purges` a `collabStarts` sú v B1 (rátajú sa v tom istom Lua).
5. **Lua aj pri odovzdaní moderovania a prevzatí na žiadosť** (`transferModerationListener`,
   `moderationRequestProcessor`; §10.2 uvádza odovzdanie), pri odpovedi „obsadené“ a v upratovaní neúspešného vstupu a
   odchodu. Inak by `wasModerator` chýbal moderátorovi, ktorý odíde skôr, ako ho uvidí ďalšia udalosť.
6. **Breaker v Redise** (`stats:breaker`), nie v pamäti podu: finalizér beží striedavo na podoch, `warn` má byť jeden.
7. **`stats:dropped` nesie entitu**: `<sid>|<entity>:<deň>` (návrh `<sid>|<deň>`), lebo `_id` dňa je
   `<entity>:<deň>`. Zahodená relácia sa nepripočíta, ak má už aj marker `<sid>` (zapísaná, len Redis 24 h neupratal).
8. **Deň a hodina relácie podľa jej začiatku** (Europe/Bratislava), tak ako zoznam filtruje `startedAt` a TTL beží od
   `startedAt`. Návrh to neurčoval.
9. **`collab_daily_users`** (návrh určil len tvar): `byUser` počíta relácie 2+ okrem prekliku (`collaborations`, z
   nich `edited`, `moderated`, súčty úprav a aktívnych minút); `byPair` len dvojice z `collabPairs`,
   `jointActiveMinutes` = minúty, v ktorých upravovali obaja. Nulové prírastky sa nezapisujú.
10. **Purge** má rovnakú grace ako odchod: návrat do 60 s pokračuje v relácii; `endReason: 'purge'` je, keď miestnosť
    po purge prázdna ostala. Reláciu zakladá len vstup: miestnosť obsadená počas nasadenia dostane reláciu pri
    najbližšom vstupe.
11. **„Lua zrkadlená v TS“** (§10.11/3) slúži ako Redis v pamäti pre testy členstva aj finalizéra; zhodu so skutočným
    Lua overuje test proti Redisu (`REDIS_TEST_URL`), v CI bez Redisu sa preskočí.
12. Navyše v hashi relácie: `moderator` (zmena = odovzdanie), `zeroAt` a `endKind` (koniec a jeho dôvod), `p:<pod>`
    (zoznam `pods` bez ďalšieho kľúča). Nasledujúca kontrola živosti sa počíta z hodín volajúceho, nie z času snímku,
    aby relácia neprišla na rad hneď znova.

## 9. Neoverené

- **Výkon** (kritérium /4: perf zapnuté a vypnuté, nový scenár rotácie) – podľa zadania vedúci po B2 nástrojom
  `krok5-praca/perf` s `COLLAB_STATS_ENABLED`; mám len mikromeranie Lua (bod 7.4).
- **Atlas**: transakcie, tier a verzia produkcie, `timeoutMS` (CSOT je v ovládači 7.7 označené ako experimentálne);
  overené len na lokálnom replica sete 8.0.20 s jedným členom.
- **Redis Cluster** nie je podporený (Lua skladá kľúče relácie z prefixu); predpoklad ako pri BullMQ: produkčný Redis
  bez klastra. Iné verzie Redisu ako 7.2.4 (viac polí v `HSET` vyžaduje 4.0+).
- **Rolling deploy** (prijaté rozhodnutím 5) a pády podu počas transakcie pred commitom (len unit test ako zlyhaný
  commit; nedokončenú transakciu zruší Mongo).
- Výpadok Monga dlhší ako 24 h (zahodenie a `dropped`) len unit testom.
- Hodiny podov rozídené o viac ako 1 s: kontrola živosti môže zavrieť prítomnosť, ktorú udalosť práve otvorila;
  najbližšia udalosť alebo kontrola ju otvorí znova (odvodené).
- `partialDays`, `explain`, dashboard a endpointy čítania sú časť C.

## 10. Kontroly (logy v `krok5-praca/stats-b1/`)

`kontroly.sh`: `yarn lint:fix` 0, `yarn ci` 0, `yarn test` 3× 0 (27 súborov, 233 testov, 1 preskočený), `yarn build` 0,
`yarn tsc` 0, test skutočného Lua s `REDIS_TEST_URL` 0 (15 testov) – `kontroly.log`, `kontrola-*.log`. Prod štart
bod 7.5. Kontajnery `stats-b1-redis` a `stats-b1-mongo` zmazané (`docker rm -f stats-b1-redis stats-b1-mongo`).

## 11. Návrh správy commitu

```
feat: collaboration sessions of the stats (part B1): each change of a counted room's membership, under the room's lock and after the answer, runs one Lua script that keeps the session in Redis (grace 60 s, participants by userId reconciled with all users of the room, copresence, peak, moderators, counters); a finalizer in its own BullMQ queue collab-stats every 30 s, one run across the instances by a Redis mutex, checks the occupied rooms against the members of all instances every 5 min and writes the ended sessions in one MongoDB transaction per batch with a marker per session (collab_sessions for 2+ users, $inc of collab_daily and collab_daily_users, TTL 30 days), Redis cleaned only after the commit; its own mongoose instance (pool 3, no buffering, short timeouts, debug off) with a breaker shared in Redis, one warning per 15 min, sessions waiting in Redis while MongoDB is down and dropped as counted after 24 h; live/rooms gets sessionStartedAt; COLLAB_STATS_ENABLED=false turns the sessions off
```

## 12. Opravy po posudkoch

Zadanie `krok5-praca/zadania/zadanie-stats-b1-opravy.md`, posudky `posudky/stats-b1-codex.md` a Opus (M1–M3, L1–L7).
Nad `8a5d85b`, nič necommitnuté, `.gitignore` je vlastníkov. Skripty a logy v `krok5-praca/stats-b1-opravy/`.

### 12.1 Čo sa zmenilo

| Bod | Oprava | Kde |
|---|---|---|
| 1 (Codex H) | Štatistiky majú **vlastný Redis klient** (`duplicate` hlavného, meno `collab-stats`): `commandTimeout` 500 ms, `maxRetriesPerRequest` 0, bez offline fronty, bez opätovného posielania po reconnecte. Volanie pod zámkom miestnosti teda čaká najviac ~500 ms (pri NOSCRIPT dvakrát), pri odpojenom Redise zlyhá hneď a nič sa nepošle neskôr mimo poradia. Klient sa zakladá pri štarte (bez fronty by prvé udalosti zlyhali), zatvára sa v druhej skupine vypnutia. Ten istý klient používa aj finalizér. Zlyhaný záznam si pod zapamätá (`Map<room, čas>`, strop 10 000); najbližší úspešný záznam tej istej miestnosti na tom istom pode pošle čas zlyhania a Lua dá `incomplete: 1` relácii, ktorá vtedy existovala (`startedAt ≤ zlyhanie`), alebo novej, ak vznikla do 60 s po ňom. Finalizér ho prenesie do `collab_sessions.incomplete` a `collab_daily.incomplete`. | `collabStatsRedis.ts:236-273`, `collabStatsSessionManager.ts:50-66`, `:110-129`, Lua `:91-94`, `:116-118`, `index.ts:64-66` |
| 2 (Codex H) | Množina `stats:s:<sid>:present` (účastníci s otvorenou prítomnosťou). Udalosť zosúlaďuje len `present ∪ userIds`, nie všetkých, čo kedy boli; prácu s celou históriou (obnova TTL kľúčov všetkých účastníkov) robí len `reconcile` finalizéra raz za 5 min, mimo zámku. Úplný zoznam (`:users`) číta až finalizér. | Lua `collabStatsRedis.ts:121-151`, `:170-175`, `collabStatsFinalizer.ts:97-104` |
| 3 (Opus M1) | `collab_daily_users` len zo `realCollab`: `byUser` len používatelia z `collabPairs`, `byPair` tie isté dvojice. `presenceOnly`, `separateEdits` a moderátor s čitateľmi bez úprav nedajú nič. `byUser.edited` sa tým rovná `collaborations`; tvar §10.9.2 ostal, časť C ho môže zjednodušiť. | `collabStatsSessionHelper.ts:386-422` |
| 4 (Opus M2) | `fieldsChanged` je pole `{ f, n }` (najčastejšie prvé, `other` posledné): názov poľa od klienta je hodnota, nie kľúč; overené, že BSON NUL v hodnote berie a v kľúči hádže `BSONError`. Pred zápisom `collabStatsWriteProblem()` overí dokument a cesty `$inc` (kľúč bez NUL, bodky, `$` na začiatku; čísla konečné; deň `<entita>:YYYY-MM-DD`); chybná relácia ide do `stats:dropped` (ďalšia transakcia ju započíta ako `dropped`) s tlmeným `warn`. Ak Mongo dávku odmietne chybou dát (`isCollabStatsDataError`: BSON, validácia, `MongoInvalidArgumentError`, kódy BadValue, DottedFieldName, DuplicateKey… a nie `TransientTransactionError`), finalizér zapíše každú reláciu a každú zahodenú vo vlastnej transakcii; odmietnutá relácia → `dropped`, odmietnutá zahodená → vzdaná s logom. Iná chyba (spojenie, timeout) ide ako doteraz do breakera: nič sa nezahodí pre výpadok. Neplatné položky `stats:dropped` sa zmažú s logom. | `collabStats.model.ts:14-18`, `:161`, `collabStatsSessionHelper.ts:197-220`, `:450-516`, `collabStatsFinalizer.ts:299-338`, `:417-466` |
| 5 (Codex M) | TTL markerov `collab_stats_finalized` **8 dní** (bolo 2), dlhšie ako TTL kľúčov relácie (7 dní). Zdôvodnenie nižšie (12.2). | `collabStats.model.ts:147-149` |
| 6 (Codex M) | Dvojice sa hľadajú len medzi prvými 50 editormi podľa poradia, teda medzi účastníkmi, ktorých dokument drží (O(50²) aj pri stovkách editorov); najviac 200 dvojíc s najviac spoločnými minútami. `byPair` a `byUser` (bod 3) berú tie isté dvojice. Dokument so 100 editormi, 50 × 50 polí a 480 minút má pod 256 KB. | `collabStatsSessionHelper.ts:143-196`, `:274-287` |
| 7 (Opus M3) | `azure-pipelines.yml`: `REDIS_TEST_URL: "redis://$(REDIS_HOST):$(REDIS_PORT)/15"`. Meno hostiteľa overené v šablóne `DevOps/azure-ci-template` (`node-ci.yaml`: `yarnTestServiceRedisEnabled` pridá službu `redis` s menom `yarnTestServiceRedisHostname`, predvolene `redis`, obraz `redis:7.2.4`, port 6379; čítané cez `az devops invoke`). Paritný test porovnáva aj návratové hodnoty každého volania Lua (vrátane zlyhaného) a pribudol test počtu príkazov v Redise (`INFO commandstats`). Zrkadlo v TS ostalo. | `azure-pipelines.yml:14-15`, `test/collabStatsMembership.test.ts` (koniec) |
| 8 L4 | Zlyhaný štart rady `collab-stats` server nezhodí: tlmený `warn`, pod beží bez finalizéra (bežia ho ostatné) a skúša znova každých 60 s; vypnutie opakovanie zruší. | `index.ts:72-86`, `:108` |
| 8 L5 | `stats:dropped` sa číta `SRANDMEMBER … 200`, nie `SMEMBERS`. | `collabStatsFinalizer.ts:420` |
| 8 L6 | `COLLAB_STATS_ENABLED: "#{COLLAB_STATS_ENABLED}#"` v `configuration.yaml`. Šablóna nahrádza tokeny `replacetokens@6` s `missingVarLog: off`: bez premennej v skupine hodnota nie je `true` a štatistiky nebežia (predvolene vypnuté od `OPTIMALIZACIE.md` §6, pôvodne zapnuté), zapnutie potrebuje premennú `true`. Pod spustený s vypnutými štatistikami zapíše `stats:disabledAt` (TTL 7 dní). Relácia, ktorej posledná udalosť je staršia, sa pri najbližšej udalosti (Lua) aj v behu finalizéra uzavrie k svojej poslednej udalosti (`stale`) bez kontroly živosti; vstup začne novú. Čas vypnutia sa nezapočíta. | `configuration.yaml:14`, `collabStatsSessionManager.ts:61-66`, Lua `:95-99`, `collabStatsFinalizer.ts:375-394` |
| 8 L7 | `IndexOptionsConflict`/`IndexKeySpecsConflict` (85, 86) pri `createIndexes` sa zaloguje (`warn`) a príprava pokračuje: existujúci index ostane, mongoose vytvorí ostatné. Breaker sa kvôli nemu neotvorí natrvalo. Týka sa to aj zmeny TTL markerov z bodu 5 na databáze, kde B1 už index vytvoril (TTL treba vtedy zmeniť `collMod`, alebo index zmazať). | `collabStats.model.ts:277-335` |
| 8 L1 | ~~`reconcile` preskočí miestnosť, kým existuje kľúč jej zámku (`lock:room:<room>`, KEYS[4]), a preskóruje ju na ďalšiu mriežku.~~ **V B2 odstránené** (rozhodnutie vlastníka, možnosť b): kontrola nikdy nezabrala, lebo Redlock robí v svojich skriptoch `SELECT` databázy 0 (`@sesamecare-oss/redlock`, `settings.db` predvolene 0) a `lock:room:*` drží tam, kým štatistiky čítajú databázu z `REDIS_URL`. Zostáva známe obmedzenie nižšie. | Lua `collabStatsRedis.ts` (pôvodne `:82-89`), `exectionLockHelper.ts` (pôvodne `:27-28`) |
| 8 L2 | `p:<pod>` zapisuje len udalosť, nie `reconcile` finalizéra. | Lua `collabStatsRedis.ts:170-196` |

**Známe obmedzenie (L1, po B2):** kontrola živosti nevidí zámok miestnosti. Keď posledný odchod z miestnosti prebieha
práve počas 5-minútovej kontroly (socket už nie je v miestnosti, jeho záznam ešte neprišiel), kontrola nájde miestnosť
prázdnu a začne grace. Relácia potom skončí ako `stale` namiesto `empty` a koniec je čas snímku. Počty a trvania to
prakticky neovplyvní, koniec sa líši najviac o čas tej akcie (odvodené). Test `collabStatsMembership.test.ts` („ends as stale…“).

**Neopravené (L3, známe):** rozdelenie relácie pri prehratom súboji o zámok. Keď akcii miestnosti vyprší lease zámku (zaseknutie dlhšie ako lease) a miestnosť medzitým zmení iná akcia, Lua dostane udalosti mimo poradia alebo zastarané `wasEmpty`; vstup s `wasEmpty` do relácie s `n > 0` ju uzavrie ako `stale` a začne novú. Vzácne (len pri strate zámku), relácia sa rozdelí na dve, nič sa nezapočíta dvakrát.

### 12.2 Bod 5: prečo 8 dní

Zapísaná relácia, ktorej upratanie v Redise zlyhalo (pád medzi commitom a `MULTI`), ostáva v Redise najviac 7 dní od
svojej poslednej udalosti; commit príde až po konci, takže marker je vždy mladší ako jej kľúče. Kým ju finalizér môže
nájsť v `pending`, marker existuje a beh ju len uprace. Do `stats:dropped` sa presunie len vtedy, keď 24 h po konci stále
nie je upratná, teda len pri výpadku Monga (s dostupným Mongom ju najbližší beh nájde podľa markera); marker má v tej chvíli
najviac 24 h a vydrží ešte 7 dní. Dvojité započítanie (`written` aj `dropped`) teda vyžaduje pád v okne commit → upratanie
a výpadok Monga dlhší ako ~7 dní; prijaté (štatistiky z takého výpadku sú stratené tak či tak). Kontrola markera pred
započítaním `dropped` už existuje (`writeBatch`), no bez dlhšieho TTL nepomôže. Cena: kolekcia markerov ~4× (8 dní namiesto
2), pri ~10 000 reláciách denne ~3 MB.

### 12.3 Testy (`yarn test`)

`yarn test`: **28 súborov, 259 testov a 2 preskočené** (skutočný Redis bez `REDIS_TEST_URL`); s `REDIS_TEST_URL` proti
`stats-b1o-redis` 7.2.4 **261 testov**, nič preskočené. Pred opravami 27 súborov, 233 testov a 1 preskočený. Nové a zmenené:

- `collabStatsRedis.test.ts` (nový, 2): skutočný ioredis klient s produkčnými voľbami proti TCP serveru, ktorý odpovie na
  handshake a potom mlčí: akcia miestnosti odpovie hneď, volanie štatistík vzdá po 500 ms (`Command timed out`), zámok je
  voľný do 1 s a ďalšia akcia ho vezme hneď; pri nedostupnom Redise zlyhá do 100 ms bez čakania na spojenie.
- `collabStatsMembership.test.ts` (+7): voľby klienta; **200 vystriedaných účastníkov: udalosť má ten istý počet príkazov
  ako po 5**; príznak `incomplete` po zlyhanom zázname (aj pre reláciu do 60 s po ňom, nie neskôr); relácia spred vypnutia
  sa uzavrie, nová od vstupu; `reconcile` preskočí zamknutú miestnosť a nezapíše pod finalizéra. **Na skutočnom Redise**:
  scenár s ~30 volaniami (vrátane zlyhaného volania, zámku, vypnutia) dá ten istý stav aj tie isté návratové hodnoty ako
  zrkadlo; **udalosť po 10 a po 100 účastníkoch spustí v Redise rovnaký počet príkazov** (`INFO commandstats`).
- `collabStatsFinalizer.test.ts` (+7): moderátor s čitateľom nie je kolaborácia, dvaja editori áno (`byUser`, `byPair`);
  relácia spred vypnutia uzavretá bez snímku; relácia s neplatným číslom → `dropped`, ostatné zapísané; dávka odmietnutá
  Mongom → po jednej (4 transakcie), odmietnutá → `dropped`, breaker zatvorený; chyba spojenia počas zápisov po jednej →
  breaker, nič zahodené; **zapísaná relácia s neupratným Redisom a Mongom dole 4 dni sa nezapočíta ako `dropped`** (TTL
  markerov emulovaný); `stats:dropped` po 200, chybná položka zmazaná.
- `collabStatsSessionHelper.test.ts` (+7): dvojice len medzi prvými 50 editormi, najviac 200, prednosť spoločných minút;
  100 editorov pod 256 KB; názov poľa s bodkou, `$` a NUL ako hodnota; `incomplete`; problémy zápisu; chyby dát vs.
  spojenia.
- `collabStatsMongo.test.ts` (+2): TTL markerov 691 200 s; konflikt indexu → `warn` a pokračuje, iná chyba → príprava zlyhá.
- `index.test.ts` (+2): zlyhaný štart rady → `warn`, pokus o 60 s, server beží; vypnutie opakovanie zastaví; vypnuté
  štatistiky zapíšu `stats:disabledAt`; klient štatistík pred štartom servera a zatvorený s Mongom štatistík.

### 12.4 Integrácia (`integracia.sh`, 2 pody z `dist`, `stats-b1o-redis` 7.2.4, `stats-b1o-mongo` 8.0.20 replica set)

Skript z `krok5-praca/stats-b1/` prevzatý a rozšírený: pody idú do Redisu cez proxy v skripte, ktorá vie zadržať
odpovede Redisu spojeniu štatistík (rozpozná ho podľa `CLIENT SETNAME collab-stats`), teda Redis zaseknutý len pre
štatistiky, kým zámky a zvyšok kolaborácie bežia. Fáza 0 pred štartom podov založí index markerov s TTL 2 dni (ako ho
vytvoril B1). Dva behy: `integracia-vystup-1.txt` (build pred poslednou úpravou komentárov) a `integracia-vystup.txt` na
finálnom `dist`, logy `server-a*.log`, `server-b*.log`. **Výsledok oboch: 32/32 OK.**

- **Fázy 1–3 ako v bode 7** (všetky pôvodné kontroly OK): relácie, preklik, druhá karta, zabitý pod, kontrola živosti
  (`presentMs` 214 227 / 124 203), zabitie finalizéra medzi commitom a upratovaním (nič dvakrát), Mongo dole 2 min (jeden
  `warn`, breaker sa zavrel s `info`, 14 markerov, 4 dokumenty, súčty sedia).
- **Nové v nich**: každý pod má práve jedno spojenie `collab-stats`; `collab_daily_users` je prázdne (žiadne úpravy → žiadna
  kolaborácia, bod 3); dokumenty majú `incomplete: false` a `fieldsChanged` ako pole; **konflikt indexu (L7) je skutočný
  `IndexOptionsConflict` z Monga 8.0.20**: jeden `warn` na pod, relácie sa zapísali, breaker zatvorený; po zmazaní starého
  indexu ho reštartované pody vytvoria s TTL 691 200 s.
- **Fáza 4 (bod 1), Redis štatistík zaseknutý 8 s**: 1502 (B) prejde cez obsadené → žiadosť → schválenie → vstup za
  1 045 / 879 ms (behy 1 / 2), **hneď nato odchod za 661 / 880 ms** (čaká na zámok, ktorý vstup drží, kým jeho volanie
  štatistík nevzdá po 500 ms), žiadosť 1503 (A) `occupied` za 830 / 581 ms; zadržané 4 odpovede. Všetky akcie odpovedali,
  každý pod jeden tlmený `warn` „Failed to record… Command timed out“. Po uvoľnení prvý záznam miestnosti z B (návrat 1502
  dostal `occupied`, nová žiadosť v skripte nie je) prenesie čas zlyhania: dokument relácie má **`incomplete: true`** a jej
  deň `incomplete: 1`; Redis na konci prázdny. Bez opravy by vstup držal zámok, kým Redis neodpovie (tu 8 s), a odchod by
  po ~0–4 s pokusov o zámok zlyhal (odvodené z `roomLockRetryCount`, nemerané).

### 12.5 Kontroly

`kontroly.sh` (`kontroly.log`, `kontrola-*.log`): `yarn lint:fix` 0, `yarn ci` 0, `yarn test` 3× 0 (28 súborov, 259 testov,
2 preskočené), `yarn test` s `REDIS_TEST_URL=redis://127.0.0.1:6399/15` 0 (261 testov), `yarn build` 0, `yarn tsc` 0. Prod
štart (`start-prod.sh`): moduly sa načítajú, štart skončí na `MongooseServerSelectionError: getaddrinfo ENOTFOUND
mongo-anzu`. Kontajnery `stats-b1o-redis` a `stats-b1o-mongo` zmazané. CI so `REDIS_TEST_URL` nebežalo (len lokálne);
šablónu som čítal, pipeline nespúšťal.

**Neoverené / prijaté:** volanie, ktorému vypršal timeout, Redis môže vykonať neskôr (ioredis ho len prestane čakať); pri
pomalom Redise ide v poradí príchodu, mimo poradia len pri zaseknutí samotného spojenia jedného podu. Príznak `incomplete`
je v pamäti podu: po reštarte podu alebo keď pod už žiadnu udalosť miestnosti nezaznamená (zlyhala posledná), relácia
skončí kontrolou živosti ako `stale` bez neho. Relácie v Redise z buildu B1 (bez `:present`) by po nasadení mali prítomnosť
odchádzajúcich otvorenú do konca; B1 nebol nasadený. Výkon (brána /4) a rotácia pod záťažou sa nemerali.

### 12.6 Návrh správy commitu

```
fix: the collaboration sessions of the stats after the reviews: their Lua runs on an own Redis connection (500 ms command timeout, no offline queue, no resend) so a slow Redis holds the lock of a room at most 500 ms after its answer, and a failed record marks its session incomplete through the next record of the room (collab_sessions.incomplete, collab_daily.incomplete); an event reconciles only the users in the room and those still present (a :present set), not every past participant; collab_daily_users counts only real collaborations, the users of their pairs; fieldsChanged is a list of { f, n }, a session MongoDB would refuse is counted as dropped and a batch it refuses is written one session at a time; the markers live 8 days, longer than the keys in Redis; the pairs of a session only among the participants it keeps, at most 200; CI runs the real Lua on its Redis service (REDIS_TEST_URL) and compares the answers too; a failed start of the stats queue no longer stops the server and is tried again, stats:dropped is read 200 at a time, COLLAB_STATS_ENABLED is in the Kubernetes configuration and a session left open while the stats were off ends at its last event, an index conflict is logged instead of keeping the breaker open, the liveness check skips a locked room and records no instance of the finalizer
```
