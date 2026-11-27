# OP4-L1: detail assetu po zlyhanom čítaní a pri oneskorenej odpovedi, duplikát z fronty v galérii, farby dropzóny; nálezy 132, 135, 133, 134 (impl-lib-op4)

**Stav: po cykle 1, čaká na posudok.** Cielené testy a CK zelené po poslednej úprave `src` (CK-LIB OP4-L1-c1, 12. 10.).

Zadanie vedúceho (`overenie-nalezov.md`, „Piate overenie", tabuľka „FE, knižnica"): FE-38 (132), FE-39 (135),
FE-40 (133), FE-41 (134). Strom LIB `/home/volar/projects/anzusystems/common-admin`, TMPDIR
`node_modules/.cache/vitest-tmp-impl-lib-op4`. Snímok **`OP4-L1`** (pred prvou úpravou, s `doc/changelog/2.0.0.md`),
záplata `krok5-praca/zaplaty/OP4-L1.diff` (11 súborov; mimo `src` a `doc` nič).

## Zmenené súbory

- `src/domains/dam/assetDetail/store/assetDetailStore.ts` (FE-38, FE-39: akcie `open` a `close`)
- `src/domains/dam/assetDetail/components/AssetDetailDialog.vue` (FE-38, FE-39)
- `src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue` (FE-38, FE-39, FE-40)
- `src/domains/dam/imageWidget/components/ImageWidgetInner.vue`,
  `src/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue`,
  `src/domains/dam/uploadQueue/components/UploadQueueDialog.vue` (FE-38, FE-39)
