# STATS-C: história štatistík kolaborácie v collaboration (7 dní, detail relácie)

Zadanie: `krok5-praca/zadania/zadanie-stats-c-collab.md`, návrh `COLLAB-STATS.md` §10.5, §10.6, §10.9.2. Vetva
`feature/collab-stats` nad 07f1419, necommitnuté.

## 1. Kontrakt API (pre admin-cms; proxy v core-cms je zrušená)

### 1.1 Spoločné

- **Volanie z prehliadača admin-cms priamo do collaboration**:
  `GET {origin}/api/adm/v1/collab-stats/<endpoint>?<parametre>` s `fetch(…, { credentials: 'include' })`.
  - `{origin}` je schéma a host z `COLLABORATION_HOCUSPOCUS_URL` admin-cms (`envConfig.collab.hocuspocusUrl`), so
    schémou `wss:` → `https:` a `ws:` → `http:`. Cesta tej URL sa zahodí, cesta štatistík ide od koreňa hostu.
    - V JS: `const base = new URL(hocuspocusUrl); base.protocol = base.protocol === 'wss:' ? 'https:' : 'http:'`;
      potom `new URL('/api/adm/v1/collab-stats/summary?days=7', base)`.
    - Príklady: `wss://collaboration.sme.sk` → `https://collaboration.sme.sk/api/adm/v1/collab-stats/live`;
      `ws://collaboration.sme.localhost` → `http://collaboration.sme.localhost/api/adm/v1/collab-stats/live`.
  - **Prečo táto adresa**: nginx podu (`docker/app/kubernetes/etc/nginx/conf.d/proxy.conf.template`) posiela
    `location /` na Hocuspocus (127.0.0.1:3006) a `location /ws` na socket.io (127.0.0.1:3007).
    - Endpointy štatistík bežia v `onRequest` servera Hocuspocus, takže `/api/adm/v1/collab-stats/…` (nie pod `/ws`)
      prejde cez `location /` správne.
    - Host z `COLLABORATION_SOCKET_URL` je ten istý. Jeho cestu `/ws` však treba zahodiť, inak by požiadavka išla na
      socket.io.
    - Nová premenná pre DevOps netreba.
  - Platí pre všetkých šesť endpointov: `live`, `live/rooms`, `summary`, `people`, `sessions` a `sessions/<id>`.
- **Cesta `adm`, nie `sys`**: `sys` je v Anzu pre systémové tokeny, `adm` pre prihláseného používateľa.
- **Origin a site sú povinné** (pred cookies; inak 403 a bez CORS):
  - `Sec-Fetch-Site` je `same-site` alebo `same-origin`. Prehliadač ho posiela vždy: admin-cms.sme.sk →
    collaboration.sme.sk je `same-site`, cudzí web je `cross-site`.
  - Celý `Origin` vyhovuje `COLLABORATION_SERVER_CORS` (`^(?:<regex>)$`, len pre štatistiky).
  - **Prečo**: v produkcii je `COLLABORATION_SERVER_CORS=https://admin-cms.sme.sk` bez kotiev a s neescapovanými
    bodkami, takže bez kotiev by prešiel aj `https://admin-cms.sme.sk.example.com`. Cookies core-cms sú
    `SameSite=None`, doména `.sme.sk`, secure, takže ich prehliadač pošle aj z cudzieho webu.
  - Bez týchto podmienok by cudzí web prečítal štatistiky v prehliadači povoleného admina.
  - Žiadna iná stránka tak tiež neobsadí semafor.
- **`Cache-Control: no-store`** je na každej odpovedi štatistík.
- **Overenie: cookies, nie token**.
  - collaboration overí cookies `anz_jp` a `anz_js` (JWT) ako pri socket.io a Hocuspocus (`verifyCookie`).
  - Hlavička `Authorization` sa nepoužíva; `SYS_API_TOKEN` pre štatistiky už neplatí, `room-data` ho používa ďalej.
- **Allow list**: používateľ z JWT (`sub`) musí byť v `COLLAB_STATS_USER_IDS` collaboration, inak 403. Kontrola
  super admina v core-cms odpadá.
  - Id sú oddelené čiarkou.
  - Bez premennej platia predvolene super admini core-cms (dátová migrácia `Version1111111111111100Data`):
    `1651144,1459820,1476581,18796,1548214,1799719,13055,734566,848674,1521222,1777852`. Výslovne prázdna hodnota = nikto.
- **CORS** (len pri splnení oboch podmienok vyššie):
  - Na každej odpovedi štatistík vrátane chýb dostane taký origin tieto hlavičky:
    - `Access-Control-Allow-Origin: <ten origin>`;
    - `Access-Control-Allow-Credentials: true`;
    - `Access-Control-Expose-Headers: Retry-After`;
    - `Vary: Origin, Sec-Fetch-Site`.
  - `OPTIONS` (preflight, napríklad pri vlastnej hlavičke) odpovie 204 s:
    - `Access-Control-Allow-Methods: GET`;
    - `Access-Control-Allow-Headers` podľa `Access-Control-Request-Headers`;
    - `Access-Control-Max-Age: 600`.
  - Iný origin hlavičky nedostane, prehliadač mu odpoveď nevydá.
  - Bežný `GET` bez vlastných hlavičiek preflight nepotrebuje.
- **Mapy `articles` a `users`** už nepridáva core-cms. admin-cms si názvy článkov (podľa `docId`, inak `entityId`)
  a mená ľudí (podľa `userId`) dočíta sám.
- **Endpointy histórie**: `summary`, `people`, `sessions`, `sessions/<id>`. Tvar živých `live` a `live/rooms` sa
  nemení, mení sa len ich overenie.
