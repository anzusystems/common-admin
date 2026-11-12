# PV14c-L4: notifikácie DAM podľa mena konfigurácie, s pôvodom každej udalosti; impl-lib-op12

Zadanie `krok5-praca/zadania/zadanie-PV14c-L4.md` (s doplnkom vedúceho: dráha čítaní a séria zlyhaní podľa
konfigurácie), plán `plan-PV14c.md` (predbežné voľby vedúceho 2 a 5). Strom LIB `/home/volar/projects/anzusystems/common-admin`
(vetva `next`, PV14c-L1 až L3 necommitnuté). Snímok **`PV14c-L4`** (s changelogom a príručkou), záplata
`krok5-praca/zaplaty/PV14c-L4.diff` (15 súborov, 1 122 riadkov). Všetky body hotové, žiadny nezastavený.

Čo vidí redaktor admin-cms, admin-ugc a admin-dam: **nič** (jeden soket alebo žiadny).

## Body

**1. Voľba** (`AnzuSystemsCommonAdmin.ts`): `CommonAdminCoreDamConfig.notification?` (`{ enabled?, webSocketUrl? }`).
`damNotificationSockets()` (`commonAdminCoreDamOptions.ts`, interné) zostaví sokety: `default` prvý, z vlastnej
`notification`, inak z koreňovej (aj vypnutý, ako doteraz); iná konfigurácia len s vlastnou zapnutou `notification`,
normalizovanou ako koreňová (`normalizeDamNotificationOptions`). Konfigurácie s tou istou zapnutou adresou zdieľajú
soket (aj s `default`).

**2. Sokety** (`damNotifications.ts`). `createDamSocket` pre každý soket (doterajšia logika: `useWebSocket`, varovanie
`common.damImage.notificationsNotConnected` po vzdaní, raz za soket, bez nového textu; stav push). `initDamNotifications()`
memoizuje podľa všetkých soketov a ich mien a vracia jednu rúčku: `openConnection`, `closeConnection`, `dispose` na
všetky, `status` soketu `default`, `damNotificationsInitialized` ako doteraz; `destroyDamNotifications()` zavrie všetky.

**3. Pôvod.** Zbernica nesie mená konfigurácií soketu ako druhý argument (`useEventBus<DamNotification, string[]>`;
zbernica nie je v `lib.ts`). Udalosť bez neho (testy, ktoré emitujú priamo) = soket `default`.
`addDamNotificationListener(callback, options?)`: bez volieb len soket `default`, `{ configName }` soket tej
konfigurácie, `{ all: true }` všetky; callback dostane pôvod ako druhý argument. Typ `DamNotificationListenerOptions`
exportovaný.

**4. Stav push podľa soketu** (`damNotificationsConnection.ts`): mapa meno → otvorený; `setDamNotificationsPushAlive(alive,
configNames = ['default'])`. `useDamNotificationsConnection(configName = 'default')`: `isPushAlive()` toho mena (bez
soketu `false`), `onChange` pri zmene ktoréhokoľvek. Usadzovanie: `connection.isPushAlive(queueKey?)`, poller ho pýta
so svojím frontom; admin-dam má `isPushAlive` bez parametra → ako doteraz. Obchod odpovedá podľa `configOf(queueKey)`.

**5. Obchod počúva všetky sokety** (`{ all: true }`) a dá pôvod do `configNames` udalosti (L3): udalosť `a-1` zo
soketu `own` sa týka len frontov `own`; zo zdieľaného soketu oboch (dve čítania, každé svojím DAM).

**Doplnok: dráhy čítaní** (`uploadSettlement.ts`). `ReadLane { chain, failing }`; s `configOf` dráha pre každú
konfiguráciu (a jedna pre čítania bez mena), bez neho jedna dráha ako doteraz. Ťah frontu na dráhe jeho konfigurácie,
čítanie udalosti na dráhe svojho mena, okamžité čítanie na dráhe svojho jediného mena; `failing` dráhy namiesto
spoločného (pri poslednom pollere sa vynulujú všetky, ako predtým jedno).

