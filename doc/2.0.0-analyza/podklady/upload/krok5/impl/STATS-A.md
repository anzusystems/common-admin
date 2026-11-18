# STATS-A: živý stav kolaborácie v kolaboračnom serveri (časť A)

Zadanie: `krok5-praca/zadania/zadanie-stats-a.md`, návrh `COLLAB-STATS.md` (§4, §9.3, §10.6, §10.9, §10.10, §10.12).
Repozitár `/home/volar/projects/petit/collaboration`, vetva `feature/collab-stats` (z `next`, `d211edd`). Časť A
commitol vedúci ako `756a13e`, opravy ako `7237c66` (§11) a `20a94b5` (§13), časť B1 je `1edb565`.
**Súčasný kód opisujú §1–§4 a §8, zosúladené s ním v §15 (oprava po posudkoch 2, necommitnutá).** §5–§7 a §9–§14 sú
história krokov: merania, kontroly a rozhodnutia vrátane toho, čo už v kóde nie je (snímok `fetchSockets()`, vlastný
token, prístupový log, `socket.data.joinedAt`, `connectedUsers`).
`.gitignore` je zmenený vlastníkom, nie mnou. Cesty bez prefixu sú v repozitári collaboration. **Overené** = test,
kontrola, ručný beh alebo meranie; **odvodené** = môj záver bez merania.

## 1. Čo pribudlo

| Súbor | Obsah |
|---|---|
| `src/server/document/onRequestHook.ts` | vetva `GET /api/sys/v1/collab-stats/*` pred 404 (`:95-104`), `SYS_API_TOKEN` overený rovnako ako pri `room-data` (`!==`, 401) |
| `src/server/document/collabStatsRequest.ts` | smerovanie `live` a `live/rooms`, validácia parametrov, semafor 4 súbežných na pod (429), tlmený log chýb, odpovede 200/400/404/429/503 |
| `src/manager/collabStatsLiveManager.ts` | snímok: vlastní členovia z mapy podu a ostatné pody jedným `serverSideEmit` s timeoutom 2 s; zoskupenie, `uniqueUsers`, `instances`, Redis pipeline v 2 krokoch, cache 5 s a single-flight |
| `src/util/helper/collabStatsRoomHelper.ts` | zoznam entít `{ article: 'cms:article:' }` a `collabStatsEntityOf(room)` (ďalšia entita = jeden riadok); **mapa podu** `collabStatsJoins` (`Map<room, Map<socketId, ms>>`) plnená udalosťami adaptéra a `collabStatsMembersOf()` z nej (bod 4.2) |
| `src/server/collaboration.ts` | listenery adaptéra pred `listen` (`:50-51`) a obsluha `collabStatsMembers`, odpoveď ostatným podom z mapy (`:55-58`) |
| `src/types/CollabStats.ts`, `src/types/Socket.ts` | typy odpovedí; udalosť servera `collabStatsMembers` (nahradila nepoužité `fetchAllSockets`) |
| `request/collab-stats.http` | vzorové volania ako `room-data.http` |
| `test/collabStatsLive.test.ts` (34 testov), `test/collabStatsCluster.test.ts` (5) | §6, §11.5, §15.7 |

## 2. Endpointy

Oba len `GET`, hlavička `Authorization: Bearer <SYS_API_TOKEN>` (rovnaký token a rovnaká kontrola ako `room-data`,
§13). Iná metóda alebo iná cesta pod `/api/sys/v1/collab-stats/` → 404 `{"error":"Not found."}`.

| Endpoint | Parametre | Zdroj | Cache |
|---|---|---|---|
| `/api/sys/v1/collab-stats/live` | `entity` (predvolene `article`) | spoločný snímok: mapa vlastného podu + `serverSideEmit` ostatným | snímok 5 s, single-flight |
| `/api/sys/v1/collab-stats/live/rooms` | `entity`, `bucket` = `one` \| `twoPlus` (povinný), `limit` 1–200 (predvolene 200) | ten istý snímok + Redis pipeline v 2 krokoch | čítanie Redisu raz za snímok a kôš, single-flight |

Odpovede chýb: 401 `{"detail":"Unauthorized!"}` (bez tokenu, zlý token), 400 `{"detail":"…"}` (neznáma entita, kôš,
limit mimo 1–200 alebo nie celé číslo), 429 `{"detail":"Too many requests for the collaboration stats."}` s
`Retry-After: 1` (nad 4 súbežné požiadavky na pod, §11.2), 503 `{"detail":"The live collaboration stats are
unavailable."}` (iný pod neodpovedal do 2 s, adaptér nevie spočítať pody, chyba Redisu). Chyba sa loguje tlmene: prvá
`warn`, ďalšie do 15 min od neho `info`, prvá po 15 min znova `warn` s počtom medzitým (§11.4). Zlé parametre dávam 400
(chyba volajúceho core-cms, ktorý validuje sám a vracia 422 podľa §9.3).

## 3. Tvary JSON (príklad z ručného behu, bod 7)

`GET /api/sys/v1/collab-stats/live?entity=article` (tvar §10.9 s `uniqueUsers` a `instances`, počty z ručného behu
§15.8, krok 0):

```json
{"generatedAt":"2026-10-22T18:59:37.884Z","entity":"article","oneUser":1,"twoPlus":1,"uniqueUsers":3,"instances":2}
```

`GET /api/sys/v1/collab-stats/live/rooms?entity=article&bucket=twoPlus`:

```json
{
  "generatedAt": "2026-10-22T16:16:46.563Z",
  "entity": "article",
  "bucket": "twoPlus",
  "instances": 2,
  "total": 1,
  "items": [{
    "room": "cms:article:1", "entityId": "1", "sessionStartedAt": null, "moderatorId": 101,
    "lockedFields": [{ "field": "texts.headline", "userId": 202 }],
    "participants": [
      { "userId": 101, "presentSince": "2026-10-22T16:16:42.732Z", "bodyEdits": null, "fieldEdits": null, "locksAcquired": null, "lastEditAt": null },
      { "userId": 202, "presentSince": "2026-10-22T16:16:43.087Z", "bodyEdits": null, "fieldEdits": null, "locksAcquired": null, "lastEditAt": null }
    ]
  }]
}
```

- Tvar položky je presne §10.9. Úpravy účastníkov (`bodyEdits`, `fieldEdits`, `locksAcquired`, `lastEditAt`) sú v časti A
  `null` = „zatiaľ nesledované"; doplní ich B2 z `collab:stats:s:<sid>:u:<userId>`. `null` zostane aj v B2 pri koši `one`
  (server úpravy sólo článku nevidí, §10.1 bod 8).
- `sessionStartedAt` je `null`, kým B1 nezapíše stav relácie (bod 4).
- `presentSince` je vždy vyplnený: čas vstupu z mapy podu (bod 4.2).
- `uniqueUsers` = rôzni ľudia vo všetkých miestnostiach entity v snímku, každý raz (nie len v zozname, teda presne aj
  nad 200 miestností). Nahradil `connectedUsers` z §10.9 (všetci pripojení vrátane stránok, boxov a info miestností).
- `instances` = koľko podov odpovedalo, vrátane toho, ktorý sa pýta (1 pri jednej inštancii).
- Navyše oproti §10.9: `entity`, `bucket`, `instances` a `total` (počet miestností koša; `items` má najviac `limit`).
  `articles` a `users` doplní core-cms (§9.3, §10.9), collaboration nesie len ID.
