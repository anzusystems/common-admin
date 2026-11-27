# HOCUS-FUNKCIE: čo z Hocuspocus 4.7.1 použiť v kolaboračnom serveri

Otázka vlastníka: má dokumentácia Hocuspocus funkcie, ktoré by sme mohli použiť, alebo ktoré by nahradili niečo naše?
Server `/home/volar/projects/petit/collaboration`, vetva `next`, pracovný strom (Hocuspocus 4.7.1, ESM, Node 24). Klient
admin-cms (`src/domains/system/composables/collab/hocuspocus.ts`, `ArticleBodyEditor.vue`) a common-admin
(`src/domains/collab/`). Nič sa nespúšťalo (beží meranie výkonu), len čítanie zdrojákov, `gh release view`, ctx7 a
tiptap.dev.

Zdroje: zdrojáky v `node_modules/@hocuspocus/{server,extension-redis,extension-database,provider}/src` (4.7.1),
`node_modules/crossws/dist` (0.4.15, nesie zbalený `ws`), zdroják `extension-throttle` z tagu v4.7.1 (`gh api`), release
notes v4.0.0–v4.7.1, docs tiptap.dev/docs/hocuspocus (cez ctx7 `/websites/tiptap_dev_hocuspocus` a upgrade guide).
**Overené** = čítané v zdrojáku alebo v docs/release notes; **odvodené** = môj záver, nemeraný a neskúšaný.

Ako je to u nás dnes (kvôli kontextu): socket.io (port 3007, `/ws`) nesie celý protokol miestnosti: členstvo,
moderátora, žiadosti s BullMQ, zámky polí (redlock + Redis hash), dáta polí, info odbery. Hocuspocus (port 3006, `/`) nesie
len telo článku, jeden dokument `${roomName}:${field}` na stránku; `onAuthenticate` overí JWT z cookie a že používateľ má
socket.io socket v miestnosti (`src/server/document/authorizeDocument.ts:10-27`). Pred oboma je nginx v tom istom pode
(`docker/app/kubernetes/etc/nginx/conf.d/proxy.conf.template:6-48`), repliky škáluje HPA, viac inštancií spája Redis
extension a redis-streams adaptér.

## Zoznam (najlepšie prvé)