- **Spoločné parametre**:
  - `entity`: predvolene `article`, iná povolená hodnota dnes nie je.
  - `days`: povinný, len `7`, inak 400. 30 dní vlastník zrušil (§7), parameter ostáva kvôli tvaru API.
- **Obdobie**: `days` kalendárnych dní v Europe/Bratislava, ktoré končia dneškom: od 00:00 dňa (dnes − `days` + 1) po
  teraz. V odpovedi sú dni `from` a `to` (`YYYY-MM-DD`) a čas výpočtu `generatedAt` (ISO).
  - Odpoveď z cache môže mať `generatedAt` najviac 60 s (súhrn), 5 min (ľudia) alebo 30 s (zoznam, detail) staré.
  - Pri výpadku Monga je cache aj staršia, `generatedAt` vtedy ukáže jej vek.
- Časy sú ISO 8601 v UTC, trvania v ms, `userId` číslo. Kľúče objektov sú vždy všetky, aj s nulou.
- **`docId`** článku (UUID malými písmenami, ako ho pošle moderátor pri štarte spolupráce v pseudo-poli
  `collabStatsDocId`) je stabilný naprieč verziami. `entityId` je id verzie z miestnosti `cms:article:<id>`.
  - **admin-cms** ho pošle v odpovedi moderátora na `startCollab`, v tej istej mape dát ako `collabStatsBase`: kľúč
    `collabStatsDocId`, hodnota je reťazec UUID (nie obálka poľa).
  - collaboration ho z dát oddelí vždy, aj pri vypnutých štatistikách, a do dát miestnosti ho nikdy neuloží. Hodnotu
    inú ako UUID ignoruje.
  - Relácia si ho zapamätá raz, prvý platný.
  - Relácia bez `docId` má `null`, napríklad keď štart spolupráce zlyhal alebo ide o starší klient.
  - Články mapuj podľa `docId`, ak ho relácia má, inak podľa `entityId`.

**Chybové odpovede** (telo vždy JSON):

| kód | telo | kedy |
|---|---|---|
| 400 | `{ "detail": "<čo je zle>" }` | nepovolená alebo chýbajúca hodnota parametra, zlý kurzor, `userId` alebo `docId` s iným triedením, s filtrom koša či kategórie alebo spolu; vždy pred Mongom |
| 401 | `{ "detail": "Unauthorized!" }` | bez cookies `anz_jp`/`anz_js` alebo s neplatným či vypršaným JWT |
| 403 | `{ "detail": "Forbidden." }` | požiadavka bez hlavičky `Origin` alebo s originom mimo `COLLABORATION_SERVER_CORS` (ešte pred cookies), alebo platný používateľ, ktorý nie je v `COLLAB_STATS_USER_IDS` |
| 404 | `{ "error": "Not found." }` | neznámy endpoint |
| 404 | `{ "detail": "Session not found." }` | `sessions/<id>`: relácia neexistuje alebo už vypršala (8 dní) |
| 429 | `{ "detail": "Too many requests for the collaboration stats." }`, hlavička `Retry-After` (s) | podľa podu je naraz viac ako 4 požiadavky štatistík (živé aj história spolu), alebo súhrn a ľudia spolu prekročili 6 výpočtov za minútu a požiadavka nemá cache |
| 500 | `{ "detail": "The collaboration stats failed." }` | chyba kódu collaboration; odpoveď príde vždy |
| 503 | `{ "error": "disabled" }` | história pri `COLLAB_STATS_ENABLED` inom ako `true`; živé endpointy odpovedajú ďalej |
| 503 | `{ "detail": "The collaboration stats history is unavailable." }` | Mongo nedostupné, dotaz zlyhal alebo je breaker finalizéra otvorený, a pre tú istú požiadavku nie je cache; ak cache je, príde 200 so starou odpoveďou |

### 1.2 `summary?entity=article&days=7`

Sčíta `collab_daily` obdobia (najviac 31 dokumentov).

- **`partialDays`**: dni obdobia bez denného dokumentu, s neúplnými reláciami (`incomplete` > 0) alebo so zahodenými
  (`dropped` > 0).
- **Priemery**: celé ms; `avgEditors` a `avgParticipants` na 2 desatinné miesta. Pri 0 reláciách je priemer 0.
- **`series`**: každý deň obdobia vzostupne, aj deň bez dokumentu (nuly).
- **`byHour`**: 24 položiek, hodina začiatku relácie v Europe/Bratislava.
- **Počítadlá** žiadostí, moderovania a zámkov `collab_daily` nemá, sú len v detaile relácie (`counters` a
  `locksAcquired`/`locksRefused` účastníkov).

```json
{
  "generatedAt": "2026-10-24T09:30:05.000Z", "entity": "article", "days": 7, "from": "2026-10-18", "to": "2026-10-24",
  "partialDays": ["2026-10-24"],
  "solo": { "sessions": 5620, "clickThroughs": 1640, "avgDurationMs": 612000,
    "durationBuckets": { "lt30s": 1640, "lt5m": 2100, "lt30m": 1240, "lt2h": 560, "gte2h": 80 } },
  "multi": {
    "sessions": 63, "clickThrough": 26, "presenceOnly": 22, "separateEdits": 4, "realCollab": 11,
    "avgDurationMs": 2380000, "avgCopresenceMs": 1900000, "bodyEdits": 21840, "fieldEdits": 410,
    "avgEditors": 1.4, "avgParticipants": 2.21,
    "byPeakUsers": {
      "2": { "sessions": 52, "clickThrough": 23, "presenceOnly": 18, "separateEdits": 3, "realCollab": 8,
        "avgDurationMs": 2040000, "avgCopresenceMs": 1620000, "bodyEdits": 15200, "fieldEdits": 290,
        "avgEditors": 1.3, "avgParticipants": 2 },
      "3": { "…": "rovnaké polia" }, "4": { "…": "…" }, "5plus": { "…": "…" }
    }
  },
  "stale": 3, "incomplete": 1, "dropped": 0,
  "series": [{ "day": "2026-10-18", "solo": 810, "multi": 9, "realCollab": 2 }],
  "byHour": [{ "hour": 0, "solo": 0, "multi": 0, "realCollab": 0 }, { "hour": 8, "solo": 640, "multi": 7, "realCollab": 1 }]
}
```