- `src/domains/ui/file/components/AFileDropzone.vue` (FE-41, len štýly)
- `src/domains/dam/assetSelect/components/AAssetListInner.vue` (od cyklu 1)
- `src/domains/dam/assetDetail/__tests__/consumerProfileAssetDetailOpen.test.ts` (nový súbor)
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetMultipleUpload.test.ts`
- `src/domains/ui/file/__tests__/AFileDropzone.test.ts`
- `src/domains/dam/assetSelect/__tests__/consumerProfileAssetListUpload.test.ts` (od cyklu 1)
- `doc/changelog/2.0.0.md` (jedna odrážka v „Upload queue and its dialogs.", tri v „Image widgets and asset select,
  uploads and picks.")

Žiadny súbor nezanikol. Sklad detailu ani `AssetDetailDialog` knižnica nevyváža (`src/lib.ts`, bez zmeny); žiadny
prop, emit ani export knižnice sa nezmenil (udalosť `close` dialógu má rovnaký tvar, pribudol prípad, keď ju pošle).

## FE-38 (132) a FE-39 (135): otvorenie detailu jednou akciou skladu

Znenie po cykle 1 (kedy dialóg posiela `close`, čítanie bočného panela zoznamu assetov); pozri „Cyklus 1".

**Čo sa mení v kóde.**
- `assetDetailStore.ts:45-64` (čísla po cykle 1), akcia **`open(key, read, beforeShown?)`**: vyprázdni sklad, zapne loader, nastaví
  `dialog` na kľúč a počká na `read`. Odpoveď vezme, len keď je to čítanie posledného otvorenia a detail sa medzitým
  nezavrel (počítadlo `turn`, `:29`; zvyšuje ho každé `open` aj každé `close`): vtedy zavolá `beforeShown`, zapíše
  asset a vypne loader. Odpoveď, ktorá už nie je čakaná, nezapíše nič, loader nechá a `beforeShown` nezavolá.
  Keď `read` (alebo `beforeShown`) zlyhá, akcia chybu pošle ďalej hostiteľovi; ak je to čítanie, na ktoré detail čaká,
  predtým detail zavrie (`close`).
- `assetDetailStore.ts:67-72`, akcia **`close()`**: zvýši `turn` (čítanie na ceste sa tým vzdá), vypne loader,
  vyprázdni asset, vynuluje `dialog`.
- `AssetDetailDialog.vue:42-58`: tlačidlo zavretia si poznačí, čo detail ukazoval (ako doteraz: nič počas načítavania),
  zavolá `close()` skladu a poznámku zabudne. Udalosť `close` pošle sledovanie `dialog` skladu (`flush: 'sync'`)
  **raz za každé zavretie detailu tohto hostiteľa**: len pri zmene, pred ktorou bol `dialog` jeho kľúčom (zavretie
  tlačidlom, zavretie skladom po zlyhanom čítaní, a keby jeho kľúč nahradil kľúč iného hostiteľa). Asset nesie len
  zavretie tlačidlom; ostatné `null`. Zmena, ktorá tento detail neberie (ďalšie otvorenie toho istého alebo iného
  hostiteľa skôr, než hostiteľ prekreslí), `close` neposiela.
- `assetDetailStore.ts:79-84`, akcia **`readBesideDetail(read)`** (cyklus 1): čítanie pre hostiteľa, ktorý asset skladu
  ukazuje popri detaile. Odpoveď zapíše, len keď v tej chvíli nie je otvorený žiadny detail a od začiatku čítania sa
  žiadny neotvoril (to isté počítadlo `turn`); chybu pošle ďalej. `AAssetListInner.vue:177-190` ňou číta asset
  bočného panela po zavretí detailu (doteraz priamy `setAsset`, kedykoľvek odpoveď prišla).
- Štyria hostitelia volajú `open` so svojím čítaním a chybu hlásia ako doteraz (`showErrorsDefault`):
  `ImageWidgetMultipleInner.vue:443-463`, `ImageWidgetInner.vue:562-581`, `ImageMediaWidgetInner.vue:687-706`
  (čítanie assetu podľa súboru a ext systému jeho licencie; `cachedExtSystemId` nastaví až `beforeShown`, teda len
  pre odpoveď, ktorá sa ukáže), `UploadQueueDialog.vue:201-208` (`showDetail`; `updateUploadStore` nastaví pred
  otvorením, ako doteraz). Priame zápisy `loading` a `dialog` z hostiteľov zmizli.
- Galéria: `detailOfRow`, `onAssetDetailClose`, sľub `saving` a asset v udalosti `close` sú bez zmeny. Príznak
  `detailOfRow` po detaile, ktorý sa zavrel sám, vynuluje tá istá obsluha `close` (dostane `null`, nič nečíta).

**Rozhodnutia.**
- **Hostiteľ sa o zavretí skladom dozvie udalosťou `close`,** nie z výsledku akcie: galéria podľa nej nuluje
  `detailOfRow` (inak by detail otvorený potom z dialógu fronty platil za detail riadku a po zavretí by sa čítalo)
  a zoznam assetov (`AAssetListInner`, druhý hostiteľ dialógu fronty) po nej znova načíta asset bočného panela.
- **Zlyhanie čítania, ktoré už nie je čakané** (detail zavretý z loadera, alebo otvorený znova), sa hlási ako doteraz
  (každé zlyhané čítanie raz); len nezatvára a nevypína loader otvoreného detailu.
- **`close()` vypína loader:** vzdané čítanie ho už nevypne, a `loading` skladu číta aj dialóg jedného súboru.
- **Sklad sa prázdni už pri otvorení** (zadanie; dialóg fronty to robil). Widgety jedného obrázka používajú asset
  skladu aj pre výber autorov v dialógu obrázka: ten asset tak zmizne pri otvorení detailu, nie až pri jeho zavretí
  (pod loaderom cez celé okno to nevidno; stav po zavretí je rovnaký ako doteraz, pozri nový nález 1).
- **Podmienka „dialóg je ešte otvorený" je počítadlo**, nie porovnanie `dialog` s kľúčom: `dialog` nuluje len
  `close()`. Zoznam assetov otvára detail aj priamym zápisom `dialog` (bez čítania, `AAssetListInner.vue:172-175`);
  počítadlo zvýšené pri zavretí drží aj tento prípad (test skladu).

**Čo sa mení pre používateľa.** admin-cms aj admin-ugc; „Upraviť asset" v riadku galérie, v dialógu obrázka oboch
widgetov jedného obrázka a v riadku dialógu fronty (aj v zozname assetov s uploadom):
- keď čítanie assetu zlyhá (asset v DAM zmazaný, 5xx, timeout, výpadok siete, 403), ukáže sa tá istá chybová hláška
  ako doteraz a detail sa sám zavrie; stránka pod ním je hneď použiteľná (doteraz ostala stmavená a mŕtva do
  obnovenia stránky). V testoch sú 404 a 500;
- detail zavretý z loadera a otvorený znova (z toho istého alebo iného riadku) ukáže asset posledného otvorenia,
  v ktoromkoľvek poradí odpovede prídu; staršia odpoveď už detail neprepne, nevypne mu loader a nezmení ext systém,
  pod ktorým stránka hľadá mená;
- odpoveď, ktorá príde po zavretí z loadera, sa nikde neukáže (doteraz ostala v sklade a ukázal ju ďalší detail,
  ktorého vlastné čítanie zlyhalo).

Bežná cesta (čítanie uspeje) je bez zmeny: jedna požiadavka, ten istý asset, ten istý ext systém.

**Na backend.** Nič nové ani iné: tie isté čítania (`GET {endPointAsset}/asset-file/{id súboru}`, pri dialógu fronty
`GET {endPointAsset}/{id assetu}`, prípadne `GET` licencie, ako doteraz).

**Obmedzenia.**
- Po detaile, ktorý sa zavrel sám, zoznam assetov (`AAssetListInner`) znova číta aktívny asset bočného panela (ako po
  každom zavretí); ak zlyhá aj to čítanie, ukáže sa druhá hláška (iného čítania). Od cyklu 1 má zoznam vlastné
  prípady a toto čítanie sa nezapíše cez detail.
- Chyba čítania vzdaného zavretím z loadera sa ukáže aj potom, čo používateľ pokračuje inde na stránke (ako doteraz).
- **Jedna cesta je po kroku horšia a ostáva** (rozhodnutie vedúceho; chyba za ňou je nález 136). Widget jedného
  obrázka, ktorého dialóg obrázka ponúka výber autorov DAM: „upraviť asset" a zavretie detailu z loadera. Doteraz
  oneskorená odpoveď asset do skladu vrátila a výber autorov sa v dialógu obrázka znova ukázal; teraz sa odpoveď
  nevezme a výber je preč natrvalo (ako po každom inom zavretí detailu, čo platilo už predtým).

## FE-40 (133): riadok galérie prevezme autorov z použitého obrázka fronty

**Čo sa mení v kóde.** `ImageWidgetMultipleInner.vue:465-485` (`onAssetUploadConfirm`): pred pridaním nových obrázkov,
keď stránka výber autorov kreslí (`authorEnabled`), za každý použitý obrázok s `assetId` a s autormi každý riadok
galérie s tým istým `assetId`, ktorý má `showDamAuthors`, dostane `damAuthors` (vlastná kópia), `texts.source`
použitého obrázka a `showDamAuthors: false`. Bez čítania: id autorov aj mená (zdroj) nesie použitý obrázok
(`UploadQueueDialog.vue:182-188`, `metadataToImageMap.ts:67-93`).

**Rozhodnutia.**
- **„Ponúka výber" = `showDamAuthors` riadku a `authorEnabled` stránky** (tak ho kreslí `ImageWidgetMultipleItem.vue:111`).
  Kde ext system autorov DAM nemá, riadok ukazuje „Zdroj" (text redaktora) a nemení sa, aj keď použitý obrázok autorov
  má (pripnuté testom).
- **Čo redaktor vybral v starom riadku, ustúpi** autorom z fronty (ako po zavretí detailu, FE-32).
- **Zdroj je text použitého obrázka,** teda mená v poradí autorov bez neznámych a prázdnych mien; keď mapa mená
  nenájde, starý riadok má povinný prázdny „Zdroj" (rovnako ako nový riadok a ako po FE-32).

**Mapovanie po uložení galérie pri dvoch riadkoch jedného súboru** (`:613-623`, berie príznaky PRVÉHO riadku s tým
istým `dam.damId`). Po oprave majú starý aj nový riadok pred uložením to isté (`damAuthors` autorov z fronty,
`showDamAuthors: false`, zdroj z mien, ten istý `assetId`); uloženie za žiadny neposiela autorov do DAM a po uložení
oba dostanú hodnoty prvého, teda to isté: bez výberu, so zdrojom (pripnuté testom, líšia sa len id obrázka). Keď
použitý obrázok autorov nemá, riadky sa nemenia a platí starší stav, pozri nový nález 2.

**Čo sa mení pre používateľa.** admin-cms, galéria: po „Uložiť a použiť" nad súborom, ktorý je duplikátom obrázka
z galérie, a ktorému redaktor vo fronte vybral autorov (alebo ich asset medzitým dostal), starý riadok toho assetu
ukáže pole „Zdroj" s menami autorov namiesto výberu; čo v ňom bolo vybrané, zmizne. Riadok so „Zdrojom", riadok iného
assetu a (keď použitý obrázok autorov nemá) žiadny riadok sa nemení. admin-ugc: nič (autorov DAM nemá).

**Na backend.** Uloženie galérie už neposiela `PATCH …/metadata-bulk-update` s autormi vybranými v starom riadku cez
autorov, ktorých práve uložila fronta; do CMS ide zdroj starého obrázka = mená autorov assetu (doteraz jeho pôvodný
zdroj, pri novom obrázku prázdny).

## FE-41 (134): dropzóna ukáže farby „súbor je nad zónou"

**Čo sa mení v kóde.** `AFileDropzone.vue:170-181` a `:194-202`: pravidlo `--over` je za pravidlom `--possibility`,
vo svetlej aj tmavej téme; nič iné sa nemení (šablóna, triedy, negácia `--disabled` ostávajú).

**Poradie v zostavenom CSS.** Sass vypíše vnorené pravidlá v poradí zdroja a build ich neprehadzuje: posledný
zostavený `dist/common-admin.css` (pred krokom) má obe pravidlá v poradí zdroja (`--over`, potom `--possibility`),
s rovnakou váhou (`.v-theme--light .a-file-dropzone--over:not(.v-theme--light .a-file-dropzone--disabled)`, v jednej
vrstve). Rozhoduje teda poradie; test beží nad skutočnými štýlmi v prehliadači. Váha oboch pravidiel musí ostať
rovnaká: pravidlo `--over` bez negácie `--disabled` je slabšie a `--possibility` ho znova prekryje (overené ohybom).

**Čo sa mení pre používateľa.** admin-cms, admin-ugc a každý admin s `AFileDropzone`: pri ťahaní súboru nad stránkou
je zóna modrosivá ako doteraz, a keď je súbor nad zónou, zozelenie (svetlá `#dcedc8` s obrysom `#7cb342`, tmavá
`#283121` s obrysom `#333e28`); po odchode súboru zo zóny je znova modrosivá. Platí pre všetky varianty (`default`,
`fill`, `fullscreen`, priehľadná, `hoverOnly`). Vypnutá zóna neukáže ani jedno, ako po FE-34.

