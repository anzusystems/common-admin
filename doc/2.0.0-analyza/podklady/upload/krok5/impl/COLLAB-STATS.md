# COLLAB-STATS: štatistiky používania kolaboračného servera (analýza a návrh)

Otázka vlastníka: koľko sa kolaborácia reálne používa; koľko ľudí býva v miestnosti (dvaja a viac); ideálne za obdobie
(„za 24 h / 7 dní 25 spoluprác, väčšina pár sekúnd, jedna 10 ľudí 2 hodiny"); aspoň živý stav („teraz 5 zamknutých
článkov s 1 človekom, 0 s 2+"); najlepšie história, ale server nemá databázu určenú na takéto dáta.

Rozsah: len analýza a návrh, nič sa neimplementovalo ani nespúšťalo (beží meranie výkonu). Server
`/home/volar/projects/petit/collaboration`, vetva `next`, pracovný strom (ESM, Hocuspocus 4.7.1, socket.io 4.8.4 s
`@socket.io/redis-streams-adapter` 0.3.1, `@sentry/node` 11.8.0, mongoose 9). Klient admin-cms a common-admin
(`src/domains/collab`). Zdroje: zdrojáky a `node_modules`, k8s manifesty, skupina premenných Azure DevOps
`collaboration-production` (`az pipelines variable-group list`, bez tajných hodnôt), repozitár `getsentry/self-hosted` na
tagu 26.7.2 (`gh api`), docs Sentry cez ctx7. Cesty bez prefixu sú v repozitári collaboration, riadky z pracovného stromu.
**Overené** = čítané v kóde, konfigurácii alebo docs; **odvodené** = môj záver, nemeraný a neskúšaný.

## 1. Čo máme dnes

### 1.1 Produkcia (overené v skupine premenných `collaboration-production`)

- 2 repliky (`HPA_APP_MIN_REPLICA_COUNT=2`, `HPA_APP_MAX_REPLICA_COUNT=2`), `ALLOW_MULTIPLE_COLLAB_SERVER_INSTANCES=true`:
  socket.io cez redis-streams adaptér (`src/server/collaboration.ts:37-45`), Hocuspocus cez Redis extension
  (`src/server/hocuspocus.ts:22-24`). Pred oboma nginx v tom istom pode: `/` → Hocuspocus 3006, `/ws` → socket.io 3007
  (`docker/app/kubernetes/etc/nginx/conf.d/proxy.conf.template:22-48`).
- Redis DB 7, prefix `collab:`, `REDIS_DATA_TTL=86400`. `APP_ENV_PREFIX` v skupine ani v pipeline nie je (odvodené:
  prázdny, kolekcia je teda `documents`).
- Mongo: MongoDB Atlas (`mongodb+srv`, `*.mongodb.net`), DB `collaboration`.
- `LOG_LEVEL=debug` (pozri bod 7.1), Sentry self-hosted `https://sentrymonitor.smeonline.sk/`,
  `SENTRY_TRACES_SAMPLE_RATE=1.0`. Verziu Sentry 26.7.2 beriem zo zadania (na inštancii neoverené).
- `JOIN_REQUEST_WAITING_SECONDS=60`, `TAKE_MODERATION_REQUEST_WAITING_SECONDS=60`.
- Logy: winston Console (`src/logger/appLogger.ts:93-104`) → supervisor do `var/log/node_server.log`, 10 MB, 1 záloha
  (`docker/app/kubernetes/etc/supervisor/conf.d/node-server.conf:7-9`) → sidecar `node-server-log` ho tailuje na stdout
  kontajnera (`docker/kubernetes/app-deployment.yaml:136-149`). Kam ide stdout ďalej, z repozitárov nevidno.

### 1.2 Miestnosti a kto ich používa (overené v admin-cms a common-admin)

Názov je `systém:entita:id` (common-admin `src/domains/collab/composables/collabHelpers.ts:12-14`).

- `cms:article:<id>`: editácia článku, `joinStrategy: moderated`, `editors: ['bodyEditor']`
  (admin-cms `src/domains/cms/article/composables/articleEditCollab.ts:25`, `:62`). Prvý v miestnosti je moderátor,
  ďalší dostane `occupied` a musí požiadať o vstup. **Toto je „zamknutý článok".** Telo v spolupráci ide cez Hocuspocus
  dokument `cms:article:<id>:bodyEditor`, len keď je stav `active` (admin-cms
  `src/domains/system/composables/collab/hocuspocus.ts:6-11`,
  `src/domains/cms/article/components/bodyEditor/ArticleBodyEditor.vue:96-99`).
- `cms:scenarioJob:<id>`: `free`, `allowedSameUser` (`articleScenarioJobCollab.ts:34`, `:55`).
- `cms:box:<id>`: distribution management, `free`, `allowedSameUser`; stránka vstupuje do každého boxu zvlášť
  (`distributionManagement/composables/distributionManagementCollab.ts:75-76`, `boxCollabRoom.ts:79`, `:204`). Odvodené:
  veľa miestností a udalostí na jedno zobrazenie stránky.
- `cms:inbox:<id>`: whiteboard (`distributionManagement/components/InboxWhiteboardBox.vue:85`, `:290`).
- `<room>:info`: odber stavu bez členstva, detail článku (`article/components/ArticleDetailView.vue:98`, `:129`); zoznamy
  sa pýtajú `fetchRoomsInfo` (`shared/components/CollabRoomInfo.vue:25`).
- Stav `active` = viac ako 1 rôzny používateľ, pri `allowedSameUser` už 1 (`src/manager/roomUserManager.ts:56-60`).
  Klient berie zámky polí len v `active` (common-admin `src/domains/collab/composables/collabField.ts:142`).

### 1.3 Kde miestnosť začína a končí, kde sa mení členstvo (overené)

„Zámok" = Redlock `lock:room:<room>` (`src/util/helper/exectionLockHelper.ts:25-47`), ktorý serializuje akcie miestnosti
naprieč podmi. „n po zmene" = či má miesto po zmene v ruke `RoomInfoServer` s `userIds` (rôzni používatelia).

| Udalosť | Miesto | Pod zámkom | n po zmene | Log dnes |
|---|---|---|---|---|
| Pripojenie socketu (nie miestnosť) | `server/event/listener/connectionListener.ts:24-63`, JWT `server/middleware/authorizationMiddleware.ts` | – | – | info `User id "N" connected!` (`:26`) |
| Heartbeat aktivity | `connectionListener.ts:28-42` → `util/helper/userRoomActivityHelper.ts:9` (SETEX 60 s pri pongu) | nie | – | len chyba |
| Vstup | `joinCollabRoomListener.ts:25-33`, akcia `:69-125`; prázdna miestnosť → `purgeCollabStorage` `:77-79`; `joinUserSocket` `:108` → `roomUserManager.ts:91-109` (prvý = moderátor `:104-106`); odpoveď Ok `:119-122` | áno | áno (`roomInfoServer` z `:108`) | žiadny (len debug zámku `exectionLockHelper.ts:31`, `:35`, `:41`) |
| Odmietnutie „obsadené" | `joinCollabRoomListener.ts:82-90` | áno | nezmenené | žiadny |
| Začiatok spolupráce (ďalší do moderovanej s 1 človekom) | `joinCollabRoomListener.ts:93-100`: zmaže Hocuspocus dokumenty (`manager/roomDataManager.ts:43-45`), vyžiada dáta od moderátora (`roomUserManager.ts:249-277`) | áno | áno | info `Collaboration started.` {room} (`:98`) |
| Nahradenie socketu toho istého používateľa | `joinCollabRoomListener.ts:103-105` → `roomUserManager.ts:151-201` | áno | nemení sa | len chyba |
| Neúspešný vstup, vrátenie | `joinCollabRoomListener.ts:138-188`, nový stav `:172-174` | áno | áno (`fetchInfo(gone)`) | error `:127` |
| Odchod | `leaveCollabRoomListener.ts:13-74`, `leaveUserSocket` `:42` → `roomUserManager.ts:112-149` | áno | áno | žiadny |
| Odpojenie | `disconnectingListener.ts:11-48`, pre každú miestnosť `:16-41`, `leaveUserSocket(socket, false)` `:30` | áno | áno | debug `User id "N" disconnected! (reason: R)` (`:12`) |
| Vyhodenie (kick) | `kickUserFromRoomListener.ts:13-45`, odchod a zámky `:30-33`, `kickedFromRoom` `:37` | áno | áno | len warn pri odmietnutí |
| Vyčistenie (purge) | `purgeRoomListener.ts:9-32`, úložisko `:14`, sockety von `:22-25` | **nie** | potom 0 | info `Purged room` {room} (`:27`) |
| Automatické odovzdanie moderátora | pri odchode `roomUserManager.ts:133-146`, `passOnAbsentModerator` `:217-227` | áno | áno | žiadny |
| Ručné odovzdanie moderovania | `transferModerationListener.ts:13-34`, `switchModerator` `:28` | áno | áno | žiadny pri úspechu |
| Žiadosť o moderovanie | `requestToTakeModerationListener.ts:24-94`, job `:76-80` (delay napevno 60000 `:79`) | áno | – | info `Request to take a moderation.` {room} (`:42`) |
| … schválenie / odmietnutie | `approveRequestToTakeModerationListener.ts:49-51` / `rejectRequestToTakeModerationListener.ts:47-48` | áno | – | info {room, moderatorId} |
| … vykonanie (schválené alebo samo po 60 s) | `bullmq/processor/moderationRequestProcessor.ts:13-27`, `:21` | áno | áno | debug `Job processor started` (`:16`) |
| Žiadosť o vstup | `requestToJoinListener.ts:22-92`, job `:74-78`, moderátorovi `:84` | áno | – | info `Request to join collaboration.` {room}, bez userId (`:40`) |
| … schválenie / odmietnutie | `approveRequestToJoinListener.ts:50-52` / `rejectRequestToJoinListener.ts:49-50` | áno | – | info {room, userId, moderatorId} |
| … vykonanie (schválené alebo samo po 60 s) | `bullmq/processor/joinRequestProcessor.ts:10-11` | nie | – | debug `Job worker executed` (`bullmq/jobWorker.ts:10`) |
| Zámok poľa | `acquireFieldLockListener.ts:19-86` (úspech `:63`), `releaseFieldLockListener.ts` (`:66`, dáta `:82`) | nie (zámok poľa `exectionLockHelper.ts:63-86`) | – | info pri kolízii (`:67`, `:70`), debug pri úspechu (`:79`, `:95-96`) |
| Dáta poľa | `changeFieldDataListener.ts:21-70`, `roomDataManager.ts:47-68` | áno | – | debug `Storing data...` {data, userId} s obsahom (`roomDataManager.ts:48`) |
| Info miestnosť | `subscribeCollabRoomInfoListener.ts:15`, `unsubscribeCollabRoomInfoListener.ts:15`; pri odpojení ju socket.io opustí sám (odvodené) | nie | – | žiadny |
| Hocuspocus spojenie | `onAuthenticate` `server/document/authorizeDocument.ts:10-28` (len so socketom v miestnosti, len na čítanie pre info `:20-23`); načítanie `fetchDocument.ts:13-46`; uloženie `storeDocument.ts:9-19`; hooky `connected`/`onDisconnect` nepoužité, Logger extension vypnutý (`hocuspocus.ts:25-27`, `index.ts:44`) | – | `getConnectionsCount()` len lokálne | žiadny |

Všetky udalosti listenerov sú v `src/server/event/listener/`, registrované v `connectionListener.ts:44-62`.

### 1.4 Čo sa loguje (overené)

Formát je text `čas [app] úroveň: správa {metadata}` (`appLogger.ts:60-90`), nie JSON. Do Sentry ide len `warn` a `error`
(`appLogger.ts:100-102`, `logger/sentryTransport.ts:47-49`), teda zlyhania, nie používanie. V produkcii sa kvôli
`LOG_LEVEL=debug` píše aj debug.

Na štatistiky použiteľné riadky:

- info `User id "N" connected!`: každé pripojenie socketu (odvodené: admin sa pripája pri štarte, teda skôr aktívni
  používatelia adminu než kolaborácia).
- debug `User id "N" disconnected! (reason: R)`.
- info `Collaboration started.` {room}: začiatok spolupráce v moderovanej miestnosti. Zapíše sa aj vtedy, keď do miestnosti
  s 1 človekom príde druhá karta toho istého človeka (podmienka `joinCollabRoomListener.ts:93-99` nekontroluje iného
  používateľa; overené čítaním).
- info `Request to join collaboration.` {room}; `Approved …` / `Rejected request to join collaboration.`
  {room, userId, moderatorId}. Automatické schválenie po 60 s info riadok nemá.
- info `Request to take a moderation.` {room}; `Approved …` / `Rejected request to take moderation.` {room, moderatorId}.
- info `Purged room` {room}; info `Refused a lock held by another user.` {room, field, userId}.
- debug `Acquiring execution lock for <room>`: každá akcia miestnosti, bez druhu akcie a používateľa.

Chýba úspešný vstup, odchod, vyhodenie, odovzdanie moderovania a počet ľudí. Z logov sa teda dá spočítať, koľko
spoluprác sa začalo a koľko bolo žiadostí, nie trvanie ani počet ľudí.

### 1.5 Čo je dnes v Redise a v Mongu (overené kódom; obsah produkcie nevidím)

Redis, prefix `collab:`:

- `collab:<room>:user:<userId>`: prázdny reťazec, TTL 60 s, obnovuje ho každý pong (`userRoomActivityHelper.ts:7-11`,
  `connectionListener.ts:28-42`; predvolený `pingInterval` 25 s, `node_modules/engine.io/build/server.js:42`). Pri odchode a
  vyhodení sa maže (`roomUserManager.ts:125-127`), pri odpojení dobehne TTL (`disconnectingListener.ts:30`). **Je to živý
  zoznam ľudí v miestnostiach s oneskorením do 60 s.**
- `collab:<room>:moderator`: userId, TTL 24 h; existuje, kým je miestnosť obsadená (`roomUserManager.ts:45`, `:75`, mazanie
  `:144-145`, `:224`, `:246`).
- `collab:<room>:options`: TTL 24 h (`manager/roomOptionsManager.ts:11-14`).
- `collab:locks:<room>`, `collab:lockSockets:<room>`, `collab:lockTransfers:<room>`: hash pole → userId alebo socket, TTL
  24 h od posledného zámku (`manager/roomLockManager.ts:18-25`, `:63-70`).
- `collab:data:<room>`: hash pole → JSON s obsahom, TTL 24 h od posledného zápisu (`roomDataManager.ts:13`, `:64-65`).
  Zapisuje sa pri štarte spolupráce a pri zmenách polí, maže pri prvom vstupe do prázdnej miestnosti
  (`joinCollabRoomListener.ts:77-79`).
- `collab:lock:room:<room>[:field:<f>]`: Redlock, sekundy.
- BullMQ fronta `collab` (`bullmq/queue.ts:25-32`): len čakajúce žiadosti, po vykonaní sa mažú
  (`requestToJoinListener.ts:77`). História žiadna.
- Stream adaptéra `collab:collab-<verzia>` (`collaboration.ts:38-44`), `maxLen` 10 000 (predvolené,
  `node_modules/@socket.io/redis-streams-adapter/dist/adapter.js:73`): správy medzi podmi vrátane `collabRoomChanged`.
  Odvodené: okno najviac hodín, binárne kódované, na štatistiky nevhodné.

Mongo `documents` (`mongoose/document.model.ts:10-32`): `{name: "<room>:<field>", data, createdAt, updatedAt}`, TTL 7 dní
od `updatedAt`. Vzniká pri prvom načítaní Hocuspocus dokumentu (`server/document/fetchDocument.ts:35-44`), prepisuje sa pri
ukladaní (`storeDocument.ts:10-18`), maže pri štarte spolupráce (`joinCollabRoomListener.ts:94`). `findOneAndReplace` s
`timestamps` pri každom prepise nastaví `createdAt` aj `updatedAt` na teraz
(`node_modules/mongoose/lib/helpers/update/applyTimestampsToUpdate.js:29-40`), takže oba sú čas posledného uloženia, nie
začiatok.

MySQL je len na čítanie pre validátor, nič o kolaborácii.

### 1.6 Viac inštancií (overené, ak nie je uvedené inak)

- Udalosti jednej miestnosti prichádzajú na ktorýkoľvek pod a ľudia jednej miestnosti môžu byť na rôznych podoch.
  Členstvo, moderátora, žiadosti a odpojenia serializuje `lock:room:<room>`; purge a zámky polí nie.
- Členstvo sa pri každej akcii číta naprieč podmi cez `in(room).fetchSockets()` (`roomUserManager.ts:203-204`), požiadavka
  klastra s timeoutom 5 s (`node_modules/socket.io-adapter/dist/cluster-adapter.js:20`, `:379-385`).
- Len na pode žije `joiningSockets` (`roomUserManager.ts:27`) a Hocuspocus dokumenty (`getDocumentsCount()`,
  `getConnectionsCount()`, `node_modules/@hocuspocus/server/dist/index.d.ts:190-194`).
- Pre štatistiky z toho plynie: počítadlá v pamäti podu sa dajú sčítať, živé počty miestností nie (miestnosť na dvoch
  podoch by sa rátala dvakrát). Hranice relácie (0 → 1 a → 0) treba určovať pod zámkom miestnosti, kde je počet ľudí po
  zmene už v ruke.

## 2. Definície (návrh)

1. **Obsadená miestnosť**: aspoň 1 rôzny používateľ. Pri článku je to „zamknutý článok" (ďalší dostane `occupied`).
2. **Relácia**: od prechodu z 0 na aspoň 1 rôzneho používateľa po prechod späť na 0. Ak sa miestnosť do 60 s (grace) znova
   obsadí, je to tá istá relácia: reload stránky alebo prechod detail → editácia by ju inak rozdelil. Relácia je
   *otvorená*, kým posledný stav je > 0, a *zastaraná*, ak je posledná udalosť staršia ako 24 h a miestnosť je prázdna
   (pád podu, keď sa odpojenia nezapísali); jej koniec je čas poslednej udalosti.
3. *(Nahradené bodom 10.1: skutočná spolupráca sa určuje podľa úprav, nie podľa 30 s spolu.)* **Spolupráca
   (skutočná)**: v relácii boli súčasne aspoň 2 rôzni používatelia aspoň 30 s. Kratšie je **preklik do
   spolupráce**. Rátajú sa používatelia, nie sockety (článok dve karty toho istého aj tak nedovolí, `allowedSameUser`
   nie je zapnuté). Pole `status` miestnosti sa na to nehodí: pri `allowedSameUser` je `active` už s 1 človekom a prvému
   v miestnosti sa voľby zmažú (bod 7.2).
4. **Trvanie relácie** = koniec − začiatok. **Čas spolupráce** = súčet intervalov s aspoň 2 ľuďmi. **Najviac súčasne** =
   maximum rôznych ľudí naraz. **Rôzni používatelia** = koľko ľudí sa v relácii vystriedalo. **Priemerne súčasne** = časovo
   vážený priemer počtu ľudí počas spolupráce (odpoveď na „koľko ľudí obvykle").
5. **Preklik (relácia)**: trvanie < 30 s. *(Nahradené bodom 10.1: prahy sa ukladajú pri uzavretí do záznamu a
   denných súčtov, spätná zmena chce prepočet.)* Prahy sú parametre čítania, nie zápisu, takže sa dajú zmeniť aj spätne.
6. **Žiadosti o vstup**: požiadané / schválené / odmietnuté / samo schválené po 60 s (= vykonané − schválené). To isté
   pre žiadosti o moderovanie, plus **ručné odovzdania** a **automatické odovzdania** moderovania (moderátor odišiel).
   **Odmietnutia „obsadené"**: koľkokrát niekto narazil na zamknutý článok. **Vyhodenia** a **vyčistenia**.
7. **Zámky polí** (voliteľné): získané a odmietnuté zámky za reláciu, miera súbehu na poliach.
8. **Živý stav**: v tejto chvíli počet obsadených miestností podľa typu, z toho s 1 a s 2+ ľuďmi, najviac ľudí v jednej
   miestnosti, pripojení ľudia a sockety, odberatelia info miestností a zoznam miestností s 2+ ľuďmi (miestnosť, počet,
   od kedy).

## 3. Kde ukladať: možnosti

1. **Mongo kolekcia relácií `<prefix>collab_sessions`**
   - popis: jeden dokument na reláciu, zapisovaný atomickými operátormi s `upsert`. Pomocník volaný z akcií pod zámkom
     miestnosti dostane počet ľudí po zmene (miesta ho už majú, nič sa nečíta navyše) a zapíše `$min startedAt`,
     `$max lastEventAt` a `peakUsers`, `$inc` počítadiel a `$push` bodu časovej osi `{t, n, e}` so `$sort`. Identitu
     relácie naprieč podmi drží Redis kľúč (bod 6.3). TTL index napríklad 180 dní. Prehľad cez sys endpoint (bod 6.7),
     voliteľne Atlas Charts, ak ho firma na Atlase má (odvodené).
   - prínos: presne to, čo chce vlastník, aj jednotlivé relácie („jedna 10 ľudí 2 h"); Mongo je už pripojené
     (`index.ts:40`), netreba novú infraštruktúru ani DevOps; operátory nezávisia od poradia, takže zápis nemusí čakať a
     nevadí, že udalosti prídu z dvoch podov; prahy sa dajú meniť spätne.
   - riziko: vlastný kód hraníc relácie a pád podu (neukončené relácie, pravidlo „zastaraná"); zápis do Atlasu pri každej
     zmene členstva (bod 6.5); používateľ `collaboration` musí smieť vytvoriť kolekciu a index (odvodené: rola readWrite
     stačí); zmena TTL neskôr vyžaduje `collMod`, mongoose existujúci index s inými voľbami nezmení.
   - veľkosť: M (model, pomocník, asi 10 miest volania, endpoint prehľadu, testy). Dáta odvodené: 0,3–1 KB na reláciu;
     pri 3 000 reláciách článkov denne a 180 dňoch 0,2–0,5 GB.
   - odporúčanie: **áno, hlavná možnosť** (krok 2).

2. **Mongo log udalostí (append-only, variant možnosti 1)**
   - popis: namiesto relácie jeden malý dokument na udalosť `{t, room, e, n}`; relácie sa skladajú až pri čítaní (zoradiť
     podľa `t`, deliť na `n = 0`).
   - prínos: najjednoduchší a najodolnejší zápis (`insertOne`, bez identity relácie, bez Redis kľúča); aj grace sa dá
     zmeniť spätne.
   - riziko: rádovo viac dokumentov; skladanie pri každom čítaní; pri boxoch distribution managementu veľký objem.
   - veľkosť: S–M.
   - odporúčanie: záloha, ak by sa logika relácií v možnosti 1 ukázala krehká.

3. **Prometheus (`prom-client`) + Grafana**
   - popis: `collab_room_events_total{entity,event}`, histogramy pri konci relácie
     (`collab_session_duration_seconds{entity,collab}`, `collab_session_peak_users`), živé gauge miestností počítané pri
     scrape naprieč klastrom (oba pody hlásia to isté, v PromQL `max`, nie `sum`); `/metrics` na samostatnom porte mimo
     nginx.
   - prínos: štandardné grafy a alerty, lacné počítadlá v pamäti.
   - riziko: v repozitároch nič také nie je: žiadne `prom-client`, OpenTelemetry, Elastic APM ani Loki v `package.json`
     projektov v `petit` a `anzusystems`; žiadne `prometheus.io/scrape`, `ServiceMonitor`, `PodMonitor`, grafana, loki,
     fluent ani promtail v ich k8s yaml (overené grepom; `ELASTIC_*` tam je, ale ako vyhľadávanie aplikácií, nie logy).
     Jediný `/metrics` má raven na porte 8081 bez anotácií (`petit/raven/docker/kubernetes/app-deployment.yaml:72-73`);
     či ho niečo zbiera, nevidno. Histogramy nedajú jednotlivé relácie. Koniec relácie treba aj tak určiť ako v 1.
   - veľkosť: S v kóde; L, ak Prometheus v klastri nie je; M, ak je.
   - odporúčanie: len ak DevOps potvrdí bežiaci Prometheus s Grafanou.

4. **Sentry (Application Metrics alebo Logs)**
   - popis: SDK 11.8.0 má `Sentry.metrics.count/gauge/distribution`
     (`node_modules/@sentry/core/build/types/metrics/public-api.d.ts:51-113`) a `Sentry.logger.info` so štruktúrovanými
     atribútmi (`.../logs/public-api.d.ts:92`). Voľba `enableLogs` ani `enableMetrics` v 11.8.0 nie je, posiela sa vždy
     (overené v typoch a `build/esm`; docs: metriky od SDK 10.25, predvolene zapnuté). Pri konci relácie jeden log
     `collab session ended` s atribútmi (entita, trvanie, najviac súčasne, čas spolupráce, počítadlá) a `distribution`;
     živé gauge raz za minútu z jedného podu.
   - prínos: žiadna nová infraštruktúra, Sentry je pripojené (`index.ts:22-37`); Logs dajú jednotlivé relácie s filtrom a
     agregáciou v Explore, plus dashboardy a alerty.
   - riziko: self-hosted 26.7.2 má príznaky `organizations:ourlogs-*` a `organizations:tracemetrics-*` v
     `sentry/sentry.conf.example.py` (riadky 431-448) a dáta ukladá `snuba-eap-items-consumer`, ktorý beží len v profile
     `feature-complete` (`docker-compose.yml:474-480`; predvolené `.env` má `COMPOSE_PROFILES=feature-complete` a
     `SENTRY_EVENT_RETENTION_DAYS=90`), overené v repozitári self-hosted. Či ich má naša inštancia, neviem; odvodené:
     staršia inštalácia povýšená na 26.7.2 si necháva vlastný `sentry.conf.py` a nové príznaky treba dopísať. Ďalej
     retencia asi 90 dní, export len cez API, závislosť na dostupnosti Sentry, a Sentry už teraz dostáva 100 % trás.
   - veľkosť: S v kóde, ak to inštancia vie; M na overenie s DevOps.
   - odporúčanie: **voliteľný doplnok** k 1 na grafy bez vlastného UI, až keď DevOps potvrdí Logs/Metrics na inštancii.

5. **Štruktúrované logy + zber logov**
   - popis: jeden info riadok pri konci relácie a pri začiatku spolupráce s metadátami; grafy robí nástroj na logy.
   - prínos: najmenej kódu, žiadne úložisko v aplikácii.
   - riziko: zber logov z klastra z repozitárov nevidno; lokálne sa log točí po 10 MB s 1 zálohou a pri `LOG_LEVEL=debug`
     (mongoose debug, obsah polí) vydrží odvodene len hodiny; formát nie je JSON (`appLogger.ts:60-90`).
   - veľkosť: S v kóde; L, ak zber logov nie je.
   - odporúčanie: riadok pri konci relácie pridať v kroku 2 ako vedľajší produkt; ako hlavné úložisko nie, kým DevOps
     nepotvrdí zber a retenciu.

6. **Iba Redis**
   - popis: (a) živý stav bez ukladania, čítaný z `fetchSockets` alebo z kľúčov aktivity (bod 4); (b) voliteľne denné
     súhrny `HINCRBY collab:stats:day:<dátum> …` a sorted set najdlhších spoluprác s TTL 90 dní.
   - prínos: (a) nič sa nezapisuje, nulové riziko pre výkon, vlastník má „aspoň živý stav" hneď; (b) lacné.
   - riziko: (a) žiadna história; (b) Redis tu slúži ako TTL úložisko stavu miestností, jeho perzistencia a zdieľanie
     inštancie sú neznáme (odvodené) a súhrny sa po zmene definícií nedajú prepočítať.
   - veľkosť: (a) S, (b) S–M.
   - odporúčanie: **(a) áno, ako prvý krok**; (b) nie, na históriu je lepšie Mongo.

### Odporúčanie a kroky

- **Krok 0** (bez kódu, dnes): dotazy z bodu 5: živý stav z Redisu, posledných ≤ 24 h z `collab:data:*`, posledných 7
  dní z Mongo `documents`.
- **Krok 1** (S, minimálny prvý krok): `GET /api/sys/v1/collab-stats/live` (bod 4), len čítanie, nič v horúcich cestách.
- **Krok 2** (M): relácie v Mongu (možnosť 1), endpoint prehľadu za obdobie (bod 6.7), riadok logu pri konci relácie.
  Zapínané premennou a najprv zmerané A/B v prebiehajúcom meraní výkonu.
- **Krok 3** (voliteľný): grafy cez Sentry Logs/Metrics, Atlas Charts alebo stránku v admin-cms nad endpointom.

## 4. Živý endpoint

*Nahradené bodom 10.9.1 (rozhodnutie 9). Snímok ide cez `serverSideEmitWithAck` len s `{room, userId, joinedAt}`, nie
cez `fetchSockets()`. Endpoint chráni existujúci `SYS_API_TOKEN` (kanál core-cms ako pri `room-data`). Pribudol semafor
s 429. Text nižšie je pôvodný návrh.*

### 4.1 Ako naprieč inštanciami

- **A) `collabServer.fetchSockets()` bez miestnosti** (odporúčané): vráti sockety oboch podov s `rooms` a `data.user.id`
  (`node_modules/socket.io/dist/broadcast-operator.js:387-389`). Zoskupiť podľa miestnosti, vynechať izbu socketu
  (`room === socket.id`) a `<room>:info` spočítať zvlášť ako odberateľov. Presné, ten istý mechanizmus ako `fetchInfo`.
  Cena: jedna požiadavka klastra; odpoveď nesie `handshake` každého socketu vrátane hlavičiek s cookies (robí to už každý
  `fetchInfo`), odvodené stovky KB pri stovkách socketov. Na vyžiadanie v poriadku, na časté dopytovanie nie. Keď druhý
  pod neodpovie do 5 s, adaptér hodí chybu, endpoint vráti 503.
- **B) Redis `SCAN MATCH collab:*:user:*`** (kľúče aktivity) a `collab:*:moderator`: bez komunikácie medzi podmi, lacné;
  oneskorenie do 60 s po odpojení, nevie o socketoch ani o info odberoch. Ako záložný režim `?source=redis` a pre krok 0.
- Pre miestnosti s 2+ ľuďmi doplniť v jednom pipeline `HLEN collab:locks:<room>`; po kroku 2 aj začiatok relácie.
- Hocuspocus počty sú len z podu, ktorý odpovedá: uviesť s názvom podu (`config.hostname`, `src/config/config.ts:99`).

### 4.2 Ochrana

- Ako `room-data`: `Authorization: Bearer <SYS_API_TOKEN>` (`server/document/onRequestHook.ts:56-60`), metóda GET, nová
  vetva pred 404 (`:93-96`). Cez nginx `location /` je endpoint dostupný zvonka (`proxy.conf.template:22-34`), token je
  jediná ochrana.
- `SYS_API_TOKEN` je token core-cms (`docker/kubernetes/configuration.yaml:47`): vlastník ho musí mať, aby endpoint volal.
  Samostatný token vlastník zamietol, zostáva `SYS_API_TOKEN` (10.9.1). Porovnávať cez `crypto.timingSafeEqual`, dnes je
  to `!==`.
- V predvolenej odpovedi bez ID používateľov; ID článkov nie sú osobné údaje.

### 4.3 Tvar odpovede

```json
{
  "generatedAt": "2026-10-21T09:30:00.000Z",
  "source": "fetchSockets",
  "instances": 2,
  "connected": { "sockets": 143, "users": 61 },
  "rooms": {
    "article": { "occupied": 5, "oneUser": 5, "twoPlus": 0, "maxUsers": 1, "infoSubscribers": 12 },
    "box": { "occupied": 40, "oneUser": 31, "twoPlus": 9, "maxUsers": 4, "infoSubscribers": 0 },
    "scenarioJob": { "occupied": 3, "oneUser": 3, "twoPlus": 0, "maxUsers": 1, "infoSubscribers": 0 },
    "inbox": { "occupied": 1, "oneUser": 1, "twoPlus": 0, "maxUsers": 1, "infoSubscribers": 0 }
  },
  "collaborations": [
    { "room": "cms:article:123", "users": 3, "sockets": 3, "lockedFields": 2, "sessionStartedAt": null }
  ],
  "hocuspocus": { "pod": "collaboration-7d9f-abc12", "documents": 1, "connections": 3 }
}
```

`instances` z `adapter.serverCount()`; `sessionStartedAt` je `null`, kým nie je krok 2. Čísla sú ilustračné.

## 5. Historické dáta teraz

Bez prístupu do produkcie len opis, čo má vlastník (alebo DevOps) pozrieť. Všetko len čítanie.

1. **Redis** (DB 7; `--scan` používa SCAN, Redis neblokuje ako `KEYS`):
   - živý stav článkov: `redis-cli -n 7 --scan --pattern 'collab:cms:article:*:user:*' | awk -F: '{print $4}' | sort | uniq -c`
     → riadok na článok s počtom ľudí aktívnych za posledných ≤ 60 s; 1 = zamknutý s 1 človekom, 2+ = spolupráca.
   - obsadené články: `redis-cli -n 7 --scan --pattern 'collab:cms:article:*:moderator' | wc -l`.
   - posledných ≤ 24 h: `redis-cli -n 7 --scan --pattern 'collab:data:cms:article:*'` a pre každý kľúč `TTL`; posledný zápis
     = teraz − (86400 − TTL). Odvodené: dáta sa zapisujú len pri spolupráci (štart spolupráce, polia v stave `active`), teda
     počet článkov so spoluprácou za ≤ 24 h. Je to dolná hranica: prvý vstup do prázdnej miestnosti dáta zmaže.
2. **Mongo** (Atlas, DB `collaboration`, stačí používateľ len na čítanie):
   - `db.documents.find({ name: /^cms:article:/ }, { name: 1, updatedAt: 1 }).sort({ updatedAt: -1 })` → články, ktorých
     telo bolo otvorené v spolupráci, s časom posledného uloženia, za 7 dní (TTL).
   - podľa dní: `db.documents.aggregate([{ $match: { name: /^cms:article:/ } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }])`.
   - obmedzenia: jeden článok je jeden dokument (opakované spolupráce sa zlejú, deň je deň posledného uloženia); o
     trvaní a počte ľudí nič. Oprava (overené v c8d96a2): človek len v info miestnosti Hocuspocus spojenie nedostane.
     `authorizeDocument.ts:16` číta len sockety miestnosti, nie `:info`, takže vetva len na čítanie `:20-23` sa
     nespustí, a test `test/hocuspocus.test.ts:139-146` odmietnutie čaká. Dokument teda vzniká len pri členoch
     miestnosti.
     Názov kolekcie `documents` platí pri prázdnom `APP_ENV_PREFIX` (odvodené).
3. **Logy**: ak klaster posiela stdout do nástroja na logy (otázka na DevOps aj s retenciou): počty `Collaboration started.`
   za deň a rôznych `room` (začaté spolupráce článkov, mierne nadhodnotené, bod 1.4), `Request to join collaboration.`,
   `Approved …`, `Rejected …` (žiadosti), rôzne `N` v `User id "N" connected!` za deň (aktívni používatelia adminu). Bez
   takého nástroja `kubectl logs -l app=<deployment> -c node-server-log --since=24h --prefix | grep -c 'Collaboration started.'`;
   odvodené: kubelet drží len desiatky MB na kontajner, pri debug úrovni to sú hodiny.
4. **Sentry**: len warn a error (zlyhania). Odvodené: trasy zachytia HTTP požiadavky (napríklad `room-data` z core-cms), nie
   socket.io udalosti, ktoré inštrumentáciu nemajú. Na štatistiky nepoužiteľné.
5. **Nedá sa zrekonštruovať**: trvanie relácií, počet ľudí v čase, preklikov ani kto s kým. Vstup a odchod sa s počtom ľudí
   nikde nezapisuje.

## 6. Náčrt implementácie (na neskôr)

### 6.1 Pomocník

`src/manager/collabStatsManager.ts`, `useCollabStats(room).record(event, { n, userId, at, reason })`: názov miestnosti
rozloží na entitu, filtruje podľa `COLLAB_STATS_ENTITIES`, Redis časť (bod 6.3) urobí pod zámkom miestnosti a Mongo
`updateOne` pošle bez čakania. Nikdy nehádže do listenera. Model `src/mongoose/collabSession.model.ts` podľa
`document.model.ts`.

### 6.2 Miesta volania

| Udalosť | Miesto | n / poznámka |
|---|---|---|
| vstup Ok | `joinCollabRoomListener.ts:117-122` | `roomInfoServer.userIds.length` z `:108`; či bola miestnosť prázdna, zapamätať pri `:73-79` (premenná sa na `:108` prepíše) |
| obsadené | `joinCollabRoomListener.ts:87` | počítadlo `occupied` |
| začiatok spolupráce | `joinCollabRoomListener.ts:97-98` | počítadlo `collabStarts` |
| vrátenie neúspešného vstupu | `joinCollabRoomListener.ts:172-174` | n z `fetchInfo(gone)` |
| odchod | `leaveCollabRoomListener.ts:42-44` | `roomInfoServer.userIds.length` |
| odpojenie | `disconnectingListener.ts:30-32` | `roomInfo.userIds.length`, `reason` |
| vyhodenie | `kickUserFromRoomListener.ts:30-37` | `roomInfo.userIds.length`, či sám seba |
| vyčistenie | `purgeRoomListener.ts:22-27` | n = 0, zmazať kľúč relácie (nie je pod zámkom) |
| ručné odovzdanie | `transferModerationListener.ts:28` | počítadlo |
| automatické odovzdanie | `roomUserManager.ts:141`, `:220` | počítadlo |
| žiadosť o vstup | `requestToJoinListener.ts:74-86`; `approveRequestToJoinListener.ts:50`; `rejectRequestToJoinListener.ts:49`; `bullmq/processor/joinRequestProcessor.ts:10-11` | počítadlá; vykonanie nie je pod zámkom, `$inc` to nevadí |
| žiadosť o moderovanie | `requestToTakeModerationListener.ts:76-86`; `approveRequestToTakeModerationListener.ts:49`; `rejectRequestToTakeModerationListener.ts:47`; `moderationRequestProcessor.ts:21` | počítadlá |
| zámky polí (voliteľné) | `acquireFieldLockListener.ts:63`, `:67` | počítadlá v pamäti, odoslané s ďalšou udalosťou alebo raz za minútu |
| Hocuspocus (voliteľné) | `hocuspocus.ts:29-35`, hooky `connected` a `onDisconnect` (`requestParameters.get('roomName')`) | počítadlo spojení |
| endpointy | `onRequestHook.ts`, nové vetvy pred `:93` | live a prehľad |

### 6.3 Identita relácie a grace

- Udalosť s n ≥ 1 (pod zámkom): pipeline `SET collab:<room>:stats:session <nové ObjectId> NX EX 604800`, `GET`,
  `EXPIRE … 604800`; vrátená hodnota je id relácie.
- n = 0: `EXPIRE … 60` (grace). Nové obsadenie do 60 s pokračuje v tej istej relácii, neskôr kľúč nie je a vznikne nová.
- Prvý vstup do prázdnej miestnosti, keď kľúč existuje s TTL > 60 s (predchádzajúca relácia sa nikdy nedostala na 0, pád
  podu): prepísať novým id.
- Purge: `DEL` (výslovný koniec).
- Udalosť bez zmeny členstva: len `GET`; bez kľúča sa preskočí.

### 6.4 Tvar záznamu

Prvý náčrt; presný tvar, indexy a zápisy sú v bode 9.1 a nahrádzajú ho.

```js
{
  _id: ObjectId('…'),            // id relácie z Redis kľúča
  room: 'cms:article:123',
  entity: 'article',             // $setOnInsert
  startedAt: ISODate('…'),       // $min
  lastEventAt: ISODate('…'),     // $max
  peakUsers: 3,                  // $max
  distinctUsers: 3,              // $max (SCARD, bod 6.6)
  timeline: [                    // $push { $each, $sort: { t: 1 }, $slice: -100 }
    { t: ISODate('…'), n: 1, e: 'join' },
    { t: ISODate('…'), n: 2, e: 'join' },
    { t: ISODate('…'), n: 1, e: 'disconnect' },
    { t: ISODate('…'), n: 0, e: 'leave' }
  ],
  counters: {                    // $inc
    joins: 2, leaves: 1, disconnects: 1, kicks: 0, purges: 0, occupied: 4, collabStarts: 1,
    joinRequested: 1, joinApproved: 1, joinRejected: 0, joinExecuted: 1,
    moderationRequested: 0, moderationApproved: 0, moderationRejected: 0, moderationExecuted: 0,
    transfers: 0, moderatorPassedOn: 0, locksAcquired: 14, locksRefused: 1
  },
  pods: ['collaboration-7d9f-abc12'], // $addToSet config.hostname
  version: '2.0.0'               // $setOnInsert APP_VERSION
}
// indexy: { startedAt: -1 }, { room: 1, startedAt: -1 }, TTL { lastEventAt: 1 } s expireAfterSeconds = retencia
```

Do časovej osi idú len zmeny členstva (n = rôzni používatelia po zmene); ostatné udalosti len počítadlá a `lastEventAt`.
Trvanie, čas spolupráce, preklik, otvorená a zastaraná sa počítajú pri čítaní zo zoradenej osi.

### 6.5 Cena na udalosť

*Nahradené bodom 10.10.*

- Redis: jeden pipeline (2–3 príkazy, jedna cesta) s čakaním vnútri zámku, aby sa `SET NX` a `EXPIRE` dvoch udalostí
  neprehodili. Odvodené: pod 1 ms v tej istej sieti.
- Mongo: jeden `updateOne` po zámku bez čakania. Model so `bufferCommands: false` alebo kontrola `readyState === 1`, aby sa
  pri výpadku Monga nehromadili čakajúce operácie; chyby na úrovni debug alebo info s obmedzením počtu, nie warn (ten ide
  do Sentry).
- Nie v horúcich cestách: pong, `changeFieldData`, Hocuspocus správy. Zámky polí len ako počítadlá v pamäti.
- Odvodené: zmeny členstva článkov sú v špičke rádovo jednotky za sekundu; voči `fetchSockets`, ktorý každá akcia už robí,
  zanedbateľné. Boxy distribution managementu udalosti násobia, preto filter entít. Overiť A/B v meraní výkonu s
  `COLLAB_STATS_ENABLED` zapnutým a vypnutým.

### 6.6 Súkromie

*Nahradené bodmi 8 (DPO schválil skutočné `userId`) a 10.8.*

- ID používateľov CMS sú osobné údaje zamestnancov (pseudonymné, s core-cms identifikujú ľudí); štatistika „kto s kým"
  je sledovanie práce a patrí k rozhodnutiu vlastníka, prípadne zodpovednej osoby za ochranu údajov.
- Návrh: v Mongu len počty. Množinu ľudí otvorenej relácie držať v Redise (`SADD collab:<room>:stats:users <id>` s TTL
  kľúča relácie) a do Monga zapisovať len `distinctUsers` (`$max` so `SCARD`). Ak vlastník chce ID, `$addToSet users`.
- Nový riadok logu bez obsahu polí; živý endpoint bez ID používateľov.

### 6.7 Endpoint prehľadu

`GET /api/sys/v1/collab-stats/summary?from=…&to=…&entity=article&clickThroughS=30&collabMinS=30`, ochrana ako v 4.2,
`find` podľa `startedAt` a súčet v Node (rádovo tisíce dokumentov).

```json
{
  "from": "2026-10-14T00:00:00.000Z",
  "to": "2026-10-21T00:00:00.000Z",
  "entity": "article",
  "thresholds": { "clickThroughS": 30, "collabMinS": 30, "graceS": 60 },
  "sessions": { "total": 2140, "clickThrough": 610, "durationS": { "p50": 95, "p90": 1500, "max": 30100 }, "open": 4, "stale": 1 },
  "collaborations": {
    "total": 25,
    "real": 7,
    "clickThrough": 18,
    "peakUsers": { "2": 20, "3-5": 4, "6+": 1 },
    "avgConcurrentUsers": 2.4,
    "collabDurationS": { "<30s": 18, "30s-5m": 3, "5m-30m": 2, "30m-2h": 1, ">2h": 1 },
    "longest": [
      { "room": "cms:article:123", "startedAt": "2026-10-17T08:02:11.000Z", "durationS": 7810, "collabS": 7200, "peakUsers": 10, "distinctUsers": 11 }
    ]
  },
  "requests": {
    "join": { "requested": 40, "approved": 30, "rejected": 5, "autoApproved": 5 },
    "moderation": { "requested": 9, "approved": 6, "rejected": 1, "autoApplied": 2 },
    "transfers": 7,
    "moderatorPassedOn": 12
  },
  "occupiedRefusals": 52,
  "kicks": 3,
  "purges": 0,
  "locks": { "acquired": 812, "refused": 9 }
}
```

Čísla sú ilustračné. Vetu vlastníka z toho dostane priamo: „za 7 dní 25 spoluprác, 18 kratších ako 30 s, najdlhšia
2 h 10 min s 10 ľuďmi naraz".

### 6.8 Testy

Vitest so zamockovaným Redisom a Mongom ako v `test/collaboration.test.ts` a `test/onRequestHook.test.ts`:

1. Čistá funkcia nad časovou osou (trvanie, čas spolupráce, najviac súčasne, preklik, otvorená a zastaraná): 1 človek
   krátko; 2 ľudia 10 s (preklik spolupráce); 10 ľudí 2 h; os v náhodnom poradí; pád podu bez `n = 0`.
2. `record`: správny Redis pipeline podľa n (n ≥ 1, n = 0, purge, prvý vstup po páde), `updateOne` len s operátormi
   nezávislými od poradia a s `upsert`; chyba Monga nehádže a nelogije na warn.
3. Listenery: vstup, obsadené, odchod, odpojenie, kick, purge, odovzdanie a žiadosti volajú `record` so správnou udalosťou
   a n; zlyhaný `record` nezmení odpoveď klientovi.
4. Live endpoint: 401 bez tokenu; zoskupenie zo zamockovaného `fetchSockets` (izba socketu, `:info`, ten istý človek v
   dvoch socketoch = 1); 503 pri timeoute adaptéra.
5. Endpoint prehľadu: súčty nad zamockovaným `find`, kontrola `from`, `to`, `entity`.
6. Výkon: A/B v prebiehajúcom meraní so zapnutými a vypnutými štatistikami.

### 6.9 Konfigurácia

*Nahradené bodom 10 (retencia 30 dní, len články v1, `COLLAB_STATS_SYSTEM_FIELDS` v 10.2.1, token `SYS_API_TOKEN` a kanál core-cms v
10.9.1).*

`COLLAB_STATS_ENABLED` (predvolene vypnuté, kým sa nezmeria), `COLLAB_STATS_ENTITIES` (predvolene `article`),
`COLLAB_STATS_RETENTION_DAYS` (180), `COLLAB_STATS_GRACE_SECONDS` (60). `config.ts` vyžaduje každú hodnotu
(`checkIfAllVariablesAreDefined`, `src/config/config.ts:121-136`), takže nové premenné potrebujú predvolenú hodnotu
(`?? '…'` ako `envPrefix` na `:82`) alebo záznam v configmape, vo všetkých skupinách premenných, v `.env.dist` a v
`vitest.config.mts`. Prahy čítania sú parametre endpointu.

## 7. Vedľajšie zistenia

1. **`LOG_LEVEL=debug` v produkcii** (overené v skupine premenných): zapína `mongoose.set('debug', true)`
   (`src/storage/mongodb.ts:14`, každý dotaz do konzoly vrátane base64 tela), `Storing data...` s obsahom polí
   (`roomDataManager.ts:48`) a debug pri každom zámku. Odvodené: zbytočné CPU a objem logov, ktoré môžu skresliť
   prebiehajúce meranie výkonu, a obsah článkov v logoch. Overiť, či je to zámer.
2. **Prvý vstup do prázdnej miestnosti zapíše voľby a hneď ich zmaže** (`joinCollabRoomListener.ts:72`, potom `:77-79` →
   `roomUserManager.ts:245-247`); `fetchInfo` potom berie predvolené voľby (`allowedSameUser: false`,
   `src/factory/roomOptionsFactory.ts:3-8`), takže miestnosť s `allowedSameUser` a jedným človekom hlási `inactive`, kým
   nepríde ďalší vstup. Overené čítaním, aj v HEAD; dopad na klienta neoverený. **Opravené v c8d96a2**: po vyčistení sa
   voľby zapíšu znova (`joinCollabRoomListener.ts:78-80` v c8d96a2).
3. **`purgeRoom` nekontroluje moderátora a nebeží pod zámkom miestnosti** (`purgeRoomListener.ts:9-32`): ktokoľvek s
   platným JWT vyčistí ľubovoľnú miestnosť. Overené čítaním. **Opravené v c8d96a2**: len zo socketu v miestnosti alebo
   v jej info miestnosti a pod zámkom miestnosti (`purgeRoomListener.ts:15-24` v c8d96a2).
4. Job žiadosti o moderovanie má `delay: 60000` napevno (`requestToTakeModerationListener.ts:79`);
   `TAKE_MODERATION_REQUEST_WAITING_SECONDS` mení len kontrolu `:65-74`. V produkcii je 60, dnes bez dopadu.

## 8. Čo musí rozhodnúť vlastník

Rozhodnuté vlastníkom (2026-10-21): Mongo `collab_sessions`, **retencia 30 dní** (každá relácia zostáva samostatným
záznamom), najprv články, prahy preklik < 30 s, spolupráca ≥ 30 s s 2+ ľuďmi, grace 60 s; najprv živý stav, potom relácie;
implementácia až po commite ESM. Štatistiky vidí **len super admin** (rola `ROLE_SUPER_ADMIN`), bez nového práva
`cms_collabStats_*`. Otvorené zostávajú otázky 7 a 8 v číslovanom zozname na konci tohto bodu; prístup (otázka 6) rieši bod 9.3.

Nové požiadavky vlastníka (2026-10-22), rozpracované v bode 10, ktorý v rozpore nahrádza bod 9:

- Relácie s 2+ ľuďmi sledujú každého účastníka: či niečo zmenil (telo, polia), zámky, prvá a posledná úprava a
  aktívne minúty. Skutočná spolupráca sa určuje podľa úprav, nie podľa času spolu (definícia v 10.1).
- Relácie s 1 človekom: len denný súhrn na entitu, žiadny záznam relácie.
- Robustnosť: štatistiky nesmú zložiť Mongo a nepridajú kolaborácii závislosť na Mongu (zúžené rozhodnutím 1 nižšie;
  10.6 a 10.7).
- Účastníci relácií s 2+ ľuďmi sa ukladajú so skutočným `userId`, bez príznaku a bez anonymného variantu (10.8).

Rozhodnutia vlastníka po posudkoch (2026-10-22; posudky `posudky/STATS-PLAN-opus.md` a `posudky/stats-plan-codex.md`),
zapracované priamo v bode 10:

1. **Mongo dole**: záruka je len „štatistiky nepridajú závislosť na Mongu a nikdy neblokujú kolaboráciu". Existujúce
   závislosti (štart, načítanie tela, `removeEditorsData` pri štarte spolupráce) sú mimo rozsahu a sú samostatným
   rozhodnutím vlastníka (10.7, test 10.13/5).
2. **Exactly-once**: jedna Mongo transakcia na dávku finalizéra (markery vrátane sólo s TTL 2 dni, vloženie relácií,
   `$inc` denných a ľudí); až potom `DEL` a `ZREM` v Redise. Redis mutex na beh. Bez `dailyDone` a E11000 (10.4.4).
3. **Telo**: úpravy v `onChange` s originom spojenia, po aplikovaní a len pri zmene dokumentu; `beforeSync` odpadá
   (10.2, 10.3).
4. **Polia**: `changeFieldData` aj uvoľnenie s dátami len pri hodnote odlišnej od uloženej v Redise. Porovnanie je pred
   `mayStore()`. Len na serveri, bez príznaku `changed` a bez zmeny v common-admin; bez kľúčov `embed:*`; ozvena
   `alternateLinks` nie je úprava (10.2.1).
5. **Členstvo**: Lua dostane celé `userIds` a zosúladí všetkých účastníkov (pri odchode nikoho nezakladá); kontrola
   živosti zosúladí aj obsadené miestnosti; finalizér zavrie otvorené prítomnosti k `endedAt`. Rozdelenie pri rolling
   deployi je prijaté, nasadzuje sa, keď nikto neupravuje (10.4).
6. **Aktívny čas**: len počet aktívnych minút, bez `idleMs` a bez ms odvodených z minút (10.1, 10.5.1).
7. **Indexy a stránkovanie**: `_id` na konci každého indexu, kurzor `(k, startedAt, _id)`, s `userId` len
   `sort=startedAt`, `hint` podľa mena indexu (10.5.1, 10.6).
8. **Finalizér**: vlastná BullMQ rada, Redis mutex, preskórovanie `pending`, `removeOnComplete` a `removeOnFail` (10.4.4).
9. **Bezpečnosť** (aj pre časť A). Upravené rozhodnutím vlastníka 2026-10-22 **„znovu použiť existujúcu komunikáciu s
   core-cms"**:
   - štatistiky idú tým istým kanálom ako `room-data`, teda existujúcim klientom core-cms `anzu_collaboration` so
     `SYS_API_TOKEN`; kontrola super admina je len v core-cms;
   - odpadá vlastný token `COLLAB_STATS_API_TOKEN`, nové tajomstvo v Azure, hlavička s id super admina, prístupový log
     na ňu viazaný a interný port 8081 (s nimi aj kroky pre DevOps);
   - zostáva semafor na pod s 429, tlmené logy a živý snímok cez `serverSideEmitWithAck` len s
     `{room, userId, joinedAt}` (10.9.1).
10. **Brány**: kritériá 10.13/4 (perf on a off) a /5 (Mongo dole) strážia B1 a B2 a pribudne perf scenár rotácie
    členstva v článkových miestnostiach. B1 a B2 idú do produkcie spolu (10.12, 10.13). Pri overení sa k B presunuli
    aj kritériá /6 (spojenie) a /7 (stropy), lebo ich kód ide s B1 a B2.
11. **Zjednodušenie v1** (10.5.1, 10.5.2, 10.6.2):
    - bez awareness, `bodyBytes`, `bodySyncs`, `saves`, `systemFieldChanges`, `startSnapshotFields` a
      `fieldReleasesUnknown`;
    - TTL presne 30 dní a označenie neúplného dňa;
    - debug mongoose vypnutý na štatistickom spojení;
    - riadky z `d211edd`/`756a13e`;
    - `collab_daily` (aj `byPeakUsers`) a `collab_daily_users` zostávajú, zapisované v transakcii.

Otvorené po revízii: základ hodnôt polí pri štarte spolupráce (10.2.1). Bez neho sa prvé prepísanie poľa v relácii
nezaráta; oprava je v admin-cms (S).

1. Úložisko: Mongo; `collab_sessions` len pre relácie s 2+ ľuďmi, `collab_daily` pre súhrny (10.5).
2. **ID používateľov: rozhodnuté, DPO schválil (vlastník, 22. 10.).** Každý účastník relácie s 2+ ľuďmi má v zázname
   `userId`. Dashboard ukáže, kto upravoval, kto spolupracuje najviac a kto s kým; mená doplní core-cms. Retencia
   zostáva 30 dní a prístup len super admin. Sólo relácie zostávajú denným súhrnom bez záznamu relácie a bez
   rozmeru na používateľa (10.5.2).
3. Retencia: 30 dní (rozhodnuté).
4. Rozsah: len články, alebo aj boxy, inbox a scenarioJob (objem pri boxoch).
5. Prahy: preklik < 30 s, grace 60 s (rozhodnuté). Účastník „upravil" pri aspoň 1 úprave tela alebo 1 úprave poľa
   (rozhodnuté po posudkoch B2, pôvodne 3 úpravy tela). Na potvrdenie (10.1): úpravy dvoch účastníkov sú „spoločné",
   ak sú od seba najviac 5 min, slot aktivity má 60 s.
6. Prístup: stránka v admin-cms cez core-cms, ktorá volá collaboration existujúcim klientom `anzu_collaboration` so
   `SYS_API_TOKEN` (rozhodnuté, rozhodnutie 9 vyššie).
7. Otázky na DevOps: zber logov z klastra a jeho retencia; Prometheus a Grafana; profil `feature-complete` a príznaky
   `ourlogs` a `tracemetrics` v `sentry.conf.py` našej inštancie; prístup k Redisu a Mongu na krok 0.
8. `LOG_LEVEL=debug` v produkcii: zámer, alebo vrátiť na `info`?

## 9. Dashboard v admin-cms

Zadanie: presne ako dáta ukladať a ako ich čítať na dashboarde v admin-cms. Platia rozhodnutia z bodu 8. Zdroje navyše:
core-cms (`/home/volar/projects/petit/core-cms`, vrátane `vendor/anzusystems/{auth,common}-bundle`), admin-cms,
common-admin, skupiny premenných `core-cms-production` a `admin-cms-production` (`az`, bez tajných hodnôt). Nič sa
nespúšťalo.

**Pozor (2026-10-22): bod 10 nahrádza 9.1 (zápis), 9.2 (čítanie) a 9.5 (veľkosti).** Neplatí už najmä toto: Mongo
zápis pri každej udalosti, os v Mongu, záznam pre každú reláciu a agregácia nad všetkými reláciami. Platí 9.3 (API cez
core-cms, len super admin) a 9.4 (stránka, menu, guard, Highcharts, polling) s doplnkami z 10.9.

### 9.1 Ukladanie presne

*Nahradené bodmi 10.4–10.5. Ponechané kvôli histórii návrhu; platí z toho len grace kľúč (9.1.3), prevzatý do
10.4.1. Finalizér, kontrolu živosti a pád podu z 9.1.4 nahrádzajú 10.4.3 a 10.4.4.*

#### 9.1.1 Typ a schéma (`src/mongoose/collabSession.model.ts`, v štýle `document.model.ts`)

```ts
import mongoose, { Model, Schema, Types } from 'mongoose'
import { useConfig } from '../config/config.js'

export type CollabSessionEvent = 'join' | 'joinRollback' | 'leave' | 'disconnect' | 'kick' | 'purge'
export type CollabSessionEndReason = 'empty' | 'purge' | 'stale'

export interface ICollabSessionPoint {
  t: Date
  n: number // rôzni používatelia po zmene
  e: CollabSessionEvent
}

export interface ICollabSessionCounters {
  joins: number
  leaves: number
  disconnects: number
  kicks: number
  purges: number
  occupied: number
  collabStarts: number
  joinRequested: number
  joinApproved: number
  joinRejected: number
  joinExecuted: number
  moderationRequested: number
  moderationApproved: number
  moderationRejected: number
  moderationExecuted: number
  transfers: number
  moderatorPassedOn: number
  locksAcquired: number
  locksRefused: number
}

export interface ICollabSession {
  _id: Types.ObjectId // id relácie, vygenerované v Node a držané v Redise (9.1.3)
  room: string // cms:article:123
  entity: string // article
  entityId: string // 123
  startedAt: Date
  lastEventAt: Date
  peakUsers: number
  distinctUsers: number // len počet, ID zostávajú v Redise počas relácie (bod 6.6)
  timeline: ICollabSessionPoint[]
  counters: Partial<ICollabSessionCounters>
  pods: string[]
  version: string
  final: boolean
  // Dopočíta finalizér (9.1.4):
  endedAt?: Date
  endReason?: CollabSessionEndReason
  durationMs?: number
  collabMs?: number // čas s 2+ ľuďmi
  collabUsersMs?: number // ∫ n dt počas 2+, priemer = collabUsersMs / collabMs
  firstCollabAt?: Date
  timelineTruncated?: boolean // viac ako 100 zmien, collabMs je dolný odhad
}

const PointSchema = new Schema<ICollabSessionPoint>(
  {
    t: { type: Date, required: true },
    n: { type: Number, required: true },
    e: { type: String, required: true },
  },
  { _id: false }
)

const countersDefinition = Object.fromEntries(
  ['joins', 'leaves', 'disconnects', 'kicks', 'purges', 'occupied', 'collabStarts', 'joinRequested', 'joinApproved',
    'joinRejected', 'joinExecuted', 'moderationRequested', 'moderationApproved', 'moderationRejected',
    'moderationExecuted', 'transfers', 'moderatorPassedOn', 'locksAcquired', 'locksRefused'].map((name) => [name, Number])
)

// Bez `default` na poliach, ktoré menia operátory: upsert so setDefaultsOnInsert by ich dal do $setOnInsert vedľa $max.
const CollabSessionSchema: Schema = new Schema<ICollabSession>(
  {
    room: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    startedAt: { type: Date, required: true },
    lastEventAt: { type: Date, required: true },
    peakUsers: Number,
    distinctUsers: Number,
    timeline: [PointSchema],
    counters: new Schema(countersDefinition, { _id: false }),
    pods: [String],
    version: String,
    final: { type: Boolean, required: true },
    endedAt: Date,
    endReason: String,
    durationMs: Number,
    collabMs: Number,
    collabUsersMs: Number,
    firstCollabAt: Date,
    timelineTruncated: Boolean,
  },
  // Pri výpadku Monga sa zápisy nehromadia v pamäti, padnú hneď.
  { versionKey: false, bufferCommands: false }
)

// Dashboard: rozsah obdobia pre entitu.
CollabSessionSchema.index({ entity: 1, startedAt: -1 })
// Finalizér a otvorené relácie v živom stave; len neuzavreté, teda malý.
CollabSessionSchema.index({ final: 1, lastEventAt: 1 }, { partialFilterExpression: { final: false } })
// TTL: 30 dní od začiatku relácie.
CollabSessionSchema.index({ startedAt: 1 }, { expireAfterSeconds: 2_592_000 })

type ICollabSessionModel = Model<ICollabSession>

let collabSessionModel: ICollabSessionModel | null = null

export function useCollabSessionModel(): ICollabSessionModel {
  if (collabSessionModel) {
    return collabSessionModel
  }
  const { envPrefix } = useConfig()

  collabSessionModel = mongoose.model<ICollabSession, ICollabSessionModel>(
    'CollabSession',
    CollabSessionSchema,
    `${envPrefix}collab_sessions`
  )

  return collabSessionModel
}
```

Overené: vzor modelu, TTL indexu a názvu kolekcie s `envPrefix` (`src/mongoose/document.model.ts:10-55`), mongoose 9.11.2.
Odvodené: že `partialFilterExpression: { final: false }` a schéma `bufferCommands` fungujú, ako píšem (štandardné voľby
MongoDB a mongoose, nevyskúšané). Odhad veľkosti (odvodené): bežná relácia s 2 bodmi osi ~0,4 KB, bod osi ~40 B,
relácia so 100 bodmi (strop, 9.1.2) ~4,5 KB. Pri 500–5 000 reláciách článkov denne je to za 30 dní 15–150 tis. záznamov,
teda 6–60 MB dát a jednotky až ~15 MB indexov. Pri ID používateľov (bod 8.2) pribudne pár bajtov na človeka a reláciu.

#### 9.1.2 Kto čo zapisuje

Spoločný tvar každého zápisu (pomocník `useCollabStats(room)`, `src/manager/collabStatsManager.ts`), s `at` = čas
udalosti a `sessionId` z 9.1.3:

```js
CollabSession.updateOne(
  { _id: sessionId },
  {
    $setOnInsert: { room, entity, entityId, version, final: false },
    $min: { startedAt: at },
    $max: { lastEventAt: at /* + pri zmene členstva: */, peakUsers: n, distinctUsers: scard },
    $inc: { 'counters.<počítadlo>': 1 },
    // len pri zmene členstva:
    $push: { timeline: { $each: [{ t: at, n, e }], $sort: { t: 1 }, $slice: -100 } },
    $addToSet: { pods: hostname },
  },
  { upsert: true, setDefaultsOnInsert: false }
) // bez await, .catch → logger.info s obmedzením
```

Všetky operátory sú nezávislé od poradia ($min, $max, $inc, $addToSet, $push so $sort), takže nevadí, že zápisy dvoch podov
alebo dva zápisy bez čakania prídu do Monga prehodené. `$slice: -100` drží na osi posledných 100 bodov (zmien
členstva). Začiatok relácie drží `$min startedAt`, špičku `$max peakUsers`, takže trvanie a najviac súčasne sú presné
vždy. Pri relácii s viac ako 100 zmenami (odvodené: zriedkavé, 10 ľudí s pár reloadmi dá 40–80 bodov) chýbajú najstaršie
body, takže `collabMs`, `collabUsersMs` a `firstCollabAt` sú len dolný odhad. Finalizér to pozná (súčet `joins`,
`leaves`, `disconnects`, `kicks` a `purges` je väčší ako dĺžka osi) a zapíše `timelineTruncated: true`, aby to dashboard
mohol označiť.

| Miesto | Udalosť | Redis (pod zámkom miestnosti, ak je) | Mongo navyše k spoločnému tvaru |
|---|---|---|---|
| `joinCollabRoomListener.ts:117-122` (Ok) | `join`, n = `roomInfoServer.userIds.length` z `:108` | skript 9.1.3 s `firstJoin` = miestnosť bola prázdna (zapamätať pri `:73-79`) a `userId` | `$inc counters.joins`; ak v tej istej akcii prebehol štart `:97-98`, aj `counters.collabStarts`; `$push` bod; `$max peakUsers, distinctUsers` |
| `joinCollabRoomListener.ts:87` | obsadené | `GET` id | `$inc counters.occupied` |
| `joinCollabRoomListener.ts:172-174` | `joinRollback`, n z `fetchInfo(gone)` | n ≥ 1 skript, n = 0 `EXPIRE` grace | `$push` bod |
| `leaveCollabRoomListener.ts:42-44` | `leave` | n ≥ 1 `GET`+`EXPIRE`, n = 0 `EXPIRE S 60`, `EXPIRE U 60` | `$inc counters.leaves`, `$push` |
| `disconnectingListener.ts:30-32` | `disconnect` | ako leave | `$inc counters.disconnects`, `$push` |
| `kickUserFromRoomListener.ts:30-37` | `kick` | ako leave | `$inc counters.kicks`, `$push` |
| `purgeRoomListener.ts:22-27` | `purge`, n = 0 (bez zámku) | `GET` id, potom `DEL S`, `DEL U` | `$inc counters.purges`, `$push {n: 0, e: 'purge'}` |
| `transferModerationListener.ts:28` | ručné odovzdanie | `GET` | `$inc counters.transfers` |
| `roomUserManager.ts:141`, `:220` | automatické odovzdanie | `GET` | `$inc counters.moderatorPassedOn` |
| `requestToJoinListener.ts:74-86` / `approveRequestToJoinListener.ts:50` / `rejectRequestToJoinListener.ts:49` / `bullmq/processor/joinRequestProcessor.ts:10-11` | žiadosť o vstup / schválená / odmietnutá / vykonaná | `GET` (vykonanie nie je pod zámkom, `$inc` to nevadí) | `$inc counters.joinRequested` / `joinApproved` / `joinRejected` / `joinExecuted` |
| `requestToTakeModerationListener.ts:76-86` / `approveRequestToTakeModerationListener.ts:49` / `rejectRequestToTakeModerationListener.ts:47` / `bullmq/processor/moderationRequestProcessor.ts:21` | žiadosť o moderovanie / … / vykonaná | `GET` | `$inc counters.moderationRequested` / `…Approved` / `…Rejected` / `…Executed` |
| `acquireFieldLockListener.ts:63` / `:67` | zámok získaný / odmietnutý | nič pri udalosti | počítadlá v pamäti podu `Map<room, {acquired, refused}>`, raz za 60 s jeden `$inc counters.locksAcquired/locksRefused` na miestnosť (`GET` id pri odoslaní) |
| finalizér (9.1.4) | uzavretie | `GET` | `updateOne({ _id, final: false }, { $set: { final: true, endedAt, endReason, durationMs, collabMs, collabUsersMs, timelineTruncated, firstCollabAt } })` |

Do osi idú len zmeny členstva; ostatné len počítadlá a `$max lastEventAt`. Redis časť sa čaká vnútri zámku (poradie `SET`
a `EXPIRE` dvoch udalostí sa nesmie prehodiť), Mongo nie. Overené: miesta a dostupnosť n (bod 1.3). Odvodené: zvyšok
je návrh.

#### 9.1.3 Otvorenie a zatvorenie relácie naprieč 2 podmi a reloadmi (Redis grace kľúč)

Kľúče (s prefixom `collab:` z ioredis, `src/storage/redis.ts:12`): `S = collab:<room>:stats:session` (id relácie) a
`U = collab:stats:users:<id>` (množina ID ľudí relácie, kvôli `distinctUsers`).

Pri udalosti s n ≥ 1 pod zámkom miestnosti jeden Lua skript (jedna cesta, atomický; ioredis `defineCommand`):

```lua
-- KEYS[1] = S; ARGV: 1 nové id, 2 TTL 604800, 3 firstJoin '1'|'0', 4 grace 60, 5 prefix kľúča U, 6 userId alebo ''
local id = redis.call('GET', KEYS[1])
if id and ARGV[3] == '1' and redis.call('TTL', KEYS[1]) > tonumber(ARGV[4]) then
  id = false -- prázdna miestnosť, ale relácia nikdy neklesla na 0: pád podu, začína nová
end
if not id then
  id = ARGV[1]
  redis.call('SET', KEYS[1], id, 'EX', ARGV[2])
else
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
local users = ARGV[5] .. id
if ARGV[6] ~= '' then redis.call('SADD', users, ARGV[6]) end
redis.call('EXPIRE', users, ARGV[2])
return { id, redis.call('SCARD', users) }
```

Kľúč U sa skladá v skripte, preto prefix ide ako argument: ioredis `keyPrefix` pridáva len ku `KEYS` (odvodené zo
správania ioredis, neskúšané). Pri n = 0: `EXPIRE S 60` a `EXPIRE U 60`.

Priebeh (odvodené z kódu ciest):

1. A otvorí článok (pod 1): prvý vstup, kľúč nie je → nové id S1, `SADD`, Mongo vytvorí S1 s bodom (t0, 1, join).
2. B požiada o vstup, A schváli (počítadlá), B vstúpi cez pod 2: zámok miestnosti serializuje s podom 1, skript nájde
   S1 → bod (t1, 2, join), `collabStarts` +1, `peakUsers` 2, `distinctUsers` 2.
3. B dá reload: starý socket sa odpojí (n = 1), nový vstúpi (n = 2), stále S1. Ak nový príde skôr, nahradí starý
   (`roomUserManager.ts:151-201`) a n sa nezmení.
4. A aj B odídu → n = 0 → `EXPIRE S 60`.
5. A sa do 60 s vráti: prvý vstup, kľúč ešte žije s TTL ≤ 60 → pokračuje S1 (`EXPIRE` späť na 7 dní).
6. Nikto do 60 s: kľúč zmizne, nasledujúci vstup založí S2; S1 uzavrie finalizér.

Zatvorenie teda neurčuje udalosť, ale vypršanie grace kľúča; Mongo dokument sa uzavrie až vo finalizéri.

Pozor pri nasadení (overené kódom, dopad odvodený): stream adaptéra je `collab-<verzia>` (`collaboration.ts:38`), takže
pri rolling update (`maxSurge 100%`) staré a nové pody navzájom nevidia sockety. Počas prekryvu je n podhodnotené a
relácie sa môžu rozdeliť; to isté dnes platí pre samotné členstvo.

#### 9.1.4 Finalizér a pád podu

Finalizér: opakovaný BullMQ job v existujúcej fronte `collab` (`jobQueue.upsertJobScheduler('collabStatsFinalize',
{ every: 60_000 }, { name: 'collabStatsFinalize' })` pri štarte, `bullmq/queue.ts:25-32`; obsluha v `bullmq/jobWorker.ts:15-20`).
BullMQ ho spustí raz naprieč podmi; worker beží na každom pode (`index.ts:45`), takže pri páde jedného ho prevezme druhý.
Overené: `upsertJobScheduler` je v nainštalovanom BullMQ 5.81.5 (`node_modules/bullmq/dist/esm/classes/queue.d.ts:202`).

Beh (každých 60 s):

1. `find({ final: false, lastEventAt: { $lt: now − 60 s } }).limit(500)` (index `{final, lastEventAt}`).
2. Pre každú reláciu `GET S` jej miestnosti:
   - kľúč ≠ id (grace vypršala, alebo nová relácia po páde, alebo stratený Redis): uzavrieť. Z osi zoradenej podľa `t`:
     `endedAt` = `t` posledného bodu s n = 0, ak je posledný bod n = 0, inak `lastEventAt`; `durationMs` = `endedAt −
     startedAt`; `collabMs` = súčet intervalov medzi susednými bodmi, kde n ≥ 2; `collabUsersMs` = súčet n × interval
     pre n ≥ 2; `firstCollabAt`; `endReason` = `purge`, ak posledný bod je purge, `empty` pri n = 0, inak `stale`.
     Interval n = 0 v rámci grace sa ráta do trvania, nie do spolupráce.
   - kľúč = id, posledný bod n = 0: beží grace, preskočiť.
   - kľúč = id, posledný bod n > 0: dlhá relácia alebo pád. Raz za 5 min jeden `collabServer.fetchSockets()` (množina
     obsadených miestností naprieč podmi); ak miestnosť obsadená nie je a `lastEventAt` je staršie ako 2 min: `DEL S`,
     `DEL U` a v ďalšom behu sa uzavrie ako `stale`. Obsadená miestnosť (článok otvorený hodiny) zostane otvorená, správne.

Pád podu (odvodené z kódu): sockety padnutého podu zmiznú bez `disconnecting`, bod n = 0 sa nezapíše a S zostane s TTL
7 dní. Adaptér druhého podu ich prestane vidieť po heartbeat timeoute 10 s
(`node_modules/socket.io-adapter/dist/cluster-adapter.js:473-478`). Ak sa ľudia pripoja späť a miestnosť bola celá na
padnutom pode, ich vstup je prvý a skript s TTL > grace založí novú reláciu; starú finalizér uzavrie ako `stale` s koncom
`lastEventAt` (podhodnotený o čas od poslednej udalosti po pád). Ak sa nikto nevráti, uzavrie ju kontrola cez
`fetchSockets`. Pri riadenom vypnutí podu (`index.ts:51`, `collabServer.close()`) sa `disconnecting` spustí, ale Redis a
Mongo sa zatvárajú súbežne, takže zápisy môžu chýbať; dôsledok je rovnaký ako pri páde. Dashboard ukáže počet
`stale` relácií zvlášť, aby bolo vidieť, koľko čísel je odhad.

### 9.2 Čítanie

*Nahradené bodom 10.6: súhrny sa čítajú z `collab_daily`, agregácia ide len nad reláciami s 2+ ľuďmi.*

Prahy idú do pipeline ako parametre (`clickMs` = 30 000, `collabMinMs` = 30 000). Obdobie `[from, to)` podľa
`startedAt`: relácia cez hranicu patrí do obdobia, v ktorom začala. Predvoľby: 24 h (po hodinách), 7 d a 30 d (po dňoch),
vlastné (po dňoch, najviac 30 dní a nie skôr ako pred 30 dňami, starší záznam už TTL zmazal). Časová zóna `Europe/Bratislava`.

#### 9.2.1 Súhrn, histogramy a top N (jedna agregácia s `$facet`)

```js
db.collab_sessions.aggregate([
  { $match: { entity: 'article', startedAt: { $gte: from, $lt: to }, final: true } },
  { $project: { timeline: 0 } },
  { $facet: {
    totals: [{ $group: {
      _id: null,
      sessions: { $sum: 1 },
      clickThroughs: { $sum: { $cond: [{ $lt: ['$durationMs', clickMs] }, 1, 0] } },
      withTwoPlus: { $sum: { $cond: [{ $gte: ['$peakUsers', 2] }, 1, 0] } },
      collaborations: { $sum: { $cond: [{ $gte: ['$collabMs', collabMinMs] }, 1, 0] } },
      collabClickThroughs: { $sum: { $cond: [{ $and: [{ $gte: ['$peakUsers', 2] }, { $lt: ['$collabMs', collabMinMs] }] }, 1, 0] } },
      stale: { $sum: { $cond: [{ $eq: ['$endReason', 'stale'] }, 1, 0] } },
      collabMs: { $sum: '$collabMs' },
      collabUsersMs: { $sum: '$collabUsersMs' },
      occupiedRefusals: { $sum: '$counters.occupied' },
      joinRequested: { $sum: '$counters.joinRequested' },
      joinApproved: { $sum: '$counters.joinApproved' },
      joinRejected: { $sum: '$counters.joinRejected' },
      joinExecuted: { $sum: '$counters.joinExecuted' },
      moderationRequested: { $sum: '$counters.moderationRequested' },
      moderationApproved: { $sum: '$counters.moderationApproved' },
      moderationRejected: { $sum: '$counters.moderationRejected' },
      moderationExecuted: { $sum: '$counters.moderationExecuted' },
      transfers: { $sum: '$counters.transfers' },
      moderatorPassedOn: { $sum: '$counters.moderatorPassedOn' },
      kicks: { $sum: '$counters.kicks' },
      purges: { $sum: '$counters.purges' },
      locksAcquired: { $sum: '$counters.locksAcquired' },
      locksRefused: { $sum: '$counters.locksRefused' },
    } }],
    sessionDuration: [{ $bucket: { groupBy: '$durationMs', boundaries: [0, 30_000, 300_000, 1_800_000, 7_200_000],
      default: '2h+', output: { count: { $sum: 1 } } } }],
    collabDuration: [
      { $match: { peakUsers: { $gte: 2 } } },
      { $bucket: { groupBy: '$collabMs', boundaries: [0, 30_000, 300_000, 1_800_000, 7_200_000],
        default: '2h+', output: { count: { $sum: 1 } } } },
    ],
    peakUsers: [{ $bucket: { groupBy: '$peakUsers', boundaries: [1, 2, 3, 6], default: '6+',
      output: { count: { $sum: 1 } } } }],
    longest: [
      { $match: { collabMs: { $gte: collabMinMs } } },
      { $sort: { collabMs: -1 } },
      { $limit: top },
      { $project: { _id: 0, room: 1, entityId: 1, startedAt: 1, durationMs: 1, collabMs: 1, peakUsers: 1, distinctUsers: 1 } },
    ],
    largest: [
      { $match: { peakUsers: { $gte: 2 } } },
      { $sort: { peakUsers: -1, collabMs: -1 } },
      { $limit: top },
      { $project: { _id: 0, room: 1, entityId: 1, startedAt: 1, durationMs: 1, collabMs: 1, peakUsers: 1, distinctUsers: 1 } },
    ],
  } },
])
```

Koše: trvanie `<30 s`, `30 s–5 min`, `5–30 min`, `30 min–2 h`, `2 h+`; najviac súčasne `1`, `2`, `3–5`, `6+`. Samo
schválené žiadosti = `joinExecuted − joinApproved` (rovnako pri moderovaní). Priemerne súčasne = `collabUsersMs /
collabMs`.

#### 9.2.2 Časový rad pre graf

```js
db.collab_sessions.aggregate([
  { $match: { entity: 'article', startedAt: { $gte: from, $lt: to }, final: true } },
  { $group: {
    _id: { $dateTrunc: { date: '$startedAt', unit: granularity /* 'hour' | 'day' */, timezone: 'Europe/Bratislava' } },
    sessions: { $sum: 1 },
    clickThroughs: { $sum: { $cond: [{ $lt: ['$durationMs', clickMs] }, 1, 0] } },
    collaborations: { $sum: { $cond: [{ $gte: ['$collabMs', collabMinMs] }, 1, 0] } },
    maxPeakUsers: { $max: '$peakUsers' },
  } },
  { $sort: { _id: 1 } },
])
```

Prázdne hodiny alebo dni doplní server nulami. `$dateTrunc` vyžaduje MongoDB 5.0+ (odvodené: Atlas dnes beží na novšej
verzii; ak nie, `$dateToString` s `timezone`).

#### 9.2.3 Živý stav

Bez Monga: `collabServer.fetchSockets()` a zoskupenie podľa bodu 4.1; `HLEN collab:locks:<room>` pre miestnosti s 2+
ľuďmi v jednom pipeline; `sessionStartedAt` z `find({ final: false, room: { $in: rooms } }, { startedAt: 1 })`. Výsledok
sa na pode drží 5 s v pamäti, aby viac otvorených dashboardov nerobilo viac požiadaviek klastra.

#### 9.2.4 Cena a index (odvodené, nemerané)

| Dotaz | Index | Čítané dokumenty (pri 500–5 000 reláciách denne) | Odhad |
|---|---|---|---|
| súhrn a rad 24 h | `{entity: 1, startedAt: -1}` IXSCAN + FETCH | 0,5–5 tis. | < 50 ms |
| súhrn a rad 7 d | to isté | 3,5–35 tis. | 30–200 ms |
| súhrn a rad 30 d a vlastné (≤ 30 d) | to isté | 15–150 tis. (celá kolekcia) | 100–800 ms |
| top N | v `$facet` po `$match`, triedenie v pamäti s `$limit` (top-k) | podmnožina 2+ | zanedbateľné |
| finalizér | `{final: 1, lastEventAt: 1}` čiastočný | len neuzavreté | zanedbateľné |
| otvorené relácie do živého stavu | to isté | desiatky | zanedbateľné |
| živý stav | bez Monga; 1 požiadavka klastra | – | 10–50 ms + prenos handshake socketov (stovky KB) |
| TTL mazanie | `{startedAt: 1}` | pozadie Monga | – |

`$project: { timeline: 0 }` nezmenší čítanie z disku, len pamäť v pipeline. Pri retencii 30 dní je 30-dňový dotaz
najhorší prípad a číta celú kolekciu (15–150 tis. záznamov), čo stačí. Denný súhrn (napríklad `collab_daily`, do ktorého
finalizér pripočíta reláciu do dokumentu dňa) netreba. Má zmysel len vtedy, ak by objem vyšiel rádovo väčší, než je
odhad (napríklad pri zapnutí boxov distribution managementu).

### 9.3 API pre dashboard v prehliadači

*Doplnené 2026-10-22: odporúčanie c) platí bez zmeny kanála. core-cms volá collaboration tak ako pri `room-data`,
existujúcim klientom `anzu_collaboration` so `SYS_API_TOKEN` (rozhodnutie vlastníka „znovu použiť existujúcu
komunikáciu s core-cms"). Super admina kontroluje len core-cms; collaboration má semafor s 429 (10.9.1). Endpointy a
tvary sú v 10.9.2.*

Fakty (overené):

- JWT nesie len `aud`, `iat`, `nbf`, `exp` a `sub` = ID používateľa
  (`core-cms/vendor/anzusystems/auth-bundle/src/Util/JwtUtil.php:47-52`; vydáva sa bez ďalších claimov,
  `.../Domain/Process/GrantAccessOnResponseProcess.php:40`). Collaboration z neho berie len `{ id }`
  (`src/util/authorization.ts:22-24`, `src/types/User.ts:4-6`) a `aud` neoveruje (`jwt.verify` bez `audience`).
  Roly ani práva v tokene nie sú.
- Práva vyhodnocuje core-cms: `ROLE_SUPER_ADMIN` prejde všetko, inak `resolvedPermissions` používateľa z jeho práv a
  skupín (`vendor/anzusystems/common-bundle/src/Security/Voter/AbstractVoter.php:32-71`). admin-cms ich má z aktuálneho
  používateľa: `useAuth().can()` → `defineAuth<AclValue>(SYSTEM_CMS)` (admin-cms `src/domains/system/auth/auth.ts:746-748`;
  common-admin `src/domains/auth/composables/defineAuth.ts:198-209`). Stránky ich žiadajú v `definePage` cez
  `meta.requiredPermissions` (napr. `src/pages/(cms)/jobs/index.vue:11-17`).
- **Super admin v core-cms**: rola `ROLE_SUPER_ADMIN` (`vendor/anzusystems/contracts/src/Entity/AnzuUser.php:45`) v
  `roles` používateľa. Je navrchu `role_hierarchy` (`config/packages/security.php:22-23`), takže ju nikto nededí. Entita
  má `User::isSuperAdmin()` (`src/Domain/User/Entity/User.php:686`; rovnakú kontrolu robí `isAdmin()` na `:369`). Voter
  ju púšťa ako prvú (`AbstractVoter.php:38`) a v kóde sa kontroluje cez `isGranted(User::ROLE_SUPER_ADMIN)`
  (`src/Domain/Author/Manager/AuthorManager.php:61`). Controllery kontrolujú roly cez
  `$this->denyAccessUnlessGranted(User::ROLE_…)` (napr. `src/Domain/Migration/Controller/Api/Sys/V1/SchemaValidationController.php:36`).
- **Super admin v admin-cms**: `useAuth().useCurrentUser(SYSTEM_CMS).isSuperAdmin` (`src/domains/system/auth/auth.ts:747`;
  common-admin `defineAuth.ts:93-98` → `isAdminHelper` `:224-230`, admin rola predvolene `ROLE_SUPER_ADMIN` `:16-22`,
  `:110-116`). Na super admina dnes čakajú len stránky logov, cez meta `superAdminOfParam` (`src/plugins.d.ts:11-19`) v
  guarde `src/plugins/router/checkRequirements.ts:10-13` a `:37-66`, ktorý inak vráti `/unauthorized` (`:65`). Položku
  menu skrýva `v-if="logSystem"` (`src/domains/system/components/sidebar/SidebarSystemItems.vue:199-200`) z
  `useAccessibleLogSystems`, ktorý filtruje podľa `isSuperAdmin` (`src/domains/system/logSystems.ts:70-78`). Komponenty
  používajú `isSuperAdmin` priamo, napr. tlačidlo vyčistenia miestnosti (`src/domains/cms/article/components/ArticleTopbar.vue:47-48`,
  `:109`). Statický príznak „len super admin" pre route (bez parametra) dnes v admin-cms nie je.
- Domény v produkcii: admin-cms `https://admin-cms.sme.sk`, API `https://core-cms.sme.sk/api`, socket a Hocuspocus
  `wss://collaboration.sme.sk` (skupina `admin-cms-production`); core-cms volá collaboration na
  `https://collaboration.sme.sk` s `ANZU_COLLABORATION_TOKEN` (`core-cms-production`, klient
  `config/packages/clients.php:72-79`). Cookies JWT majú doménu `.sme.sk`, `SameSite=None`
  (`config/packages/anzu_systems_auth.php:13-17`, hodnoty z `core-cms-production`). Origin socket.io je obmedzený na
  `https://admin-cms.sme.sk` (`COLLABORATION_SERVER_CORS`, `src/server/collaboration.ts:28-35`).

Možnosti:

1. **a) socket.io udalosť s ack** (vzor `fetchRoomsInfo`: `src/server/event/listener/fetchRoomsInfoListener.ts:7-27`,
   klient `common-admin src/domains/collab/composables/collabRoom.ts:420-435` s `timeout(500)`)
   - popis: nové udalosti `fetchCollabStatsLive` a `fetchCollabStatsSummary` s ack na existujúcom sockete.
   - práva: socket pozná len `socket.data.user.id`. Collaboration by musel zistiť, či je používateľ super admin: zavolať
     endpoint aktuálneho používateľa `core-cms src/Domain/User/Controller/Api/Adm/V1/UserController.php:42` s cookies z
     handshaku a pozrieť `roles` (výsledok držať 60 s v Redise), alebo čítať `roles` z MySQL core_cms (odvodené: JSON ako
     `["ROLE_SUPER_ADMIN"]`, `src/Migrations/Version1111111111111100Data.php:488`; či na to má používateľ `collaboration`
     právo, neviem). Len rola je jednoduchšia ako práva so skupinami, ostatné riziká zostávajú.
   - prínos: bez CORS a bez nového HTTP; živý stav by mohol chodiť aj pushom (miestnosť `stats`, udalosť pri zmene).
   - riziko: socket je v common-admin interný (`useCollabStateInternal`, `collabState.ts:33-90`; verejné `useCollabState`
     ho nedáva), takže treba nový verejný composable a typy v common-admin a jeho vydanie (tri repozitáre); socket
     existuje len pri zapnutej kolaborácii; dashboard ide cez proces, ktorý nesie editáciu v reálnom čase; kontrola práv
     cez core-cms aj tak.
   - veľkosť: collaboration S + volanie core-cms na práva S, common-admin M, admin-cms S.
2. **b) HTTP na collaboration s JWT cookie**
   - popis: `GET https://collaboration.sme.sk/api/adm/v1/collab-stats/*` z prehliadača s `credentials: 'include'`.
   - práva: `verifyCookie` dá ID, rolu super admina rovnako ako v a) cez core-cms alebo MySQL.
   - prínos: jednoduché čítanie, žiadna zmena v common-admin.
   - riziko: CORS s credentials v `onRequest` (presný `Access-Control-Allow-Origin` podľa `COLLABORATION_SERVER_CORS`,
     `Access-Control-Allow-Credentials: true`, `Vary: Origin`, obsluha `OPTIONS`, ak klient pošle vlastné hlavičky ako
     `X-App-Version` z `cmsClient`); nový API klient a konfigurácia v admin-cms; obnovenie vypršaného JWT
     (`userRefreshRequestInterceptor` v `src/shared/apiClients/cmsClient.ts`) by na collaboration nefungovalo samo.
     Cookies sa pošlú (rovnaký site `sme.sk`, `SameSite=None`), to problém nie je.
   - veľkosť: collaboration S–M, admin-cms S.