### 1.3 `people?entity=article&days=7`

Sčíta `collab_daily_users` obdobia (najviac 31 dokumentov). Dni majú len skutočné spolupráce (`realCollab`), ich
dvojice so spoločnými úpravami a ľudí z nich.

- **`topUsers`**: najviac 50, triedené podľa `collaborations`, potom `activeMinutes` (zostupne), potom `userId`.
- **`topPairs`**: najviac 50, triedené podľa `collaborations`, potom `jointActiveMinutes`; v `users` je najprv menšie
  id.
- **`overCap`**: `true`, keď niektorý deň prekročil strop 1 000 ľudí alebo 2 000 dvojíc. Ich súčty sú potom v kľúči
  `other`, ktorý sa v rebríčku neukazuje, takže rebríček nemusí byť úplný.

```json
{
  "generatedAt": "2026-10-24T09:30:05.000Z", "entity": "article", "days": 7, "from": "2026-10-18", "to": "2026-10-24",
  "topUsers": [{ "userId": 101, "collaborations": 12, "edited": 11, "activeMinutes": 360, "bodyEdits": 9120,
    "fieldEdits": 85, "moderated": 9 }],
  "topPairs": [{ "users": [101, 202], "collaborations": 7, "jointActiveMinutes": 96 }],
  "overCap": false
}
```

### 1.4 `sessions?entity=article&days=7&…`

Relácie 2+ ľudí (`collab_sessions`) s začiatkom v období, zostupne.

| parameter | hodnoty | predvolene |
|---|---|---|
| `sort` | `startedAt`, `durationMs`, `jointActiveMinutes` (vždy zostupne, pri zhode `startedAt` a potom `id` zostupne) | `startedAt` |
| `peakUsers` | čiarkou oddelené z `2`, `3`, `4`, `5plus` (napr. `2,3`) | všetky |
| `category` | čiarkou oddelené z `clickThrough`, `presenceOnly`, `separateEdits`, `realCollab` | všetky |
| `limit` | 1–50 | 50 |
| `cursor` | `nextCursor` predošlej strany, s tými istými ostatnými parametrami | prvá strana |
| `userId` | celé číslo > 0: relácie, v ktorých bol človek účastníkom; **len** so `sort=startedAt` (alebo bez `sort`) a **bez** `peakUsers`, `category` a `docId`, inak 400 | – |
| `docId` | UUID (`8-4-4-4-12` hex, veľké písmená sa prevedú na malé): relácie článku naprieč jeho verziami; **len** so `sort=startedAt` (alebo bez `sort`) a **bez** `peakUsers`, `category` a `userId`, inak 400 | – |

Prázdne hodnoty (`peakUsers=`) a opakovaný parameter sú 400. `nextCursor` je `null` na poslednej strane. Je to
**nepriehľadný** reťazec: klient ho len posiela späť, nikdy ho neskladá ani nečíta. Viaže sa na `sort`, kurzor iného
triedenia alebo pokazený je 400.

```json
{
  "generatedAt": "2026-10-24T09:30:05.000Z", "entity": "article", "days": 7, "from": "2026-10-18", "to": "2026-10-24",
  "sort": "startedAt",
  "items": [{ "id": "6717f0c2a9e3b14d5c8e9a01", "entityId": "123", "docId": "3f0c8a52-7d1e-4b6a-9c2f-5e8d1a4b7c90",
    "startedAt": "2026-10-22T07:58:10.000Z",
    "endedAt": "2026-10-22T09:12:40.000Z", "durationMs": 4470000, "peakUsers": 2, "category": "realCollab",
    "editors": 2, "participantsCount": 2, "bodyEdits": 945, "fieldEdits": 6, "jointActiveMinutes": 17,
    "incomplete": false }],
  "nextCursor": "<nepriehľadný reťazec z predošlej odpovede>"
}
```

### 1.5 `sessions/<id>`

`<id>` je 24 hexadecimálnych znakov, inak 400. Odpoveď je celý záznam relácie (`COLLAB-STATS.md` §10.5.1), `_id` je
v ňom ako `id`.

- `fieldsChanged` účastníka je zoznam `{ f: <surový názov poľa>, n: <počet> }`, najviac 50 a `other`, najviac
  upravované prvé. Popisy polí prekladá admin-cms.
- `participants` je najviac 50 (`participantsOverflow` = koľko ďalších).

