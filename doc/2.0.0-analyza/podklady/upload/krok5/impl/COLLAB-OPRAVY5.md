# COLLAB-OPRAVY5: kolaboračný server – piaty cyklus opráv (5 bodov, schválené vlastníkom)

Zadanie `krok5-praca/zadania/zadanie-collab-opravy5.md`, podklad `posudky/COLLAB-OPRAVY4-opus.md` (M1, L1–L3) a
`posudky/collab-opravy4-codex.md` (oznámenia bez kontroly). Repozitár `/home/volar/projects/petit/collaboration`, vetva
`next`, HEAD `8eaad75` + tieto opravy. **Nič necommitnuté**, žiadne vetvy, `stash`, `reset` ani `checkout`; vlastníkova
zmena `.gitignore` nedotknutá. Skripty a logy (mimo `/tmp`): `/home/volar/projects/anzusystems/krok5-praca/collab-opravy5/`.

**Ako sa potvrdzovalo:** stav pred = HEAD `8eaad75`. Testy tohto cyklu bežali aj proti src z HEAD
(`overenie-stary-kod.sh` → `overenie-stary-kod.log`): **10 červených / 114 zelených**. Červené sú všetky testy správania
tohto cyklu; zelené na starom kóde sú len dva, zámerne: stavba dokumentu s neskoro potvrdeným acquire (bod 4, má bežať
ďalej) a leave, ktorého soket sa medzitým vrátil (bod 2, upratovanie nemá nič uvoľniť). Na opravenom kóde **124/124**
(19 súborov; predtým 112).

**Skript s dvoma podmi (bod 1):** `poradie.mts` + `overenie.sh pred|po`, vzor `collab-opravy4/miestnost.mts`. Dve kópie src
v jednom procese (`pody/pred-a`, `pred-b` z `8eaad75`; `pody/po-a`, `po-b` z pracovného stromu): každý pod má vlastný
socket.io server s Redis streams adaptérom, vlastného klienta Redis, zámok miestnosti aj manažérov; **skutočný Redis
7.2.4** (`fix5-collab-redis`, 6391); klienti socket.io-client 4.8.4 s podpísaným JWT. M (moderátor) a U (editor) na pode
A, X a W na pode B. Kick M → X drží miestnosť ~4,6 s: B odpovie na jeho `fetchSockets()` o 4,5 s (zadržaná len táto
jedna odpoveď, ďalšie nie). Poradie, v akom čakajúce zmeny dostanú zámok, je Redlocku (skutočný `Math.random`), preto
10 kôl na scenár, každé v novej miestnosti. Mongo netreba: miestnosti s `allowedSameUser` join nikdy nemaže dokumenty.

| scenár (10 kôl) | pred (`8eaad75`) | po |
|---|---|---|
| `kick-release` (počas kicku U zmení `title` na One, o 150 ms na Two, o 150 ms opustí pole s Two) | **7/10** uložené a M videl **One**, U si myslí Two | 0/10, vždy Two |
| `kick-release-other` (potom W na B vezme pole a opustí ho s Three) | **10/10** Three prepísané (One 4×, Two 6×) | 0/10, vždy Three |
| `burst` (bez kicku: U pošle naraz 20 zmien v1…v20) | **10/10** uložená staršia (v3…v19) | 0/10, vždy v20 |

Logy `poradie-pred-*.log`, `poradie-po-*.log` (každé kolo: odpovede s časom, uložená hodnota, čo videl M).

## Body

### 1. (M1) Poradie zápisov poľa – **potvrdené, opravené**
- Stav: zmena čaká na zámok miestnosti (40 opakovaní), release nie; Redlock nie je FIFO, takže staršia zmena sa uloží po
  novšej aj po release. Skript: pozri tabuľku; `burst` ukazuje, že netreba ani pomalý kick – stačia rýchle zmeny jedného
  soketu, ktoré sa o zámok bijú medzi sebou.
- Predpoklady overené v kóde: socket.io 4.8.4 spúšťa handlery soketu v poradí paketov – `dist/client.js:204-216`
  (`ondecoded` → `process.nextTick` → `_onpacket`), `dist/socket.js:448-461` (`onevent` → `dispatch`), `:685-700`
  (`dispatch` → `run` → `process.nextTick` → `emitUntyped`), `:735-737` (bez `socket.use` hneď `fn()`); server má len
  middleware menného priestoru (`collaboration.ts:48`), nie `socket.use`. Fronta `nextTick` je FIFO a handler beží
  synchrónne po prvý `await`; poradie sa berie prvým príkazom handlera. Medzi `mayStore()` a HSET nie je `await`:
  `storeData` → `storeAllData` (`roomDataManager.ts:36-64`) beží synchrónne až po volanie `hset`; jeden klient ioredis na
  pod (`redis.ts:12`, bez autopipeliningu, offline fronta FIFO), soket je vždy na jednom pode. Empiricky: `burst` po
  oprave 10/10 v20.