**Na backend.** Nič.

## Testy a prečo vedia zlyhať

+81 prípadov (tri súbory, 172 prípadov; pred krokom 91 v dvoch).

- `consumerProfileAssetDetailOpen.test.ts` (nový, 61 prípadov). Štyria skutoční hostitelia so skutočným dialógom
  detailu v skutočnom ráme (`VDialog`), obe aplikácie, sedem prípadov na hostiteľa (`:315-475`); falošný je len DAM
  a backend obrázkov:
  - bežná cesta: jedno čítanie (presný zoznam požiadaviek po kliku), asset v detaile, ext system stránky podľa
    licencie assetu (traja hostitelia; dialóg fronty ho nemení). **Prechádza aj nad kódom zo snímku**: cesta sa
    nezmenila;
  - zlyhané čítanie (404 a 500): jedna hláška, sklad zavretý, žiadna karta detailu, aktívne prekrytia stránky sú tie
    isté ako pred klikom, tlačidlo „upraviť asset" je pod kurzorom dosiahnuteľné (`elementFromPoint`), a po obnovení
    odpovede DAM ďalší klik detail otvorí;
  - odpoveď po zavretí z loadera: nič nezapíše, nezmení ext system; ďalší detail so zlyhaným čítaním sa zavrie
    a neukáže nič;
  - dve prekryté čítania v oboch poradiach odpovedí: ukáže sa asset posledného otvorenia, loader beží, kým nepríde
    jeho odpoveď, ext system je jeho;
  - staršie čítanie zlyhá počas otvoreného detailu: hláška raz, detail ostane na loaderi a potom ukáže svoj asset.
  - Sklad samotný (`:478-573`, 5 prípadov): otvorenie začína z prázdneho skladu; dve otvorenia bez zavretia medzi
    nimi (oba poradia odpovedí); čítanie vzdané zavretím nič nezapíše ani nezavrie detail, ktorý medzitým otvoril
    zoznam assetov priamym zápisom.