```json
{
  "id": "6717f0c2a9e3b14d5c8e9a01", "room": "cms:article:123", "entity": "article", "entityId": "123",
  "docId": "3f0c8a52-7d1e-4b6a-9c2f-5e8d1a4b7c90",
  "startedAt": "2026-10-22T07:58:10.000Z", "endedAt": "2026-10-22T09:12:40.000Z", "endReason": "empty",
  "incomplete": false, "durationMs": 4470000, "peakUsers": 2, "peakBucket": "2", "copresenceMs": 3900000,
  "copresenceUsersMs": 7800000, "firstCopresenceAt": "2026-10-22T08:02:00.000Z", "participantsCount": 2,
  "participantsOverflow": 0, "editors": 2, "bodyEdits": 945, "fieldEdits": 6, "jointActiveMinutes": 17,
  "minEditGapMin": 0, "collabPairs": [[101, 202]], "category": "realCollab",
  "thresholds": { "minEditOps": 1, "windowMin": 5, "slotS": 60 },
  "counters": { "occupied": 1, "joinRequested": 1, "joinApproved": 1, "joinExecuted": 1, "collabStarts": 1 },
  "participants": [
    { "userId": 101, "order": 1, "wasModerator": true, "joins": 1, "presentMs": 4470000, "activeMinutes": 38,
      "bodyEdits": 812, "fieldEdits": 4, "fieldsChanged": [{ "f": "texts.headline", "n": 3 }, { "f": "seo.title", "n": 1 }],
      "locksAcquired": 6, "locksRefused": 0, "edited": true,
      "firstEditAt": "2026-10-22T08:00:31.000Z", "lastEditAt": "2026-10-22T09:10:02.000Z" }
  ],
  "pods": ["collaboration-7d9f-abc12"], "version": "2.0.0"
}
```

`counters` obsahuje len nenulové počítadlá relácie (kľúče podľa udalostí: `occupied`, `joinRequested`, `joinApproved`,
`joinRejected`, `joinExecuted`, `moderationRequested`, `moderationApproved`, `moderationRejected`,
`moderationExecuted`, `transfers`, `moderatorPassedOn`, `kicks`, `purges`, `collabStarts`). Chýbajúci kľúč je 0.

### 1.6 `live/rooms` (doplnené)

Každá položka `items` má navyše `"docId": "<uuid>" | null`. Je to `docId` relácie miestnosti, kým ho relácia má
(štatistiky zapnuté, moderátor ho poslal), inak `null`. Ostatné polia sú podľa STATS-A §3.

### 1.7 Pre admin-cms

- Na 429 a 503 neopakuj hneď: `Retry-After` je čitateľná (`Access-Control-Expose-Headers`).
- 401 aj 403 znamenajú „nemáš prístup k štatistikám" a admin-cms ich zobrazí rovnako. 401 je chýbajúce, neplatné
  alebo vypršané prihlásenie, 403 používateľ mimo zoznamu alebo zlý origin.
- Validáciu môžeš zopakovať, collaboration ju robí vždy.
- Proxy v core-cms je zrušená, core-cms do štatistík nevstupuje.

## 2. Čo sa zmenilo (collaboration, necommitnuté nad 07f1419)

- **`src/manager/collabStatsHistoryManager.ts`** (nový):
  - validácia požiadavky (`parseCollabStatsHistoryRequest`) pred Mongom;
  - štyri výpočty (súhrn, ľudia, zoznam, detail) nad modelmi z `collabStats.model.ts`;
  - cache so single-flight a strop 6 výpočtov súhrnu za minútu.
- **Dotazy**:
  - každý je `find` s `select` (projekcia), `sort`, `hint` (meno indexu, pri `_id` `{ _id: 1 }`), `maxTimeMS`
    (denné a detail 1 000 ms, zoznam 2 000 ms), `limit` (≤ 31, zoznam `limit + 1`, detail 1),
    `read('secondaryPreferred')` a `lean()`;
  - agregácia nie je žiadna;
  - každý dotaz je ohraničený: denné dokumenty rozsahom `_id` (`<entity>:<od>` až `<entity>:<do>`), relácie
    `entity` a `startedAt` od 00:00 prvého dňa po teraz, detail `_id`.
- **Pred prvým čítaním** sa zavolá `connectStatsMongoose()` (zdieľané) a raz za proces `prepareCollabStatsCollections()`.
  Hinty totiž potrebujú indexy, ktoré finalizér na čerstvej databáze ešte nemusel vytvoriť.
- **Breaker finalizéra**: pred Mongom sa číta `openUntil` z `stats:breaker` (klient štatistík, 500 ms). Otvorený
  breaker znamená 503 alebo poslednú cache bez pokusu o Mongo. Zlyhané čítanie breakera nerozhoduje nič.
- **Cache** (v pamäti podu, najviac 200 kľúčov, najstarší vypadne):
  - TTL: súhrn 60 s, ľudia 5 min (po bránach C: na strope `collab_daily_users` 30 dní blokovalo slučku 210–280 ms),
    zoznam a detail 30 s;
  - prebiehajúci výpočet zdieľajú všetky požiadavky toho kľúča;
  - zlyhaný výpočet vráti poslednú hodnotu kľúča, ak je, inak 503.
- **`src/server/document/collabStatsRequest.ts`**:
  - smerovanie `summary`, `people`, `sessions`, `sessions/<id>`;
  - pri `COLLAB_STATS_ENABLED` inom ako `true` 503 `{ "error": "disabled" }` (pred validáciou);
  - spoločný semafor 4 so živými endpointmi;
  - 429 pri strope súhrnu, 404 pre chýbajúcu reláciu, 503 s tlmeným logom (`Failed to read the collaboration stats
    history.`, rovnaké tlmenie ako živé).