- Oprava: nový `src/util/helper/fieldWriteOrder.ts` – `takeFieldWriteOrder(socket, room, field)`: `WeakMap` soket →
  `Map` miestnosť+pole → `{ taken, stored }`, poradie `++taken` zobraté pri príchode; `superseded()` (uložený je novší
  zápis) a `mayStore()` (ak nie je prekonaný, `stored = order`, inak false). `changeFieldDataListener.ts`: poradie na
  `:28`; skoré skončenie hneď po získaní zámku, pred `getLock`/`hasNotUserId` (teda pred čakaním na pody) `:41`;
  `mayStore()` po `assertLockHeld` tesne pred `storeData` `:55`; preskočená zmena odpovie `Ok`.
  `releaseFieldLockListener.ts`: poradie `:29`, zámok uvoľní vždy, dáta uloží a `collabRoomDataChanged` rozošle len ak
  `mayStore()` `:84`, `collabRoomLocksChanged` a `Ok` so zámkami vždy. Bez volania Redis, jeden záznam na soket+pole.
- Testy `changeFieldDataListener.test.ts` (nové 4, `Math.random` = 0,5, druhá zmena prišla o 150 ms neskôr a zámok
  dostane prvá): kick, dve zmeny, release medzi nimi → uložené len Two z release, obe zmeny `Ok`, `hasNotUserId` len raz
  (zmeny skončili pred podmi; starý kód `['Two','Two','One']`); variant s iným editorom → `['Two','Three']` (starý
  `['Two','Three','Two','One']`); dve zmeny bez release → uložená len novšia (starý `['Two','One']`); release starší než
  zmena uložená medzitým → zámok uvoľnený a rozoslaný, dáta nie (starý `['Two','One']`).

### 2. (L1) Zlyhaný leave nechá zámky polí – **potvrdené, opravené**
- Stav: `leaveUserSocket` hneď odoberie miestnosť zo `socket.data.collabRooms`, takže disconnect ju preskočí; keď potom
  zlyhá kontrola zámku, zámky polí soketu ostanú do vyprázdnenia miestnosti alebo 24 h TTL.
- Oprava `leaveCollabRoomListener.ts`: `socketLeft = true` tesne pred `leaveUserSocket` (`:44`); ak leave neodpovedal
  `Ok` a soket už odchádzal (`:82`), po odpovedi `Failed` nový zámok miestnosti (40 opakovaní, miestnosť má iná akcia),
  a ak soket nie je späť v miestnosti, `releaseAllSocketLocks(user, socket.id, true)` – len zámky zapísané tomuto soketu
  (strict, ako upratovanie joinu `joinCollabRoomListener.ts:175`) a `collabRoomLocksChanged` uvoľnených.
- Testy `leaveCollabRoomListener.test.ts`: zámok stratený počas odovzdania moderovania → `Failed`, potom pod novým
  zámkom `releaseAllSocketLocks(1, 'socket-1', true)`, oznámené, zámok uvoľnený (starý kód červený); soket sa medzitým
  vrátil → nič neuvoľnené.

### 3. (L2) Falošné „lease ran out" po predĺžení – **potvrdené, opravené**
- Stav: Redlock `extend()` po odpovedi Redisu nastaví starému zámku `expiration = 0` (`redlock/build/index.js:195`) a až
  ďalší mikrotask pomocníka priradí nový; kontrola medzi tým čítala 0 a prerušila akciu (bezpečne, ale zbytočne).
- Oprava `exectionLockHelper.ts`: vlastné `leaseEnd` – nastavené pri acquire (`:61`) a s novým zámkom (`:100`), 0 pri
  uvoľnení (`:85`); kontrola číta ho (`:78`) namiesto `lock.expiration`. Časovače ďalej z `lock.expiration`.
- Test `exectionLockHelper.test.ts` „passes the check of an action right after an extension, before the helper took the
  new lock": `redlock.extend` obalený tak, že kontrola beží presne po vynulovaní starého a pred priradením nového →
  prejde a akcia skončí `done` (starý kód: kontrola zlyhá, akcia odmietnutá).

### 4. (L3) Zápis pred prvou kontrolou – **potvrdené, opravené (umiestnenie inak než v zadaní)**
- Stav: akcia začala hneď po acquire aj vtedy, keď ho Redis potvrdil až po lease (join zapisuje options `:69`, cleanup
  leave maže aktivitu) – prvá kontrola prišla až po prvom zápise.
