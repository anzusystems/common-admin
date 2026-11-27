# OP8-L1: „Načítať viac" po zlyhaní (222), zámok a druhý obrázok pri ukladaní (223, 224), história prihlásenia a odhlásenia (219); impl-lib-op8

**Stav: po cykle c2 (posledný).** Cielené testy, ohyby aj CK zelené po poslednej úprave `src` (CK-LIB OP8-L1-c2,
14. 10.). Časti nižšie opisujú stav po kroku (aj čísla riadkov); čo zmenili cykly c1 a c2, je v častiach „Cyklus c1" a
„Cyklus c2" na konci (čísla riadkov po danom cykle). Prijatá medza 223 o menu a výbere a nový nález 1 cyklus c1 opravil.

Zadanie `krok5-praca/zadania/zadanie-OP8-L1.md` (register, časť 8, nálezy 222, 223, 224 a 219; vlastník 14. 10. „1-11
suhlasim", „12 spravme vsetky adminy"). Strom LIB `/home/volar/projects/anzusystems/common-admin` (vetva `next`, commit
`bc033c71`), TMPDIR `node_modules/.cache/vitest-tmp-impl-lib-op8`. Snímok **`OP8-L1`** (pred prvou úpravou, s
`doc/changelog/2.0.0.md`), záplata `krok5-praca/zaplaty/OP8-L1.diff` (14 súborov, 1 358 riadkov; mimo `src` a `doc` nič).
admin-ugc **bez zmeny** (`git -C /home/volar/projects/petit/admin-ugc diff` je prázdny; prečo, pozri 219). Cesty nižšie
sú relatívne k `src/domains/`.

## Zmenené súbory

- `dam/assetSelect/composables/assetSelectListActions.ts` (222: príznak `nextPageFailed`, akcia `fetchNextPageInView`)
- `dam/assetSelect/components/AAssetListInner.vue`, `AAssetSelect.vue`, `AAssetSelectMedia.vue` (222: `v-intersect` volá
  akciu; miestna `autoloadOnIntersect` zanikla)
- `dam/imageWidget/components/ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue` (223, 224)
- `ui/view/components/ALoginView.vue`, `ALogoutView.vue` (219)
- nové testy: `dam/assetSelect/__tests__/assetListsLoadMoreFailure.test.ts` (6),
  `dam/imageWidget/__tests__/imageWidgetsLockDuringASave.test.ts` (10),
  `dam/imageWidget/__tests__/imageWidgetsPickDuringACreate.test.ts` (6), `ui/view/__tests__/ALoginLogoutViewHistory.test.ts` (6)
- upravený test: `dam/imageWidget/__tests__/ImageWidgetConfirmCollabLock.test.ts` (prvý prípad, dve tvrdenia)
- `doc/changelog/2.0.0.md`: tri odrážky pod „DAM image widgets" (`:180-182`) a nová odrážka „Signing in and out"
  (`:190`). Žiadny nový text prekladu, `src/lib.ts` bez zmeny.

## Skupina A

### 222: „Načítať viac" po zlyhanej ďalšej strane

**Príčina (overená behom).** Direktíva `v-intersect` Vuetify 4.2.1 pri každom prekreslení komponentu zruší a znova
založí pozorovateľa (`vuetify/lib/directives/intersect/index.js`, `updated`), ktorý hneď ohlási stav tlačidla. Po
zlyhaní sa koliesko vypne, komponent sa prekreslí, viditeľné tlačidlo sa ohlási a pýta znova. Nad snímkom za 600 ms
37 požiadaviek a 37 hlášok vo výbere, 57 v zozname admin-ugc.

**Kód** (`assetSelectListActions.ts`). Príznak `nextPageFailed` pre stránku (`:32`, zdieľaný ako stránkovanie). Zlyhaná
ďalšia strana ho nastaví (`:133`, nie zrušená). Nová akcia `fetchNextPageInView` (`:147-154`), ktorú volá `v-intersect`
troch komponentov: tlačidlo mimo okna príznak zruší; v okne pýta ďalšiu stranu, len keď príznak nie je a `hasNextPage`
je `true` (podmienka komponentov). Príznak ruší aj stlačenie (`fetchNextPage`, `:116`) a každý nový zoznam
(`startListAnew`, `:79`).

**Rozhodnutie: stlačenie aj odrolovanie a návrat.** Tlačidlo dnes pýta, keď príde do okna; po zlyhaní ho ďalej pýta
stlačenie a príchod do okna po tom, čo z neho odišlo (ako pýta každú stranu). Stlačenie, ktoré stranu prinesie, vráti
samočinné pýtanie (ďalšia strana pod ním príde sama, ako doteraz).