*Editor vidí:* pod pomenovanou konfiguráciou bez soketu sa jeho nahrávania usadzujú hustým pollom (od 5 s), s vlastným
soketom jeho udalosťami; pomalý DAM jednej konfigurácie už nezdržiava čítania (ani obnovenie) druhej.

## Rozhodnutia

- Meno voľby poslucháča `configName` / `all`.
- Zmenené dva staršie prípady PV14a v `uploadNamedConfiguration.test.ts` („… notification of its socket …"): ich
  notifikácia teraz prichádza zo soketu `own` (`emit(…, ['own'])`); udalosť soketu `default` sa riadkov `own` netýka.
- `damSocket.ts` (podpora testov): `accept(url?)`, `deliver(…, url?)`, `drop(url)`; bez `url` ako doteraz.

## Prípady

Nové súbory: `dam/__tests__/damNotificationsNamed.test.ts` (8) a
`uploadQueue/settlement/__tests__/uploadSettlementLanes.test.ts` (5). Na snímku (7 zmenených zdrojov starých)
**11 červených**; 2 zelené sú stráže profilu bez `configOf` (jedna dráha, jedna séria).
- sokety: dve adresy cez jednu rúčku (rovnaká rúčka, `openConnection` oba, `destroy` zavrie oba); zdieľaná adresa
  (jeden soket, poslucháč `own` počuje s pôvodom `default,own`); stav push podľa soketu (aj zmeny); poslucháč bez
  volieb / `own` / `all` s pôvodom;
- fronty: `own` bez soketu číta pri 5 a 10 s, `default` so soketom pri 10 s; udalosť na sokete `default` / `own` usadí
  len svoj riadok, čítaný svojím DAM; zdieľaný soket oba riadky, každý svojím DAM;
- dráhy: obnovenie `default` odpovie, kým `own` visí; prvé zlyhanie oboch DAM nahlásené; poller pýta push so svojím
  frontom; stráže bez `configOf`.

Ohyby: b1 pôvod zahodený (udalosť všetkým frontom) → 3 červené; b2 `isPushAlive` obchodu bez frontu → 1; b3 jedna
dráha → 2.

Existujúce prípady notifikácií nezmenené a zelené (okrem dvoch vyššie).

## Kontroly

Formát a linty čisté. Celá kontrola: `testy` 386 súborov, 5 389 testov zelené, bez opakovaní; `linty` zelené.
Prípad admin-cms `src/test/appInitialize/notificationTeardown.test.ts` som spustiť nemohol: členy rúčky a ich význam
ostali; vedúci ho spustí po kópii. *(Opravené v c1: ten prípad rúčku DAM nepoužíva.)* admin-dam nekontrolovaný (D1).

## c1

Posudky `posudky/PV14c-L4-claude.md` (L1–L7, mimo 1 nízky) a `PV14c-L4-codex.md` (súhlasí, jeden nález navyše).

1. **Séria zlyhaní sa skončí s posledným frontom konfigurácie** (`uploadSettlement.ts`, `dropQueue`): dráha frontu sa
   vezme pred zmazaním pollera; keď žiadny zvyšný poller nie je na tej dráhe, `failing` dráhy sa vynuluje (bez
   pollerov všetky, ako doteraz). Prípad (`own` zlyhá a nahlási, front `own` zrušený, `default` sa pýta ďalej, nový
   riadok `own` znova nahlási); ohyb c1-b1 → červený.
2. **Chýbajúce prípady:** čítanie notifikácie `default` prebehne, kým visí čítanie notifikácie `own` (ohyb c1-b2a:
   čítania notifikácií na jednej dráhe → červený); `own` s otvoreným soketom pollí riedko (prvé pri 10 s),
   `default` bez neho husto (5 a 10 s) (ohyb c1-b2b: push len pre `default` → červený).
3. **Jedno spätné volanie pridané dvakrát = jeden poslucháč** (`damNotifications.ts`): `WeakMap` spätné volanie →
   (sokety, ktoré počuje) → jeden obal zbernice; ako predtým samo volanie v `Set` VueUse. Prípad; ohyb c1-b3 → červený.
4. **Kópia mien pre každého poslucháča** (`callback(event, [...origin])`); zmena poľa jedným poslucháčom nemení pôvod
   ďalších ani stav push. Prípad; ohyb c1-b4 → červený. **Adresa pomenovaného soketu, ktorú prehliadač odmietne**:
   jeho `openConnection` chybu zapíše (`console.error`) a varuje ako soket, ktorý to vzdal (existujúci text); soket
   `default` hádže ako doteraz, ale rúčka najprv otvorí ostatné a hádže až potom. Stub `damSocket.ts` odmietne adresu,
   ktorá nie je `ws:`/`wss:` URL alebo má fragment (ako prehliadač). Prípad; ohyb c1-b5 → červený.
5. **Codex:** stav push v `Map` (`shallowRef`, nahrádzaný celý): meno `constructor` ani `toString` nemá zdedenú
   hodnotu. Ostatné mapy podľa mena v L1–L4 sú `Map` (preverené: obchod konfigurácie, cache, ext systém, fronty,
   uloženia detailu, veľkosť chunku, dráhy, čakajúce čítania); `configs` z volieb sa čítajú s `Object.hasOwn` (L1) a
   `Object.entries`. Prípad; ohyb c1-b6 → červený.
6. **Dokumenty:** typy (`report`: séria je jednej konfigurácie; `configOf`: čítania každej konfigurácie za sebou, popri
   ostatných, a jedna dráha pre čítania bez mena), `CommonAdminCoreDamConfig.notification` a changelog `:76` (zdieľaný
   soket: čítanie pre každú konfiguráciu jej klientom, zlyhanie a duplikát do riadkov oboch), changelog „Added"
   (dráha bez mena, `damNotificationsInitialized` je príznak stránky, odmietnutá adresa, dvakrát pridané volanie,
   `useDamNotificationsConnection()` bez mena je `default`-ov, nededí sa), príručka (`initDamNotifications()` sokety
   robí, `openConnection()` otvára).
7. **Len poznámka (L7):** `notificationTeardown.test.ts` admin-cms rúčku DAM nepoužíva (mockuje vlastný konektor);
   kontrola admin-cms (`lint:tsc` a jeden štart: jeden soket na koreňovú adresu) je vedúceho/vlastníka po kópii.
   Mimo (len poznámka): `dispose()` starej, už nahradenej rúčky nastaví stav push mien na `false` aj pre otvorené
   sokety novej (ako predtým jeden príznak).

*Editor vidí:* nič nové v troch adminoch.

**Kontroly c1.** Formát a linty čisté. Celá kontrola: `testy` 386 súborov, 5 396 testov zelené, bez opakovaní;
`linty` zelené. Záplata kroku s cyklom: 15 súborov, 1 351 riadkov.

## c2

Posudok `posudky/PV14c-L4-c1-codex.md`: opakované `openConnection()` s odmietnutou adresou pomenovaného soketu
naplánovalo viac varovaní (každé volanie prepísalo `warningTimer` bez zrušenia skoršieho), `closeConnection()` zrušilo
len posledné a varovanie mohlo prísť po zatvorení. Oprava (`damNotifications.ts`, `warnFailed`): skorší časovač sa
zruší pred novým; čaká vždy jedno varovanie, ktoré zatvorenie vezme (jedno varovanie na soket a zlyhanie ostáva).
Prípad: dvakrát otvoriť, zatvoriť, nechať uplynúť čas → žiadne varovanie; bez zrušenia (ohyb = kód pred c2) červený.

**Kontroly c2.** Formát a linty čisté. `testy` 386 súborov, 5 397 testov zelené, bez opakovaní; `linty` zelené.
Záplata kroku s cyklami: 15 súborov, 1 364 riadkov.