- `consumerProfileImageWidgetMultipleUpload.test.ts` (+6, 89 prípadov).
  - FE-40, admin-cms (`:851-1010`, 4 prípady): duplikát od uploadu po uloženie galérie (starý riadok mal výber
    s vybraným autorom, vo fronte vybraní autori; starý riadok ukáže ich mená, žiadne čítanie assetu, uloženie galérie
    nepošle autorov, oba obrázky idú so zdrojom, po uložení sú riadky rovnaké); použitý obrázok bez autorov nechá
    starý riadok aj jeho výber; riadok so zdrojom a riadok iného assetu sa nemenia; ext system bez autorov: riadok
    so „Zdrojom" sa nemení, hoci použitý obrázok autorov má.
  - Prepísané s dôvodom (pripínali stav pred FE-38 a FE-39): prípad „reads the asset the detail showed, when a late
    answer made it another…" nahradili dva prípady (detail ukáže a po zavretí sa číta asset riadku otvoreného
    naposledy, v oboch poradiach odpovedí, `:1831`); „…also over an asset a late answer has left behind" teraz
    pripína, že oneskorená odpoveď v sklade neostane (`:1873`); „…could not be read, and says that failure once"
    detail nezatvára ručne, zavrie sa sám (`:1899`); prípad detailu z dialógu fronty má druhý variant: po detaile
    riadku, ktorý sa zavrel sám, sa pri zavretí detailu z fronty nečíta (`:1940`).