1. **`flushDelay: false` na serveri (A/B v meraní výkonu)**
   - popis: od 4.4.0/4.5.0 server dávkuje rozosielanie aktualizácií a awareness; predvolené `flushDelay: 0` znamená
     „pošli až v `setImmediate`", teda po celej poll fáze slučky, a pri viacerých zmenách za kolo ich spojí
     `Y.mergeUpdates`. `false` vracia správanie spred dávkovania (rozoslanie synchrónne v tom istom ticku ako v3). Overené:
     `node_modules/@hocuspocus/server/src/types.ts:197-237`, `Document.ts:271-284`, `:335-358`, `:379-437`, predvolená
     hodnota `Hocuspocus.ts:40`; release notes 4.4.0 („add `flushDelay` option"), 4.5.0 („batch updates before sending
     to clients"). V tabuľke nastavení na tiptap.dev chýba (je tam len klientsky `flushDelay`). U nás nenastavené:
     `src/server/hocuspocus.ts:29-35`.
   - prínos: odvodené — najpriamejší kandidát na časť 2–3× horšieho p99 latencie aktualizácie oproti v3: pri záťaži
     poll fáza spracuje všetky pripravené sockety (aj socket.io, Redis odpovede) skôr, než `setImmediate` rozošle zmenu
     ostatným. Pri pár pisateľoch na článok sa takmer nič nespája, takže dávkovanie nám nič nešetrí.
   - riziko/obmedzenie: pri desiatkach súčasných pisateľov v jednom dokumente viac správ (nie náš prípad). Na CPU
     pravdepodobne malý vplyv; Redis extension má vlastné `setImmediate` bez prepínača (bod 13).
   - veľkosť: S (jeden riadok v `Server({...})`).
   - odporúčanie: **now** — pridať ako variant do prebiehajúceho merania (`next` vs `next + flushDelay:false` vs v3) a
     ponechať, ak zlepší p99.

2. **Súbeh pri prvom načítaní tela na dvoch inštanciách (súvisí s otázkou „DirectConnection a `fetchDocument`")**
   - popis: nie je to funkcia Hocuspocus, ale zistenie pri otázke, či DirectConnection nahradí stavbu dokumentu.
     `fetchDocument` pri prázdnom Mongu postaví Y.Doc z JSON v Redise cez `TiptapTransformer.toYdoc`, uloží ho a vráti
     (`src/server/document/fetchDocument.ts:19-46`). Transformer robí `new Doc()` s náhodným `clientID`
     (`node_modules/@hocuspocus/transformer/src/Prosemirror.ts:55-66`). Hocuspocus zlúči súbežné načítania len v jednej
     inštancii (`Hocuspocus.ts:341-371`). Pri štarte kolaborácie sa moderátor aj pripájajúci sa pripoja takmer naraz
     (`joinCollabRoomListener.ts:93-122` → `ArticleBodyEditor.vue:188-198`); ak padnú na dva pody, oba nájdu prázdne
     Mongo, postavia dva rôzne Y stromy s rovnakým obsahom a Redis extension ich zosynchronizuje do jedného — obsah tela
     by bol dvakrát. Overené: kód ciest; odvodené: že sa to v praxi stane (nereprodukované).
   - prínos: odhalenie možnej straty/zdvojenia obsahu tela pri viacerých replikách.
   - riziko/obmedzenie: oprava nie je v Hocuspocus. Možnosti: zámok okolo stavby (máme redlock, `exectionLockHelper.ts`),
     postaviť binárku už v `startCollaboration` pred pripojením klientov, alebo deterministický `clientID` pre počiatočný
     obsah (rýchle, ale citlivé, ak by starý klientsky Y.Doc prežil do novej relácie). DirectConnection to nerieši, sama
     volá ten istý `fetch` (bod 10).
   - veľkosť: S na overenie (test s dvoma inštanciami alebo dvoma `Hocuspocus` v jednom procese nad spoločným Mongo/Redis),
     M na opravu.
   - odporúčanie: **now** overiť; oprava podľa výsledku.

3. **Ukladanie bez druhého `encodeStateAsUpdate`**
   - popis: `extension-database` pred volaním nášho `store` už zakóduje celý stav a pošle ho ako `state`
     (`node_modules/@hocuspocus/extension-database/src/Database.ts:56-61`, typ `storePayload.state` v `types.ts:556-559`).
     Náš `store` ho ignoruje a kóduje celý dokument znova (`src/server/document/storeDocument.ts:14`). Overené.
   - prínos: o jedno plné zakódovanie dokumentu menej pri každom uložení (každé ≥ 2 s na aktívny článok, viď bod 4).
   - riziko/obmedzenie: žiadne podstatné; `state` je `Buffer`, `fromUint8Array(state)` z js-base64 ho prijme.
   - veľkosť: S.
   - odporúčanie: **now**.

4. **`debounce` / `maxDebounce` vyššie (napr. 5000 / 30000 ako v príklade docs)**
   - popis: predvolené 2000 / 10000 ms (`Hocuspocus.ts:29-30`; docs „Configure Hocuspocus Server", príklad s 5000/30000).
     Každé uloženie = 2× kódovanie (bod 3), base64, `findOneAndReplace` celého stavu do Monga a pri viacerých inštanciách
     redlock získanie + uvoľnenie v Redise (`extension-redis/src/Redis.ts:596-646`). Overené.
   - prínos: 2–3× menej zápisov do Monga a kódovaní počas písania. Odvodené: na rozdiel v3 → v4 to nevplýva (v3 ukladala
     rovnako), znižuje to absolútnu záťaž.
   - riziko/obmedzenie: odvodené — malé. Pri poslednom odpojení sa ukladá hneď (`unloadImmediately: true`,
     `Hocuspocus.ts:254-264`), `destroy()` spláchne čakajúce uloženia (`Server.ts:240-242`), iná inštancia sa pri načítaní
     dosynchronizuje od peerov (`awaitInitialSyncTimeout`, `Redis.ts:355-395`) a klienti po výpadku servera pošlú svoj
     stav pri resyncu. Mongo je u nás len vyrovnávacia pamäť kolaborácie; článok ukladá klient moderátora cez API.
   - veľkosť: S.
   - odporúčanie: **now** (spolu s bodom 3).

5. **`stopOnSignals: false`**
   - popis: `Server.listen()` pri predvolenom `stopOnSignals: true` zaregistruje na SIGINT/SIGQUIT/SIGTERM vlastný handler
     `await destroy(); process.exit(0)` (`Server.ts:27-30`, `:161-170`). My máme `@ladjs/graceful`, ktorý na tie isté
     signály paralelne zatvára socket.io, Hocuspocus, MySQL, BullMQ worker a Sentry a až potom Redis a Mongo
     (`src/index.ts:47-61`, `node_modules/@ladjs/graceful/index.js:129-131`, `:283-310`). Overené.
   - prínos: odvodené — Hocuspocus handler ukončí proces hneď po svojom `destroy()`, teda skôr, než graceful dokončí
     `worker.close()` (rozbehnutý BullMQ job ostane „stalled"), `Sentry.close()` (stratené udalosti) a zatvorenie Redis/Mongo.
     S `false` riadi koniec len graceful.
   - riziko/obmedzenie: graceful má 5 s timeout (`index.js:268-281`); Hocuspocus `destroy()` pri Redis extension čaká
     `disconnectDelay` 1 s na dokument (`Redis.ts:783-789`), zmestí sa.
   - veľkosť: S.
   - odporúčanie: **now**.

6. **Kontrola Origin v `onUpgrade` + `websocketOptions.maxPayload`**
   - popis: socket.io odmieta cudzí Origin (`src/server/collaboration.ts:28-35`), Hocuspocus nie: nginx posiela `/` na
     port 3006 bez kontroly (`proxy.conf.template:22-34`) a autentifikácia stojí na cookie
     (`authorizeDocument.ts:15`). `onUpgrade` dostane Node `IncomingMessage` pred upgradom a môže ho zastaviť
     (`Server.ts:98-120`; docs hook `onUpgrade`). `websocketOptions` idú do `ws` (`Server.ts:20-24`, docs tabuľka);
     predvolený `maxPayload` zbaleného `ws` je 100 MiB (`crossws/dist/_chunks/libs/ws.mjs`, `maxPayload:104857600`).
     Overené.
   - prínos: odvodené — stránka na inej subdoméne toho istého site (cookie sa pošle) by s cookie prihláseného editora,
     ktorý má článok otvorený v inom tabe, prešla našou autentifikáciou (kontroluje sa len používateľ, nie socket) a
     mohla čítať a meniť telo. Kontrola Origin podľa `collaborationCors` to zavrie. `maxPayload` (napr. 10–20 MiB podľa
     najväčšieho tela) obmedzí jednu správu autentifikovaného klienta.
   - riziko/obmedzenie: treba overiť atribúty cookie `anz_jp`/`anz_js` (SameSite, Domain) — od nich závisí, či je útok
     reálny; `maxPayload` nesmie byť menší než najväčší SyncStep2 celého tela. Kompresiu (`perMessageDeflate`) nechať
     vypnutú, stála by CPU.
   - veľkosť: S.
   - odporúčanie: **now**.

7. **Serverové zatvorenie / readOnly Hocuspocus spojení pri kick, leave, purge a odpojení**
   - popis: Hocuspocus spojenie sa overí raz pri pripojení. Kick, odchod, purge ani odpojenie socket.io socketu ho
     nezatvoria (`kickUserFromRoomListener.ts:30-43`, `purgeRoomListener.ts:22-25`, `disconnectingListener.ts:16-41`,
     nahradené sockety v `roomUserManager.ts:151-201`); spoliehame sa, že klient zničí providera
     (`ArticleBodyEditor.vue:199-213`). API, ktoré na to máme: `server.hocuspocus.documents` (verejná `Map`,
     `Hocuspocus.ts:73`), `document.getConnections()` (`Document.ts:215-217`), `connection.context` = to, čo vrátil
     `onAuthenticate`, u nás `{ id }` (`ClientConnection.ts:531-544`), `connection.close({ code, reason })`
     (`Connection.ts:208-222`), `connection.readOnly = true` za behu (`Connection.ts:41`, kontrola pri každej správe
     `MessageReceiver.ts:234`, `:276`; docs príklad v `onTokenSync`), pri purge `hocuspocus.closeConnections(name)`
     (`Hocuspocus.ts:191-205`). Overené.
   - prínos: server vynúti, že kto nie je v miestnosti, nepíše do tela; po purge/novom štarte sa dokument naozaj uvoľní z
     pamäte (dnes `removeEditorsData` maže len Mongo, `roomDataManager.ts:43-45`, a dokument držaný otvoreným spojením
     prežije a odložené uloženie ho do Monga zapíše späť — odvodené).
   - riziko/obmedzenie: Hocuspocus spojenie užívateľa môže byť na inej inštancii → treba `io.serverSideEmit(...)`
     (redis-streams adaptér ho podporuje, `collaboration.ts:39-40`; lokálnu inštanciu treba obslúžiť zvlášť). Bez bodu 8
     nevieme, ktoré Hocuspocus spojenie patrí ktorému tabu, takže pri odpojení jedného z viacerých tabov zatvárať len vtedy,
     keď už užívateľ v miestnosti nemá žiadny socket. Treba prerušiť kruhovú závislosť `hocuspocus.ts` ↔ listenery (malý
     register inštancie).
   - veľkosť: M.
   - odporúčanie: **later** (po 2.0.0; obranná vrstva, legitímny klient to robí sám).

8. **Token = id socket.io socketu (väzba Hocuspocus spojenia na konkrétny tab)**
   - popis: provider posiela `token: 'token'` (admin-cms `hocuspocus.ts:10`), server ho nečíta. `onAuthenticate` dostane
     `token` (`types.ts:320-331`). Keby klient posielal id svojho socket.io socketu, server by overil, že práve tento
     socket je v miestnosti a patrí tomu istému používateľovi (`authorizeDocument.ts:16-21` dnes berie hociktorý socket
     používateľa), a uložil ho do kontextu. Overené: API; návrh je odvodený.
   - prínos: cudzia stránka s cookie id socketu nepozná → druhá vrstva k bodu 6; bod 7 potom vie zatvoriť presne spojenie
     odpojeného alebo nahradeného tabu.
   - riziko/obmedzenie: common-admin musí id socketu vystaviť (dnes interný `collabSocket` v `useCollabStateInternal`);
     po reconnecte socket.io má socket nové id → provider musí pri novom pripojení poslať nové (token môže byť funkcia,
     `HocuspocusProvider.ts:77`), inak zlyhá re-auth. Zmena v troch repozitároch.
   - veľkosť: M.
   - odporúčanie: **later**.

9. **Klientsky `flushDelay` v provideri (napr. 50–100 ms)**
   - popis: provider vie dávkovať odchádzajúce Yjs zmeny (`Y.mergeUpdates`) aj awareness do pevného okna; predvolene
     vypnuté (`provider/src/HocuspocusProvider.ts:101-115`, `:148`, `:395-470`; docs „Batching outgoing updates").
     Admin-cms ho nenastavuje (`hocuspocus.ts:7-11`). Overené.
   - prínos: odvodené — pri rýchlom písaní a pohybe kurzora výrazne menej správ na server; každá správa stojí 3 reťazce
     hookov, dekódovanie, SyncStatus potvrdenie, rozoslanie, pri awareness aj scratch dekódovanie/kódovanie (bod
     „Čo sa nastaviť nedá") a pri viacerých inštanciách kolo SyncStep1/SyncStep2 cez Redis (bod 13). To je najväčšia páka
     na CPU servera v reálnej prevádzke.
   - riziko/obmedzenie: ostatní editori vidia zmeny až o `flushDelay` neskôr; metrika p99 latencie v meraní sa tým zhorší
     z definície (nemiešať s bodom 1). Kód je mladý (4.7.1 opravoval odoslanie dávky pri skrytej stránke).
   - veľkosť: S.
   - odporúčanie: **later** — samostatné meranie po bode 1.

10. **`DirectConnection` / `openDirectConnection`**
    - popis: serverový zápis do dokumentu cez `transact` s pôvodom `{ source: 'local', context, skipStoreHooks? }`
      (`DirectConnection.ts:30-45`, `types.ts:16-25`; docs „Open direct connection"). Room-data nenahradí: endpoint
      prenáša dáta polí mimo Y.Doc len do socket.io (`onRequestHook.ts:56-91`) a volá ho core-cms len pre boxy a scenáre
      (`core-cms/src/Domain/Box/Messenger/Handler/ChangedBoxItemsBySystemHandler.php:33`,
      `Domain/Scenario/Messenger/Handler/ScenarioJobChangedHandler.php:59`). `fetchDocument` nenahradí: priama konexia
      dokument načíta tou istou cestou (`Hocuspocus.ts:649-667` → `createDocument` → náš `fetch`) a s
      `new Request("http://localhost")` bez parametrov — náš fetch by spadol na chýbajúcom `roomName`
      (`fetchDocument.ts:14-17`), ak by sa `roomName` nečítal aj z `context` (fetch ho dostáva, `types.ts:545-554`,
      `Hocuspocus.ts:383`, `:407-416`). Overené.
    - prínos: odvodené — použiteľné, keby backend potreboval zapisovať do tela počas kolaborácie (vloženie embedu,
      serverová korektúra), alebo na reset tela pri novom štarte kolaborácie namiesto mazania Monga (bod 7).
    - riziko/obmedzenie: pri viacerých inštanciách sa zmena šíri cez Redis extension; `disconnect()` predvolene ukladá a
      uvoľňuje hneď (`DirectConnection.ts:47-102`), Redis extension pri lokálnom pôvode čaká `disconnectDelay`
      (`Redis.ts:648-678`).
    - veľkosť: M.
    - odporúčanie: **later** (dnes chýba prípad použitia); **no** ako náhrada room-data aj `fetchDocument`.

11. **Počty dokumentov a spojení do metrík / health endpointu**
    - popis: `getDocumentsCount()`, `getConnectionsCount()` (`Hocuspocus.ts:150-172`), hooky `connected`, `onDisconnect`,
      `afterUnloadDocument` (`types.ts:94`, `:132-134`). Overené.
    - prínos: viditeľnosť záťaže na pod (HPA, Sentry), dnes nič také nemáme.
    - riziko/obmedzenie: `getConnectionsCount` prechádza všetky dokumenty — volať zriedka, nie pri každej správe.
    - veľkosť: S.
    - odporúčanie: **later**.

12. **`beforeHandleAwareness` (od 4.1.0) a `onAwarenessUpdate`**
    - popis: hook dostane dekódované awareness stavy ako meniteľnú `Map` a množinu odobratých klientov; môže prepísať
      polia, zahodiť peera, zakázať odobratie cudzieho, alebo celú správu odmietnuť (`types.ts:108-121`, `:443-487`).
      Overené.
    - prínos: malý — vynútenie mena/farby z CollaborationCaret (`ArticleBodyEditor.vue:107-110`) podľa servera; medzi
      prihlásenými editormi nízke riziko podvrhu.
    - riziko/obmedzenie: ďalšia práca pri každej awareness správe; scratch dekódovanie a prekódovanie beží aj bez hooku
      (`MessageReceiver.ts:82-124`).
    - veľkosť: S.
    - odporúčanie: **no**.

13. **Redis extension: nastavenia a náklad na zmenu**
    - popis: voľby `lockTimeout`, `disconnectDelay`, `awaitInitialSyncTimeout` (4.4.0), `prefix`, `identifier`
      (`Redis.ts:41-104`, `:135-143`). Zmena sa medzi inštanciami nešíri ako update, ale ako SyncStep1 po `setImmediate`
      (4.6.0, `Redis.ts:468-507`, `:768-778`); peer odpovie SyncStep2 (rozdiel voči stavovému vektoru + celý delete set)
      už len žiadateľovi (4.7.0, `Redis.ts:743-756`) a sám pošle SyncStep1 späť (`MessageReceiver.ts:214-223`). Overené.
    - prínos: žiadna z volieb neznižuje náklad na jednu zmenu. Odvodené: na zmenu ~1,5 kola cez Redis a dve
      `encodeStateAsUpdate` na každom peerovi; delete set rastie s históriou úprav článku. Vlastná extension, ktorá
      publikuje priamo `update` z `onChange` (+ občasný SyncStep1 proti stratám pub/sub), by to skrátila na jednu správu.
    - riziko/obmedzenie: vlastná extension = vlastná správnosť synchronizácie (4.7.0 práve opravoval poškodenie
      dokumentu, #1151). Neviem, či meranie beží s jednou alebo viacerými inštanciami — od toho závisí váha.
    - veľkosť: L.
    - odporúčanie: **later**, len ak profil viacerých inštancií ukáže Redis extension ako hlavný náklad.

14. **Obísť crossws (vlastný `ws`) alebo uWebSockets.js**
    - popis: v4 `Server` = crossws Node adaptér nad zbaleným `ws` (`Server.ts:56-96`); na správu vznikne obal
      `Message` (`crossws/dist/_chunks/node.mjs:52-56`), `peer.websocket` je `Proxy` (`peer.mjs:116-123`, `:197-207`), cez
      ktorý ide každé `readyState` a `send` (`Connection.ts:167-181`). (a) Vlastný `node:http` + `ws` +
      `hocuspocus.handleConnection(ws, Request)` je zdokumentovaný v4 vzor (upgrade guide §9); vtedy nebežia `onRequest`,
      `onUpgrade`, `onListen` (docs, príklad Express) a heartbeat, `touch()` na pong, `handleMessage`, `handleClose` si
      zapojíme sami. (b) uWebSockets.js: docs ho len vymenúvajú medzi podporovanými behmi, príklad nemajú; crossws uws
      adaptér dáva ako `peer.websocket` objekt bez `send`/`close` (`crossws/dist/adapters/uws.mjs:165-180`), takže treba
      obal ako v Bun príklade v docs; balík nie je v npm registri (inštalácia z GitHubu, natívna binárka viazaná na ABI
      Node); naše HTTP endpointy (`onRequestHook.ts`, Node `IncomingMessage`/`ServerResponse`) by sa prepisovali na uWS
      API. Socket.io beží na inom porte za nginxom, spoločný port nepotrebujeme. Overené: kód a docs; váha je odvodená.
    - prínos: odvodené — malý; crossws vrstva je synchrónna a tenká, CPU berie Yjs, reťazce hookov a Redis. uWS by šetril
      rámcovanie a pamäť na socket, nie prácu Hocuspocus.
    - riziko/obmedzenie: (a) M, prevezmeme údržbu integrácie; (b) L, natívna závislosť mimo npm, iný HTTP model.
    - veľkosť: (a) M, (b) L.
    - odporúčanie: **no** pre 2.0.0; (a) **later**, iba ak profil ukáže crossws/ws nad ~10 % CPU.

15. **Throttle extension**
    - popis: nie je nainštalovaná. V 4.7.1 počíta pokusy v `onConnect` (pri každom dokumente, nie pri websockete), IP berie
      z `x-real-ip` alebo celej hlavičky `x-forwarded-for`, pamäť má na inštanciu; predvolene 15 pokusov za 60 s a ban
      5 min (zdroják z tagu v4.7.1; docs „Throttle"). Overené.
    - prínos: malý. Naša autentifikácia odmietne bez cookie lacno ešte pred `fetchSockets`
      (`authorizeDocument.ts:15-16`), limity pred autentifikáciou už sú (4.3.0, `types.ts:276-302`).
    - riziko/obmedzenie: odvodené — redakcia za jednou NAT IP: každé prepnutie stavu kolaborácie vytvorí nového providera a
      nový `onConnect` (`ArticleBodyEditor.vue:188-222`), 15 za minútu sa dá dosiahnuť a ban by zasiahol všetkých. Nginx
      `x-real-ip` nenastavuje (`proxy.conf.template:22-28`), každá replika počíta zvlášť.
    - veľkosť: S.
    - odporúčanie: **no**; ochranu dá bod 6.

16. **Stateless správy alebo awareness namiesto socket.io protokolu (celého alebo časti)**
    - popis: `sendStateless` / `onStateless` / `broadcastStateless` / `beforeBroadcastStateless` (`Connection.ts:186-192`,
      `Document.ts:448-474`, `types.ts:123-126`; docs hooky), cez inštancie ich nesie Redis extension
      (`Redis.ts:809-818`, `MessageReceiver.ts:143-163`). Stateless je reťazec bez potvrdenia a timeoutu, viazaný na
      dokument (ten sa musí načítať cez náš `fetch`, ktorý potrebuje `roomName` a dáta tela). Awareness je klientsky
      zapisovateľný CRDT stav s 30 s expiráciou, bez autority servera. Overené.
    - prínos: žiadne zjednodušenie. Socket.io nám dáva to, čo Hocuspocus nemá: potvrdenia s timeoutom
      (`collabField.ts:144-146`, `roomUserManager.ts:261-276`), členstvo naprieč inštanciami (`fetchSockets`,
      `roomUserManager.ts:203-204`), info miestnosti `${room}:info`, `serverSideEmit`, a prítomnosť aj bez otvoreného tela
      (zoznam článkov, `fetchRoomsInfo`). Redlock, BullMQ a moderovanie by zostali. Awareness už používame tam, kde sedí
      (kurzory, CollaborationCaret).
    - riziko/obmedzenie: prepis collab domény v common-admin aj admin-cms a servera; vysoké riziko regresií v práve
      ladených okrajových prípadoch (reconnect, nahradené sockety, presun zámkov).
    - veľkosť: L.
    - odporúčanie: **no**.

17. **Dáta polí (mimo tela) v Y.Doc miestnosti namiesto Redis hashu**
    - popis: hodnoty polí by boli v `Y.Map` dokumentu miestnosti namiesto `data:${room}` a udalostí
      `changeFieldData`/`collabRoomDataChanged` (`roomDataManager.ts:47-68`, `changeFieldDataListener.ts:31-62`).
      Odvodené.
    - prínos: resync po reconnecte a perzistencia zadarmo.
    - riziko/obmedzenie: zámky polí s odovzdaním hodnoty pri uvoľnení (`releaseFieldLockListener.ts:65-101`) a obálka s
      autorom ostávajú, Y.Map by bola len iný transport; info o miestnosti mimo editora ju potrebuje tiež.
    - veľkosť: L.
    - odporúčanie: **no**.

18. **Multiplexing (`HocuspocusProviderWebsocket`) a `sessionAwareness`**
    - popis: provider bez `websocketProvider` si vytvorí vlastný socket (`provider/src/HocuspocusProvider.ts:292-294`);
      zdieľaný socket nesie viac dokumentov, `sessionAwareness` (predvolene `false`, `:84-94`) dovolí dvoch providerov s
      rovnakým menom na jednom sockete (release notes 4.0.0). Overené.
    - prínos: u nás žiadny — stránka má jeden kolaboratívny dokument (telo).
    - riziko/obmedzenie: `roomName` je v URL websocketu (admin-cms `hocuspocus.ts:8`, `authorizeDocument.ts:11`) a cookie sa
      číta z hlavičiek handshaku (`authorizeDocument.ts:15`) → dlho žijúci zdieľaný socket by nové dokumenty overoval
      starým (neskôr expirovaným) JWT a nesprávnou miestnosťou.
    - veľkosť: M.
    - odporúčanie: **no**.

19. **`onTokenSync` / `sendToken()` / `requestToken()` (obnova tokenu za behu)**
    - popis: klient pošle nový token, server ho overí bez reconnectu a môže zmeniť `connection.readOnly`
      (`ClientConnection.ts:399-422`, `MessageReceiver.ts:174-186`; docs `onTokenSync`). Overené.
    - prínos: u nás žiadny — overujeme cookie z handshaku, token je atrapa; JWT by klient musel mať v JS.
    - riziko/obmedzenie: —
    - veľkosť: S.
    - odporúčanie: **no** (zmysluplné použitie tokenu je bod 8).

20. **`unloadImmediately: false`**
    - popis: dokument ostane po poslednom odpojení v pamäti, kým nebehne odložené uloženie (`types.ts:268-274`,
      `Hocuspocus.ts:254-264`). Overené.
    - prínos: prepnutie stavu kolaborácie (nový provider) by nenačítavalo dokument znova.
    - riziko/obmedzenie: odvodené — zväčší okno, v ktorom nový štart kolaborácie dostane starý dokument z pamäte, hoci
      `removeEditorsData` zmazal Mongo (body 7 a 10).
    - veľkosť: S.
    - odporúčanie: **no**.

21. **Ostatné hooky a extensions (Logger, Webhook, S3, SQLite; `onChange`, `beforeHandleMessage`, `afterHandleMessage`,
    `beforeSync`, `onConnect`)**
    - popis: Logger len vypisuje hooky do konzoly (u nás vypnutý, `hocuspocus.ts:25-27`), Webhook posiela zmeny na URL s
      transformerom, S3/SQLite sú úložiská (docs „Server Extensions"). `beforeHandleMessage` by mohol odmietať správy
      vyhodeného používateľa, ale potreboval by lacnú lokálnu informáciu o členstve; `fetchSockets` na správu je
      neprijateľný. Overené: zoznam a payloady.
    - prínos: žiadny nad body 7 a 11. Webhook by presúval ukladanie tela na server, no článok ukladá moderátor cez API s
      validáciou.
    - riziko/obmedzenie: —
    - veľkosť: —
    - odporúčanie: **no**.

## Čo sa nastavením neovplyvní (k +12–17 % CPU a 2–3× p99 oproti v3)

Overené v zdrojákoch, bez prepínača; váha je odvodená, potvrdí ju až profil (perf-collab):

- Awareness: pri každej prichádzajúcej awareness správe sa vytvorí scratch `Y.Doc` + `Awareness`, správa sa dekóduje,
  prebehne hook a znova zakóduje (`MessageReceiver.ts:82-124`, od 4.1.0). CollaborationCaret posiela awareness pri
  každom pohybe kurzora. Zmierni to len klientsky `flushDelay` (bod 9).
- Na každú správu dokumentu tri reťazce hookov (`beforeHandleMessage`, `beforeSync`, `afterHandleMessage` od 4.3.0), pri
  každom nový payload a dvakrát `getParameters` → `new URL(...)` (`ClientConnection.ts:323-369`,
  `util/getParameters.ts:4-13`); `hooks()` stavia promise reťazec cez všetky extensions vrátane predvolených no-op
  (`Hocuspocus.ts:111-136`, `:565-599`).
- Usporiadané spracovanie správ na spojenie cez `await` fronty (`Connection.ts:244-302`, 4.0.0) — správa čaká na
  dokončenie async hookov predchádzajúcej.
- Redis extension: `setImmediate` pred publikovaním (4.6.0) a odpovede len žiadateľovi (4.7.0), bod 13.
- crossws vrstva (bod 14), malá.

Návrh poradia merania: v3 / `next` / `next + flushDelay:false` (bod 1), potom zvlášť klientsky `flushDelay` (bod 9);
body 3–6 sú nezávislé od merania.