3. **c) cez core-cms** (odporúčané)
   - popis: admin-cms volá `GET /api/adm/v1/collab-stats/{live,summary}` cez `cmsClient`; core-cms overí rolu a zavolá
     collaboration `GET /api/sys/v1/collab-stats/{live,summary}` existujúcim klientom `anzu_collaboration` s Bearer
     tokenom (ako `AnzuCollaborationClient::validateSchema`, `src/HttpClient/AnzuCollaborationClient.php:37-61`, vrátane
     `ExtSystemLinkGuard::guardRead`).
   - práva: na začiatku oboch akcií `$this->denyAccessUnlessGranted(User::ROLE_SUPER_ADMIN)`. Je to ten istý mechanizmus
     rolí ako pri sys controlleroch (`SchemaValidationController.php:36`) a ako `AuthorManager.php:61`. Bez nového
     `Permission`, bez zápisu do `BaseReadVoter` a bez konfigurácie v `anzu_systems_common_permissions.yaml`. Ostatní
     dostanú 403.
   - prínos: tajomstvo zostane na serveroch; rola sa overuje rovnako ako všade, plus audit; žiadny CORS; admin-cms použije bežný vzor
     `useApiRequest` + `cmsClient` (`src/domains/cms/desk/api/deskApi.ts:36-43`); core-cms doplní k `room` titulok a
     `docId` článku, takže dashboard odkáže na článok (miestnosť nesie `article.id`, admin-cms
     `articleEditCollab.ts:62`).
   - riziko: PHP kód v core-cms; jeden skok navyše (odvodené: desiatky ms); živý stav len pollingom; sys endpoint
     collaboration je cez nginx `/` dostupný zvonka, chránený len tokenom (ako dnes `room-data`).
   - veľkosť: collaboration S (dva sys endpointy), core-cms S–M, admin-cms M.