- Poradie: miestnosti od najdlhšie obsadenej (najskorší `presentSince` v miestnosti), potom podľa názvu; účastníci podľa
  `presentSince`, potom podľa `userId`. `lockedFields` podľa názvu poľa.

## 4. Ako to funguje

1. **Snímok** (`collabStatsLiveManager.ts:77-98`): vlastní členovia z mapy podu (`collabStatsMembersOf`, bod 2) a
   ostatné pody jedným `adapter.serverSideEmit(['collabStatsMembers', ack])` s vlastným timeoutom **2 s** (ack adaptéra
   má pevných 5 s; `Namespace.serverSideEmit()` by zahodil promise, ktorý zlyhá, keď Redis nespočíta pody). Každý pod
   odpovie `{ members: [{ room, userId, joinedAt }] }` zo svojej mapy (`collaboration.ts:55-58`), bez cache na
   odpovedajúcom pode; žiadny handshake, ID socketov ani `data`. Neodpovedajúci pod → 503, nie čiastočný výsledok
   (§11.5). Pri jednej inštancii (`ALLOW_MULTIPLE_COLLAB_SERVER_INSTANCES` ≠ `true`) sa nikto nepýta. `instances` =
   odpovede + 1. Zoskupenie podľa entity a miestnosti; ten istý človek v dvoch socketoch (aj na dvoch podoch) je 1 s
   najskorším časom. **V cache zostáva len výsledok zoskupenia** (entita → miestnosť → používateľ → čas vstupu).
2. **Mapa podu a „odkedy"** (`presentSince`, `collabStatsRoomHelper.ts:24-68`): `collabStatsJoins`
   (`Map<room, Map<socketId, ms>>`) plnia listenery adaptéra menného priestoru `/`, registrované v `collaboration.ts`
   pred `listen`: `join-room` zapíše `Date.now()` len pre počítané miestnosti (`cms:article:<id>`; nie `:info`, boxy ani
   izbu socketu), `leave-room` záznam zmaže (prázdnu miestnosť celú). Adaptér tieto udalosti vyvolá na pode, ktorý socket
   drží, pri každom odchode: vlastný `socket.leave`, odchod na žiadosť iného podu (`RemoteSocket.leave` pri kicku a
   purge), `disconnectSockets` aj každé odpojenie (`leaveAll()` pred vyradením z menného priestoru). Listenery **nikdy
   nehodia** (`typeof room === 'string'`, `try/catch`), lebo bežia vnútri `socket.join`, `socket.leave` a odpojenia.
   Opätovný vstup bez odchodu udalosť nevyvolá, čas ostáva; reload alebo nové pripojenie (nový socket) ho začne znova.
   Snímok prechádza len mapu (ľudí v počítaných miestnostiach), `userId` berie z `nsp.sockets.get(socketId)`.
3. **Redis v 2 krokoch** (`collabStatsLiveManager.ts:116-166`), oba ako jeden pipeline (jedna cesta):
   (1) na miestnosť `GET <room>:moderator`, `HGETALL locks:<room>`, `GET <room>:stats:session`;
   (2) len pre miestnosti s reláciou `HGET stats:s:<sid> startedAt`. Kľúče relácie sú podľa §10.4 a zapisuje ich B1;
   miestnosť bez relácie krok 2 nepotrebuje. **Kontrakt pre B1**: `startedAt` v meta relácie je celé číslo ms od epochy (iný
   tvar dá `null`). B2 pridá do kroku 2 `HMGET` účastníkov.
4. **Cache a single-flight** (`:100-114`, `:188-218`): **jeden snímok na pod pre oba endpointy**: `live` aj `live/rooms`
   berú ten istý; prebiehajúci zdieľajú všetky požiadavky, vyriešený platí 5 s od dokončenia. Za okno cache je teda
   najviac jedna požiadavka klastra na pod, nech volá ktorýkoľvek endpoint a koľkokrát. Čítanie Redisu je uložené pri
   snímku (na entitu a kôš), takže zoznam nikdy nie je starší ako počty a pri ľubovoľnom `limit` sa Redis číta raz, pre
   najviac 200 miestností. Chyba sa neukladá: ďalšia požiadavka skúsi znova.
5. **Ochrana**: žiadny Redlock ani zámok miestnosti; všetko I/O je asynchrónne, synchrónna práca je prechod mapy a
   zoskupenie (O(členstiev v počítaných miestnostiach)). Strop odpovede: najviac 200 miestností, bez `handshake` a
   hlavičiek.

## 5. Čo stojí jedno volanie pri 100 miestnostiach

| Volanie | `fetchSockets()` | Redis (príkazy / cesty) |
|---|---|---|
| `live`, bez cache | 1 požiadavka klastra | 0 / 0 (okrem adaptéra) |
| `live/rooms`, bez cache, časť A | 1 (alebo 0, ak je snímok z `live` čerstvý) | 300 / 1 (3 na miestnosť) |
| `live/rooms` po B1 (všetky so stavom relácie) | to isté | 400 / 2 |
| `live/rooms` po B2, n účastníkov spolu | to isté | 400 + n / 2 |
| ktorékoľvek z cache (do 5 s) | 0 | 0 |

- **Overené testom** (`test/collabStatsLive.test.ts:297`): 100 miestností na dvoch „podoch" → `live` a `live/rooms` spolu
  1× `fetchSockets()` a 1 pipeline s 300 príkazmi.
- **Overené ručne** cez `redis-cli MONITOR` (1 miestnosť, dva pody): požiadavka klastra = `PUBSUB NUMSUB` + `PUBLISH`
  požiadavky + `PUBLISH` odpovede druhého podu; potom `get`, `hgetall`, `get` v jednom pipeline. Bez XADD (redis-streams
  adaptér robí `fetchSockets` cez pub/sub).
- Pri pollingu admin-cms 10 s a cache 5 s je to najviac 1 požiadavka klastra za 5 s na pod, nezávisle od počtu divákov
  a od toho, ktorý endpoint volajú.

### 5.1 Meranie snímku pri 200 a 1 000 socketoch

Skripty a logy v `krok5-praca/stats-a/`: `meranie.sh` + `zataz.mjs` + `odber.mjs` (výstup `meranie-200.txt`,
`meranie-1000.txt`), `cpu.mjs`/`cpu.sh` (offline CPU na zachytených odpovediach, pripísané na koniec tých istých
súborov), `prenos.mjs`/`prenos.sh` (`prenos.txt`). Dva pody z `dist` s redis-streams adaptérom proti `stats-a-redis` a
`stats-a-mongo`, Node 24.15.0, WSL2. Klienti socket.io 4.8.4, jeden používateľ na socket, striedavo na A a B; na desať
socketov: 4 sami v článku, 2 dvojica v jednom článku cez oba pody, 2 na stránke distribution managementu v 5 boxoch,
2 na zozname s odberom 10 info miestností. **Predpoklad:** hlavičky ako prehliadač za nginx (cookies s JWT, analytické a
súhlasové cookies, user-agent, `x-forwarded-*`), spolu ~1,3 KB; skutočné hlavičky produkcie som nevidel.