- Oprava: jedna kontrola tesne pred `action()` pre **akcie miestnosti** – obal v `executeRoomManagementAction`
  (`exectionLockHelper.ts:148`), nie v `executeExtendedAction`. Dôvod: ten istý pomocník robí stavbu dokumentu, ktorá
  podľa cyklu 4 (bod 6) ukladá len cez `$setOnInsert` a má prebehnúť aj bez zámku; kontrola v `executeExtendedAction` by
  pri acquire potvrdenom po 5 s vrátila chybu a load dokumentu by zlyhal (`permission-denied`, provider neopakuje).
- Testy `exectionLockHelper.test.ts`: acquire potvrdený o 1,1 s → akcia sa vôbec nezavolá, „The lease … ran out"
  (starý kód: akcia beží); stavba s acquire potvrdeným o 5,1 s → prebehne (zelené aj na starom kóde, chráni rozhodnutie).

### 5. (Codex) Odpoveď/oznámenie bez kontroly – **potvrdené, opravené**
- Stav: po čakaní na pody (odchody nahradených soketov v joine; `switchModerator` + `fetchInfo` v kick, transfer,
  procesore moderovania) nasledovali `Ok`/oznámenia bez kontroly.
- Oprava: `assertLockHeld(signal)` v `joinCollabRoomListener.ts:123` (po `Promise.all(left)`, pred broadcastom a `Ok`),
  `kickUserFromRoomListener.ts:36`, `transferModerationListener.ts:30`, `moderationRequestProcessor.ts:23`.
- Testy: join – zámok stratený, kým odchod nahradeného soketu čaká 4,9 s na pody → jedna odpoveď `Failed`, upratovanie
  soket vyvedie (starý kód: `Ok`); kick – stratený počas odchodu → nikomu nič neoznámené (starý: `kickedFromRoom`);
  transfer – stratený počas `fetchInfo` po zmene → nič neoznámené (starý: oznámil). Procesor moderovania bez testu (nemá
  testovací súbor; treba by mockovať `useCollaboration` a BullMQ `Job`).

## Kontroly (`kontroly.sh`, `VITEST_MAX_WORKERS=2`, pred každou > 9,7 GB voľných)
`yarn install` ok (staré YN0086, `yarn.lock` bez zmeny), `yarn dedupe --check` ok, `yarn lint:fix` ok, `yarn ci` ok,
`yarn test` 3 × za sebou **124/124** (6–7 s), `yarn build` ok (`dist/util/helper/fieldWriteOrder.js`), `yarn tsc` ok.
Prod štart z `dist` (`start-prod.sh`): až na `getaddrinfo ENOTFOUND mongo-anzu`, exit 1 po 32 s. Docker: len
`fix5-collab-redis`, na konci `docker rm -f -v` doslovným menom; `perf-collab-*` nedotknuté.

## Zmenené súbory (collaboration)
Nový `src/util/helper/fieldWriteOrder.ts`; `src/util/helper/exectionLockHelper.ts`,
`src/bullmq/processor/moderationRequestProcessor.ts`, listenery `changeFieldData`, `releaseFieldLock`, `joinCollabRoom`,
`leaveCollabRoom`, `kickUserFromRoom`, `transferModeration`; testy `changeFieldDataListener`, `exectionLockHelper`,
`joinCollabRoomListener`, `leaveCollabRoomListener`, `kickUserFromRoomListener`, `transferModerationListener`.

## Ďalšie nájdené problémy (neopravené)
- Poistka radí len zápisy jedného soketu: dve karty toho istého používateľa medzi sebou nie; zmena môže stále prepísať
  hodnotu iného používateľa, ak zámok poľa odosielateľa zanikol bez jeho release (kick, disconnect inej karty, purge),
  kým zmena čakala. `storeAllData` z `startCollaboration` (dáta moderátora pri joine) poistkou nejde (beží pod zámkom).
- Zlyhaný leave (bod 2) uvoľní zámky, ale `collabRoomChanged` nerozošle: ostatní vidia používateľa v miestnosti do ďalšej
  zmeny miestnosti.
- Strict upratovanie leave nechá zámky bez záznamu soketu (staršie než záznam) do posledného leave používateľa alebo TTL.
- Kick (`kickUserFromRoomListener.ts:19`) vyvedie len prvý soket používateľa (`sockets.find`), ale uvoľní všetky jeho
  zámky (`releaseAllUserLocks`): pri `allowedSameUser` druhá karta ostane bez svojich zámkov. Len z čítania kódu,
  skriptom neoverené.

## Neoverené
- Dva pody v jednom procese (oddelené kópie modulov), nie dva skutočné pody; pomalý pod simulovaný zadržanou odpoveďou;
  Kubernetes ani obraz sa nespúšťali.
