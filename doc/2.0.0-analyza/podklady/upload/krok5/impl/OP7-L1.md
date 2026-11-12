# OP7-L1: zoznam assetov a oba výbery (FE-73 až FE-77, FE-80), potvrdenie dialógu obrázka (FE-78, FE-79); impl-lib-op7

**Stav: po cykle c1, čaká na posudok.** Cielené testy, ohyby aj CK zelené po poslednej úprave `src` (CK-LIB
OP7-L1-c1, 14. 10.). Časti kroku nižšie opisujú stav po kroku (aj čísla riadkov); čo cyklus c1 zmenil, je v nich
označené „c1" a opísané v časti „Cyklus c1" na konci, ktorá má čísla riadkov po c1.

Zadanie `krok5-praca/zadania/zadanie-OP7-L1.md` (nálezy `overenie-nalezov.md`, „Deviate overenie", FE-73 až FE-80; vlastník
13. 10. „ostatne suhlasim s odporucaniami"). Strom LIB `/home/volar/projects/anzusystems/common-admin` (vetva `next`,
commit `95b9e71a`), TMPDIR `node_modules/.cache/vitest-tmp-impl-lib-op7`. Snímok **`OP7-L1`** (pred prvou úpravou, s
`doc/changelog/2.0.0.md`), záplata `krok5-praca/zaplaty/OP7-L1.diff` (16 súborov, 2 610 riadkov; mimo `src` a `doc` nič).
Cesty nižšie sú relatívne k `src/domains/dam/`.

## Zmenené súbory

- `assetSelect/store/assetSelectStore.ts` (FE-73; FE-75: `getActiveAssetId`)
- `assetSelect/composables/assetSelectListActions.ts` (FE-74, FE-75, FE-80)
- `assetDetail/store/assetDetailStore.ts` (FE-80: `readBesideDetail` má tretí nepovinný argument `beforeShown`)
- `assetSelect/components/AAssetListInner.vue`, `AAssetSelect.vue`, `AAssetSelectMedia.vue` (FE-74, FE-77)
- `assetSelect/components/AssetSelectTableRowItem.vue` (FE-76)
- `imageWidget/components/ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue` (FE-78, FE-79)
- nové testy: `assetSelect/__tests__/consumerProfileAssetPickersList.test.ts` (16),
  `assetSelect/__tests__/consumerProfileAssetListSidePanel.test.ts` (13),
  `imageWidget/__tests__/imageWidgetsConfirmOfAnImage.test.ts` (11),
  `imageWidget/__tests__/ImageWidgetConfirmCollabLock.test.ts` (3)
- upravené testy: `assetSelect/__tests__/consumerProfileAssetListUpload.test.ts` (5 prípadov),
  `imageWidget/__tests__/consumerProfileImageWidgetLibrary.test.ts` (dvojica, 4 behy)
- `doc/changelog/2.0.0.md`: osem nových odrážok za odrážkou o aktívnej dlaždici (`:172-179`), v nej (`:171`) vypustená
  zátvorka o „Upraviť" nad zoznamom bez assetu a „goes by" zmenené na „went by".

Bez zmeny, hoci ich zadanie menuje: `config/composables/damConfigState.ts` (FE-77 ho nepotrebuje) a pre FE-75
`AAssetListInner.vue` (oprava je celá v akciách). `src/lib.ts` bez zmeny; sklad výberu, sklad detailu ani
`useAssetSelectActions` knižnica nevyváža. Žiadny nový text prekladu.

## Skupina A

### FE-73: fajka vybraného assetu po novom zozname

**Kód.** `setList` a `appendList` berú príznak riadku z mapy výberu: `selected: selectedAssets.value.has(…)`
(`assetSelectStore.ts:78`, `:91`). Nič iné sa nemení: mapa drží položky, ako ich držala.

**Používateľ.** Výbery assetov oboch adminov (dlaždice aj tabuľka): po hľadaní, inom zoradení alebo ďalšej strane má
vybraný asset fajku; jeden klik naň ho odoberie; pri plnom počte sa dá odobrať a vybrať iný. Zoznam admin-ugc nevyberá
nič (bez zmeny).