- **`src/types/CollabStats.ts`**: tvary odpovedí histórie.
- **docId článku** (doplnenie vlastníka):
  - `separateCollabStatsBase` oddelí z odpovede moderátora na `startCollab` aj `collabStatsDocId`, vždy, aj pri
    vypnutých štatistikách. Hodnotu prevezme len ako UUID (malými písmenami), inak `null`.
  - `recordFieldBase(room, base, docId, userId)` ho pošle do skriptu `collabStatsBase`, ktorý ho zapíše do relácie
    (`HSETNX stats:s:<sid> docId`), takže platí prvý.
  - TS zrkadlo skriptu (`test/support/statsRedis.ts`) je rovnaké.
  - Finalizér ho zapíše do `collab_sessions.docId` (inak `null`).
  - Nový index `stats_doc_time` `{ entity, docId, startedAt: -1, _id: -1 }` (`collabStats.model.ts`) vytvorí
    `prepareCollabStatsCollections()` aj na existujúcej kolekcii.
  - `sessions` a `sessions/<id>` vracajú `docId`, `sessions` má filter `docId` s `hint: 'stats_doc_time'`.
  - `live/rooms` číta reláciu jedným `HMGET startedAt docId` namiesto `HGET startedAt`, ciest do Redisu nepribudlo.
- **`doc/Collaboration-Changelog/Unreleased/collab-stats.md`**: bod o histórii v sekcii Added.
- **`COLLAB-STATS.md` §10.6.1**: poznámka o kurzore (§4).

## 3. Testy

- **`test/collabStatsHistory.test.ts`** (54): skutočný HTTP server Hocuspocus, Mongo v pamäti cez mock modelov
  s vyhodnocovaním filtra, triedenia, limitu a projekcie.
  - **Vypnuté štatistiky**: 503 `disabled` pre všetky endpointy histórie bez Monga; živý endpoint ide ďalej.
  - **Token**: bez tokenu a so zlým 401.
  - **Validácia** (23 prípadov): `days`, opakovaný parameter, entita, triedenie, koše, kategórie, `limit`,
    `userId` (aj s iným triedením a s filtrami) a kurzory (pokazený, iného triedenia, zlý typ kľúča, zlý dátum,
    `_id` ako objekt, kľúč navyše) → 400 bez spojenia s Mongom. Neznáme cesty 404.
  - **Súhrn**: súčty, priemery, `partialDays` (chýbajúci deň, `incomplete`, `dropped`), séria všetkých dní, 24 hodín,
    presný dotaz (filter, projekcia, hint, `maxTimeMS`, limit, secondary); 30 dní.
  - **Ľudia**: súčty dní, poradie, top 50, `other` → `overCap`.
  - **Zoznam**:
    - tvar položky bez `participants` a `counters`, `$in` všetkých hodnôt;
    - kurzor cez všetky strany pri každom triedení aj pri zhodných kľúčoch a začiatkoch: každá relácia raz, správne
      poradie, žiadne `$or`;
    - kroky po kurzore (filtre a limity);
    - filtre košov a kategórií;
    - relácie človeka (`stats_user_time`, bez košov).
  - **Detail**: celý záznam s `id`; 404.
  - **Strážcovia**: všetky dotazy všetkých endpointov majú hint, `maxTimeMS`, projekciu, limit ≤ 51, secondary
    a ohraničenie; `aggregate` sa nevolá.
  - **Cache**: TTL 60 s a 30 s; single-flight (3 súbežné požiadavky = 1 dotaz).
  - **Výpadky**:
    - Mongo dole dá 503, potom posledná odpoveď so starým `generatedAt`;
    - otvorený breaker dá 503 bez spojenia;
    - 7. výpočet súhrnu za minútu dá 429 s `Retry-After`, po minúte znova.
  - **Semafor**: 4 požiadavky histórie naraz → živý endpoint dostane 429.
- **docId**:
  - `collabStatsEdits.test.ts` (+1): docId sa uloží do relácie prvý raz, druhý ho neprepíše, zlý sa ignoruje, do dát
    miestnosti nejde nikdy, ani pri vypnutých štatistikách;
  - `collabStatsFinalizer.test.ts` (+1, a `docId: null` v prvom teste): zápis do `collab_sessions`;
  - `collabStatsSessionHelper.test.ts`: dokument s `docId`;
  - `collabStatsMongo.test.ts`: index `stats_doc_time`;
  - `collabStatsLive.test.ts`: `docId` v `live/rooms` a `HMGET`;
  - `collabStatsHistory.test.ts` (+6): filter `docId` naprieč verziami, `null` bez docId v zozname aj detaile,
    validácia (zlý UUID, iné triedenie, s kategóriou, spolu s `userId`);
  - `collabStatsMembership.test.ts`: zhoda skriptu so zrkadlom na skutočnom Redise (`REDIS_TEST_URL` proti
    `statsc-redis`, 26 z 26) vrátane `docId` (prvý ostane).
- **`test/collabStatsHistoryMongo.test.ts`** (9, len s `MONGO_TEST_URL`): skutočný MongoDB 8.0.20, replica set
  `statsc-mongo`.
  - Dáta: 650 relácií (500 v posledných 7 dňoch s 10 reláciami na každý rovnaký začiatok, zhodné trvania a spoločné
    minúty, 100 starších, 50 inej entity), 31 denných dokumentov a 31 ľudí.
  - Každý dotaz vysvetlený (`explain('executionStats')`), 139 dotazov:
    - plán `LIMIT > PROJECTION_SIMPLE > FETCH > SORT_MERGE > IXSCAN(<hint>)…`, pri `stats_user_time` a `_id` bez
      `SORT_MERGE`;
    - žiadny COLLSCAN ani blokujúci SORT;
    - `totalDocsExamined` = `nReturned` vo všetkých 139 dotazoch.
  - Strany cez kurzor pri všetkých troch triedeniach, s filtrami aj pre človeka sa zhodujú s očakávaným poradím.
  - Súhrn, ľudia a detail cez `_id_`.
