# OP9-L1: výber widgetu s médiami počas čítania (229), zámok widgetu, ktorý zanikne (232), kópia počas uloženia (233); impl-lib-op9

**Stav: po cykle c2 (posledný).** Cielené testy, ohyby aj CK zelené po poslednej úprave `src` (CK-LIB OP9-L1-c2, 14. 10.).
Časti nižšie opisujú stav po kroku (aj čísla riadkov); čo zmenili cykly c1 a c2, je v častiach „Cyklus c1" a „Cyklus c2" na
konci (čísla riadkov po danom cykle). Vety, ktoré cykly vyvrátili, sú opravené na mieste a označené „(c1)" / „(c2)".

Zadanie `krok5-praca/zadania/zadanie-OP9-L1.md` (register, časť 8, nálezy 229, 232, 233; overenie
`impl/posudky/overenie13-lib-codex.md`; vlastník 14. 10.). Strom LIB `/home/volar/projects/anzusystems/common-admin`
(vetva `next`, commit `6054fab4`), TMPDIR `node_modules/.cache/vitest-tmp-impl-lib-op9`. Snímok **`OP9-L1`** (pred prvou
úpravou, s `doc/changelog/2.0.0.md`), záplata `krok5-praca/zaplaty/OP9-L1.diff` (7 súborov, 1 376 riadkov; mimo `src` a
`doc` nič). Cesty nižšie sú relatívne k `src/domains/dam/imageWidget/`, čísla riadkov po kroku.

## Zmenené súbory

- `components/ImageWidgetInner.vue`, `components/ImageMediaWidgetInner.vue` (229, 232, 233; tie isté pravidlá v oboch)
- nový `utils/imageSaves.ts` (233; obdoba `fieldLockTurns.ts`)
- nové testy: `__tests__/imageWidgetsLockWhenAWidgetGoes.test.ts` (232, 16), `__tests__/imageWidgetsPickWhileItIsRead.test.ts`
  (229, 15), `__tests__/imageWidgetsCopyDrawnDuringASave.test.ts` (233, 14)
- `doc/changelog/2.0.0.md`: tri odrážky pod „Image widgets and asset select, uploads and picks" (`:183-185`). Žiadny
  nový text prekladu, `src/lib.ts` bez zmeny. **Existujúce prípady: žiadny sa nemenil** (celý priečinok widgetov 27
  súborov / 623 prípadov zelený bez úpravy).

## 229: výber z knižnice, kým sa asset číta

