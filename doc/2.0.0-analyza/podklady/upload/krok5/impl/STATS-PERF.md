# STATS-PERF: brány výkonu štatistík kolaborácie (B1 + B2), zapnuté proti vypnutým

Zadanie: `krok5-praca/zadania/zadanie-stats-perf.md`. Záväzné kritériá: `COLLAB-STATS.md` §10.13 body (4) a (5).
Merané 23. 10. 2026 (13:35–17:29). Nástroje a surové výsledky: `/home/volar/projects/anzusystems/krok5-praca/perf/`,
kampaň `results/stats` (súhrn `results/stats/summary.md` + `summary.json`). Hlavná kampaň: 22 behov, 0 zlyhaných,
100 % doručených úprav vo všetkých behoch, 0 chýb v logoch servera mimo výpadku Monga. Repozitár collaboration nezmenený.

## Verdikt

- **Brána 4 (perf on/off): NEPREJDE v žiadnom z troch scenárov.** Mediány p50 (úpravy, vstup, odchod, slučka) sa
  nemenia; horšie sú chvosty, CPU a GC:
  - b: slučka p99 3,57 → 5,25 ms (+47 %), úprava p95 +0,20 ms (rozptyl 0,13); CPU +1,0 bodu v rozptyle.
  - d: CPU oboch inštancií +2,9 bodu (+8 %), úprava p99 +1,5 ms, slučka p99 +0,3 ms.
  - rotácia: CPU 27,3 → 33,1 % (+21 %), GC 1,7 → 3,5 % času, slučka p99 +3,1 ms, úprava p95 4,6 → 10,3 ms,
    vstup p95/p99 +17/+14 ms, odchod p95/p99 +30/+125 ms.
- **Brána 5 (Mongo dole 2 min): robustnosť áno, „nie horšie" nie.**
  - Breaker sa otvoril raz a do falošného Sentry prišiel jeden `warn`. Relácie čakali v Redise (pending až 120).
  - Po návrate Monga sa všetky zapísali raz. Súčty `collab_daily` aj `collab_daily_users` sedia s reláciami a počet
    zapísaných sa rovná počtu otvorených článkov.
  - Rotácia so štatistikami je však počas zotavenia výrazne horšia: úprava p50 2,8 → 10,2 ms, vstup p50 41 → 120 ms,
    CPU 45 → 53 %. Po návrate Monga je jadro nasýtené (off 60–100 %, on 94–100 %).
- **Príčina (overená profilom a pokusom):** vlastný kód štatistík stojí ~1 s CPU za 5 min a alokácie pribudne len
  1,7 %. Zvyšok robí malý heap produkčného štartu (`--max-old-space-size=200`):
  - V8 pri ňom robí takmer len mark-compact, ~1×/s už bez štatistík; štatistiky to zvýšia 1,8×.
  - Pri 400 MB (jeden pár behov rotácie) klesne GC pod 0,5 % v oboch variantoch a rozdiel CPU on − off z 5,8 na
    1,6 bodu.
  - Druhý zdroj sú chvosty vstupu a odchodu: čakaný skript členstva predlžuje držanie zámku miestnosti a každá
    kolízia stojí 0–400 ms čakania Redlocku.
- Návrh opráv je v bode 5. Nič som neopravoval.

## 1. Nastavenie

- **Server:** `git archive 66106b2` (vetva `feature/collab-stats`) → `perf/collab-stats`, `yarn install --immutable`,
  `yarn build` (lint + tsc zelené), skript `perf/build-collab-stats.sh`.
  - Štart ako `prod` skript: `NODE_OPTIONS="--max-old-space-size=200 --import @sentry/node/import
    --max-http-header-size=65536"` + monitor, `node dist/index.js`, `taskset` 1 jadro (d: dve jadrá).
  - Dva varianty z jedného buildu: `COLLAB_STATS_ENABLED=true` (on) a `false` (off). `COLLAB_STATS_SYSTEM_FIELDS`
    predvolené podľa `.env.dist`.
  - `APP_DEPLOY_ENV=perf` (Sentry zapnutý), falošný Sentry ako predtým, traces 0, profiles 0, `LOG_LEVEL=info`,
    `ALLOW_MULTIPLE_COLLAB_SERVER_INSTANCES=true`.
- **Služby:**
  - `perf-collab-mongo` `mongo:8.0.20` ako jednouzlový replica set (`--replSet rs0`, `rs.initiate`, člen
    `127.0.0.1:27117`, port aj vnútri kontajnera, oplog 512 MB, WiredTiger cache 0,25 GB, jadrá 4–5).
  - `MONGODB_URL=…/collaboration?replicaSet=rs0`; štatistiky ho zdieľajú cez vlastnú inštanciu mongoose.
  - `perf-collab-redis` `redis:7.2.4`. Pred každým behom `dropDatabase` a `FLUSHALL` (`services.sh up rs`).
- **Klient:** `client-next` (provider 4.7.1, socket.io-client 4.8.4, yjs 13.6.33).
- **Dashboard:** v každom behu oboch variantov každú sekundu `GET /api/sys/v1/collab-stats/live?entity=article` aj
  `/live/rooms?entity=article&bucket=twoPlus` so `SYS_API_TOKEN`, v d striedavo na obe inštancie. Výklad „1
  požiadavka/s na live a live/rooms": oba endpointy každú sekundu, teda 2 požiadavky/s. Všetky odpovedali 200.
- **Scenáre:**
  - b: 30 × 3 editori, 2 znaky/s, sys API každých 10 s, 5 min;
  - d: b na dvoch inštanciách, 3 min;
  - rotácia (nová, `rot` v `lib/scenarios.mjs`): podrobnosti nižšie.
- **Poradie:** každý scenár 3× pre každý variant, striedavo off/on. Brána 5: dva páry (prvý pár stratil warn vo
  falošnom Sentry, viac v bode 3).
- **Trvanie:** behy neskrátené. Hlavná kampaň trvala 1 h 58 min, s druhým párom brány 5 a diagnostikou 3 h 54 min.

**Scenár rotácie článkov** (`lib/generatorWorker.mjs`, trieda `RotationSlot`), 30 slotov po 3 používateľoch, okno
5 min po 30 s zahriatí:
- Článok je moderovaná miestnosť `cms:article:<id>`. Kto ho otvorí, je moderátor a zostáva.
- Ďalší dvaja cyklicky (pauza 1–3 s) žiadajú o vstup: `joinCollabRoom` → `occupied` → `requestToJoin` → moderátor
  `approveRequestToJoin` po 0,2–0,8 s → `joinCollabRoom` → `enteredCollabRoom`.
- Potom 5–12 s píšu: telo 2 znaky/s cez Hocuspocus a zámkový cyklus poľa (`acquireFieldLock` → 2× `changeFieldData` →
  `releaseFieldLock`, každé 4 s). Nakoniec odídu (`leaveCollabRoom`, 60 %) alebo dajú reload (odpojenie, nový socket,
  nový vstup, 40 %).
- V polovici článkov moderátor raz vyhodí niekoho alebo odovzdá moderovanie (spolu ~30 kickov a ~20 odovzdaní za okno).
- Provider sleduje stav miestnosti ako admin-cms: kolaborácia (2+) cez Hocuspocus, moderátor sám bez neho. Odpoveď na
  `startCollab` nesie telo a `collabStatsBase` polí.
- Po 60–90 s všetci odídu a slot otvorí ďalší článok, takže relácie končia priebežne (~145 za beh). V štvrtine článkov
  píše len ten, kto článok otvoril, ostatní čítajú (relácie `presenceOnly`).
- Za okno ~1 840 vstupov, ~1 140 žiadostí, ~1 210 odchodov, ~600 reloadov, ~37 000 úprav tela a ~8 200 zmien polí.
  Aktivita je v off aj on rovnaká.