| | 200 socketov | 1 000 socketov |
|---|---|---|
| odpoveď druhého podu na `fetchSockets()` (pub/sub, msgpack) | 172 KB (jeho 100 socketov) | 861 KB (500 socketov) |
| z toho na socket | 1,72 KB: `handshake` 1,49 KB (hlavičky 1,27 KB), `rooms` 41 B, `data` 83 B | rovnako |
| požiadavka klastra | 106 B | 106 B |
| CPU pýtajúceho podu: prijatie cez ioredis + msgpack decode + objekty + zoskupenie | 2,5 + 0,8–1,3 + 0,05 + 0,1 ≈ **3,5–4 ms** | 5,7 + 3,4 + 0,1 + 0,4 ≈ **10 ms** |
| CPU odpovedajúceho podu: msgpack encode + publish (bez zostavenia detailov socketov) | 0,8–1,1 + 0,75 ≈ **2 ms** | 3,9 + 2,3 ≈ **6 ms** |
| `live/rooms one` navyše (do 200 miestností, pipeline 3 príkazy na miestnosť, JSON) | ~1,6 ms (80 miestností) | ~3,6 ms (200 zo 400) |
| snímok držaný v cache (heap, bez zoznamov) | ~70 KB | ~155 KB |
| `live` bez cache, celé HTTP volanie (20 volaní) | medián 20 ms, max 35 ms | medián 48 ms, max 87 ms |
| `live/rooms one` / `twoPlus` zo snímku v cache | 6 ms, 21 KB / 4 ms, 8 KB | 9,5 ms, 52 KB / 7 ms, 39 KB |
| RSS podov po zaťažení (nie snímok) | A 181 MB, B 261 MB | A 374 MB, B 330 MB |

- Offline CPU (`cpu.mjs`) beží na zachytených odpovediach oboch podov: msgpack z `node_modules` adaptéra a zoskupenie
  skutočným kódom z `dist` (`useCollabStatsLiveManager`, nový snímok v každom kole). Prenos (`prenos.mjs`) je ioredis
  publish a subscribe tej istej odpovede medzi dvoma procesmi, 50 správ. Tieto časy sú presné na ms; synchrónne
  bloky slučky sú decode a encode (pri 1 000 socketoch ~3,5–4 ms každý), zoskupenie je pod 0,5 ms.
- Hrubé CPU celých procesov z `/proc` (tik 10 ms, 10 kôl po 5,3 s mínus nečinné okno rovnakej dĺžky) dáva na kolo `live`
  pri 1 000 socketoch A ~50 ms a B ~40 ms, pri 200 A ~25 ms a B ~8 ms. Je to horná hranica so šumom (nečinné okno samo
  kolíše o desiatky tikov: pongy 1 600 členstiev, GC; pri 200 vyšlo B v okne so zoznamami záporne). Rozdiel oproti
  súčtu presných častí (≈ 10 a 6 ms) som nerozložil; patrí do E.
- **Čo z toho plynie (odvodené):** cena rastie lineárne s počtom socketov: ~1,7 KB prenosu na vzdialený socket a ~16 µs
  CPU na socket a snímok (oba pody spolu), z veľkej časti kvôli `handshake` (87 % bajtov), ktorý `fetchSockets()` nesie
  vždy celý. Pri strope 1 snímok za 5 s na pýtajúci pod je to pri 1 000 socketoch ~170 KB/s cez Redis a ~2 ms CPU za
  sekundu na pýtajúcom pode (~1,2 ms na odpovedajúcom); pri dnešnom rádovo stovkách socketov (§4.3) zlomok toho.
  V cache sa `handshake` nedrží (bod 4.1), zmenšiť ho dokáže len iný spôsob zberu: `serverSideEmit` s ack, kde každý pod
  vráti len `[userId, miestnosti s časom vstupu]` svojich socketov (odvodené: ~50–100 B na socket, ~20× menej).
  Neurobil som ho: zadanie predpisuje `fetchSockets()` a variant potrebuje obsluhu udalosti na každom pode; rozhodnutie
  po meraní v E. **Po posudkoch urobené (§11.5), premerané v §5.2.**

### 5.2 Premeranie po oprave (`serverSideEmit`, §11.5)

Ten istý skript a tí istí klienti (`krok5-praca/stats-a2/meranie.sh` = `stats-a/meranie.sh` s menami `stats-a2-*`,
`zataz.mjs`, `odber.mjs`; výstup `stats-a2/meranie-200.txt`, `meranie-1000.txt`), build so všetkými opravami §11.
Offline CPU (`cpu.mjs`) som neopakoval.

| | 200 socketov: pred → po | 1 000 socketov: pred → po |
|---|---|---|
| odpoveď druhého podu (pub/sub) | 172 318 B → **3 577 B** (~48×) | 861 388 B → **17 497 B** (~49×) |
| požiadavka klastra | 106 B → 94 B | 106 B → 94 B |
| `live` bez cache, celé HTTP volanie (20 volaní) | medián 20 ms → **9 ms**, max 35 → 15 ms | medián 48 ms → **13 ms**, max 87 → 32 ms |
| CPU kôl `live` z `/proc` (okno `live` mínus nečinné, 10 kôl) | A 25 → 15, B 8 → 9 tikov | A 51 → −14, B 39 → 18 tikov |
| `live/rooms one` / `twoPlus` (medián) | 6 / 4 ms → 6 / 3,5 ms, odpovede rovnako veľké | 9,5 / 7 ms → 9 / 6 ms, rovnako veľké |
| výsledok `live` | `oneUser 80, twoPlus 20, connectedUsers 200` (rovnaký) | `400, 100, 1000` (rovnaký) |

- Odpoveď už nezávisí od hlavičiek: ~35 B na socket odpovedajúceho podu (drží polovicu; zoznam `userIds` a členovia
  počítaných miestností), predtým ~1,7 KB; pri 1 000 socketoch a strope 1 snímok za 5 s na pod je to ~3,5 KB/s cez
  Redis namiesto ~170 KB/s.
- CPU z `/proc` (tik 10 ms) je ako v §5.1 v šume nečinného okna (kolíše o desiatky tikov, pri 1 000 vyšlo A záporne).
  Spoľahlivejšie je, že odpadli decode a encode ~0,86 MB odpovede (§5.1: ~3,5–4 ms každý na kolo), čo potvrdzuje
  čas volania `live` (48 → 13 ms).
- V logoch oboch podov žiadny `warn` ani `error`; kontajnery zmazané.

## 6. Testy

`test/collabStatsLive.test.ts` (Hocuspocus server v procese ako `onRequestHook.test.ts`, zamockované `fetchSockets` dvoch
podov a Redis pipeline, falošné len hodiny `Date`):

- 401 bez tokenu, s iným tokenom aj s tokenom rovnakej dĺžky, aj pre neznámu cestu; `fetchSockets` sa nevolá;
- `live`: počty 1 vs 2+ naprieč podmi (človek v dvoch socketoch = 1, `:info` a box sa nerátajú), požiadavka klastra s
  timeoutom 2000 ms, predvolená entita, prázdny stav;
- `live/rooms`: tvar `twoPlus` (moderátor, zamknuté polia zoradené, účastníci s časom), `one` (poradie od najdlhšie
  obsadenej, dve karty → skorší čas), socket bez času → `null`, `sessionStartedAt` z B1 kľúčov (2. pipeline), `limit` a
  `total` s jedným čítaním Redisu, prázdny zoznam bez Redisu, 100 miestností (bod 5);
