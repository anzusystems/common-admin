# OP6-L1: druhé „Potvrdiť" počas ukladania obrázka, aktívna dlaždica zoznamu assetov a jeho čítania, mená autorov v zdroji obrázka, mŕtvy prop `onDetailLoadedCallback`; nálezy 162, 154 (so 166 a 164), 167, 165 (impl-lib-op6)

**Stav: po cykle c3, čaká na posudok.** Cielené testy a CK zelené po poslednej úprave `src` (CK-LIB OP6-L1-c3, 13. 10.).
Čísla riadkov v častiach FE-66 a FE-65, v obmedzeniach FE-64 a v nálezoch sú po cykle c3; časť „Testy a prečo vedia
zlyhať" opisuje prvý tvar kroku, časti „Cyklus c1" a „Cyklus c2" stav po svojom cykle; čo pribudlo potom, je v časti
„Cyklus c3".

Zadanie vedúceho (`overenie-nalezov.md`, „Siedme overenie", tabuľka „FE, knižnica (common-admin)", a „Ôsme overenie";
rozhodnutie vlastníka z 13. 10. „opravime vsetko"): FE-64 (162), FE-65 (154 so 166 a 164), FE-66 (167) a bod 165.
Strom LIB `/home/volar/projects/anzusystems/common-admin` (vetva `next`, commit `b97ddf31`), TMPDIR
`node_modules/.cache/vitest-tmp-impl-lib-op6`. Snímok **`OP6-L1`** (pred prvou úpravou, s `doc/changelog/2.0.0.md`),
záplata `krok5-praca/zaplaty/OP6-L1.diff` (14 súborov, 1 128 riadkov; mimo `src` a `doc` nič). Cyklus c1: snímok
`OP6-L1-c1`, záplata `zaplaty/OP6-L1-c1.diff` (7 súborov, 254 riadkov). Cyklus c2: snímok `OP6-L1-c2`, záplata
`zaplaty/OP6-L1-c2.diff` (5 súborov, 314 riadkov). Cyklus c3: snímok `OP6-L1-c3`, záplata `zaplaty/OP6-L1-c3.diff`
(2 súbory, 101 riadkov).

## Zmenené súbory

- `src/domains/dam/imageWidget/components/ImageWidgetInner.vue`,
  `src/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue` (FE-64, FE-66)
- `src/domains/dam/assetSelect/store/assetSelectStore.ts` (FE-65, bod 1)
- `src/domains/dam/assetSelect/composables/assetSelectListActions.ts` (FE-65, body 2 a 3; bod 165)
- `src/domains/dam/assetSelect/components/AAssetSelectMedia.vue` (FE-65, bod 2; bod 165)
- `src/domains/dam/assetSelect/components/AAssetSelect.vue`,
  `src/domains/dam/assetSelect/components/AAssetListInner.vue` (bod 165)
- `src/domains/dam/__tests__/support/consumerImageApi.ts` (pomôcka testov: `holdSaves`)
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetLibrary.test.ts`
- `src/domains/dam/imageWidget/__tests__/imageWidgetsDamAuthorsSave.test.ts`
- `src/domains/dam/assetSelect/__tests__/consumerProfileAssetListUpload.test.ts`
- `src/domains/dam/assetSelect/__tests__/assetSelectListActions.test.ts`
- `src/domains/dam/assetSelect/__tests__/assetSelectStoreActiveItem.test.ts` (**nový súbor**)
- `doc/changelog/2.0.0.md` (tri odrážky v „Image widgets and asset select, uploads and picks.", `:169-171`; doplnený
  riadok „Removed props", `:48`)

Žiadny súbor nezanikol. `src/lib.ts` je bez zmeny. Verejné API sa mení v jednom: prop `onDetailLoadedCallback`
vyvážaných `AAssetSelect` a `AAssetListInner` zanikol (bod 165). Sklad výberu, `useAssetSelectActions` ani
`AAssetSelectMedia` knižnica nevyváža. Žiadny nový ani zmenený text prekladu, žiadna zmena v admine.

## FE-64 (162): druhé „Potvrdiť" počas ukladania obrázka

**Čo sa mení v kóde.** Jeden riadok v obsluhe potvrdenia dialógu obrázka oboch widgetov, hneď za čakaním na čítanie
assetu z `OP5-L1` (`holdConfirmForDetailAssetRead`): `if (metadataDialogSaving.value) return`
(`ImageWidgetInner.vue:611-613`, `onMetadataDialogConfirm`; `ImageMediaWidgetInner.vue:754-756`, `tryImageConfirm`).
Príznak `metadataDialogSaving` zapína tá istá obsluha o riadok nižšie a vypína jej `finally`, teda po úspechu, po
zlyhaní aj po odmietnutom zápise autorov. Cesta médií (`tryMediaConfirm`, `ImageMediaWidgetInner.vue:729-746`) je bez
zmeny: API obrázkov nevolá a je celá synchrónna.

**Rozhodnutia.**
- Stráž je v obsluhe widgetu, nie vo formulári dialógu (`ImageDetailDialogMetadata.onConfirm`): hostiteľ, ktorý kreslí
  formulár vo vlastnom dialógu, potvrdzuje cez `metadataConfirm()` widgetu, a stráž musí platiť pre obe cesty.
- Poradie voči čakaniu z FE-54 je podľa zadania (stráž až za ním); navonok je to jedno, lebo čakanie počas bežiaceho
  uloženia druhé potvrdenie samo neberie (argument `saving`).

**Čo sa mení pre používateľa.** Oba adminy, `AImageWidget` a `AImageMediaWidget`: druhé „Potvrdiť" (dvojklik na
tlačidlo hostiteľa pri formulári kreslenom v stránke, Enter na točiacom sa tlačidle modálneho dialógu) počas ukladania
obrázka nespraví nič. Prvé uloženie dobehne ako doteraz. Po zlyhanom uložení (aj po odmietnutom zápise autorov)
„Potvrdiť" funguje znova.

**Na backend.** Ubudlo: druhé `POST /adm/v1/image` (alebo druhé volanie `createImage` aplikácie), druhé `PUT`, a pri
vybraných autoroch druhé čítanie mien a druhý `PATCH …/metadata-bulk-update`.

**Obmedzenia.**
- Dialóg zavretý krížikom počas uloženia a hneď znova otvorený („upraviť metadáta"): „Potvrdiť" v ňom sa neberie, kým
  prvé uloženie neodpovie (tlačidlo sa točí), a prvé uloženie po odpovedi zavrie dialóg, ktorý je práve otvorený (to
  robilo aj doteraz). Pred krokom by druhé potvrdenie poslalo druhé uloženie. Pozri nález 1.
- Stráž je na widget; dva widgety na stránke sa neovplyvňujú.
- Druhé stlačenie hostiteľa **po** dobehnutí prvého uloženia je nové potvrdenie (pri formulári v stránke úprava
  práve uloženého obrázka), ako doteraz. Hostitelia v tej chvíli svoje uloženie nestrážia, tlačidlo sa im len točí
  (`:loading`): stlačenie počas ukladania embedu spustí `metadataConfirm()` znova. Stráž knižnice kryje len okno
  uloženia obrázka; pozri nález 7.

## FE-66 (167): mená autorov sa stanú zdrojom obrázka až po prijatí autorov v DAM

**Čo sa mení v kóde.** V tej istej obsluhe oboch widgetov (`ImageWidgetInner.vue:619-642`,
`ImageMediaWidgetInner.vue:762-785`; znenie po cykle c2): pred čítaním mien, v tom istom kroku ako `authorsAsset`
(žiadne čakanie medzi nimi), sa bokom odloží `texts` obrázka, nad ktorým potvrdenie stlačili
(`const texts = detail.value.texts`, `:623`, `:766`). Po prečítaní mien, keď dialóg už neukazuje žiadny obrázok
(zavreli ho a neotvorili znova), potvrdenie tam skončí: `if (!isImageCreateUpdateAware(detail.value)) return`
(`:630-632`, `:773-775`; cyklus c2). Inak sa bokom odloží text zdroja (`const source = …`, `:633`, `:776`) a do
`texts.source` sa zapíše až po úspešnom `updateAssetAuthors`, tesne pred `offerNoDamAuthors()` (`:641`, `:784`).
Vetva zlyhania (hláška, `return`) je bez zmeny, len zdroj už nie je prepísaný.

**Rozhodnutia.**
- **Bokom ide aj `texts`, nielen text, a berie sa pri stlačení.** Zápis mien je neskôr než pred krokom (po odpovedi
  DAM) a dialóg môže medzitým ukazovať iný obrázok (zavretý a znova otvorený pre obrázok, ktorý widget má), počas
  zápisu autorov aj už počas čítania mien. Zápis do `detail.value` v tej chvíli by dal mená autorov cudzieho assetu
  do zdroja toho obrázka. Mená sa dostanú len do obrázka, nad ktorým potvrdenie stlačili; pripnuté dvoma prípadmi
  (podržané čítanie mien, podržaný `PATCH`). V prvom tvare kroku sa `texts` bralo až po čítaní mien (ako pred krokom
  zápis), a okno čítania mien ostalo; opravené v cykle c1.
- **Dialóg zavretý počas čítania mien potvrdenie ukončí** (cyklus c2). Pred krokom v tom bode zápis mien do obrázka,
  ktorý dialóg neukazoval, obsluhu potichu ukončil (chyba, ktorú `showErrorsDefault` nepozná): nič sa neposlalo.
  Mená odložené bokom tú chybu odstránili a po cykle c1 odišiel zápis autorov do assetu (`PATCH` s autormi
  a `described: true`) z dialógu, ktorý redaktor opustil. Podmienka je tá istá, pri ktorej obsluha končila pred
  krokom: dialóg neukazuje obrázok (je zavretý, alebo vo widgete obrázka a média ukazuje médium).
- Úspešná cesta: tie isté požiadavky v tom istom poradí (mená, `PATCH` autorov, uloženie obrázka) a tá istá uložená
  hodnota zdroja.

**Čo sa mení pre používateľa.** admin-cms, `AImageWidget` a `AImageMediaWidget`, asset vybraný bez autorov: keď DAM
zápis vybraných autorov odmietne (oprávnenie, validácia, chyba servera, sieť) a redaktor výber vymaže a potvrdí,
obrázok sa uloží so zdrojom, aký mal predtým (prázdny pri novo vybranom assete), nie s menami autorov, ktorých DAM
neprijal. Potvrdenie znova bez zmeny výberu pošle autorov znova a po prijatí uloží obrázok s ich menami. admin-ugc:
nič (autorov DAM nemá).

**Na backend.** Do CMS po odmietnutom zápise a vymazanom výbere ide obrázok so zdrojom, aký mal (prázdnym), namiesto
mien autorov. Inak tie isté požiadavky.

**Obmedzenia.**
- Keď DAM autorov prijme a uloženie obrázka potom zlyhá, zdroj obrázka už mená má a výber sa neponúka (dialóg ukáže
  „Zdroj" s menami); ako doteraz.
- Pri chybe siete nevedno, či DAM autorov zapísal; widget to berie ako odmietnutie (ako doteraz).
- Dialóg zavretý počas čítania mien a neotvorený znova: potvrdenie skončí bez zápisu autorov, bez požiadavky na
  obrázok a bez hlášky, príznak ukladania sa vypne; presne ako pred krokom (cyklus c2; po cykle c1 v tom okne zápis
  autorov odišiel).
- Dialóg zavretý počas čítania mien **a znova otvorený** pre obrázok (ten, ktorý widget má): potvrdenie pokračuje,
  autori sa zapíšu a uloží sa obrázok, ktorý dialóg ukazuje, so svojím zdrojom (mená ostanú pri `texts` zo
  stlačenia). Pred krokom v tom okne dostal mená ten znova otvorený obrázok. Že sa uloží bez stlačenia, je nález 1.
- Dialóg zavretý počas zápisu autorov ich nezastavil ani doteraz; po ich prijatí obsluha skončí potichu na tom, že
  nemá obrázok na uloženie (ako doteraz).

## FE-65 (154, 166, 164): aktívna dlaždica zoznamu assetov a čítania jeho bočného panela

**Čo sa mení v kóde.**
1. **Aktívna dlaždica ide za assetom** (`assetSelectStore.ts`). Sklad si popri indexe pamätá id assetu aktívnej
   dlaždice (`activeAssetId`, `:32-35`; mimo vráteného objektu skladu, ako `activeItemIndex`).
   - `setActiveByIndex` (`:120-130`) ho zapíše spolu s indexom (`:126`); skorý návrat pri rovnakom indexe ostal.
   - `setList` (`:70-80`): asset sa hľadá v nových riadkoch; nájdený riadok dostane príznak `active` a index sa
     nastaví naň, inak sa index vynuluje (id ostáva zapamätané).
   - `appendList` (`:82-94`): keď nie je aktívna žiadna dlaždica, zapamätaný asset sa hľadá v pridaných riadkoch;
     index je miesto v celom zozname (dĺžka pred pridaním + miesto v strane).
   - `reset` (`:222-234`): obe podoby (`true` aj `false`) vynulujú index aj id (doteraz index len `reset(true)`).
2. **Prepnutie typu sa vzdá čítania na ceste.** Nová akcia `giveUpDetailRead` (`assetSelectListActions.ts:197-201`):
   posunie počítadlo `detailRequest` a vypne `detailLoading`. Volá ju `reset()` akcií (to isté, čo robil od FE-58,
   `:203-210`) a `typeChange` výberu s médiami (`AAssetSelectMedia.vue:209-215`), medzi vyprázdnením zoznamu
   a vyprázdnením skladu detailu.
3. **Predbehnuté čítanie po zavretí detailu svoje zlyhanie nehlási** (`assetSelectListActions.ts:179`):
   `if (request === detailRequest) showErrorsDefault(e)`, tá istá podmienka ako pri zápise odpovede a pri vypnutí
   načítavania.
4. **Id sa zabudne, keď panel ten asset stratí** (cykly c1 až c3). Nová akcia skladu `forgetActiveAsset`
   (`assetSelectStore.ts:132-138`) a pomocník akcií `forgetAssetNotShown` (`assetSelectListActions.ts:53-63`): id
   sa zabudne, keď panel neukazuje žiadny asset, žiadna dlaždica nie je aktívna a žiadne čítanie pre panel nie je na
   ceste. Pomocníka sa pýta každé miesto, kde sa jedna z tých troch vecí môže stať pravdou: nový zoznam (`setList`,
   `:79-80`; cyklus c3), čítanie pre panel, keď skončí ako posledné vyžiadané (klik `:148-151`, čítanie po zavretí
   `:181-184`), a čítanie po zavretí detailu, ktoré nenájde aktívnu dlaždicu a nečíta nič (`:163-168`). Neskorší
   zoznam tak neoznačí dlaždicu assetu, ktorý panel neukazuje a už neukáže, v ktoromkoľvek poradí odpovedí. Prijatá
   medza zlyhaného čítania trvá, kým je dlaždica v zozname (označená vedľa panela, ktorý jej asset neukazuje, a
   nájdená znova v zozname, ktorý ten asset má); skončí zoznamom, ktorý ho nemá.

**Rozhodnutia.**
- **Pamätá sa id aktívnej dlaždice, nie asset panela** (spresnenie ôsmeho overenia): panel môže držať asset z detailu
  riadka fronty alebo asset, ktorého čítanie zlyhalo.
- **Id sa po zozname bez toho assetu nezabúda:** zadanie ho hľadá v ďalších stranách. Dôsledok: keď sa asset vráti
  v neskoršom zozname (ďalšie hľadanie, návrat na licenciu), jeho dlaždica je znova aktívna; panel ho celý čas
  ukazuje, takže značka a panel sú v zhode. **Zabudne sa, až keď panel ten asset stratí** (cyklus c1, bod 4):
  „Upraviť" a zavretie detailu nad zoznamom bez toho assetu. **Nie však, kým je čítanie pre panel na ceste** (cyklus
  c2): jeho odpoveď asset ešte môže ukázať; rozhodne sa, až keď to čítanie skončí.
- Obnovenie nejde cez `setActiveByIndex` (vracia sa pri rovnakom indexe); `setList` a `appendList` píšu príznak
  aj index samy.
- **`reset(false)` maže aj id:** po prepnutí typu je panel prázdny, takže po návrate na pôvodný typ nie je aktívna
  žiadna dlaždica.
- Stráž čítania ostáva na počítadle; zrušenie požiadavky zoznamu som nepridal (stráži iné čítanie).
- Bočný panel, ktorý ukazuje predošlý asset, keď ho nový zoznam nemá, som nechal (zadanie); pozri nález 3. Podľa
  zapamätaného id sa nečíta: „Upraviť" a zavretie detailu nad zoznamom bez toho assetu nechá panel prázdny ako
  doteraz.

**Čo sa mení pre používateľa.**
- admin-ugc, zoznam assetov (`AAssetListInner`), a výbery assetov oboch adminov (`AAssetSelect`,
  `AAssetSelectMedia`): po novom načítaní zoznamu (hľadanie, zoradenie, reset filtra, nahratie a „použiť") je
  dlaždica naposledy kliknutého assetu zvýraznená tam, kde teraz je, aj keď príde až s ďalšou stranou („načítať
  viac"). Keď ho nový zoznam nemá, nie je zvýraznená žiadna. Klik na ktorúkoľvek dlaždicu ju zvýrazní (doteraz
  nie na mieste, kde bola aktívna predošlá).
- admin-ugc, zoznam assetov: „Upraviť" v paneli a zavretie detailu po novom načítaní zoznamu prečíta asset do panela
  znova (doteraz „žiadny asset"), keď je jeho dlaždica v zozname.
- admin-cms, výber `AImageMediaWidget`: po kliku na dlaždicu a prepnutí typu (obrázok, video, podcast) panel hneď
  prestane načítavať a neukáže asset predošlého typu; zlyhanie toho čítania sa nehlási. Po prepnutí typu nie je
  zvýraznená žiadna dlaždica a prvý klik na ktorékoľvek miesto ju zvýrazní.
- admin-ugc, zoznam assetov: zlyhanie čítania po zavretí detailu sa neohlási, keď medzitým klik na inú dlaždicu
  vyžiadal iný asset, alebo keď zoznam zanikol (`reset()`); keď je to posledné čítanie, ohlási sa ako doteraz.

**Na backend.** Tie isté čítania; pribudne čítanie assetu po zavretí detailu tam, kde sa doteraz nečítalo (aktívna
dlaždica po novom zozname).

**Obmedzenia.**
- Aktívna dlaždica a asset panela sa môžu líšiť, keď čítanie kliku zlyhalo (dlaždica je zvýraznená, panel ukazuje
  predošlý asset alebo nič); ako doteraz.
- Tabuľkový pohľad zoznamu značku aktívneho riadku nemá (nález 177, mimo kroku); obnovenie tam nie je vidieť, čítanie
  po zavretí detailu funguje.
- Keď strany zoznamu vrátia ten istý asset dvakrát (posun offsetu), aktívny je jeho prvý riadok; druhý sa neoznačí.
- Zlyhanie čítania po zavretí detailu, ktorého sa zoznam vzdal `reset()`, sa už nehlási (v `OP5-L1` zapísané ako
  ponechané správanie; mení sa bodom 3).
- Značka vybratia (fajka) sa po novom zozname neobnovuje, hoci výber ostáva (staršie; nález 2).

## Bod 165: prop `onDetailLoadedCallback` zanikol

**Čo sa mení v kóde.** Prop je preč z `AAssetSelect.vue` (`:34-53`), `AAssetListInner.vue` (`:40-56`)
a `AAssetSelectMedia.vue` (`:33-53`), s ním import typu `AssetDetailItemDto` a poznámka pre eslint pri volaní akcií
(`useAssetSelectActions(damConfigName)`, `:81`, `:75`, `:82`). `useAssetSelectActions` knižnica nevyváža (`src/lib.ts`
ho nemenuje), preto zanikol aj nepovinný druhý argument composable a jeho volanie po odpovedi kliku
(`assetSelectListActions.ts:30`, pôvodne `:134`), s importom `isUndefined`.

**Hľadanie mena v repozitári** (`onDetailLoadedCallback`, `on-detail-loaded-callback`, `DetailLoaded`; bez
`node_modules`, `dist`, `.git`): po kroku ho menuje len `doc/changelog/2.0.0.md:48` a nesledované poznámky analýzy
(`doc/2.0.0-analyza/…`, nemenené). Sledovaná dokumentácia ho nemenovala, žiadny test ho neposielal.

**Čo sa mení pre používateľa.** Nič (prop sa nikdy nezavolal: dlaždice a riadky tabuľky čítajú kliknutý asset cez
vlastnú inštanciu akcií bez neho). Pre konzumenta API: aplikácia, ktorá by ho posielala, dostane chybu typov
(`vue-tsc`); za behu ho Vue vezme ako poslucháča udalosti, ktorú komponent neposiela. Šesť adminov ho neposiela
(ôsme overenie). Changelog: riadok „Removed props" v „Changed — migrating an admin".

## Testy a prečo vedia zlyhať

+43 prípadov v piatich súboroch (212 prípadov; pred krokom 169): `consumerProfileImageWidgetLibrary.test.ts` 132
(+23), `consumerProfileAssetListUpload.test.ts` 42 (+9), `imageWidgetsDamAuthorsSave.test.ts` 24 (+8),
`assetSelectListActions.test.ts` 12 (+1), `assetSelectStoreActiveItem.test.ts` 2 (nový). Skutočné komponenty, falošný
je len DAM a backend obrázkov; tvrdenia cez DOM a požiadavky (dva prípady skladu a jeden prípad akcií sú bez DOM,
pozri nižšie).

- **FE-64** (`consumerProfileImageWidgetLibrary.test.ts:2187-2326`, blok „whose "confirm" is pressed again while the
  image is being saved"; oba widgety, obe aplikácie; 4 prípady na widget a aplikáciu, v admin-cms +1):
  - nový obrázok / obrázok, ktorý widget má (`:2207`): uloženie je podržané, druhé stlačenie tlačidlom dialógu
    a volaním `metadataConfirm()` → jedno `createImage` / `updateImage`, jedna udalosť `afterMetadataSaveSuccess`,
    dialóg zavretý, bez chyby;
  - hostiteľ nad formulárom v stránke (`expandMetadata`, `:2234`): tri volania `metadataConfirm()` → jedno uloženie;
  - stráž (`:2259`): po zlyhanom uložení dialóg ostane, tlačidlo sa netočí a ďalšie stlačenie uloží (dve volania
    `createImage`, jedna udalosť);
  - admin-cms (`:2283`): s vybranými autormi je podržaný `PATCH` autorov; druhé stlačenie → jeden `PATCH`, jeden
    obrázok so zdrojom z mien.
- **FE-66** (`imageWidgetsDamAuthorsSave.test.ts:254-299`, admin-cms, oba widgety; 4 prípady na widget):
  - DAM zápis odmietne (403, 422, 500; `:258`): nič sa neuloží; po vymazaní výberu a potvrdení ide `createImage` so
    zdrojom `''` a ďalší `PATCH` nejde;
  - stráž (`:284`): po odmietnutí a novom potvrdení bez zmeny DAM autorov prijme → dva rovnaké `PATCH`, obrázok so
    zdrojom z mien;
  - úspešnú cestu (poradie požiadaviek a zdroj) držia nezmenené prípady `:185` a
    `consumerProfileImageWidgetLibrary.test.ts:699`.
  - `consumerProfileImageWidgetLibrary.test.ts:2307` (admin-cms, 1 na widget): dialóg zavretý počas zápisu autorov
    a otvorený pre obrázok, ktorý widget má → mená sa nedostanú do žiadneho uloženého obrázka ani do obrázka dialógu.
- **FE-65, bod 1** (`consumerProfileAssetListUpload.test.ts:790-944`, admin-ugc, skutočné dlaždice a dialóg detailu;
  7 prípadov): po zoradení / hľadaní je dlaždica assetu aktívna na novom mieste a panel ho ďalej ukazuje bez nového
  čítania (2); klik na dlaždicu na pôvodnom mieste ju zvýrazní a predošlú odznačí; „Upraviť" a zavretie detailu
  prečíta asset do panela; asset v novom zozname nie je → žiadna aktívna dlaždica, ďalší klik zvýrazní; asset príde
  až s ďalšou stranou → aktívny na mieste v celom zozname, ďalšia strana ho nechá, klik inde ho odznačí; stráž:
  ďalšia strana pod aktívnou dlaždicou nič nemení.
  `assetSelectStoreActiveItem.test.ts` (2, sklad bez DOM; poradia, ktoré robí server a časovanie, nie používateľ):
  strana, ktorá asset aktívnej dlaždice zopakuje, neoznačí druhý riadok; po `reset(false)` a strane pridanej do
  vyprázdneného zoznamu nie je aktívne nič a klik na to isté miesto označí.
- **FE-65, bod 2** (`consumerProfileImageWidgetLibrary.test.ts:443-568`, admin-cms, skutočný `AAssetSelectMedia` so
  skutočnou lištou a dlaždicami; 3 prípady): čítanie kliku je podržané, prepnutie na video → panel hneď nenačítava,
  po odpovedi neukáže asset, po návrate na obrázky nie je aktívna žiadna dlaždica; to čítanie zlyhá po prepnutí →
  žiadna hláška; stráž: klik po prepnutí asset ukáže a dlaždicu zvýrazní aj na mieste predošlej.
  `assetSelectListActions.test.ts:141` (1, akcie s falošným API): `giveUpDetailRead` sa vzdá čítania a vypne
  načítavanie.
- **FE-65, bod 3** (`consumerProfileAssetListUpload.test.ts:745-788`, 2): čítanie po zavretí zlyhá po kliku na inú
  dlaždicu → žiadna hláška, panel načítava ďalej a ukáže asset kliku; stráž: zlyhá ako posledné čítanie → jedna
  hláška, panel nenačítava.
- **Bod 165:** bez prípadu (odstránenie; drží ho `lint:tsc` a hľadanie mena).

**Upravené existujúce prípady:** žiadne. Pomocník `mountPicker` (`consumerProfileImageWidgetLibrary.test.ts:293`)
dostal nepovinný zoznam náhrad (predvolene doterajší) a `consumerImageApi.ts` akciu `holdSaves` (`:39-45`,
`:141-149`): uloženie jedného obrázka počká, kým ho test pustí ako uložené alebo zlyhané; bez `holdSaves` odpovedá
presne ako doteraz.

**Dôkaz** (v pamäti, `vitest.bend.config.mts` v TMPDIR, snímok `OP6-L1`; skripty `scratchpad/op6l1-bend.sh`,
`op6l1-bends.py`, výpisy `scratchpad/op6l1-old.log`, `op6l1-bend-*.log`). „Zlyhá" je počet prípadov v súboroch, nad
ktorými ohyb bežal (widgety: dva súbory, 156 prípadov; zoznam: štyri súbory, 188 prípadov).

Sedem produkčných súborov zo snímku (pred krokom) nad piatimi súbormi testov: **32 / 212**, všetko nové prípady.
Z 43 nových je červených 32; 11 nad snímkom prechádza, lebo pripínajú, čo sa nemá zmeniť: „Potvrdiť" po zlyhanom
uložení (4), prijatie autorov po odmietnutí (2), zdroj obrázka widgetu po zavretí a otvorení dialógu počas zápisu
autorov (2), ohlásené zlyhanie posledného čítania (1), ďalšia strana pod aktívnou dlaždicou (1), zopakovaný asset
v ďalšej strane (1).

| Ohyb | Zlyhá |
|---|---|
| FE-64: druhé potvrdenie sa vezme (widget obrázka / obrázka a média) | 7 / 156, 7 / 156 |
| FE-64: po zlyhanom uložení sa príznak nevypne (dva widgety) | 12 / 156, 12 / 156 |
| FE-66: mená do zdroja pred odpoveďou DAM (dva widgety) | 3 / 156, 3 / 156 |
| FE-66: mená sa do zdroja nezapíšu vôbec (dva widgety) | 12 / 156, 11 / 156 |
| FE-66: mená do obrázka, ktorý dialóg ukazuje po odpovedi (dva widgety) | 1 / 156, 1 / 156 |
| FE-66: po prijatí autorov sa výber ponúka ďalej (dva widgety) | 2 / 156, 2 / 156 |
| FE-65: nový zoznam neoznačí nič a index vynuluje | 3 / 188 |
| FE-65: index sa pri chýbajúcom assete nevynuluje | 2 / 188 |
| FE-65: príznak bez indexu | 1 / 188 |
| FE-65: index bez príznaku | 3 / 188 |
| FE-65: klik si asset nezapamätá | 4 / 188 |
| FE-65: pridané riadky sa neprehľadajú | 1 / 188 |
| FE-65: pridané riadky sa prehľadajú vždy | 1 / 188 |
| FE-65: index pridaného riadku je miesto v strane | 1 / 188 |
| FE-65: `reset` nechá index | 1 / 188 |
| FE-65: `reset` nechá id | 3 / 188 |
| FE-65: `reset(false)` nechá oboje | 2 / 188 |
| FE-65: prepnutie typu sa čítania nevzdá | 2 / 188 |
| FE-65: vzdanie sa neposunie počítadlo | 7 / 188 |
| FE-65: vzdanie sa nevypne načítavanie | 5 / 188 |
| FE-65: predbehnuté čítanie po zavretí zlyhanie hlási | 1 / 188 |
| FE-65: čítanie po zavretí zlyhanie nehlási nikdy | 1 / 188 |

Každý z 28 ohybov zhodil aspoň jeden prípad. Štyri ohyby pri prvom behu neprešli na červenú a doplnil som prípad
alebo tvrdenie (pridané riadky prehľadané vždy a `reset` nechá index: dva prípady skladu; index pridaného riadku:
klik inde na konci prípadu ďalšej strany; `reset(false)` nechá oboje: návrat na obrázky v prípade prepnutia typu).
Dva ohyby „po zlyhanom uložení sa príznak nevypne" boli napísané zle (príznak sa nevypol nikdy) a prepísal som ich.
Z prípadu FE-66 som po prvom behu vybral tvrdenie o zdroji v pamäti, aby ohyb padal na tvrdení o požiadavke.

**Behy.** Cielené: päť súborov / 212 zelených (`scratchpad/op6l1-run.sh`). `oxfmt`, `oxlint`, `eslint` na trinástich
súboroch, `stylelint` na piatich čisté, `lint:tsc` 0 (`scratchpad/op6l1-lint.sh`). **CK-LIB OP6-L1 zelená na prvý beh**
(`vysledky/OP6-L1-ck.log`): `test:browser` 317 súborov / 4 720 testov (po `OP5-L1-c2` 316 / 4 677; +1 súbor, +43),
`test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté; žiadny
opakovaný prípad, `test:browser` 166 s.

## Nad rámec znenia zadania

- FE-66: bokom sa drží aj `texts` obrázka, pre ktorý sa mená čítali (zadanie hovorí len o menách); pozri rozhodnutia.
- FE-65: akcia `giveUpDetailRead` composable (počítadlo je v module, komponent naň inak nedosiahne); `reset()` ju
  volá namiesto dvoch vlastných riadkov.
- FE-65: po prepnutí typu a návrate nie je aktívna žiadna dlaždica (dôsledok „`reset` oboch podôb maže id").
- Pomôcka testov `holdSaves` a nepovinný parameter `mountPicker`.
- Cyklus c2: zapamätaný asset sa zabudne aj vtedy, keď čítanie, ktoré ho držalo, skončí bez toho, aby asset ukázalo
  (zadanie c2-2 hovorí len o vetve zavretia); pozri „Cyklus c2", bod 2.

## Nové nálezy (nemenené)

1. **Uloženie dialógu obrázka pokračuje nad obrázkom, ktorý dialóg ukazuje až po odpovediach** (`ImageWidgetInner.vue:645`,
   `:649`; `ImageMediaWidgetInner.vue:788`, `:792`: `imageFieldsOf(detail.value)` a `metadataDialog.value = false` za
   čítaním mien a zápisom autorov). Dialóg sa počas uloženia dá zavrieť a „upraviť metadáta" otvoriť znova pre
   obrázok, ktorý widget má: po odpovedi DAM sa bez stlačenia uloží ten obrázok (nezmenený) a dialóg sa zavrie.
   Staršie; od cyklu c2 ho dvojica prípadov `consumerProfileImageWidgetLibrary.test.ts:2342-2377` pripína tak, ako
   dnes je (obrázok 7 sa uloží raz so svojím zdrojom a dialóg sa zavrie). S FE-64 sa v tom okne neberie ani potvrdenie
   znova otvoreného dialógu. Oprava: potvrdenie patrí obrázku, pri ktorom ho stlačili (ako čakanie v FE-54). Vo
   widgete obrázka a média to isté okno počas zápisu autorov pri dialógu znova otvorenom pre **médium** pošle
   `createImage` s prázdnymi poľami (`imageFieldsOf` média; z čítania kódu, staršie); počas čítania mien to cyklus
   c2 zastaví, ako pred krokom.
2. **Značka vybratia sa po novom zozname stratí, výber ostane** (`assetSelectStore.ts:75`, `:88`: `selected: false`;
   `:96-118`). Vo výbere po hľadaní alebo zoradení dlaždica vybraného assetu nemá fajku, počítadlo ho ráta; klik na
   ňu ho „vyberie" znova namiesto odobratia, a pri dosiahnutom maxime (`:99`) sa odobrať nedá vôbec. Staršie; z čítania
   kódu. Po tomto kroku je taká dlaždica zvýraznená ako aktívna, ale bez fajky.
3. **Panel ukazuje asset, ktorý v novom zozname nie je, a „Upraviť" so zavretím detailu ho vyprázdni**
   (`assetSelectListActions.ts:162-168`: čítanie po zavretí ide podľa aktívnej dlaždice; `AAssetListInner.vue:339-344`).
   Po hľadaní, ktoré asset nevráti, panel ukazuje jeho metadáta s tlačidlom „Upraviť" bez zvýraznenej dlaždice; po
   „Upraviť" a zavretí je „žiadny asset". Ponechané podľa zadania (nález z ôsmeho overenia, „Adjacent finding"). Od
   cyklu c1 sa pri tom zabudne aj zapamätaný asset: neskorší zoznam vedľa prázdneho panela neoznačí nič.
4. **Zoradenie a prepnutie typu nevracajú stránkovanie na prvú stranu** (`AAssetListInner.vue:161-167`,
   `AAssetSelect.vue:211-217`, `AAssetSelectMedia.vue:209-223`; `fetchNextPage` nechá `page` zvýšené,
   `assetSelectListActions.ts:88-91`; hľadanie a reset filtra ho vracajú, `:193`, `filterFactory.ts:455`). Po „načítať
   viac" a zmene zoradenia alebo typu sa zoznam vyžiada od tej strany, na ktorej bol: prvé riadky nového zoznamu
   chýbajú. Staršie; z čítania kódu, behom neoverené.
5. **Strana vyžiadaná pred prepnutím typu sa môže pridať do vyprázdneného zoznamu** (`assetSelectListActions.ts:65-67`,
   `:73`, `:95`: požiadavku ďalšej strany ruší až nové čítanie zoznamu, ktoré čaká na debounce;
   `AAssetSelectMedia.vue:209-215`). Na okamih sú v zozname riadky predošlého typu. Staršie; z čítania kódu.
6. **Zlyhané načítanie konfigurácie formulárov nechá bočný panel točiť bez konca** (`AAssetListInner.vue:214-224`,
   `AAssetSelect.vue:223-233`, `AAssetSelectMedia.vue:229-239`: vetva `catch` príznak `customFormConfigLoading`
   nevypne). Staršie; z čítania kódu.
7. **Hostitelia dialógu obrázka v texte článku svoje uloženie pred druhým stlačením nestrážia** (mimo knižnice;
   admin-ugc `src/domains/anzutap/nodes/embedImage/components/EmbedImageDialog.vue:69-105`, tlačidlo `:147-153`;
   admin-cms `…/embedImage/components/EmbedImageDialog.vue:78-80`, `:200-205`, a
   `…/embedImage/composables/EmbedImageDialogActions.ts:31-33`). Tlačidlo má len `:loading`, ktoré klávesnicu
   nezastaví, a obsluha sa na bežiace uloženie nepozerá. Stlačenie po tom, čo widget obrázok uložil a hostiteľ
   ukladá embed, spustí `metadataConfirm()` znova: formulár v stránke už drží uložený obrázok, widget ho uloží
   ešte raz (`PUT`), pošle `afterMetadataSaveSuccess` a hostiteľ uloží embed druhý raz (pri novom embede druhé
   vytvorenie a druhé vloženie do textu). FE-64 kryje len okno uloženia obrázka vo widgete. Z čítania kódu adminov
   (cyklus c1, posudok); oprava patrí hostiteľom (obsluha sa má vrátiť, kým ich uloženie beží).

Mimo kroku ostávajú podľa zadania: 160, 161, 163 (prijaté), 177, 178, 179, 184.

## Cyklus c1 (OP6-L1-c1, 13. 10.; dva posudky bez blokujúceho nálezu, dva body v kóde a jeden v poznámke)

Snímok `OP6-L1-c1`, záplata `zaplaty/OP6-L1-c1.diff` (7 súborov, 254 riadkov; mimo `src` a `doc` nič). Zmenené:
`assetSelectStore.ts`, `assetSelectListActions.ts` (c1-1), `ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue` (c1-2),
`consumerProfileAssetListUpload.test.ts`, `consumerProfileImageWidgetLibrary.test.ts`, `doc/changelog/2.0.0.md`.

1. **c1-1: zapamätaný asset prežil asset bočného panela** (FE-65, viditeľné, nové s krokom). Cesta: klik na dlaždicu
   A; hľadanie, ktoré A nevráti (panel ukazuje A ďalej, žiadna dlaždica nie je aktívna, id A ostáva); „Upraviť"
   v paneli a zavretie detailu: detail panel vyprázdni (`AssetDetailDialog.vue:46`) a nič sa nečíta, lebo nie je
   aktívna dlaždica; potom reset filtra alebo strana, ktorá A má: dlaždica A bola označená vedľa „žiadny asset".
   - **Oprava:** `readActiveItemAgain` v tej vetve zavolá `forgetActiveAsset` skladu
     (`assetSelectListActions.ts:146-151`, `assetSelectStore.ts:132-138`; akcia vynuluje len id, index je v tej vetve
     prázdny). Nečíta sa podľa id: panel ostane prázdny ako doteraz.
   - **Pre používateľa:** admin-ugc, zoznam assetov: po tej ceste neskorší zoznam ani ďalšia strana neoznačí nič;
     klik na dlaždicu ju označí a asset prečíta ako vždy. Bez „Upraviť" a zavretia sa dlaždica A po návrate do
     zoznamu označí ďalej (panel A ukazuje celý čas), a pri aktívnej dlaždici sa po zavretí číta ako doteraz.
     **Na backend:** nič.
   - **Iné cesty, ktoré panel vyprázdnia, kým id ostáva** (prešiel som všetky zápisy do `asset` skladu detailu):
     - `close()` skladu má troch volajúcich: tlačidlo detailu (`AssetDetailDialog.vue:46`), sklad sám po zlyhanom
       čítaní otvorenia (`assetDetailStore.ts:61`) a zánik dialógu (`AssetDetailDialog.vue:64`). Prvé dva povedia
       hostiteľovi `close`, zoznam na to volá `readActiveItemAgain`, teda oba idú tou istou vetvou (aj detail riadka
       fronty, ktorý sa zavrel sám): **pokryté**. Tretí hostiteľovi nepovie nič: nastane pri zániku zoznamu (`reset()`
       id maže) alebo keď zoznam prestane dialóg kresliť bez vlastného zániku (zmizne `extId`; cez rozhranie
       nedosiahnuteľné, medza z `OP5-L1`): **nepokryté, nedosiahnuteľné**.
     - `reset()` skladu detailu volá len `reset()` akcií (`assetSelectListActions.ts:189`) a `typeChange`
       (`AAssetSelectMedia.vue:213`); oba id mažú.
     - `open()` vyprázdni asset na začiatku (`assetDetailStore.ts:51`). Pod kľúčom zoznamu (detail riadka fronty,
       `UploadQueueDialog.vue:204`) sa potom zavrie cez `close()`, pokryté. Pod kľúčom **iného hostiteľa na tej istej
       stránke** („upraviť asset" widgetu obrázka: `ImageWidgetInner.vue:581`, `ImageMediaWidgetInner.vue:706`,
       `ImageWidgetMultipleInner.vue:447`) by zoznamu vyprázdnil panel a zoznam by sa to nedozvedel. To isté
       `assetDetailStore.setAsset(null)` pri zastavení uploadu v dialógu jedného súboru widgetov
       (`UploadQueueDialogSingle.vue:88`). **Nepokryté:** potrebuje stránku so zoznamom assetov aj widgetom obrázka;
       stránka zoznamu admin-ugc widget nemá a výber assetov je modálny a pri zavretí sa celý vyprázdni. Na takej
       stránke by dlaždica ostala označená vedľa prázdneho panela aj pred krokom (sklad detailu je jeden pre
       stránku); krok to predlžuje cez nové načítanie zoznamu.
     - Čítanie po zavretí pri **aktívnej** dlaždici, ktoré zlyhá alebo sa ho zoznam vzdá: panel ostane prázdny vedľa
       označenej dlaždice, ako pred krokom; po kroku tá značka prežije aj nové načítanie zoznamu (pred krokom ju
       nový zoznam zmazal). **Nemenené:** klik na tú dlaždicu asset prečíta. Rovnako zlyhané čítanie kliku (dlaždica
       označená, panel ukazuje predošlý asset; prijatá medza kroku).
     - **(cyklus c2, oba posudky c1)** Opačná chyba tej istej vetvy: zavretie detailu bez aktívnej dlaždice id
       zabudlo, hoci čítanie kliku bolo ešte na ceste. Cesta: klik na dlaždicu A, jej čítanie visí; hľadanie, ktoré
       A nevráti; upload, detail jeho riadka fronty otvorený a zavretý (`UploadQueueDialog.vue:204`); odpoveď kliku
       potom asset A do panela zapíše, a neskorší zoznam s A jeho dlaždicu neoznačil. Opravené, pozri „Cyklus c2".
2. **c1-2: `texts` sa berie pred čítaním mien** (FE-66, posudok). `const texts = detail.value.texts` je pred
   `fetchAuthorListByIds` (`ImageWidgetInner.vue:623`, `ImageMediaWidgetInner.vue:766`), v tom istom synchrónnom kroku
   ako `authorsAsset` (`:616`, `:759`; nedal som ho na susedný riadok, ale pod podmienku vybraných autorov, kde je
   s komentárom a čítaním mien pokope). V prvom tvare sa bral až po čítaní mien: dialóg zavretý a znova otvorený pre
   obrázok widgetu, kým bolo čítanie mien na ceste, dostal mená autorov cudzieho assetu do svojho zdroja a uložil sa
   s nimi. **Pre používateľa:** v tom okne sa obrázok widgetu uloží so svojím zdrojom (že sa uloží bez stlačenia, je
   nález 1, nemenené). Dôsledok cyklu c1: dialóg zavretý počas čítania mien zápis autorov do assetu nezastavil (v tom
   okne navyše `PATCH` autorov, zmena na backende, o ktorej nikto nerozhodol). **Opravené v cykle c2** (c2-1): zavretý
   a znova neotvorený dialóg potvrdenie ukončí ako pred krokom; pokračuje len potvrdenie, ktorého dialóg je po čítaní
   mien znova otvorený pre obrázok.
3. **c1-3: poznámka a changelog** (posudok). Veta o vlastnom príznaku hostiteľov v obmedzeniach FE-64 neplatila;
   opravená, hostitelia sú nález 7. Odrážka FE-64 v changelogu (`doc/changelog/2.0.0.md:169`) hovorila len o okne
   uloženia obrázka, no vymenovaním následkov dvojkliku mohla sľubovať viac: pribudla veta, že widget po
   `afterMetadataSaveSuccess` berie potvrdenie znova, takže druhé stlačenie počas vlastného uloženia hostiteľa
   widget nezastaví a hostiteľ si ho musí strážiť sám (embed dialógy oboch adminov to dnes nerobia, nález 7;
   znenie vety spresnil vedúci po posudku c1). K c1-1 pribudla v odrážke FE-65 (`:171`) zátvorka o „Upraviť" a zavretí nad zoznamom bez assetu.

Neprijaté posudkami vedúceho, bez zmeny: `typeChange` sa vzdá čítania aj inej inštancie akcií (počítadlo a sklady sú
jedny pre stránku, `reset()` to robí od `OP5-L1`); changelog menuje len dva vyvážané komponenty.

**Testy** (+6; 218 prípadov v piatich súboroch):
- c1-1 (`consumerProfileAssetListUpload.test.ts:945-1010`, admin-ugc, +4): „Upraviť" a zavretie detailu nad zoznamom
  bez assetu → panel prázdny, žiadne čítanie; neskorší zoznam / ďalšia strana, ktorá asset vráti → žiadna aktívna
  dlaždica, panel prázdny, žiadne čítanie; klik ju označí (`:976`, dva prípady). Stráže: bez „Upraviť" a zavretia je
  dlaždica po návrate assetu aktívna a panel ho ukazuje (`:946`); aktívna dlaždica po „Upraviť", zavretí a čítaní
  ostáva aktívna aj v zozname načítanom potom (`:958`).
- c1-2 (`consumerProfileImageWidgetLibrary.test.ts:2304-2336`, admin-cms, +1 na widget): prípad zo záplaty kroku
  („leaves the source of the image the widget has alone…") je teraz dvojica: podržané čítanie mien (nový) a podržaný
  `PATCH` (pôvodný; tvrdenia bez zmeny, pribudlo čakanie na dopytované mená pred podržaním a čakanie na `PATCH`).

**Dôkaz** (v pamäti; `scratchpad/op6l1c1-old.sh`, `op6l1-bend.sh`, výpisy `op6l1c1-old.log`, `op6l1-bend-c1-*.log`).
Štyri produkčné súbory zo snímku `OP6-L1-c1` nad piatimi súbormi testov: **4 / 218** (c1-1 dva, c1-2 jeden na
widget). Dva nové prípady nad snímkom prechádzajú: obe stráže c1-1.

| Ohyb | Zlyhá |
|---|---|
| c1-1: zavretie bez aktívnej dlaždice id nezabudne | 2 / 194 |
| c1-1: `forgetActiveAsset` nezabudne nič | 2 / 194 |
| c1-1: id sa zabudne pri každom zavretí detailu | 1 / 194 |
| c1-1: id sa zabudne už pri zozname bez toho assetu | 2 / 194 |
| c1-2: `texts` až po čítaní mien (dva widgety) | 1 / 158, 1 / 158 |
| FE-66: mená do zdroja pred odpoveďou DAM (ohyb kroku nad zmenenými riadkami, dva widgety) | 3 / 158, 3 / 158 |
| FE-66: mená do obrázka, ktorý dialóg ukazuje po odpovedi (ohyb kroku, dva widgety) | 2 / 158, 2 / 158 |

Ostatné ohyby kroku platia bez zmeny (ich texty sa v kóde nezmenili). Ohyb „číta sa podľa zapamätaného id" som
nenapísal (id sklad nevracia); že sa nečíta, drží tvrdenie o počte čítaní assetu v prípadoch c1-1.

**Behy.** Cielené: päť súborov / 218 zelených. `oxfmt`, `oxlint`, `eslint`, `stylelint` čisté, `lint:tsc` 0 (v CK).
**CK-LIB OP6-L1-c1 zelená na prvý beh** (`vysledky/OP6-L1-c1-ck.log`): `test:browser` 317 súborov / 4 726 testov (po
`OP6-L1` 4 720, +6), `test:eslint` 7 / 82, ostatné čisté; žiadny opakovaný prípad, `test:browser` 159 s.

## Cyklus c2 (OP6-L1-c2, 13. 10.; úzke posudky cyklu c1 bez blokujúceho nálezu, tri body)

Snímok `OP6-L1-c2`, záplata `zaplaty/OP6-L1-c2.diff` (5 súborov, 314 riadkov; mimo `src` a `doc` nič). Zmenené:
`ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue` (c2-1), `assetSelectListActions.ts` (c2-2),
`consumerProfileImageWidgetLibrary.test.ts` (c2-1, c2-3), `consumerProfileAssetListUpload.test.ts` (c2-2). Changelog
sa nemenil (veta FE-64 po úprave vedúceho ostáva; c2-1 vracia správanie spred kroku, c2-2 cestu, ktorú odrážka FE-65
neopisuje).

1. **c2-1: dialóg zavretý počas čítania mien potvrdenie ukončí** (FE-66; zmena na backende z cyklu c1, o ktorej nikto
   nerozhodol). Za čítaním mien pribudol riadok `if (!isImageCreateUpdateAware(detail.value)) return`
   (`ImageWidgetInner.vue:630-632`, `ImageMediaWidgetInner.vue:773-775`): žiadny zápis autorov, žiadna požiadavka na
   obrázok, žiadna hláška, príznak ukladania vypne `finally`. Je to tá istá podmienka, pri ktorej obsluha pred krokom
   končila na chybe (zápis mien do `detail.value.texts`, keď dialóg obrázok neukazoval). Dialóg zavretý **a znova
   otvorený** pre obrázok pokračuje ako v c1.
   - **Pre používateľa:** admin-cms, oba widgety: „Potvrdiť" s vybranými autormi a zavretie dialógu krížikom skôr,
     než sa prečítajú mená: autori sa do assetu nezapíšu a nič sa neuloží (ako pred krokom). **Na backend:** `PATCH`
     autorov, ktorý v tom okne pridal cyklus c1, je preč.
   - Vo widgete obrázka a média tá istá podmienka ukončí aj potvrdenie, ktorého dialóg po čítaní mien ukazuje
     médium (ako pred krokom); prípad naň nemám (dialóg média vo widgete s vybraným obrázkom bez autorov), z čítania
     kódu.
2. **c2-2: id ostáva, kým je čítanie pre panel na ceste** (FE-65, oba posudky c1). Vetva bez aktívnej dlaždice
   v `readActiveItemAgain` volá pomocníka `forgetAssetNotShown` (`assetSelectListActions.ts:104-113`, `:161-166`):
   zabudne id, len keď nič nenačítava (`detailLoading`), panel neukazuje asset a žiadna dlaždica nie je aktívna.
   - **Nad znenie bodu:** ten istý pomocník volá aj koniec čítania, ktoré bolo vyžiadané ako posledné (klik
     `:146-149`, čítanie po zavretí `:179-182`). Bez toho by „id ostáva, kým sa číta" znamenalo „ostáva navždy", keď
     to čítanie asset neukáže: zlyhá, alebo je to čítanie po skoršom zavretí, ktorého odpoveď sklad detailu nevezme,
     lebo sa medzitým otvoril detail (`readBesideDetail`, počítadlo `turn`). V oboch prípadoch by neskorší zoznam
     označil dlaždicu vedľa prázdneho panela, teda chyba c1-1 inou cestou. Po úspešnom čítaní pomocník nerobí nič
     (panel asset ukazuje); pri aktívnej dlaždici tiež nie (prijatá medza: značka je dlaždica kliknutá naposledy).
   - **Pre používateľa:** admin-ugc, zoznam assetov, cesta z bodu: po odpovedi kliku panel ukáže A a neskorší zoznam
     s A jeho dlaždicu označí. Keď to čítanie zlyhá (hláška ako doteraz) alebo sa nevezme, panel ostane prázdny
     a neskorší zoznam neoznačí nič. **Na backend:** nič.
3. **c2-3: dvojica „leaves the source of the image the widget has alone…" tvrdí aj to, čo sa stať muselo**
   (`consumerProfileImageWidgetLibrary.test.ts:2342-2377`): počká na `afterMetadataSaveSuccess` a tvrdí jedno
   `updateImage` obrázka 7 s jeho popisom, zdrojom a súborom a zavretý dialóg. Pripína, čo obsluha robí dnes
   (nález 1), nie čo by mala.

**Testy** (+6; 224 prípadov v piatich súboroch):
- c2-1 (`consumerProfileImageWidgetLibrary.test.ts:2313-2340`, admin-cms, +1 na widget): čítanie mien podržané,
  dialóg zavretý, čítanie pustené → žiadny `PATCH`, žiadny obrázok, žiadna udalosť, žiadna hláška; po „upraviť
  metadáta" sa tlačidlo netočí a potvrdenie uloží obrázok widgetu (jedno `updateImage`, žiadny `PATCH`).
- c2-2 (`consumerProfileAssetListUpload.test.ts:1012-1117`, admin-ugc, +4; zoznam na stránke s vlastným vstupom
  uploadu, skutočný dialóg fronty a detail): klik podržaný, zoznam bez assetu, upload, detail riadka fronty otvorený
  a zavretý; potom odpoveď kliku → panel ukáže asset a neskorší zoznam jeho dlaždicu označí (`:1053`, cesta z bodu),
  alebo zlyhanie → panel prázdny, neskorší zoznam neoznačí nič, jedna hláška; to isté s čítaním po skoršom zavretí,
  ktorého odpoveď sa nevezme (`:1075`); stráž prijatej medze: dlaždica, ktorej čítanie kliku zlyhalo, ostáva označená
  aj v neskoršom zozname (`:1102`). Pomocník `mountWithTwoAssets` dostal nepovinné sloty stránky (`:514`).
- c2-3: bez nového prípadu, silnejšie tvrdenia dvojice (2 na widget).

**Dôkaz** (v pamäti; `scratchpad/op6l1c2-old.sh`, `op6l1-bend.sh`, výpisy `op6l1c2-old.log`, `op6l1-bend-c2-*.log`).
Tri produkčné súbory zo snímku `OP6-L1-c2` nad piatimi súbormi testov: **3 / 224** (c2-1 jeden na widget, c2-2 cesta
z bodu). Tri nové prípady nad snímkom prechádzajú: zlyhané čítanie kliku a nevzaté čítanie po zavretí (kód c1 id
zabudol už pri zavretí, výsledok je rovnaký) a stráž prijatej medze. Silnejšie tvrdenia c2-3 nad snímkom prechádzajú
(pripínajú, čo je).

| Ohyb | Zlyhá |
|---|---|
| c2-1: zavretý dialóg potvrdenie neukončí (dva widgety) | 1 / 160, 1 / 160 |
| c2-1: potvrdenie ukončí aj dialóg otvorený pre iný obrázok (dva widgety) | 1 / 160, 1 / 160 |
| c2-2: id sa zabudne aj počas čítania na ceste | 1 / 200 |
| c2-2: id sa zabudne aj vedľa assetu, ktorý panel ukazuje | 1 / 200 |
| c2-2: id sa zabudne aj pri aktívnej dlaždici | 1 / 200 |
| c2-2: koniec čítania kliku id nezabudne | 1 / 200 |
| c2-2: koniec čítania po zavretí id nezabudne | 1 / 200 |
| c1-1: zavretie bez aktívnej dlaždice id nezabudne (ohyb cyklu c1 nad zmenenými riadkami) | 2 / 200 |
| c1-1: id sa zabudne pri každom zavretí detailu (ohyb cyklu c1) | 2 / 200 |
| c1-1: `forgetActiveAsset` nezabudne nič (ohyb cyklu c1) | 4 / 200 |

Druhý ohyb c2-1 padá na tvrdeniach c2-3 (bez nich by dvojica prešla aj vtedy, keby uloženie po zápise autorov
nepokračovalo). Ostatné ohyby kroku a cyklu c1 platia bez zmeny (ich texty sa v kóde nezmenili).

**Behy.** Cielené: päť súborov / 224 zelených. `oxfmt`, `oxlint`, `eslint`, `stylelint` čisté, `lint:tsc` 0 (v CK).
**CK-LIB OP6-L1-c2 zelená na prvý beh** (`vysledky/OP6-L1-c2-ck.log`): `test:browser` 317 súborov / 4 732 testov (po
`OP6-L1-c1` 4 726, +6), `test:eslint` 7 / 82, ostatné čisté; žiadny opakovaný prípad, `test:browser` 159 s.

## Cyklus c3 (OP6-L1-c3, 13. 10.; úzke posudky cyklu c2 bez nálezu na opravu, jeden zvyšok závislý od poradia)

Snímok `OP6-L1-c3`, záplata `zaplaty/OP6-L1-c3.diff` (2 súbory, 101 riadkov; mimo `src` a `doc` nič). Zmenené:
`assetSelectListActions.ts`, `consumerProfileAssetListUpload.test.ts`. Changelog sa nemenil.

1. **c3-1: pomocníka sa pýta aj nový zoznam** (FE-65). `fetchAssetList` po `setList` zavolá `forgetAssetNotShown`
   (`assetSelectListActions.ts:79-80`); pomocník sa preto presunul pred čítanie zoznamu (`:53-63`, text bez zmeny,
   komentár menuje tri miesta, kde sa ho pýta). Doteraz výsledok závisel od poradia dvoch odpovedí:
   - poradie 1 (prípad cyklu c2 „fails"): klik na A; príde zoznam bez A; čítanie potom zlyhá → id zabudnuté, neskorší
     zoznam s A neoznačí nič;
   - poradie 2: klik na A; čítanie zlyhá, kým je A v zozname (id ostáva, dlaždica označená: prijatá medza); príde
     zoznam bez A a pomocníka sa nikto nespýtal, hoci panel je prázdny, žiadna dlaždica nie je aktívna a nič sa
     nenačítava; neskorší zoznam s A jeho dlaždicu označil vedľa „žiadny asset". To isté pri zlyhanom čítaní po
     zavretí detailu.
   Po cykle končia obe poradia rovnako: neoznačí sa nič.
   - **Proti pripnutým prípadom:** prípad medze (`consumerProfileAssetListUpload.test.ts:1102`) má dlaždicu
     v neskoršom zozname: `setList` ju označí skôr, než sa pomocníka pýta, a pomocník pri aktívnej dlaždici nerobí
     nič. Stráž c1 (`:946`) má asset v paneli: pomocník nerobí nič. Cesta c2-2 (`:1053`, „answers") má pri zozname
     bez A čítanie kliku na ceste: pomocník nerobí nič a rozhodne koniec čítania. Všetky tri ostali zelené bez zmeny.
   - **`appendList` (ďalšia strana) pomocníka nepotrebuje.** Strana riadky len pridáva: aktívnu dlaždicu môže
     pridať, nie ubrať, panel nevyprázdni a žiadne čítanie neukončí, teda žiadnu z troch podmienok nesplní.
     Podmienky sa stávajú pravdou len na miestach, kde sa pomocníka pýta (nový zoznam, koniec posledného čítania,
     zavretie detailu bez čítania), alebo tam, kde sa id maže celé (`reset` oboch podôb). Ak teda pri pridaní strany
     id je a žiadna dlaždica nie je aktívna, panel asset ukazuje alebo sa číta, a označiť dlaždicu, ktorú strana
     prinesie, je správne (prípad `:916`).
   - Nepokryté ostáva, čo bolo: panel vyprázdnený iným hostiteľom na tej istej stránke (cyklus c1, „Iné cesty").
   - **Pre používateľa:** admin-ugc, zoznam assetov: po zlyhanom čítaní assetu A a hľadaní, ktoré A nevráti,
     neskorší zoznam s A jeho dlaždicu neoznačí (panel je prázdny); klik ju označí a asset prečíta. **Na backend:**
     nič.

**Testy** (+2; 226 prípadov v piatich súboroch; `consumerProfileAssetListUpload.test.ts:1119-1158`, admin-ugc):
poradie 2 pre čítanie kliku a pre čítanie po zavretí detailu: zlyhanie (jedna hláška, dlaždica označená, panel
prázdny), zoznam bez assetu, zoznam s assetom → žiadna aktívna dlaždica, panel prázdny, žiadna ďalšia hláška.

**Dôkaz** (v pamäti; `scratchpad/op6l1c3-old.sh`, `op6l1-bend.sh`, výpisy `op6l1c3-old.log`, `op6l1-bend-c3-*.log`).
Jeden produkčný súbor zo snímku `OP6-L1-c3` nad piatimi súbormi testov: **2 / 226** (oba nové prípady).

| Ohyb | Zlyhá |
|---|---|
| c3-1: nový zoznam sa pomocníka nepýta | 2 / 202 |
| c2-2: id sa zabudne aj pri aktívnej dlaždici (ohyb cyklu c2 nad presunutým pomocníkom) | 1 / 202 |
| c2-2: koniec čítania kliku id nezabudne (ohyb cyklu c2) | 1 / 202 |
| c2-2: koniec čítania po zavretí id nezabudne (ohyb cyklu c2) | 1 / 202 |

**Behy.** Cielené: päť súborov / 226 zelených. `oxfmt`, `oxlint`, `eslint`, `stylelint` čisté, `lint:tsc` 0 (v CK).
**CK-LIB OP6-L1-c3 zelená na prvý beh** (`vysledky/OP6-L1-c3-ck.log`): `test:browser` 317 súborov / 4 734 testov (po
`OP6-L1-c2` 4 732, +2), `test:eslint` 7 / 82, ostatné čisté; žiadny opakovaný prípad, `test:browser` 165 s.
