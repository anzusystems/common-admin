# STATS-PLAN: nezávislý posudok návrhu štatistík (Claude Opus, len čítanie)

Uložené vedúcim zo správ recenzenta (5 častí). Verdikt: jadro architektúry je správne (úpravy v pamäti, stav relácie
v Redis, do Monga zapisuje len finalizér, samostatné spojenie; signály väčšinou správne – telo raz naprieč podmi,
sync a awareness vylúčené). **Nie je hotový**: H1, H2, M1–M7, všetko opraviteľné bez prepracovania.

## High
- **H1** §10.7 „kolaborácia funguje naplno bez Monga" neplatí: štart kolaborácie čaká `removeEditorsData()` (Mongo
  `deleteMany` s bufferovaním) pod zámkom miestnosti (`joinCollabRoomListener.ts:93-94`, `roomDataManager.ts:43-45`),
  načítanie tela číta Mongo (`fetchDocument.ts:47`), štart servera končí bez Monga (`index.ts:47, :121-127`). Test
  10.13/5 to nezachytí (editori sa pripájajú len vo warm-upe). Oprava: zúžiť požiadavku, alebo B3 opraví aj tieto cesty.
- **H2** Denné predpočty nie sú exactly-once: (a) `insertMany` ordered sa zastaví na prvej chybe, E11000 = „hotové" →
  stratené relácie; (b) `dailyDone` až po `$inc` → dvojitý `$inc` po nejasnom zápise/páde; (c) prekrývajúce sa behy
  BullMQ schedulera na dvoch podoch; (d) „ten istý bulkWrite" cez dve kolekcie len MongoDB 8 a nie atomicky. Oprava:
  jedna Mongo transakcia na dávku finalizéra (markery „finalized" vrátane sólo s TTL 2 d, vloženie relácií, `$inc`
  denných a ľudí, commit, až potom DEL/ZREM v Redis) + Redis mutex na beh.

## Medium
- **M1** Ozvena po uložení sa ráta ako úprava (`ArticleWidgetRedirect.vue:255-265` posiela changeFieldData pri každom
  saveTick, aj autosave každých 15 s) → moderátor „upravoval", relácia `realCollab` namiesto `presenceOnly`; `saves`
  ráta autosave. Oprava: changeFieldData rátať len pri hodnote odlišnej od uloženej.
- **M2** Release s dátami: klientský príznak voči hodnote pri acquire → select = 2 úpravy; serverová záloha s HGET
  medzi `mayStore()` a HSET by znova otvorila chybu poradia z ad6bfa5. Oprava: „líši sa od poslednej hodnoty, ktorú
  tento soket poslal", HGET pred `mayStore`.
- **M3** Životný cyklus predpokladá jednu udalosť na zmenu členstva: leave nahradenej karty, purge/replaced sokety a
  neskorý disconnect dávajú udalosti bez zmeny; disconnect s 10 opakovaniami, pád/vypnutie podu bez udalosti. Oprava:
  Lua dostane úplné `userIds` po udalosti a zosúladí všetkých; kontrola živosti zosúladí aj obsadené miestnosti;
  finalizér zavrie otvorené prítomnosti pri `endedAt`.
- **M4** Keyset kurzor nesedí s indexmi: indexy bez `_id`, triedenie podľa metriky → blokujúci SORT; filter `userId`
  s inými filtrami nepokrytý. Oprava: `_id` na koniec každého indexu, kurzor `(k, startedAt, _id)`, s `userId` len
  triedenie podľa `startedAt`.
- **M5** Finalizér v rade `collab` (concurrency 1, s join/moderation joby); hladovanie pri 200+ otvorených
  miestnostiach; bez `removeOnComplete` (1 440 jobov denne navždy). Oprava: samostatná rada + mutex, preskórovať
  `pending`, `removeOnComplete/removeOnFail`.
- **M6** (platí aj pre 756a13e) osobné údaje za zdieľaným `SYS_API_TOKEN` (token core-cms) na verejnej ceste za nginx
  `location /`; neskôr bez globálneho stropu záťaže. Oprava: vlastný token, interná cesta ak sa dá, semafor na pod
  s 429, prístupový log s ID super admina od core-cms.
- **M7** Akceptačné kritériá strážia C, no horúca cesta je v B1/B2; scenár c mení členstvo v `cms:page:` miestnostiach,
  ktoré štatistiky ignorujú. Oprava: kritériá 4 a 5 pre B1 a B2, pridať rotáciu členstva v článkových miestnostiach.

## Low
L1 mongoose debug globálne → inserty s userId v logoch (vypnúť pre stats spojenie). L2 prahy zapečené v kategórii a
denných počtoch → zmena prahu chce backfill. L3 `idleMs` obsahuje sólo fázy. L4 TTL 31 vs 30 dní. L5 hint na
neexistujúci index. L6 riadky z c8d96a2 posunuté. **L7 (platí pre 756a13e)**: `collabStatsRequest.ts:50` warn pri
každej chybe → Sentry pri výpadku; globálny `fetchSockets` pri každom miss cache posiela handshake (aj JWT cookies)
cez Redis, cache je na pod – voliteľne `serverSideEmit` s ack len `{room, userId, joinedAt}`. L8 B1 kategórie bez
úprav → zmiešané s B2. L9 embedy neposielajú dáta cez `changeCollabAnyData` → kľúče `embed:*` nevzniknú.

## Q7 zjednodušenia
Jedna transakcia namiesto `dailyDone`/E11000 logiky; jeden mechanizmus zmeny pri release; z v1 vypustiť awareness,
bodyBytes, bodySyncs, saves, systemFieldChanges, startSnapshotFields, fieldReleasesUnknown. Voliteľne bez
`collab_daily_users` a multi časti `collab_daily` – počítať z `collab_sessions` (≤15k dokumentov/30 d, cache 60 s).
## Q8 poradie
A → B1+B3 → B2 → C je v poriadku; A po vyriešení M6 a L7; B1 musí obsahovať opravy H2, M3, M5; brány podľa M7.