- `AFileDropzone.test.ts` (+14, 22 prípadov): sedem variantov zóny v oboch témach (ťahanie nad stránkou = farby
  „možnosť", nad zónou = farby „nad", po odchode zo zóny znova „možnosť"; pozadie aj farba obrysu); vypnutá zóna
  neukáže ani jedno, aj so súborom nad ňou. Prepísané s dôvodom: prípady „lights up…" a „goes back to its text…"
  pripínali pre súbor nad zónou modrú; teraz zelenú.

**Dôkaz** (v pamäti, `vitest.bend.config.mts` v TMPDIR, snímok `OP4-L1`; skripty `scratchpad/op4l1-bend.sh`
a `op4l1-bend-set.sh`, výpisy `scratchpad/op4l1-old.log`, `op4l1-bend-*.log`). „Zlyhá" je počet prípadov v súboroch,
ktorých sa ohyb týka.

| Ohyb | Zlyhá |
|---|---|
| sedem produkčných súborov zo snímku (pred krokom) | 78 / 172 (detail 53 / 61, galéria 7 / 89, dropzóna 18 / 22) |
| sklad: po zlyhaní len vypne loader, nezavrie | 26 / 150 |
| dialóg: `close` pošle len tlačidlo, nie zavretie skladom | 1 / 226 (galéria, detail z fronty po samozavretí) |
| sklad: `close` nezvýši počítadlo | 11 / 150 |
| sklad: `open` nezvýši počítadlo | 2 / 150 |
| sklad: `open` sklad nevyprázdni | 1 / 150 |
| galéria: ext system nastaví každá odpoveď | 6 / 61 |
| galéria: použitie bez podmienky `authorEnabled` | 1 / 89 |
| galéria: použitie prepíše aj riadok so zdrojom | 1 / 89 |
| galéria: použitie aj pri obrázku bez autorov | 1 / 89 |
| galéria: použitie prepíše aj riadky iných assetov | 1 / 89 |
| dropzóna: tmavá téma v starom poradí | 9 / 22 |
| dropzóna: `--over` platí aj pre vypnutú zónu | 4 / 22 |

Pripravené a nespustené ohyby (`op4l1-bend.sh`): sklad zavrie po každom zlyhaní, sklad vezme každú odpoveď, `close`
nevypne loader, loader po odpovedi ostane, ext system z každej odpovede vo widgetoch jedného obrázka, ext system sa
nenastaví nikdy (tri), zlyhanie bez hlášky (galéria, dialóg fronty), použitie so spoločným poľom autorov, bez zdroja,
s ponechaným výberom, dropzóna svetlá téma v starom poradí.

**Behy.** Cielené (`scratchpad/op4l1-run.sh`): 4 súbory / 248 zelených (tri súbory kroku a `assetDetailDialog.test.ts`);
okolie (`dam/uploadQueue`, `assetDetail`, `dam/__tests__`, `imageWidget`, `assetSelect`, `ui/file`,
`test/i18nLiteralKeys.test.ts`, `test/a11y`) 92 súborov / 2 099 zelených. `oxfmt`, `oxlint`, `eslint` na desiatich
súboroch, `stylelint` na šiestich čisté, `lint:tsc` 0 (`scratchpad/op4l1-lint.sh`).
**CK-LIB OP4-L1 zelená** (`vysledky/OP4-L1-ck.log`): `test:browser` 316 súborov / 4 556 testov (po OP3-L1-c1 315
/ 4 475, +1 súbor, +81), `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`,
`lint:stylelint` čisté.

## Nad rámec znenia zadania

- Okrem `open` pribudla akcia `close` skladu a v `AssetDetailDialog.vue` sa zmenilo, kto posiela `close` (sledovanie
  `dialog`): bez toho sa hostiteľ o zavretí skladom nedozvie.
- Testy skladu samotného (5 prípadov) popri testoch hostiteľov: dve otvorenia bez zavretia a detail otvorený priamym
  zápisom sa cez štyroch hostiteľov nedajú vyrobiť.
- FE-40 má podmienku `authorEnabled` (riadok, ktorý výber nekreslí, sa nemení).

## Nové nálezy (nemenené)

1. **(nález 136) Widgety jedného obrázka: po „upraviť asset" zmizne výber autorov z dialógu obrázka.** Dialóg obrázka kreslí výber
   autorov DAM, len kým má sklad detailu asset (`ImageDetailDialogMetadata.vue:142`, `:233`), a zavretie detailu sklad
   vyprázdni. Po zavretí detailu tak dialóg ukáže pole „Zdroj", ktoré nie je povinné (`:73-75`, `showDamAuthors`
   ostáva zapnuté), a „potvrdiť" autorov do assetu neuloží (`ImageWidgetInner.vue:593`, `ImageMediaWidgetInner.vue`
   rovnako): obrázok sa dá uložiť bez zdroja. Staršie; krok mení len to, že asset zo skladu zmizne už pri otvorení
   detailu (a že ho oneskorená odpoveď po zavretí z loadera nevráti). Z čítania kódu, bez testu.