**Odporúčanie: c).** Je to jediná možnosť, kde rolu vyhodnocuje to isté miesto ako všade inde v adminovi; a) aj b) by
museli kvôli role aj tak volať core-cms alebo čítať MySQL.

Tvary (c). Route v core-cms: doména `src/Domain/CollabStats/Controller/Api/Adm/V1/CollabStatsController.php` s
`#[Route('/collab-stats', 'adm_collab_stats_v1_')]`; prefix `/api/adm/v1` dáva `AnzuDomainRouteLoader`
(`config/routes/attributes.php`; odvodené z vzoru `UserController` `#[Route('/user', ...)]` → `/api/adm/v1/user/current`).

`GET /api/adm/v1/collab-stats/live?entity=article` → core-cms → `GET /api/sys/v1/collab-stats/live?entity=article`:

```json
{
  "generatedAt": "2026-10-21T09:30:00.000Z",
  "instances": 2,
  "connected": { "sockets": 143, "users": 61 },
  "rooms": { "article": { "occupied": 5, "oneUser": 5, "twoPlus": 0, "maxUsers": 1, "infoSubscribers": 12 } },
  "collaborations": [
    {
      "room": "cms:article:123",
      "entityId": "123",
      "users": 3,
      "sockets": 3,
      "lockedFields": 2,
      "sessionStartedAt": "2026-10-21T08:55:02.000Z",
      "article": { "id": 123, "docId": "…", "headline": "Titulok článku" }
    }
  ]
}
```

