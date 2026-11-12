# OP3-L1: autori z detailu v galérii, riadok bez formulára pri „uložiť a použiť", vypnutá dropzóna, „+" z klávesnice; nálezy 117, 119 so 129, 124, 127 (impl-lib-op3)

**Stav: po cykle 1, čaká na posudok.** Cielené testy a CK zelené po poslednej úprave `src` (CK-LIB OP3-L1-c1, 12. 10.).

Zadanie vedúceho (`overenie-nalezov.md`, „Štvrté overenie", tabuľka „FE, knižnica"): FE-32 (117), FE-33 (119, 129),
FE-34 (124), FE-35 (127). Strom LIB `/home/volar/projects/anzusystems/common-admin`, TMPDIR
`node_modules/.cache/vitest-tmp-impl-lib-op3`. Snímok **`OP3-L1`** (pred prvou úpravou, s `doc/changelog/2.0.0.md`),
záplata `krok5-praca/zaplaty/OP3-L1.diff` (13 súborov; mimo `src` a `doc` nič).

## Zmenené súbory

- `src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue` (FE-32)
- `src/domains/dam/assetDetail/components/AssetDetailDialog.vue`,
  `src/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue`,
  `src/domains/dam/assetDetail/store/assetDetailStore.ts` (FE-32, od cyklu 1)