- cache a single-flight: 10 súbežných `live` + 10 `live/rooms` → 1× `fetchSockets`, 1 pipeline; do 5 s z cache, po 5 s
  nový snímok;
- chyby: timeout `fetchSockets` → 503 + jeden `warn`, ďalšia požiadavka sa pýta znova; chyba Redisu → 503, ďalšia
  požiadavka číta znova;
- parametre: neznáma entita (aj `toString`), chýbajúci a zlý kôš, `limit` 0, 201, 1.5, prázdny → 400; 404 pre neznámu
  cestu, hlbšiu cestu a `POST`.

`test/roomUserManager.test.ts`: `joinUserSocket` zapíše čas vstupu, opätovný vstup ho nezmení, `leaveUserSocket` ho zmaže;
miestnosť, ktorú štatistiky nerátajú (`cms:box:1`), čas nedostane.

## 7. Kontroly (logy v `krok5-praca/stats-a/`)

- `yarn lint:fix` 0, `yarn ci` 0, `yarn test` 3× 0 (20 súborov, 160 testov), `yarn build` 0, `yarn tsc` 0
  (`kontroly.log`, `kontrola-*.log`); znova po úprave timeoutu, rovnaký výsledok.
- Prod štart z `dist` s lokálnym `.env`: všetky moduly sa načítajú, štart končí až na Mongo
  (`MongooseServerSelectionError: getaddrinfo ENOTFOUND mongo-anzu`, `start-prod.log`).
- Ručne (`rucne.sh`, `klienti.mjs`, výstup `rucne-vystup.txt`): dve inštancie z `dist` s
  `ALLOW_MULTIPLE_COLLAB_SERVER_INSTANCES=true` proti `stats-a-redis` (redis 7.2.4) a `stats-a-mongo` (mongo 8.0.20);
  klienti socket.io 4.8.4: 101 na A vstúpi do `cms:article:1`, 202 na B dostane `occupied`, požiada, 101 schváli, 202
  vstúpi a vezme zámok `texts.headline`; 303 na B sám v `cms:article:2`; 404 na A odoberá info článku 1; 505 na A v boxe.
  Oba pody vrátili `oneUser 1, twoPlus 1, connectedUsers 5`, zoznam `twoPlus` s moderátorom 101, zámkom 202 a časmi
  oboch, zoznam `one` s 303; 401 bez tokenu a so zlým tokenom; 400 bez koša a pre `entity=box`; po odpojení klientov
  nuly a prázdny zoznam. Logy serverov bez `error` a `warn`. (Tento beh bol pred úpravou timeoutu; meranie 5.1 už
  beží na `dist` s timeoutom 2 s, všetky volania 200, logy bez `error` a `warn`.) Kontajnery som po každom behu zmazal
  (`docker rm -f stats-a-redis stats-a-mongo`).

## 8. Odchýlky od návrhu a rozhodnutia

- `presentSince` z mapy podu (bod 4.2), nie zo stavu relácie v Redise (§10.9 ho čaká od B1). Líši sa len tým, či
  reload pod grace začne čas znova.
- Horúca cesta: `roomUserManager.ts` je ako pred časťou A (`d211edd`); pribudli len dva synchrónne listenery adaptéra
  (`typeof`, porovnanie predpony, operácia nad `Map`), bez I/O a bez `await`, nikdy nehodia.
- Token ako pri `room-data` (`!==`, §13), nie v konštantnom čase; rozhodnutie vlastníka.
- `bucket` je povinný, `entity` má predvolenú hodnotu `article` (rozhodnutie vlastníka: najprv články).
- `connectedUsers` z §10.9 nahradil `uniqueUsers` (§15.3); `live` a `live/rooms` majú navyše `instances` (§15.4), bez
  sledovania podov (heartbeat), rozhodnutie vlastníka. Počty Hocuspocus z §4.3 nie sú.

## 9. Čo neoverené

- Správanie pri skutočnom výpadku druhého podu (503 po 2 s): len test s odmietnutým `fetchSockets` a test, že sa
  posiela timeout 2000; nie dva pody s jedným zastaveným.
- Skutočné hlavičky produkcie (veľkosť cookies na `.sme.sk`, hlavičky nginx): meranie 5.1 predpokladá ~1,3 KB; väčšie
  hlavičky zväčšia odpoveď úmerne. Rozklad hrubého CPU z `/proc` (bod 5.1) a vplyv na latenciu úprav pod záťažou
  scenára b patrí do E (§10.13).
- Vplyv `joinedAt` na veľkosť odpovedí `fetchSockets()` miestností článkov: v meraní je celé `data` socketu 83 B
  (používateľ, `collabRooms`, `joinedAt`); samotný prírastok som nemeral (odvodené: ~30 B na článok, v ktorom socket je).
- Redis bez spojenia: klient má `maxRetriesPerRequest: null`, takže čítanie `live/rooms` na jednom pode bez adaptéra by
  čakalo, kým Redis nevráti (s adaptérom zlyhá už `fetchSockets` → 503). Timeout som nepridal; kolaborácia bez Redisu
  aj tak nebeží (§10.7).
- Kľúče B1 (`<room>:stats:session`, `stats:s:<sid>` so `startedAt` v ms) čítam podľa §10.4 a testu s mockom; s
  ozajstným zápisom B1 to overí až B1.
- core-cms a admin-cms (proxy, `articles`, `users`, taby) nie sú súčasťou A v collaboration.

## 10. Návrh správy commitu

Časť A je v `756a13e`. Pre úpravu po posudku (nad ním, necommitnutá):

```
fix: the live stats ask the cluster with a 2 s timeout instead of the adapter's 5 s, so they answer 503 sooner when another instance is slow
```

## 11. Oprava po posudkoch

Zadanie `krok5-praca/zadania/zadanie-stats-a2.md`; posudky `posudky/STATS-PLAN-opus.md` (M6, L7) a
`posudky/stats-plan-codex.md` (bod 11). Commitol vedúci ako `7237c66` nad `756a13e`; nahrádza aj necommitnuté
`timeout(2000).fetchSockets()` z §5.1 a jeho test 2 000 ms (timeout 2 s ostal, testujú ho
`collabStatsLive.test.ts` a `collabStatsCluster.test.ts`). Skripty a logy v `krok5-praca/stats-a2/`.

### 11.1 Vlastný token (M6)

- `COLLAB_STATS_API_TOKEN` → `collabStatsApiToken` (`src/config/config.ts:104`). **Nepovinná**: bez nej collaboration
  beží a štatistiky odmietnu všetko (401); chýbajúce tajomstvo nesmie zhodiť kolaboráciu.
- Kontrola sa presunula z `onRequestHook.ts` do `collabStatsRequest.ts:32-38`: `timingSafeEqual` nad rovnako dlhými
  bufframi, nikdy pre prázdny token ani pre nenahradený placeholder `#{…}#` (keby ho replace-tokens nechal, bola by to
  známa hodnota z repozitára). `room-data` a `tiptap-schema/validate` ostávajú na `SYS_API_TOKEN`; ten na štatistiky
  nestačí (test aj ručný beh: 401).