**Kód.** Widget si pamätá, pre čo jeho dialóg ukazuje načítavanie (`loadingInDialog`, `ImageWidgetInner.vue:290`,
`ImageMediaWidgetInner.vue:301`): pre výber (`onAssetSelectConfirm`, `:557` / `:618`) alebo pre „Upraviť metadáta", ktoré
čaká na uloženie iného widgetu (233). Odpoveď sa do dialógu dá len cez `answerTakenFor` (`:291` / `:302`): widget nezanikol,
dialóg stále načítava pre ten istý výber a sklad dialógu (jeden pre stránku) je prázdny, ako ho výber nechal. Keď sklad
medzitým drží formulár iného dialógu, odpoveď sa nezoberie a dialóg, ktorý načítaval pre výber, sa zavrie (ukazoval by ten
istý formulár a jeho „Potvrdiť" by ho uložil ako obrázok tohto widgetu); sklad ostane. Zavretie dialógu redaktorom
(`onMetadataDialogClose`, `:696` / `:829`) výber zruší a vypne načítavanie. Koniec výberu vypne načítavanie len vtedy, keď
dialóg ešte načítava preň (`:565` / `:626`): dialóg, ktorý medzitým otvoril nový výber, načítava ďalej.
Widget s médiami otvorí dialóg (načítavanie) hneď pred čítaním `fetchAssetAsCmsMedia` (`:644`), ako ho otvára obrázkový
widget pred `fetchAsset`. Zavrie ho: čítanie zlyhalo (`:655`, hláška ako doteraz), asset druhu, ktorý neberie (audio bez
podcastu, video, ktorého súbor nie je video; `:777`), obrázok inej licencie pred kopírovaním (`:718`; kópiu potom ukáže
dialóg uploadu ako v obrázkovom widgete, počas kopírovania sa neukazuje nič, ako tam).

**Rozhodnutie: dialóg hneď + stráž, nie sklad pre každý dialóg.** Najmenšia zmena, ktorá (2) zaručí: modálny dialóg
načítavania nedovolí otvoriť iný dialóg bez toho, aby ho redaktor zavrel, a zavretie výber zruší; stráž prázdneho skladu
pokryje dialóg otvorený inak než rukou (hostiteľ, `expandMetadata`). Sklad pre každý dialóg by menil oba widgety,
`ImageDetailDialogMetadata` aj stráže OP7/OP8, ktoré sa o sklad opierajú (`dialogOfAnotherPick`, `pickInDialog`).

**Redaktor, podľa poradia.** (a) Výber potvrdený: hneď dialóg so spinnerom, „Potvrdiť" vypnuté; po čítaní formulár (obrázok)
alebo médium. Pri obrázkovom widgete bez zmeny, pri widgete s médiami doteraz nič, kým čítanie neodpovedalo. (b) Dialóg
zavretý počas čítania (X, Esc, klik vedľa): odpoveď nič neotvorí, sklad ostane; doteraz sa vybraný obrázok dal do skladu aj
tak (obrázkový widget, obrázok vo widgete s médiami), video či podcast dialóg otvoril. (c) Potom otvorený dialóg iného widgetu
a písanie v ňom: ostane, ako ho napísal (doteraz ho odpoveď nahradila, pri médiu aj prekryla). (d) Dialóg iného widgetu
otvorený nad načítavaním bez zavretia (len kódom): jeho formulár ostane, dialóg výberu sa zavrie. (e) Zavretie a nový výber:
ukáže sa len nový, nech prvý odpovie skôr či neskôr; dialóg načítava, kým nový neodpovie. (f) Zlyhané čítanie, nebraný druh,
obrázok na kópiu (widget s médiami): dialóg sa zavrie. **Druhý redaktor:** zámok sa vráti, keď čítanie skončí (s hodnotou
poľa), ako doteraz pri výbere, ktorý skončil bez dialógu.

**Prípady** (`imageWidgetsPickWhileItIsRead.test.ts`; stand-in dialógu a spolupráce, čítania drží prípad; 6 na widget + 3
widget s médiami): načítavanie hneď a potom obrázok; zavretý → nič, zámok s 7; zavretý → dialóg iného widgetu ostane
napísaný; dialóg iného widgetu nad načítavaním → formulár ostane, dialóg výberu sa zavrie; nový výber po zavretí, prvá
odpoveď pred / po druhej; zlyhané čítanie, audio bez podcastu, obrázok na kópiu. **Ohyby:** `229-media-nothing-shown-while-read`
5 / 15, `229-single-answer-over-another-form` 1, `229-media-close-keeps-the-pick` 1, `229-media-copy-leaves-the-dialog-open` 1.

## 232: zámok widgetu, ktorý zanikne

**Kód** (`onBeforeUnmount`, `ImageWidgetInner.vue:357`, `ImageMediaWidgetInner.vue:368`). Zanikajúci widget vráti zámok
`releaseFieldLockLocal` s hodnotou svojho poľa na tejto stránke (obrázkový: `modelValue`; s médiami: `{ image, media }`), ako
`finally` potvrdenia. Raz: `releaseFieldLockLocal` vracia len zámok, ktorý widget drží (`lockedLocal`), a nastaví ho na
`false`. Nie, keď beží uloženie (`metadataDialogSaving`) alebo zmazanie (`deletePending`): zámok vráti ich koniec ako doteraz
(uloženie: `finally` z OP8-L1 c1/c2). Nie, keď od posledného ťahu widgetu vzal ťah zámku iný widget toho poľa
(`lockTurnTakenSince`, `fieldLockTurns.ts`).
**Doplnok (c1: zrušený).** Krok pridal strážcovi dialógov `{ immediate: true }` (kópia nakreslená s otvoreným dialógom
uploadu svojej fronty si vezme zámok). „Nutný" nebol: dialóg uploadu je celoobrazovkový, pripnutie počas neho rukou nejde;
kópia ho dostala len cestou kopírovania zaniknutého widgetu do licencie, ktorú c1-3 zavrel. Pozri c1-3.

**Redaktor (dvaja v článku; c1 opravené).** Dialóg obrázka, výber z knižnice, dialóg načítavania výberu a dialóg uploadu
prekryjú stránku, takže pripnúť „Supplementary media" sa dá, kým zhodenie čaká na zámok, kým sa ešte číta alebo kopíruje
výber, ktorého dialóg načítavania redaktor zavrel, alebo z otvoreného menu (klik na pripnutie ho zavrie a jeho zatvorenie
zámok vráti samo). Vtedy sa druhému redaktorovi pole odomkne hneď (hodnota ako na stránke prvého); doteraz ostalo
zamknuté do odchodu z článku, alebo kým kópia zámok nevzala a nevrátila. Počas uloženia odomkne pole koniec uloženia
(ako po OP8-L1), po c1 aj koniec zmazania (c1-5). Redaktor sám nevidí nič nové.

**Prípady** (`imageWidgetsLockWhenAWidgetGoes.test.ts`, oba widgety, 8 na widget): zánik s dialógom, menu, výberom
(raz, s 7); zánik počas čítania výberu, odpoveď nič ďalšie; stráž: zánik počas uloženia (nič, potom raz na konci); stráž:
zánik bez zámku nič, po vrátení nič druhý raz; kópia nakreslená s dialógom uploadu (pôvodný nič, zavretie kópie raz);
pôvodný zanikne skôr (raz), kópia vezme a vráti. **Ohyby:** `232-single-gone-keeps-the-lock` 5 / 16,
`232-media-gone-during-a-save-gives-it-back` 1, `232-media-gone-frees-the-copy` 1, `232-single-copy-takes-nothing` 2.

## 233: kópia nakreslená počas uloženia obrázka

**Kód.** `utils/imageSaves.ts`: poznámka stránky pre obrázok (kľúč: názov konfigurácie a id): uloženia na ceste (značky),
počet zodpovedaných a obrázok z poslednej odpovede. Aktualizácia obrázka ide cez `noteImageSave` (`:751` / `:905`); poznámka
sa zapíše aj vtedy, keď widget medzitým zanikol (pred `if (disposed) return`). Widget si pri čítaní pamätá počet
zodpovedaných uložení v čase, keď čítanie **poslal** (`resImageReadAt`, `:515-518` / `:526-529`; pri obrázku daný priamo
alebo z vlastnej odpovede počet v tej chvíli, `:500` / `:511`). „Upraviť metadáta" (`actionEditMeta`, `:303` / `:314`):
(1) keď je na ceste uloženie toho obrázka **iným** widgetom stránky (vlastné značky `ownImageSaves` sa nečakajú), dialóg sa
otvorí s načítavaním (sklad prázdny, „Potvrdiť" vypnuté) a čaká na koniec uloženia; zavretý medzitým nič neotvorí
(`answerTakenFor`). (2) Keď odvtedy, čo widget obrázok čítal, odpovedalo uloženie iného widgetu, widget vezme obrázok z tej
odpovede (`reload(saved, null, true)`: náhľad, `append` aj ďalšie „Upraviť metadáta"), bez požiadavky. Potom ako doteraz.

**Redaktor.** Kroky z overenia (pripnutie počas uloženia, pomalý server): „Upraviť metadáta" v kópii po odpovedi uloženia
ukáže uložené texty, či kópia čítala pred uložením alebo jej čítanie odpovedalo po ňom; „Potvrdiť" pošle tie. Otvorené
**počas** uloženia: dialóg so spinnerom (nadpis „Upraviť médium", ako dialóg načítavania výberu, nález 4), „Potvrdiť"
vypnuté, kým uloženie neodpovie; potom uložené texty, po zlyhaní texty, ktoré kópia prečítala. Bez kópie nič nové: vlastné
uloženie sa nečaká (dialóg hneď so starými textami a odpoveď ho zavrie, ako po OP7), žiadna požiadavka navyše. **Druhý
redaktor** už nedostane staré texty späť.

**Prípady** (`imageWidgetsCopyDrawnDuringASave.test.ts`, oba widgety, 7 na widget; stand-in backendu obrázkov drží posledné
uložené texty a čítanie odpovedá tým, čo bolo pri poslaní): kópia čítala pred odpoveďou (uložené texty, 2 čítania, potvrdenie
ich pošle); čítanie odpovedá po uložení so starými (uložené); otvorené počas uloženia (načítava, potom uložené) a po zlyhaní
(prečítané); zavreté počas čakania (nič); stráže: kópia čítala po odpovedi (jej texty, 2 čítania); vlastné uloženie
nečaká. **Ohyby:** `233-single-saved-image-not-taken` 3 / 14, `233-media-no-wait` 3, `233-own-save-waited-for` 2,
`233-single-read-counted-at-its-answer` 1.

## Dôkaz a behy

Oba widgety zo snímku `OP9-L1` nad tromi novými súbormi (`pracovne/impl-lib-op9/stare.sh`, výpisy
`ohyb-stare-*.log`): **35 / 45** červených (232: 12 / 16, 229: 13 / 15, 233: 10 / 14). Prechádzajú stráže: zánik počas
uloženia ×2, zánik bez zámku a raz ×2; obrázkový widget ukazoval načítavanie aj predtým; widget s médiami „prvá odpoveď pred
druhou" (posledná odpoveď vyhrala aj predtým); kópia čítala po odpovedi ×2; vlastné uloženie ×2. Ohybov 12 (`ohyby.py`,
`ohyby-beh.sh`, výpisy `ohyb-*.log`, v TMPDIR `bend-op9l1-*.json`), každý zhodil aspoň jeden prípad.

`oxfmt`, `oxlint`, `eslint`, `stylelint` na šiestich súboroch čisté. **CK-LIB OP9-L1 zelená na prvý beh**: testy
(`vysledky/OP9-L1-testy.log`) 330 súborov / 4 890 testov (po OP8-L1-c2 327 / 4 845; +3, +45), žiadny opakovaný prípad,
179 s; linty (`vysledky/OP9-L1-linty.log`) `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`,
`lint:stylelint` čisté (hláška sentry „Invalid token" v `test:eslint` ako v OP7, OP8).

## Medze

- 229: počas kopírovania do licencie neukazuje nič ani jeden widget (ako doteraz obrázkový); dialóg uploadu, ktorý otvorí
  odpoveď kopírovania, prekryje dialóg otvorený medzitým a jeho „Použiť" nahradí formulár toho dialógu (nález 1).
- 229: dialóg, ktorý načítava, sa zavrie aj vtedy, keď sklad naplnilo niečo vlastné widgetu (upload, „Upraviť metadáta").
  (c1) Veta „rukou to počas modálneho načítavania nejde" neplatila (Opus 2): odpoveď vlastného uloženia dialóg načítavania
  zavrela, „Upraviť metadáta" otvorené potom ukázalo len spinner a odpoveď výberu ho zavrela. Po c1-2 ho odpoveď uloženia
  nechá načítavať; rukou sa to potom naozaj nedá.
- 232: zánik počas zmazania (`callDeleteApiOnRemove`, len admin-ugc blog): koniec zmazania vráti zámok ako doteraz (s `null`
  cez `reset`, bez ohľadu na ťah kópie); keď bol vtedy otvorený dialóg widgetu, nevráti ho nič. Počítadlo ťahov je stránky
  (medza OP8-L1 c2): druhú kartu toho istého redaktora nevidí.
- 233: len „Upraviť metadáta" a len aktualizácie cez `imageApi.updateImage` týchto dvoch widgetov; formulár `expandMetadata`
  (vložené dialógy hostiteľa) a uloženia galérie (`bulkUpdateImages`) poznámka nepokrýva; poznámka je stránky (iná karta,
  iný redaktor nie). Čo kópia ukazuje mimo dialógu, sa obnoví až pri „Upraviť metadáta", nie keď príde odpoveď. Uloženie,
  ktoré nikdy neodpovie, nechá dialóg kópie načítavať, kým ho redaktor nezavrie.

## Nové nálezy (nemenené)

1. **Kopírovanie do licencie počas výberu nič neukazuje** (oba widgety): editor môže otvoriť iný dialóg, odpoveď otvorí nad
   ním dialóg uploadu a jeho „Použiť" (`onAssetUploadConfirm`, `setDetail`) nahradí formulár iného widgetu cez spoločný sklad.
   Z čítania kódu.
2. **Výber widgetu, ktorý zanikol počas kopírovania, pokračuje v kópii**: `onCopyToLicence` nemá stráž `disposed`
   (`ImageWidgetInner.vue:447`, `ImageMediaWidgetInner.vue:454`) a otvorí dialóg uploadu fronty, ktorý nakreslí kópia
   (ten istý kľúč fronty); kópia si zámok vezme (strážca dialógov). Asi chcené, nie overené.
3. **`reset()` widgetu s médiami vyprázdni sklad dialógu** (`imageMediaWidgetStore.reset()`, zmazanie): sklad je stránky,
   môže v ňom byť formulár otvoreného dialógu iného widgetu. Rovnako `reset()` skladu pri nakreslení každého widgetu (kópia pri
   pripnutí). Z čítania kódu.
4. **Nadpis dialógu, ktorý načítava, je „Upraviť médium"** (`ImageDetailDialogMetadata.vue:208`: bez detailu `type` je
   `null`), aj pri výbere obrázka v obrázkovom widgete (doteraz) a pri čakaní „Upraviť metadáta" na uloženie (233). Kozmetika.

## Cyklus c1 (OP9-L1-c1, 14. 10.; posudky Codex `posudky/OP9-L1-codex.md` a Opus, osem bodov)

Snímok `OP9-L1-c1`, záplata `zaplaty/OP9-L1-c1.diff` (9 súborov, 1 464 riadkov; mimo `src` a `doc` nič). Zmenené:
`components/ImageWidgetInner.vue`, `components/ImageMediaWidgetInner.vue`, `utils/imageSaves.ts`,
`store/imageMediaWidgetStore.ts`; testy `imageWidgetsLockWhenAWidgetGoes.test.ts` (20), `imageWidgetsPickWhileItIsRead.test.ts`
(20), `imageWidgetsCopyDrawnDuringASave.test.ts` (16), nový `imageWidgetsPickOwnsItsDialog.test.ts` (10);
`doc/changelog/2.0.0.md` (odrážky `:183-185` prepísané, veta OP7 v `:178` o výbere, ktorý sa ešte číta). Produkčný kód
(pridané / ubraté, s komentármi): obrázkový widget +61 / −23, s médiami +67 / −29, `imageSaves.ts` +56 / −16, sklad +16.
Všetko v oboch widgetoch.

**c1-1 (Opus 1): autori DAM zastaraného výberu.** Čítanie výberu si asset na ponuku autorov len odloží (`authorsToOffer`,
`ImageWidgetInner.vue:625`, `ImageMediaWidgetInner.vue:760`); `offerDamAuthorsOf` ide až za `answerTakenFor`
(`:659` / `:793`). Redaktor (ext. systém s autormi DAM): výber, zavretie, nový výber, vybraní autori; neskoršia odpoveď
prvého výberu ich už nevymaže (doteraz pole autorov vyprázdnila, pri inom assete ho nahradila prázdnym povinným zdrojom).

**c1-2 (Opus 2): odpoveď vlastného uloženia počas výberu. Voľba: dialóg, ktorý načítava pre výber, sa nezavrie.**
`dialogOfAnotherPick` berie aj otvorený dialóg bez obrázka, ktorý načítava (`loadingInDialog`; `:799` / `:955`): ostane
otvorený, sklad sa nevyprázdni, nič sa nepošle ani neuvoľní; výber ho po prečítaní vyplní s id uloženého obrázka (pri
vytvorení s vytvoreným, žiadny druhý obrázok) a zámok vráti jeho zatvorenie alebo potvrdenie, ako pri dialógu iného výberu.
Prečo nie zavrieť a výber zahodiť: widget s médiami pred krokom výber počas uloženia nestratil (dialóg sa otvoril až po
čítaní), zahodenie by bolo zhoršenie; teraz výber nestratí ani obrázkový widget. Zmena oproti OP7: veta changelogu `:178`
„a pick still being read when the answer comes is closed with it, as before" prepísaná (výber ďalej načítava a ukáže sa).
Redaktor: „Upraviť metadáta", „Potvrdiť" (pomalé), X, „Nahradiť z DAM", výber; odpoveď uloženia: dialóg so spinnerom
ostane, po čítaní výber; zavretý medzitým: nič nezostane načítavať a „Upraviť metadáta" ide normálne.

**c1-3 (Codex 3, Opus 3, nálezy 1 a 2): kopírovanie do licencie.** (a) Dialóg načítavania sa otvorí pred kopírovaním aj v
obrázkovom widgete (riadok presunutý pred kontrolu licencie) a widget s médiami ho už pred kopírovaním nezatvára; kým sa
kopíruje, nedá sa otvoriť nič iné. (b) Odpoveď kopírovania prejde cez `answerTakenFor` (`:605-620` / `:739-754`): widget
zanikol, dialóg zavrel redaktor alebo sklad drží formulár iného dialógu → dialóg uploadu sa neotvorí (pri cudzom formulári sa
dialóg výberu zavrie, sklad ostane). Inak sa dialóg načítavania zavrie a hneď otvorí dialóg uploadu (zámok bez zmeny).
Zlyhané kopírovanie: hláška ako doteraz, dialóg sa zavrie. (c) Zaniknutý widget kópiou nič neotvorí ani nezapíše
(`onCopyToLicence` volá len cesta po stráži). **`immediate` zrušené** (`:938` / `:1121`): bez cesty (c) kópia dialóg
uploadu nikdy nezdedí (je celoobrazovkový, pripnutie počas neho nejde); s `immediate` by kópia zámok vzala aj pre zastaraný
dialóg uploadu (Opus 6), takže Opus 6 sa neopravuje, ide do nálezov. (c2) Strážcovia dialógov sú `:951` / `:1134` (krok
uviedol `:938` / `:1121`, to sú strážcovia menu).

**c1-4 (Opus 5): `assetPickPending` je počítadlo** `assetPicksPending` (`:569` / `:637`): výber sa ráta, kým beží
ktorýkoľvek výber widgetu. Dva zavreté výbery: zámok sa vráti, keď skončí posledný (doteraz po prvom).

**c1-5 (Codex 1): koniec zmazania zaniknutého widgetu** (`:853-862` / `:1017-1026`). Zaniknutý widget po odpovedi
zmazania nevolá `reset` (nič nezapíše do stránky, widget s médiami ani nevyprázdni sklad) a zámok vráti s hodnotou poľa na
stránke, len keď od jeho posledného ťahu nevzal ťah iný widget poľa (`lockTurnTakenSince`), ako `finally` potvrdenia.
Doteraz `reset` vrátil zámok s `null` aj pod otvoreným menu kópie. Medza kroku o zmazaní odpadá.

**c1-6 (Codex 4, nález 3): vyprázdnenie skladu pod otvoreným formulárom.** Sklad si pamätá widgety, ktorých dialóg ho
ukazuje (`setShownBy`, `resetUnlessShown`, `store/imageMediaWidgetStore.ts`): otvorený dialóg obrázka, alebo formulár
`expandMetadata` po celý život widgetu. Widget pri nakreslení (`:238` / `:255`) a widget s médiami pri zmazaní (`:602`)
sklad vyprázdnia, len keď ho neukazuje dialóg iného widgetu; bez otvoreného dialógu ako doteraz (zvyšok po widgete, ktorý
odišiel, sa vyprázdni). Widget sa prihlasuje strážcom (`:272` / `:288`, `flush: 'sync'`) a odhlási pri zániku.

**c1-7 (Codex 2): život poznámky uložení.** (c2: nahradené, pozri „Cyklus c2"; zahodenie počas uloženia na ceste vrátilo
chybu 233 pri kópii, ktorej konfigurácia sa číta zo siete.) `imageSaves.ts`: poznámka obrázka žije, kým ho drží widget stránky (`holdImage`
pri čítaní, pri danom obrázku, pri zániku a pri zmene na iný obrázok či médium); keď ho nedrží žiadny počas celej úlohy
(`setTimeout` 0, `dropUnheld`), zahodí sa so všetkým, aj s uloženiami na ceste a čakajúcimi (pustia sa). Záruka 233 ostáva:
kópia pri pripnutí sa nakreslí v tej istej úlohe, v ktorej pôvodný zanikne (admin-cms: konfigurácia je už načítaná, wrapper
čaká len mikroúlohy), a svoje čítanie pošle hneď. Widget inej stránky (článok opustený a otvorený znova) na uloženie
predošlej nečaká a nič z neho neberie. Pamäť: len obrázky, ktoré drží niektorý widget. Changelog „page" je pravdivé.

**c1-8: texty.** Changelog 229 (autori, kopírovanie, sklad, zámok), 232 (čo redaktor môže naozaj spraviť, zmazanie),
233 (strana) a veta OP7 `:178`; v poznámke opravené „Doplnok", „Redaktor" pri 232 a medza 229 (označené „(c1)").

**Prípady c1** (nové 26, zrušené 5, v `CopyDrawnDuringASave` 12 s pripnutím v jednej úlohe): `PickOwnsItsDialog` 10 (c1-1, c1-2, c1-4, c1-6 na widget; stráž zvyšku po
odchode; zmazanie widgetu s médiami pod iným formulárom); `PickWhileItIsRead` +6 (c1-3: načítavanie počas kopírovania a
dialóg uploadu; zavretý / iný dialóg → nič), prípad widgetu s médiami o zatváraní pred kopírovaním zrušený (správanie
zrušené); `LockWhenAWidgetGoes` +8 (zhodenie čakajúce na zámok ×2, zánik počas kopírovania ×2, zmazanie ×4), zrušené dva
prípady kópie s dialógom uploadu ×2 (`immediate` preč); `CopyDrawnDuringASave` +2 (c1-7) a pripnutie v tej istej úlohe
(`pinned`), prípad „čítanie po odpovedi" je teraz „pripnuté po odpovedi". Štyri produkčné súbory zo snímku `OP9-L1-c1` nad
štyrmi súbormi (`stare-c1.sh`, výpisy `ohyb-stare-c1-*.log`): **23 / 66** červených = 23 z 26 nových (prechádzajú stráže:
zhodenie ×2, zvyšok po odchode). **Ohyby (10, `ohyby-c1.py`, `ohyby-c1-beh.sh`):** `c1-1-single-offered-before-the-check` 1,
`c1-2-media-answer-closes-the-pick` 1, `c1-3-single-nothing-shown-while-copied` 4, `c1-3-media-copy-opens-whatever` 3,
`c1-4-media-one-flag` 1, `c1-5-single-gone-delete-resets` 2, `c1-6-media-setup-resets-all` 1, `c1-6-store-shown-ignored` 3,
`c1-7-note-never-dropped` 2, `c1-7-single-read-holds-nothing` 3.

**Behy c1.** `oxfmt`, `oxlint`, `eslint`, `stylelint` na ôsmich súboroch čisté; priečinok widgetov 28 / 644 zelený.
**CK-LIB OP9-L1-c1 zelená na prvý beh**: testy (`vysledky/OP9-L1-c1-testy.log`) 331 súborov / 4 911 testov (po kroku
330 / 4 890; +1, +21), žiadny opakovaný prípad, 180 s; linty (`vysledky/OP9-L1-c1-linty.log`) `test:eslint` 7 / 82,
`lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.

**Medze a nálezy po c1.**
- Medze kroku: 229 o kopírovaní (c1-3), 232 o zmazaní (c1-5) a 233 „poznámka je stránky" (c1-7) odpadajú. Nálezy kroku 1 a 2
  sú opravené (c1-3), 3 (c1-6); 4 (nadpis „Upraviť médium" dialógu bez obrázka) ostáva, platí aj pri kopírovaní.
- c1-7 (c2 opravené): záruka 233 predpokladala, že kópia je nakreslená v tej istej úlohe ako zánik pôvodného. Veta „v
  admin-cms ju pôvodný už načítal" neplatila (Opus): licencia výberu, ktorej čítanie zlyhalo alebo nemá ext. systém, sa
  neukladá a číta ju každý widget znova, takže kópia čaká na sieť. Po c2 poznámka žije, kým je uloženie na ceste.
- c1-6: zvyšok, ktorý v sklade nechá widget, čo odišiel s otvoreným dialógom, sa vyprázdni až pri ďalšom nakreslení
  widgetu bez otvoreného dialógu (ako doteraz pri nakreslení).
- Nový nález 5 (Opus 6, nemenený): `UploadQueueDialogSingle.vue:86-90` ruší stránkový `uploadQueueDialog` len pri stope a
  použití, nie keď zanikne so svojím widgetom: ďalší widget s tým istým kľúčom fronty (iná stránka, `articleListingImage`)
  ukáže zastaraný dialóg uploadu. Bez `immediate` si preň zámok nevezme. Z čítania kódu.

## Cyklus c2 (OP9-L1-c2, 14. 10.; potvrdenia Codex bez nálezu a Opus, dva body)

Snímok `OP9-L1-c2`, záplata `zaplaty/OP9-L1-c2.diff` (6 súborov, 524 riadkov; mimo `src` a `doc` nič). Zmenené: `utils/imageSaves.ts`, `components/ImageWidgetInner.vue`,
`components/ImageMediaWidgetInner.vue`; testy `imageWidgetsCopyDrawnDuringASave.test.ts` (prípad inej stránky prepísaný,
strana pre všetky widgety), nový `imageWidgetsCopyDrawnLate.test.ts` (4); `doc/changelog/2.0.0.md` (odrážka 233).

**c2-1 (Opus 1): poznámka sa nezahodí, kým je uloženie na ceste.** `dropUnheld` (`imageSaves.ts:39-42`) zahodí poznámku,
len keď ju nedrží žiadny widget **a** nie je na ceste žiadne jej uloženie; zahodí ju hneď (`setTimeout` z c1 preč): bez
uloženia na ceste nemá kópia čo zmeškať, jej čítanie je po odpovedi. Kópia nakreslená až po čítaní konfigurácie zo siete
teda na uloženie čaká, alebo ho po odpovedi vezme. (L2-c1: stránka zrušená, pozri „Krok OP9-L2, cyklus c1", c1-3; vety
ďalej v tomto odseku a medza c2 už neplatia.) **Iná stránka stále nečaká:** stránka je inštancia pohľadu trasy, ktorý
widget kreslí (`inject(matchedRouteKey)` z vue-router, `instances.default`; `ImageWidgetInner.vue:316-317`,
`ImageMediaWidgetInner.vue:332-333`). Pripnutie ju nemení (kópia je v tom istom `ArticleEditForm`), odchod a nové otvorenie
článku áno (admini kľúčujú pohľad cestou a kreslia ho znova; aj Späť). Každé uloženie nesie stránku widgetu, ktorý ho
poslal (`noteImageSave`), a widget čaká (`imageSavesOfOthersOver`) a berie (`imageSavedSince`) len uloženia svojej
stránky. Bez routera (testy, hostiteľ bez trás) je stránka jedna (`null`), ako doteraz. Pamäť: poznámky obrázkov, ktoré drží
widget, a tých, ktorých uloženie je na ceste (uloženie, ktoré nikdy neodpovie, ju drží).

**c2-2 (Opus 2):** čísla riadkov strážcov dialógov v časti c1 opravené (`:951` / `:1134`).

**Prípady c2.** `imageWidgetsCopyDrawnLate.test.ts` (2 na wrapper `AImageWidget` a `AImageMediaWidget`): skutočné
wrappery, pripnutie (pôvodný zanikne, kópia sa nakreslí v tej istej úlohe), čítanie licencií výberu kópie drží prípad
(sieť), uplynie úloha, potom odpovie a vnútorný widget sa nakreslí a prečíta obrázok; „Upraviť metadáta" počas uloženia
načítava a ukáže uložené, po odpovedi ukáže uložené. `CopyDrawnDuringASave`: widgety majú stránku, prípad c1-7 je teraz
„widget inej stránky" nakreslený v tej istej úlohe (nečaká, neberie). Zdroje zo snímku `OP9-L1-c2` (`stare-c2.sh`, výpis
`ohyb-stare-c2.log`): **6 / 20** červených = všetky nové a prepísané. **Ohyby:** `c2-note-dropped-on-its-way` 14 / 20,
`c2-waits-for-any-page` 2, `c2-takes-any-page` 2.

**Behy c2.** `oxfmt`, `oxlint`, `eslint`, `stylelint` na piatich súboroch čisté. **CK-LIB OP9-L1-c2 zelená na prvý beh**:
testy (`vysledky/OP9-L1-c2-testy.log`) 332 súborov / 4 915 testov (po c1 331 / 4 911; +1, +4), žiadny opakovaný prípad,
184 s; linty (`vysledky/OP9-L1-c2-linty.log`) `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`,
`lint:eslint`, `lint:stylelint` čisté.

**Medza c2 (L2-c1: odpadá so stránkou).** Stránka je inštancia pohľadu najbližšieho `RouterView`; hostiteľ, ktorý pri zmene parametra trasy pohľad
nekreslí znova (bez kľúča cestou), má pre dva články jednu stránku. Iný článok má iné obrázky, takže to platí len pre
návrat na ten istý článok v tom istom pohľade: widget by potom na jeho uloženie z predošlého zobrazenia čakal. Admini
pohľad kľúčujú cestou.

## Krok OP9-L2 (14. 10.; nálezy 235 a 236, vlastník „235 a 236 mozme opravit")

Zadanie `krok5-praca/zadania/zadanie-OP9-L2.md`. Snímok `OP9-L2` (po c2), záplata `zaplaty/OP9-L2.diff` (7 súborov, 557
riadkov; mimo `src` a `doc` nič). Zmenené: `components/ImageDetailDialogMetadata.vue`, `components/ImageMediaWidgetInner.vue`,
`dam/uploadQueue/components/UploadQueueDialogSingle.vue`; nové testy `imageDialogTitle.test.ts` (9),
`imageWidgetsUploadDialogGoes.test.ts` (3); upravený `consumerProfileImageWidgetUpload.test.ts:752`; changelog `:140`
(236) a `:187` (235).

**235: nadpis dialógu obrázka.** Dialóg dostane od widgetu, na čo je otvorený (nová vlastnosť `type`,
`ImageDetailDialogMetadata.vue:44`); nadpis ide z nej (`titleType`, `:82`, `:215`) a z detailu skladu len bez nej (nikto
iný dialóg nepoužíva, nie je exportovaný). Obrázkový widget ju už posielal (`:type="DamAssetType.Image"`,
`ImageWidgetInner.vue:1190`), dialóg ju nečítal: teraz vždy „Upraviť obrázok". Widget s médiami ju určí pri každom
otvorení (`dialogType`, `:336`): „Upraviť metadáta" podľa toho, čo drží (obrázok, video, podcast; `:338`), výber podľa typu
vybraného assetu ešte pred čítaním (`:673`), upload obrázok (`:1067`); `:1397`. Redaktor: dialóg obrázka má od otvorenia
„Upraviť obrázok" aj počas načítavania výberu, kopírovania do licencie, čakania na uloženie (233) a ukladania; dialóg videa
alebo podcastu „Upraviť médium". Doteraz „Upraviť médium" počas načítavania a po príchode obrázka zmena. Žiadny nový text.
**Nadpisy ostatných dialógov** (`W/`, `dam/assetSelect/`, `dam/uploadQueue/`): pevné okrem dvoch dialógov uploadu, ktorých
nadpis ide podľa stavu: `UploadQueueDialogSingle.vue:224-234` a `UploadQueueDialog.vue:231-241` „Nahrávanie" / „Nahrávanie
ukončené". Je tam od vydania 1.40.0 (január 2024), nie z našich krokov: neopravené (nález 6). Iný dialóg, ktorého nadpis by
zaviedli naše kroky, som nenašiel.

**236: zastaraný dialóg uploadu.** `UploadQueueDialogSingle.vue:93-95`: dialóg, ktorý zaniká, zruší aplikačný
`uploadQueueDialog`, ak ešte menuje jeho frontu; zatvorenie zastavením alebo použitím ho ruší ako doteraz (pri zániku je
už `null`). Redaktor (admin-cms): upload, vyhodenie z miestnosti článku (`articleEditCollab.ts:218-221` → detail článku),
návrat: widget s kľúčom fronty dialóg uploadu sám neotvorí (doteraz ho otvoril hneď). **Upload sám:** nezastaví sa; front
je aplikácie (spoločný sklad Pinia `uploadQueuesStore.ts:42`, kľúč dialógu je premenná modulu `useUploadQueueDialog.ts:4`;
„stránky" bolo nepresné, (L2-c1)), dialóg ho pri zániku nezastavuje (`stopUpload` len zastavenie a použitie), takže súbor
sa dopošle, spracovanie sa dozvie poll fronty a riadok ostane vo fronte, kým ju niekto nezastaví alebo nepoužije; nikto ho
widgetu neodovzdá a asset ostane v DAM (bez zmeny). (L2-c1) „Nikto ho widgetu neodovzdá" neplatilo (nález 8, Codex 4):
ďalší upload do tej istej fronty riadok pridal k novému a „Uložiť a použiť" odovzdal starý súbor; po L2-c1 c1-1 sa taká
fronta pred pridaním zastaví.

**Existujúci prípad, ktorý sa zmenil** (`consumerProfileImageWidgetUpload.test.ts:752`, CMS aj UGC): pripínal, že widget
nakreslený s tým istým kľúčom po zániku pôvodného dialóg uploadu znova ukáže a upload v ňom dokončí („the queue and the
dialog that is open belong to the page"). Teraz: front ide ďalej a riadok ostane (stav `Uploaded`), `uploadQueueDialog` je
`null` a nový widget dialóg neotvorí.

**Prípady** (`imageDialogTitle.test.ts`: skutočný dialóg 5 – obrázok počas načítavania, počas ukladania s prázdnym skladom,
video počas načítavania, zobrazený obrázok, bez `type` podľa detailu; widgety so stand-inom 4 – obrázkový výber, výber
obrázka a videa vo widgete s médiami, video na „Upraviť metadáta" a potom upload; `imageWidgetsUploadDialogGoes.test.ts`:
zánik s otvoreným dialógom ×2 widgety, stráž: dialóg inej fronty). Zdroje zo snímku `OP9-L2` (`stare-l2.sh`, výpis
`ohyb-stare-l2.log`): **8 / 12** červených (prechádzajú stráže: video počas načítavania, zobrazený obrázok, bez `type`,
iná fronta); upravený existujúci prípad nad snímkom tiež padne (`uploadQueueDialog` ostáva). **Ohyby:**
`l2-235-title-from-the-detail` 2, `l2-235-media-pick-keeps-the-type-before` 1, `l2-236-dialog-stays-named` 2.

**Behy.** `oxfmt`, `oxlint`, `eslint`, `stylelint` na dotknutých súboroch čisté. **CK-LIB OP9-L2 zelená** na druhý beh
testov: prvý (rovnaký log) padol na prípade `:752` ×2 (CMS, UGC), ktorý pripínal staré správanie 236; po jeho úprave
testy (`vysledky/OP9-L2-testy.log`) 334 súborov / 4 927 testov (po c2 332 / 4 915; +2, +12), žiadny opakovaný prípad,
184 s; linty (`vysledky/OP9-L2-linty.log`) `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`,
`lint:eslint`, `lint:stylelint` čisté.

**Nové nálezy (nemenené).**
6. Nadpis oboch dialógov uploadu sa mení so stavom („Nahrávanie" / „Nahrávanie ukončené",
   `UploadQueueDialogSingle.vue:224-234`, `UploadQueueDialog.vue:231-241`), proti pravidlu vlastníka o nadpisoch; od 1.40.0.
7. `UploadQueueDialog.vue` (galéria, zoznam assetov) má tú istú vadu ako 236: pri zániku ruší len
   `uploadQueueDialogSaving` (`:110-112`), nie `uploadQueueDialog`; ďalší widget s tým istým kľúčom ho otvorí. Z čítania kódu.
8. (L2-c1: opravené c1-1; 7 opravené c1-2.) Riadok fronty, ktorej dialóg zanikol bez zastavenia, ostane vo fronte: ďalší upload widgetu s tým istým kľúčom
   pridá svoj súbor do tej istej fronty a dialóg jedného súboru ukáže prvý riadok, teda starý súbor (`item` je
   `items[0]`, `UploadQueueDialogSingle.vue:67-69`). Z čítania kódu.

## Krok OP9-L2, cyklus c1 (14. 10.; posudky Codex `posudky/OP9-L2-codex.md` a Opus, päť bodov; pokrýva aj c2 OP9-L1)

Snímok `OP9-L2-c1`, záplata `zaplaty/OP9-L2-c1.diff` (14 súborov, 979 riadkov; mimo `src` a `doc` nič). 236 ostáva
(oba posudky: prípad `:752` bol z čítania kódu, nie rozhodnutie). Zmenené: `uploadQueue/composables/useUploadQueueDialog.ts`,
`uploadQueue/components/UploadQueueDialog.vue`, `UploadQueueDialogSingle.vue` (komentár), `imageWidget/components/ImageWidgetInner.vue`,
`ImageMediaWidgetInner.vue`, `ImageWidgetMultipleInner.vue`, `assetSelect/components/AAssetListInner.vue`,
`imageWidget/utils/imageSaves.ts`; testy: nové `imageWidgetsUploadIntoALeftQueue.test.ts` (5), `imageSaves.test.ts` (2),
upravené `imageWidgetsCopyDrawnDuringASave.test.ts` (prípad inej stránky nahradený prípadom článku otvoreného znova, +1 na
widget: zatvorené čakanie; stránka len pre ten prípad, ako ju má aplikácia),
`imageWidgetsCopyDrawnLate.test.ts` (bez stránky), `assetDetail/__tests__/consumerProfileAssetDetailOpen.test.ts:282`;
changelog `:140` (236) a `:186` (233).

**c1-1 (Codex 4 kritické, Opus): starý súbor použitý s novým.** `stopQueueLeftBehind(queueKey)`
(`useUploadQueueDialog.ts:23`): fronta, ktorú nemenuje žiadny dialóg, drží len riadky dialógu, ktorý zanikol so svojím
widgetom; keď widget začne pridávať súbory alebo kópiu z licencie zvonku dialógu, zastaví sa (aj pri pridaní, ktoré potom
neurobí: odmietnutá kópia `notAllowed` / `unassigned`, zrušená otázka limitu galérie; (L2-c2) spresnené; `stopUpload`: riadky `Stop`, rozposielaný
kúsok sa preruší, fronta sa vyprázdni; asset, ktorý upload už vytvoril, ostane v DAM). Volá ju jedno miesto pred každým
pridaním: obrázkový widget (`ImageWidgetInner.vue:449` zhodenie, `:470` kópia, `:501` vstup súboru), widget s médiami
(`:466`, `:486`, `:517`). Redaktor (admin-cms): článok X, listing, upload A, strata miestnosti; článok Y, listing, upload
B: dialóg ukáže B, „Uložiť a použiť" dá widgetu B. Doteraz ukázal A, použil A a B sa zastavil s frontou. Pridanie do
otvoreného dialógu (jeho „+", zhodenie naň) frontu nezastaví, ten ju menuje.

**c1-2 (Codex 5): dialóg viacerých súborov.** `UploadQueueDialog.vue:114`: pri zániku zruší aj `uploadQueueDialog`, ak
ešte menuje jeho frontu (ako 236). Jeho hostitelia volajú tú istú stráž: galéria (`ImageWidgetMultipleInner.vue:212`
vstup, `:223` zhodenie, pred kontrolou limitu, takže staré riadky sa do 50 neratajú; `:233` kópia), zoznam assetov
(`AAssetListInner.vue:198`). Staré riadky sa s novým uploadom galérie neodovzdajú.

**c1-3 (Opus): stránka z c2 zrušená.** Iný článok má iné obrázky, takže stránka vylučovala len ten istý obrázok znova
otvoreného článku, presne prípad, ktorý mal čakať (Upraviť metadáta, Potvrdiť, pomalé uloženie, X, späť na zoznam, článok
znova, alebo zmena stavu, ktorá edit kreslí znova, `articleEditActions.ts:759-771`). `imageSaves.ts`: bez stránky; widget
čaká na uloženie toho istého obrázka (konfigurácia, id) a berie ho odkiaľkoľvek (`:102`, `:120`), widgety už `vue-router`
nepoužívajú. Ostáva: poznámka sa nezahodí, kým je jej uloženie na ceste (`dropUnheld`, `:39`). Požiadavka „widget nikdy
nečaká na uloženie inej stránky" z c2 je zrušená (aj v changelogu). Redaktor: v článku otvorenom znova počas uloženia
„Upraviť metadáta" načítava, kým uloženie neodpovie, potom ukáže uložené texty (doteraz staré a „Potvrdiť" ich zapísal
späť).

**c1-4 (Codex 7): čakajúci sa nehromadia.** `imageSavesOfOthersOver` vracia `{ over, cancel }`; `cancel` čakajúceho
zo zoznamu odoberie a pustí. Widget si ho drží (`cancelSaveWait`, `ImageWidgetInner.vue:314`, `ImageMediaWidgetInner.vue:330`)
a zavolá ho pri zatvorení dialógu (`:735` / `:875`) a pri zániku (`:376` / `:394`).

**c1-5: texty.** Front a kľúč dialógu sú aplikácie (spoločný sklad Pinia `uploadQueuesStore.ts:42`, premenná modulu
`useUploadQueueDialog.ts:4`), nie stránky: opravené v časti OP9-L2 aj v changelogu. „Nikto ho widgetu neodovzdá" bolo
nepravdivé (nález 8): opravené a označené. Changelog 236 (`:140`) hovorí, čo platí po c1-1 a c1-2; 233 (`:186`) bez
stránky, s článkom otvoreným znova.

**Existujúci prípad, ktorý sa zmenil** (`consumerProfileAssetDetailOpen.test.ts:282`, hostiteľ „edit asset" riadka dialógu
fronty, CMS aj UGC): pripínal, že galéria nakreslená znova dialóg fronty sama otvorí („the queue and its dialog are the
page's"). Po c1-2 ho neotvorí; prípad ho pomenuje sám (nič v stránke to už nerobí), zvyšok prípadu (detail assetu sa
zavrie s hostiteľom a nakreslí sa znova len na „edit asset") bez zmeny. Prvý beh CK testov (ten istý log) padol práve tu (×2).

**Prípady** (`UploadIntoALeftQueue`: oba jednoduché widgety – nahraté A po zániku a B v ďalšom widgete: dialóg a použitie
B; A ešte na ceste: jeho kúsok sa preruší, fronta má len B; galéria – zánik zruší kľúč, nový súbor sám; `imageSaves.test`:
`cancel` pustí čakanie hneď; poznámka žije s uložením na ceste bez widgetu a zahodí sa, keď ju nič nedrží;
`CopyDrawnDuringASave` na widget: článok otvorený znova v inom pohľade trasy čaká a vezme, zatvorené čakanie a nové
otvorenie). Zdroje zo snímku `OP9-L2-c1` (`stare-l2c1.sh`, výpis `ohyb-stare-l2c1.log`): **9 / 25** červených v troch
súboroch (prechádzajú stráže „zatvorené a znova otvorené" ×2 a staršie prípady 233). **Ohyby:**
`l2c1-1-single-adds-to-the-left-queue` 2, `l2c1-1-guard-stops-named-queues-too` 5, `l2c1-2-multi-dialog-stays-named` 1,
`l2c1-3-no-wait-for-a-save-sent-before` 11, `l2c1-4-cancel-keeps-the-wait` 1.

**Behy.** `oxfmt`, `oxlint`, `eslint`, `stylelint` na dotknutých súboroch čisté. **CK-LIB OP9-L2-c1 zelená** na druhý
beh testov (prvý padol na `consumerProfileAssetDetailOpen.test.ts:483` ×2, pozri vyššie): testy
(`vysledky/OP9-L2-c1-testy.log`) 336 súborov / 4 936 testov (po OP9-L2 334 / 4 927; +2, +9), žiadny opakovaný prípad,
192 s; linty (`vysledky/OP9-L2-c1-linty.log`) `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`,
`lint:eslint`, `lint:stylelint` čisté.

**Medze.**
- Codex 6: dve pomalé uloženia toho istého obrázka (napr. pôvodná stránka a článok otvorený znova) odpovedajúce v
  opačnom poradí: poznámka drží obrázok z poslednej odpovede, ten vezme aj widget, ktorého vlastné uloženie odpovedalo
  skôr.
- c1-1: stráž zastaví frontu len pred pridaním z widgetu, ktorý ju má; riadky po zaniknutom dialógu ostanú vo fronte, kým
  ďalší upload toho istého kľúča nezačne (a ich upload beží).
- Nadpis dialógov uploadu, ktorý sa mení so stavom (nález 6, od 1.40.0), ostáva pre vlastníka.

**Krok OP9-L2, cyklus c2** (14. 10.; potvrdenia Codex `posudky/OP9-L2-c1-codex.md` a Opus). Snímok `OP9-L2-c2`, záplata
`zaplaty/OP9-L2-c2.diff` (7 súborov, 192 riadkov). (1, Codex 1) Dialóg uploadu zabudne meno pri zániku, len keď je
posledný nakreslený dialóg svojho kľúča fronty: `useUploadQueueDialogDrawn` (`useUploadQueueDialog.ts:19`, počíta dialógy
podľa kľúča), volajú ho `UploadQueueDialogSingle.vue:95` aj `UploadQueueDialog.vue:117`; dva widgety jedného kľúča (dnes ich
žiadna stránka admin-cms ani admin-ugc nemá) si dialóg nezatvoria a pridanie druhého frontu nezastaví. (2, Codex 2)
Stráž ostáva pred kontrolou limitu; changelog `:140` a odsek c1-1 hovoria presne: fronta bez dialógu sa zastaví, keď widget
začne pridávať zvonku dialógu, aj keď pridanie potom neurobí (riadky po zaniknutom dialógu sa už použiť nedajú). (3, Codex 4,
Opus 1) `imageSaves.test.ts` overuje zahodenie počtom 0 (zachovaná poznámka by ponúkla uložený obrázok); v
`imageWidgetsCopyDrawnDuringASave.test.ts` +2 na widget: čakanie otvorenia sa pustí hneď pri zatvorení a pri zániku widgetu.
Codex 3 (prípad `consumerProfileAssetDetailOpen.test.ts:282` pomenuje dialóg sám) ostáva, ako je. Nové prípady 6 (dva
dialógy ×2 widgety, čakanie ×4), zo snímku červené 2 (dva dialógy; čakanie a zahodenie opravil už c1, chytajú ich ohyby). Ohyby
`l2c2-1-any-dialog-forgets-it` 2, `l2c2-3-note-never-dropped` 1, `l2c2-3-single-close-keeps-the-wait` 1,
`l2c2-3-media-gone-keeps-the-wait` 1 (`stare-l2c2.sh`). **CK-LIB OP9-L2-c2 zelená**: testy 336 súborov / 4 942 testov
(po c1 4 936; +6), žiadny opakovaný prípad, 216 s; linty `test:eslint` 7 / 82,
`lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.