**Redaktor.** Oba výbery admin-cms a zoznam admin-ugc: zlyhaná ďalšia strana = jedna požiadavka a jedna hláška;
tlačidlo ostane („Načítať viac", bez kolieska); stlačenie pýta znova (zlyhá → ešte jedna hláška, nič viac). Nový
zoznam (hľadanie, zoradenie, typ) pýta ďalšie strany sám ako doteraz.

**Prípady** (`assetListsLoadMoreFailure.test.ts`, skutočné výbery a zoznam s dlaždicami a tlačidlom, štýl knižnice v
stránke, skutočný prechod dialógu, inak by fullscreen štýl Vuetify nesadol): zlyhaná strana raz, stlačenie, úspešné
stlačenie a samočinná ďalšia strana (3 behy: dva výbery, zoznam); odrolovanie a návrat (25 dlaždíc); nový zoznam po
zlyhaní; stráž: ďalšie strany prichádzajú samé. **Ohyby:** `222-failure-not-held` 5 / 6, `222-out-of-view-keeps-it` 1,
`222-press-keeps-it` 3.

## Skupina B

### 223: zámok poľa, keď sa dialóg zavrie počas ukladania

**Kód** (oba widgety rovnako). Strážcovia zatvárania menu a dialógov nevracajú zámok, kým beží potvrdenie
(`metadataDialogSaving`, ako `deletePending`; `ImageWidgetInner.vue:789`, `:802`; `ImageMediaWidgetInner.vue:967`,
`:980`). Celé potvrdenie: čítanie mien autorov, zápis autorov aj uloženie. Po odpovedi uloženia sa zámok vráti s
uloženým obrázkom ako doteraz (`releaseFieldLockWith(res.id)`; teraz ide, lebo zámok ešte drží). Na konci potvrdenia
(`finally`, `:697`; `:848`) sa zámok vráti s tým, čo pole má, keď ho nedrží nič iné z widgetu (menu, iný dialóg) a
widget nezanikol: pri zlyhanom uložení a pri potvrdení, ktoré skončilo bez uloženia; po úspechu je to prázdny krok.

**Dôsledok, nad znenie (nutný).** Odpoveď uloženia určovala „dialóg iného výberu" bez ohľadu na to, či je dialóg
widgetu otvorený. Po zavretí dialógu A a otvorení dialógu widgetu B (sklad dialógu je jeden pre stránku) bral A dialóg
B za svoj: nevrátil zámok (doteraz ho vrátil už pri zavretí, so starou hodnotou). S opravou 223 by A zámok nevrátil
nikdy. Preto `dialogOfAnotherPick` žiada otvorený vlastný dialóg (`ownDialogOpen`, `:674-677`; `:822-825`) a sklad sa
vyprázdni len pri vlastnom dialógu alebo `expandMetadata` (`:681`, `:830`): dialóg B ostane ako doteraz.

**Redaktor (dvaja v článku).** „Potvrdiť", X počas ukladania: pole ostane zamknuté, kým uloženie neodpovie; potom
druhý redaktor dostane uložený obrázok. Zlyhá: zámok sa vráti so starým obrázkom. Menu otvorené a zavreté medzitým
zámok nevráti. Dialóg znova otvorený (iný výber) drží zámok ďalej, nepýta ho znova.

**Prípady** (`imageWidgetsLockDuringASave.test.ts`, oba widgety, zámok cez napodobené `useCollabField`; 5 na widget):
zavretý dialóg (zámok až s uloženým), zlyhanie (so starým), menu medzitým, stráž: otvorený dialóg (raz, s uloženým),
dialóg iného widgetu (zámok A s vytvoreným, dialóg B otvorený, jeho obrázok bez id). **Upravený existujúci**
`ImageWidgetConfirmCollabLock.test.ts:149`: pripínal vrátenie zámku so starou hodnotou pri zavretí (`[7]`) a nové
pýtanie pri znovuotvorení (2×); teraz `[]` a 1×, zvyšok bez zmeny. **Ohyby:** zavretie vracia (jednoduchý 5, s médiami
4), menu vracia 1, po zlyhaní nevráti (1 a 1), cudzí dialóg za vlastný (1 a 1).

### 224: druhý obrázok z dialógu otvoreného počas vytvárania

**Kód.** Zvolil som **„dialóg si vezme vytvorené id"**: pri odpovedi vytvárania, keď je otvorený dialóg iného výberu
alebo uploadu tohto widgetu a jeho obrázok id nemá, dostane id vytvoreného obrázka (`ImageWidgetInner.vue:684`,
`ImageMediaWidgetInner.vue:833`; len obrázok, nie médium). Potvrdenie počas vytvárania odmietala už stráž FE-64
(`metadataDialogSaving`), bez zmeny.

**Redaktor.** Widget bez obrázka: „Potvrdiť" (vytváranie trvá), X, iný výber z knižnice alebo upload, jeho dialóg: tlačidlo
sa točí a stlačenie sa neberie; po odpovedi widget ukáže vytvorený obrázok, dialóg ostane otvorený a jeho „Potvrdiť"
ten obrázok nahradí (aktualizácia, `updateImage(501, …)` s novým súborom a textami). Doteraz vznikol druhý obrázok,
widget ho vzal a prvý ostal nepoužitý. Zlyhané vytvorenie: potvrdenie dialógu vytvorí obrázok (ako doteraz).

**Prípady** (`imageWidgetsPickDuringACreate.test.ts`, admin-cms, skutočný dialóg, oba widgety; 3 na widget): iný
výber, upload (nad snímkom druhé `createImage`), stráž: zlyhané vytvorenie. **Ohyby:** bez prevzatia id 2 a 2.

## Skupina C: 219, história prihlásenia a odhlásenia

**Kód.** `ALogoutView.vue:17`: `window.location.replace(logoutUrl())`. `ALoginView.vue:24-28`, `:57`: tlačidlo ostáva
odkazom (`href`); obyčajné stlačenie (aj Enter) zruší predvolenú akciu a ide `location.replace` na `href` odkazu (nevolá
`loginUrl()` druhý raz); stlačenie s Ctrl, Cmd, Shift, Alt alebo iným tlačidlom než ľavým nechá prehliadaču (karta,
okno, stiahnutie; stredné tlačidlo `click` nevyvolá vôbec).

**Prípady** (`ALoginLogoutViewHistory.test.ts`, skutočná história stránky testu, adresy ako fragmenty): odhlásenie
nahradí záznam `/logout` a Späť príde na stránku pred ním; stlačenie prihlásenia nahradí `/login`, odkaz má adresu;
stráže: Ctrl, Cmd, Shift, Alt nechá prehliadaču (4). **Ohyby:** `219-logout-assigns` 1, `219-login-press-is-a-link` 1,
`219-login-takes-every-press` 4.

**admin-ugc `domains/system/logout.ts` neupravený (odchýlka od zadania).** `logoutUser` nevolá stránka `/logout`
(tá má `ALogoutView`), ale interceptor obnovy tokenu (`blog/blog/api/clients/interceptors/requestRefreshToken.ts:53`, `:72`) na stránke, kde redaktor je,
keď sedenie skončilo. Je to obdoba `window.location.pathname = '/logout'` ostatných adminov, pri ktorej zadanie žiada,
aby stránka ostala v histórii. S `replace` by zmizla práve tá stránka a nič by sa nezískalo: záznam odhlasovacej adresy
v histórii je tak či tak (v ostatných adminoch nahradí `/logout`). Ponechané `href` (push): stránka ostane, záznam
`/logout` nevzniká. Ak vedúci predsa chce `replace`, je to jeden riadok (`logout.ts:10`). Komentár súboru „`/logout`
ends in this same assignment" po tejto verzii knižnice neplatí doslova (nález 3).

**Späť po odhlásení a novom prihlásení** (z čítania kódu; čo urobí prihlasovacia služba a kam pošle odhlasovacia
adresa, je mimo; adresy sú `…/api/auth/logout` backendu, v admin-ugc `prihlasenie…/logout`):

| admin | odhlásenie | vynútené odhlásenie | Späť z adminu po novom prihlásení (po tejto verzii) | iné zápisy do `window.location` na ceste |
|---|---|---|---|---|
| admin-blog | menu `ACurrentUserDropdown` → trasa `/logout` → `ALogoutView` | 401 a obnova: `currentUser.ts:2` `pathname = '/logout'` | stránka prihlasovacej služby (mimo) → stránka, kde bol pred odhlásením; `/login` ani `/logout` v histórii nie sú | žiadne (`error.vue:21` `href = '/'` je stránka chyby) |
| admin-cms | ako blog | `system/composables/logout.ts:2` | ako blog | žiadne (`error.vue:21`) |
| admin-forum | ako blog | `currentUser.ts:2` | ako blog | žiadne (`error.vue:21`) |
| admin-inhouse | `SidebarUserMenu.vue:116`, `NoAccess.vue:42` → `/logout` | `currentUser.ts:2` (aj `systemAccessStore.ts:103`) | ako blog; návrat SSO na `/` s `loginState`, ktorý stráž odstráni | žiadne; `no-account.vue:41`, `app-error.vue:42` → trasa `/login` (ďalej `ALoginView`) |
| admin-ugc | `SidebarAppendMain.vue:88` → `/logout` | `logout.ts:10` `href = logoutUrl` priamo zo stránky (záznam `/logout` nevzniká) | ako blog | `logout.ts:10` (ponechané, viď vyššie); `BlogDropdown.vue:57`, `UserDropdown.vue:55` odkaz „zmeniť používateľa" na prihlasovaciu adresu (push zo stránky adminu, `/login` nevzniká); `ImpersonateInfo.vue:14` odchod z impersonácie |
| admin-dam | `CurrentUserDropdown.vue:23` → `/logout` | `currentUser.ts:2` | `/logout` odchádza s touto verziou; `/login` (vlastný formulár, `loginActions.ts:26`, `LoginFormSso.vue`) je krok OP8-D1 | `loginActions.ts:26`, odkaz SSO (OP8-D1) |

Vynútené odhlásenie: `pathname = '/logout'` pridá záznam `/logout` za stránku redaktora, `ALogoutView` ho nahradí:
stránka ostane (blog, cms, forum, inhouse, dam). admin-ugc ide zo stránky rovno na odhlasovaciu adresu: stránka ostane
tiež. Prihlásenie: stráž pošle na `/login` (prvá navigácia ho dá na miesto záznamu, neskoršia pridá), `ALoginView` ho
nahradí prihlasovacou stránkou.

## Dôkaz

Osem produkčných súborov zo snímku `OP8-L1` nad piatimi súbormi testov (`pracovne/impl-lib-op8/stare-vsetko.sh`,
výpis `ohyb-stare-vsetko.log`): **20 / 31** červených. Z 28 nových prípadov je červených 19; 9 nad snímkom prechádza
(stráže: samočinné ďalšie strany, otvorený dialóg ×2, zlyhané vytvorenie ×2, Ctrl/Cmd/Shift/Alt). Červený je aj
upravený existujúci prípad. Ohybov 15 (222: 3, 223: 7, 224: 2, 219: 3), každý zhodil aspoň jeden prípad (`ohyby.py`,
`ohyby-beh.sh`, výpisy `ohyb-*.log`; ohyby v TMPDIR, `bend-op8l1-*.json`).

**Behy.** `oxfmt`, `oxlint`, `eslint`, `stylelint` na trinástich súboroch čisté. **CK-LIB OP8-L1 zelená na prvý beh**:
testy (`vysledky/OP8-L1-testy.log`) 327 súborov / 4 828 testov (CK vedúceho C11 po OP7: 323 / 4 800; +4 súbory, +28), žiadny
opakovaný prípad, 249 s; linty (`vysledky/OP8-L1-linty.log`) `test:eslint` 7 / 82, `lint:tsc`, `format:check`,
`lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté (hláška sentry „Invalid token" v `test:eslint` je ako v OP7).
Changelog som po CK spresnil (dve vety 223 a 219); CK ho nekontroluje, záplata je po tom.

## Prijaté medze

- 222: príznak je jeden pre stránku ako stránkovanie; tlačidlo, ktoré po zlyhaní zmizne z okna len zmenou rozloženia
  (nie rolovaním), po návrate pýta znova.
- 223: keď je pri odpovedi uloženia otvorené menu widgetu alebo výber z knižnice (nie dialóg obrázka), odpoveď zámok
  vráti s uloženým obrázkom ako doteraz; menu potom pri otvorení dialógu zámok pýta znova, výber nie (nález 1).
- 224: dialóg média (video, podcast) otvorený počas vytvárania obrázka vo widgete s médiami id nedostáva; jeho
  potvrdenie nahradí obrázok médiom ako pri každom potvrdení média, vytvorený obrázok ostane nepoužitý (ako pri výmene
  existujúceho obrázka za video). Výber, ktorý sa ešte číta pri odpovedi, sa zavrie (druhá časť 224, bez zmeny).
- 219: história stránok prihlasovacej služby a to, kam pošle odhlasovacia adresa, je mimo.

## Nové nálezy (nemenené)

1. **Výber z knižnice otvorený pri odpovedi uloženia stratí zámok** (oba widgety, pred krokom rovnako): odpoveď vráti
   zámok, kým je výber otvorený (`releaseFieldLockWith(res.id)` pri `!dialogOfAnotherPick`); potvrdenie výberu nechá
   `anyWidgetDialogOpened` stále pravdivé (`assetPickPending`, potom dialóg), zámok sa nepýta znova a uloženie tohto
   výberu sa druhému redaktorovi nepošle (`releaseFieldLockWith` pri `lockedLocal` false). Rovnako dialóg fronty uploadu.
   Z čítania kódu.
2. **Testy knižnice s `@vue/test-utils` vkladajú `<transition-stub>`** medzi `.v-overlay` a `.v-overlay__content`, takže
   štýl fullscreen dialógu Vuetify (`.v-dialog--fullscreen > .v-overlay__content`) nesadne: výber je v testoch posunutý
   mimo okno a nič sa v ňom nedá dorolovať. Nový súbor 222 to obchádza `transition: false`; pre testy, ktoré merajú
   polohu v dialógu.
3. **admin-ugc `domains/system/logout.ts:3-4`**: komentár „`/logout` ends in this same assignment" po tejto verzii
   neplatí (`ALogoutView` nahrádza záznam, `logoutUser` pridáva).
4. **Dva súčasné `mount` so stand-inmi** (`@vue/test-utils`): druhý `mount` dá prvému widgetu nové stand-iny, jeho
   komponent sa nakreslí znova a starý obal `findComponent` neexistuje; nový súbor 223 hľadá dialóg vždy znova.

## Cyklus c1 (OP8-L1-c1, 14. 10.; posudky Codex a Opus, štyri body)

Snímok `OP8-L1-c1`, záplata `zaplaty/OP8-L1-c1.diff` (10 súborov, 526 riadkov; mimo `src` a `doc` nič). Zmenené:
`dam/imageWidget/components/ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue` (c1-1, c1-2), `ui/view/components/ALoginView.vue`
(c1-3), `dam/assetSelect/composables/assetSelectListActions.ts` (c1-4); testy `imageWidgetsLockDuringASave.test.ts` (+8),
`imageWidgetsPickDuringACreate.test.ts` (+2), `ALoginLogoutViewHistory.test.ts` (+2), `assetListsLoadMoreFailure.test.ts`
(+1), `ImageWidgetConfirmCollabLock.test.ts` (prvý prípad: dve tvrdenia navyše, napodobené `changeCollabFieldData`);
`doc/changelog/2.0.0.md` (odrážky `:181`, `:182`, `:190` doplnené).

### c1-1 (a): zámok pri odpovedi uloženia, keď pole drží ešte niečo z widgetu

**Kód** (`ImageWidgetInner.vue:699-708`, `ImageMediaWidgetInner.vue:848-857`). Po zavretí vlastného dialógu sa odpoveď pýta
to isté ako cesta zlyhania: drží pole menu widgetu alebo iný jeho dialóg (`clickMenuOpened`, `anyWidgetDialogOpened`:
výber z knižnice, dialóg iného výberu alebo uploadu, dialóg fronty, výber, ktorý sa ešte číta)? Nie: zámok sa vráti s
uloženým obrázkom ako doteraz. Áno: zámok ostane tomu, ktorý ho drží, a druhým redaktorom ide uložený obrázok správou
`changeFieldData` z `useCollabField` (`changeCollabFieldData`, tá istá, ktorou posielajú hodnotu polia formulára, kým
zámok držia; widget si ju berie ako `releaseCollabFieldLock`, `:125`, `:130-139`; `:136`, `:141-150`). Zámok vráti zatvorenie posledného z
nich, s hodnotou poľa (vtedy už uložený obrázok alebo to, čo doň dal výber). V miestnosti, kde je redaktor sám, ide
uložený obrázok do zásobníka ako doteraz.

**Redaktor (dvaja v článku).** „Potvrdiť", X, výber z knižnice (alebo menu) otvorený, kým uloženie trvá: druhý redaktor
dostane uložený obrázok hneď pri odpovedi, pole ostane zamknuté, kým je výber otvorený; čo výber potom do poľa dá, ide
druhému redaktorovi s uvoľnením zámku (doteraz výber zámok stratil a jeho zmena nešla nikomu). Dialóg iného výberu
otvorený medzitým: druhý redaktor dostane uložený obrázok pri odpovedi (doteraz až pri zavretí alebo potvrdení toho
dialógu), zámok drží dialóg ako doteraz. Výber, ktorý sa pri odpovedi ešte číta: zámok sa vráti, keď čítanie skončí
(doteraz pri odpovedi), s tou istou hodnotou.

### c1-1 (b): widget, ktorý zanikne počas potvrdenia

**Kód** (`finally`, `ImageWidgetInner.vue:720`, `ImageMediaWidgetInner.vue:869`). Zaniknutý widget vráti zámok na konci
potvrdenia vždy (`disposed ||`), s hodnotou svojho poľa (`releaseFieldLockLocal`; uvoľnenie je správa miestnosti, nie
zápis do stránky). Odpoveď uloženia zaniknutý widget naďalej nezapíše (FE-79).

**Odchýlka od znenia (hodnota).** Zadanie chce „s uloženým obrázkom, keď uloženie odpovedalo". Pri aktualizácii (kroky
z posudku: „Upraviť metadáta" obrázka, ktorý pole má) má uložený obrázok to isté id (backend mení obrázok na mieste,
FE-78), takže uvoľnenie nesie práve uložený obrázok. Rozdiel je len pri vytvorení: zaniknutý widget id do modelu nezapíše
(FE-79; pri embede je to správne), kópia na jeho mieste pole bez obrázka ukáže; poslať druhému redaktorovi nové id by
dalo dvom redaktorom dve rôzne hodnoty poľa. Preto ide hodnota poľa tejto stránky. Ak vedúci chce nové id, je to jedna
vetva v ceste odpovede (`if (disposed) { releaseFieldLockWith(res.id); return }`).

**Čo ukáže kópia** (admin-cms, pripnutie widgetu „Supplementary media" nakreslí `AImageWidget` znova): pole tak, ako je
v článku tejto stránky, teda bez odpovede uloženia. Pri aktualizácii ten istý obrázok (id), ako ho kópia prečítala pri
pripojení: pripnutá počas uloženia, ukazuje texty spred uloženia, kým sa obrázok neprečíta znova (backend má uložené);
„Upraviť metadáta" v kópii ukáže tie staré a ich potvrdenie by uložené prepísalo (nález 6). Pri vytvorení kópia obrázok
nemá a vytvorený obrázok ostane nepoužitý. Druhý redaktor dostane hodnotu poľa (to isté id, resp. žiadny obrázok) a pole
sa mu odomkne.

**Prípady** (`imageWidgetsLockDuringASave.test.ts`, oba widgety): výber z knižnice / menu otvorené počas uloženia (2 na
widget: pri odpovedi žiadne uvoľnenie, `changeFieldData` s uloženým; zatvorenie vráti zámok s uloženým); widget zaniknutý
po zavretí dialógu, uloženie odpovie / zlyhá (2 na widget: uvoľnenie raz, s hodnotou poľa 7, nič iné).
`ImageWidgetConfirmCollabLock.test.ts:160-163`: zoznam uvoľnení je prázdny aj po znovuotvorení, pred `mockClear()`
(Codex 4); pri odpovedi ide uložený obrázok `[8]` (`:173`). **Ohyby:** `c1-single-released-under-a-picker`
(podmienka kroku) 3 / 29; `c1-media-gone-keeps-the-lock` 2 / 29.

### c1-2: vytvorené id len obrázku vlastného výberu

**Kód.** Widget si pamätá, čo do dialógu dal jeho výber z knižnice alebo upload naposledy (`pickInDialog`,
`ImageWidgetInner.vue:266`, nastavené `:569`, `:763`; `ImageMediaWidgetInner.vue:277`, `:697`, `:923`; obdoba
`ownImageInDialog` z FE-78). Id dostane len ten obrázok (`shown === pickInDialog`, `:696`, `:845`); obrázok, ktorý do
skladu dialógu (jeden pre stránku) dal iný widget, ostane bez zmeny.

**Redaktor.** Kroky z posudku (prázdny hlavný obrázok, výber sa číta; prázdny listing, výber, „Potvrdiť"; dialóg hlavného
sa otvorí nad ním): po vytvorení listingu má obrázok hlavného dialógu ďalej žiadne id, jeho „Potvrdiť" vytvorí vlastný
obrázok. Doteraz aktualizoval obrázok listingu súborom a textami hlavného. Dialóg listingu ostane pod ním otvorený
(ukazuje ten istý sklad; staršia vada, Opus 5, do registra).

**Prípad** (`imageWidgetsPickDuringACreate.test.ts:269`, oba widgety): dva widgety, druhý vyberie počas vytvárania prvého;
po odpovedi obrázok v sklade bez id, druhý vytvorí vlastný (501, 502). **Ohyb:** `c1-single-id-to-any-image` 1 / 29.

### c1-3: prihlásenie bez adresy

**Kód** (`ALoginView.vue:24-30`). Stlačenie sa berie len na odkaze s adresou (`currentTarget` je `HTMLAnchorElement` s
`href`); `VBtn` bez `href` je `<button>` a stlačenie nerobí nič, ako pred krokom (po kroku išlo na adresu `undefined`).

**Prípad** (`ALoginLogoutViewHistory.test.ts:71`, prázdna adresa aj žiadna): tlačidlo je `BUTTON`, stlačenie nič nezruší,
história ani adresa sa nezmení. Nad snímkom c1 stlačenie odíde na `undefined` a stránka testu sa stratí („Cannot connect
to the iframe. Did you change the location…"). **Ohyb:** `c1-login-without-an-address` (bez stráže): ten istý pád.

### c1-4: prípad, ktorý nemohol padnúť

Riadok `nextPageFailed = false` v `startListAnew` som **odstránil**: nový zoznam tlačidlo vždy skryje (`hasNextPage` je
`false` alebo `null`, a keď príznak stojí, zlyhanie už koliesko vyplo), direktíva skryté tlačidlo ohlási mimo okna a to
príznak zruší. Výber zatvorený a otvorený znova berie tlačidlo so sebou; nové sa nakreslí skryté pod zoznamom bez strany,
s tým istým výsledkom. Komentár príznaku to hovorí (`assetSelectListActions.ts:30-32`).

**Prípad** (`assetListsLoadMoreFailure.test.ts:308`): výber zatvorený po zlyhaní a otvorený znova pýta ďalšiu stranu sám
(nad snímkom c1, s riadkom, prechádza; dokazuje, že riadok netreba). **Ohyb:** `222-out-of-view-keeps-it` (zrušenie
príznaku mimo okna preč) teraz zhodí aj tento prípad a prípad nového zoznamu: 6 / 7 (zvyšné štyri padajú, lebo príznak
pri tomto ohybe prejde z prípadu do prípadu).

### Dôkaz a behy c1

Dva produkčné súbory widgetov a akcie zoznamu zo snímku `OP8-L1-c1` nad štyrmi súbormi testov (`pracovne/impl-lib-op8/
stare-c1.sh`, výpis `ohyb-stare-c1.log`): **11 / 36** červených (10 nových, 1 upravený); `ALoginView` zo snímku nad
prípadom c1-3 zvlášť: beh skončí chybou stratenej stránky (`ohyb-stare-c1-login.log`). Z 13 nových prípadov je červených 12;
prípad c1-4 prechádza (zámer). Ohybov 5, každý zhodil aspoň jeden prípad.

**CK-LIB OP8-L1-c1 zelená na prvý beh**: testy (`vysledky/OP8-L1-c1-testy.log`) 327 súborov / 4 841 testov (po kroku
4 828; +13), žiadny opakovaný prípad; linty (`vysledky/OP8-L1-c1-linty.log`) `test:eslint` 7 / 82, `lint:tsc`,
`format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.

### Medze a nálezy po c1

- Medza 223 z kroku (menu a výber pri odpovedi) a nový nález 1 (výber stratí zámok) sú opravené (c1-1 a). Dialóg fronty
  uploadu, otvorený počas uloženia, drží zámok tiež (je v `anyWidgetDialogOpened`); prípad je len pre výber a menu.
- Nález 5: zaniknutý widget vracia zámok len na konci potvrdenia; zánik s dialógom otvoreným bez potvrdenia (napr. pripnutie
  počas výberu) nechá pole zamknuté, kým redaktor neodíde z článku. Z čítania kódu.
- Nález 6: kópia widgetu pripnutá počas uloženia aktualizácie drží texty spred uloženia; jej „Upraviť metadáta" a
  „Potvrdiť" ich zapíšu späť. Z čítania kódu.
- c1-2: dialóg vlastného widgetu ostáva pod dialógom iného widgetu, oba ukazujú ten istý sklad (Opus 5, do registra).

## Cyklus c2 (OP8-L1-c2, 14. 10.; potvrdzujúce čítania Codex a Opus, dva body zámku a veta changelogu)

Snímok `OP8-L1-c2`, záplata `zaplaty/OP8-L1-c2.diff` (6 súborov, 258 riadkov; mimo `src` a `doc` nič). Zmenené:
`dam/imageWidget/components/ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, nový `dam/imageWidget/utils/fieldLockTurns.ts`;
testy `imageWidgetsLockDuringASave.test.ts` (+4), `ImageWidgetConfirmCollabLock.test.ts` (tvrdenie z c1 obrátené);
`doc/changelog/2.0.0.md` (odrážka `:181` prepísaná).

### c2-1: zaniknutý widget neuvoľní zámok kópie

**Kód.** `fieldLockTurns.ts`: počítadlo „ťahov" zámku pre miestnosť a pole, jedno pre stránku; ťah je každá žiadosť o
zámok a každé uvoľnenie ktoréhokoľvek widgetu toho poľa. Widget si pamätá číslo svojho posledného ťahu (`ownLockTurn`,
`takeLockTurn` v `acquireFieldLockLocal`, `releaseFieldLockLocal`, `releaseFieldLockWith`; `ImageWidgetInner.vue:174-180`,
`:192`, `:200`, `:208`; `ImageMediaWidgetInner.vue:185-191`, `:203`, `:211`, `:219`). Zaniknutý widget na konci
potvrdenia uvoľní zámok, len keď odvtedy nikto ťah nevzal (`:735`, `:884`); inak ho nechá widgetu, ktorý ho vzal. Server
berie žiadosti aj uvoľnenia oboch ako jedného redaktora (posudok: `roomLockManager.ts:62`, `:79-88`). Ťah ráta aj
uvoľnenie do zásobníka v neaktívnej miestnosti: neskoré uvoľnenie zaniknutého widgetu neprepíše hodnotu, ktorú tam kópia
dala.

**Redaktor (dvaja v článku).** „Potvrdiť", X, pripnutie „Supplementary media", v kópii menu a dialóg obrázka, kým
uloženie trvá: pri odpovedi ostane pole zamknuté pre druhého redaktora, kým je dialóg kópie otvorený; jeho zatvorenie
alebo potvrdenie zámok vráti s hodnotou kópie. Bez kópie (alebo kópia zámok nevzala) ako po c1.

**Prípad** (`imageWidgetsLockDuringASave.test.ts:256`, oba widgety): zaniknutý widget, kópia toho istého poľa otvorí
dialóg; pri odpovedi žiadne uvoľnenie, zatvorenie kópie vráti zámok s 7. **Ohyb:** `c2-single-gone-frees-the-copy`
(zaniknutý uvoľní vždy) 1 / 25.

### c2-2: nič sa nepošle, kým je otvorený dialóg iného výberu

**Kód** (`ImageWidgetInner.vue:720`, `ImageMediaWidgetInner.vue:869`). Uložený obrázok sa pri odpovedi pošle
(`changeFieldData`) len vtedy, keď pole drží menu alebo výber z knižnice, nie dialóg iného výberu alebo uploadu
(`!dialogOfAnotherPick`): ten určí konečnú hodnotu poľa (pri vytvorení aj pod tým istým id, ktoré jeho obrázok dostal)
a pošle ju svojím uvoľnením, ako pred c1. Druhý redaktor číta obrázok znova len pri zmene id; s id poslaným pri odpovedi
ostal pri prvom obrázku.

**Prípady:** `imageWidgetsLockDuringASave.test.ts:274` (oba widgety: pri odpovedi nič uvoľnené ani poslané, zatvorenie
dialógu vráti zámok s 8); `ImageWidgetConfirmCollabLock.test.ts:173` (tvrdenie c1 `[8]` je teraz `[]`). **Ohyb:**
`c2-media-sent-under-another-pick` (podmienka c1) 1 / 25.

### c2-3: veta changelogu

Odrážka `:181` hovorí, čo sa mení proti vydanej verzii: tam zavretie dialógu vrátilo zámok hneď so starou hodnotou a
uvoľnenie odpovede sa neposlalo. Veta „Such a widget never gave the lock back…" (stav po kroku, nie vo vydanej verzii)
zanikla; zaniknutý widget „drží zámok do konca potvrdenia tiež" a kópia, ktorá ho medzitým vzala, si ho nechá.

### Dôkaz a behy c2

Oba widgety zo snímku `OP8-L1-c2` nad dvoma súbormi testov zámku (`pracovne/impl-lib-op8/stare-c2.sh`, výpis
`ohyb-stare-c2.log`): **5 / 25** červených (4 nové, 1 upravený). Ohyby 2, každý zhodil jeden prípad. **CK-LIB OP8-L1-c2
zelená na prvý beh**: testy (`vysledky/OP8-L1-c2-testy.log`) 327 súborov / 4 845 testov (po c1 4 841; +4), žiadny
opakovaný prípad; linty (`vysledky/OP8-L1-c2-linty.log`) `test:eslint` 7 / 82, `lint:tsc`, `format:check`,
`lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.

**Medza.** Počítadlo je stránky, nie servera: ťah iného okna toho istého redaktora (druhá karta s článkom) nevidí; tam
uvoľní zaniknutý widget zámok ako po c1. Z čítania kódu.