- **Kontroly** (`krok5-praca/stats-c/kontroly.sh`, každý krok cez `flock` na `tazky.lock`) skončili všetky s 0:
  - `yarn lint:fix`, `yarn ci`, `yarn build` a `yarn tsc`;
  - `yarn test` 3×: 35 súborov, **392 testov a 12 preskočených** (3 Redis, 9 Mongo);
  - raz s `MONGO_TEST_URL` proti `statsc-mongo`: 9 z 9, vrátane strán relácií článku na `stats_doc_time`;
  - raz s `REDIS_TEST_URL` proti `statsc-redis`: `collabStatsMembership.test.ts` 26 z 26.
  - Kontajnery `statsc-*` sú zmazané.

## 4. Odchýlky od návrhu

1. **Kurzor**. Návrh (§10.6.1) mal jeden dotaz s `$or` troch prípadov, explain na skutočnom Mongu ale ukázal
   `FETCH > SORT > OR > IXSCAN, IXSCAN` (blokujúci SORT, 101 prečítaných na 51 vrátených).
   - Ďalšia strana je preto **2–3 dotazy po sebe**, každý rozsah indexu, kým nie je `limit + 1`:
     1. zvyšok začiatku (`startedAt` = s0, `_id` < id0, triedenie `{ _id: -1 }`);
     2. zvyšok kľúča (`k` = k0, `startedAt` < s0, `{ startedAt: -1, _id: -1 }`);
     3. nižšie kľúče (`k` < k0, celé triedenie).
   - Pri `sort=startedAt` sú to len kroky 1 a 2.
   - V triedení každého kroku nie sú kľúče, ktoré podmienka fixuje: inak Mongo pri rovnosti radí v pamäti (SORT)
     namiesto `SORT_MERGE`.
   - Prvá strana je jeden dotaz. Navonok sa nemení nič, kurzor je ten istý (k, začiatok, id).
2. **Počítadlá žiadostí, moderovania a zámkov v súhrne nie sú**: `collab_daily` ich nemá, sú len v detaile relácie
   (`counters`, `locksAcquired`/`locksRefused`). Pridať ich by znamenalo zmeniť finalizér a denný dokument.
3. **`partialDays`**: deň bez dokumentu, s `incomplete` > 0 alebo `dropped` > 0.
   - Deň, v ktorom zber začal, sa rozpoznať nedá, chýba záznam o štarte zberu.
   - Deň bez jediného otvorenia článku je tiež „bez dokumentu".
4. **`people.overCap`**: pole navyše. Ukazuje, že niektorý deň mal ľudí alebo dvojice nad stropom v `other`.
5. **`prepareCollabStatsCollections()` z cesty dashboardu**: raz za proces vytvorí kolekcie a indexy, ak ešte nie sú.
   Je to zápis (na primári), ale len prvýkrát.
6. **Vypnuté štatistiky majú prednosť pred validáciou**: aj zlý dotaz dostane 503 `disabled`.
7. **Stará odpoveď pri výpadku**: v cache ostáva, kým ju nevytlačí 200 novších kľúčov. Jej vek ukazuje `generatedAt`,
   osobitný príznak nie je.
8. **Strop 6 výpočtov súhrnu** platí na pod pre všetky kľúče súhrnu spolu. Kľúče sú 2 na entitu (7 a 30 dní) s TTL 60
   s, takže strop sa uplatní len pri zlyhávajúcich výpočtoch (Mongo dole), pri bežnej prevádzke nie.
9. **Bajty strany** (§10.13/2): položka zoznamu má ~300 B JSON, strana 50 položiek ~15 KB. Projekcia vynecháva
   `participants`, Mongo ich však číta, `FETCH` číta celé dokumenty. Merané nie je.
10. **Brány C 10.13/1 a /3** (dáta 10×, 20 paralelných cez core-cms) nebežali, sú mimo tejto úlohy.

## 5. Opravy po posudkoch (`posudky/STATS-C-opus.md`, `posudky/stats-krizom-codex.md` body 1 a 3)

Necommitnuté nad 39f546c (vetva so zlúčeným `next`).

1. **M1 / Codex 1**: kurzor s dátumom v tvare ISO, ale neplatným (mesiac 13, hodina 25), vracia 400. Pred porovnaním
   s `toISOString()` sa kontroluje `Number.isNaN(Date.parse(s))`.
   - Vonkajší handler (`collabStatsRequest.ts`) má `catch`: chyba kódu dá 500 `{ "detail": "The collaboration stats
     failed." }`, ak ešte nič neodišlo, s tlmeným `warn`. Vždy uvoľní miesto v semafore.
   - „Never rejects" teda platí.
2. **Codex 3**: tlmené logy už nepíšu `info` za každú chybu. Používajú existujúci `useDampedWarning`: prvá chyba
   `warn` (Sentry), ďalšie do 15 min sa len počítajú (log len na úrovni debug, v produkcii vypnutej). Ďalší `warn` po
   15 min nesie `failuresSinceWarning`.
3. **L1**: krok 1 kurzora (zvyšok jeho začiatku) beží len vtedy, keď je začiatok kurzora v období. Kurzor zo strany
   pred polnocou alebo vymyslený nevráti reláciu pred `from`.
4. **L3**: chýbajúca relácia (`CollabStatsSessionNotFoundError`, napríklad po 30 dňoch) dá 404, stará cache ju
   nenahradí. Ostatné chyby ju nahrádzajú ďalej.