- `.env.dist` a lokálny `.env` (gitignored): `COLLAB_STATS_API_TOKEN=collab-stats-token`; `vitest.config.mts`:
  `stats-token`; `request/collab-stats.http` a `http-client.env.json`: `collabStatsToken`, `superAdminId`.
- `docker/kubernetes/configuration.yaml`, Secret: `COLLAB_STATS_API_TOKEN: "#{collaboration-stats-api-token}#"` (vzor
  `collaboration-sentry-dsn`).

**Musí doplniť vlastník alebo DevOps v Azure:**
1. tajná premenná `collaboration-stats-api-token` (náhodná, aspoň 32 znakov) v skupinách
   `collaboration-<env>-secrets` pre `devel`, `devel2`–`devel4`, `stage` (deploy pipeline) a `production` (release
   pipeline); pre každé prostredie iná;
2. tú istú hodnotu v core-cms (časť C), návrh premennej `ANZU_COLLABORATION_STATS_TOKEN` zo secretu
   `core-cms-anzu-collaboration-stats-token`. Klient `anzu_collaboration` v core-cms má pevný `auth_bearer`
   (`ANZU_COLLABORATION_TOKEN`, `config/packages/clients.php:72-79`), štatistiky teda potrebujú vlastný klient alebo
   hlavičku pri požiadavke;
3. `LOG_LEVEL` prostredia najviac `info`, inak sa prístupový log (§11.3) nezapíše.

**Neoverené:** čo urobí šablóna `node-deploy-k8s.yaml@templates` (repo `DevOps/azure-ci-template` nemám) s chýbajúcou
premennou; prázdna hodnota aj ponechaný placeholder dávajú 401.

### 11.2 Semafor so 429 (M6)

`collabStatsRequest.ts:14`, `:99-115`: najviac **4 súbežné požiadavky na pod** pre všetky stats endpointy (aj budúce
v tom istom module), ďalšie hneď `429 {"detail":"Too many requests for the collaboration stats."}` s `Retry-After: 1`.
Ráta sa po overení tokenu (bez tokenu sa slot neobsadí). Cache a single-flight ostali: čakanie na spoločný snímok slot
drží, odpoveď z cache sa dokončí v tej istej úlohe slučky, takže sa s inou neprekrýva. Test (4 čakajúce za bránou →
piata 429 → po otvorení 4× 200 a ďalšia 200, jedna požiadavka klastra) a ručne: B zastavený, 6 naraz → 4× 503 po 2 s,
2× 429 hneď. Test single-flight má teraz 4 súbežné požiadavky namiesto 20.

### 11.3 Prístupový log (M6)

Hlavička **`X-Anzu-Super-Admin-Id`** (core-cms pošle ID super admina, ktorý sa pýta). Po každej požiadavke jeden
`logger.info('Collaboration stats request.', { endpoint, superAdminId, status })` (`collabStatsRequest.ts:117-122`):
`endpoint` len `live`/`live/rooms` (iné `null`, cesta od útočníka sa nezapisuje), `superAdminId` len kladné celé číslo
do 10 číslic (inak `null`), `status` vrátane 401, 404, 429 a 503. Nič z odpovede (ID ľudí ani miestnosti). Hlavička nie
je povinná, kým ju core-cms neposiela; je to údaj volajúceho, nie overenie (to robí core-cms, §9.3). Test a ručne (log
oboch podov).

### 11.4 Tlmené logovanie chýb (L7)

`collabStatsRequest.ts:17`, `:49-61`: prvá chyba `warn` (Sentry), ďalšie do 15 min od posledného `warn` len `info`
(Sentry transport má úroveň `warn`); prvá chyba po 15 min znova `warn` s `failuresSinceWarning` = počet chýb medzi tým.
Stav je na pod (modul). Test s posunom hodín a ručne (prvé 503 `warn`, ďalšie `info`; v logu podu A jediný `warn`).

### 11.5 Snímok bez handshake (L7, Codex 11)

- Každý pod má obsluhu udalosti servera `collabStatsMembers` (`collaboration.ts:53-56`, typ `Socket.ts:18`), ktorá
  odpovie `{ userIds, members: [{ room, userId, joinedAt }] }` zo svojich lokálnych socketov
  (`collabStatsMembersOf`, `collabStatsRoomHelper.ts:25-48`): len miestnosti, ktoré štatistiky rátajú, každý
  používateľ raz na miestnosť s najskorším časom vstupu. `userIds` (všetci pripojení, aj mimo počítaných miestností)
  treba pre `connectedUsers`. Žiadny handshake, cookies, ID socketov ani `data`.
- Snímok (`collabStatsLiveManager.ts:58-98`): vlastné sockety priamo z `of('/').sockets`, ostatné pody jedným
  `serverSideEmit` s ack cez adaptér, vlastný timeout **2 s** (ack adaptéra má pevných 5 s,
  `cluster-adapter.js:404-444`). Volám `adapter.serverSideEmit` priamo, lebo `Namespace.serverSideEmit()` zahodí
  promise, ktorý zlyhá, keď Redis nespočíta inštancie (`PUBSUB NUMSUB`) → bol by to unhandled rejection. Pri jednej
  inštancii (`ALLOW_MULTIPLE_COLLAB_SERVER_INSTANCES` ≠ `true`) sa nikto nepýta: in-memory adaptér by len vypísal
  varovanie a nikdy neodpovedal.
- **Neodpovedajúci pod → 503, nie čiastočný výsledok.** Dôvody: (1) chýbajúci pod nepodhodnotí len súčty, ale
  **preradí** miestnosti zdieľané cez pody z `twoPlus` do `one` (každý pod drží časť ľudí), čo by čiastočný výsledok s
  príznakom aj tak nevedel opraviť; (2) tvar odpovede §10.9 a 503 v core-cms ostávajú, žiadny nový príznak pre C;
  (3) výpadok je krátky (pod sa po odpojení od Redisu prestane rátať v `NUMSUB`), polling to zopakuje a chyba sa
  necacheuje.
- `socket.data.joinedAt` ostáva: číta ho už len vlastný pod (komentár v `Socket.ts` upravený).
- **Veľkosť (premerané skriptom §5.1, výsledky v §5.2):** odpoveď druhého podu pri 200 socketoch **3 577 B** (predtým
  172 KB), pri 1 000 **17 497 B** (predtým 861 KB), ~48–49× menej; `live` bez cache medián 48 → 13 ms pri 1 000
  socketoch. Nezávisí od hlavičiek, len od počtu ľudí a členstiev v počítaných miestnostiach.
- Testy: `test/collabStatsCluster.test.ts` (nový, 3) spúšťa **dva skutočné socket.io servery** (každý s vlastnými
  modulmi ako vlastný proces) spojené testovacím `ClusterAdapter`, ktorý kopíruje správy ako Redis: počty a časy z
  oboch podov, odpoveď B je presne `{ userIds, members }`; tichý pod → chyba po 2 s, nie po 5 s; jedna inštancia sa
  nikoho nepýta. `test/collabStatsLive.test.ts` (37) má mock adaptéra, ktorý ostatné pody odpovedá skutočným
  `collabStatsMembersOf`; pribudli testy: jedna inštancia, tichý pod (503 po ≥ 1,9 s), chyba adaptéra, tlmenie logu,
  prístupový log, 429, token `''` a `#{…}#`, SYS token. `test/config.test.ts` +1 (bez premennej → `''`).