`article` dopĺňa core-cms, ostatné je odpoveď collaboration bez zmeny.

`GET /api/adm/v1/collab-stats/summary?from=2026-10-14T00:00:00%2B02:00&to=2026-10-21T00:00:00%2B02:00&entity=article&granularity=day&top=10`
→ core-cms overí `from < to`, rozsah ≤ 30 dní a `from` najviac 30 dní dozadu, `granularity=hour` len do 3 dní, `top` ≤ 50, `entity` zo zoznamu, a
pošle to isté na `/api/sys/v1/collab-stats/summary`:

```json
{
  "from": "2026-10-13T22:00:00.000Z",
  "to": "2026-10-20T22:00:00.000Z",
  "entity": "article",
  "granularity": "day",
  "thresholds": { "clickThroughMs": 30000, "collabMinMs": 30000, "graceMs": 60000 },
  "totals": {
    "sessions": 2140, "clickThroughs": 610, "withTwoPlus": 25, "collaborations": 7, "collabClickThroughs": 18,
    "stale": 1, "open": 4, "avgConcurrentUsers": 2.4
  },
  "series": [
    { "bucket": "2026-10-13T22:00:00.000Z", "sessions": 310, "clickThroughs": 88, "collaborations": 1, "maxPeakUsers": 3 }
  ],
  "histograms": {
    "sessionDuration": [{ "bucket": "<30s", "count": 610 }, { "bucket": "30s-5m", "count": 700 }],
    "collabDuration": [{ "bucket": "<30s", "count": 18 }, { "bucket": "2h+", "count": 1 }],
    "peakUsers": [{ "bucket": "1", "count": 2115 }, { "bucket": "2", "count": 20 }, { "bucket": "3-5", "count": 4 }, { "bucket": "6+", "count": 1 }]
  },
  "top": {
    "longest": [
      {
        "room": "cms:article:123", "entityId": "123", "startedAt": "2026-10-17T06:02:11.000Z",
        "durationMs": 7810000, "collabMs": 7200000, "peakUsers": 10, "distinctUsers": 11,
        "article": { "id": 123, "docId": "…", "headline": "Titulok článku" }
      }
    ],
    "largest": []
  },
  "counters": {
    "joinRequests": { "requested": 40, "approved": 30, "rejected": 5, "autoApproved": 5 },
    "moderationRequests": { "requested": 9, "approved": 6, "rejected": 1, "autoApplied": 2 },
    "transfers": 7, "moderatorPassedOn": 12, "occupiedRefusals": 52, "kicks": 3, "purges": 0,
    "locks": { "acquired": 812, "refused": 9 }
  }
}
```