5. **L4**: živé a história majú každá svoje okno tlmenia, chyby kódu (500) tretie.
6. **L6**: `people` je pod tým istým limitom 6 výpočtov za minútu ako `summary`, spoločne (`dailyComputations`).
7. **L7**: príklad kurzora v §1.4 je nepriehľadný zástupný text a klient ho neskladá. Pribudol aj kód 500 v §1.1.

**Známe, neopravené (rozhodol vedúci)**:

- **L2**: pri plnej cache (200 kľúčov) môže kľúč vypadnúť, kým sa počíta. Jeho starý výsledok potom prepíše nový
  prebiehajúci záznam a vznikne jeden dotaz navyše. Je to zriedkavé a bez vplyvu na správnosť.
- **L5**: cache je obmedzená počtom kľúčov, nie bajtmi. Reálna relácia v detaile má ~2 KB, strana zoznamu ~15 KB.
  Najhorší prípad (50-členné relácie) je nerealistický.

**Testy** (`collabStatsHistory.test.ts` +6, `collabStatsLive.test.ts` upravený):

- kurzor s mesiacom 13 a hodinou 25 → 400;
- chyba kódu → 500 a ďalšia požiadavka prejde;
- tlmenie histórie (`warn`, počet medzi nimi, žiadne `info`) a živých (žiadne `info`);
- kurzor pred obdobím → prázdna strana bez kroku 1;
- relácia zmazaná po načítaní do cache → 404;
- súhrn a ľudia spolu 6× za minútu, 7. → 429.

Kontroly sú v správe vedúcemu.

## 6. Návrh správy commitu

```
feat: the history of the collaboration stats for 7 or 30 days behind SYS_API_TOKEN: the days summed up with the partial ones, the users and pairs who collaborated most, the sessions filtered by peak users and category and sorted by start, duration or joint active minutes, or those of one user or of one article across its versions by the docId its moderator's client sends at the start (collabStatsDocId, kept by the session the first time, never in the room's data, also in live/rooms), 50 a page by a cursor read range by range on their named indexes, and the detail of a session; every query with a hint, a time limit, a projection and a limit on a secondary, never an aggregation, cached 60 s or 30 s with a single flight and the last answer kept while MongoDB is down, at most 6 summaries computed a minute, the 4 requests at once shared with the live endpoints, 503 disabled while the stats are off
```

## 7. História len za 7 dní, retencia 8 dní (rozhodnutie vlastníka)

Necommitnuté nad bc5cdf1.

- **`days`** prijme len `7` (`The days are 7.`, inak 400) pre súhrn, ľudí aj zoznam. Typ `CollabStatsHistoryDays`
  je `7`, denné dotazy majú `limit(7)` (počet dní obdobia) namiesto 31.
- **Retencia**: `collabStatsRetentionSeconds` je 8 dní (691 200 s) namiesto 30. Platí pre TTL `collab_sessions`
  (`stats_ttl`), `collab_daily` (`stats_daily_ttl`) a `collab_daily_users` (`stats_daily_users_ttl`).
  - 7 dní histórie (dnes a 6 dní dozadu) má tak relácie aj dni celé.
  - Markery `collab_stats_finalized` (8 dní) a ostatné TTL sa nezmenili.