**Prípady** (`consumerProfileAssetPickersList.test.ts:250-357`, admin-cms, skutočné výbery so skutočnými dlaždicami,
lištou a filtrom; 6): zoradenie a hľadanie v `AAssetSelect`, zoradenie v `AAssetSelectMedia` (fajky, počítadlo, jeden
klik odoberie, „Potvrdiť" odovzdá len zvyšok); ďalšia strana prinesie vybraný asset; plný počet (2 z 2); stráž: nič
vybrané, nič označené. **Ohyby:** `73-new-list-marks-none` 4 / 98, `73-further-page-marks-none` 1 / 98.

### FE-74: nový zoznam od prvej strany

**Kód** (stav po kroku; **c1** to nahradil jednou funkciou pre každý začiatok zoznamu, riadky v komponentoch zanikli,
pozri „Cyklus c1", c1-2).
- Zoradenie: `pagination.value.page = 1` pred čítaním v `sortByChange` troch komponentov (`AAssetListInner.vue:170`,
  `AAssetSelect.vue:220`, `AAssetSelectMedia.vue:230`).
- Prepnutie typu: nová akcia `startListAnew` (`assetSelectListActions.ts:207-217`), volaná z `typeChange`
  (`AAssetSelectMedia.vue:220`): zruší požiadavku zoznamu na ceste (`listController?.abort()`), nastaví stranu 1 a
  `hasNextPage` z `true` / `false` na `false` (`null` ostáva `null`).

**Prečo aj `hasNextPage` (nad znenie zadania).** DAM odpovedá zoznamom s `hasNextPage`. Tlačidlo „načítať viac" je
kreslené podľa neho (`v-show`) a má `v-intersect`: keď sa zoznam pri prepnutí typu vyprázdni, tlačidlo príde do okna a
samo vypýta ďalšiu stranu skôr, než po 200 ms odíde čítanie prvej. So samotným `page = 1` by nový typ začal stranou 2.
Že to tak v prehliadači naozaj beží, ukázal pokus (nález 1).

**Používateľ.** Zoznam admin-ugc a oba výbery: po „načítať viac" a zmene zoradenia začína zoznam od začiatku. Výber
`AImageMediaWidget`: to isté po prepnutí typu; riadky starého typu už neprebliknú; pod vyprázdneným zoznamom nie je
„načítať viac", kým nepríde prvá strana nového typu.

**Prípady** (7): `consumerProfileAssetPickersList.test.ts:359-475` (zoradenie v oboch výberoch: posuny `[0, 25, 0]`;
prepnutie typu po „načítať viac": jediná požiadavka, video od 0; pod vyprázdneným zoznamom nie je tlačidlo a prvá
požiadavka je prvá strana; podržaná ďalšia / prvá strana starého typu sa po prepnutí zruší a jej riadky neprídu),
`consumerProfileAssetListSidePanel.test.ts:491` (zoznam). **Ohyby:** zoradenie nevráti stranu v zozname / výbere /
výbere s médiami po 1 / 98 (**c1:** tieto tri ohyby zanikli s riadkami, ktoré ohýbali); `74-type-keeps-the-request` 2;
`74-type-keeps-the-page` 3; `74-type-keeps-the-further-page` 1 (po c1 znova, pozri tam).

### FE-75: po zavretí detailu sa číta zapamätaný asset

**Kód.** `readActiveItemAgain` (`assetSelectListActions.ts:160-193`) číta asset, podľa ktorého si zoznam pamätá aktívnu
dlaždicu (`assetSelectStore.getActiveAssetId()`, `assetSelectStore.ts:143-149`), nie asset dlaždice, ktorá je práve
aktívna. Keď je dlaždica aktívna, je to ten istý asset; keď ho nový zoznam nemá, číta sa ďalej. Bez zapamätaného
assetu sa nečíta nič (`:172`). Poradie s čítaním kliku, stráž `readBesideDetail` aj `forgetAssetNotShown` po skončení
čítania ostali.

**Používateľ.** admin-ugc, zoznam assetov: klik na dlaždicu, hľadanie, ktoré ten asset nevráti, „Upraviť", zavretie:
panel ukáže práve upravený asset (doteraz „žiadny asset"). Neskorší zoznam, ktorý asset vráti, označí jeho dlaždicu.
**Čo zadanie nehovorí:** to isté čítanie sa spraví po zavretí detailu riadka fronty (panel ukáže naposledy kliknutý
asset; doteraz ostal prázdny); keď čítanie zlyhá, hláška je raz, panel ostane prázdny a neskorší zoznam neoznačí nič.
**Na backend:** jedno čítanie assetu navyše pri takom zavretí.

**Prípady.** Nové (`consumerProfileAssetListSidePanel.test.ts:282-365`, 4): po „Upraviť" a zavretí nad zoznamom bez
assetu; po detaile riadka fronty; zlyhané čítanie; stráž: nič kliknuté, nič sa nečíta. **Upravené existujúce**
(`consumerProfileAssetListUpload.test.ts`): dvojica `:976` pripínala prázdny panel, teraz tvrdí, že panel asset
ukáže a neskorší zoznam / strana dlaždicu označí; prípad `:1061` (čítanie po skoršom zavretí, ktoré sa nevezme): po
neskoršom zavretí sa číta znova a panel asset ukáže; dvojica `:1037` má navyše tvrdenie, že na ceste sú dve čítania
(klik aj čítanie po zavretí), názvy a komentáre sú prepísané. **Ohyb:** `75-read-by-the-active-item-alone` 9 / 98.

### FE-76: značka aktívneho riadku tabuľky

**Kód.** Riadok má triedu `asset-list-table__item--active` podľa `item.active` (`AssetSelectTableRowItem.vue:44-47`) a
jedno pravidlo v tom istom súbore (`:96-102`): `outline: 1px solid blue; outline-offset: -1px` (rám ako okraj aktívnej
dlaždice, `blue` v oboch témach ako tam).

**Rozhodnutie.** Nepoužil som existujúcu triedu `a-datatable__row--active`: jej pravidlo v `styles/components/table.scss`
(`:66`, `:84`) dáva v tmavej téme svetlé pozadie pod svetlý text (nález 6).

**Používateľ.** Tabuľkový pohľad zoznamu a výberov: riadok assetu, ktorý ukazuje panel, má modrý rám; ide za assetom
cez nový zoznam. **Prípad** (`consumerProfileAssetListSidePanel.test.ts:458`, 1; trieda aj vypočítaný štýl). Rám na
`tr` som videl na snímke obrazovky v Chromiu; iné prehliadače som neskúšal. **Ohyby:** bez triedy 1, bez pravidla 1.

### FE-77: zlyhané čítanie konfigurácie vlastných polí

**Kód.** Tri komponenty majú príznak `customFormConfigFailed` (`AAssetListInner.vue:162`, `AAssetSelect.vue:212`,
`AAssetSelectMedia.vue:211`). Sledovanie `extId` ho pri novom ext systéme vypne, a po čítaní ho nastaví podľa toho, či
konfigurácia v sklade je (`:230`, `:239`, `:249`); načítavanie sa vypne po úspechu aj zlyhaní. Odpoveď pre ext systém,
ktorý zoznam medzitým opustil, nemení nič (`if (extId.value !== newValue) return`, `:229`, `:238`, `:248`). Šablóna:
vetva chyby je pred kolieskom (`AAssetListInner.vue:340-345` stĺpec, `:391-396` dialóg úzkeho okna;
`AAssetSelect.vue:327-332`; `AAssetSelectMedia.vue:341-346`).

**Text.** Existujúci kľúč `common.damImage.error.loadingConfig` („Chyba načítania konfigurácie DAM", en „Loading Media
Library config error", cs „Chyba načtení konfigurace DAM"), ten istý, ktorý widgety ukazujú pri zlyhanej konfigurácii
DAM. Nový kľúč som nepridal. Text zo zadania („… Obnovte stránku.") by bol návodnejší: rozhodnutie vlastníka.

**Rozhodnutia.** Stav chyby má prednosť pred kolieskom aj počas čítania kliknutého assetu (formulár sa aj tak nedá
nakresliť). Stráž opusteného ext systému je nad znenie zadania: bez nej by neskorá chyba prvého ext systému ukázala
chybu pri druhom, ktorý konfiguráciu má (a doteraz neskorý úspech prvého vypol koliesko druhého).

**Používateľ.** Keď žiadne zo štyroch čítaní neprinesie pole, panel povie chybu namiesto nekonečného kolieska (**c1:**
len keď všetky štyri zlyhajú; ext systém bez vlastných polí asset ukáže, c1-3). Výber assetu funguje ďalej. Hláška (alert) nepribudla ani neubudla: `loadDamConfigAssetCustomFormElements` odmieta s `false`,
čo `showErrorsDefault` neukáže (nález 4).

**Prípady** (8): výbery `consumerProfileAssetPickersList.test.ts:477-551` (oba: chyba, bez kolieska, klik vyberie,
„Potvrdiť" odovzdá; stráž: konfigurácia sa načíta aj s jedným chýbajúcim typom), zoznam
`consumerProfileAssetListSidePanel.test.ts:509-580` (úzke aj široké okno; odpoveď pre opustený ext systém; stráž).
**Ohyby:** chyba sa nepovie v zozname 2, vo výbere 1, vo výbere s médiami 1; bez stráže opusteného ext systému 1.

### FE-80: odpoveď kliku sa nepíše do otvoreného detailu

**Kód.** `onItemClick` číta cez `assetDetailStore.readBesideDetail` (`assetSelectListActions.ts:129-149`): odpoveď sa
vezme, len keď nie je otvorený detail, žiadny sa od začiatku čítania neotvoril a klik je stále posledné vyžiadané
čítanie. Zápis ext systému a doplnenie kešiek (doteraz pred `setAsset`) beží v novom argumente `beforeShown`
(`assetDetailStore.ts:81-92`), teda len pre vzatú odpoveď. `forgetAssetNotShown` nezabúda, kým je detail otvorený
(`:60`): jeho zavretie asset prečíta.

**Používateľ.** admin-ugc, zoznam s frontou: odpoveď kliku, ktorá príde pri otvorenom detaile riadka fronty, detail
nezmení; po jeho zavretí panel kliknutý asset prečíta. Pri bežnej práci nič.

**Prípady** (`consumerProfileAssetListSidePanel.test.ts:367-444`, 3): detail riadka už ukazuje svoj asset / je na
koliesku; zoznam medzitým dlaždicu stratil (pripína aj `:60`). **Ohyby:** klik píše priamo 3 / 326;
`80-shown-answer-says-no-ext-system` 2 a `80-before-shown-not-called` 2 (existujúci prípad knižnice o ext systéme po
odpovedi kliku, oba widgety); `75-forgotten-with-a-detail-open` 1 / 98.

## Skupina B

### FE-78: potvrdenie patrí obrázku, pri ktorom ho stlačili

**Kód** (`ImageWidgetInner.vue:614-675`, `ImageMediaWidgetInner.vue:757-820`, rovnaké znenie). Pri stlačení sa odloží
obrázok dialógu (`pressedOn`) a `confirmIsOver = () => disposed || detail.value !== pressedOn`. Po prečítaní mien a po
zápise autorov potvrdenie skončí, keď `confirmIsOver()` (`:637`, `:647`; `:780`, `:790`). Ukladá sa `pressedOn`, nie to,
čo dialóg ukazuje (`:652`, `:795`). Zavretý dialóg (`detail` je `null`) je tiež „iný": po čítaní mien ako doteraz
(c2-1 z OP6), po zápise autorov doteraz obsluha končila na chybe, ktorú nikto nevidel.

**Po uložení obrázka (odchýlka od znenia „po každom čakaní skončiť").** Uloženie prešlo, a widget obrázok vezme ako
doteraz (model, náhľad, udalosť). Keby tam potvrdenie skončilo, widget by ukazoval iný obrázok, než aký je uložený
(pri výmene na mieste má backend pod tým istým id nový súbor). Mení sa len to, čo patrí dialógu: keď dialóg ukazuje
iný obrázok alebo médium (`anotherDialog`, `:663`, `:806`; **c1:** len dialóg iného výberu alebo uploadu, dialóg z
„upraviť metadáta" sa zavrie ako pred krokom, c1-1), nezavrie sa, jeho `detail` sa nevyprázdni a zámok poľa sa
nevráti (vráti ho zavretie alebo potvrdenie toho dialógu; v neaktívnej miestnosti hodnota ide do zásobníka hneď, ako
pri `reset(release)`). Pri `expandMetadata` sa nemení nič: formulár v stránke nie je dialóg otvorený neskôr.

**Používateľ.** admin-cms: „Potvrdiť" s vybranými autormi, zavretie dialógu a „upraviť metadáta" pre obrázok widgetu,
kým DAM odpovedá: nič sa neuloží a otvorený dialóg ostane (počas čítania mien sa ani autori nepošlú). Vo widgete s
médiami po otvorení dialógu pre video neodíde `createImage` s prázdnymi poľami. Oba adminy: dialóg znova otvorený
počas ukladania obrázka sa odpoveďou nezavrie; widget uložený obrázok ukáže (**c1:** nezavrie sa dialóg iného výberu;
dialóg z „upraviť metadáta" áno).

**Prípady.** Upravená dvojica knižnice (`consumerProfileImageWidgetLibrary.test.ts:2342-2384`, oba widgety): pripínala,
že sa obrázok 7 uloží bez stlačenia; teraz nič uložené, dialóg otvorený, tlačidlo sa netočí, vlastné potvrdenie uloží
obrázok 7. Nové (`imageWidgetsConfirmOfAnImage.test.ts`, admin-cms, oba widgety): dialóg znova otvorený počas uloženia
(`:286`; **c1:** prepísaný, pripínal zastaraný dialóg), zavretý a neotvorený (stráž, `:318`), video počas zápisu
autorov (len widget s médiami, `:404`).
`ImageWidgetConfirmCollabLock.test.ts` (3, len `ImageWidgetInner`, zámok cez napodobené `useCollabField`): aktívna
miestnosť, neaktívna miestnosť, formulár v stránke. **Ohyby** (na widget): iný obrázok potvrdenie neukončí 3 / 4;
pokračuje po menách 3 / 3; pokračuje po autoroch 2 / 3; zavrie dialóg otvorený neskôr 1 / 1; zámok (3 ohyby) po 1 / 3.

### FE-79: odpoveď po zániku widgetu

**Kód.** `disposed` je súčasť `confirmIsOver` (po menách a po autoroch) a samostatná stráž po uložení (`:658`, `:801`):
zaniknutý widget nezapíše model, sklad dialógu, zámok ani udalosť. Chyby ukladania sa hlásia ako doteraz.

**Používateľ.** Bez zmeny pri bežnej práci. Embed obrázka: „Potvrdiť", „Zrušiť" počas uloženia a otvorenie iného
embedu: formulár druhého ostane jeho. Zrušenie počas čítania mien alebo zápisu autorov: obrázok sa už neuloží (počas
čítania mien sa nepošlú ani autori).

**Prípady** (`imageWidgetsConfirmOfAnImage.test.ts:340`, `:378-402`; na widget 3): druhý widget s `expandMetadata` si
drží svoj obrázok a jeho potvrdenie uloží jeho obrázok; zánik počas čítania mien / zápisu autorov. **Ohyby** (na
widget): zaniknutý pokračuje 2; zaniknutý vezme odpoveď 1.

## Dôkaz

Deväť produkčných súborov zo snímku `OP7-L1` nad šiestimi súbormi testov (`pracovne/impl-lib-op7/stare-vsetko.sh`,
výpis `ohyb-stare-vsetko.log`): **43 / 231** červených. Z 43 nových prípadov je červených 34; 9 nad snímkom prechádza
(stráže toho, čo sa meniť nemá). Z upravených existujúcich je červených 9 (5 a 4). Ohybov 34 (19 skupina A, 15 skupina
B), každý zhodil aspoň jeden prípad (`ohyby.py`, `ohyby-beh.sh`, výpisy `ohyb-*.log`; ohyby v TMPDIR,
`bend-op7l1-*.json`).

**Behy.** `oxfmt`, `oxlint`, `eslint`, `stylelint` na pätnástich súboroch čisté. **CK-LIB OP7-L1 zelená na prvý beh**:
testy (`vysledky/OP7-L1-testy.log`) 321 súborov / 4 777 testov (po `OP6-L1-c3` 317 / 4 734; +4 súbory, +43), žiadny
opakovaný prípad, 350 s; linty (`vysledky/OP7-L1-linty.log`) `test:eslint` 7 / 82, `lint:tsc`, `format:check`,
`lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.

## Prijaté medze

- FE-73: asset, ktorý strany vrátia dvakrát (nález 194), má fajku na oboch riadkoch; klik na jeden ho odoberie a druhý
  riadok fajku drží do ďalšieho zoznamu.
- FE-75: číta sa zapamätaný asset, nie ten, ktorý detail ukazoval. Líšia sa len po zlyhanom čítaní kliku (medza z
  OP6: dlaždica B označená, panel ukazuje A): po „Upraviť" a zavretí panel prečíta B, ako pri aktívnej dlaždici.
- FE-78: dialóg znova otvorený počas ukladania ukazuje obrázok widgetu spred uloženia; jeho potvrdenie ten starší stav
  zapíše späť (**c1: neplatí,** taký dialóg sa zavrie, c1-1). Po zápise autorov, ktorým potvrdenie skončilo, widget
  ponuku autorov toho assetu drží ďalej (pri obrázku toho istého súboru by ich poslal znova, tých istých).
- FE-78: zámok a `expandMetadata` po uložení majú prípady len pre `ImageWidgetInner`; vo widgete s médiami sú tie isté
  riadky overené čítaním. Podcast vo FE-78 z čítania kódu (prípad je pre video).
- FE-74: zmena zoradenia požiadavku na ceste neruší (zadanie to chce len pri type); jej riadky sú z toho istého zoznamu
  (**c1: neplatí,** každý začiatok zoznamu požiadavku na ceste ruší, c1-2).

## Nové nálezy (nemenené v kroku; **c1** opravil nálezy 1, 2, 3 a 5 a druhú vetu nálezu 4)

1. **Výber otvorený znova začína stranou 2** (overené behom v prehliadači testov, pokus mimo súborov testov).
   Stránkovanie je jedno pre stránku a `reset()` vracia len stranu (`assetSelectListActions.ts:219-226`), `hasNextPage`
   ostane `true`. Pri ďalšom otvorení je „načítať viac" nakreslené hneď (`AAssetSelect.vue:313-316`, rovnako
   `AAssetSelectMedia.vue:327-330`, `AAssetListInner.vue:325-328`), je v okne a `v-intersect` vypýta stranu 2 skôr, než
   po 200 ms odíde čítanie zoznamu, ktoré potom číta tiež stranu 2. Pokus: druhé otvorenie `AAssetSelect` poslalo
   posuny `[25, 25]` a zoznam ukázal len asset druhej strany. Oprava (S): `reset()` má vyprázdniť aj `hasNextPage`,
   ako `startListAnew`. Výber s médiami s predvoleným videom alebo podcastom to po tomto kroku nerobí (ide cez
   `typeChange`).
2. **„Uložiť a použiť" fronty číta zoznam od strany, na ktorej bol** (`AAssetListInner.vue:209-213`, `onUploadApply`
   nevracia stranu). Tá istá chyba ako FE-74, iný volajúci; z čítania kódu.
3. **Ďalšie neskoré zápisy zaniknutého widgetu do skladu dialógu** (trieda FE-79, iné čakania): čítanie obrázka
   widgetu (`ImageWidgetInner.vue:437-449`, `ImageMediaWidgetInner.vue:450-463`: po `fetchImage` pri `expandMetadata`
   `setDetail` bez `disposed`) a výber z knižnice (`pickAsset`, `:484-556`, `:547-683`). Embed otvorený, zrušený skôr,
   než sa jeho obrázok prečíta, a otvorený iný: neskorá odpoveď dá prvý obrázok do druhého formulára. Z čítania kódu.
4. **Zlyhané čítanie konfigurácie vlastných polí nič nehlási** (`damConfigState.ts:167-170` odmieta s `false`,
   `showErrorsDefault(false)` neukáže nič). Odmieta aj vtedy, keď všetky štyri čítania vrátia prázdny zoznam: ext
   systém bez jediného vlastného poľa teraz ukáže chybu (doteraz koliesko). Z čítania kódu.
5. **`fetchNextPage` počas 200 ms pauzy pred čítaním zoznamu posunie stranu toho čítania** (hľadanie alebo zoradenie
   a hneď „načítať viac"); ten istý mechanizmus ako nález 1. Z čítania kódu.
6. **Pravidlo `.a-datatable__row--active`** (`styles/components/table.scss:66-68`, `:84-86`) nikto nepoužíva a v tmavej
   téme má svetlú farbu svetlej témy.

## Cyklus c1 (OP7-L1-c1, 14. 10.; dva posudky bez blokujúceho nálezu, štyri body)

Snímok `OP7-L1-c1`, záplata `zaplaty/OP7-L1-c1.diff` (14 súborov, 1 282 riadkov; mimo `src` a `doc` nič). Zmenené:
`assetSelect/composables/assetSelectListActions.ts`, `assetSelect/components/AAssetListInner.vue`, `AAssetSelect.vue`,
`AAssetSelectMedia.vue` (c1-2), `config/composables/damConfigState.ts` (c1-3), `imageWidget/components/ImageWidgetInner.vue`,
`ImageMediaWidgetInner.vue` (c1-1, c1-4); pomôcka testov `__tests__/support/consumerImageApi.ts` (`holdReads`); testy:
`consumerProfileAssetPickersList.test.ts` (+7), `consumerProfileAssetListSidePanel.test.ts` (+3),
`imageWidgetsConfirmOfAnImage.test.ts` (+3, jeden prípad prepísaný), nové `imageWidgetsAnswersOfAGoneWidget.test.ts` (5)
a `config/__tests__/damConfigCustomFormWithoutFields.test.ts` (4); `doc/changelog/2.0.0.md` (odrážky `:175`, `:177`,
`:178`, `:179` prepísané, posledná veta `:169` opravená).

### c1-1: neskorá odpoveď uloženia obrázka (FE-78)

**(a) Potvrdenie média počas uloženia obrázka** (`ImageMediaWidgetInner.vue:738-744`). `tryMediaConfirm` sa vráti, kým
beží uloženie obrázka toho widgetu (`if (metadataDialogSaving.value) return`): zvolil som odmietnutie, ako FE-64 pri
druhom „Potvrdiť". **Redaktor:** „Potvrdiť" obrázka (uloženie trvá), X, výber videa, „Potvrdiť" v jeho dialógu:
tlačidlo sa točí a stlačenie sa neberie; po odpovedi uloženia widget ukáže uložený obrázok, dialóg videa ostane
otvorený a ďalšie „Potvrdiť" video vezme (obrázok vtedy ustúpi videu, ako pri každom potvrdení média). Doteraz sa
video vzalo hneď a odpoveď uloženia ho zmazala.

**(b) Dialóg z „upraviť metadáta" otvorený počas uloženia** (`ImageWidgetInner.vue:255-261`, `:668-682`;
`ImageMediaWidgetInner.vue:266-272`, `:815-832`). Widget si pamätá, čo do dialógu vložilo „upraviť metadáta"
(`ownImageInDialog`, vo widgete s médiami `ownInDialog`: kópia obrázka alebo média widgetu). Keď dialóg po odpovedi
uloženia ukazuje práve tú kópiu, **zavrie sa ako pred krokom** (zvolil som zavretie, nie obnovenie obsahu: obsah, ktorý
sa redaktorovi vymení pod rukami, je horší než dialóg, ktorý sa zavrie pri widgete s novým obrázkom). Otvorený ostáva
len dialóg iného výberu alebo uploadu (`dialogOfAnotherPick`). **Redaktor:** výmena obrázka z knižnice, „Potvrdiť",
X, „upraviť metadáta", príde odpoveď: dialóg sa zavrie a widget ukáže nový obrázok; „upraviť metadáta" potom ukáže
uložený stav. Doteraz (po kroku) dialóg ostal so starým súborom a jeho potvrdenie výber potichu vrátilo.

**Nemenené:** chyba zápisu, ktorý zlyhal, sa ukáže aj pri potvrdení, ktoré redaktor opustil (zámer, Codex 4).

**Prípady** (`imageWidgetsConfirmOfAnImage.test.ts`): prepísaný `:288` (oba widgety: dialóg z „upraviť metadáta" sa
zavrie, widget má uložený obrázok, znova otvorený dialóg ho ukáže); nový `:313` (oba: dialóg iného výberu ostane a
jeho potvrdenie uloží jeho asset; nad snímkom c1 prechádza, drží to, čo krok priniesol); nový `:451` (widget s médiami:
video počas uloženia obrázka). `ImageWidgetConfirmCollabLock.test.ts` bez zmeny (jeho „iný obrázok" je iný výber).
**Ohyby:** `c1-media-confirm-taken-during-a-save` 1 / 22; `c1-single-own-dialog-left-open` 1, `c1-media-…` 1;
ohyby kroku nad zmenenými riadkami: zavrie dialóg otvorený neskôr 3 a 2, tri ohyby zámku po 1.

**Medze, ktoré ostávajú** (potrebujú uloženie trvajúce sekundy; z (a) ani (b) nevyplývajú):
- Výber z knižnice, ktorý je pri odpovedi uloženia ešte na koliesku (`detail` je prázdny): odpoveď dialóg zavrie a
  výber sa stratí, ako pred krokom.
- Dialóg nového výberu otvorený počas pomalého **vytvárania** obrázka nemá id (vznikol, keď widget obrázok nemal):
  jeho potvrdenie vytvorí druhý obrázok a prvý ostane nepoužitý.
- Pri `expandMetadata` formulár v stránke po odpovedi ukáže uložený obrázok aj vtedy, keď doň medzitým prišiel iný
  výber (ako pred krokom).

### c1-2: každý nový zoznam začína prvou stranou a bez „načítať viac" (FE-74)

**Kód** (`assetSelectListActions.ts:64-97`, `:227-235`). Jedna funkcia `startListAnew` (`:74-78`): zruší požiadavku
zoznamu na ceste, nastaví stranu 1 a `hasNextPage` z `true` / `false` na `false`. Volajú ju tri miesta:
- `fetchAssetListDebounced` (`:84-88`), cez ktoré ide každé nové čítanie zoznamu (zoradenie, odoslaný aj vynulovaný
  filter, typ, licencia, otvorenie výberu, zoznam po uploade): zoznam začne **hneď**, číta sa po pauze 200 ms;
- `fetchAssetList` (`:95`) ešte raz, keď čítanie odchádza: čokoľvek stranu medzitým posunulo, číta sa prvá;
- `reset()` (`:230`): po zavretí výberu a zániku zoznamu.
Riadky z kroku (`pagination.value.page = 1` v troch `sortByChange`, volanie v `typeChange`, strana v `resetAssetList`)
zanikli; komponenty sú v tejto veci ako pred krokom. `startListAnew` už akcie nevracajú.

**Redaktor.** Zoznam admin-ugc a oba výbery:
- po zoradení, hľadaní a vynulovaní filtra tlačidlo „načítať viac" hneď zmizne (vráti sa ako načítavanie, keď čítanie
  odíde) a nedá sa ním vypýtať strana 2 pred stranou 1; požiadavka ďalšej strany, ktorá je na ceste, sa zruší hneď;
- výber otvorený znova a zoznam, na ktorý sa redaktor vráti, začínajú prvou stranou (doteraz druhou, keď predošlý
  zoznam mal ďalšiu stranu a tlačidlo bolo v okne);
- zoznam po „uložiť a použiť" uploadu začína prvou stranou (doteraz stranou, na ktorej bol);
- zoznam požiadavky, ktorá bola na ceste pri zavretí výberu, už nepríde do výberu otvoreného potom.
**Čo text zadania nehovorí:** keď nový zoznam začne počas požiadavky na ceste, koliesko zoznamu na 200 ms zhasne
(zrušená požiadavka ho vypne, čítanie nového ho zapne); pri prázdnom zozname je vtedy na tých 200 ms vidieť „nič sa
nenašlo", ako pri prepnutí typu vždy. Prijatá medza.

**Prípady.** `consumerProfileAssetPickersList.test.ts:482-576` (5): zoradenie a hľadanie (tlačidlo zmizne hneď,
podržaná ďalšia strana sa zruší, pýta sa strana 1), výber otvorený znova, výber zavretý počas čítania, ďalšia strana
vypýtaná počas pauzy. `consumerProfileAssetListSidePanel.test.ts:519` („uložiť a použiť" po „načítať viac": posuny
`[0, 25, 0]`), `:540` (zoznam namontovaný znova). **Ohyby:** `c1-new-list-begins-only-at-its-read` 5 / 107;
`c1-read-keeps-the-paging` 1; `c1-reset-keeps-the-further-page` 1 / 108 (pri prvom behu 0: znovuotvorenie drží už
začiatok v `fetchAssetListDebounced`; doplnil som prípad zrušenej požiadavky pri zavretí); ohyby kroku nad novým
kódom: `74-type-keeps-the-request` 6, `74-type-keeps-the-page` 11, `74-type-keeps-the-further-page` 5.

### c1-3: ext systém bez vlastných polí (FE-77)

**Kód** (`damConfigState.ts:149-156`). `loadDamConfigAssetCustomFormElements` berie čítanie, ktoré odpovie, ako načítané
aj s prázdnym zoznamom (`if (result.status === 'fulfilled')`, doteraz `&& result.value.length > 0`). Odmieta, len keď
zlyhajú všetky štyri. Konzola už nehlási „Unable to load … for:" pre typ, ktorý odpovedal prázdnym zoznamom.

**Čo robia konzumenti s prázdnou konfiguráciou** (nemenené): `AssetCustomMetadataForm` a
`AssetCustomMetadataFormMassOperations` hádžu chybu, len keď konfigurácia ext systému **nie je**; s prázdnym zoznamom
typu nekreslia žiadne pole (`ACustomDataForm` nad prázdnym zoznamom; tak to bolo už pri type, ktorý polia nemá, vedľa
typov, ktoré ich majú). `metadataFieldName` (`api/damAssetApi.ts:273`) pole nenájde a použije meno z odpovede. Kreslenie
bez polí je teda bezpečné: panel aj riadky fronty ukážu formulár s kľúčovými slovami a autormi (kde sú zapnuté) a bez
vlastných polí.

**Redaktor.** Bočný panel zoznamu a výberov nad ext systémom bez vlastných polí ukáže asset (po kroku hovoril chybu,
pred krokom sa točil). **Čo text zadania nehovorí:** tú istú funkciu čakajú `AImageWidget`, `AImageMediaWidget` a
`AImageWidgetMultiple`: nad takým ext systémom doteraz namiesto widgetu písali „Chyba načítania konfigurácie DAM",
teraz sa nakreslia. Je to tá istá chyba úsudku na druhom mieste a oprava jedného riadku ju berie so sebou; widget som
nad takým ext systémom nechal nakresliť (prípad), nahranie súboru cezeň som neskúšal.

**Prípady.** `config/__tests__/damConfigCustomFormWithoutFields.test.ts` (4): štyri prázdne odpovede → načítané a
zapísané prázdne; jedno čítanie zlyhá → načítané, čo odpovedalo (stráž); všetky zlyhajú → odmietne, nič sa nezapíše
(stráž); `AImageWidget` sa nakreslí. `consumerProfileAssetPickersList.test.ts:636` (oba výbery),
`consumerProfileAssetListSidePanel.test.ts:636` (zoznam so **skutočným** `AssetMetadata`: formulár bez jediného poľa).
**Ohyb:** `c1-empty-answer-counted-as-failed` 5 / 112.

### c1-4: čítania zaniknutého widgetu (FE-79)

**Kód.** `if (disposed) return` za čítaním obrázka widgetu (`ImageWidgetInner.vue:443-446`,
`ImageMediaWidgetInner.vue:456-459`) a vo `pickAsset` za čítaním assetu (`:546-548`, `:676`) a, vo widgete s médiami,
za čítaním média (`:569-570`). Chyby čítaní sa hlásia ako doteraz.

**Redaktor.** Embed obrázka otvorený, zrušený skôr, než sa jeho obrázok (alebo výber z knižnice) prečíta, a otvorený
iný: formulár druhého ostane jeho.

**Medza.** Vetva kopírovania do licencie vo `pickAsset` stráž nemá: výsledok kópie zaniknutého widgetu sa ďalej zaradí
do fronty uploadu a nastaví dialóg fronty jeho kľúča (do skladu dialógu obrázka nepíše; mimo bodu).

**Prípady** (`imageWidgetsAnswersOfAGoneWidget.test.ts`, admin-cms, oba widgety, `expandMetadata`; 5): čítanie
vlastného obrázka (`:165`), výber obrázka z knižnice (`:185`), výber videa (len widget s médiami, `:224`). Pomôcka
`holdReads` podrží čítania obrázka. **Ohyby:** bez stráže pri čítaní obrázka 1 a 1; pri výbere 1 a 1; pri videu 1.

### Dôkaz a behy c1

Sedem produkčných súborov zo snímku `OP7-L1-c1` nad trinástimi súbormi testov (`pracovne/impl-lib-op7/stare-c1.sh`):
**20 / 294** červených. Z 22 nových prípadov je červených 18 (4 prechádzajú: dve stráže načítania konfigurácie a dva
behy „dialóg iného výberu ostane"); červené sú aj oba behy prepísaného prípadu. Ohybov cyklu 12, znova behaných ohybov
kroku nad zmenenými riadkami 8; každý zhodil aspoň jeden prípad.

**CK-LIB OP7-L1-c1.** Prvý beh lintov červený: `lint:tsc` našiel dve chyby typov v pomôcke a v novom súbore testov
(`consumerImageApi.ts`, `imageWidgetsAnswersOfAGoneWidget.test.ts`); opravené, obe časti behali znova nad konečným
stavom. Testy (`vysledky/OP7-L1-c1-testy.log`): 323 súborov / 4 799 testov (po kroku 321 / 4 777; +2 súbory, +22),
žiadny opakovaný prípad, 181 s. Linty (`vysledky/OP7-L1-c1-linty.log`): `test:eslint` 7 / 82, `lint:tsc`,
`format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.

## Cyklus c2 (14. 10. ráno; vedúci, implementér zanikol pri reštarte počítača)

Potvrdzovacie čítanie Codexu k c1 (`impl/posudky/OP7-L1-c1-codex.md`; čítanie Opusu neprišlo, agent zanikol pri
reštarte počítača pre Windows Update o 01:44):
1. Dialóg iného výberu, ktorý sa ešte číta, keď príde odpoveď uloženia, sa zavrie (medza z c1): opravená len veta
   changelogu („…once the picked asset has been read (a pick still being read when the answer comes is closed with
   it, as before)").
2. **Opravené:** čítanie konfigurácie, kde zlyhá jedno a ostatné odpovedia bez poľa, sa po c1 prijalo s prázdnym
   typom: formulár by sa nakreslil bez polí typu, ktorý zlyhal (môžu byť povinné). `damConfigState.ts`: neprijme sa,
   keď niečo zlyhalo a žiadne čítanie neprinieslo pole (ako pred krokom); štyri prázdne odpovede sa prijmú ďalej.
   Nový prípad v `config/__tests__/damConfigCustomFormWithoutFields.test.ts` („is not loaded when a read of it fails
   and the others answer with no field"); tri súbory konfigurácie 15 z 15 zelených; oxlint a eslint čisté. Veta
   changelogu doplnená.
3. Bliknutie „nič sa nenašlo" na 200 ms pri hľadaní počas prvého čítania zoznamu (zrušená požiadavka zhodí loader
   pred odloženým čítaním): **neopravené**, prijatá medza (rovnako ako doteraz pri prepnutí typu); oprava by menila
   strážcu „Načítať viac", ktorý sa riadi loaderom.
Celú CK-LIB po c2 pustí vedúci na konci bloku.