2. **(nález 139) Dva riadky galérie toho istého súboru, autor vybraný len v jednom.** Uloženie pošle autorov assetu z riadku
   s výberom a zdroj z mien dá len tomu riadku (`ImageWidgetMultipleInner.vue:574-587`); druhý riadok sa uloží so
   svojím zdrojom (pri novom obrázku prázdnym) a po uložení dostane príznaky prvého riadku súboru (`:613-623`), teda
   prestane ponúkať výber a má prázdny povinný „Zdroj". Nastane pri duplikáte z fronty bez autorov, aj keď má entita
   ten istý obrázok dvakrát. Z čítania kódu.
3. **(nález 140) Hostiteľ, ktorý zanikne s otvoreným detailom, nechá v sklade stránky svoj kľúč** (`dialog`): ďalší
   hostiteľ s tým istým kľúčom detail nakreslí hneď po pripojení (`v-if="assetDialog === queueKey"`). Nič detail pri
   zániku hostiteľa nezatvára. Staršie; z čítania kódu. Hostiteľ s otvoreným detailom zanikne len pri navigácii
   z kódu: Späť v prehliadači Vuetify pri aktívnom prekrytí zruší (spresnenie vedúceho).
4. **`cachedExtSystemId` po zavretí detailu ostáva na ext systéme jeho assetu** (už v OP3-L1); krok mení len to, že ho
   nenastaví odpoveď, ktorá sa neukáže.