Čísla sú ilustračné. Chyby: collaboration nedostupná alebo `EXT_SYSTEM_COLLABORATION_READ_DISABLED` → 503 s bežnou
chybovou odpoveďou core-cms; zlé parametre → 422 ako validácia inde.

### 9.4 Strana admin-cms

*Doplnené 2026-10-22: rozloženie podľa špecifikácie vlastníka sú taby Živé / 7 dní / 30 dní a detail relácie ako
vlastná route (10.9). Výber obdobia 24 h, 7 d, 30 d a vlastné nižšie tým odpadá. Živý tab polluje každých 10 s. Mockup
nižšie je pôvodný, platí ten v 10.9. Route, guard super admina, menu, Highcharts a vzory API zostávajú.*

- **Route** (file-based, overený vzor `src/pages/(cms)/jobs/index.vue` → `/(cms)/jobs`): `src/pages/(cms)/collab-stats/index.vue`
  → `/(cms)/collab-stats`, `definePage` s `layout: 'AppLayoutDrawer'`, `requiresAuth: true`, `requiredPermissions: []`
  a nový príznak `superAdminOf: SYSTEM_CMS`.
- **Guard** (nový príznak, lebo `superAdminOfParam` berie systém z URL a je naviazaný na `LOG_SYSTEMS`): do `RouteMeta`
  v `src/plugins.d.ts` pridať `superAdminOf?: string` (string z toho istého dôvodu ako pri `superAdminOfParam`, `:16-17`).
  V `checkRequirements.ts` pred kontrolou práv (`:15-28`) pridať vetvu: ak `to.meta.superAdminOf` je nastavené a
  `useCurrentUser(to.meta.superAdminOf).isSuperAdmin.value` nie je true, vrátiť `'/unauthorized'` (rovnako ako `:65`).
  Overené: vzor guardu; odvodené: názov príznaku.
- **ACL**: žiadne nové konštanty v `ACL` (`src/domains/system/auth/auth.ts:9`).
- **Menu**: `src/domains/system/components/sidebar/SidebarSystemItems.vue`, položka za Joby (vzor `:70-75`) s
  `v-if="isSuperAdmin"`, kde `const { isSuperAdmin } = useCurrentUser(SYSTEM_CMS)` z `useAuth()` (ako
  `ArticleTopbar.vue:47-48`); kľúč `sidebar.content.collabStats`; breadcrumb `breadcrumb.cms.collabStats.list`.
- **Doména** `src/domains/cms/collabStats/`:
  - `api/collabStatsApi.ts`: `useFetchCollabStatsLive` a `useFetchCollabStatsSummary` cez `useApiRequest` + `cmsClient`
    (vzor `deskApi.ts:36-43`; endpoint s query, `urlTemplate: '/adm/v1/collab-stats/live'`).
  - `types/CollabStats.ts`: typy odpovedí z 9.3.
  - `composables/collabStatsLive.ts`: polling, `composables/collabStatsSummary.ts`: obdobie (predvoľby a vlastné),
    načítanie, prepočet košov na série grafu.
  - komponenty: `CollabStatsLiveCards.vue` (karty čísel), `CollabStatsLiveTable.vue` (prebiehajúce spolupráce),
    `CollabStatsPeriodToggle.vue` (`VBtnToggle` 24 h / 7 d / 30 d + vlastné cez `ADatetimePicker` z common-admin,
    `lib.ts:25`, s rozsahom najviac 30 dní a najskorším dátumom pred 30 dňami, lebo staršie relácie TTL zmazal), `CollabStatsTotals.vue`, `CollabStatsSeriesChart.vue`, `CollabStatsHistogramChart.vue`,
    `CollabStatsTopTable.vue` (`VDataTable` s odkazom na článok).
- **Grafy** (overené): admin-cms má `highcharts` ^13.1.1 a `highcharts-vue` ^2.0.2 (`package.json:79-80`) a zdieľané
  `BarChart.vue`, `LineChart.vue`, `PieChart.vue` v `src/domains/cms/shared/components/graph/` (používajú ich štatistiky
  článku a desky). Novú knižnicu netreba; rad = `LineChart` (alebo stĺpce), histogramy = `BarChart`. Prvá verzia môže byť
  len s tabuľkami a kartami, grafy pribudnú bez novej závislosti.
- **Obnovovanie**: živý stav polling každých 30 s (podľa 10.9 teraz 10 s) cez `useIntervalFn` z `@vueuse/core` (rovnako už polluje `src/domains/cms/shared/components/CollabRoomInfo.vue:28`),
  zastavený pri skrytej karte (`useDocumentVisibility`) a mimo stránky; súhrn pri zmene obdobia a tlačidlom Obnoviť.
  Push by vyžadoval možnosť a) a zmenu v common-admin; pri pár divákoch polling stojí (odvodené) jednu požiadavku
  core-cms a jednu požiadavku klastra za 30 s na diváka, s 5 s pamäťou v collaboration ešte menej.

Návrh obrazovky:

```
+------------------------------------------------------------------------------------------------+
| Systém > Štatistiky kolaborácie                                               [Obnoviť]        |
+------------------------------------------------------------------------------------------------+
| TERAZ  (obnovené 09:30:12, každých 30 s)                                                       |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+        |
| | Zamknuté články   | | s 1 človekom      | | Spolupráca 2+     | | Pripojení ľudia   |        |
| |         5         | |         5         | |         0         | |        61         |        |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+        |
| Prebiehajúce spolupráce                                                                        |
|   Článok                                   Ľudí   Od      Zamknuté polia                       |
|   (žiadne)                                                                                     |
+------------------------------------------------------------------------------------------------+
| OBDOBIE  [24 h] [7 dní] [30 dní] [Vlastné: od 14.10.2026 do 21.10.2026]                        |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+        |
| | Relácie           | | Preklikov < 30 s  | | S 2+ ľuďmi        | | Skutočné ≥ 30 s   |        |
| |       2 140       | |    610 (29 %)     | |        25         | |    7 (18 prekl.)  |        |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+        |
| Relácie a spolupráce po dňoch                                                                  |
|  400 |  o     o           o                          o relácie                                 |
|  200 |     o     o     o     o                       # spolupráce (pravá os)                   |
|    0 +--#-----#--#-----------#----                                                             |
|        14.   15.   16.   17.   18.   19.   20.                                                 |
| Trvanie spolupráce                         Najviac ľudí naraz                                  |
|  < 30 s    ##################  18           2     ####################  20                     |
|  30 s–5 m  ###                  3           3–5   ####                   4                     |
|  5–30 m    ##                   2           6+    #                      1                     |
|  30 m–2 h  #                    1                                                              |
|  2 h+      #                    1           Priemerne naraz počas spolupráce: 2,4              |
| Najdlhšie spolupráce                                         [Najdlhšie | Najväčšie]           |
|  Článok                    Začiatok       Trvanie   Spolupráca   Naraz   Rôznych              |
|  Titulok článku            17.10. 08:02   2 h 10 m  2 h 00 m       10       11                 |
| Žiadosti a moderovanie                                                                         |
|  Žiadosti o vstup 40 (schválené 30, odmietnuté 5, samo 5)   Odovzdania moderovania 7           |
|  Prevzatia moderovania 9 (6 / 1 / 2)   Narazili na zamknutý 52   Zámky polí 812 (odmietnuté 9) |
|  Neukončené odhadom (pád podu): 1                                                              |
+------------------------------------------------------------------------------------------------+
```

### 9.5 Veľkosti a poradie

*Nahradené bodom 10.12.*