### 11.6 Interná cesta (M6)

**Áno, dá sa, ale kód nginxu som nemenil**: zmena potrebuje port v Service (nie je v tomto repozitári, robí ho šablóna
DevOps) a URL v core-cms, a voľbu portu musí potvrdiť DevOps (base image `node24:2.0.0-nginx-browsers` nepoznám).
Obmedzenie podľa IP v `location` nefunguje: za Ingress controllerom v klastri má každá požiadavka internú
`$remote_addr`.

Návrh (`krok5-praca/stats-a2/nginx/proxy.conf.template` a `.diff`):

```nginx
# vo verejnom server { listen ${NGINX_PORT}; ... } pred "location /":
    # The collaboration stats only on the internal port below. By the raw URI: the node server routes by it too.
    if ($request_uri ~ "^/api/sys/v1/collab-stats/") {
        return 404;
    }

# nový server na konci súboru:
# Inside the cluster only: the Service exposes this port, the Ingress does not. core-cms calls the stats here.
server {
    listen 8081;

    if ($request_uri !~ "^/api/sys/v1/collab-stats/") {
        return 404;
    }

    location / {
        proxy_pass http://main_websocket;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Podmienka je na surovom `$request_uri`, rovnako ako `request.url.startsWith(collabStatsPath)` v `onRequestHook.ts`;
`location` by porovnával normalizovanú cestu a `proxy_pass` posiela surovú, takže `…/collab-stats/../x` alebo
`/api//sys/…` by sa rozišli. **Overené lokálne** (`nginx/over.sh`, nginx 1.29.5 z lokálneho image
`nginxproxy/nginx-proxy:1.10.0`, upstreamy nahradené echo servermi): `nginx -t` ok; verejný port: obe stats cesty 404,
`…/collab-stats/../../…` 400, `/api//sys/v1/collab-stats/live` a `collab-stats%2Flive` idú do node (ten ich nesmeruje
do štatistík: surová cesta nezačína prefixom → 404), `room-data`, `tiptap-schema/validate`, `/ws/` a `/` ako doteraz;
interný port: stats cesty do node, všetko ostatné 404. Kontajner `stats-a2-nginx` zmazaný.

**Čo musí spraviť DevOps** (v tomto poradí; dnes stats nikto nevolá, C ešte nie je):
1. potvrdiť voľný port 8081 v base image; zmenu šablóny vyššie dať do
   `docker/app/kubernetes/etc/nginx/conf.d/proxy.conf.template`;
2. `docker/kubernetes/app-deployment.yaml`: `ports` + `- name: internal` / `containerPort: 8081`;
3. Service collaboration: port `8081` → `targetPort: internal`; Ingress ostáva len na `application` (8080);
4. core-cms: URL štatistík `http://<APP_NAME>.collaboration.svc.cluster.local:8081` (napr. `ANZU_COLLABORATION_STATS_HOST`),
   nie verejný `ANZU_COLLABORATION_HOST`;
5. ak klaster vynucuje NetworkPolicy: port 8081 len z namespace core-cms.

### 11.7 Kontroly (logy v `krok5-praca/stats-a2/`)

- `yarn lint:fix` 0, `yarn ci` 0, `yarn test` 3× 0 (**21 súborov, 172 testov**), `yarn build` 0, `yarn tsc` 0
  (`kontroly.log`, `kontrola-*.log`).
- Prod štart z `dist` s lokálnym `.env`: končí až na Mongo (`MongooseServerSelectionError: getaddrinfo ENOTFOUND
  mongo-anzu`, `start-prod.log`).
- Ručne (`rucne.sh`, výstup `rucne-vystup.txt`): dva pody z `dist` s redis-streams adaptérom proti `stats-a2-redis`
  (redis 7.2.4) a `stats-a2-mongo` (mongo 8.0.20), klienti `klienti.mjs` ako v §7. Oba pody `oneUser 1, twoPlus 1,
  connectedUsers 5`, zoznamy s moderátorom, zámkom a časmi; MONITOR jedného volania: `PUBSUB NUMSUB`, `PUBLISH`
  požiadavky, `PUBLISH` odpovede B, potom jeden pipeline; bez tokenu a so `SYS_API_TOKEN` 401; B zastavený `SIGSTOP`:
  503 za 2,0 s (prvé `warn`, ďalšie `info`), 6 naraz → 4× 503, 2× 429; po `SIGCONT` 200; po odpojení nuly; 200 socketov:
  `oneUser 80, twoPlus 20, connectedUsers 200`, odpoveď B 3 577 B. V logoch jediný `warn` (zámerná prvá chyba), žiadny
  `error`. Prístupový log oboch podov s `superAdminId 7`. Kontajnery zmazané (`docker rm -f stats-a2-redis
  stats-a2-mongo`).

### 11.8 Neoverené

- Správanie Azure šablóny pri chýbajúcej premennej (§11.1), skutočný Service/Ingress a voľnosť portu 8081 (§11.6).
- Pod, ktorý spadne bez odpojenia od Redisu (sieťový výpadok): `NUMSUB` ho ráta, kým Redis nezavrie spojenie, a
  dovtedy každé volanie dá 503 po 2 s; ručne len `SIGSTOP` (spojenie otvorené), nie výpadok siete.
- core-cms (token, hlavička, interná URL) je časť C.

## 12. Návrh správy commitu opravy

```
fix: the live collaboration stats take their own token COLLAB_STATS_API_TOKEN (compared in constant time, refused when empty or left as the deployment placeholder; room-data and the schema validation keep SYS_API_TOKEN), allow 4 concurrent requests per instance and answer 429 over that, log every request at info with the endpoint, the super admin of X-Anzu-Super-Admin-Id and the status, warn about a failure at most once in 15 min (info in between); the snapshot asks the other instances with serverSideEmit for only who is in which counted room since when instead of fetchSockets() with every handshake, 2 s timeout, 503 when one does not answer
```

## 13. Zjednodušenie autorizácie

Zadanie `krok5-praca/zadania/zadanie-stats-a3.md`, nad `7237c66`, necommitnuté. Rozhodnutie vlastníka: štatistiky idú
**rovnakou cestou ako room-data**, teda `SYS_API_TOKEN` a existujúci klient core-cms; super admina overuje len core-cms.
Žiadny nový token, secret v Azure, hlavička ani interný port. Skripty a logy v `krok5-praca/stats-a3/`.

- **Overenie** (`onRequestHook.ts:95-99`): vetva `collab-stats` má tú istú podmienku ako `room-data` (`:59`) a
  `tiptap-schema/validate` (`:24`): ``authorization !== `Bearer ${sysApiToken}` ``, 401 `{"detail":"Unauthorized!"}`.
  Spoločná funkcia v `onRequestHook` nie je a porovnanie v konštantnom čase mali len štatistiky, preto podľa zadania
  ostáva existujúci spôsob (`!==`). `room-data` a `validate` sa nezmenili (diff len vo vetve štatistík).
  `collabStatsRequest.ts` dostáva už len overené požiadavky a len `request.url` (ako v `756a13e`).