5. Dva prípady testu galérie majú rovnaký názov v rôznych blokoch (`:951` FE-40, `:1671` FE-32); celé mená sa líšia.
6. **(cyklus 1) Klik na asset v zozname zapisuje do skladu detailu tiež priamo** (`assetSelectListActions.ts:107-135`,
   `setAsset` mimo počítadla; staršie odpovede klikov drží len `detailRequest`). Odpoveď kliku, ktorá príde až po
   otvorení detailu riadku fronty (pomalý DAM: klik na asset, upload, „upraviť asset" v riadku, kým čítanie kliku
   beží), by detail prepísala rovnako ako čítanie bočného panela pred cyklom. Staršie, tento krok ho nespúšťa častejšie;
   neopravené (mimo zadania cyklu). Z čítania kódu.

Vedúci k tomuto kroku zapísal aj nálezy 137 (zrušený výber z DAM nechá v sklade svoj asset a príznak výberu autorov)
a 138 (`reset()` výberu assetov sa nevzdá čítania detailu zoznamu, ktoré je na ceste); neopravujú sa.

## Cyklus 1 (OP4-L1-c1, 12. 10.; posudky bez nálezu vo FE-38, FE-40, FE-41 a v počítadle FE-39; dva body a texty)

Snímok `OP4-L1-c1`, záplata `zaplaty/OP4-L1-c1.diff` (6 súborov; mimo `src` a `doc` nič). Kód po cykle je popísaný
vyššie pri FE-38 a FE-39 (znenie po cykle). Štyri body nad rámec zadania z prvého tvaru vedúci potvrdil.

1. **`close` raz za zavretie detailu tohto hostiteľa** (`AssetDetailDialog.vue:42-58`). Sledovanie posielalo `close`
   pri každej zmene `dialog`: druhý raz so starým assetom, keď sa detail otvoril znova skôr, než hostiteľ prekreslil,
   a pri otvorení detailu iného hostiteľa. Teraz len pri zmene, pred ktorou bol `dialog` kľúčom tohto dialógu; asset
   si tlačidlo pamätá len počas vlastného volania `close()` skladu. Výklad zadania: keď kľúč tohto hostiteľa nahradí
   kľúč iného (cez UI sa nedá, loader prekrýva stránku), jeho detail zanikol a hostiteľ sa to dozvie raz, s `null`;
   otvorenie iného hostiteľa po vlastnom zavretí už nič neposiela.
2. **Čítanie bočného panela zoznamu assetov sa nezapíše cez detail** (`assetDetailStore.ts:79-84`,
   `AAssetListInner.vue:177-190`). Akcia `readBesideDetail` popri `open`: odpoveď sa vezme, len keď nie je otvorený
   žiadny detail (aj detail, ktorý zoznam otvoril priamym zápisom, bez čítania) a od začiatku čítania sa žiadny
   neotvoril (počítadlo; po otvorení a zavretí medzitým platí novšie čítanie, ktoré to zavretie spustilo). Príznak
   načítavania panela a hláška chyby sú bez zmeny. Bežná cesta zoznamu (zavretie tlačidlom, jedno čítanie, panel
   ukáže znova prečítaný asset) je bez zmeny.
3. **Texty.** Changelog: FE-38 už netvrdí, že detail sa zavrie po hláške (sklad zavrie, hostiteľ potom hlási);
   k FE-39 pribudla veta o čítaní bočného panela. Poznámka: kedy sa posiela `close`, cesta, ktorá je po kroku horšia
   (FE-39, obmedzenia), príklad pri náleze 140, čísla nálezov.