| Časť | collaboration | core-cms (c) | admin-cms | spolu |
|---|---|---|---|---|
| A. Živý stav | S: `GET /api/sys/v1/collab-stats/live` v `onRequestHook.ts` (vetva pred `:93`, vzor `room-data` `:56-91`), zoskupenie `fetchSockets`, 5 s pamäť, testy ako `test/onRequestHook.test.ts` | S: `CollabStatsController::live` s `denyAccessUnlessGranted(User::ROLE_SUPER_ADMIN)`, metóda v `AnzuCollaborationClient`, doplnenie článkov | S: route s príznakom `superAdminOf` + vetva v guarde, menu s `isSuperAdmin`, API, typy, karty + tabuľka, polling 30 s, preklady | S–M |
| B. Relácie | M: model 9.1.1 (TTL 30 dní, os najviac 100 bodov, 15–150 tis. záznamov), pomocník a Lua skript 9.1.3, ~15 miest volania 9.1.2, finalizér 9.1.4, `COLLAB_STATS_*` konfigurácia, testy 6.8, A/B meranie výkonu | – | – | M |
| C. Prehľad | S: `GET /api/sys/v1/collab-stats/summary`, agregácie 9.2.1–9.2.2, doplnenie prázdnych košov, testy | S: `CollabStatsController::summary`, validácia, doplnenie článkov v top N | M: výber obdobia, súhrnné karty, rad (`LineChart`), histogramy (`BarChart`), top tabuľka | M |
| (a) namiesto c) | S + kontrola práv cez core-cms S | – | S | + common-admin M a vydanie |
| (b) namiesto c) | S–M (CORS, `OPTIONS`, kontrola práv) | – | S (nový klient a konfigurácia) | S–M |

Poradie (podľa rozhodnutia vlastníka, všetko po commite ESM práce):

1. **Najmenšia užitočná verzia = A** v troch repozitároch: stránka „Štatistiky kolaborácie" s kartami „zamknuté články s 1
   človekom / s 2+" a tabuľkou prebiehajúcich spoluprác s odkazom na článok, polling 30 s. Bez zmeny dátového modelu, bez
   zápisov v horúcich cestách. Collaboration časť sa dá nasadiť aj samostatne (volanie curlom s tokenom).
2. **B**: relácie v Mongu za `COLLAB_STATS_ENABLED`, najprv zapnuté v meraní výkonu (A/B), potom v produkcii. Zbiera
   dáta, dashboard ich ešte nemusí ukazovať.
3. **C**: obdobie, grafy a top N, keď je v Mongu aspoň pár dní dát. Prvá verzia C môže mať len tabuľky (Highcharts je
   pripravený, takže grafy sú malý krok navyše).

## 10. Účastníci, úpravy a robustnosť (revízia 2026-10-22 po posudkoch)

Návrh relácií, úprav, uloženia a dashboardu. Je prepísaný podľa rozhodnutí vlastníka po dvoch posudkoch
(`posudky/STATS-PLAN-opus.md`, `posudky/stats-plan-codex.md`; zoznam rozhodnutí je v bode 8) a v rozpore nahrádza body 9.1, 9.2 a 9.5.
Riadky collaboration sú z `d211edd` (`next`) a `756a13e` (`feature/collab-stats`, časť A, nad `d211edd`); čítané cez
`git show 756a13e:<cesta>`. Riadky Hocuspocus a Yjs sú z `node_modules` (Hocuspocus 4.7.1). Nič sa nespúšťalo.
**Overené** = čítané v kóde alebo konfigurácii; **odvodené** = môj záver.

### 10.1 Definície

1. **Účastník**: rôzny používateľ, ktorý bol v relácii členom miestnosti (nie info odberateľ). Má `userId` (DPO schválil,
   10.8) a `order`, poradie prvého vstupu.
2. **Úprava tela**: zmena dokumentu tela, ktorú priniesla správa od Hocuspocus spojenia účastníka (`Update` aj
   `SyncStep2` s offline zmenami). Ráta sa po aplikovaní a len vtedy, keď sa dokument zmenil (10.3). Nadbytočná správa
   bez zmeny sa nezaráta.
3. **Úprava poľa**: `changeFieldData` alebo `releaseFieldLock` s dátami (aj cez `changeCollabAnyData` a
   `releaseCollabAnyLock`), **len keď sa nová hodnota líši od hodnoty uloženej v Redise** (10.2.1). Polia, ktoré klient
   pošle sám po uložení, sa nerátajú (10.2.1).
4. **Účastník upravil** (`edited`): aspoň 1 úprava tela (`minEditOps` = 1; vlastník po posudkoch B2, pôvodne 3) alebo
   aspoň 1 úprava poľa. Editor tela pri otvorení bez písania pošle najviac 1 aktualizáciu bez textu: čo opraví
   (koncový odsek, odkaz holej URL, kotvy) zapíše pri prvom update view. Server prvú aktualizáciu spojenia, ktorá
   nevkladá text, nezaráta (`STATS-B2.md` §11.8/4).
5. **Aktívna minúta**: minúta (epoch minúta, slot 60 s) s aspoň jednou úpravou účastníka. Ukladá sa a zobrazuje len
   **počet aktívnych minút**. Čas v ms sa z minút neodvodzuje a „nečinný čas" sa neukladá.
6. **Spoločné úpravy dvoch účastníkov**: aktívne minúty najviac 5 min od seba (`windowMin` = 5). **Spoločne aktívne
   minúty** relácie = minúty, v ktorých upravovali aspoň dvaja.
7. **Kategória relácie** (pri uzavretí, v tomto poradí):
   - `solo`: najviac súčasne 1 → len denný súhrn, žiadny záznam relácie;
   - `clickThrough`: spolu prítomní < 30 s;
   - `presenceOnly`: menej ako 2 účastníci upravili;
   - `separateEdits`: aspoň 2 upravili, žiadna dvojica so spoločnými úpravami;
   - `realCollab` (skutočná spolupráca): aspoň 2 upravili a aspoň jedna dvojica má spoločné úpravy.
   Prahy sa ukladajú do záznamu (`thresholds`). Ich zmena platí pre nové relácie; staré by chceli prepočet (odvodené,
   posudok L2).
8. **Sólo relácia článku nevie „upravil áno/nie"**: klient v `inactive` nič neposiela (dôkaz s riadkami v pôvodnom bode
   10.1/8 platí ďalej: common-admin `collabField.ts:143`, `:176-183`, `:227`; `collabAnyDataChange.ts:63`, `:97`,
   `:133-140`; admin-cms `ArticleBodyEditor.vue:96-99`). Boxy, inbox a scenarioJob (`allowedSameUser`) sú `active` už s
   1 človekom, preto pri rozšírení na ne treba sólo úpravy riešiť zvlášť.

### 10.2 Signály a kde sa zachytia (`756a13e`)

| Signál | Miesto | Používateľ | Poznámka |
|---|---|---|---|
| Úprava tela | Hocuspocus `onChange` (`Hocuspocus.ts:277-309`), volá sa z `document.onUpdate` (`:446-450`) | `transactionOrigin.source === 'connection'` → `origin.connection.context.id` (z `onAuthenticate`) | Yjs emituje `update` len pri zmene stavu (`yjs.mjs:3126-3134`, `:3353-3355`); `Update` aj `SyncStep2` majú origin `connection` (`MessageReceiver.ts:258-263`, `:285-290`) |
| Úprava poľa (zmena) | `changeFieldDataListener.ts:55-59`: porovnanie pred `write.mayStore()` (`:55`), `storeData` `:59` | `socket.data.user.id` | len pri odlišnej hodnote (10.2.1) |
| Úprava poľa (uvoľnenie s dátami) | `releaseFieldLockListener.ts:84-86`: porovnanie pred `write.mayStore()` (`:84`), `storeData` `:86` | to isté | len pri odlišnej hodnote |
| Zámok | `acquireFieldLockListener.ts:63` (úspech), `:66` (kolízia) | to isté | `locksAcquired`, `locksRefused` |
| Členstvo | vstup `joinCollabRoomListener.ts:109-134` (`joinUserSocket` `:109`, Ok `:133`), obsadené `:88`, štart spolupráce `:94-97`, neúspešný vstup `:149-186`; odchod `leaveCollabRoomListener.ts:45`; odpojenie `disconnectingListener.ts:16-29`; kick `kickUserFromRoomListener.ts:36-42`; purge `purgeRoomListener.ts:26-42`; odovzdanie `transferModerationListener.ts:29`, automaticky `roomUserManager.ts:158`, `:239` | `roomInfo.userIds` po udalosti | všetko pod zámkom miestnosti; Lua dostane celé `userIds` (10.4.1) |
| Žiadosti | `requestToJoinListener.ts:71`, `approveRequestToJoinListener.ts:51`, `rejectRequestToJoinListener.ts:50`, `joinRequestProcessor.ts:11`; moderovanie `requestToTakeModerationListener.ts:77`, `approveRequestToTakeModerationListener.ts:50`, `rejectRequestToTakeModerationListener.ts:48`, `moderationRequestProcessor.ts:22` | – | len počítadlá relácie |
| Nie je účastník | `room-data` z core-cms (`onRequestHook.ts:68`) | – | nerátať |

Registrácia: rozšírenie `CollabStatsExtension` s hookom `onChange` v zozname `extensions` (`hocuspocus.ts:22-30`).
Hook je synchrónny, celý v `try/catch`, len zapisuje do pamäte. Reťaz hookov chybu znova hodí
(`Hocuspocus.ts:583-590`). `onChange` sa nečaká (`:309`), takže neskorý alebo chybný hook nespomalí ani nezastaví
synchronizáciu. Vypadli `beforeSync`, `onAwarenessUpdate`, `connected` aj `onDisconnect` (rozhodnutie 3 a 11).
Miestnosť sa berie z `documentName` (`<room>:<field>`, posledná dvojbodka; admin-cms `hocuspocus.ts:9`).

#### 10.2.1 Polia: kedy je to úprava

- **Porovnanie len na serveri**, bez príznaku z klienta a bez zmeny v common-admin. Pred `write.mayStore()` sa urobí
  jeden `HGET data:<room> <field>` (surový, nie `getData`, ktorý pri falsy hodnote vráti `null`, `roomDataManager.ts:27-31`).
  - `changeFieldData`: `HGET` spolu s `getLock` (`changeFieldDataListener.ts:43`), pred `assertLockHeld` a `mayStore`
    (`:54-55`);
  - uvoľnenie: `HGET` po `releaseLock` (`releaseFieldLockListener.ts:68`), pred `mayStore` (`:84`).
  Medzi `mayStore()` a `HSET` v `storeAllData` (`roomDataManager.ts:47-64`) tak nepribudne žiadny `await`; poradie zápisov
  z `ad6bfa5` (`fieldWriteOrder.ts:12-30`) zostáva. Porovnáva sa `JSON.stringify` uloženej `value` s novou hodnotou.
- **Úprava** = hodnota sa líši a `mayStore()` povolil zápis. Ozvena po uložení (admin-cms `ArticleWidgetRedirect.vue:255-266`
  pošle `alternateLinks` cez `changeFieldData` aj uvoľnenie pri každom `saveTick`, aj pri autosave) nesie uloženú
  hodnotu, takže sa nezaráta. Select, ktorý pošle zmenu a potom uvoľnenie s tou istou hodnotou, dá jednu úpravu, nie
  dve.
- **Súbeh** (posudok codex 6): medzi `HGET` a `HSET` môže zapísať iný socket. Porovnanie je potom voči staršej hodnote
  a pripísanie je približné. Prijaté, overí sa v B2 testom súbehu dvoch používateľov na jednom poli.
- **Prvé uvoľnenie poľa bez uloženej hodnoty** (odvodené, otvorené). `data:<room>` drží len polia zmenené v tejto
  spolupráci a buffer moderátora zo štartu (`roomUserManager.ts:277`, admin-cms `articleEditCollab.ts:160-171`).
  Textové pole bez predošlej zmeny teda nemá s čím porovnať. Focus a blur bez písania by vyzeral ako zmena, skutočné
  prvé prepísanie titulku zas nejde odlíšiť. V1 to rieši konzervatívne: **bez uloženej hodnoty sa to za úpravu
  neráta**, hodnota sa uloží a ďalšie uvoľnenia už porovnanie majú. Prvé prepísanie poľa v relácii tak môže chýbať.
  Oprava bez common-admin: admin-cms pri štarte spolupráce pridá do odpovede `startCollab` aktuálne hodnoty všetkých
  kolaboračných polí ako základ (S; mení dátovú cestu štartu, preto rozhodne vlastník). Bod 8.
- **Polia mimo úprav**: po uložení klient pošle `articleLockingVersion`, `modifiedAt`, `modifiedBy` a
  `attributesStandard.proofread` (`articleEditActions.ts:397-402`, `:675-677`; `ArticleWidgetThirdPartyTracker.vue:185`).
  Konfigurácia `COLLAB_STATS_SYSTEM_FIELDS` ich vynechá úplne, bez počítadla (rozhodnutie 11).
- Kľúče `embed:*` nevzniknú: embedy neposielajú dáta cez `changeCollabAnyData`. Telo posiela len
  `attributesStandard.lockType` (`articleBodyExtensions.ts:220`, `:225`), posudok L9.

### 10.3 Úpravy tela naprieč 2 podmi

- Klientove spojenie Hocuspocus je na jednom pode. Tam sa update aplikuje s originom `connection` a ak zmenil dokument,
  Yjs emituje `update` → `onChange` s kontextom spojenia. Pod úpravu započíta raz.
- Druhý pod dostane update cez Redis extension s originom `redis` a bez spojenia (`extension-redis/src/Redis.ts:145-147`,
  `:743-744`), takže `onChange` má prázdny kontext (`Hocuspocus.ts:287-293`) a nič sa nezaráta. Overené čítaním.
- Offline zmeny po opätovnom pripojení (`SyncStep2`) sa rátajú, nadbytočné správy nie (Yjs bez zmeny neemituje).
- Úprava sa pripisuje podľa `userId`; socket.io spojenie toho istého človeka môže byť na inom pode.

### 10.4 Tok dát: pamäť → Redis → finalizér → Mongo

#### 10.4.1 Členstvo: Lua so zosúladením

Pri každej udalosti členstva (vstup, odchod, odpojenie, kick, purge, neúspešný vstup, odovzdanie) volá handler pod
zámkom miestnosti jeden Lua skript `collabStatsMembership`. Dostane celé `userIds` miestnosti po udalosti
(`roomInfo.userIds`), druh udalosti, moderátora a čas. Skript:

1. určí reláciu cez grace kľúč `collab:<room>:stats:session` (nová, pokračovanie do 60 s, nová po páde podu; 9.1.3);
2. **zosúladí všetkých účastníkov**: kto je v `userIds` a nemá otvorenú prítomnosť, dostane `presentSince` = teraz; kto
   v `userIds` nie je a prítomnosť má otvorenú, ten ju zavrie (`presentMs += teraz − presentSince`). Udalosť bez zmeny
   členstva (odchod nahradenej karty, neskoré odpojenie, purge nahradených socketov) tak nič nepokazí;
3. **účastníka nezakladá pri odchode ani odpojení**. Založí ho pri vstupe alebo zosúladení (bod 10.4.3), keď je v
   `userIds` a ešte nie je v relácii (`order` = ďalšie poradie);
4. prepočíta `n = |userIds|`, `peakUsers`, spoluprítomnosť (`copresenceMs`, `copresenceUsersMs`, `firstCopresenceAt`)
   z predošlého `n` a času poslednej zmeny;
5. pri `n = 0` nastaví grace (`EXPIRE` 60 s) a v `pending` dá reláciu na kontrolu o 60 s.
Jedna cesta do Redisu na udalosť, čakaná vnútri zámku (poradie udalostí jednej miestnosti je tak dané). Overené: všetky
miesta majú `roomInfo` po zmene (10.2).

#### 10.4.2 Úpravy a zámky: pamäť podu a flush

- Úpravy tela, polí a zámky idú do `Map<room, Map<userId, Delta>>`: počty, prvý a posledný čas úpravy, množina epoch
  minút, `fieldsChanged`. Žiadne I/O. Mapa má strop (napríklad 10 000 dvojíc miestnosť × človek), nad ním sa delty
  zahodia.
- **Flush každých 5 s** na pod: jeden Lua skript `collabStatsFlush` na miestnosť s aktivitou. Robí `HINCRBY` počtov,
  min/max časov, `SADD` minút (najviac 480 na účastníka) a `HINCRBY` polí so stropom 50 kľúčov (`HLEN`, inak `other`).
  Delta účastníka, ktorý v relácii nie je, sa zahodí (nevytvára ho). Beží jeden flush naraz; pri riadenom vypnutí sa
  spraví ešte raz. Pri páde podu sa stratí najviac 5 s jeho úprav.

| Kľúč (prefix `collab:` z ioredis) | Obsah |
|---|---|
| `<room>:stats:session` | id relácie, grace 60 s |
| `stats:s:<sid>` | hash meta: `room`, `entity`, `entityId`, `startedAt` (ms; číta ho už časť A, `collabStatsLiveManager.ts:105`), `lastEventAt`, `lastChangeAt`, `n`, `peakUsers`, `copresenceMs`, `copresenceUsersMs`, `firstCopresenceAt`, `pcount`, `c:<počítadlo>` |
| `stats:s:<sid>:users` | set `userId` účastníkov |
| `stats:s:<sid>:u:<userId>` | hash účastníka: `order`, `joins`, `presentSince`, `presentMs`, `wasModerator`, `bodyEdits`, `fieldEdits`, `locksAcquired`, `locksRefused`, `firstEditAt`, `lastEditAt` |
| `stats:s:<sid>:u:<userId>:min` | set epoch minút s úpravou (najviac 480) |
| `stats:s:<sid>:u:<userId>:fields` | hash `pole → n` (najviac 50 a `other`) |
| `stats:pending` | zset `sid → čas ďalšej kontroly` |
| `stats:finalizer:lock` | mutex behu finalizéra (10.4.4) |
| `stats:dropped` | set `<sid>\|<deň>` zahodených relácií, kým ich transakcia nepripočíta (10.4.4) |

Všetky kľúče relácie majú TTL 7 dní, ktorý sa obnovuje pri aktivite; po zápise do Monga sa zmažú.

#### 10.4.3 Kontrola živosti a zosúladenie obsadených miestností

Raz za 5 min v behu finalizéra urobí jeden snímok členstva klastra (`serverSideEmitWithAck`, 10.9.1). Pre každú
otvorenú reláciu v `pending` (aj obsadenú) potom zavolá pod zámkom miestnosti `collabStatsMembership` s druhom
`reconcile` a skutočnými `userIds`. Opraví sa tak chýbajúci odchod (pád podu, zlyhaný disconnect) aj chýbajúci vstup.
Prázdnu miestnosť to zavrie (`n = 0`, potom grace).

#### 10.4.4 Finalizér: vlastná rada, mutex, transakcia

- **Vlastná BullMQ rada** `collab-stats` (nie `collab` s žiadosťami, `queue.ts:25-29`), worker s `concurrency: 1`,
  scheduler každých 60 s (`upsertJobScheduler`, v BullMQ 5.81.5 overené), joby s `removeOnComplete: true` a
  `removeOnFail: true`.
- **Redis mutex na beh**: `SET stats:finalizer:lock <token> NX PX 120000`, uvoľnenie Lua skriptom „zmaž, ak je token
  môj". Druhý beh (iný pod, zaseknutý job) skončí bez práce.
- Beh: najviac 4 dávky po sebe, ďalšia len po plnej (`HEAP-LOCK.md`, pôvodne 1 dávka 200). Dávka:
  `ZRANGEBYSCORE stats:pending -inf <teraz> LIMIT 0 50`. Pre každú reláciu:
  - ukazovateľ miestnosti na ňu ukazuje a `n > 0` → preskórovať na najbližšiu kontrolu živosti (o 5 min);
  - ukazovateľ ukazuje a `n = 0` → beží grace, preskórovať o 60 s;
  - inak relácia skončila → do dávky. Pri uzavretí sa otvorené prítomnosti zavrú k `endedAt` (posledná udalosť s
    `n = 0`, inak `lastEventAt` a `endReason: 'stale'`); potom kategória, `collabPairs` a súčty.
  Preskórovanie zabráni, aby stovky otvorených miestností zakaždým zaplnili beh (posudok M5).