**Kritérium brány 4** (`lib/analyze.mjs`, sekcia „Brána 10.13/4"): |medián on − medián off| < rozptyl troch behov
off. Rozptyl beriem ako max − min. Rozptyl v zmysle variancie by mal iné jednotky, pri mediánoch troch hodnôt je
rozpätie prirodzené. Smerodajná odchýlka je v súhrne tiež. Metriky:
- p50/p95/p99 úprav;
- p50/p95/p99 ackov vstupu a odchodu (len rotácia; b a d ich v okne nemajú);
- CPU, RSS priemer, slučka p50/p99.

## 2. Brána 4: on proti off (medián troch behov)

| scenár | metrika | medián off | rozptyl off | medián on | Δ | brána |
|---|---|---|---|---|---|---|
| b | úprava p50 / p95 / p99 [ms] | 1,86 / 5,19 / 9,96 | 0,42 / 0,13 / 3,08 | 2,06 / 5,39 / 13,0 | +0,20 / +0,20 / +3,01 | áno / **NIE** / áno |
| b | CPU [% jadra] | 16,2 | 2,40 | 17,3 | +1,01 | áno |
| b | RSS priemer [MB] | 303 | 4,5 | 304 | +0,2 | áno |
| b | slučka p50 / p99 [ms] | 0,17 / 3,57 | 0,02 / 0,54 | 0,17 / 5,25 | +0,01 / +1,69 | áno / **NIE** |
| d | úprava p50 / p95 / p99 [ms] | 3,43 / 11,4 / 18,4 | 0,34 / 0,35 / 0,63 | 3,50 / 11,6 / 19,9 | +0,07 / +0,15 / +1,46 | áno / áno / **NIE** |
| d | CPU oboch inštancií [% jadra] | 35,1 | 0,70 | 38,1 | +2,94 | **NIE** |
| d | RSS priemer [MB] | 298 | 2,5 | 297 | −0,1 | áno |
| d | slučka p50 / p99 [ms] | 0,16 / 2,05 | 0,01 / 0,25 | 0,16 / 2,37 | 0 / +0,32 | áno / **NIE** |
| rot | úprava p50 / p95 / p99 [ms] | 1,25 / 4,60 / 15,5 | 0,27 / 1,74 / 5,35 | 1,25 / 10,3 / 20,7 | 0 / +5,66 / +5,20 | áno / **NIE** / áno |
| rot | ack vstupu p50 / p95 / p99 [ms] | 4,06 / 32,3 / 62,3 | 0,97 / 16,0 / 10,1 | 4,34 / 48,8 / 75,8 | +0,28 / +16,5 / +13,5 | áno / **NIE** / **NIE** |
| rot | ack odchodu p50 / p95 / p99 [ms] | 6,07 / 26,4 / 63,9 | 0,68 / 13,4 / 2,19 | 6,65 / 56,6 / 189 | +0,58 / +30,2 / +125 | áno / **NIE** / **NIE** |
| rot | CPU [% jadra] | 27,3 | 2,57 | 33,1 | +5,81 | **NIE** |
| rot | RSS priemer [MB] | 315 | 14,3 | 316 | +1,7 | áno |
| rot | slučka p50 / p99 [ms] | 0,12 / 9,73 | 0,02 / 1,51 | 0,13 / 12,8 | +0,01 / +3,06 | áno / **NIE** |

Informatívne (mimo kritéria; medián off → on):
- **GC [% času]:** b 0,63 → 0,77, d 0,50 → 0,59, rotácia 1,70 → 3,47.
- **Príkazy Redis [/s]:** b 389 → 618, d 1 137 → 1 400, rotácia 1 925 → 2 722. Väčšinou ide o príkazy vnútri Lua
  (`EXPIRE`, `HSET`, `HINCRBY`, `HGET`).
- **`live/rooms` p99:** b 15 → 35 ms, rotácia 29 → 47 ms (p50 ~3 ms v oboch).
- **Rotácia:**
  - acky zámkov a polí p99 +7 až +10 ms;
  - `requestToJoin` p50 **197 → 3,6 ms**: off je tu horší, vo všetkých behoch, pozri bod 6;
  - slučka max 41 → 69 ms.
- **Mongo:** zápisy dokumentov bez rozdielu (b 60/min, rotácia ~103/min).

## 3. Brána 5: Mongo zastavené na 2 min (`docker stop`/`start` 60 s po začiatku okna, primary späť po 181 s)

Dva páry behov na scenár (off/on), hodnoty sú priemer oboch. Ako šum slúži rozptyl off z brány 4.

| metrika | b off | b on | rot off | rot on |
|---|---|---|---|---|
| úprava p50 / p95 / p99 [ms] | 1,67 / 5,01 / 11,9 | 2,14 / 8,03 / 16,0 | 2,77 / 30,5 / 42,3 | **10,2 / 44,2 / 83,1** |
| ack vstupu p50 / p99 [ms] | – | – | 41 / 2 981 | **120** / 2 830 |
| ack odchodu p50 / p99 [ms] | – | – | 15 / 2 132 | **113** / 2 057 |
| acky zámku/zmeny/uvoľnenia p99 [ms] | – | – | 262 / 360 / 243 | **477 / 619 / 495** |
| vypršané / zamietnuté acky | – | – | 162 / 613 | 192 / 655 |
| chyby v logu servera | 0 | 0 | 1 031 | 1 059 |
| CPU [% jadra] | 15,2 | 17,8 | 45,1 | 52,7 |
| slučka p99 [ms] | 4,85 | 6,32 | 17,7 | 25,4 |

- **Rotácia, štatistiky:**
  - pending na začiatku výpadku 55/59, na konci 91/91, max 117/120;
  - **breaker otvorený 1×** v oboch behoch (3 zlyhané dávky, otvorený v 181. s, zavretý v 239./240. s);
  - v logu servera **jeden** `warn` „Failed to write the collaboration stats to MongoDB 3 times in a row…" a jeden
    `info` „…written to MongoDB again";
  - **do falošného Sentry prišiel jeden `warn` štatistík** (druhý beh). V prvom behu bol warn v logu, ale falošný
    Sentry si pamätal len prvých 500 udalostí a warn prišiel po 659 chybách. Opravil som to v nástroji (počítanie
    podľa správy) a zopakoval celý pár.
  - Po behu: pending 0, kľúče relácií 0, `stats:dropped` 0, zahodených 0. Zapísaných 143/139 relácií (132/131 2+,
    11/8 sólo) = otvorených článkov. Všetky súčty `collab_daily` a `collab_daily_users` sedia s reláciami (zoznam
    porovnaní v bode 4).
- **b, štatistiky:** počas výpadku neskončila žiadna relácia (30 obsadených miestností je v pending na 5-min mriežke
  kontroly živosti). Štatistiky Mongo vôbec neskúšali: breaker 0, warn 0, čo je správne. Po behu sa zapísalo raz
  30/30 relácií. Breaker a warn sa preto overujú len rotáciou.
- **Chyby handlerov:** rovnakého druhu a počtu v oboch variantoch, štatistiky nepridali nový druh chyby. Ide hlavne o
  `Failed to join user into a room` (Redlock quorum, ECONNREFUSED Monga pri `removeEditorsData`) a `Room management
  action failed`. Štart spolupráce bez Monga zlyhá v oboch, ako zadanie predpokladá.
- **„Nie horšie" neplatí v rotácii:**
  - CPU po 30 s: počas výpadku rovnaké (15–22 %);
  - po návrate Monga v off 60–100 % a v on 94–100 % od prvých 30 s. Nasýtené jadro násobí latencie;
  - príčina je tá istá ako v bráne 4, ku ktorej sa pridá dávka finalizéra (~117 relácií v jednej transakcii)
    v najhoršej chvíli;
  - v b je rozdiel on − off podobný ako v bráne 4, výpadok ho nezväčšil.

## 4. Kontrola dát (rotácia, beh on #1, ďalšie dva behy rovnako)

Zapísaných 146 relácií 2+ a 1 sólo, markerov 147 = otvorených článkov. `endReason` vždy `empty`, `incomplete` 0,
`stale` 0. Kategórie: realCollab 95, presenceOnly 33, clickThrough 18 (články prerušené koncom behu).

- **realCollab:** všetkých 95 má `collabPairs` (3 dvojice) a `editors` 3. `jointActiveMinutes` ≥ 1. Všetci editori
  majú `edited: true` a `fieldsChanged` so svojím poľom (`perfField0..2`).
  - Príklad: moderátor 114 úprav tela, 39 polí, `joins` 1, `wasModerator`; hostia 89/96 úprav, 26/27 polí, `joins` 6/7,
    `locksAcquired` 12–14.
- **presenceOnly:** všetkých 33 má `editors` ≤ 1 a žiadne dvojice. **66 čitateľov má 0 úprav tela, 0 polí, 0 minút,
  prázdne `fieldsChanged` a žiadne `firstEditAt`.**
- **Počítadlá relácií:** `occupied` 1 245, `joinRequested` = `joinApproved` = `joinExecuted` 1 245, `collabStarts`
  456, `kicks` 38, `transfers` 26 (zodpovedá generátoru).
- **Porovnania (všetky sedia, `lib/statsCheck.mjs`):**
  - `multi.sessions`, `totalMs`, `copresenceMs`, `bodyEdits`, `fieldEdits`, `editors`, `participants` a počty
    kategórií = súčty dokumentov;
  - markery = sólo + 2+ + zahodené;
  - Σ `byUser.collaborations` = Σ používateľov dvojíc (285), Σ `byPair.collaborations` = Σ dvojíc;
  - Σ `byUser.bodyEdits`/`fieldEdits` = úpravy účastníkov v dvojiciach.

## 5. Príčina a návrh opravy (nič neopravené)

**Profil CPU** (`stats-rot-cpuprof`, `lib/profileCompare.mjs`, `profile-compare.txt`): zaneprázdnený čas 60,4 s →
75,4 s (+15 s za 337 s).
- GC +7,4 s (9,4 → 16,8 s).
- Natívne `write` +4 s. Je to zlib permessage-deflate `ws` Hocuspocus: 16,7 → 20,6 s. Kompresia beží vo vláknach
  libuv na tom istom jedinom jadre, s ňou aj pomocné vlákna GC, a predbiehajú hlavné vlákno.
- Kód štatistík so synchrónnymi rámcami na zásobníku ~0,94 s: `recordFieldWrite` 0,21, `writeBatch` 0,16,
  `onChange` 0,15, `recordMembership` 0,14, `readFieldBefore` 0,12 s.

**Alokácie** (`stats-rot-heapprof`, vzorkovanie heapu aj s odpadom, `lib/heapCompare.mjs`): okno 8 536 → 8 684 MB
(+1,7 %). Pod rámcami štatistík 212 MB za 5 min (`recordMembership` 52, `readFieldBefore` 47, finalizér 44, flush 17,
`onChange` 14 MB).

**GC** (`stats-rot-gc`, druhy z monitora; `stats-rot-tracegc`, `--trace-gc`):
- Pri `--max-old-space-size=200` robí V8 skoro výlučne **mark-compact**: off 306, on 539 za 5 min, scavenge len 5/2.
- Spúšťa ich „finalize incremental marking via task; GC in old space requested", vždy pri ~95–100 MB heapu.
- Committed heap je na strope (~207 MB vrátane 128 MB new space), old space len ~47–58 MB.
- V on sa prah znižuje (pred GC 104 → 90 MB) a frekvencia rastie počas behu (on 34 → 250 za 30 s, off 34 → 80).
- Malé navyše od štatistík (+2 MB old space, +1 MB kódu, ~0,7 MB/s alokácií) sa tým znásobí.

**Pokus `stats-rot-heap400`** (n = 1 na variant, rovnaký build, `--max-old-space-size=400` za produkčným príznakom):

| rotácia | off 200 | on 200 | off 400 | on 400 |
|---|---|---|---|---|
| CPU [% jadra] | 28,3 | 32,3 | **24,0** | **25,6** |
| GC [% času], mark-compact / scavenge | 1,70, 306 / 5 | 3,01, 539 / 2 | **0,45, 20 / 158** | **0,49, 19 / 167** |
| slučka p99 [ms] | 8,4 | 11,2 | 1,5 | 1,6 |
| úprava p95 / p99 [ms] | 4,2 / 14,5 | 9,4 / 19,5 | 3,1 / 4,8 | 3,3 / 5,5 |
| ack vstupu p95 / p99 [ms] | 24,8 / 58,1 | 45,2 / 69,8 | 13,2 / 25,5 | 13,3 / 22,1 |
| ack odchodu p95 / p99 [ms] | 24,9 / 65,1 | 44,6 / 76,2 | 15,8 / 21,4 | 16,2 / **96,6** |
| RSS priemer [MB] | 314 | 317 | 335 | 335 |

**Chvosty vstupu a odchodu** (odvodené z kódu a čísel, pokusom neoverené):
- Vstup a odchod čakajú `recordMembership` pod zámkom miestnosti po odpovedi (rozhodnutie B1, poradie udalostí). Zámok
  sa tak drží o jeden round trip Lua dlhšie (~0,7–1,3 ms, `STATS-B1.md` §7.4).
- Akcia miestnosti, ktorá naň narazí, čaká `retryDelay` Redlocku 200 ± 200 ms (`src/util/helper/exectionLockHelper.ts:41-42`). Odtiaľ
  odchod p99 189 ms a aj pri 400 MB 96 ms.
- Zrkadlový jav: `requestToJoin` v off čaká skoro vždy jeden pokus (p50 197 ms), v on nie (3,6 ms). Načasovanie
  zámku teda rozhoduje aj bez štatistík.

**Návrhy (v poradí, po každom zopakovať `bash perf/run-stats.sh`):**
1. **Heap produkčného štartu `--max-old-space-size=200` → 400** (`package.json` `prod`).
   - Pomôže aj bez štatistík: off −4 body CPU, slučka p99 8,4 → 1,5 ms, úprava p99 14,5 → 4,8 ms.
   - Rozdiel štatistík v CPU klesne na 1,6 bodu (v rozptyle off 2,6), GC a slučka sú rovnaké.
   - RSS 335 MB pod limitom podu 600 Mi; zvážiť aj 300 MB.
   - Je to zmena mimo štatistík, chce súhlas vlastníka a vlastné meranie (scenáre b, c, d bez štatistík, COLLAB-PERF).
2. **Kratšie čakanie na zámok miestnosti:** `retryDelay`/`retryJitter` 200/200 → napr. 25/25 ms a viac pokusov, aby
   celkové čakanie ostalo ~4 s.
   - Kolízia potom stojí desiatky ms, nie stovky. Týka sa aj off (`requestToJoin` 200 ms).
   - Ak to nestačí: poslať Lua členstva bez čakania na odpoveď, ale pred uvoľnením zámku na tom istom spojení (poradie
     drží FIFO spojenia). To by však zrušilo izoláciu 500 ms klienta štatistík z opráv B1, takže až po zvážení.
3. **Finalizér po výpadku:** dávky menšie ako 200 (napr. 50) alebo pauza medzi transakciami, aby zápis nahromadených
   relácií neprišiel naraz do nasýteného zotavenia. Hypotéza: podiel finalizéra na 94–100 % CPU som zvlášť nemeral.
4. Mimo štatistík, len postreh: permessage-deflate Hocuspocus WebSocketu stojí v rotácii ~5 % jadra (zlib na tom istom
   jadre). Stojí za samostatné meranie bez kompresie alebo s prahom.

## 6. Neoverené / obmedzenia

- Pokus s heapom 400 MB je n = 1 na variant a len v rotácii. Brány 4 a 5 pri ňom znova nebežali. Chvost odchodu p99 je
  v ňom horší (96 vs 21 ms), čo zodpovedá kolíziám zámku, ale jeden beh to nepreukazuje.
- Mechanizmus chvostov (Redlock `retryDelay`) je odvodený, neoverený pokusom. Príčinu `requestToJoin` p50 200 ms v off
  som nehľadal.
- Atlas (tier, latencia, `w=majority`), K8s CFS kvóta namiesto `taskset`, viac podov v rotácii, Redis Cluster ani dlhé
  behy (> 5 min) sa nemerali. Výpadok iba ako `docker stop` (čisté zatvorenie spojení), nie sieťový výpadok s timeoutmi.
- Brána 5 v b breaker netestuje: počas výpadku tam žiadna relácia neskončí. Overuje ho rotácia.
- Zotavenie po výpadku nasýti jedno jadro aj bez štatistík. Je to aj vlastnosť generátora: hostia skúšajú vstup každú
  sekundu, rotácia teda zaťaženie po výpadku preháňa.
- Odchýlka od zadania: brána 5 má dva páry namiesto jedného (prvý pár stratil warn vo falošnom Sentry), oba sú v súhrne.
  Diagnostické sady (`stats-rot-cpuprof`, `-heapprof`, `-gc`, `-tracegc` s oknom 2 min, `-heap400`) sú navyše.
- Počas diagnostiky bežali na stroji aj iné práce. Všetky behy čakali na pokoj (`wait-quiet.sh`: záťaž < 1, žiadny
  vitest/vue-tsc, 7 GB voľných), no pred dvoma behmi brány 5 (rot on #2) a `cpuprof` on bola záťaž 2–3.
- `LOG_LEVEL=info` ako predtým, produkcia má `debug`. Winston formátuje každý `debug` záznam aj pri `info` (logform +
  safe-stable-stringify ~150 MB alokácií za 5 min v oboch variantoch). Pri `debug` by štatistiky pridali ďalšie riadky
  (finalizér `debug` každých 30 s); nemerané.

## 7. Nástroje a surové výsledky

- **Spustenie celého merania:** `bash perf/run-stats.sh`. Postaví server, ak chýba (`build-collab-stats.sh`), spustí
  `services.sh up rs` a kampaň `stats` so všetkými sadami vrátane diagnostiky, nakoniec súhrn.
- **Upratanie:** `docker rm -f perf-collab-mongo perf-collab-redis`.
- **Čakanie na pokojný stroj:** `bash perf/wait-quiet.sh <príkaz>`.
- **Zmeny v nástrojoch (prepoužité, nie prepísané):**
  - `services.sh up rs`;
  - `lib/scenarios.mjs`: verzie `stats-on`/`stats-off`, scenár `rot`;
  - `lib/generatorWorker.mjs`: `RotationSlot`; `timedAck` počíta `occupied` zvlášť;
  - `lib/generator.mjs`: záťaž dashboardu;
  - `lib/run.mjs`: env variantov, voľby sady, výpadok Monga, vzorkovanie pending/breaker, kontrola po behu, druhy
    chýb v logu;
  - `lib/statsCheck.mjs`: kontrola dát v Mongu;
  - `lib/fakeSentry.mjs`: úroveň a správa udalostí;
  - `lib/monitor.cjs`: druhy GC, priestory heapu, voliteľne vzorkovanie heapu a `--trace-gc`;
  - `lib/analyze.mjs`: sekcie brán 4 a 5;
  - `lib/campaign.mjs`: sady `stats-*`;
  - `lib/profileCompare.mjs`, `lib/heapCompare.mjs`.
- **Surové výsledky:** `perf/results/stats/<sada>/stats-<off|on>-<n>/`:
  - `result.json` (všetky metriky, časová os CPU/RSS, `stats` s časovou osou pending/breaker a kontrolou dát);
  - `server-*.log`, `monitor-*.jsonl`, `generator.json`;
  - `cpuprof-*/*.cpuprofile`, `heap-0.heapprofile`;
  - `stats-rot-cpuprof/profile-compare.txt`, `stats-rot-heapprof/heap-compare.txt`.
- **Konzola a smoke:** konzola kampaní `results/stats-console*.log`, smoke testy nástroja `results/stats-smoke`.
- **Upratanie po meraní:** servery a generátory skončili s behmi. Kontajnery `perf-collab-mongo` a `perf-collab-redis`
  sú zmazané. Repozitár collaboration bez zmeny (`git status` čistý).

## Meranie 2: heap 400 + zámok 25/25 + dávka 50

Zadanie: `krok5-praca/zadania/zadanie-heap-lock-perf.md`, zmeny podľa `HEAP-LOCK.md`. Merané 23. 10. 2026 18:45 – 24. 10.
0:03 (5 h 20 min vrátane ~25 min čakania na cudzí vitest/vue-tsc). Kampaň `perf/results/heaplock`: 55 behov (46 +
3 zopakované + 6 `m1-c-heap400`), 0 zlyhaných,
100 % doručených úprav, 0 chýb v logoch servera mimo výpadku Monga. Tri behy, počas ktorých bežal cudzí vitest alebo
vue-tsc (kampaň to teraz zapisuje do `disturbed`), som zopakoval cez `--redo`. Pôvodné sú v `_replaced`.

### Nastavenie

- **Servery:** `git archive` + patch, skript `perf/build-heaplock.sh` → `build-copy.sh`; zdrojové repozitáre nezmenené.
  - **M1 off** = `next` 1b9163b, **M1 on** = 1b9163b + `collab-next-heaplock.patch` (heap 400, zámok miestnosti
    80 × 25 ± 25 ms, `changeFieldData` 320 × 25 ± 25 ms; overené v `dist`).
  - **M2** = 66106b2 + `collab-stats-batch50.patch` + `collab-stats-heaplock.patch`, jeden build, off/on cez
    `COLLAB_STATS_ENABLED`. Druhý patch obsahuje len zmenu A nad 66106b2 + B (tak ho zostavil
    `heap-lock/patch-a-na-stats.sh` a tak prešiel testami), preto idú oba v tomto poradí. V `dist` je
    `finalizerBatchSize = 50`, `finalizerBatchesPerRun = 4` a `retryDelay: 25`.
- **Všetko ostatné ako v prvom meraní** (bod 1): Mongo replica set, Redis, `client-next`, traces 0, falošný Sentry, 1
  jadro na server, 3× striedavo off/on, behy neskrátené.
  - M1 rotácia beží bez dashboardu (`next` nemá API štatistík).
  - M2 brána 5 má jeden pár. Nič sa nestratilo: warn prišiel, zápis sedí.
- **Kritérium** ako brána 4: |medián on − medián off| < rozptyl troch behov off. V M1 je navyše v kritériu priepustnosť,
  vypršané a zamietnuté acky a chyby (scenár c).

### M1: next 1b9163b (off) proti next + heap 400 + zámok 25/25 (on), bez štatistík

| scenár | metrika | off → on (medián) | Δ | brána |
|---|---|---|---|---|
| b | úprava p50 / p95 / p99 [ms] | 2,46 / 5,96 / 10,9 → 2,45 / 6,13 / 9,95 | −0,02 / +0,16 / −0,99 | áno |
| b | CPU / slučka p99 / GC | 16,9 % / 2,98 ms / 0,55 % → 16,1 % / 2,24 ms / 0,34 % | −0,8 / −0,75 / −0,22 | áno |
| b | RSS priemer [MB] | 302 → 316 | +14 | NIE (očakávané pri väčšom heape) |
| c | priepustnosť, vypršané, zamietnuté, chyby | 390/s, 0, 0, 0 → 390/s, 0, 0, 0 | 0 | áno |
| c | acky p50 (vstup, odchod, zámok, zmena, uvoľnenie) [ms] | 4,0 / 2,9 / 3,9 / 2,5 / 3,7 → 4,3 / 3,1 / 4,3 / 2,7 / 4,0 | +0,2 až +0,45 (+9–12 %) | NIE |
| c | acky p99 vstup / zámok / zmena / uvoľnenie [ms] | 27,7 / 14,3 / 18,0 / 17,8 → 13,6 / 12,3 / 29,0 / 13,7 | −14 / −2 / **+11** / −4 | zmena NIE |
| c | CPU [% jadra] | 31,6 → 33,9 | +2,3 | NIE |
| d | úprava p95 / p99, medzi inštanciami p99 [ms] | 13,5 / 20,7 / 22,5 → 12,1 / 17,8 / 19,1 | −1,4 / −2,9 / −3,5 | **prejde** |
| d | CPU 2 inštancií, GC | 40,2 % / 0,49 % → 39,7 % / 0,39 % | −0,6 / −0,1 | áno |
| rot | úprava p99 [ms] | 14,3 → 7,45 | −6,9 (−48 %) | áno (lepšie) |
| rot | vstup p95 / p99 [ms] | 20,8 / 61,7 → 13,7 / 22,8 | −7 / −39 (−63 %) | áno (lepšie) |
| rot | odchod p95 / p99 [ms] | 19,9 / 64,0 → 16,1 / 25,4 | −4 / −39 (−60 %) | áno (lepšie) |
| rot | zámok / zmena / uvoľnenie p99 [ms] | 55 / 57 / 54 → 20 / 21 / 19 | −35 (−64 %) | áno (lepšie) |
| rot | `requestToJoin` p50 / p99 [ms] | 197 / 405 → 31 / 57 | −166 / −348 | (info) lepšie |
| rot | CPU / slučka p99 / GC | 28,7 % / 7,30 ms / 1,23 % → 25,4 % / 1,66 ms / 0,48 % | −3,2 / −5,6 / −0,75 | áno (lepšie) |
| rot | vypršané acky (z ~24 000) | 2 → 7 | +5 | NIE (malé čísla) |
| rot | RSS priemer [MB] | 312 → 328 | +15 | NIE (očakávané) |

V M1 sa mark-compact skoro nedeje: b 69 → 8, rotácia 216 → 24 za okno. Namiesto neho bežia scavenge.

**Čo z toho robí zámok a čo heap** (`m1-c-heap400`, c 3×, obe verzie s `--max-old-space-size=400`, teda rozdiel je len
zámok):
- p50 všetkých ackov, CPU (30,6 → 30,7 %) aj priepustnosť sú rovnaké;
- horší je len **p99 zmeny poľa: 8,9 → 24,0 ms** (všetky tri behy on 24–36 ms, off 8,5–9,1).

Zvýšené p50 a CPU c v M1 (+0,3 ms, +2,3 bodu) teda nie sú od zámku. Tie isté buildy namerali v M1 a v tejto sade CPU
s rozdielom 2–3 bodov, takže ide o drift medzi oknami alebo o heap; rozlíšiť sa to dá len ďalším meraním.

**Prečo by kratšie čakanie zhoršilo chvost zmeny v c**, som nemeral (odvodené). Zmeny troch editorov miestnosti
kolidujú na zámku miestnosti častejšie, ako ukáže p99 pri 200 ms. Častejšie pokusy čakateľov (40/s) idú po tom istom
spojení Redisu ako príkazy držiteľa, takže môžu jeho akciu predĺžiť.

### M2: brána 4 znova (štatistiky off/on, heap 400, zámok 25/25, dávka 50)

| scenár | metrika | medián off | rozptyl off | medián on | Δ | brána |
|---|---|---|---|---|---|---|
| b | úprava p50 / p95 / p99 [ms] | 2,52 / 5,84 / 9,10 | 0,07 / 1,24 / 2,01 | 2,57 / 6,28 / 10,6 | +0,05 / +0,44 / +1,47 | áno |
| b | CPU, RSS, slučka p50 / p99 | 16,9 %, 317 MB, 0,22 / 2,40 ms | 0,65, 28, 0,03 / 0,37 | 17,0 %, 318 MB, 0,22 / 2,45 ms | +0,13, +1,6, 0 / +0,05 | **áno, prejde** |
| d | úprava p50 / p95 / p99 [ms] | 3,41 / 14,3 / 21,3 | 0,76 / 1,47 / 0,31 | 4,22 / 12,9 / 18,8 | **+0,81** / −1,37 / −2,51 | NIE / áno / lepšie |
| d | CPU 2 inštancií [% jadra] | 36,5 | 2,98 | 40,1 | **+3,63** | NIE |
| d | RSS priemer [MB] | 281 | 16 | 311 | **+30** | NIE |
| d | slučka p50 / p99 [ms] | 0,16 / 2,56 | 0,00 / 0,48 | 0,17 / 2,16 | +0,02 / −0,40 | NIE (0,01 ms) / áno |
| rot | úprava p50 / p95 / p99 [ms] | 1,30 / 3,22 / 5,18 | 0,07 / 0,41 / 1,01 | 1,27 / 3,21 / 5,95 | −0,03 / −0,01 / +0,77 | áno |
| rot | vstup p50 / p95 / p99 [ms] | 4,33 / 13,6 / 22,1 | 0,03 / 0,99 / 1,29 | 4,33 / 13,3 / 24,9 | 0 / −0,25 / **+2,79** | áno / áno / NIE |
| rot | odchod p50 / p95 / p99 [ms] | 6,46 / 15,3 / 20,6 | 0,43 / 2,37 / 7,21 | 6,45 / 15,6 / 36,6 | 0 / +0,22 / **+16,0** | áno / áno / NIE |
| rot | CPU, RSS, slučka p50 / p99 | 24,4 %, 333 MB, 0,12 / 1,58 ms | 0,55, 3,3, 0,01 / 0,10 | 24,5 %, 332 MB, 0,12 / 1,66 ms | +0,08, −0,4, 0 / +0,08 | áno |

Informatívne: GC rotácie 0,48 → 0,47 %. `requestToJoin` p50 28,6 → 3,8 ms (rovnaká asymetria ako predtým, ale v off
už jeden pokus 25 ms namiesto 200). Príkazy Redis b +230/s, rotácia +774/s. `live/rooms` p99 b 12,5 → 18,1 ms.

**Brána 4 v M2: NEPREJDE, ale v oveľa užšom rozsahu:**
- b prejde celá;
- rotácia prejde na CPU, GC, slučke, RSS a všetkých p50/p95; neprejdú len chvosty p99 vstupu (+2,8 ms) a odchodu
  (+16 ms). Mechanizmus je ten istý (čakaný skript členstva pod zámkom), len kolízia stojí 0–49 ms namiesto 0–399;
- d neprejde: CPU oboch inštancií +3,6 bodu (+10 %; inštancia 1 ~+1, inštancia 2 ~+2 body) a úprava p50 +0,8 ms
  (rozptyl 0,76, tesne). RSS +30 MB je dynamika heapu (off 280–283 MB v 5 zo 6 inštancií, on 309–315). V b je RSS
  rovnaké.
- Prečo štatistiky stoja v d viac CPU ako v b (+0,1), som nemeral. Kandidáti: živý snímok `live/rooms` cez druhú
  inštanciu s účastníkmi, flush oboch inštancií a kontrola živosti.

**Kontrola dát** (rotácia on, 3 behy): zapísaných 145/145/147 = otvorených článkov, nezhody 0, pending po behu 0,
`stats:dropped` 0. Kategórie realCollab 92–102, presenceOnly 25–38, clickThrough 14–19.

### M2: brána 5 znova (Mongo 2 min, jeden pár)

| metrika | b off | b on | rot off | rot on |
|---|---|---|---|---|
| úprava p50 / p95 / p99 [ms] | 2,06 / 4,72 / 7,16 | 2,41 / 6,20 / 10,2 | 1,37 / 3,20 / 5,14 | 1,42 / 3,37 / 6,28 |
| vstup / odchod p50 [ms] | – | – | 5,55 / 6,74 | 5,67 / 6,86 |
| vstup / odchod p99 [ms] | – | – | 2 345 / 2 040 | 2 416 / 2 097 |
| zámok / zmena / uvoľnenie p99 [ms] | – | – | 19 / 18 / 19 | 21 / 24 / 21 |
| vypršané / zamietnuté acky | – | – | 135 / 611 | 146 / 682 |
| chyby v logu servera | 0 | 0 | 976 | 1 045 |
| CPU [% jadra] | 16,0 | 17,0 | 23,5 | 24,6 |
| slučka p99 [ms] | 1,98 | 2,42 | 1,94 | 2,16 |

- **Robustnosť v rotácii: áno.**
  - Breaker sa otvoril 1× (3 zlyhania, otvorený v 181. s, zavretý v 239. s).
  - V logu je jeden `warn` a jeden `info` „written again", **do falošného Sentry prišiel jeden warn štatistík**.
  - Pending na začiatku výpadku 53, na konci 90, najviac 119.
  - Po behu je zapísaných 130 relácií 2+ a 10 sólo = 140 = otvorených článkov, všetky súčty `collab_daily` a
    `collab_daily_users` sedia, pending 0, zahodených 0.
- **V b** (žiadna relácia počas výpadku neskončila) breaker 0 a warn 0, čo je správne. Po behu 30/30 relácií raz.
- **„Nie horšie": v rotácii áno, v b nie.**
  - Po návrate Monga už jadro nie je nasýtené: CPU po 30 s off 18–27 %, on 20–29 %, predtým 60–100 %.
  - Latencie úprav a ackov sú takmer rovnaké. Úprava p50 predtým 2,8 → 10,2 ms, teraz 1,37 → 1,42.
  - Chyby (+7 %), zamietnuté (+12 %) a vypršané (+8 %) sú toho istého druhu v oboch variantoch (Redlock quorum a
    ECONNREFUSED Monga pri štarte spolupráce). V prvom meraní sa dva behy off líšili v týchto počtoch do ~3 %, teraz je
    n = 1, preto ich nepovažujem za preukázané zhoršenie.
  - V b je on horší v chvoste úprav (p99 +3 ms) a CPU +1 bod. To je viac ako rozptyl off z brány 4 (2,0 ms a 0,65),
    ale pri n = 1 to tiež nie je preukázané.

### Pred a po (brána 4, mediány off → on)

| scenár | metrika | prvé meranie | brána | meranie 2 | brána |
|---|---|---|---|---|---|
| b | slučka p99 [ms] | 3,57 → 5,25 (+1,69) | NIE | 2,40 → 2,45 (+0,05) | áno |
| b | úprava p95 [ms] | 5,19 → 5,39 (+0,20) | NIE | 5,84 → 6,28 (+0,44) | áno |
| b | GC [% času] | 0,63 → 0,77 | NIE | 0,34 → 0,36 | áno |
| d | CPU 2 inštancií [% jadra] | 35,1 → 38,1 (+2,9) | NIE | 36,5 → 40,1 (+3,6) | NIE |
| d | úprava p99 [ms] | 18,4 → 19,9 (+1,5) | NIE | 21,3 → 18,8 (−2,5) | lepšie |
| d | úprava p50 [ms] | 3,43 → 3,50 | áno | 3,41 → 4,22 (+0,81) | NIE |
| rot | CPU [% jadra] | 27,3 → 33,1 (+5,8) | NIE | 24,4 → 24,5 (+0,1) | áno |
| rot | GC [% času] | 1,70 → 3,47 | NIE | 0,48 → 0,47 | áno |
| rot | slučka p99 [ms] | 9,73 → 12,8 (+3,1) | NIE | 1,58 → 1,66 (+0,1) | áno |
| rot | úprava p95 / p99 [ms] | 4,6 → 10,3 / 15,5 → 20,7 | NIE / áno | 3,22 → 3,21 / 5,18 → 5,95 | áno / áno |
| rot | vstup p95 / p99 [ms] | 32 → 49 / 62 → 76 | NIE / NIE | 13,6 → 13,3 / 22,1 → 24,9 | áno / NIE |
| rot | odchod p95 / p99 [ms] | 26 → 57 / 64 → 189 | NIE / NIE | 15,3 → 15,6 / 20,6 → 36,6 | áno / NIE |

Celá tabuľka so všetkými metrikami je v `results/heaplock/compare-stats.md` (`lib/compareGates.mjs`).

### Verdikt merania 2

- **M1 (PR do `next`): odporúčam.**
  - Rotácia je výrazne lepšia: CPU −11 %, slučka p99 −77 %, chvosty vstupu, odchodu a zámkov −60 %, `requestToJoin`
    p50 197 → 31 ms.
  - b je lepšie v slučke a GC, d v chvoste úprav. Priepustnosť a chyby c sú bez zmeny.
  - Cena:
    - RSS +14–16 MB (pod limitom 600 Mi);
    - v c je p99 zmeny poľa 9 → 24 ms. Izolovaný pokus ukázal, že ide o zámok 25/25: najpomalšie ~1 % zmien
      v miestnosti s troma súbežnými editormi je o ~15 ms pomalšie, p95 ostáva rovnaké.
  - Ak to vadí, kompromis je 50 ± 50 ms (nemerané).
- **M2 (štatistiky):** heap 400 odstránil hlavný problém prvého merania (GC a CPU v rotácii, nasýtenie po výpadku).
  - Brána 4 prejde v b a v rotácii okrem chvostov p99 vstupu (+3 ms) a odchodu (+16 ms).
  - V d neprejde na CPU (+3,6 bodu pre dve inštancie) a tesne na p50 úprav.
  - Brána 5: robustnosť áno; „nie horšie" v rotácii áno, v b neisté (n = 1).
  - Na prísne splnenie brány 4 zostáva:
    - chvost odchodu a vstupu: Lua členstva po uvoľnení zámku na tom istom spojení, bod 5/2 prvého merania;
    - CPU štatistík pri dvoch inštanciách: najprv zmerať, čo ho tvorí (profil d).

### Neoverené (meranie 2)

- Rozdelenie účinku heapu a zámku som meral len v c (`m1-c-heap400`), nie v rotácii a b. Mechanizmus zhoršenia p99
  zmeny v c je odvodený.
- CPU štatistík v d bez profilu.
- Brána 5 má jeden pár (n = 1). Rozdiely chýb a ackov počas výpadku nie sú preukázané ani vylúčené.
- Drift medzi oknami: tie isté buildy dali v M1 c a `m1-c-heap400` CPU s rozdielom 2–3 bodov. Porovnania sú preto
  len v rámci jednej sady.
- RSS pri heape 400 kolíše medzi behmi o 15–30 MB (v d off 280, inak ~310–330). Limit podu sa nemeral pod K8s.
- Kompromis zámku 50 ± 50 ms, Atlas, viac podov a K8s CFS ako v prvom meraní.

### Nástroje a surové výsledky (meranie 2)

- **Spustenie:** `bash perf/run-heaplock.sh`. Postaví servery (`build-heaplock.sh`, `build-copy.sh`), spustí
  `services.sh up rs`, kampaň `heaplock` a porovnanie.
- **Doplnky nástrojov:**
  - `lib/campaign.mjs` čaká pred každým behom, kým nebeží cudzí vitest, vue-tsc, tinypool alebo tsc;
  - `lib/run.mjs` ich počas behu zapisuje do `disturbed`;
  - sady `m1-*`, `m1-c-heap400`, `hl-stats-*`;
  - verzie `next-1b9163b`, `next-heaplock`, `stats-hl-on/off`;
  - sekcie M1/M2 v `lib/analyze.mjs`, `lib/compareGates.mjs`.
- **Surové výsledky:**
  - `perf/results/heaplock/<sada>/<verzia>-<n>/result.json` a logy;
  - súhrn `results/heaplock/summary.md` (sekcie „Meranie 2, M1/M2"), `compare-stats.md`;
  - konzola `results/heaplock-console*.log`;
  - zopakované behy v `results/heaplock/_replaced`.
- **Upratanie:** servery a generátory skončili s behmi, kontajnery `perf-collab-mongo` a `perf-collab-redis` sú
  zmazané. V repozitári collaboration som nič nezmenil; `git status` ukazuje zmeny časti B z `HEAP-LOCK.md`
  (`collabStatsFinalizer.ts` a jeho test), ktoré sú z tej práce, nie z merania.

## Meranie 3: podmienky podu, opravený generátor, optimalizácie (rýchla verzia)

Zadanie: `krok5-praca/zadania/zadanie-perf-3.md`, zmeny podľa `OPTIMALIZACIE.md`, posudky `posudky/OPT-server-opus.md` a
`OPT-stats-opus.md`. Merané 24. 10. 2026 6:33–8:59 (2 h 25 min vrátane ~10 min čakania na záťaž Docker VM). Kampaň
`perf/results/perf3`: 34 behov, 0 zlyhaných, 0 rušených cudzím behom, 100 % doručených úprav, 0 chýb v logoch mimo
výpadku Monga.

**Rýchly odhad:** okná 3 min, **2 behy** na variant, rozptyl je rozdiel dvoch behov. Brána 4 je preto prísnejšia a
menej spoľahlivá ako pri 3 × 5 min. Plné meranie pred vydaním ostáva.

### Nastavenie a zmeny nástroja

- **Podmienky podu:** každý server beží s `--max-semi-space-size=16` (to, čo V8 zvolí pri limite 600 Mi), ak prod
  skript alebo variant neurčí iné.
  - V meraniach 1 a 2 bol semi-space 64 MiB (WSL bez cgroup limitu, new space 128 MB) a práve ten pri heape 200 MB
    spôsoboval sústavné mark-compact.
  - Voľby každého servera sú v súhrne (riadky „Voľby").
- **Generátor:**
  - `every()` má každú periódu náhodne ±10 %; zámkové cykly editorov sa už nedržia v rovnakej fáze;
  - klient čaká **5–20 ms** medzi odpoveďou servera a ďalšou závislou akciou, ako RTT prehliadača: žiadosť po
    „obsadené", vstup po schválení, `enteredCollabRoom`, kroky zámkového cyklu poľa, vstup návštevníka. Localhost preteky
    (žiadosť ~0,1 ms po odpovedi) zmizli.
- **d** má zahriatie 60 s (všade), ostatné scenáre 30 s.
- **Redis o ~1 ms ďalej:** TCP proxy `lib/delayProxy.mjs` na jadre 1 zdrží každý zápis k Redisu o 1 ms. Časovače sú
  v celých ms, takže to dáva +1–2 ms na round trip. Použité v jednom páre c.
- **Kampaň:** čaká pred behom podľa zaneprázdnených jadier (5 s z `/proc/stat`), nie podľa load average; úlohy Docker
  Desktop VM držali load na 3–4 pri nečinných jadrách. `wait-quiet.sh` rovnako.
- **Servery:** `build-opt.sh` (`git archive` + patch):
  - `collab-next-opt.patch` nad 1b9163b: heap 400, zámok 25/25, socket.io bez kompresie, pole bez hľadania naprieč
    podmi, debug logy bez formátovania, telo bez stiahnutia predošlého, menej ciest do Redisu, „obsadené" bez druhého
    zámku;
  - `collab-stats-opt.patch` nad 66106b2: to isté + dávka 50 + `void recordMembership`.
- **Spustenie:** `bash perf/run-perf3.sh heap`, potom `bash perf/run-perf3.sh main h400`. Súhrn
  `results/perf3/summary.md`, porovnanie meraní `results/perf3/compare-measurements.md` (`lib/compareMeasurements.mjs`).

### Voľba heapu (rotácia, kód `collab-next-opt.patch`, 2 behy na variant)

| metrika (priemer) | heap 200, semi 16 | **heap 400, semi 16** | heap 400, semi 64 |
|---|---|---|---|
| CPU [% jadra] | 23,3 | **21,9** | 22,8 |
| GC [% času] / mark-compact za 3 min | 0,80 / 16 | 0,75 / 13,5 | 0,54 / 15 |
| scavenge za 3 min | 357–383 | 354–358 | 87–94 |
| slučka p99 [ms] | 1,54 | 1,56 | 1,58 |
| úprava p99 / odchod p99 / zmena poľa p99 [ms] | 4,49 / 22,3 / 11,8 | **4,24 / 19,5 / 9,09** | 4,57 / 23,2 / 12,2 |
| RSS priemer / max [MB] | 207 / 209 | 212 / 214 | 301 / 303 |

**Voľba: heap 400 MB, semi-space 16** (predvolený v pode):
- Najnižšie CPU a najkratšie chvosty, hoci rozdiely sú malé (n = 2).
- RSS 212 MB je hlboko pod requestom 400 Mi.
- Má rezervu do budúcnosti: pri 200 MB začne V8 nepretržite značkovať, keď živý old space prekročí ~200 − 2 × 16 MB.
  Teraz je to ~65 MB, ale štatistiky a väčšie dokumenty ho zväčšia.
- Semi 64 má najnižšie GC, no +90 MB RSS bez zisku na CPU a chvostoch.
- Zistenie: **heap 200 so semi-space 16 nekolabuje** (16 mark-compact za 3 min, nie 216 za 5 min). Kolaps v meraniach
  1 a 2 bol z väčšej časti artefakt semi-space 64 na WSL.

### M1: next 1b9163b (dnešná produkcia: heap 200, semi 16) proti next + `collab-next-opt.patch` (heap 400, semi 16)

| scenár | metrika | off → on (medián 2 behov) | brána |
|---|---|---|---|
| b | úprava p50 / p95 / p99 [ms], CPU [%], RSS [MB] | 1,77 / 3,15 / 4,32, 17,6, 222 → 1,62 / 3,08 / 4,18, 16,6, 202 | **prejde** |
| c | CPU [% jadra] | 31,7 → 25,2 (−20 %) | lepšie |
| c | zámok / zmena / uvoľnenie p50 [ms] | 3,77 / 2,39 / 3,58 → 2,14 / 1,77 / 3,28 (−43 / −26 / −8 %) | lepšie |
| c | zámok / zmena / uvoľnenie p99 [ms] | 11,6 / 36,2 / 12,0 → 6,85 / 9,96 / 9,53 | lepšie (zmena −72 %) |
| c | vstup / odchod p50 [ms] | 3,90 / 2,84 → 4,35 / 3,08 (+12 / +9 %) | **NIE** |
| c | vstup / odchod p95 [ms] | 6,47 / 4,82 → 7,95 / 5,81 (+23 / +21 %) | **NIE** |
| c | vstup / odchod p99 [ms] | 13,3 / 10,5 → 11,8 / 8,61 | áno |
| c | priepustnosť, vypršané, zamietnuté, chyby | 390/s, 0, 0, 0 → 390/s, 0, 0, 0 | áno |
| c | `PUBSUB NUMSUB` [/s], RSS [MB] | 435, 223 → 75, 202 | lepšie |
| c | slučka p99 [ms], GC [%] | 1,03, 0,67 → 1,12, 1,04 | NIE (+0,09 ms) / info |
| d | úprava p50 / p95 / p99 [ms], CPU 2 inštancií | 2,44 / 6,77 / 8,76, 34,8 → 2,44 / 6,80 / 8,78, 34,6 | **prejde** |
| rot | CPU [% jadra], RSS [MB] | 24,9, 235 → 22,0, 213 (−11 %, −21 MB) | lepšie |
| rot | zámok / zmena / uvoľnenie p99 [ms] | 19,6 / 25,8 / 17,8 → 9,98 / 10,5 / 13,3 (−49 / −59 / −25 %) | lepšie |
| rot | odchod p99 [ms] | 26,7 → 19,7 (−26 %) | lepšie |
| rot | úprava p99, vstup p99, slučka p99, `requestToJoin` p50 | 4,46, 23,9, 1,59, 3,73 → 4,23, 23,6, 1,55, 3,43 | áno |
| rot | mark-compact za 3 min, `PUBSUB NUMSUB` [/s] | 24,5, 104 → 13,5, 46 | lepšie |
| c, Redis +1–2 ms (1 pár) | zámok p50 / zmena p99 [ms], CPU | 28,5 / 349, 26,2 % → 11,5 / 47,3, 22,1 % | lepšie (−60 / −86 %, −15 %) |
| c, Redis +1–2 ms | vstup / odchod p50 [ms], priepustnosť | 27,8 / 18,6, 386/s → 29,7 / 20,0, 390/s | +7 % / lepšie |

Jediné „NIE" v rotácii je slučka p50 (0,10 → 0,12 ms, rozptyl 0,01), prakticky nula.

**Prečo sú vstup a odchod v c pomalšie** (p50 +0,25–0,45 ms, p95 +1–1,5 ms, opakuje sa aj pri Redise +1 ms), som
nehľadal. V M1 merania 2 (heap 400 + zámok) bolo p50 c tiež o ~10 % vyššie, kým čisté porovnanie zámku (`m1-c-heap400`) bolo
neutrálne. Kandidát je heap 400 v c (GC 0,67 → 1,04 %, mark-compact 37 → 42), teda iná dynamika GC pri vypnutej
kompresii a väčšom heape, nie zámok. Dá sa overiť dvojicou c s heapom 200 a kódom opt.

### M2: brána 4 (štatistiky off/on, 66106b2 + `collab-stats-opt.patch`, heap 400, semi 16)

| scenár | metrika | medián off | rozptyl off | medián on | Δ | brána |
|---|---|---|---|---|---|---|
| d | úprava p50 / p95 / p99 [ms] | 2,56 / 7,03 / 9,06 | 0,23 / 0,17 / 0,24 | 2,74 / 7,23 / 9,48 | +0,18 / **+0,20** / **+0,42** | áno / NIE / NIE |
| d | CPU 2 inštancií [%] | 36,4 | 1,73 | 37,8 | +1,39 | **áno** |
| d | RSS [MB], slučka p99 [ms] | 208, 1,29 | 7,9, 0,06 | 204, 1,35 | −3,8, **+0,06** | áno, NIE |
| rot | úprava p50 / p95 / p99 [ms] | 1,30 / 2,86 / 4,54 | 0,06 / 0,01 / 0,29 | 1,35 / 2,87 / 4,76 | +0,05 / **+0,01** / +0,23 | áno / NIE / áno |
| rot | vstup p50 / p95 / p99 [ms] | 4,48 / 12,3 / 20,1 | 0,57 / 0,11 / 0,14 | 4,51 / 12,7 / 21,0 | 0 / **+0,40** / **+0,90** | áno / NIE / NIE |
| rot | odchod p50 / p95 / p99 [ms] | 6,39 / 15,3 / 19,7 | 0,73 / 0,75 / 1,22 | 6,34 / 15,1 / 25,5 | 0 / −0,15 / **+5,8** | áno / áno / NIE |
| rot | CPU [%], slučka p99 [ms] | 23,1, 1,64 | 0,96, 0,11 | 23,8, 1,66 | +0,73, +0,02 | **áno**, áno |
| rot | RSS [MB] | 216 | 1,0 | 219 | **+2,7** | NIE |

Kontrola dát rotácie on (2 behy): zapísaných 94/94 = otvorených článkov, nezhody 0, pending po behu 0.

**Hodnotenie:** CPU, GC a slučka p99 sú už v rozptyle v oboch scenároch; CPU v d prvýkrát (+1,4 bodu pri dvoch
inštanciách, v meraní 2 +3,6). „NIE" ostávajú pri absolútne malých rozdieloch, ktoré pri dvoch behoch vychádzajú mimo
veľmi úzkeho rozptylu: p95/p99 úprav +0,01 až +0,42 ms, vstup p99 +0,9 ms, RSS +2,7 MB. Jediný väčší je **chvost odchodu
p99 +5,8 ms** (behy on 20,6 a 30,4). Ten sa opakuje vo všetkých troch meraniach a zmenšuje sa: +125 → +16 → +5,8 ms.
Rozhodne plné meranie 3 × 5 min.

### M2: brána 5 (Mongo 2 min, rotácia, 1 pár, okno 5 min)

- **Robustnosť: áno.**
  - Breaker sa otvoril 1× (otvorený v 181. s, zavretý v 239. s), v logu je jeden `warn` a jeden `info`.
  - **Do falošného Sentry prišiel jeden warn štatistík.**
  - Pending: na začiatku výpadku 57, na konci 90, najviac 120.
  - Po návrate Monga sa zapísalo 139 relácií 2+ a 5 sólo, raz, so súčtami zhodnými s reláciami. Pending 0, zahodených 0.
- **„Nie horšie": áno pre latenciu a CPU.**
  - Úprava p50 / p95 / p99: off 1,32 / 2,81 / 4,80 ms, on 1,42 / 2,98 / 4,96 ms.
  - CPU 22,3 / 22,2 %, slučka p99 1,79 / 1,83 ms.
  - Acky p99 sú rozdielne o +1,3–1,5 ms.
  - Chyby 998 → 1 060 (+6 %) a vypršané acky 133 → 144 sú toho istého druhu (Redlock quorum a ECONNREFUSED Monga pri
    štarte spolupráce) a v rovnakom pomere ako v meraní 2. Pri n = 1 to nie je preukázané.

### Porovnanie s meraniami 1 a 2

Úrovne nie sú porovnateľné (iný generátor, semi-space 16, 3-min okná), rozdiely on − off áno
(`results/perf3/compare-measurements.md`).

| scenár | metrika (on − off) | meranie 1 | meranie 2 | meranie 3 |
|---|---|---|---|---|
| rot | CPU štatistík [bod] | +5,81 | +0,08 | +0,73 |
| rot | odchod p99 štatistík [ms] | +125 | +16,0 | +5,78 |
| rot | vstup p99 štatistík [ms] | +13,5 | +2,79 | +0,90 |
| d | CPU štatistík [bod] | +2,94 | +3,63 | +1,39 |
| rot | `requestToJoin` p50 bez štatistík, produkcia [ms] | 197 | 197 | **3,73** |
| rot | mark-compact bez štatistík, produkcia | 216 / 5 min | 216 / 5 min | **24,5 / 3 min** |

Posledné dva riadky ukazujú, že dva javy z meraní 1 a 2 robil hlavne nástroj, nie server:
- `requestToJoin` 200 ms boli localhost preteky (žiadosť prišla pred uvoľnením zámku);
- kolaps GC pri heape 200 bol zo semi-space 64.

S oneskorením klienta a semi-space 16 je dnešná produkcia v rotácii v poriadku (`requestToJoin` 3,7 ms, GC 0,77 %).
Optimalizácie ju zlepšujú hlavne v zámkoch polí, CPU a RSS.

### Verdikt merania 3

- **`collab-next-opt.patch` (M1): odporúčam.**
  - c: CPU −20 %, zámky a zmeny polí p50 −8 až −43 %, p99 zmeny 36 → 10 ms, `PUBSUB NUMSUB` 435 → 75/s.
  - Pri Redise o 1–2 ms ďalej je zisk ešte väčší: zmena p99 349 → 47 ms, CPU −15 %.
  - Rotácia: CPU −11 %, zámky p99 −25 až −59 %. RSS všade −6 až −21 MB. b a d bez zmeny.
  - Cena: v c vstup a odchod p50 +0,3 ms a p95 +1–1,5 ms, príčina neoverená (kandidát heap 400 v c).
- **Heap 400 MB so semi-space 16** (predvolený v pode).
- **`collab-stats-opt.patch` (M2):**
  - Štatistiky už nestoja merateľné CPU, GC ani slučku (d aj rotácia v rozptyle).
  - Brána 5 drží.
  - Brána 4 v rýchlej verzii formálne neprejde na malých rozdieloch chvostov (≤ 0,9 ms) a na odchode p99 +5,8 ms.
    Rozhodne plné meranie 3 × 5 min.

### Neoverené (meranie 3)

- 2 behy a 3-min okná (rýchly odhad). Brána 4 pri dvoch behoch má veľmi úzky „rozptyl".
- Príčina pomalšieho vstupu a odchodu v c pri kóde opt.
- Proxy Redisu pridáva 1–2 ms len smerom k Redisu (časovače Node). Skutočný Azure Redis (TLS, iná latencia) sa nemeral.
- `process.constrainedMemory()` v pode sa neoveroval (zadanie), semi-space 16 je odvodený z kódu V8 (posudok).
- b brány 4 (prešla v meraní 2) a brána 5 v b sa v meraní 3 nemerali; M2 v d a rotácii len s dashboardom 1 požiadavka/s.
- Atlas, viac podov, K8s CFS.

### Upratanie (meranie 3)

Servery, generátory a proxy skončili s behmi, kontajnery `perf-collab-mongo` a `perf-collab-redis` sú zmazané. V
`petit/collaboration` som nič nezmenil. `git status` tam ukazuje zmeny implementátora (OPTIMALIZACIE), nie merania.

## Finálne meranie (zapnuté aj vypnuté env)

Zadanie: `krok5-praca/zadania/zadanie-perf-final.md`. Merané 24. 10. 2026 13:00–19:03 (6 h; kampaň 60 behov a
zopakovaný beh veľkej relácie s 50 účastníkmi). Súhrn `perf/results/final/summary.md` (+ `summary.json`), surové výsledky
`perf/results/final/<sada>/<verzia>-<n>/`, konzola `results/final-console*.log`.

### Verzie a nastavenie

| verzia | commit | heap / semi-space | poznámka |
|---|---|---|---|
| 1.14.1 | tag 1.14.1 (`collab-1.14.1`, ako v COLLAB-PERF) | 200 / 16 | dnešná produkcia, provider 3.4.4 |
| next | 1b9163b | 200 / 16 | |
| **PR** | `feature/collab-heap-lock-retry` **f05281a** | 300 / 16 | v c aj variant s heapom 200 |
| **stats off / on** | `feature/collab-stats` **0eca902** | 300 / 16 | `COLLAB_STATS_ENABLED` výslovne `false` / `true` (predvolene vypnuté) |

- **Servery:** z `git archive` commitu bez patchov (`perf/build-final.sh`). Repozitáre som nemenil.
- **Generátor a beh** ako v meraní 3: jitter ±10 %, RTT klienta 5–20 ms, semi-space 16, 1 jadro na server.
  - Okná 5 min, zahriatie 30 s (d 60 s), 3 behy, varianty striedavo v rámci opakovania.
  - Brána 5: 1 pár, Mongo zastavené 60.–180. s okna.
- **Dashboard** (`live` a `live/rooms` 1×/s) beží len v rotácii a len pri stats off a on. 1.14.1, next ani PR jeho
  endpointy nemajú.
- **Kontroly:**
  - po každom behu on kontrola dát v Mongu (`statsCheck`);
  - po každom behu bez štatistík kontrola vypnutého env (`lib/statsData.mjs`);
  - pri on veľkosť kľúčov v Redise každých 10 s a `$collStats` kolekcií po finalizácii.
- **Žiadny beh nerušil cudzí ťažký proces** (kontrola počas behu).
- **Chyba nástroja:** veľká relácia s 50 účastníkmi najprv zlyhala v nástroji (pretečenie zásobníka pri zlučovaní
  ~300 000 vzoriek, `push(...values)`). Po oprave `lib/generator.mjs` som ju zopakoval.

### Cieľ 1: všetko funguje dobre

- **Doručenie a chyby:** 60/60 behov má 100 % doručených úprav. Mimo výpadku Monga je 0 chýb v logoch serverov a 0
  chýb prípravy.
- **Dáta štatistík:** všetky behy on sú bez nezhôd.
  - Súčty `collab_daily` a `collab_daily_users` sedia s reláciami a zapísané relácie = otvorené články.
  - Výnimka je prepnutie env, kde tretia fáza zapísala aj relácie prvej fázy; to je správne, viď nižšie.
- **Brána 5 (Mongo 2 min):** robustnosť áno.
  - Rotácia:
    - breaker sa otvoril 1× (v 181. s, zavretý v 239. s) a do falošného Sentry prišiel jeden warn štatistík;
    - pending najviac 117;
    - po návrate Monga sa zapísalo 135 relácií 2+ a 6 sólo, raz a so súčtami zhodnými s reláciami.
  - b: počas výpadku neskončila žiadna relácia, breaker 0 (správne). Po behu 30/30.
  - „Nie horšie":
    - b úplne;
    - rotácia: úprava p50/p99, vstup, zámok p99, uvoľnenie p99, CPU (+0,4 bodu), slučka a RSS. Chyby 1 016 → 996
      (−2 %), rovnakého druhu (Redlock quorum a ECONNREFUSED Monga pri štarte spolupráce);
    - nad šumom (rozptyl off z `final-rot` / 4) sú v rotácii: úprava p95 +0,08 ms, odchod p50 +0,08 ms, odchod p99
      +79 ms z ~2 100 ms, `requestToJoin` p99 +8 ms, zmena poľa p99 +1,7 ms, vypršané potvrdenia 139 → 146, zamietnuté
      610 → 633. Pri n = 1 to nie je preukázané a všetko je v rádovo rovnakej výške ako bez štatistík.
- **Prepnutie env** (rotácia on 3 min → servery zastavené pri pripojených klientoch, štart off 3 min → zastavené, štart
  on 3 min + finalizácia):

  | fáza | otvorených článkov | zapísaných relácií 2+ | skončili vo svojej fáze | incomplete |
  |---|---|---|---|---|
  | 1 (on) | 91 | 90 (+1 sólo) | 90, `empty` | 0 |
  | 2 (off) | 90 | 0 | – | – |
  | 3 (on) | 91 | 91 | 91, `empty` | 0 |

  - Relácie otvorené pri vypnutí skončili pri zastavení servera, prečkali vypnuté obdobie v `pending` a zapísali sa raz
    až po opätovnom zapnutí, so správnym koncom. Nič sa nestratilo ani nezapísalo zle.
  - Vypnutá fáza nezbierala nič. Chyby v logoch 0.
  - Bez TTL ostali len štrukturálne kľúče BullMQ (`collab` a `collab-stats`: meta, id, events, repeat, delayed) a stream
    socket.io adaptéra (`collab:collab-<verzia>`). Žiadny kľúč relácie.

### Cieľ 2: štatistiky nespomaľujú (brána 4, on proti off, medián 3 behov)

| scenár | výsledok | čo neprejde (Δ mediánov, rozptyl off) |
|---|---|---|
| **rot** (s dashboardom) | **prejde** | – (CPU +0,4 bodu, RSS +3 MB, úprava p99 +0,17 ms, odchod p99 −0,5 ms) |
| b | neprejde tesne | úprava p95 +0,13 ms (0,09), p99 +0,16 ms (0,12); slučka p99 +0,08 ms (0,07) |
| d | neprejde tesne | RSS +1,6 MB (1,6); slučka p50 +0,01 ms, p99 +0,02 ms (0,01–0,02) |

- **Absolútne rozdiely:** všetko, čo neprejde, je 0,01–0,16 ms, teda **~1–3 % RTT prehliadača (5–20 ms)**, a 1,6 MB.
  Rozptyl off je pri týchto metrikách 0,01–0,12 ms, preto ich kritérium chytí.
- **CPU** je vo všetkých troch v rozptyle: b +0,9 bodu, d +0,1, rot +0,4.
- **GC** je rovnaké. Mark-compact b +2, d +3, rot −1 za okno.
- **Príkazy Redisu:** b +238/s, d +256/s, rot +804/s. Sú to väčšinou príkazy vnútri Lua, server ich nečaká.

### Cieľ 3: dáta nie sú priveľké

- **Redis:**
  - ~1,9–2,5 KB na otvorenú reláciu: bežná 2,4 KB, veľká s 20 účastníkmi 24 KB, s 50 účastníkmi 59 KB;
  - vrchol rotácie ~155 KB pri ~65 otvorených reláciách;
  - po finalizácii 0 kľúčov (pri výpadku 1, `disabledAt`/breaker).
  - Za 30 dní sa nehromadí: finalizér zapísané maže, nezapísané po 24 h zahodí, TTL 7 dní.
  - Pri 500 súbežných reláciách ~1,2 MB, hranica 50 MB je ďaleko.
- **Mongo** (rotácia, 145 relácií za beh):
  - priemerný dokument relácie 1,49 KB, najväčší bežný 1,54 KB;
  - veľká relácia: 20 účastníkov 46 KB, 50 účastníkov **109 KB BSON** (strop 256 KB drží);
  - marker 0,54 KB s indexom;
  - `collab_daily` 41 KB, `collab_daily_users` 55 KB za deň s indexami.
  - Indexy pri ~150 dokumentoch sú 1,8 KB na reláciu, pri malých kolekciách nadhodnotené (stránky WiredTiger). Prepočet
    je preto horná hranica.

| relácií denne × 30 dní | z nich 2+ (dokument) | Mongo spolu (horná hranica) | > 100 MB? | Redis pri 500 súbežných |
|---|---|---|---|---|
| 500 | 10 % / 100 % | 9,8 MB / 53 MB | nie / nie | 1,2 MB |
| 5 000 | 10 % | 72 MB | nie | 1,2 MB |
| 5 000 | 100 % | **508 MB** | **ÁNO** | 1,2 MB |

`COLLAB-STATS.md` §10.5.3 počíta s 1–10 % relácií 2+, teda pri 5 000 reláciách denne ≤ 72 MB. Nad 100 MB by to bolo
len vtedy, ak by väčšina z 5 000 denných relácií mala 2+ ľudí. Odhad tam (0,3–27 MB, relácia ~1,5–1,8 KB) sedí pri
dokumentoch, indexy sú v ňom podhodnotené.

- **Veľká relácia** (1 článok, každý editor píše telo a cyklí 60 vlastných polí, moderátor posiela základ s 250 poľami):
  - 294 000 z 294 000 úprav doručených;
  - strop účastníka drží: 50 polí + `other` u všetkých;
  - strop základu 200 polí drží: jeden `warn` „Dropped the values…, over the cap";
  - finalizácia ~60 s po konci (grace 61 s + takt 30 s); operácie na kolekciách štatistík spolu < 50 ms, najdlhšia
    14 ms.
- **Odpoveď dashboardu:** `live` 0,11 KB, `live/rooms` ~16,5 KB (30 miestností), najviac 18,5 KB.

### Cieľ 4: env zapína a vypína zber, vypnuté nič nezbiera ani nestojí

- **Kontrola vypnutého env** po všetkých 38 behoch bez štatistík (next, PR, PR heap 200, stats off) nenašla nič:
  - 0 kľúčov štatistík okrem `stats:disabledAt` pri stats off. Ten vypnutý server zapisuje zámerne (TTL 7 dní),
    aby sa relácia sprede vypnutia uzavrela pri jej poslednej udalosti;
  - 0 kľúčov fronty `collab-stats`, 0 z 5 skriptov štatistík spustených (`SCRIPT EXISTS` po `SCRIPT FLUSH`);
  - žiadny klient `collab-stats`, žiadne kolekcie štatistík, 0 riadkov štatistík v logu;
  - EVALSHA/s rovnaké ako PR: b 2,23, d 4,47, rot ~190, mongo 1,93.
- **Stats off proti PR** (brána 4):
  - b: všetko v rozptyle okrem RSS +2,4 MB (rozptyl 1,2);
  - d: úprava p99 +0,15 ms (rozptyl 0,06);
  - príkazy Redisu b aj d rovnaké (383 a 1 116/s).
  - rotácia (off s dashboardom, PR bez neho): odchod p99 +2,1 ms, RSS +5 MB, zámok/zmena p99 +0,5/+1,0 ms. CPU rovnaké.
    To je cena polling dashboardu (časť A), nie zberu.
  - **Vypnuté nestojí merateľne nič.**

### PR proti next a 1.14.1

| scenár | PR proti next (heap 200) | PR proti 1.14.1 |
|---|---|---|
| b | rovnaké (CPU +1,4 v rozptyle), RSS −19 MB; neprejde len slučka p50 0,17 → 0,18 ms | – |
| c | CPU **−16 %**, RSS −26 MB, `PUBSUB NUMSUB` 435 → 75/s, zámok/zmena/uvoľnenie p99 −41/−69/−15 %, priepustnosť 390/s, 0 chýb; **vstup/odchod p50 +0,5/+0,4 ms, p95 +1,5/+1,2 ms**, slučka p50/p99 +0,02/+0,03 ms | lepšie vo všetkom: CPU −16 %, vstup/odchod p95 −19/−27 %, p99 −50 %, zmena p99 38,7 → 10,4 ms |
| d | rovnaké (prejde) | – |
| rot | CPU −7 %, RSS −28 MB, zámky p99 −21 až −58 %, mark-compact −15 %; úprava p50/p95 +0,12 ms, odchod p50 +0,24 ms, slučka p50/p99 +0,02/+0,07 ms | vstup −9 %, zámky p50/p99 −23 až −57 %, RSS −12 MB, mark-compact −36 %; **úprava p50/p95/p99 +0,24/+0,44/+0,41 ms, odchod p50/p95 +0,6/+2,0 ms** |

- **Príčina pomalšieho vstupu a odchodu v c (z merania 3):** heap to nie je, PR s heapom 200 má rovnaké hodnoty (vstup
  p50 4,33 proti 4,44 ms, CPU 26,4 proti 26,5 %). Je to kód PR alebo `next` 2.0. Kandidát (nemerané): socket.io bez
  kompresie posiela rámce synchrónne, kým s kompresiou ich posielal až zlib vo vláknach. Celkové CPU je však o 16 %
  nižšie.
- **Úprava o 0,2–0,4 ms pomalšia proti 1.14.1 v rotácii** je Hocuspocus 4 (COLLAB-PERF §2.3, awareness), nie PR. next
  ju má rovnako (1,38 ms), PR k nej pridáva 0,12 ms.
- Všetky tieto rozdiely sú pod 2 ms, teda pod 10 % RTT prehliadača.

### Verdikt po cieľoch

1. **Funguje dobre: áno.** 100 % doručených úprav, 0 chýb mimo výpadku, dáta štatistík správne a zapísané raz (aj po
   výpadku a cez prepnutie env), breaker a jeden warn pri výpadku.
2. **Štatistiky nespomaľujú: áno.**
   - Rotácia prechádza bránou 4 celá.
   - b a d formálne neprejdú na rozdieloch 0,01–0,16 ms a 1,6 MB, teda ~1–3 % RTT prehliadača.
   - CPU, GC aj slučka p50 sú v rozptyle vo všetkých scenároch.
3. **Dáta nie sú priveľké: áno pri predpokladoch návrhu.**
   - Redis ≤ ~1 MB pri stovkách súbežných relácií, najväčšia relácia 109 KB.
   - Mongo pri 5 000 reláciách denne a 10 % reláciách 2+ ≤ 72 MB za 30 dní (horná hranica).
   - **Nad 100 MB len vtedy, ak by väčšina z 5 000 denných relácií mala 2+ ľudí (~0,5 GB).** Treba to sledovať
     v produkcii, prípadne skrátiť TTL `collab_sessions`.
4. **Env: áno.** Vypnuté nezbiera nič a nestojí nič merateľné. Zapnutie a vypnutie cez nasadenie nič nestratí ani
   nepokazí.

**PR odporúčam do `next`:** proti `next` je rovnaký alebo lepší v b, d a rotácii a v c je o 16 % lacnejší na CPU,
s rýchlejšími zámkami a poľami. Ceny sú malé a pod RTT: vstup/odchod v c +0,4–1,5 ms, úprava v rotácii +0,12 ms. Proti
1.14.1 je v c lepší vo všetkom, v rotácii lepší v zámkoch, vstupoch, CPU a RSS, o 0,2–0,6 ms pomalší v úprave a odchode
(Hocuspocus 4).

**Štatistiky (`feature/collab-stats` 0eca902) odporúčam** s predvolene vypnutým env.

### Neoverené (finálne meranie)

- **Produkčné prostredie:** Atlas a Azure Redis (latencia, TLS, `w=majority`), 2 repliky s CFS limitom 1100m namiesto
  `taskset`, devel/stage s limitom 300 Mi (heap 300 + semi 16 ≈ 348 MB limit V8, RSS ~200–230 MB; pri 300 Mi
  = 315 MB je to tesné, **neoverené**).
- **Prepočet na 30 dní** je z malých kolekcií (indexy nadhodnotené). Skutočný podiel relácií 2+ v produkcii nepoznáme.
- **Príčina pomalšieho vstupu a odchodu v c** v kóde PR/next je len kandidát (socket.io bez kompresie), pokusom
  neoverená.
- **Brána 5 a prepnutie env** majú n = 1. Prepnutie je len pri zastavení s pripojenými klientmi (nie pri páde podu).
- **Mimo merania:** dlhšie behy ako 5 min a únik pamäte, viac ako 50 účastníkov.
- **Dashboard** sa pri b a d nemeral (zadanie ho uvádza len pri rotácii).

### Upratanie

Servery, generátory a proxy skončili s behmi a kontajnery `perf-collab-mongo` a `perf-collab-redis` sú zmazané.
Repozitáre som nemenil. Staré kópie PR a štatistík (`collab-pr-b16bb39`, `collab-stats-final-ddc01b6`) sú odložené
v `perf/`. Meranie znova: `bash perf/run-final.sh full`.

## Brány C (história štatistík: dáta 10×, plány dotazov, súbežné požiadavky, end-to-end)

Zadanie: `krok5-praca/zadania/zadanie-stats-c-perf.md`. Podklad: COLLAB-STATS §10.5, §10.6, §10.13 brány C (1)–(3),
kontrakty STATS-C §1 a STATS-CMS §1. Fáza A (collaboration a Mongo) merané 24. 10. 2026 22:22–22:46. Každý ťažký krok
išiel cez `flock -w 540 krok5-praca/tazky.lock` a pred ním `free -m` (dostupných vždy ≥ 11 GB).

### Verzie a prostredie (fáza A)

- **collaboration** `feature/collab-stats` **39f546c** (merge `next` do štatistík), kópia z `git archive`
  (`perf/collab-statsc-39f546c`, bez patchov). Štart ako prod skript: heap 300, semi-space 16, 1 jadro, štatistiky
  zapnuté (`COLLAB_STATS_ENABLED=true`).
- **MongoDB 8.0.20**, single-node replica set `rs0`. Verziu Atlasu som v repozitároch ani dokumentoch nenašiel
  (COLLAB-STATS §10.6.2: „tier a verziu pozrie DevOps"), preto 8.0 podľa zadania.
  - Ako najmenší dedikovaný tier Atlasu (M10, odvodené): 2 jadrá, WiredTiger cache 0,5 GB, kontajner 1,5 GB.
  - TTL monitor vypnutý, aby nasiate dni nezmizli. Indexy aj kolekcie vytvoril server sám
    (`prepareCollabStatsCollections` pri prvej požiadavke).
- **Redis** 7.2.4. Lokálne, teda bez sieťovej latencie Atlasu a bez skutočného sekundáru (`secondaryPreferred` ide
  na primár).
- **Nástroj** `perf/run-statsc.sh` (kroky `up`, `prepare`, `seed`, `sums`, `plans`, `load`, `load-paced`, `cap`,
  `people`) a `perf/lib/statsc*.mjs`. Výsledky v `perf/results/statsc/`.

### C1: dáta 10× (`lib/statscSeed.mjs`, `seed.json`)

Dáta zapísané tak, ako by ich zapísal finalizér: rovnaké súčty do dní (`collabDailyIncrements`) a ľudí s rovnakými
stropmi (`collabDailyUsersIncrements`, `cappedPeopleIncrements`). Naplnenie trvalo 21 s.

| čo | hodnota |
|---|---|
| relácie | **150 000** 2+ za 30 dní (25. 9. – 24. 10., dnes do 21:00), pracovný deň ~6 000, víkend ~2 700 |
| koše `2` / `3` / `4` / `5plus` | 112 541 / 26 972 / 7 478 / 3 009 = **75,0 / 18,0 / 5,0 / 2,0 %** |
| kategórie | preklik 34,7 %, len prítomnosť 29,7 %, oddelené úpravy 12,1 %, skutočná spolupráca 23,5 %; všetkých 16 kombinácií koša a kategórie |
| na strope | **1 494 relácií (1,0 %)**: 50 účastníkov (`participantsCount` 50–89, zvyšok `participantsOverflow`), každý 50 polí (`comment:<uuid>`, najdlhšie názvy) a `other`, 200 dvojíc. BSON najviac **188 KB** (strop 256 KB) |
| bežná relácia | BSON priemer 1,39 KB, najviac 5,7 KB |
| `docId` | 6 000 článkov v 1–3 verziách. Všetky majú 10+ relácií, najčastejší 4 034. Bez `docId` 3 079 relácií (2,1 %) |
| ľudia | 5 000 používateľov, najčastejší (id 100) v 25 467 reláciách, za 7 dní v 5 981 |
| `collab_daily` | 30 dokumentov po 2,1–2,3 KB |
| `collab_daily_users` | 30 dokumentov, **všetky na strope**: 1 000 ľudí + `other`, 2 000 dvojíc + `other`; 213–217 KB na deň |
| markery | 10 000 (7 000 relácií 2+ z posledných 8 dní, 2 980 sólo, 20 `dropped:`) |
| veľkosť `collab_sessions` | dáta 463 MB, na disku 212 MB; indexy 77 MB (`stats_user_time` 29 MB, ostatné 4–10 MB) |

**Kontrolné súčty** (`lib/statscSums.mjs`, `sums.json`):
- tri agregácie `collab_sessions` po dňoch v Europe/Bratislava, všetky s `allowDiskUse: false`:
  - koš × kategória: 0,9 s;
  - hodina: 0,2 s;
  - ľudia a dvojice skutočných spoluprác: 7,8 s (`$filter` účastníkov v dvojiciach pri reláciách na strope).
- Porovnané s dennými dokumentmi: `multi.*`, `multi.byPeakUsers.<kôš>.*`, `byHour.<h>.multi/realCollab`, `stale`,
  `incomplete`, súčty `byUser.*` vrátane `other` a počet dvojíc v `byPair`.
- **3 350 súčtov za 30 dní, 0 nezhôd.** `jointActiveMinutes` dvojíc v reláciách uložené nie sú, ostali nekontrolované.

### C2: plány a časy každého dotazu (`lib/statscPlans.mjs`, `plans/plans.json`)

**Postup:**
- Každý prípad je jedna požiadavka na skutočný endpoint `sys` collaboration.
- Dotazy, ktoré endpoint spustil, zachytil profiler Monga (level 2 len na kolekciách štatistík).
- Plán je z `explain('executionStats')` toho istého príkazu: filter, triedenie, projekcia, `hint`, `limit`,
  `maxTimeMS` z profilera.
- Tie isté dotazy potom išli **100× priamo** ovládačom, bez cache servera. Časy pokrývajú celú stranu (kroky kurzora po
  sebe), parsovanie dokumentov a pri `people` aj súčet ako v `computePeople`.
- Hlboké kurzory sú zostavené z relácie na danej pozícii zoznamu, inak sú v tvare servera:
  - polovica filtrovaného zoznamu;
  - 10 000. relácia všetkých;
  - pri spoločných minútach aj v skupine `k = 0` (90 000. relácia);
  - začiatok zdieľaný 3+ reláciami (krok 1 kurzora).
- Filtre:
  - `všetky`: `$in` všetkých 4 × 4 hodnôt;
  - `2/realCollab`: jedna hodnota koša aj kategórie;
  - `3+/no realCollab`: 3 × 3 hodnoty.

| dotaz | dotazov | plán (pod `LIMIT > PROJECTION_SIMPLE > FETCH`) | index | kľúče / dokumenty / vrátené | bajty Mongo / JSON | p95 priamo [ms] | limit | výsledok |
|---|---|---|---|---|---|---|---|---|
| súhrn 7 d | 1 | IXSCAN | `_id_` | 7 / 7 / 7 | 15,3 KB / 3,2 KB | 2,6 | 20 | áno |
| ľudia 7 d | 1 | IXSCAN | `_id_` | 7 / 7 / 7 | 1,44 MB / 9,1 KB | 37 | 20 | **NIE** (p95) |
| súhrn 30 d | 1 | IXSCAN | `_id_` | 30 / 30 / 30 | 65,6 KB / 4,7 KB | 1,9 | 20 | áno |
| ľudia 30 d | 1 | IXSCAN | `_id_` | 30 / 30 / 30 | 6,16 MB / 9,4 KB | 139,8 | 20 | **NIE** (p95) |
| zoznam startedAt, všetky, 7 d, strana 1 | 1 | SORT_MERGE > 16× IXSCAN | `stats_list_time` | 66 / 51 / 51 | 15,6 KB / 17,1 KB | 2,7 | 50 | áno |
| zoznam startedAt, všetky, 30 d, strana 1 | 1 | SORT_MERGE > 16× IXSCAN | `stats_list_time` | 66 / 51 / 51 | 15,6 KB / 17,1 KB | 1,4 | 50 | áno |
| zoznam startedAt, všetky, 30 d, za 10000. z 150000 | 2 | SORT_MERGE > 16× IXSCAN | `stats_list_time` | 66 / 51 / 51 | 15,8 KB / 17 KB | 4 | 50 | áno |
| zoznam startedAt, 2/realCollab, 7 d, strana 1 | 1 | IXSCAN | `stats_list_time` | 51 / 51 / 51 | 15,5 KB / 17 KB | 3 | 50 | áno |
| zoznam startedAt, 2/realCollab, 30 d, strana 1 | 1 | IXSCAN | `stats_list_time` | 51 / 51 / 51 | 15,5 KB / 17 KB | 2,9 | 50 | áno |
| zoznam startedAt, 2/realCollab, 30 d, za 12919. z 25839 | 2 | IXSCAN | `stats_list_time` | 51 / 51 / 51 | 15,8 KB / 17,1 KB | 2,2 | 50 | áno |
| zoznam startedAt, 3+/no realCollab, 7 d, strana 1 | 1 | SORT_MERGE > 9× IXSCAN | `stats_list_time` | 59 / 51 / 51 | 15,7 KB / 17 KB | 3,1 | 50 | áno |
| zoznam startedAt, 3+/no realCollab, 30 d, strana 1 | 1 | SORT_MERGE > 9× IXSCAN | `stats_list_time` | 59 / 51 / 51 | 15,7 KB / 17 KB | 2,1 | 50 | áno |
| zoznam durationMs, všetky, 7 d, strana 1 | 1 | SORT_MERGE > 16× IXSCAN | `stats_list_duration` | 299 / 51 / 51 | 15,6 KB / 17,1 KB | 3,4 | 50 | áno |
| zoznam durationMs, všetky, 30 d, strana 1 | 1 | SORT_MERGE > 16× IXSCAN | `stats_list_duration` | 66 / 51 / 51 | 15,6 KB / 17,1 KB | 2 | 50 | áno |
| zoznam durationMs, všetky, 30 d, za 10000. z 150000 (k = 2933015) | 3 | SORT_MERGE > 16× IXSCAN | `stats_list_duration` | 66 / 51 / 51 | 16,1 KB / 17,1 KB | 3 | 50 | áno |
| zoznam durationMs, 2/realCollab, 7 d, strana 1 | 1 | IXSCAN | `stats_list_duration` | 188 / 51 / 51 | 15,5 KB / 17,1 KB | 3,5 | 50 | áno |
| zoznam durationMs, 2/realCollab, 30 d, strana 1 | 1 | IXSCAN | `stats_list_duration` | 51 / 51 / 51 | 15,6 KB / 17,1 KB | 2,6 | 50 | áno |
| zoznam durationMs, 2/realCollab, 30 d, za 12919. z 25839 (k = 570994) | 3 | IXSCAN | `stats_list_duration` | 51 / 51 / 51 | 16 KB / 17 KB | 2,8 | 50 | áno |
| zoznam durationMs, 3+/no realCollab, 7 d, strana 1 | 1 | SORT_MERGE > 9× IXSCAN | `stats_list_duration` | 271 / 51 / 51 | 15,6 KB / 17 KB | 3,1 | 50 | áno |
| zoznam durationMs, 3+/no realCollab, 30 d, strana 1 | 1 | SORT_MERGE > 9× IXSCAN | `stats_list_duration` | 59 / 51 / 51 | 15,6 KB / 17,1 KB | 2,9 | 50 | áno |
| zoznam jointActiveMinutes, všetky, 7 d, strana 1 | 1 | SORT_MERGE > 16× IXSCAN | `stats_list_joint` | 169 / 51 / 51 | 15,6 KB / 17,1 KB | 1,5 | 50 | áno |
| zoznam jointActiveMinutes, všetky, 30 d, strana 1 | 1 | SORT_MERGE > 16× IXSCAN | `stats_list_joint` | 66 / 51 / 51 | 15,5 KB / 17,2 KB | 1,5 | 50 | áno |
| zoznam jointActiveMinutes, všetky, 30 d, za 10000. z 150000 (k = 10) | 2 | SORT_MERGE > 16× IXSCAN | `stats_list_joint` | 54 / 51 / 51 | 15,8 KB / 17,1 KB | 3 | 50 | áno |
| zoznam jointActiveMinutes, všetky, 30 d, za 90000. z 150000 (k = 0) | 2 | SORT_MERGE > 16× IXSCAN | `stats_list_joint` | 62 / 51 / 51 | 15,9 KB / 17,1 KB | 5,3 | 50 | áno |
| zoznam jointActiveMinutes, 2/realCollab, 7 d, strana 1 | 1 | IXSCAN | `stats_list_joint` | 120 / 51 / 51 | 15,6 KB / 17,1 KB | 3 | 50 | áno |
| zoznam jointActiveMinutes, 2/realCollab, 30 d, strana 1 | 1 | IXSCAN | `stats_list_joint` | 51 / 51 / 51 | 15,5 KB / 17,1 KB | 2,6 | 50 | áno |
| zoznam jointActiveMinutes, 2/realCollab, 30 d, za 12919. z 25839 (k = 6) | 2 | IXSCAN | `stats_list_joint` | 51 / 51 / 51 | 15,8 KB / 17 KB | 4,5 | 50 | áno |
| zoznam jointActiveMinutes, 3+/no realCollab, 7 d, strana 1 | 1 | SORT_MERGE > 9× IXSCAN | `stats_list_joint` | 59 / 51 / 51 | 15,7 KB / 17,1 KB | 1,5 | 50 | áno |
| zoznam jointActiveMinutes, 3+/no realCollab, 30 d, strana 1 | 1 | SORT_MERGE > 9× IXSCAN | `stats_list_joint` | 59 / 51 / 51 | 15,7 KB / 17,1 KB | 1,4 | 50 | áno |
| zoznam startedAt, všetky, 30 d, kurzor v začiatku 3+ relácií | 2 | SORT_MERGE > 16× IXSCAN | `stats_list_time` | 66 / 51 / 51 | 15,8 KB / 17,1 KB | 2,8 | 50 | áno |
| človek 100 (najčastejší), 7 d, strana 1 z 5981 | 1 | IXSCAN | `stats_user_time` | 51 / 51 / 51 | 15,6 KB / 17 KB | 2,2 | 50 | áno |
| človek 100 (najčastejší), 30 d, strana 1 z 25467 | 1 | IXSCAN | `stats_user_time` | 51 / 51 / 51 | 15,6 KB / 17 KB | 1,8 | 50 | áno |
| človek 100 (najčastejší), 30 d, za 12733. z 25467 | 2 | IXSCAN | `stats_user_time` | 51 / 51 / 51 | 15,8 KB / 17 KB | 2,3 | 50 | áno |
| človek 688 (bežný), 30 d, strana 1 z 115 | 1 | IXSCAN | `stats_user_time` | 51 / 51 / 51 | 15,6 KB / 17,1 KB | 2,4 | 50 | áno |
| článok (najčastejší), 30 d, strana 1 z 4034 | 1 | IXSCAN | `stats_doc_time` | 51 / 51 / 51 | 15,7 KB / 17 KB | 2,5 | 50 | áno |
| článok (najčastejší), 7 d, strana 1 | 1 | IXSCAN | `stats_doc_time` | 51 / 51 / 51 | 15,7 KB / 17 KB | 1,7 | 50 | áno |
| článok (najčastejší), 30 d, za 2017. z 4034 | 2 | IXSCAN | `stats_doc_time` | 51 / 51 / 51 | 15,9 KB / 17 KB | 2,1 | 50 | áno |
| článok (bežný), 30 d, strana 1 z 30 | 1 | IXSCAN | `stats_doc_time` | 30 / 30 / 30 | 9,3 KB / 10,2 KB | 1,6 | 50 | áno |
| detail bežnej | 1 | IXSCAN | `_id_` | 1 / 1 / 1 | 1,5 KB / 1,4 KB | 1,1 | 20 | áno |
| detail najväčšej (50 × 50) | 1 | IXSCAN | `_id_` | 1 / 1 / 1 | 179,1 KB / 161,2 KB | 3,8 | 20 | áno |
| detail neexistujúcej (404) | 1 | IXSCAN | `_id_` | 0 / 0 / 0 | 0,2 KB / 0 KB | 1,8 | 20 | áno |

- **Plán: všetkých 41 prípadov áno.**
  - Pri zozname so viacerými hodnotami koša a kategórie je to `SORT_MERGE` nad 16 (resp. 9) `IXSCAN` menovaného
    indexu, s jednou hodnotou jeden `IXSCAN`.
  - Človek, článok, detail a dni majú jeden `IXSCAN` (`stats_user_time`, `stats_doc_time`, `_id_`).
  - Nikde nie je `COLLSCAN` ani blokujúci `SORT`, všetko ide klasickým enginom.
  - `docsExamined` = `nReturned` vo všetkých prípadoch, aj na hlbokých stranách a v každom kroku kurzora.
  - Kľúčov navyše je najviac 299 na 51 dokumentov (trvanie za 7 dní: rozsah `startedAt` je až piaty kľúč indexu, filtruje
    sa v indexe, nie v dokumentoch).
- **Bajty strany:**
  - zoznam: Mongo 15,6–16,1 KB, JSON 17,0–17,2 KB (50 relácií);
  - detail bežnej 1,5 / 1,4 KB, najväčšej (50 × 50) 179 / 161 KB;
  - súhrn: Mongo 15 KB za 7 dní, 66 KB za 30 dní;
  - ľudia na strope: Mongo **1,44 MB** za 7 dní, **6,16 MB** za 30 dní, do JSON z toho ide 9 KB.
- **p95 priamo**:
  - strany zoznamu 1,4–5,3 ms (limit 50), človek a článok 1,6–2,5 ms (limit 50);
  - detail 1,1 ms, najväčší 3,8 ms (limit 20); súhrn 1,9–2,6 ms (limit 20);
  - **ľudia 37 ms (7 dní) a 140 ms (30 dní) neprejdú limitom 20 ms.**
  - Prvá požiadavka cez endpoint (bez cache, server na 1 jadre): zoznamy 9–12 ms, ľudia 93 ms a **277 ms**. Z cache
    ≤ 10 ms.
- **Prečo ľudia** (`lib/statscPeople.mjs`, `people.json`, 30 dní na strope):
  - prenos 6,46 MB trvá 30 ms;
  - parsovanie BSON +44 ms;
  - súčet 4 974 ľudí a 58 579 dvojíc v Node +50 ms;
  - spolu p95 134 ms.
  - Mongo samo potrebuje 1–3 ms (`executionTimeMillis`, `millis` profilera). Vinou nie je plán, ale veľkosť denného
    dokumentu na strope (215 KB × 30).
  - Server počíta ľudí raz za 60 s na kľúč (7 a 30 dní) a pritom blokuje slučku udalostí: maximum oneskorenia slučky pri
    záťaži bolo **209–213 ms** proti 16–22 ms bez nej.
  - Pri dnešných dátach (1×, desiatky ľudí za deň) majú denné dokumenty jednotky KB (odvodené).

### C3: 20 súbežných požiadaviek priamo na collaboration (`lib/statscLoad.mjs`, `load/`, `load-paced/`, `cap/`)

32 kľúčov všetkých endpointov:
- `live`, `live/rooms` (`twoPlus`, `one`);
- súhrn a ľudia za 7 a 30 dní;
- prvé strany 3 triedení bez filtra a s `2/realCollab` za 7 a 30 dní;
- človek a článok;
- strany 2–4 dvoch triedení cez `nextCursor`;
- 5 detailov vrátane najväčšieho.

Každý klient po 429 čaká `Retry-After`. Okná 120 s, profiler na kolekciách štatistík, CPU Monga z cgroup kontajnera.

| okno | požiadavky | 200 / 429 | CPU collaboration (1 jadro) | slučka p99 / max [ms] | dotazy Monga (`find`) | CPU Monga (2 jadrá) | bajty z Monga |
|---|---|---|---|---|---|---|---|
| nečinný pred | – | – | 0,97 % | 0,79 / 22 | 0 | 1,41 % | 0,16 MB |
| **20 klientov, každý raz za 1 s** (dashboardy) | 2 400 (20/s) | 2 383 / 17 | **3,8 %** | **1,5** / 213 | 144 | **1,57 %** | 18,3 MB |
| 20 klientov bez prestávky | 482 965 (4 025/s) | 482 853 / 112 | 99 % (jadro plné) | 19,6 / 209 | 144 | 0,94 % | 19,1 MB |
| nečinný po | – | – | 0,90 % | 0,80 / 16 | 0 | 1,41 % | 0,16 MB |

- **Single-flight a cache:** v oboch záťažových oknách bolo **144 dotazov servera na 38 tvarov dotazu**: 34 zoznam a
  detail, 2 súhrn, 2 ľudia. Jeden ďalší dotaz bol dotaz nástroja na profiler.
  - Tvar je kolekcia, hint, triedenie a filter bez „teraz", čiže jeden kľúč alebo jeden krok kurzora.
  - Najviac 4 dotazy na tvar (zoznam, TTL 30 s) a 2 (dni, TTL 60 s). Odstup ≥ 30,0 s, resp. ≥ 60 s.
  - Žiadne dva dotazy jedného tvaru v rámci TTL: 1 dotaz na kľúč a TTL, aj pri 4 025 požiadavkách za sekundu.
- **Semafor 429** (4 naraz na pod): 17 odpovedí pri dashboardovom tempe (keď sa naraz počíta viac kľúčov), 112 pri
  plnej záťaži. Odpovede z cache sú rýchle, preto semafor pustí väčšinu.
- **Limit súhrnov** (`cap/`): čerstvý server, breaker finalizéra otvorený, takže každý výpočet zlyhá a cache nie je.
  - Súhrn 7 a 30 dní striedavo: **6× 503, potom 429 s `Retry-After: 60`**.
  - Ľudia medzitým 503, lebo limit sa na nich nevzťahuje.
  - Pri prvom pokuse to nevyšlo: ihneď po štarte klient Redisu štatistík ešte nebol pripojený, zlyhané čítanie breakera
    „nerozhoduje nič" a súhrn sa vypočítal (správanie podľa kódu). Test preto čaká 3 s po štarte.
- **Mongo v šume: áno.**
  - CPU je 0,9–1,6 % proti 1,4 % nečinného. Opcounters: `query` 145–146 za 2 min (144 servera) proti 1, `command`
    87–89 proti 85.
  - Bez cache by to bolo 2 400 resp. 482 965 dotazov.
- **collaboration:**
  - Pri tempe dashboardov je CPU 3,8 % a slučka p99 1,5 ms.
  - Plná záťaž bez prestávky (4 025 požiadaviek/s, takmer všetko z cache) zaplní jedno jadro HTTP odpoveďami: slučka
    p99 20 ms, GC 9,2 s za okno. Semafor obmedzuje súbežné požiadavky, nie ich tempo.
  - Pred collaboration je core-cms s prihlásením a mapami (fáza B).
  - Maximum slučky ~210 ms v oboch záťažových oknách je výpočet ľudí za 30 dní (C2).

### Verdikt fázy A

- **C1 dáta 10×: prejde.** Je tam 150 000 relácií v predpísaných košoch, 1 % na strope, 30 dní ľudí na strope a
  10 000 markerov. Kontrolné súčty bez `allowDiskUse` majú 0 nezhôd.
- **C2 plány: prejde** vo všetkých 41 prípadoch: menovaný index, bez `COLLSCAN` a blokujúceho `SORT`,
  `docsExamined` = `nReturned`.
- **C2 časy: prejde** pre strany zoznamu, človeka, článok, detail a súhrn (p95 ≤ 5,3 ms).
- **C2 ľudia: NEPREJDE** pri dátach na strope ľudí: p95 37 ms za 7 dní a 140 ms za 30 dní proti 20 ms. Na vine je
  veľkosť denných dokumentov (6,2 MB za 30 dní), nie plán.
  - Server pritom raz za 60 s na kľúč blokuje slučku ~200–280 ms (odvodené z maxima slučky a z prvej požiadavky
    277 ms).
  - Možnosti pre vlastníka (nemerané):
    - prijať, lebo strop dosiahne len deň s 1 000 spolupracujúcimi ľuďmi;
    - znížiť strop `byPair` (2 000 → napr. 300) a `byUser` (1 000 → napr. 300), čo zmenší dokument zhruba úmerne;
    - počítať rebríček ľudí za 7 a 30 dní vo finalizéri do jedného dokumentu.
- **C3 na collaboration: prejde.**
  - Single-flight a cache dávajú 1 dotaz na kľúč a TTL. Semafor vracia 429, súhrn má limit 6 výpočtov a potom 429
    s `Retry-After`.
  - CPU Monga a opcounters sú v šume.
  - collaboration pri 20 dashboardoch 3,8 % CPU a slučka p99 1,5 ms.
  - Výnimkou je maximum slučky pri výpočte ľudí (C2).

### Neoverené (fáza A)

- **Prostredie:**
  - Atlas: tier, verzia, latencia siete a skutočný sekundár pre `secondaryPreferred`. Lokálne meranie neráta
    s prenosom 6,5 MB ľudí cez sieť.
  - 2 pody: cache, single-flight a semafor sú na pod, takže dotazov je až 2×.
- **Dáta:**
  - Rozdelenie je vymyslené: 75 % relácií na náhodných článkoch, 25 % Zipf; ľudia Zipf.
  - Sólo časť dní je vymyslená, nečíta ju žiadny index.
  - TTL bol vypnutý. Po polnoci sa 30-dňové obdobie posunie o deň.
- **Záťaž:** pomalý klient a chyby siete. 20 klientov išlo priamo na collaboration, cez core-cms je to fáza B.

### Fáza B: end-to-end cez core-cms (`lib/statscE2e.mjs`, `e2e/`, `e2e-paced/`)

Merané 25. 10. 2026 05:15–05:31, po „core-cms hotové".

**Verzie:**
- core-cms `feature/collab-stats` **9c08dbb00**, ako je rozbalený v repozitári. Nič som v ňom nemenil (`git status`
  čistý).
- collaboration **4751304** (opravy po posudkoch, cache `people` 5 min), kópia `perf/collab-statsc-4751304`.
- admin-cms ef822a603 som nespúšťal, zadanie ho nežiada.

**Prostredie:**
- Dev prostredie core-cms som len spustil `docker start` (`core-cms-core-cms-1`, MySQL, Redis a Mongo
  z `anzu-docker-services`) a na konci zastavil `docker stop`. Elasticsearch nebol treba.
- collaboration bežala vo WSL so štatistikami nad dátami z fázy A.
- Kontajner `perf-collab-proxy` (`node:24-alpine`, alias `collaboration` v `petitpress_network`) preposielal
  `collaboration:8186` na ňu.
- Token je `ANZU_COLLABORATION_TOKEN` z `.env` core-cms, takže `.env` netreba meniť.
- **Prihlásenie:** JWT podpísané vývojovým kľúčom z `.env` core-cms (`AUTH_JWT_PRIVATE_CERT`, ES256, audience `anz`,
  `sub` = id používateľa) v hlavičke `Authorization: Bearer` (`HttpUtil::getPlainAccessTokenFromRequest`).
  - Super admin je používateľ 13055 (`ROLE_SUPER_ADMIN`), bežný admin 10001040 (`ROLE_ADMIN`). Oba sú z dev DB.
  - Prihlásenie išlo, PHPUnit nebolo treba.
- **Vložené dáta:**
  - 5 relácií dneška s článkami 348–351 z dev DB. Tri cez `docId`, jedna len cez `entityId` (348). Jedna má neexistujúci
    `docId` a používateľa 999999.
  - Deň ľudí dneška s používateľmi 13055, 18796, 734566 a 10001043 na čele.

**Prístup** (`adm/v1/collab-stats/*`, každý endpoint):

| endpoint | super admin | admin bez `ROLE_SUPER_ADMIN` | bez prihlásenia |
|---|---|---|---|
| `live`, `live/rooms?bucket=twoPlus`, `summary?days=7`, `people?days=7`, `sessions?days=7`, `sessions/{id}` | **200**, mapy `articles` a `users` vo všetkých | **403** `access_denied` („The user doesn't have ROLE_SUPER_ADMIN.") | **401** |

**Mapy:**
- Zoznam relácií: na prvej strane je všetkých 5 vložených relácií.
  - `articles[docId ?? entityId]` vrátil články 351, 350 a 349 s titulkom a `docId` aj článok 348 cez `entityId`.
  - Neexistujúci `docId` v mape nie je, ako má byť.
- `users`:
  - v zozname je prázdne, lebo položky zoznamu nemajú účastníkov (projekcia bez `participants`);
  - v detaile sú 13055 a 18796 s `fullName`;
  - v `people` sú všetci štyria z čela rebríčka.
- `sessions?docId=` vrátil reláciu článku 351. `sessions?userId=13055` vrátil 4 vložené relácie s ním.
- **Postreh:** pri filtri `userId` mapa `users` toho človeka neobsahuje, lebo v tele odpovede jeho id nie je. Podľa
  kontraktu (mapy z polí tela) to je správne. Ak ho admin-cms má v nadpise, meno musí mať odinakiaľ.

**20 súbežných požiadaviek cez core-cms** (16 kľúčov všetkých endpointov, 1 min proti 1 min nečinnosti):

| okno | požiadavky | stavy | latencia p50 / p95 | CPU core-cms | CPU MySQL | MySQL `Questions` | CPU Mongo | CPU collaboration |
|---|---|---|---|---|---|---|---|---|
| nečinné | – | – | – | 0,2–0,4 % | 0,85 % | 4–6 | 1,2–1,4 % | 0,9–1,0 % |
| **20 klientov, každý raz za 5 s** (4/s, dashboardy) | 240 | 240× 200 | 247 / 281 ms | 88 % (1 jadro) | **0,97 %** | 729 (~3 na požiadavku) | 0,9 % | 1,8 % |
| 20 klientov bez prestávky | 2 095 (35/s) | 2 095× 200 | 561 / 785 ms | 1 490 % (15 jadier) | 6,1 % | 6 406 (~3 na požiadavku, `Slow_queries` 0) | 1,1 % | 7,0 % |

- **MySQL je v šume pri tempe dashboardov** (0,97 % proti 0,85 %).
  - Na požiadavku idú ~3 dotazy: používateľ prihlásenia, články, mená. Pomalý dotaz nebol žiadny.
  - Pri 35 požiadavkách/s je MySQL na 6 %.
- **CPU core-cms nie je v šume**: ~0,22 CPU-s na požiadavku, v dev režime (`APP_ENV=dev`, debug, profiler). Bez
  prestávky si 20 klientov vezme 15 jadier.
  - Produkčný režim a pod s limitom som nemeral. Toto číslo je cena dev prostredia, nie štatistík (odvodené).
- **Mongo je v šume** (0,9–1,1 % proti 1,2–1,4 %) a collaboration 1,8–7 %.
  - Maximum slučky collaboration 273 ms v okne s dashboardmi je jeden výpočet `people` za 30 dní nad dátami na strope.
- **429 sa prenesie:**
  - Cez core-cms prirodzene nevzniklo: PHP v dev režime odpovedá za 0,25–0,8 s, preto na collaboration nikdy
    nečakali viac ako 4 požiadavky naraz.
  - Overené inak: čerstvá collaboration, otvorený breaker, súhrn cez core-cms 8× → **6× 503**
    `{"error":"unavailable",…}`, potom **2× 429 s `Retry-After: 59`** `{"error":"too_many_requests",…}`.
  - Kód aj `Retry-After` prešli cez core-cms.

### `people` pri 100 a 300 ľuďoch denne (`lib/statscPeopleSizes.mjs`, `people-sizes.json`, collaboration 4751304)

**Postup:**
- 30 dní `collab_daily_users` s N ľuďmi a 2N dvojicami denne (prví, ako ich nechá `cappedPeopleIncrements`), zvyšok
  v `other`. Potom sa nasiate dni vrátili.
- **Priamo**: 100× dotaz, parsovanie a súčet ako `computePeople`.
- **Endpoint**: prvá požiadavka na 6 čerstvých serveroch (bez cache) a najdlhšie oneskorenie slučky v okne okolo nej.
  Čerstvý server meria aj studený kód (JIT), teda je to horná hranica pre bežiaci server.

| ľudí / dvojíc denne | bajty z Monga 7 / 30 d | priamo p95 7 d | priamo p95 30 d | endpoint p50 / p95, 30 d | **slučka max p50 / p95**, 7 d | **slučka max p50 / p95**, 30 d |
|---|---|---|---|---|---|---|
| **100 / 200** | 0,13 / 0,62 MB | **3,7 ms** | **13,6 ms** | 64 / 89 ms | 23 / 31 ms | **40 / 58 ms** |
| **300 / 600** | 0,38 / 1,82 MB | **8,0 ms** | **34,6 ms** | 127 / 174 ms | 50 / 50 ms | **83 / 118 ms** |
| 1 000 / 2 000 (strop) | 1,23 / 5,95 MB | 24,2 ms | 132,9 ms | 327 / 365 ms | 96 / 98 ms | 268 / 286 ms |

- Pri 100 ľuďoch denne prejde 20 ms aj za 30 dní. Pri 300 za 7 dní áno, za 30 dní nie (35 ms).
- Blokovanie slučky rastie s veľkosťou zhruba lineárne: ~40–60 ms pri 100, ~80–120 ms pri 300, ~270–290 ms na strope.
  Pri cache 5 min (4751304) to je najviac raz za 5 min na kľúč a pod.
- Nečinné okno toho istého servera malo maximum 1–27 ms.

### Verdikt po bránach

| brána | výsledok |
|---|---|
| C1 dáta 10× | **prejde**: 150 000 relácií, stropy, 0 nezhôd kontrolných súčtov bez `allowDiskUse` |
| C2 plány | **prejde**: 41 dotazov z 41 na menovanom indexe, bez `COLLSCAN` a `SORT`, `docsExamined` = `nReturned` |
| C2 časy | **prejde** okrem `people` nad 300 ľudí denne. 30 dní p95: 13,6 ms pri 100, 34,6 ms pri 300, 133–140 ms na strope 1 000 (limit 20). Rozhoduje vlastník: prijať (cache 5 min) alebo znížiť stropy |
| C3 súbežnosť | **prejde** na collaboration: single-flight, cache, semafor 429, limit súhrnov, Mongo v šume. Cez core-cms: 429 a 503 sa prenesú, MySQL v šume pri tempe dashboardov. **CPU core-cms v šume nie je**, ale meral som len dev režim (0,22 CPU-s na požiadavku) |
| end-to-end | **prejde**: všetky endpointy 200 pre super admina, 403 pre admina, 401 bez prihlásenia; mapy článkov (`docId` aj `entityId`) a mien sedia |

### Neoverené (fáza B)

- **core-cms v produkčnom režime** (`APP_ENV=prod`, bez profilera) a jeho CPU na požiadavku. Dev režim stojí
  0,22 CPU-s.
- **admin-cms** (ef822a603): taby, grafy a polling v prehliadači.
- **`live/rooms` s živými miestnosťami cez core-cms**: počas behu nebola otvorená žiadna miestnosť, mapy boli prázdne.
  Živé miestnosti s mapami pokrývajú testy core-cms.
- **Mapy pri článku s viacerými verziami**: dev DB nemá článok s 2+ verziami, takže „najvyššia verzia" nebola overená
  na dátach.
- **Prirodzené 429 cez core-cms** pri rýchlejšom core-cms (prod) som nemeral, len vynútené.

### Upratanie (brány C)

- Kontajnery core-cms (`core-cms-core-cms-1`, MySQL, Redis, Mongo z `anzu-docker-services`) sú zastavené (`docker stop`).
- `perf-collab-proxy`, `perf-collab-mongo` a `perf-collab-redis` sú zmazané. Žiadny vlastný proces nebeží.
- Do repozitárov som nezapisoval.
- Znova:
  - `bash perf/run-statsc.sh up|prepare|seed|sums|plans|load|load-paced|cap|people`;
  - fáza B: `e2e`, `e2e-paced`, `people-sizes statsc-4751304`;
  - každý krok cez `flock -w 540 krok5-praca/tazky.lock`.

## Priamy prístup (prehliadač admin-cms priamo na collaboration)

Merané 25. 10. 2026 17:53–17:55 (`lib/statscDirect.mjs`, `bash perf/run-statsc.sh direct` cez `flock`, výsledky
`perf/results/statsc/direct/direct.json`).

**Prostredie:**
- collaboration `feature/collab-stats` **dc9cda4** z `git archive` (`perf/collab-statsc-dc9cda4`), štatistiky zapnuté.
- MongoDB 8.0.20 (rs0) a Redis 7.2.4 v kontajneroch `perf-collab-*`, po meraní zmazané.

**Nastavenie:**
- Testový pár kľúčov ES256 (P-256, ako podpisuje core-cms). Verejný kľúč ide do `AUTH_JWT_PUBLIC_CERT` (base64 PEM,
  `src/config/config.ts`).
- Token `{ sub, aud: 'anz', iat, exp }` ide rozdelený do cookies `anz_jp` (header.payload) a `anz_js` (podpis), ako ho
  číta `src/util/authorization.ts`.
- `COLLAB_STATS_USER_IDS` nenastavené, platí predvolené `1,2`.
- `COLLABORATION_SERVER_CORS` = `^http://cms\.perf\.localhost$`.
- Požiadavky idú na Hocuspocus port s `Origin: http://cms.perf.localhost`, každý prípad na všetkých 5 endpointoch:
  `live`, `live/rooms?bucket=twoPlus`, `summary?days=7`, `people?days=7`, `sessions?days=7`.
- CORS v tabuľke znamená `Access-Control-Allow-Origin` = origin, `Access-Control-Allow-Credentials: true` a
  `Access-Control-Expose-Headers: Retry-After` (vždy aj `Vary: Origin`).

| požiadavka | očakávané | skutočné (5 z 5 endpointov) |
|---|---|---|
| cookie so `sub` = 1 | 200 a CORS | **200**, CORS áno |
| cookie so `sub` = 2 | 200 a CORS | **200**, CORS áno |
| bez cookie | 401 | **401** `{"detail":"Unauthorized!"}`, CORS áno |
| token podpísaný iným kľúčom | 401 | **401** `Unauthorized!`, CORS áno |
| cookie so `sub` = 3 | 403 | **403** `{"detail":"Forbidden."}`, CORS áno |
| `OPTIONS` preflight (`Access-Control-Request-Method: GET`) | 204 a CORS | **204**, CORS áno, `Allow-Methods: GET`, `Allow-Headers` podľa žiadosti, `Max-Age: 600` |
| `OPTIONS` preflight z iného originu (`http://evil.example`) | 204 bez CORS | **204**, bez CORS hlavičiek |
| cookie so `sub` = 1 z iného originu | bez CORS hlavičiek | **200**, bez CORS hlavičiek (prehliadač odpoveď stránke nevydá) |
| `Authorization: Bearer <SYS_API_TOKEN>` bez cookie | 401 | **401** `Unauthorized!` |
| 40 požiadaviek naraz (`sessions` s rôznym `limit`, Mongo na 2 s pozastavené `docker pause`) | 429 s `Retry-After` a CORS | **4× 200, 36× 429** `Too many requests…`, `Retry-After: 1`, CORS áno |

Všetkých 10 prípadov dopadlo podľa očakávania. Log servera nemá žiadnu chybu ani varovanie a server sa ukončil čisto.

- **Prečo `docker pause`:** nad prázdnou databázou odpovedá každá požiadavka hneď, takže 40 požiadaviek naraz semafor
  nenaplnilo (prvý pokus dal 40× 200). Počas pauzy Monga čakajú prvé 4 a ostatné dostanú 429.
- **Neoverené:**
  - skutočný prehliadač (CORS vyhodnocuje on, tu som len čítal hlavičky);
  - cookies z prihlásenia v core-cms (doména `COOKIE_DOMAIN`, `SameSite`) a skutočný kľúč core-cms;
  - vypršaný token.