**Čo sa mení pre používateľa (bod 2).** admin-ugc, stránka assetov (zoznam s uploadom), aj admin-cms tam, kde zoznam
upload má: „upraviť asset" v riadku fronty, ktorého čítanie zlyhalo (detail sa sám zavrel), stlačené znova, kým zoznam
ešte číta asset bočného panela: detail ukáže asset riadku v oboch poradiach odpovedí (doteraz ho odpoveď panela
prepísala assetom vybraným v zozname a uloženie išlo doň). Po zavretí detailu panel ukáže vybraný asset ako doteraz.
**Na backend:** tie isté čítania; uloženie detailu už nejde do assetu bočného panela.

**Testy** (+14; `consumerProfileAssetDetailOpen.test.ts` 72 prípadov, +11; `consumerProfileAssetListUpload.test.ts`
29, +3).
- Sklad (`:577-655`, 6 prípadov): čítanie popri detaile sa vezme, keď žiadny detail nie je a nebol; nevezme sa po
  otvorení detailu s vlastným čítaním (oba poradia odpovedí; kým detail načítava, sklad ostáva prázdny), pri detaile
  otvorenom priamym zápisom, ani po otvorení a zavretí medzitým (platí novšie čítanie); zlyhanie ide ďalej a nič
  nezapíše.
- Dialóg (`:663-764`, 5 prípadov; skutočný `AssetDetailDialog` pod hostiteľom, ktorý ho kreslí podľa kľúča): raz
  s assetom pri tlačidle; raz s `null` pri zavretí skladom; po opätovnom otvorení v tom istom takte druhé `close`
  nepríde a nasledujúce zavretie skladom nesie `null`, nie asset predošlého; otvorenie iného hostiteľa po vlastnom
  zavretí nič neposiela; nahradenie kľúčom iného hostiteľa pošle raz `null` a nič z toho, čo nasleduje.
- Zoznam assetov, admin-ugc (`:476-616`, 3 prípady; skutočné dlaždice, riadky fronty a dialóg detailu): bežná cesta
  (detail z bočného panela, zavretie tlačidlom: jedna požiadavka `GET {endPointAsset}/asset-50`, panel ukáže asset
  v stave po uložení); detail riadku fronty sa po zlyhanom čítaní zavrie, čítanie panela je podržané, „upraviť
  asset" znova: v oboch poradiach odpovedí ukáže detail asset riadku, a po zavretí tlačidlom panel ukáže vybraný
  asset (tri čítania vybraného assetu spolu).

**Dôkaz** (v pamäti; `scratchpad/op4l1c1-old.sh`, `op4l1-bend.sh`, výpisy `op4l1c1-old.log`, `op4l1-bend-c1-*.log`).

| Ohyb | Zlyhá |
|---|---|
| tri produkčné súbory zo snímku `OP4-L1-c1` (prvý tvar kroku), štyri súbory testov | 11 / 266 (sklad 6, dialóg 3, zoznam 2) |
| dialóg: `close` pri každej zmene `dialog` | 3 / 237 |
| dialóg: asset zavretia sa nezabudne | 1 / 237 |
| dialóg: `close` pošle len tlačidlo (ohyb z prvého tvaru, prepísaný) | 4 / 237 |
| sklad: čítanie popri detaile vezme každú odpoveď | 6 / 101 |
| sklad: čítanie popri detaile len podľa počítadla | 1 / 101 |
| sklad: čítanie popri detaile len podľa otvoreného dialógu | 1 / 101 |

Nad snímkom prechádza bežná cesta zoznamu a dva prípady dialógu (tlačidlo raz, sklad raz): tie sa nemenili.

**Behy.** Cielené: 4 súbory / 266 zelených (dva súbory cyklu, `assetDetailDialog.test.ts`, test galérie); okolie
92 súborov / 2 113 zelených; `oxfmt`, `oxlint`, `eslint` na dvanástich súboroch, `stylelint` čisté, `lint:tsc` 0.
**CK-LIB OP4-L1-c1 zelená** (`vysledky/OP4-L1-c1-ck.log`): `test:browser` 316 súborov / 4 570 testov (po OP4-L1
4 556, +14), `test:eslint` 7 / 82, ostatné čisté.