- **Odstránené:** `COLLAB_STATS_API_TOKEN` (`config.ts`, `.env.dist`, lokálny `.env`, `configuration.yaml`,
  `vitest.config.mts`, `config.test.ts`), hlavička `X-Anzu-Super-Admin-Id` a prístupový log `Collaboration stats
  request.`; `request/collab-stats.http` a `http-client.env.json` sú znova s `apiSysToken` (zhodné s `756a13e`).
  Iné sys endpointy nelogujú nič (ani `debug`), preto ani štatistiky nelogujú prístup; logujú len chyby (§11.4).
- **Ponechané:** semafor 4 a 429 (`collabStatsRequest.ts:10`, `:78-88`), tlmené logovanie chýb (§11.4), snímok cez
  `serverSideEmit` (§11.5). Semafor je teraz za overením v `onRequestHook`, takže požiadavka bez tokenu slot neobsadí.
- **Neplatí už:** §11.1 (secret `collaboration-stats-api-token`, premenná v core-cms, `LOG_LEVEL`), §11.3 a §11.6
  (interný port nerobiť). Pre časť C: core-cms volá štatistiky existujúcim klientom `anzu_collaboration` (ten istý
  `ANZU_COLLABORATION_TOKEN` a host ako room-data), nič nové v nasadení.
- **Testy:** `collabStatsLive.test.ts` s tokenom `sys-token`: 401 bez tokenu, s iným, s rovnako dlhým a pre neznámu
  cestu; odstránené testy vlastného tokenu (`''`, placeholder, SYS token odmietnutý) a prístupového logu; test tlmenia
  overuje, že `info` má len dve tlmené chyby (iný log nie je); test 429 navyše: pri 4 bežiacich dá požiadavka bez tokenu
  401, nie 429. `config.test.ts` zhodný s `756a13e`; `onRequestHook.test.ts` nezmenený.
- **Kontroly:** `yarn lint:fix` 0, `yarn ci` 0, `yarn test` 3× 0 (21 súborov, **167 testov** = 172 − 5 odstránených),
  `yarn build` 0, `yarn tsc` 0 (`kontroly.log`, `kontrola-*.log`); prod štart z `dist` končí až na Mongo
  (`MongooseServerSelectionError: getaddrinfo ENOTFOUND mongo-anzu`, `start-prod.log`). V `dist` nie je
  `COLLAB_STATS_API_TOKEN` ani hlavička. Ručný beh s dvoma podmi som neopakoval (zmena je len overenie a log, pokryté
  testom cez HTTP server v procese).
- **Odvodené:** token má ten istý držiteľ (core-cms) ako room-data, ktorý ním už dnes zapisuje do miestností; štatistiky
  mu pridávajú čítanie. Riziko porovnania `!==` je rovnaké ako pri existujúcich sys endpointoch.

## 14. Návrh správy commitu zjednodušenia

```
fix: the live collaboration stats are checked like room-data, with SYS_API_TOKEN in onRequestHook, instead of their own COLLAB_STATS_API_TOKEN; no X-Anzu-Super-Admin-Id and no access log (the super admin is checked by core-cms, the other sys endpoints log nothing); the limit of 4 requests with 429, the damped failure logs and the serverSideEmit snapshot stay
```

## 15. Oprava po posudkoch 2

Zadanie `krok5-praca/zadania/zadanie-stats-a4.md` (schválené vlastníkom), nad `1edb565`, necommitnuté. Posudky
`posudky/stats-a-codex.md`, `posudky/stats-a-navrhy-codex.md` a závery Opusa. Skripty a logy v `krok5-praca/stats-a4/`.
Cesty bez prefixu sú v repozitári collaboration.

### 15.1 Čas vstupu z udalostí adaptéra (Codex: `joinedAt` po vzdialenom odchode)

- **Pred:** `roomUserManager.ts` zapisoval `socket.data.joinedAt[room]` pri vstupe a mazal ho pri odchode, aj na
  `RemoteSocket` (kópia, vlastník zmenu nevidí); purge ho obišiel. Socket kicknutý z iného podu si čas nechal.
- **Teraz:** mapa podu `collabStatsJoins: Map<room, Map<socketId, ms>>` a `trackCollabStatsJoins(adapter)`
  (`collabStatsRoomHelper.ts:24-49`), registrované na adaptéri menného priestoru `/` hneď po `new Server()`, pred
  `listen` (`collaboration.ts:50-51`). `join-room` zapíše čas len pre `cms:article:<id>` (nie `:info`), `leave-room`
  záznam zmaže. Listenery nikdy nehodia: `typeof room === 'string'` a `try/catch` (bežia v `socket.join/leave` aj v
  `_cleanup` pri odpojení).
- **Nahradené, nie pridané:** `roomUserManager.ts` a `authorizationMiddleware.ts` sú zhodné s `d211edd` (pred časťou A),
  `joinedAt` už nie je v `CollaborationSocketData`; 2 testy `joinedAt` v `roomUserManager.test.ts` odstránené (súbor
  zhodný s `d211edd`). **B1** `joinedAt` nečíta (relácie berú `userIds` z `fetchInfo`, finalizér `fetchMembers()` zo
  snímku), v jeho kóde sa nič nemenilo; v `STATS-B1.md` §1 som opravil vetu o zdroji `presentSince`.
- **Overené v zdrojoch** (socket.io 4.8.4, socket.io-adapter 2.5.8, redis-streams-adapter 0.3.1): `addAll`, `del` a
  `_del` emitujú `join-room`/`leave-room` synchrónne a len pri skutočnej zmene (`in-memory-adapter.js:46-85`);
  `RemoteSocket.leave` → `socketsLeave` → správa `SOCKETS_LEAVE` → `delSockets` → `socket.leave` na vlastníkovi
  (`broadcast-operator.js:436`, `cluster-adapter.js:117-118`, `in-memory-adapter.js:235-239`); to isté
  `disconnectSockets`; odpojenie: `_cleanup` = `leaveAll()` pred `nsp._remove` a potom `join = noop`
  (`socket.js:558-561`), takže odpojený socket sa do mapy už nedostane.

### 15.2 Snímok z mapy (Codex: prechod všetkých socketov)

- `collabStatsMembersOf(sockets, joins = collabStatsJoins)` (`collabStatsRoomHelper.ts:51-68`) prechádza len mapu
  (počítané miestnosti a ich sockety), `userId` berie z `nsp.sockets.get(socketId)`; `socket.rooms` všetkých socketov
  už nečíta. Lokálna časť snímku (`collabStatsLiveManager.ts:83`) aj odpoveď ostatným podom (`collaboration.ts:55-58`)
  idú cez ňu, na odpovedajúcom pode bez cache.
- Odpoveď podu je len `{ members }`; pole `userIds` všetkých pripojených odpadlo s `connectedUsers`.
- `joinedAt` je vždy číslo: `presentSince` už nie je `null` (typ `string`), `earlierJoin` nahradil `Math.min`.
- **Odvodené:** práca na snímok je úmerná ľuďom v počítaných miestnostiach, nie všetkým socketom podu (zoznamy s info
  miestnosťami, boxy, stránky). Nemeral som (meranie §5.2 je ešte s prechodom socketov).

### 15.3 `uniqueUsers` namiesto `connectedUsers`