- **Jedna Mongo transakcia na dávku** (exactly-once, rozhodnutie 2), na štatistickom spojení cez
  `connection.transaction()`:
  1. `collab_stats_finalized.find({ _id: { $in: sids } })` v transakcii; už zapísané relácie sa preskočia (pád po
     commite, pred zmazaním v Redise);
  2. `insertMany` markerov `{ _id: sid, at }` pre všetky ostatné relácie, aj sólo, a `{ _id: "dropped:<sid>", at }` pre
     zahodené relácie zo `stats:dropped` (kolekcia s TTL 2 dni);
  3. `insertMany` záznamov `collab_sessions` pre relácie 2+;
  4. `$inc` do `collab_daily` (sólo, `multi`, `multi.byPeakUsers`, `byHour`) a do `collab_daily_users`.
  Commit, **až potom** `DEL` kľúčov a `ZREM` z `pending` v Redise. Pri páde medzi commitom a `DEL` nájde ďalší beh
  markery a len upratá Redis; nič sa nezapočíta dvakrát. Logika `dailyDone` a E11000 odpadá.
- **Limity transakcií** (odvodené z dokumentácie MongoDB, overiť na stagingu):
  - Atlas je replica set, transakcie sú dostupné (URL `mongodb+srv` s `w=majority`, `configuration.yaml:45`; tier a
    verziu nevidno);
  - transakcia smie trvať najviac 60 s (`transactionLifetimeLimitSeconds`). Dávka do 50 relácií (≤ ~120 zápisov) a
    `maxCommitTimeMS` 5 000 ju drží ďaleko pod tým;
  - čítanie v transakcii musí byť z primárneho uzla, takže zapisovacie spojenie je `primary`, `secondaryPreferred`
    dostávajú len dotazy dashboardu (10.6.2);
  - `TransientTransactionError` a `UnknownTransactionCommitResult` opakuje `withTransaction`, vlastný strop 10 s; potom
    breaker (10.7);
  - kolekcie a indexy musia existovať vopred (vytvoria sa pri štarte štatistického spojenia, mimo transakcie);
  - konflikty zápisu na denných dokumentoch nehrozia, finalizér beží len jeden (mutex).
- **Výpadok Monga**: dávka sa nezapíše, relácie zostanú v `pending` a ďalší beh to skúsi znova. Relácia staršia ako 24 h
  sa zahodí:
  - jej kľúče sa zmažú a do Redis setu `stats:dropped` pribudne `<sid>|<deň>`;
  - ďalšia úspešná transakcia vloží marker `{ _id: 'dropped:<sid>' }` do `collab_stats_finalized` a urobí
    `$inc collab_daily.dropped` pre jej deň, spolu s reláciami dávky;
  - až po commite `SREM` zo `stats:dropped`; marker, ktorý už existuje, sa preskočí.
  Pád po commite tak zahodenú reláciu nezapočíta dvakrát.
- **Pád podu**: stratí sa najviac 5 s úprav toho podu. Prítomnosti opraví zosúladenie (10.4.3) a reláciu zavrie
  finalizér.
- **Rolling deploy**: stream adaptéra nesie verziu (`collaboration.ts:38-43`), takže staré a nové pody sa navzájom
  nevidia a relácia sa môže rozdeliť. **Prijaté**, nasadzuje sa, keď nikto neupravuje (rozhodnutie 5).

### 10.5 Mongo: tvary, indexy, veľkosti

Štyri kolekcie na **samostatnom spojení štatistík** (10.7), všetky s prefixom `${envPrefix}` ako
`documents` (`mongoose/document.model.ts`).

#### 10.5.1 `collab_sessions` (len relácie 2+)

```ts
export type CollabSessionCategory = 'clickThrough' | 'presenceOnly' | 'separateEdits' | 'realCollab'

export interface ICollabParticipant {
  userId: number
  order: number
  wasModerator: boolean
  joins: number
  presentMs: number
  activeMinutes: number // počet minút s úpravou, nie ms
  bodyEdits: number
  fieldEdits: number
  fieldsChanged: Record<string, number> // surové názvy polí, najviac 50 kľúčov a 'other' (10.5.4)
  locksAcquired: number
  locksRefused: number
  edited: boolean // bodyEdits >= minEditOps || fieldEdits >= 1
  firstEditAt: Date | null
  lastEditAt: Date | null
}

export interface ICollabSession {
  _id: string // id relácie
  room: string
  entity: string
  entityId: string
  startedAt: Date
  endedAt: Date
  endReason: 'empty' | 'purge' | 'stale'
  durationMs: number
  peakUsers: number
  peakBucket: '2' | '3' | '4' | '5plus'
  copresenceMs: number
  copresenceUsersMs: number
  firstCopresenceAt: Date
  participantsCount: number
  participantsOverflow: number // nad strop 50
  editors: number
  bodyEdits: number
  fieldEdits: number
  jointActiveMinutes: number
  minEditGapMin: number | null
  collabPairs: [number, number][] // dvojice userId so spoločnými úpravami
  category: CollabSessionCategory
  thresholds: { minEditOps: number; windowMin: number; slotS: number }
  counters: Record<string, number> // žiadosti, moderovanie, kick, purge, obsadené
  participants: ICollabParticipant[] // najviac 50
  pods: string[]
  version: string
}
```

Indexy (každý s vlastným `name`, na ktorý sa odkazuje `hint`; `_id` na konci kvôli kurzoru, rozhodnutie 7):

```ts
CollabSessionSchema.index({ entity: 1, peakBucket: 1, category: 1, startedAt: -1, _id: -1 }, { name: 'stats_list_time' })
CollabSessionSchema.index({ entity: 1, peakBucket: 1, category: 1, durationMs: -1, startedAt: -1, _id: -1 }, { name: 'stats_list_duration' })
CollabSessionSchema.index({ entity: 1, peakBucket: 1, category: 1, jointActiveMinutes: -1, startedAt: -1, _id: -1 }, { name: 'stats_list_joint' })
CollabSessionSchema.index({ entity: 1, 'participants.userId': 1, startedAt: -1, _id: -1 }, { name: 'stats_user_time' })
CollabSessionSchema.index({ startedAt: 1 }, { name: 'stats_ttl', expireAfterSeconds: 2_592_000 }) // presne 30 dní
```

Príklad (ilustračný, skrátený na dvoch účastníkov):

```json
{
  "_id": "6717f0c2a9e3b14d5c8e9a01", "room": "cms:article:123", "entity": "article", "entityId": "123",
  "startedAt": "2026-10-22T07:58:10.000Z", "endedAt": "2026-10-22T09:12:40.000Z", "endReason": "empty",
  "durationMs": 4470000, "peakUsers": 2, "peakBucket": "2", "copresenceMs": 3900000, "copresenceUsersMs": 7800000,
  "firstCopresenceAt": "2026-10-22T08:02:00.000Z", "participantsCount": 2, "participantsOverflow": 0,
  "editors": 2, "bodyEdits": 945, "fieldEdits": 6, "jointActiveMinutes": 17, "minEditGapMin": 0,
  "collabPairs": [[101, 202]], "category": "realCollab", "thresholds": { "minEditOps": 1, "windowMin": 5, "slotS": 60 },
  "counters": { "occupied": 1, "joinRequested": 1, "joinApproved": 1, "joinRejected": 0, "joinExecuted": 1,
    "moderationRequested": 0, "moderationApproved": 0, "moderationRejected": 0, "moderationExecuted": 0,
    "transfers": 0, "moderatorPassedOn": 0, "kicks": 0, "purges": 0, "collabStarts": 1 },
  "participants": [
    { "userId": 101, "order": 1, "wasModerator": true, "joins": 1, "presentMs": 4470000, "activeMinutes": 38,
      "bodyEdits": 812, "fieldEdits": 4, "fieldsChanged": { "texts.headline": 3, "seo.title": 1 },
      "locksAcquired": 6, "locksRefused": 0, "edited": true,
      "firstEditAt": "2026-10-22T08:00:31.000Z", "lastEditAt": "2026-10-22T09:10:02.000Z" },
    { "userId": 202, "order": 2, "wasModerator": false, "joins": 2, "presentMs": 3900000, "activeMinutes": 11,
      "bodyEdits": 133, "fieldEdits": 2, "fieldsChanged": { "texts.perex": 2 },
      "locksAcquired": 3, "locksRefused": 1, "edited": true,
      "firstEditAt": "2026-10-22T08:05:12.000Z", "lastEditAt": "2026-10-22T08:41:55.000Z" }
  ],
  "pods": ["collaboration-7d9f-abc12", "collaboration-7d9f-def34"], "version": "2.0.0"
}
```

Vypadlo oproti predošlej verzii (rozhodnutia 6 a 11): `activeMs`, `idleMs`, pole minút v Mongu, `awareness`,
`bodyBytes`, `bodySyncs`, `saves`, `systemFieldChanges`, `startSnapshotFields`, `fieldReleasesUnknown` a rozpis
`fieldChanges`/`fieldReleaseEdits`/`fieldReleasesUnchanged` (zostáva jedno `fieldEdits`). Minúty žijú len v Redise pre
výpočet spoločných úprav pri uzavretí.

#### 10.5.2 `collab_daily` a `collab_daily_users` (predpočítané, zapisované v transakcii)

```ts
export interface CollabMultiBucket {
  sessions: number
  clickThrough: number
  presenceOnly: number
  separateEdits: number
  realCollab: number
  totalMs: number // priemer = totalMs / sessions
  copresenceMs: number
  bodyEdits: number
  fieldEdits: number
  editors: number // priemer = editors / sessions
  participants: number
}

export interface ICollabDaily {
  _id: string // "<entity>:<YYYY-MM-DD>" podľa Europe/Bratislava
  entity: string
  day: Date // 00:00 Europe/Bratislava
  solo: { sessions: number; totalMs: number; clickThroughs: number; durationBuckets: Record<'lt30s' | 'lt5m' | 'lt30m' | 'lt2h' | 'gte2h', number> }
  multi: CollabMultiBucket & { byPeakUsers: Record<'2' | '3' | '4' | '5plus', CollabMultiBucket> }
  byHour: Record<string, { solo: number; multi: number; realCollab: number }> // "0".."23"
  stale: number
  dropped: number
}
// TTL { day: 1 } expireAfterSeconds 2_592_000 (presne 30 dní, rozhodnutie 11)

export interface ICollabDailyUsers {
  _id: string // "<entity>:<YYYY-MM-DD>"
  day: Date
  byUser: Record<string, { collaborations: number; edited: number; activeMinutes: number; bodyEdits: number; fieldEdits: number; moderated: number }>
  byPair: Record<string, { collaborations: number; jointActiveMinutes: number }> // "<menšieId>_<väčšieId>"
}
// TTL ako collab_daily; strop 1 000 kľúčov byUser a 2 000 byPair na deň, nad ním do "other" (posudok codex 9)

export interface ICollabStatsFinalized {
  _id: string // id relácie, aj sólo
  at: Date
}
// TTL { at: 1 } expireAfterSeconds 172_800 (2 dni; outbox v Redise drží reláciu najviac 24 h)
```

Pri relácii 2+ ide ten istý `$inc` do `multi.*` aj do `multi.byPeakUsers.<kôš>.*`. Sólo ide len do `solo.*` a `byHour`;
úpravy sólo server nevidí, takže ich nemá. Rozmer na používateľa v sólo súhrne zostáva predvolene vypnutý (bod 8).
**Najstarší deň**: TTL je presne 30 dní pre denné dokumenty aj relácie. 30-dňový tab (dnes a 29 dní dozadu) má preto
oba úplné. Deň, za ktorý denný dokument chýba alebo zber začal v jeho priebehu, dashboard označí ako neúplný
(pole `partialDays` v odpovedi `summary`, 10.9.2).

#### 10.5.3 Veľkosti (odvodené)

- Účastník ~0,3 KB (14 polí) + `fieldsChanged`; hlavička relácie s počítadlami ~0,9 KB. Bežná relácia (2–3 ľudia) má
  ~1,5–1,8 KB, najväčšia (50 účastníkov po ~2,8 KB) ~145 KB.
- `collab_sessions`: pri 1–10 % z 500–5 000 relácií denne je to 150–15 000 záznamov za 30 dní, 0,3–27 MB; pri 10× do
  ~270 MB.
- `collab_daily`: ~3–4 KB na deň a entitu. `collab_daily_users`: bežne jednotky KB, strop ~150 KB na deň.
- `collab_stats_finalized`: ~40 B na reláciu za 2 dni, teda ~10 000 relácií × 40 B ≈ 0,4 MB.

#### 10.5.4 `fieldsChanged`: veľkosť a rozhodnutie

- Surové názvy polí z udalostí (`changeFieldData` a uvoľnenie s dátami), ktoré sa započítali ako úprava; strop 50 kľúčov
  a `other`. Popisy prekladá admin-cms. V mongoose `Mixed` (kľúče s bodkou, MongoDB 5.0+; odvodené).
- Skutočné názvy (overené v admin-cms a common-admin): `texts.headline` (14 znakov), `texts.perex` (11), `seo.title` (9),
  `keywords` (8), `rubric` (6), `listingImage` (12), `leadImageMedia` (14), `alternateLinks` (14), `recommender.*`
  (20–25), `flagsStandard.aiReclassifyOnPublish` (35), `comment:<UUID>` (44), `boxItem:<id>` (~13). `embed:*` nevzniknú
  (10.2.1).
- BSON: kľúč s hodnotou int32 = dĺžka názvu + 6 B. Bežný editor (3 polia) ~70 B, 5 polí ~110 B; strop 50 kľúčov
  komentárov ~2,5 KB.
- Bežná relácia ~1,6 KB s 1–2 editormi narastie o 70–220 B, teda **+4–14 %**, na účastníka 70–110 B. **Rozhodnutie:
  ponechať** (pod prahom 20 % aj 200 B; vlastník 22. 10.).

### 10.6 Čítanie, ktoré Mongo nezloží

| Dotaz | Tvar | Index (`hint`) a očakávaný plán (overiť explain, 10.13) | Strop |
|---|---|---|---|
| tab 7 alebo 30 dní | `collab_daily.find({ _id: { $gte: 'article:<od>', $lte: 'article:<do>' } })` | `_id`, ≤ 31 kľúčov aj dokumentov | `limit(31)`, `maxTimeMS(1000)` |
| ľudia | `collab_daily_users.find({ _id: { $gte, $lte } })`, súčet v Node | `_id`, ≤ 31 | `limit(31)`, `maxTimeMS(1000)`, top 50 |
| zoznam podľa času | `find({ entity, peakBucket: { $in }, category: { $in }, startedAt: { $gte, $lt } })`, triedenie `{ startedAt: -1, _id: -1 }` | `stats_list_time`, SORT_MERGE nad IXSCAN, bez SORT | 50, kurzor |
| zoznam podľa trvania | to isté, triedenie `{ durationMs: -1, startedAt: -1, _id: -1 }` | `stats_list_duration` | 50, kurzor |
| zoznam podľa spoločne aktívnych minút | triedenie `{ jointActiveMinutes: -1, startedAt: -1, _id: -1 }` | `stats_list_joint` | 50, kurzor |
| relácie jedného človeka | `find({ entity, 'participants.userId': id, startedAt: {…} })`, triedenie `{ startedAt: -1, _id: -1 }`; **len** `sort=startedAt`, bez filtra koša a kategórie | `stats_user_time` (multikey) | 50, kurzor |
| detail relácie | `findOne({ _id })` | `_id` | 1 dokument |
| živý tab | bez Monga (10.9.2) | – | cache 5 s |
| finalizér | v transakcii len `find` markerov podľa `_id` a zápisy | `_id` | 200 relácií na beh |

#### 10.6.1 Kurzor a filtre

- Kurzor je `(k, startedAt, _id)`, kde `k` je triediaci kľúč (pri triedení podľa času `k = startedAt`). Ďalšia strana:
  `{ $or: [{ k: { $lt: k0 } }, { k: k0, startedAt: { $lt: s0 } }, { k: k0, startedAt: s0, _id: { $lt: id0 } }] }`.
  `_id` je posledný v každom indexe, takže poradie je úplné aj pri rovnakých hodnotách (posudok codex 4, opus M4).
  **Implementované inak** (`STATS-C.md` §4): explain ukázal, že `$or` dá OR index scanov s blokujúcim SORT. Ďalšia
  strana je preto 2–3 dotazy po sebe, každý rozsah indexu: zvyšok začiatku, zvyšok kľúča a nižšie kľúče.
- `peakBucket` a `category` sa posielajú vždy ako `$in`. Bez filtra collaboration doplní všetky hodnoty, aby plán bol
  SORT_MERGE bez blokujúceho SORT (neoverené, overí explain v 10.13).
- S filtrom `userId` je dovolené len triedenie podľa `startedAt` a ostatné filtre API odmietne. Inak by `docsExamined`
  prerástlo `nReturned`.
- Zoznam vracia projekciu bez `participants` a `counters`. Mongo však číta celé dokumenty (nie je to pokrytý dotaz).
  Bajty strany preto meria 10.13: 50 bežných relácií ≈ 80 KB, najhorší prípad 50 × 145 KB ≈ 7 MB (pri 50-členných
  reláciách, nerealistické).

#### 10.6.2 Ochrana

- obdobie len 7 alebo 30 dní (vlastné nie je); dotaz bez `entity` a ohraničeného `startedAt` alebo `_id` rozsahu kód
  odmietne pred Mongom;
- každý dotaz má `maxTimeMS`, `hint` s menom indexu, projekciu a `limit`. Agregácie dashboard nepoužíva; kde by boli
  (kontrolné skripty), tak s `allowDiskUse: false` a bez `$lookup`;
- cache v collaboration: živé 5 s, súhrn a ľudia 60 s, zoznam a detail 30 s, všetko so single-flight;
- **semafor na pod** pre všetky štatistické endpointy (napríklad 4 súbežné), nad ním **429**; plus limit 6 výpočtov
  súhrnu za minútu;
- **read preference**: dotazy dashboardu `secondaryPreferred` (`.read('secondaryPreferred')`), zápisy finalizéra
  `primary` (transakcia). Cluster `anzu-production-mongodb` zdieľa aj `notification` (overené `az`); že má sekundáry,
  je odvodené z Atlas a `-pri` (VPC peering, dedikovaný tier). Tier, verziu a analytics uzly pozrie DevOps;
- **mongoose debug vypnutý** na štatistickom spojení. Hlavné spojenie ho zapína podľa `LOG_LEVEL`
  (`storage/mongodb.ts:14`), a keďže je to globálne nastavenie inštancie mongoose, štatistiky použijú **vlastnú inštanciu
  `new mongoose.Mongoose()`** s `debug: false`. Inak by sa inserty s `userId` logovali (posudok L1).

### 10.7 Mongo nedostupné: zúžená záruka

**Záruka (rozhodnutie 1): štatistiky nepridajú kolaborácii žiadnu závislosť na Mongu a nikdy ju neblokujú.**

- Udalosti členstva, úpravy, zámky a flush sa Monga nedotknú (Redis a pamäť). Do Monga zapisuje len finalizér, mimo
  handlerov, vo vlastnej BullMQ rade (10.4.4).
- Samostatná inštancia mongoose a spojenie: `maxPoolSize` 2–3, `bufferCommands: false`, `serverSelectionTimeoutMS`
  2000, `connectTimeoutMS` 5000, `socketTimeoutMS` 10000. Pri štarte sa nečaká a zatvára sa v graceful shutdown.
  Výpadok tak hneď zlyhá a nič sa nebufferuje.
- **Breaker** vo finalizéri: po 3 zlyhaných dávkach za sebou sa otvorí na 60 s, potom skúsi jednu dávku.
- **Tlmené logy**: `warn` (každý je udalosť v Sentry, `sentryTransport.ts`) len pri otvorení breakera, najviac raz za
  15 min, `info` pri zatvorení, inak `debug`.
- Dashboard bez Monga vráti pri súhrne 503 alebo poslednú cache; živý tab beží ďalej.
- **Mimo rozsahu** (samostatné rozhodnutie vlastníka, bod 8): existujúce závislosti kolaborácie na Mongu.
  - štart: `index.ts:47` čaká na `useMongoose()`, pri chybe proces skončí (`:121-126`);
  - načítanie tela: `fetchDocument.ts:33-38` (`findOne`);
  - štart spolupráce: `removeEditorsData()` (`roomDataManager.ts:43-44`, `deleteMany`) čaká pod zámkom miestnosti
    (`joinCollabRoomListener.ts:94`).
  Pri výpadku Monga sa tieto cesty správajú ako dnes. Štatistiky ich nezhoršia, ale ani neopravia.
- Test 10.13/5 je tomu prispôsobený: overuje, že sa kolaborácia so zapnutými štatistikami **nespráva horšie** ako bez
  nich. Nečaká, že nový vstup do spolupráce bez Monga prejde.

### 10.8 Osobné údaje