- **Existujúce indexy sa nemigrujú**: v produkcii štatistiky ešte nebežali.
  - Tam, kde už index s 30 dňami je (devel, stage), `prepareCollabStatsCollections()` pri `IndexOptionsConflict`
    len zapíše `warn` („An index of the collaboration stats differs from its schema; the existing one stays.") a
    nechá starý index s 30 dňami.
  - Breaker to neotvorí, zápisy idú ďalej, dáta sa len držia 30 dní.
  - Nový TTL tam treba nastaviť ručne (`collMod` s `expireAfterSeconds: 691200`) alebo index zmazať, aby ho
    finalizér vytvoril znova.
- **Changelog `collab-stats.md`**: 7 dní, „all kept 8 days" a dva body
  „**Requires:** `COLLAB_STATS_ENABLED=true` to collect the sessions" a
  „**Requires:** a MongoDB replica set (the finalizer writes in transactions)" podľa vzoru `heap-room-lock-retry.md`.
- **Testy**:
  - `collabStatsHistory.test.ts`: `days=30` vracia 400 pre súhrn, ľudí aj zoznam a denné dotazy majú `limit: 7`;
  - limit 6 výpočtov za minútu striedavo `summary` a `people` za 7 dní;
  - testy cache a strážcov idú najprv za 5-minútovú cache ľudí;
  - test 30 dní je preč;
  - `collabStatsMongo.test.ts`: TTL 691 200 s;
  - `collabStatsHistoryMongo.test.ts`: dotazy za 7 dní (relácie človeka a článku od začiatku týždňa, súhrn 7 dní).

## 8. Priame volanie z admin-cms, bez proxy v core-cms (rozhodnutie vlastníka)

Necommitnuté nad 3e79449. Kontrakt je v §1.1, §1.7 a v tabuľke chýb.

- **`collabStatsRequest.ts`** dostane celý `IncomingMessage`. Na každú odpoveď štatistík najprv nastaví CORS, ak
  origin vyhovuje `COLLABORATION_SERVER_CORS`: `Allow-Origin`, `Allow-Credentials: true`, `Expose-Headers:
  Retry-After`; `Vary: Origin` vždy.
  - `OPTIONS` dá 204 (pre povolený origin s `Allow-Methods: GET`, `Allow-Headers` podľa požiadavky a `Max-Age: 600`).
  - Potom `verifyCookie` (`util/authorization.ts`, ten istý ako socket.io a Hocuspocus): bez cookie alebo so zlým JWT
    401.
  - Používateľ mimo `COLLAB_STATS_USER_IDS` dostane 403. Až potom nasleduje semafor, cache a ostatné bez zmeny.
- **`onRequestHook.ts`**: `GET` a `OPTIONS` na `/api/sys/v1/collab-stats/` idú do štatistík bez `SYS_API_TOKEN`.
  `room-data` a `tiptap-schema` ho majú ďalej.
- **`config.ts`**: `collabStatsUserIds` z `COLLAB_STATS_USER_IDS`, celé čísla oddelené čiarkou, iné časti sa
  vynechajú.
  - Bez premennej platí predvolene zoznam super adminov core-cms (`defaultCollabStatsUserIds`), výslovne prázdna =
    nikto.
  - `.env.dist` má ten istý zoznam.
  - `configuration.yaml` premennú **nemá**: token bez premennej v skupine by nebol číslo, takže by platilo „nikto"
    namiesto predvoleného zoznamu. DevOps ju pridá, až keď sa bude zoznam meniť.
- **Kde endpointy bežia**: na serveri Hocuspocus (port 3006, `onRequest`), nginx podu ho dáva na `/` (socket.io na
  `/ws`). admin-cms pozná adresu ako `envConfig.collab.hocuspocusUrl` a zmení `ws`/`wss` na `http`/`https`.
- **Changelog `collab-stats.md`**: požiadavka `COLLAB_STATS_USER_IDS` a bod o cookies, allow liste a CORS; „behind
  `SYS_API_TOKEN`" je preč.
- **Testy**:
  - nový `test/support/statsAuth.ts` (RSA kľúč testov, cookies `anz_jp`/`anz_js`, aj token podpísaný iným kľúčom);
  - `collabStatsLive.test.ts`:
    - 401 bez cookie, so sys tokenom, s cudzím podpisom a s polovicou tokenu;
    - 403 mimo zoznamu aj pri prázdnom zozname;
    - 200 pre používateľa zo zoznamu;
    - CORS pre povolený origin aj na chybe, nič pre iný origin;
    - preflight 204 s hlavičkami len pre povolený origin;
  - `collabStatsHistory.test.ts`: 401 a 403 bez Monga;
  - `config.test.ts`: parsovanie `COLLAB_STATS_USER_IDS` (bez premennej zoznam super adminov, prázdna `[]`).
- **Známe**:
  - Iný origin (alebo požiadavka bez originu, napríklad z iného servera) môže `GET` s cookies stále poslať, len odpoveď
    nedostane prehliadač. Endpointy nič nemenia, takže ju collaboration neodmieta.
  - Admin-cms bez `credentials: 'include'` dostane 401.

## 9. Po posudku priameho prístupu (Opus: cesta, L3–L7)

Necommitnuté nad 6493731 (zoznam super adminov ako predvolený `COLLAB_STATS_USER_IDS` je už v ňom).

- **Cesta**: `/api/sys/v1/collab-stats/*` → **`/api/adm/v1/collab-stats/*`** (`collabStatsPath`), testy aj
  `request/collab-stats.http`.
  - Súbor `.http` posiela `Origin` a cookies `anz_jp`/`anz_js` namiesto `Bearer {{apiSysToken}}`.
  - Premenné `adminOrigin`, `anzJp` a `anzJs` sú v `http-client.env.json`, prázdne okrem lokálneho originu.
- **L3**: `answer()` posiela `Cache-Control: no-store`.
- **L5**: `GET` bez povoleného `Origin` (chýba alebo nevyhovuje `COLLABORATION_SERVER_CORS`) dostane 403 ešte pred
  cookies a semaforom. `OPTIONS` sa nemení.
- **L6**: pri vytvorení obsluhy štatistík, teda pri štarte servera, príde `warn` („COLLAB_STATS_USER_IDS lets nobody
  read the collaboration stats, or has parts that are no id.") s počtom id a zahodenými časťami.
  - Prichádza, ak je zoznam prázdny alebo sa z neho niečo zahodilo.
  - `config.ts` drží zahodené časti v `collabStatsUserIdsDropped`.
- **L7**: test vypršaného tokenu (`exp` v roku 2000) → 401.
- **Kontrakt §1.7**: 401 aj 403 znamenajú „nemáš prístup".
- **Changelog**: cesty `adm` a požiadavka, aby ingress verejnej adresy collaboration prepustil
  `/api/adm/v1/collab-stats/*`.
- **Testy**:
  - `collabStatsLive.test.ts`:
    - vypršaný token;
    - bez originu a s cudzím originom 403 aj bez cookie;
    - `no-store`;
    - `warn` pri štarte;
    - cudzí origin 403;
  - `collabStatsHistory.test.ts`: origin v požiadavkách;
  - `config.test.ts`: zahodené časti.
- **Bezpečnosť: same-site a celý origin** (doplnenie vedúceho po overení produkcie):
  - `allowOrigin` pustí len `Sec-Fetch-Site` `same-site` alebo `same-origin` a celý `Origin` vyhovujúci
    `^(?:COLLABORATION_SERVER_CORS)$`. Inak je to 403 a CORS hlavičky nie sú.
  - Platí len pre štatistiky: socket.io (`collaboration.ts`) a Hocuspocus (`onUpgradeHook.ts`) majú v `next` regex
    bez kotiev ďalej. O nich rozhodne vlastník.
  - Testy:
    - `cross-site` a chýbajúci `Sec-Fetch-Site` dajú 403 bez CORS, `same-origin` 200;
    - pri `COLLABORATION_SERVER_CORS` bez kotiev (`http://admin-cms.sme.localhost`) dá origin
      `http://admin-cms.sme.localhost.evil` 403 bez CORS a presný origin 200;
    - preflight so `same-site`.