`live` vracia `uniqueUsers` = rôzne `userId` vo všetkých miestnostiach entity zo snímku
(`collabStatsLiveManager.ts:168-181`), nie z orezaného zoznamu, teda presne aj nad 200 miestností. `connectedUsers`
(všetci pripojení vrátane stránok, boxov a info miestností) je preč z typov, odpovede aj testov.

### 15.4 `instances`

`live` aj `live/rooms` majú `instances` = počet podov, ktoré odpovedali, vrátane seba (1 pri jednej inštancii,
`collabStatsLiveManager.ts:97`). Bez heartbeatu, podľa vlastníka. Medium Codexu (pod so živými socketmi, ktorý stratil
pub/sub odber, sa nespočíta a odpoveď je 200 bez neho) tým nie je opravené, len viditeľné: menšie `instances`, ako je
replík.

### 15.5 L1: názov miestnosti, ktorý nie je reťazec

`collabStatsEntityOf(room: unknown)` vráti `null` pre všetko okrem reťazca (`collabStatsRoomHelper.ts:15-22`); B1 ho
volá s ním tiež. Mapu plní len listener s rovnakou kontrolou, takže snímok na `null` ani objekt nenarazí (predtým
`collabStatsMembersOf` prechádzal `socket.rooms` a miestnosť `null` by zhodila každý snímok podu). Riadok štatistík pred
`onJoined()` v `joinUserSocket` už nie je (bod 15.1), `onJoined()` nič nezablokuje.

### 15.6 L2: nepoužité typy a dokumentácia

- `SocketDetails` a `fetchAllSockets` odstránené zo `src/types/Socket.ts`; nič ich nepoužívalo (`grep` v `src`, `test`,
  `request`).
- STATS-A: hlavička, §1–§4 a §8 podľa kódu (token ako `room-data`, `info` medzi `warn`, adaptér s 2 s, mapa,
  `instances`, unikátni ľudia, 429). `COLLAB-STATS.md` §10.9.1 a §10.9.2 rovnako: `!==` namiesto konštantného času,
  `info` namiesto `debug`, `adapter.serverSideEmit` s 2 s namiesto `serverSideEmitWithAck` s 3 s, odpoveď z mapy,
  `fetchAllSockets` odstránené, `live` s `uniqueUsers` a `instances`.

### 15.7 Testy

- `collabStatsCluster.test.ts` (5, predtým 3): dva skutočné socket.io servery s vlastnými modulmi; testovacie sockety
  vstupujú a odchádzajú cez adaptér ako sockety socket.io (`leave` → `del`, odpojenie → `delAll` a vyradenie z
  menného priestoru). Nové: kick a purge z iného podu (`fetchSockets()` → `RemoteSocket.leave`), `disconnect` z iného
  podu a vlastný `leave` → mapa vlastníka prázdna a počty z druhého podu sedia (`instances 2`); opätovný vstup čas
  nemení, `null`, číslo a objekt ako miestnosť nehodia a do mapy nejdú, odpojenie mapu vyčistí. Prvý test navyše:
  `:info` a box v mape nie sú, odpoveď druhého podu je presne `{ members }`.
- `collabStatsLive.test.ts` (34): ostatné pody odpovedajú skutočným `collabStatsMembersOf` nad vlastnou mapou, prvý pod
  je mapa modulu; `uniqueUsers` a `instances` v odpovediach; test „socket bez času → `null`“ nahradil test 250 miestností
  (`uniqueUsers` 249, zoznam 200 z `total` 250).
- `roomUserManager.test.ts`: 2 testy `joinedAt` preč.
- Testy chytia chybu: s vypnutým `leave-room` padnú 2 nové testy, bez filtra miestností 3 (`mutacia.sh`, zdroj potom
  obnovený, `cmp` zhodný).

### 15.8 Kontroly a ručný beh (logy v `krok5-praca/stats-a4/`)

- `kontroly.sh`: `yarn lint:fix` 0, `yarn ci` 0, `yarn test` 3× 0 (**27 súborov, 233 testov, 1 preskočený**, ako po B1:
  −2 `roomUserManager`, +2 `collabStatsCluster`, v `collabStatsLive` jeden test nahradený), `yarn build` 0, `yarn tsc` 0
  (`kontroly.log`, `kontrola-*.log`).
- Prod štart z `dist` (`start-prod.sh`): končí až na Mongo (`MongooseServerSelectionError: getaddrinfo ENOTFOUND
  mongo-anzu`, `start-prod.log`).
- **Ručne** (`rucne.sh`, `scenar.mjs`, `odpovede.mjs`; výstup `rucne-vystup.txt`): dva pody z `dist` s redis-streams
  adaptérom a zapnutými reláciami B1 proti `stats-a4-redis` (redis 7.2.4) a `stats-a4-mongo` (mongo 8.0.20, replica
  set); `odpovede.mjs` dekóduje odpovede podov na snímok z pub/sub (obsah ich máp).

  | Krok | `live` z A aj B | odpoveď B (jeho mapa) |
  |---|---|---|
  | 0: článok 1 = 101 (A, moderátor) + 202 (B, žiadosť a schválenie); článok 2 = 303 (B); 404 (A) sleduje info článku 2; 505 (A) v boxe | `oneUser 1, twoPlus 1, uniqueUsers 3, instances 2` | 202 v čl. 1, 303 v čl. 2 |
  | 1: 101 na A kickne 202 na B (socket 202 ostáva pripojený) | `2, 0, 2, 2` | len 303 v čl. 2 |
  | 2: 404 na A purgne článok 2 (socket 303 na B ostáva pripojený) | `1, 0, 1, 2` | `{"members":[]}` |
  | 3: 303 znova vstúpi do článku 2 | `2, 0, 2, 2` | 303 s novým časom (18:59:48 namiesto 18:59:32) |
  | 4: všetci sa odpoja | `0, 0, 0, 2` | `{"members":[]}` |

  `live/rooms` z B v každom kroku s `instances 2` a zodpovedajúcimi miestnosťami a časmi. V logoch oboch podov 0
  riadkov `warn` a `error`. Kontajnery zmazané (`docker rm -f stats-a4-redis stats-a4-mongo`).

### 15.9 Neoverené a odvodené

- Pod so živými socketmi bez pub/sub odberu (Medium Codexu): stále 200 bez neho, teraz s menším `instances`; ručne
  neskúšané.
- Výkon po zmene (CPU snímku pri veľa socketoch, vplyv listenerov na `join`/`leave`): nemerané; listener je pár
  operácií nad `Map` na udalosť (odvodené).
- Vzdialený odchod, ktorý sa k vlastníkovi nedostane (výpadok Redisu): udalosť nepríde a socket ostane v mape, kým sa
  neodpojí; rovnako ostane v miestnosti adaptéra, takže štatistiky sedia s tým, čo vidí `fetchInfo` (odvodené).

## 16. Návrh správy commitu opravy 2

```
fix: the live collaboration stats know since when a socket is in a counted room from the adapter's join-room and leave-room events, in a map of each instance, instead of socket.data, so a kick or a purge from another instance and a disconnect clear it; the own part of the snapshot and the answer to the other instances come from that map, not from all sockets; live answers uniqueUsers (the people in the entity's rooms, each once) instead of connectedUsers, live and live/rooms the number of instances that answered; a room name that is not a string is never counted; the unused fetchAllSockets and SocketDetails are gone
```