DPO schválil (vlastník, 22. 10.) skutočné `userId` účastníkov relácií 2+. Mená sa neukladajú, doplní ich core-cms
pri čítaní. Platí retencia 30 dní, prístup len super admin, kontrolovaný v core-cms (9.3, 9.4, 10.9.1). Sólo relácie sú bez
osôb.

### 10.9 API, bezpečnosť a dashboard

#### 10.9.1 Bezpečnosť (rozhodnutie 9; platí aj pre časť A)

Rozhodnutie vlastníka 2026-10-22: **„znovu použiť existujúcu komunikáciu s core-cms"**.

- **Kanál a token**: štatistiky idú tým istým kanálom ako `room-data`. core-cms ich volá existujúcim klientom
  `anzu_collaboration` (`clients.php:72-79`, base `ANZU_COLLABORATION_HOST`, Bearer `ANZU_COLLABORATION_TOKEN`) a
  collaboration overí `SYS_API_TOKEN` rovnako ako pri `room-data` (`!==`, 401; `onRequestHook.ts:95-99`, STATS-A §13).
  Kontrola super admina je **len v core-cms**. Nový token, tajomstvo, hlavička s id super admina, prístupový log a
  interný port nie sú; DevOps nemá čo robiť.
- **Semafor na pod s 429** pre každý štatistický endpoint (10.6.2).
- **Tlmené logy** (`collabStatsRequest.ts:32-44`): prvá chyba `warn` (Sentry), ďalšie do 15 min od neho `info`, prvá
  po 15 min znova `warn` s počtom chýb medzitým.
- **Živý snímok bez handshake**: namiesto `fetchSockets()` (ktorý cez Redis posielal handshake každého socketu vrátane
  JWT cookies) `adapter.serverSideEmit(['collabStatsMembers', ack])` s vlastným timeoutom 2 s
  (`collabStatsLiveManager.ts:61-75`; ack adaptéra má pevných 5 s, `Namespace.serverSideEmit()` by zahodil promise
  chyby adaptéra). Každý pod odpovie len `{ members: [{ room, userId, joinedAt }] }` zo svojej **mapy**
  `Map<room, Map<socketId, ms>>`, ktorú plnia udalosti adaptéra `join-room`/`leave-room` len pre počítané miestnosti
  (`collabStatsRoomHelper.ts:24-68`); prichádzajú na pode, ktorý socket drží, aj pri kicku a purge z iného podu a pri
  každom odpojení. Bez cache na odpovedajúcom pode, bez prechodu všetkých socketov. Žiadateľ pridá svojich z tej istej
  mapy. Neodpovedajúci pod → 503. Udalosť `collabStatsMembers` nahradila nepoužité `fetchAllSockets` (odstránené aj so
  `SocketDetails`). Ten istý snímok používa aj kontrola živosti (10.4.3).
- **`live`** vracia `uniqueUsers` (rôzni ľudia vo všetkých miestnostiach entity, každý raz, presne aj nad 200 miestností
  zoznamu) namiesto `connectedUsers` a `instances` (koľko podov odpovedalo, vrátane seba; aj v `live/rooms`). Pody sa
  nesledujú (žiadny heartbeat); pod bez pub/sub odberu sa nespočíta, prejaví sa menším `instances`.
- Stav: časť A s opravami `7237c66`, `20a94b5` a opravou po posudkoch 2 (STATS-A §15).

#### 10.9.2 Taby, API a tvary

Taby podľa vlastníka: **Živé** / **7 dní** / **30 dní**. Detail relácie je vlastná route
`/(cms)/collab-stats/sessions/[id]`. Ostatné z 9.4 (route, guard super admina, menu, Highcharts).

| Endpoint (collaboration `sys` za `SYS_API_TOKEN`, core-cms `adm` za `ROLE_SUPER_ADMIN`) | Zdroj | Cache |
|---|---|---|
| `live?entity=article` | snímok: mapa podu + `serverSideEmit` ostatným (10.9.1) | 5 s, single-flight |
| `live/rooms?entity=article&bucket=one\|twoPlus&limit≤200` | snímok + Redis v 2 krokoch (moderátor, zámky, relácia; potom `startedAt` a `stats:s:<sid>:u:<userId>`) | 5 s na kôš |
| `summary?entity=article&days=7\|30` | `collab_daily` (≤ 31) | 60 s |
| `people?entity=article&days=7\|30` | `collab_daily_users` (≤ 31) | 60 s |
| `sessions?entity=article&days=7\|30&peakUsers=…&category=…&sort=startedAt\|durationMs\|jointActiveMinutes&cursor=…&limit≤50` alebo `…&userId=…` (len `sort=startedAt`) | `collab_sessions` (10.6) | 30 s |
| `sessions/:id` | `collab_sessions` | 30 s |

Živé úpravy v `live/rooms` sú staré najviac ~10 s (flush 5 s, cache 5 s). Pri miestnosti s 1 človekom sú `null`.
collaboration vracia v `live/rooms` aj `generatedAt`, `entity`, `bucket`, `instances` a `total` (STATS-A §3).
core-cms pridá mapy `articles` (titulok, docId) a `users` (`fullName`).

Tvary (ilustračné):

```json
{ "live": { "generatedAt": "2026-10-22T09:30:05.000Z", "entity": "article", "oneUser": 5, "twoPlus": 2, "uniqueUsers": 9, "instances": 2 } }
```

```json
{
  "items": [{ "room": "cms:article:123", "entityId": "123", "sessionStartedAt": "2026-10-22T07:58:10.000Z",
    "moderatorId": 101, "lockedFields": [{ "field": "texts.headline", "userId": 202 }],
    "participants": [
      { "userId": 101, "presentSince": "2026-10-22T07:58:10.000Z", "bodyEdits": 640, "fieldEdits": 3, "locksAcquired": 5, "lastEditAt": "2026-10-22T09:29:58.000Z" },
      { "userId": 202, "presentSince": "2026-10-22T08:02:00.000Z", "bodyEdits": 98, "fieldEdits": 1, "locksAcquired": 2, "lastEditAt": "2026-10-22T09:25:40.000Z" }
    ] }],
  "articles": { "123": { "id": 123, "docId": "…", "headline": "Titulok článku" } },
  "users": { "101": { "id": 101, "fullName": "A. Novák" }, "202": { "id": 202, "fullName": "B. Kováčová" } }
}
```

```json
{
  "days": 7, "partialDays": [],
  "solo": { "sessions": 5620, "clickThroughs": 1640, "avgDurationMs": 612000,
    "durationBuckets": { "lt30s": 1640, "lt5m": 2100, "lt30m": 1240, "lt2h": 560, "gte2h": 80 } },
  "multi": { "sessions": 63, "clickThrough": 26, "presenceOnly": 22, "separateEdits": 4, "realCollab": 11,
    "avgDurationMs": 2380000, "bodyEdits": 21840, "fieldEdits": 410, "avgEditors": 1.4,
    "byPeakUsers": { "2": { "sessions": 52, "realCollab": 8, "…": "…" }, "3": { "…": "…" }, "4": { "…": "…" }, "5plus": { "…": "…" } } },
  "series": [{ "day": "2026-10-16", "solo": 810, "multi": 9, "realCollab": 2 }],
  "byHour": [{ "hour": 8, "solo": 640, "multi": 7, "realCollab": 1 }]
}
```

```json
{
  "topUsers": [{ "userId": 101, "collaborations": 12, "edited": 11, "activeMinutes": 360, "bodyEdits": 9120, "fieldEdits": 85, "moderated": 9 }],
  "topPairs": [{ "users": [101, 202], "collaborations": 7, "jointActiveMinutes": 96 }]
}
```

```json
{
  "items": [{ "id": "6717f0c2a9e3b14d5c8e9a01", "entityId": "123", "startedAt": "2026-10-22T07:58:10.000Z",
    "durationMs": 4470000, "peakUsers": 2, "category": "realCollab", "editors": 2, "participantsCount": 2,
    "bodyEdits": 945, "fieldEdits": 6, "jointActiveMinutes": 17 }],
  "nextCursor": "<base64 JSON { k, startedAt, id }>"
}
```

Validácia na oboch stranách:
- `days` iba 7 alebo 30;
- `entity`, `bucket`, `peakUsers`, `category` a `sort` zo zoznamu povolených hodnôt; `userId` len so `sort=startedAt`;
- `limit` ≤ 50 (živé ≤ 200);
- `cursor` s kontrolou typov.

```
+------------------------------------------------------------------------------------------------+
| Systém > Štatistiky kolaborácie           [ Živé ] [ 7 dní ] [ 30 dní ]                         |
+================================================================================================+
| ŽIVÉ (obnovené 09:30:05, každých 10 s)   [ S 1 človekom  5 ]   [ S 2+ ľuďmi  2 ]                |
|  Článok          Od     Moderátor   Zamknuté polia          Vnútri (od; telo / polia / zámky)   |
|  Titulok článku  08:58  A. Novák    titulok (B. Kováčová)   A. Novák 08:58; 640 / 3 / 5         |
|                                                             B. Kováčová 09:02; 98 / 1 / 2       |
+================================================================================================+
| 7 DNÍ   [ Sólo 5 620 · 1 640 preklikov · ø 10 min ]   [ 2+ ľudia 63 · 11 skutočných ]           |
|  Ľudí  Relácie  Preklik  Len prít.  Oddelené  Skutočná  ø trvanie  Telo    Polia  ø editorov   |
|  2       52       23       18         3         8        34 min    15 200   290     1,3  [>]   |
|  3        8        2        3         1         2        68 min     5 100    95     1,9  [>]   |
|  Graf po dňoch | Histogram hodín | Najviac spolupracujú | Kto s kým                             |
|  [>] Zoznam (triediť: začiatok / trvanie / spoločne aktívne; kurzor, 50 na stranu)              |
+------------------------------------------------------------------------------------------------+
| DETAIL  Titulok článku, 22.10. 09:58–11:12, 2 ľudia, skutočná spolupráca, 17 spoločných minút   |
|  Účastník     Moderátor  Prítomný  Aktívne min.  Telo  Polia  Zámky  Prvá / posledná  Polia     |
|  A. Novák     áno        74 min    38            812   4      6      10:00 / 11:10   Titulok 3, SEO titulok 1 |
|  B. Kováčová  –          65 min    11            133   2      3      10:05 / 10:41   Perex 2   |
+------------------------------------------------------------------------------------------------+
```

### 10.10 Cena na horúcej ceste (odvodené z kódu, nemerané)

Záťaž z merania (`krok5-praca/perf/lib/scenarios.mjs:44-46`): scenár b = 30 miestností × 3 editori × 2 úpravy/s =
180 úprav/s; d = b na 2 inštanciách; c = cykly zámkov (miestnosti `cms:page:`, ktoré štatistiky nerátajú).

| Čo | Redis cesty/s | Poznámka |
|---|---|---|
| úprava tela | 0 | `onChange`: hľadanie v `Map`, prirátanie, `Set.add` minúty |
| flush (5 s), scenár b | 6 | 30 miestností na 1 inštancii; ~2 + 6 príkazov na účastníka v Lua |
| flush, scenár d | ≤ 12 | 30 miestností na každej z 2 inštancií |
| flush, 90 editorov každý v inej miestnosti, 2 inštancie | ≤ 18 | posudok codex 12 (predošlých 36 bolo zle) |
| úprava poľa (zmena alebo uvoľnenie s dátami) | +1 `HGET` na udalosť | pred `mayStore`; scenár c by dal ~90/s, keby počítal |
| udalosť členstva | +1 Lua cesta, poslaná pod zámkom, nečakaná (`OPTIMALIZACIE.md` bod 7, pôvodne čakaná) | vstup, odchod, odpojenie; zámok miestnosti sa na jej odpoveď nedrží |
| finalizér | 1–3 cesty do Redisu na reláciu, 1 transakcia do Monga za minútu | mimo handlerov |

„Bez dopadu na latenciu" nie je overené. Rozhodne perf brána 10.13/4.

### 10.11 Testy

Vitest so zamockovaným Redisom a Mongom ako dnes (`vitest.config.mts`, `test/*.test.ts`):

1. Telo: `onChange` s originom `connection` sa ráta, s `redis` a `local` nie. Update bez zmeny dokumentu (`onChange` sa
   nezavolá) sa nezaráta. Offline zmena v `SyncStep2` sa zaráta. Hook pri internej chybe nehodí. Integrácia vo vzore
   `test/hocuspocus.test.ts`: dvaja provideri, úpravy sa pripíšu správnym používateľom.
2. Polia:
   - zmena alebo uvoľnenie s inou hodnotou ako v Redise je úprava, s rovnakou nie (ozvena `alternateLinks` po uložení);
   - select so zmenou a uvoľnením tej istej hodnoty dá jednu úpravu;
   - bez uloženej hodnoty sa úprava nezaráta;
   - systémové polia sa ignorujú;
   - `HGET` je pred `mayStore` a medzi `mayStore` a `HSET` nie je `await` (spy na poradie volaní);
   - súbeh dvoch používateľov na jednom poli (B2).
3. Členstvo a zosúladenie (logika Lua zrkadlená v TS, samotný Lua proti skutočnému Redisu len s `REDIS_TEST_URL`):
   - odchod nahradenej karty, neskoré odpojenie a purge nahradených socketov nič nepokazia;
   - odchod nezaloží účastníka;
   - zosúladenie otvorí a zavrie podľa `userIds`;
   - finalizér zavrie otvorené prítomnosti k `endedAt`.
4. Klasifikácia: sólo, preklik, len prítomnosť, oddelené úpravy (12 min), skutočná spolupráca (4 min), 2 úpravy tela pod
   prahom, len titulok (1 úprava poľa).
5. **Finalizér exactly-once**:
   - pád po commite a pred `DEL` → ďalší beh nájde markery a nič nepripočíta;
   - zlyhaný commit → nič sa nezapíše, relácie zostanú v `pending`;
   - dva behy naraz → mutex pustí jeden;
   - preskórovanie `pending`;
   - rada `collab-stats` s `removeOnComplete` a `removeOnFail`.
6. Mongo dole: spojenie štatistík na `mongodb://127.0.0.1:1`.
   - Finalizér nehodí a breaker sa otvorí raz s jedným `warn`.
   - Handlery a `onChange` Monga nevolajú (spy).
   - Po návrate Monga sa čakajúce relácie zapíšu raz.
7. Čítanie: `maxTimeMS`, `hint` s menom indexu, projekcia, `limit`; kurzor `(k, startedAt, _id)`; `userId` s iným
   triedením → 400; semafor → 429; cache a single-flight.
8. Bezpečnosť: bez `SYS_API_TOKEN` alebo so zlým → 401; semafor → 429; tlmený `warn`; snímok
   cez `serverSideEmitWithAck` neposiela handshake (tvar odpovede).

### 10.12 Časti, veľkosti a poradie

| Časť | collaboration | core-cms | admin-cms |
|---|---|---|---|
| A. Živý tab (hotové v `756a13e`) + **následná úloha** pre rozhodnutie 9: semafor 429, tlmený `warn`, snímok cez `serverSideEmitWithAck` | S (následná úloha) | S (proxy cez existujúci klient `anzu_collaboration`, články, mená) | S–M (tab, karty, tabuľka, polling 10 s) |
| B1. Stav relácie v Redise, Lua členstva so zosúladením, kontrola živosti, finalizér (vlastná rada, mutex, preskórovanie, transakcia s markermi), `collab_daily`, `collab_daily_users`, `collab_sessions`, samostatná inštancia mongoose, breaker | M–L | – | – |
| B2. Úpravy: `onChange`, porovnanie polí pred `mayStore`, zámky, pamäťový agregátor, Lua flush, `fieldsChanged`, klasifikácia | M | – | – |
| C. Taby 7 a 30 dní: `summary`, `people`, `sessions` s kurzorom, detail, cache, semafor, `hint` | M | S–M (štyri cesty proxy, validácia) | M–L (taby, koše, grafy, ľudia, `VDataTableServer`, route detailu) |
| E. Kritériá 10.13 vrátane nového perf scenára | M | S | – |
| **Spolu** | **L** | **M** | **M–L** |

Poradie (všetko do `next` ako samostatné PR):
1. A + jej následná úloha;
2. **B1 a B2 spolu** (rozhodnutie 10: do produkcie nikdy nejdú relácie bez úprav, takže netreba príznak „bez dát o
   úpravách"), za bránami 10.13/4–7 (perf, Mongo dole, spojenie, stropy) a s novým scenárom;
3. C s kritériami 10.13/1–3 a /8.

### 10.13 Akceptačné kritériá

Prostredie: staging Atlas rovnakého tieru a verzie ako produkcia (DevOps), náhradne lokálny replica set rovnakej major
verzie (transakcie potrebujú replica set). Build collaboration z PR, perf nástroj `krok5-praca/perf`.

**Brány B1 a B2** (rozhodnutie 10):

- **(4) Perf zapnuté a vypnuté**: scenáre b (`lib/scenarios.mjs:44-46`) a d, a **nový scenár rotácie článkov**.
   - Nový scenár: miestnosti `cms:article:` (moderované, ako `generatorWorker.mjs:146`, `:164-174`), v každej moderátor
     píše a dvaja ďalší cyklicky žiadajú o vstup, sú schválení, vstúpia, píšu, odídu alebo dajú reload (disconnect a
     nový vstup). Občas kick a odovzdanie moderovania.
   - Počas behu ide záťaž dashboardu (1 požiadavka/s).
   - Kritérium: rozdiel mediánov p50, p95 a p99 latencie úprav a ackov vstupu a odchodu, CPU, RSS a oneskorenia slučky
     udalostí je menší ako rozptyl troch vypnutých behov (`lib/analyze.mjs`).
- **(5) Mongo dole pod záťažou**: počas scenára b a scenára rotácie článkov zastaviť Mongo na 2 min. Merajú sa dva behy,
   so štatistikami zapnutými a vypnutými.
   - Kritérium: so štatistikami **nie je horšie** ako bez nich (latencia úprav, chyby handlerov, acky).
   - Breaker sa otvorí raz, do fake Sentry (`lib/fakeSentry.mjs`) príde jeden `warn`.
   - Relácie čakajú v `pending` a po návrate Monga sa zapíšu raz, so súčtami zhodnými s reláciami.
   - Nečaká sa, že nový štart spolupráce bez Monga prejde (`removeEditorsData` a načítanie tela, 10.7, mimo rozsahu).
- **(6) Spojenie štatistík** (unit testy; kód ide s B1 a B2): samostatná inštancia mongoose, `maxPoolSize` 2–3,
   `bufferCommands: false`, krátke timeouty, debug vypnutý, zápisy finalizéra `primary` v transakcii.
- **(7) Stropy** (kód ide s B1 a B2): účastníci ≤ 50 (`participantsOverflow`), `fieldsChanged` ≤ 50 kľúčov a `other`,
   minúty ≤ 480 na účastníka v Redise, `byUser` ≤ 1 000 a `byPair` ≤ 2 000 kľúčov na deň. Finalizér overí BSON relácie
   pod 256 KB (`BSON.calculateObjectSize`; odvodené), inak oreže `fieldsChanged` najmenej aktívnych účastníkov. Test
   so stropovým dokumentom.

**Brány C:**

- **(1) Dáta 10×**: 150 000 `collab_sessions` na 30 dní (koše 75/18/5/2 %, všetky kategórie, 1 % na strope 50 účastníkov
   a 50 polí), 30 `collab_daily` a 30 `collab_daily_users` (na strope kľúčov), 10 000 markerov. Kontrolné súčty
   (skript bez `allowDiskUse`) sa zhodujú s dennými dokumentmi.
- **(2) Explain každého dotazu** z 10.6, pre každé triedenie, s `$in` aj bez, prvá aj hlboká strana kurzora, relácie
   človeka, detail a denné dotazy.
   - Plán: IXSCAN alebo SORT_MERGE nad IXSCAN s menovaným indexom, bez COLLSCAN a blokujúceho SORT.
   - `totalDocsExamined` ≤ 1,1 × `nReturned` (+1 pri kurzore).
   - Bajty strany zoznamu sa zmerajú (posudok codex 9).
   - p95 zo 100 opakovaní (návrh): denné ≤ 20 ms, strana zoznamu ≤ 50 ms, relácie človeka ≤ 50 ms, detail ≤ 20 ms.
- **(3) 20 paralelných požiadaviek** cez core-cms na všetky endpointy, 2 min. Musí ukázať single-flight (1 dotaz na
   kľúč), cache, semafor s 429 a limit výpočtov; opcounters a CPU Monga v šume.
- **(8) Strážcovia dotazov** (unit testy):
   - žiadna agregácia na ceste dashboardu, inde len `allowDiskUse: false`, bez `$lookup`;
   - dotaz bez rozsahu kód odmietne;
   - každý dotaz má `maxTimeMS`, `hint`, projekciu a `limit`.