- `src/domains/dam/uploadQueue/components/UploadQueueDialog.vue` (FE-33, FE-35)
- `src/domains/dam/imageWidget/utils/metadataToImageMap.ts` (FE-33, riadok `internal`)
- `src/domains/ui/file/components/AFileDropzone.vue` (FE-34)
- `src/locales/sk/common/damImage.json`, `src/locales/en/common/damImage.json`, `src/locales/cs/common/damImage.json`
  (jeden nový kľúč)
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetMultipleUpload.test.ts`
- `src/domains/dam/__tests__/consumerProfileUploadDialogActions.test.ts`
- `src/domains/dam/imageWidget/__tests__/metadataToImageMap.test.ts`
- `src/domains/dam/uploadQueue/__tests__/uploadQueueDialogSave.test.ts`
- `src/domains/dam/assetDetail/__tests__/consumerProfileAssetDetailSave.test.ts` (od cyklu 1)
- `src/domains/ui/file/__tests__/AFileDropzone.test.ts` (nový súbor)
- `doc/changelog/2.0.0.md` (tri odrážky v „Upload queue and its dialogs.", jedna v „Image widgets and asset select,
  uploads and picks.")

Žiadny súbor nezanikol. Exportované typy a podpisy `metadataToImageMap.ts` sa nemenili. `AssetDetailDialog`
ani sklad detailu knižnica nevyváža (`src/lib.ts`).

## FE-32 (117): riadok galérie po zavretí detailu prevezme autorov assetu

Znenie po cykle 1 (prvý tvar kroku čítal podľa id súboru riadku, hneď pri zavretí; pozri „Cyklus 1").

**Čo sa mení v kóde.**
- `AssetDetailDialog.vue:42-48`: `close` nesie asset, ktorý detail ukazoval (`shown`): to, čo má sklad detailu tesne
  pred vyprázdnením, a `null`, keď sa detail zatváral z načítavania alebo asset nemal. Ostatní hostitelia dialógu
  (`AAssetListInner`) argument nečítajú.
- `assetDetailStore.ts:24-42`: sklad detailu drží uloženie, ktoré je na ceste (`saving`, sľub, ktorý nikdy nezlyhá;
  po odpovedi DAM sa vynuluje), a `setSaving`. `AssetDetailSidebarMetadata.vue:72-75`: `onSave` ho tam zapíše, keď
  požiadavku pošle (nie pri stlačení, ktoré nič neposlalo).
- `ImageWidgetMultipleInner.vue`:
  - `onEditAsset` si poznačí, že detail otvoril riadok galérie (`detailOfRow`, `:432-434`, `:446`);
  - `AssetDetailDialog` galérie má `@close="onAssetDetailClose"` (`:837`). Obsluha (`:520-534`) skončí bez čítania,
    keď detail neotvoril riadok, keď neukazoval asset, keď je widget `readonly`, keď stránka výber autorov nekreslí
    (`authorEnabled`) alebo keď žiadny riadok toho assetu (`assetId`) nemá `showDamAuthors`. Inak si poznačí id
    assetu, uloženie detailu na ceste a ext systém stránky a zaradí čítanie `takeAuthorsOfDetailAsset` (`:481-518`):
    1. počká na uloženie detailu, ktoré bolo pri zavretí na ceste;
    2. prečíta asset podľa jeho id (`fetchAsset`); bez autorov skončí;
    3. prečíta mená autorov pod ext systémom licencie assetu (`getExtSystemByLicence(asset.licence)`; keď sa nedá
       zistiť, pod ext systémom stránky, aký bol pri zavretí);
    4. ak widget medzitým nezanikol a nie je `readonly`, každému riadku s `assetId` toho assetu, ktorý má
       `showDamAuthors`, nastaví `damAuthors` (vlastná kópia zoznamu), `texts.source` = mená oddelené čiarkou v poradí
       autorov assetu (bez neznámych a prázdnych mien, ako pri výbere z knižnice, `:352-358`) a `showDamAuthors: false`.
  - Zlyhanie čítania assetu alebo mien: riadok ostane, ako bol, a ukáže sa chyba (`showErrorsDefault`, inak
    „systémová chyba"), ako pri čítaní v `onEditAsset` a pri výbere z knižnice. Po zániku widgetu sa neukáže nič.
  - `saveImages` pred kontrolou formulára počká na toto čítanie, ak ešte beží (`:545-547`, `detailAssetRead`).

**Rozhodnutia.**
- **Číta sa pri každom zavretí** detailu otvoreného z riadku, ktorý asset ukazoval, nie len po uložení v detaile.
  Výnimka: keď žiadny riadok toho assetu výber autorov neponúka, nečíta sa nič (nie je čo zmeniť).
- **Číta sa asset, ktorý detail ukazoval,** nie asset riadku, ktorý ho otvoril: `onEditAsset` zapíše odpoveď do
  detailu, kedykoľvek príde, takže detail zavretý z načítavania a otvorený z iného riadku vie ukázať asset prvého.
  Uložilo sa to, čo detail ukazoval.
- **Riadky assetu sa hľadajú podľa `assetId`** (podľa neho uloženie galérie posiela autorov do DAM, `:557-559`).
  Riadok, ktorý výber ponúka, má `assetId` vždy (načítanie `:174-176`, výber z knižnice `:370-371`, upload
  `UploadQueueDialog.vue:186-187`).
- **Ktoré riadky výber ponúkajú, sa rozhodne pri zavretí,** pred prvým čakaním: `authorEnabled` ide podľa jedného
  ext systému pre celú stránku (`cachedExtSystemId`), ktorý otvorenie detailu iného assetu prepíše. Po čítaní sa
  preto riadok pozná už len podľa vlastného `showDamAuthors`.
- **Čo redaktor v riadku vybral pred otvorením detailu, ustúpi tomu, čo detail uložil:** `damAuthors` riadku sa
  nahradia autormi assetu. Platí to aj pre výber urobený medzi zavretím detailu a dobehnutím čítania.
- **Detail otvorený z dialógu fronty** kreslí ten istý `AssetDetailDialog` galérie (`showDetail`,
  `UploadQueueDialog.vue:201-213`, nastaví ten istý kľúč). `detailOfRow` nastavuje len `onEditAsset`, takže pri jeho
  zavretí sa nečíta nič, ani keď galéria riadok toho assetu má.
- **Uloženie galérie čaká na čítanie** (nad rámec znenia zadania, bez toho oprava (1) v tom okne neplatí): uloženie
  spustené medzi zavretím detailu a odpoveďou čítania by ešte poslalo autorov vybraných v riadku. Od cyklu 1 tým čaká
  aj na uloženie detailu, ktoré je ešte na ceste. Horná hranica čakania nie je jeden časový limit klienta, ale súčet
  požiadaviek za sebou (uloženie detailu, čítanie assetu, prípadne licencia a mená) za každé zaradené zavretie
  (posudok Opusa k cyklu; prijaté).
- **Prijaté medze po posudkoch cyklu 1** (nevedú k zlým dátam): príznak bežiaceho uloženia v sklade detailu nie je
  viazaný na asset, takže zavretie detailu B počká aj na ešte bežiace uloženie detailu A; keď v sklade detailu ostal
  asset z oneskorenej odpovede skoršieho otvorenia a čítanie ďalšieho riadku zlyhá, detail ukáže ten starší asset
  a po zavretí sa prečíta on (riadky dostanú pravdivých autorov vlastného assetu; zlé zobrazenie je starší stav).
  Bez prípadu v testoch: uloženie galérie spustené, kým je uloženie detailu podržané.

**Čo sa mení pre používateľa.** admin-cms, galéria (`AImageWidgetMultiple`), riadok, ktorý ponúka výber autorov DAM:
- po zavretí detailu assetu („upraviť asset"), v ktorom asset dostal autorov, riadok ukáže pole „Zdroj" s ich menami
  namiesto výberu autorov; platí pre všetky riadky toho assetu, ktoré výber ponúkali, aj keď redaktor detail zavrie
  hneď po stlačení „uložiť" (riadok sa zmení, až keď DAM uloženie potvrdí);
- autori vybraní v takom riadku pred otvorením detailu zmiznú (nahradia ich autori assetu);
- galéria je tým zmenená (zdroj obrázka sa do CMS zapíše pri jej uložení);
- uloženie galérie ani hromadné „vyplniť prázdne" potom autorov z detailu v DAM neprepíšu a obrázok sa neuloží
  s prázdnym zdrojom;
- keď asset autorov nemá, riadok ostane, ako bol (aj s tým, čo je v ňom vybrané);
- keď čítanie zlyhá, ukáže sa chyba toho čítania (hláška chyby API, inak „systémová chyba") a riadok ostane, ako bol.

Nemení sa: riadok, ktorý ukazuje pole „Zdroj" (nič sa nečíta, text je redaktorov), widget `readonly`, widgety jedného
obrázka, detail otvorený z dialógu fronty, detail zavretý z načítavania. admin-ugc: nič (autorov DAM nemá,
`authorEnabled` je `false`, nečíta sa).

**Na backend.** Pribudli čítania po zavretí detailu, ktorý otvoril riadok galérie a ukazoval asset, ktorého riadok
výber autorov ponúka: `GET {endPointAsset}/{id assetu}` (vždy; až po odpovedi na uloženie detailu, ak je na ceste)
a `GET {endPointAuthor}/ext-system/{ext systém}/search?id=…` (len keď asset autorov má). Ext systém licencie je po
`onEditAsset` v pamäti; keby nebol, ide ešte `GET` licencie assetu (`damAssetLicenceApi.ts:8-18`), ako pri
`onEditAsset`. Do DAM už nejde `PATCH …/metadata-bulk-update` s autormi riadku, ktorého asset autorov medzitým dostal
v detaile; do CMS ide zdroj obrázka = mená autorov assetu namiesto prázdneho zdroja.

**Obmedzenia.**
- **Po zlyhanom čítaní riadok výber autorov ponúka ďalej** a uloženie galérie zapíše do assetu to, čo je v ňom
  vybrané, aj cez autorov z detailu (rozhodnuté: riadok pri zlyhaní ostáva, ako bol; pripnuté testom).
- Mená autorov, ktoré DAM nevráti alebo sú prázdne, v zdroji chýbajú; keď nevráti žiadne, riadok má povinný prázdny
  „Zdroj" (rovnako ako riadok assetu s autormi vybraného z knižnice).
- Detail, ktorého uloženie DAM odmietne, sa po zavretí číta tiež (asset je bez zmeny, riadok ostane).

## FE-33 (119, 129): „uložiť a použiť" najprv prečíta nahraný riadok bez formulára

**Čo sa mení v kóde.**
- `UploadQueueDialog.vue`, `onSaveAndApply` (`:141-157`): po nastavení príznaku točenia a pred kontrolou formulára
  vyberie nahrané riadky bez formulára (`isUploadedWithoutForm`, `:85-87`: stav „nahraný", `canEditMetadata` nie je,
  má `assetId`) a každý prečíta `uploadQueuesStore.refreshAsset(assetId)`. Je to čítanie tlačidla „obnoviť" riadku
  (`uploadQueueBindings.ts:61`, `uploadQueuesStore.ts:282-284`, `uploadSettlement.ts:594-595`: asset s metadátami,
  hneď). Jeho upozornenia („stále sa nahráva", „obnovenie zlyhalo") sa tu nehlásia.
- Ak po čítaniach aspoň jeden z tých riadkov formulár má: upozornenie `upload.metadataJustLoaded`, príznak späť
  a koniec; neuloží sa nič a `apply` nejde. Ak nemá žiadny, pokračuje sa ako doteraz (kontrola, uloženie, `apply`).
- Bez riadku bez formulára sa nečíta nič a poradie požiadaviek je ako doteraz.
- `metadataToImageMap.ts:85-86`: `internal` obrázka je z odpovede uloženia, a keď odpoveď položku pre asset riadku
  nemá, z riadku (`mainFileInternal`, ktoré riadok bez formulára dostal z čítania assetu, `uploadSettle.ts:186-189`).
  Odpoveď, ktorá položku má, platí ako doteraz (aj keď hovorí `null`).
- Obyčajné „uložiť" sa nemení.

**Rozhodnutia.**
- **Rovnaké čítanie ako „obnoviť", bez jeho hlášok:** zadanie chce pri čítaní bez výsledku pokračovať „presne ako
  dnes", teda bez nového upozornenia. Zlyhanie čítania ide do zapisovača chýb API ako pri tlačidle (`report: true`,
  `uploadSettlement.ts:564-565`).
- **Asset sa číta raz za každý riadok bez formulára,** nie raz za asset: čítania idú za sebou jedným radom skladu
  a druhé čítanie toho istého assetu už riadky nemení.
- **Po čítaniach sa rozhoduje podľa riadkov, nie podľa výsledku čítania:** formulár vie riadku medzitým doniesť aj
  oneskorená notifikácia metadát.
- **Poradie:** čítanie je pred kontrolou formulára (zadanie). Chyba vo formulári sa preto ohlási až pri stlačení,
  ktoré nič nenačítalo.

**Čo sa mení pre používateľa.** admin-cms (notifikácie), dialóg fronty galérie, nahraný riadok s vypnutým formulárom
(notifikácia metadát sa stratila alebo mešká):
- „Uložiť a použiť" sa krátko točí, riadok dostane formulár s metadátami z DAM, ukáže sa upozornenie „Niektorým
  súborom sa práve načítali metadáta. Skontrolujte ich a uložte znova." a dialóg ostane otvorený; nič sa neuloží ani
  neodovzdá. Druhé stlačenie uloží všetky riadky a odovzdá obrázky s popisom a zdrojom;
- keď čítanie zlyhá alebo asset v DAM nie je, ide všetko ako doteraz: riadok sa neuloží a jeho obrázok príde bez
  popisu a zdroja (s poľom „Zdroj", FE-18), bez hlášky;
- kým čítanie beží, „uložiť" je vypnuté, „+" sivé a dropzóna súbory neberie (FE-27).

admin-ugc (bez notifikácií): riadok bez formulára nevzniká, nemení sa nič.

**Na backend.** Pred uložením pribudne `GET {endPointAsset}/{id assetu}` za každý nahraný riadok bez formulára. Keď
čítanie formulár donesie, pri prvom stlačení nejde `PATCH …/metadata-bulk-update`; pri druhom ide aj s tým riadkom
(doteraz sa jeho asset neuložil nikdy). Do CMS: obrázok riadku, ktorý ostal bez formulára, nesie `dam.internal` podľa
assetu (doteraz vždy `false`).

**Obmedzenia.**
- Čítanie, ktoré nájde súbor zlyhaný, riadok označí ako zlyhaný (ako „obnoviť"); taký riadok sa potom neodovzdá.
- Zavretie dialógu počas čítania uloženie nezastaví (ako doteraz zavretie počas uloženia): pošle sa po čítaní.
- Aplikácia s vlastným `customUploadMetadataToImageMap` (admin-ugc) si `internal` počíta sama; riadok `internal`
  sa týka mapy knižnice.

## FE-34 (124): vypnutá dropzóna sa pri ťahaní nerozsvieti

**Čo sa mení v kóde** (`AFileDropzone.vue`). Šablóna nastaví triedu `a-file-dropzone--disabled`, keď je `disabled`
(`:66`). Štýly, ktoré ju čakali (`&--over:not(&--disabled)`, `&--possibility:not(&--disabled)`, svetlá aj tmavá
téma), tým vypnutej zóne nedajú farbu ani obrys. Text vypnutej zóny (prázdny rámček) je skrytý tým istým pravidlom
ako pri `hideText` (`:150-153`).

**Čo existujúce štýly `--disabled` robia.** Len tie dve negácie: vypnutá zóna nedostane zvýraznenie pri ťahaní.
Vlastné pozadie zóny (`--bg`) ostáva, zobrazenie zóny `hoverOnly` pri ťahaní tiež (zóna dialógu teda pri ťahaní leží
nad dialógom a pustený súbor vezme a zahodí, ako po FE-27). Zóna, ktorá vypnutá nie je, triedu nemá a jej štýly sú
nezmenené.

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, dialóg fronty počas „uložiť" a „uložiť a použiť" (a počas
čítania z FE-33): pri ťahaní súboru nad dialógom sa plocha nerozsvieti a v strede nie je sivý štvorček prázdneho
textu. Inde sa `disabled` nepoužíva.

**Na backend.** Nič.

## FE-35 (127): „+" dialógu fronty je zastávka klávesu Tab

**Čo sa mení v kóde.** `UploadQueueDialog.vue:309-318`: z tlačidla „+" zmizlo `tabindex="-1"`.

**Čo som overil.** „+" je `VBtn` (natívne `button`); bez atribútu má `tabindex` len pri `loading` a `readonly`
(`vuetify/lib/components/VBtn/VBtn.js:184`), ktoré „+" nemá. Enter aj medzerník na ňom urobia klik, klik ide cez
`fileInputProps.onClick` na skrytý vstup (`AFileInput.vue:47-56`) a otvorí výber súboru. Vypnuté (`disabled` počas
uloženia) je natívne vypnuté tlačidlo a Tab ho preskočí. Žiadny test sa o poradie Tab neopieral (`tabindex` ani
kláves Tab sa v testoch `src` inde nevyskytuje, okrem vzorky v `iconButtonNames.test.ts:88`).

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, dialóg fronty: za „uložiť" je o jednu zastávku Tab viac („+"),
Enter alebo medzerník na nej otvorí výber súboru. Myšou sa nemení nič.

**Na backend.** Nič.

## Testy a prečo vedia zlyhať

Nové a prepísané prípady prvého tvaru kroku (+35; päť súborov, 165 prípadov, pred krokom 130 v štyroch). Prípady
FE-32 v teste galérie, ich čísla riadkov a riadky „galéria" v tabuľke ohybov sú z prvého tvaru; po cykle 1 platí časť
„Cyklus 1".

- `consumerProfileImageWidgetMultipleUpload.test.ts` (+15, 77 prípadov). `AssetDetailDialog` je v celom súbore
  skutočný, nekreslí sa len jeho rám (`AssetDetailDialogFrame`); detail sa zatvára udalosťou `close` rámu, teda
  skutočným `closeDialog`. Uloženie v detaile robí test tým, čo robí detail (`updateAssetMetadata`), a pravidlo
  `damKeepsAuthors` nechá DAM autorov z uloženia držať.
  - FE-32, obe aplikácie (`:1309`, `:1331`): riadok so zdrojom sa po zavretí detailu nečíta a nemení; detail otvorený
    z dialógu fronty nečíta nič (ani po tom, čo bol predtým otvorený a zavretý detail riadku galérie).
  - FE-32, admin-cms (`:1352-1614`): riadok prevezme autorov z detailu (jedno čítanie assetu podľa súboru, jedno
    čítanie mien, zdroj z mien, výber zmizne, uloženie galérie nepošle autorov a uloží zdroj); autori vybraní
    v riadku pred detailom ustúpia a do DAM ide len uloženie detailu; „vyplniť prázdne" po zavretí autorov detailu
    neprepíše; asset bez autorov nechá riadok aj jeho výber; všetky riadky toho assetu, ktoré výber ponúkajú, nie
    riadok so zdrojom a nie riadok iného assetu, každý s vlastným zoznamom; mená pod ext systémom licencie assetu
    (licencia iného ext systému, `cachedExtSystemId` medzitým prepísaný); zlyhané čítanie assetu a zlyhané čítanie
    mien: riadok ostane a ukáže sa chyba; uloženie galérie počká na čítanie; `readonly` pri zavretí nečíta
    a `readonly` počas čítania nič nezapíše.
  - FE-33 (`:747`): prvé stlačenie „uložiť a použiť" pri riadku bez metadát skončí upozornením, druhé odovzdá
    obrázok s popisom, zdrojom a autormi.
  - Prepísané s dôvodom: prípad „keeps an author saved meanwhile in the detail…" (pripínal starý stav, riadok bez
    zmeny po uložení v detaile) nahradili prípady vyššie; pomocník `secondWithoutItsMetadata` (`:719-745`) dostal
    predvolene nečitateľný asset druhého riadku, lebo dva staršie prípady (`:789`, `:824`) pripínajú odovzdanie riadku
    bez metadát a to dnes nastane, len keď čítanie formulár nedonesie.
- `consumerProfileUploadDialogActions.test.ts` (+9, 57 prípadov).
  - FE-33, admin-cms: riadok bez formulára sa prečíta raz, formulár príde, upozornenie, žiadne uloženie, žiadne
    `apply`, dialóg ostane, druhé stlačenie uloží oba riadky jednou požiadavkou a odovzdá ich; čítanie zlyhá (500)
    alebo asset nie je (404): odovzdanie ako doteraz, bez hlášky, `dam.internal` z riadku; druhé a tretie stlačenie
    počas podržaného čítania nespraví nič (jedno čítanie, jedno upozornenie, hostiteľ vie o uložení od prvého
    okamihu); čítanie je pred kontrolou formulára; „uložiť" nečíta nič a pošle len riadok s formulárom.
  - Bežná cesta, obe aplikácie (doplnené do staršieho prípadu `saves the rows that can be saved…`): požiadavky po
    stlačení sú presne `PATCH …/metadata-bulk-update` a v admin-cms dopyt na mená; žiadne čítanie assetu.
  - Nahradený s dôvodom: prípad „has the widget offer them for no image of a row uploaded without its metadata…"
    (jeden riadok bez formulára, DAM čitateľný) dnes skončí upozornením; jeho tvrdenie drží prípad so zlyhaným čítaním.
  - FE-35, obe aplikácie: skutočná klávesnica (`userEvent` z `vitest/browser`): Tab z „uložiť" zastane na „+",
    Enter aj medzerník otvoria výber súboru a vybraný súbor pribudne; počas podržaného uloženia Tab „+" preskočí.
- `metadataToImageMap.test.ts` (+3, 19 prípadov): riadok bez odpovede uloženia dá `internal` podľa riadku (áno, nie,
  nevie). Prípad `:199-216` sa nemenil (riadok v ňom `mainFileInternal` nemá, výsledok je `false` ako doteraz);
  prednosť odpovede pred riadkom držia staršie prípady „marks the image internal when the answer…".
- `AFileDropzone.test.ts` (nový, 8 prípadov, svetlá aj tmavá téma, skutočné štýly a udalosti ťahania): zapnutá zóna
  sa pri ťahaní rozsvieti a ukáže text; vypnutá má triedu, nemá obrys ani farbu, nekreslí text a pustený súbor
  nepustí ďalej; vypnutá nepriehľadná drží vlastné pozadie; po zapnutí má text aj zvýraznenie späť.
- `uploadQueueDialogSave.test.ts` (bez nových prípadov): test nahrádza modul skladu; do náhrady pribudlo
  `refreshAsset`, ktoré formulár nedonesie.

**Dôkaz** (v pamäti, `vitest.bend.config.mts`, snímok `OP3-L1`; skripty `scratchpad/op3l1-bend.sh`
a `op3l1-bend-rest.sh`, výpisy `scratchpad/op3l1-bend-*.log`, `op3l1-old.log`). Každý ohyb mení jedno miesto kódu po
kroku; „zlyhá" je počet prípadov v súboroch, ktoré sa ho týkajú.

| Ohyb | Zlyhá |
|---|---|
| štyri produkčné súbory zo snímku (pred krokom) | 24 / 165 |
| galéria: detail bez `@close` (po starom) | 11 |
| galéria: uloženie na čítanie nečaká | 1 |
| galéria: číta, keď výber ponúka hocijaký riadok | 1 |
| galéria: číta pri každom zavretí | 3 |
| galéria: číta aj `readonly` | 1 |
| galéria: zapíše aj po prepnutí na `readonly` počas čítania | 1 |
| galéria: prepíše aj riadok so zdrojom | 1 |
| galéria: prepíše aj riadky iných assetov | 1 |
| galéria: mená pod `cachedExtSystemId` | 1 |
| galéria: zlyhanie čítania bez hlášky | 2 |
| galéria: nechá autorov vybraných v riadku | 1 |
| galéria: riadky dostanú spoločné pole autorov | 1 |
| galéria: riadok ďalej ponúka výber | 6 |
| galéria: zdroj sa nenastaví | 6 |
| galéria: id súboru sa po zavretí nevynuluje | 1 |
| galéria: prevezme aj prázdny zoznam autorov | 1 |
| dialóg: nečíta nič (po starom) | 6 |
| dialóg: prečíta, ale nezastaví | 4 |
| dialóg: zastaví vždy, keď bol riadok bez formulára | 5 |
| dialóg: číta každý nahraný riadok | 38 |
| dialóg: číta aj zlyhané riadky | 2 |
| dialóg: kontrola formulára pred čítaním | 1 |
| dialóg: príznak točenia počas čítania vypnutý | 1 |
| dialóg: po upozornení sa tlačidlo točí ďalej | 4 |
| dialóg: zastaví bez upozornenia | 4 |
| dialóg: „+" s `tabindex="-1"` (po starom) | 2 |
| mapa: `internal` len z odpovede (po starom) | 3 |
| mapa: `internal` najprv z riadku | 3 |
| dropzóna: bez triedy (po starom) | 4 / 8 |
| dropzóna: trieda vždy | 4 / 8 |
| dropzóna: text vypnutej zóny sa kreslí | 4 / 8 |

Nepripnuté testom (rovnocenné v každom stave, ktorý sa dá vyrobiť): hľadanie riadkov podľa `assetId` oproti hľadaniu
podľa id súboru. Riadok, ktorý výber ponúka, má vždy hlavný súbor svojho assetu.

**Behy.** Cielené (`scratchpad/op3l1-run.sh step`): 5 súborov / 165 zelených; okolie (`op3l1-run.sh wide`:
`dam/uploadQueue`, `assetDetail`, `dam/__tests__`, `imageWidget`, `assetSelect`, `ui/file`,
`test/i18nLiteralKeys.test.ts`, `test/a11y`) 91 súborov / 2 008 zelených. `oxfmt`, `oxlint`, `eslint` na deviatich
súboroch a troch prekladoch, `stylelint` na dvoch čisté, `lint:tsc` 0 (`scratchpad/op3l1-lint.sh`).
**CK-LIB OP3-L1 zelená** (`vysledky/OP3-L1-ck.log`): `test:browser` 315 súborov / 4 465 testov (po OP2-L2-c2 314
/ 4 430, +1 súbor, +35), `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`,
`lint:stylelint` čisté.

## Texty na potvrdenie

Kľúč `common.damImage.upload.metadataJustLoaded` (upozornenie; vedľa `upload.onlyOneFile`):

- sk: „Niektorým súborom sa práve načítali metadáta. Skontrolujte ich a uložte znova."
- en: "The metadata of some files have just been loaded. Check them and save again."
- cs: „Některým souborům se právě načetla metadata. Zkontrolujte je a uložte znovu."

## Nové nálezy (nemenené)

- **Detail zavretý počas vlastného uloženia:** opravené v cykle 1 (bod 1).
- **Detail, ktorého prvé čítanie zlyhá, je prázdny dialóg, ktorý sa nedá zavrieť** (nález 132, zapísal vedúci; staršie,
  rovnako v dialógu fronty).
- **Asset, ktorý dostane autorov cez duplicitný upload, riadok galérie neobnoví** (nález 133, zapísal vedúci). Patrí
  sem aj detail otvorený z dialógu fronty nad assetom, ktorého riadok galéria má: pri jeho zavretí sa nečíta (zadanie).
- **Farby „súbor je nad zónou" sa nikdy neukážu** (nález 134). `AFileDropzone.vue:170-178` a `:192-200`: pravidlo
  `--possibility` nasleduje po `--over` s rovnakou váhou a zóna, nad ktorou súbor je, má vždy obe triedy. Zelené
  zvýraznenie je mŕtvy štýl; zóna je pri ťahaní modrá, či nad ňou súbor je, alebo nie (overené v prehliadači, test
  pripína dnešnú farbu).
- **`cachedExtSystemId` ostáva na ext systéme assetu, ktorého detail sa otvoril naposledy**
  (`ImageWidgetMultipleInner.vue:448-452`). Podľa neho sa potom riadi `authorEnabled` celej galérie, výber autorov
  v každom riadku aj mená pri uložení (`:560-567`). Pri galérii s obrázkami z licencií rôznych ext systémov tak
  riadok assetu jedného ext systému hľadá autorov v inom. Nepreverované na dátach, len z čítania kódu. Čítanie po
  zavretí detailu sa od cyklu 1 o tento stav po prvom čakaní neopiera.
- **Riadky toho istého assetu majú po načítaní spoločné pole `damAuthors`** (`:174`, pole z odpovede DAM bez kópie).
  Dnes neškodí (výber v riadku pole nahrádza, nemení).
- **`uploadQueueDialogSave.test.ts` nahrádza moduly** (sklad fronty, uloženie); doplnená doň len funkcia
  `refreshAsset` skladu.
- **`onEditAsset` zapíše odpoveď do detailu bez kontroly, či je ešte posledná** (staršie; cyklus 1 ho nemení, len
  číta to, čo detail ukazoval). Odpoveď, ktorá príde po zavretí detailu, ostane v sklade detailu.

## Cyklus 1 (OP3-L1-c1, 12. 10.; posudky bez nálezu vo FE-33, FE-34 a FE-35, päť bodov k FE-32)

Snímok `OP3-L1-c1`, záplata `zaplaty/OP3-L1-c1.diff` (7 súborov; mimo `src` a `doc` nič). Kód po cykle je popísaný
vyššie pri FE-32 (znenie po cykle).

1. **Detail zavretý počas vlastného uloženia** (môj nález 1; oba posudky: skutočný). Sklad detailu drží uloženie,
   ktoré je na ceste (`assetDetailStore.ts:24-42`, `saving` a `setSaving`; sľub nikdy nezlyhá a po odpovedi sa
   vynuluje), `onSave` detailu ho tam zapíše pri odoslaní (`AssetDetailSidebarMetadata.vue:72-75`) a čítanie galérie
   naň pred čítaním počká (`ImageWidgetMultipleInner.vue:492-493`). Sklad ani dialóg knižnica nevyváža.
2. **Číta sa to, čo detail ukazoval.** `AssetDetailDialog` pošle s `close` asset, ktorý ukazoval; sklad ho v tej
   chvíli už nemá (`closeDialog` ho vyprázdni pred udalosťou), preto ide s udalosťou. Z načítavania a bez assetu je to
   `null`: nečíta sa nič, a zmizlo tým aj druhé čítanie a druhá hláška pri detaile, ktorého prvé čítanie zlyhalo.
   `detailFileId` nahradil príznak `detailOfRow` (detail otvoril riadok galérie). Asset sa číta podľa svojho id
   (`GET {endPointAsset}/{id}`), nie podľa súboru riadku; riadky sa hľadajú podľa `assetId` pri rozhodovaní aj pri
   zápise. `onEditAsset` sa nemenil.
3. **Čítanie, ktoré dobehne po zániku widgetu, nezapíše nič** (`unmounted`, `:437-441`, `:499`) a neohlási chybu
   (`:516`; nad rámec bodu: hláška by vyskočila nad stránkou, na ktorú redaktor medzitým prešiel, ako pred FE-19).
4. **`offersAuthors` po čakaní: skutočné aj po bode 2.** `authorEnabled` číta `cachedExtSystemId`, ktorý otvorenie
   detailu iného assetu počas čítania prepíše; pri ext systéme bez autorov by riadky prvého assetu ostali bez zmeny
   s `showDamAuthors: true`. Opravené: o čítaní sa rozhodne pri zavretí (`:528-530`), po čakaní sa riadok pozná len
   podľa vlastného `showDamAuthors` (`:510`), a náhradný ext systém pre mená je ten spred čakania (`:532`, `:496`).
5. **Test:** prípad so zlyhaným čítaním končí uložením galérie (`save()` vráti `true`, do assetu ide to, čo je
   v riadku vybrané).

**Texty.** Changelog FE-32 prepísaný: zlyhanie sa ukáže ako ostatné zlyhané čítania widgetu (hláška chyby API alebo
„systémová chyba"); doplnené čakanie na uloženie detailu, asset, ktorý detail ukazoval, a detail zavretý z načítavania.
Obmedzenie po zlyhanom čítaní je vyššie pri FE-32.

**Testy** (+10; `consumerProfileImageWidgetMultipleUpload.test.ts` 83 prípadov, +6;
`consumerProfileAssetDetailSave.test.ts` 38, +4).
- Test galérie, časť „the detail of the asset of a row, once it has closed" (`:1255-1860`). Pomocník `editAssetOf`
  dá DAM vlastnú kópiu assetu (falošný DAM vracal ten istý objekt, aký držal detail, takže aj neuložená zmena
  v detaile bola „v DAM"); `withImages` skladá galériu podľa testu.
  - bod 1 (`:1628`): skutočný formulár detailu (`AssetDetailSidebarMetadata` s jeho „uložiť"), `PATCH` podržaný,
    detail zavretý hneď: kým DAM neodpovie, nečíta sa nič a riadok drží výber; po odpovedi riadok prevezme autorov
    z detailu a uloženie galérie do assetu nepíše;
  - bod 2 (`:1659`, `:1690`, `:1714`): detail zavretý z načítavania a otvorený z iného riadku ukáže asset prvého
    riadku (odpovede v opačnom poradí): číta sa a mení asset, ktorý detail ukazoval; detail zavretý z načítavania
    nečíta nič, ani keď v sklade ostal asset z oneskorenej odpovede; detail, ktorého čítanie zlyhalo, nečíta nič
    a chyba je ohlásená raz;
  - detail z dialógu fronty (`:1731`, prepísaný, len admin-cms): fronta má riadok toho istého assetu ako riadok
    galérie (kópia do licencie); po uložení v detaile a zavretí sa nečíta a riadok galérie ostane;
  - bod 4 (`:1766`): počas podržaného čítania sa otvorí detail assetu z ext systému bez autorov; riadok prvého assetu
    autorov aj tak prevezme, mená pod ext systémom jeho licencie;
  - bod 3 (`:1830`, dva prípady): widget zanikne počas podržaného čítania, nový widget tej istej entity si riadky
    načíta a redaktor v ňom vyberie autora; čítanie starého widgetu (nájde autorov, alebo zlyhá) nezmení nič
    a nič neohlási;
  - bod 5 (`:1561-1601`): po zlyhanom čítaní `save()` vráti `true` a zapíše autorov vybraných v riadku;
  - ostatné prípady prvého tvaru ostali, s čítaním podľa id assetu namiesto súboru.
- `consumerProfileAssetDetailSave.test.ts:172-203` (obe aplikácie, DAM odpovie alebo odmietne): kým je `PATCH`
  podržaný, sklad drží sľub uloženia; druhé stlačenie ho nevymení; ostane aj po zániku detailu; po odpovedi sa
  splní (aj pri odmietnutí) a sklad ho pustí.

**Dôkaz** (v pamäti; `scratchpad/op3l1c1-bend.sh`, `op3l1c1-bend-set.sh`, výpisy `op3l1c1-bend-*.log`,
`op3l1c1-old.log`; dva súbory, 121 prípadov).

| Ohyb | Zlyhá |
|---|---|
| štyri produkčné súbory zo snímku `OP3-L1-c1` (prvý tvar kroku) | 18 / 121 |
| sklad: uloženie sa nezapíše | 5 |
| sklad: uloženie sa po odpovedi nevynuluje | 5 |
| sklad: sľub pri odmietnutí zlyhá | 2 |
| detail: `onSave` uloženie skladu nepovie | 5 |
| dialóg: `shown` aj počas načítavania | 1 |
| dialóg: `shown` vždy `null` | 16 |
| galéria: na uloženie detailu nečaká | 1 |
| galéria: číta pri zavretí hocijakého detailu | 1 |
| galéria: príznak riadku sa po zavretí nevynuluje | 1 |
| galéria: rozhoduje bez `authorEnabled` | 1 |
| galéria: rozhoduje bez `readonly` | 1 |
| galéria: rozhoduje bez riadkov assetu | 1 |
| galéria: zapíše aj po zániku widgetu | 1 |
| galéria: chybu ohlási aj po zániku widgetu | 1 |
| galéria: zapíše aj po prepnutí na `readonly` | 1 |
| galéria: po čakaní sa pýta `authorEnabled` (prvý tvar) | 1 |
| galéria: prepíše aj riadky iných assetov | 2 |
| galéria: prepíše aj riadok so zdrojom | 1 |
| galéria: zlyhané čítanie vyhodí chybu ďalej | 2 |
| galéria: uloženie na čítanie nečaká | 1 |
| galéria: mená pod ext systémom stránky | 1 |
| galéria: zlyhanie čítania bez hlášky | 2 |
| galéria: nechá autorov vybraných v riadku | 2 |
| galéria: prevezme aj prázdny zoznam autorov | 2 |

Nepripnuté testom: náhradný ext systém pre mená, keď sa ext systém licencie nedá zistiť (ten spred čakania).

**Behy.** Cielené (`scratchpad/op3l1c1-run.sh step`): 2 súbory / 121 zelených; okolie (`op3l1c1-run.sh wide`) 91
súborov / 2 018 zelených; `oxfmt`, `oxlint`, `eslint` na šiestich súboroch čisté, `lint:tsc` 0. **CK-LIB OP3-L1-c1
zelená** (`vysledky/OP3-L1-c1-ck.log`): `test:browser` 315 súborov / 4 475 testov (po OP3-L1 4 465, +10),
`test:eslint` 7 / 82, ostatné čisté.
