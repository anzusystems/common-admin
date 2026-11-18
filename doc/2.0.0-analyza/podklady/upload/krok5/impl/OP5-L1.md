# OP5-L1: autori DAM v dialógu obrázka, detail po zániku hostiteľa, riadky jedného assetu v galérii, čítania bočného panela zoznamu assetov; nálezy 137, 136, 140, 139, 149, 138 (impl-lib-op5)

**Stav: po cykle 2, čaká na posudok.** Cielené testy a CK zelené po poslednej úprave `src` (CK-LIB OP5-L1-c2, 13. 10.).

Zadanie vedúceho (`overenie-nalezov.md`, „Šieste overenie", tabuľka „FE, knižnica (common-admin)"): FE-53 (137),
FE-54 (136), FE-55 (140), FE-56 (139), FE-57 (149), FE-58 (138), s rozhodnutiami vlastníka z 12. 10. Strom LIB
`/home/volar/projects/anzusystems/common-admin`, TMPDIR `node_modules/.cache/vitest-tmp-impl-lib-op5`. Snímok
**`OP5-L1`** (pred prvou úpravou, s `doc/changelog/2.0.0.md`), záplata `krok5-praca/zaplaty/OP5-L1.diff`
(17 súborov, 2 506 riadkov; mimo `src` a `doc` nič).

## Zmenené súbory

- `src/domains/dam/imageWidget/composables/imageDialogDamAuthors.ts` (**nový súbor**; FE-53, FE-54)
- `src/domains/dam/imageWidget/components/ImageWidgetInner.vue`,
  `src/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue`,
  `src/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue` (FE-53, FE-54)
- `src/domains/dam/assetDetail/components/AssetDetailDialog.vue` (FE-55)
- `src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue` (FE-56)
- `src/domains/dam/assetSelect/composables/assetSelectListActions.ts`,
  `src/domains/dam/assetSelect/components/AAssetListInner.vue`,
  `src/domains/dam/assetDetail/store/assetDetailStore.ts` (FE-57, FE-58)
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetLibrary.test.ts`
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetMultipleUpload.test.ts`
- `src/domains/dam/assetDetail/__tests__/consumerProfileAssetDetailOpen.test.ts`
- `src/domains/dam/assetSelect/__tests__/consumerProfileAssetListUpload.test.ts`
- `src/domains/dam/assetSelect/__tests__/assetSelectListActions.test.ts`
- `src/domains/dam/imageWidget/__tests__/damImageWidgetSites.test.ts`,
  `src/domains/dam/__tests__/damAuthorKeywordEndpoints.test.ts` (len úprava existujúcich prípadov)
- `doc/changelog/2.0.0.md` (päť odrážok v „Image widgets and asset select, uploads and picks.")

Žiadny súbor nezanikol. Knižnica nevyváža nič nové a nič z vyvážaného sa nemení (`src/lib.ts` bez zmeny):
`ImageDetailDialogMetadata`, sklad detailu, `AssetDetailDialog` ani `useAssetSelectActions` sa nevyvážajú; props, emity
a sloty `AImageWidgetInner`, `AImageMediaWidget`, `AImageWidgetMultipleInner` a `AAssetListInner` sú bez zmeny. Žiadny
nový ani zmenený text prekladu.

## FE-53 (137) a FE-54 (136): autori DAM v dialógu obrázka widgetov jedného obrázka

Znenie po cykle 1 (čakanie „potvrdiť" je v composable a patrí otvoreniu dialógu; čísla riadkov po cykle); pozri
„Cyklus 1".

**Čo sa mení v kóde.**
- Nový composable `imageDialogDamAuthors.ts` (`useImageDialogDamAuthors`, `:28-169`), spoločný pre oba widgety. Widget
  v ňom drží asset, ktorého autorov dialóg obrázka ponúka, **sám**: `held = { asset, file }` (`:39`), kde `file` je id
  súboru, pre ktorý widget asset prečítal (súbor obrázka, ktorý z toho výberu vyrobil). Nahrádza príznak
  `showDamAuthorsInCmsImage` widgetu aj čítanie `asset` zo skladu detailu assetu (sklad je jeden pre stránku).
  - `damAuthorsAsset` (`:53`): asset sa ponúka, len keď dialóg widgetu ukazuje obrázok, ktorého `dam.damId` je `file`
    (`imageOfHeld`, `:47-50`). „Dialóg ukazuje obrázok" hovorí widget funkciou `shownImage`: obrázok zo skladu dialógu
    (`imageMediaWidgetStore.detail`), kým je dialóg tohto widgetu otvorený (`metadataDialog`) alebo je formulár
    kreslený v stránke (`expandMetadata`) (`ImageWidgetInner.vue:224-239`, `ImageMediaWidgetInner.vue:235-250`).
  - `offerDamAuthorsOf(asset, file)` (`:55`): volá ho `pickAsset` na mieste, kde doteraz zapínal príznak a zapisoval
    asset do skladu stránky (asset bez autorov, ext systém má autorov, `assetMetadataMayStillChange` nie:
    `ImageWidgetInner.vue:534`, `ImageMediaWidgetInner.vue:661`).
  - `offerNoDamAuthors()` (`:59`): nový výber z knižnice (ako doteraz reset príznaku, `ImageWidgetInner.vue:487`,
    `ImageMediaWidgetInner.vue:552`), **použitie výsledku uploadu** (`onAssetUploadConfirm`, `:686` a `:841`; nové)
    a úspešné uloženie autorov do assetu pri „potvrdiť" (`:630`, `:773`; ako doteraz vypnutie príznaku).
  - `pickDamAuthors(authors)` (`:64`): výber v dialógu sa zapíše do `authors` držaného assetu.
  - `onAssetDetailClose(shown)` (`:145-157`) a `takeAuthorsOfDetailAsset` (`:77-104`): FE-54, pozri nižšie.
  - `holdConfirmForDetailAssetRead` (`:126-138`), `confirmWaits` (`:110`) a sledovanie `shownImage` (`:118`):
    čakanie „potvrdiť" na čítanie, pozri nižšie.
- `ImageDetailDialogMetadata.vue`: výber autorov kreslí podľa `showDamAuthors` samotného (`:152`, `:244`; doteraz
  `showDamAuthors && asset` zo skladu stránky), hodnotu berie z nového nepovinného propu `damAuthors` (`:39`) a zmenu
  posiela emitom `update:damAuthors` (`:56`, `:116-118`); `asset` zo skladu detailu už nečíta. „Zdroj" je povinný práve
  vtedy, keď sa výber nekreslí (`:78-80`, výraz bez zmeny: `!showDamAuthors`). `authorConflicts` číta zo skladu ako
  doteraz (`:66`).
- Widgety (`ImageWidgetInner.vue:973-974`, `:983`; `ImageMediaWidgetInner.vue:1162-1163`, `:1171`): dialógu dávajú
  `:show-dam-authors="!!damAuthorsAsset"`, `:dam-authors="damAuthorsAsset?.authors"` a počúvajú `update:dam-authors`.
  „Potvrdiť" (`ImageWidgetInner.vue:613-632`, `ImageMediaWidgetInner.vue:756-775`) ukladá autorov do
  `damAuthorsAsset` namiesto assetu skladu; požiadavky a hlášky sú tie isté.
- FE-54: `AssetDetailDialog` oboch widgetov má `@close="onAssetDetailClose"` (`ImageWidgetInner.vue:1015`,
  `ImageMediaWidgetInner.vue:1200`). Obsluha skončí bez čítania, keď detail neukazoval asset (`shown` je `null`:
  zavretý z loadera alebo sám po zlyhanom čítaní), keď widget nič nedrží, keď dialóg autorov neponúka, alebo keď je
  widget `readonly`. Inak si poznačí držaný asset, uloženie detailu na ceste (`assetDetailStore.saving`) a ext systém
  stránky a zaradí čítanie:
  1. počká na uloženie detailu, ktoré bolo pri zavretí na ceste;
  2. prečíta asset podľa id (`fetchAsset`); keď má autorov, prečíta ich mená pod ext systémom licencie assetu
     (`getExtSystemByLicence`; keď sa nedá zistiť, pod ext systémom stránky pri zavretí);
  3. nič nezapíše, keď widget medzitým zanikol, je `readonly`, alebo už drží asset iného výberu (nový výber, upload);
  4. asset bez autorov: držaný asset nahradí čerstvo prečítaným a ponechá mu, čo je v dialógu vybrané; výber ostáva;
  5. asset s autormi: prestane ho držať (výber zmizne, „Zdroj" sa ukáže a je povinný) a obrázku, ktorý dialóg práve
     ukazuje a pre ktorý bol asset čítaný, zapíše `texts.source` = mená oddelené čiarkou. Keď dialóg medzitým zavreli
     alebo ukazuje iný obrázok, obrázok sa nemení.
  - Zlyhanie čítania: `showErrorsDefault`, ako pri `onEditAsset` a pri výbere z knižnice; držaný asset ostane. Po
    zániku widgetu sa neukáže nič.
- „Potvrdiť" počas toho čítania (`holdConfirmForDetailAssetRead`; widgety `ImageWidgetInner.vue:607-610`,
  `ImageMediaWidgetInner.vue:750-753`, tlačidlo `:saving="metadataDialogSaving || confirmWaits"`): počká naň (tlačidlo
  sa točí), potom **potvrdenie prevezme formulár dialógu znova** (`detailDialogMetadataComponent.confirm()`), teda
  skontroluje sa nanovo podľa toho, čo dialóg po čítaní ukazuje. Ďalšie stlačenie počas čakania, a stlačenie počas
  bežiaceho uloženia dialógu, sa neberie. **Čakajúce potvrdenie patrí otvoreniu dialógu, v ktorom ho stlačili**
  (cyklus 1): keď sa dialóg zavrie alebo jeho formulár dostane obrázok nanovo (nové „upraviť metadáta", nový výber,
  upload), čakajúce potvrdenie zanikne a tlačidlo sa prestane točiť.

**Rozhodnutia.**
- **Identita „asset patrí obrázku" je súbor, pre ktorý ho widget prečítal,** nie `asset.mainFile.id`. Obrázok dostáva
  `dam.damId` zo záznamu zoznamu (`AssetSearchListItemDto.mainFile.id`), asset sa číta podľa id toho záznamu
  (`fetchAsset`). V reálnych dátach je to to isté, čo navrhol overovateľ (`asset.mainFile.id === image.dam.damId`);
  rozdiel je len pri assete, ktorému sa hlavný súbor medzi výpisom a čítaním zmenil (dnes sa výber ponúkol, ostáva),
  a existujúce testy s assetom bez `mainFile` netreba meniť.
- **Zavretie dialógu ani „upraviť metadáta" držaný asset neruší** (overovateľ navrhoval rušiť): zadanie chce, aby
  obrázok uložený bez autora výber pri ďalšom „upraviť metadáta" ponúkol znova. O ponuke rozhoduje identita pri
  kreslení. Asset ruší nový výber, výsledok uploadu a uloženie autorov.
- **Číta sa len, keď dialóg autorov ponúka** (ako galéria: riadok so zdrojom sa nečíta, text je redaktorov).
- **Čo redaktor vybral v dialógu pred otvorením detailu:** pri assete s autormi ustúpi (ako v galérii), pri assete bez
  autorov ostane vybrané (zadanie: „výber ostáva, nad čerstvo prečítaným assetom").
- **Asset s autormi sa prestane držať aj vtedy, keď sa obrázok nemení** (dialóg zavretý alebo s iným obrázkom):
  inak by ďalšie „upraviť metadáta" ponúklo výber nad starým stavom assetu a „potvrdiť" by autorov z detailu prepísalo.
  Zadanie hovorí „nezapísať nič"; platí pre obrázok, vnútorný stav widgetu sa zosúladí s tým, čo o assete vie.
- **„Potvrdiť" čaká na čítanie** (galéria tak drží svoje uloženie): bez toho by potvrdenie v tom okne zapísalo autorov
  vybraných v dialógu cez autorov z detailu, alebo uložilo obrázok bez zdroja. Kontrola formulára prebehne až po
  čítaní, lebo povinnosť „Zdroja" sa ním mení.
- **Odpoveď čítania platí aj pre neskoršie otvorenie dialógu TOHO ISTÉHO obrázka** (cyklus 1, rozhodnutie vedúceho):
  ten istý obrázok, ten istý asset; zdroj dostane mená a výber zmizne. Čakajúce potvrdenie sa naň neprenáša: dialóg
  otvorený neskôr sa bez nového stlačenia nepotvrdí.
- **Mená po čítaní pod ext systémom licencie assetu** (ako FE-32); „potvrdiť" hľadá mená ako doteraz pod ext systémom
  skladu výberu (`requireSelectedSelectConfig`), nemenené.
- Spoločný composable namiesto dvoch kópií v dvoch widgetoch: nový kód je jeden, ohyby a testy platia pre oba.

**Čo sa mení pre používateľa.** admin-cms, `AImageWidget` a `AImageMediaWidget` (admin-ugc autorov DAM nemá: bez
zmeny, pripnuté testom).
- Dialóg obrázka ukáže výber autorov DAM len nad assetom, ktorý widget sám prečítal pre zobrazený obrázok:
  - cesta A (existujúci obrázok, „nahradiť z DAM" asset bez autorov, zavrieť krížikom, „upraviť metadáta"): dialóg
    ukáže pôvodný obrázok s jeho „Zdrojom" (povinným), bez výberu; potvrdenie nezapíše nič do žiadneho assetu;
  - cesta B (dva widgety): autori vybraní v druhom widgete sa v dialógu prvého neukážu; potvrdenie prvého bez zmeny
    nemení jeho zdroj a neukladá žiadny asset;
  - obrázok z uploadu použitý po výbere assetu bez autorov má „Zdroj", nie výber;
  - obrázok uložený bez autora výber pri „upraviť metadáta" ponúkne znova a vybraní autori sa uložia do jeho assetu
    (ako doteraz).
- Po „upraviť asset" v dialógu obrázka a zavretí detailu:
  - asset má autorov: v dialógu sa namiesto výberu ukáže „Zdroj" vyplnený ich menami, povinný; čo bolo vybrané, zmizne;
  - asset autorov nemá: výber ostane, aj s tým, čo je v ňom vybrané (doteraz zmizol a ostalo prázdne nepovinné pole
    „Zdroj"; obrázok sa dal uložiť bez zdroja, hoci asset autora mal);
  - detail zavretý z loadera alebo taký, čo sa zavrel sám po zlyhanom čítaní: výber ostane (doteraz zmizol: medza
    z OP4-L1 „jedna cesta je po kroku horšia" tým zaniká);
  - čítanie zlyhá: chybová hláška ako pri iných čítaniach widgetu, dialóg ostane, ako bol;
  - „potvrdiť" stlačené, kým čítanie beží: tlačidlo sa točí, uloží sa až po čítaní (so zdrojom z mien autorov), alebo
    sa ukáže „opravte chyby formulára", keď po čítaní ostal povinný „Zdroj" prázdny.

**Na backend.** Po zavretí detailu otvoreného z dialógu obrázka, ktorý autorov ponúka: `GET {endPointAsset}/{id assetu}`
(vždy; po odpovedi na uloženie detailu, ak je na ceste) a `GET {endPointAuthor}/ext-system/{ext systém}/search?id=…`
(len keď asset autorov má). Ubudlo: `PATCH …/metadata-bulk-update` s autormi cudzieho assetu (cesty A a B) a s autormi
vybranými v dialógu cez autorov, ktorých asset medzitým dostal v detaile. Do CMS ide zdroj obrázka = mená autorov
assetu namiesto prázdneho zdroja (FE-54) a zdroj obrázka sa už neprepisuje menami autorov cudzieho assetu (FE-53).

**Obmedzenia.**
- Existujúci obrázok **toho istého súboru**, aký má asset vybraný a zavretý bez uloženia, dostane pri „upraviť
  metadáta" výber autorov (asset je naozaj jeho; `Zdroj` obrázka sa pri výbere autora prepíše menami). Identita je
  súbor, nie história widgetu.
- Držaný asset sa pri „upraviť metadáta" nečíta znova: autori, ktorých asset dostal inde (iná karta, galéria tej istej
  stránky), sa widget nedozvie; výber ponúkne a „potvrdiť" s výberom ich v DAM nahradí (ako doteraz).
- Po ZLYHANOM čítaní si dialóg výber nechá a „potvrdiť" zapíše, čo je v ňom vybrané, aj cez autorov z detailu (ako
  galéria, FE-32).
- Keď dialóg obrázka zavrú skôr, než čítanie odpovie, a asset autorov má: obrázok widgetu sa nemení (zdroj ostane,
  aký bol uložený) a výber sa už neponúkne; zdroj treba dopísať ručne.
- Mená, ktoré DAM nevráti, v zdroji chýbajú; keď nevráti žiadne, „Zdroj" je prázdny a povinný.
- Čakanie „potvrdiť" nemá jeden časový limit: je to súčet požiadaviek za sebou (uloženie detailu, asset, mená).
- Príznak uloženia detailu na ceste nie je viazaný na asset (medza FE-32, platí aj tu).
- Výber autorov nad obrázkom kresleným v stránke (`expandMetadata`) platí, kým sklad dialógu drží obrázok toho
  súboru; sklad dialógu je jeden pre stránku (`imageMediaWidgetStore`), dva formuláre v stránke naraz sa nepodporujú
  (ako doteraz, komentár propu).

## FE-55 (140): detail assetu zanikne so svojím hostiteľom

**Čo sa mení v kóde.** `AssetDetailDialog.vue:52-65`: sledovanie, ktoré hostiteľovi posiela `close`, má meno
(`stopTellingHost`), a `onBeforeUnmount` ho najprv zastaví a potom, keď je `dialog` skladu ešte kľúčom tohto dialógu,
zavolá `close()` skladu. Tým sa vzdá aj čítania na ceste (počítadlo `turn`). Pravidlá udalosti `close` z OP4-L1-c1
sú bez zmeny (sledovanie, `closeDialog` a `shownAtClose` sa nemenili).

**Rozhodnutia.**
- **`onBeforeUnmount`, nie `onUnmounted`:** pri výmene stránky Vue starý strom odpája skôr, než pripojí nový;
  sklad je tak zavretý skôr, než nový hostiteľ s tým istým kľúčom prvýkrát kreslí. V `onUnmounted` (až po
  vykreslení) by nový hostiteľ detail na okamih nakreslil a dostal `close`.
- **Hostiteľ, ktorý zaniká, `close` nedostane:** sledovanie sa zastaví pred zavretím skladu (v `onBeforeUnmount`
  ešte beží).
- **Odpojenie po zavretí skladu alebo po nahradení kľúčom iného hostiteľa nerobí nič** (podmienka na kľúč).

**Čo sa mení pre používateľa.** admin-ugc: po odchode zo zoznamu assetov s otvoreným detailom a návrate (Späť) sa nad
zoznamom nič neotvorí (doteraz prázdny dialóg bez tlačidla, pomohlo len obnovenie). admin-cms: nad ďalším formulárom
sa neotvorí detail assetu z predošlého. Platí pre všetkých hostiteľov: riadok galérie, dialóg obrázka oboch widgetov
jedného obrázka, riadok dialógu fronty, bočný panel zoznamu assetov.

**Na backend.** Nič (čítanie na ceste dobehne, jeho odpoveď sa nevezme).

**Obmedzenia.**
- Hostiteľ, ktorý je **znovu vytvorený** počas otvoreného detailu (rodič ho prekreslí pod iným kľúčom), o detail
  príde: doteraz ho nová inštancia nakreslila znova. Neuložené zmeny v detaile sú preč. V admin-cms ani admin-ugc
  som takú cestu nenašiel (na widgetoch obrázka nie je `:key`, `KeepAlive` je len na lište akcií; rodičov widgetov
  som po jednom neprechádzal).
- Hostiteľ, ktorý dialóg prestane kresliť bez vlastného zániku, kým je detail otvorený (zoznam assetov, ktorému
  zmizne `extId`: `AAssetListInner.vue:414`), sa o zavretí nedozvie (`close` nepríde, bočný panel sa neprečíta). Cez
  rozhranie nedosiahnuteľné: detail prekrýva stránku.
- Zlyhanie čítania, ktorého sa detail vzdal zánikom hostiteľa, sa ohlási ako doteraz (hostiteľ ho hlási sám).

## FE-56 (139): riadky jedného assetu v uložení galérie

**Čo sa mení v kóde.** `ImageWidgetMultipleInner.vue`, `saveImages`:
- `:574-592`: riadky, ktoré výber ponúkajú (`showDamAuthors` a `authorEnabled` stránky), sa zoskupia podľa
  `assetId`; autori skupiny sú zjednotenie výberov jej riadkov v poradí prvého výskytu, bez opakovania.
- `:593-610`: za skupinu s aspoň jedným autorom jeden záznam do zápisu autorov (`{ id, authors }`) a jedno
  čítanie mien; skupina bez autorov sa preskočí (nič sa neposiela, ako doteraz). **Až po úspešnom zápise autorov**
  dostane každý riadok skupiny vlastnú kópiu zoznamu (`damAuthors`) a zdroj z mien. Riadky, ktoré výber neponúkajú,
  v skupine nie sú.
- `:611`, `:632-648`: po uložení obrázkov sa každý obrázok odpovede spáruje s riadkom, ktorý sa poslal, podľa
  súboru a **po jednom v poradí odoslania** (`sentRows`, riadok sa po spárovaní vyberie); `getUpdatedItem` je
  synchrónna (poradie spárovania je poradie odpovede). Výrazy pre `damAuthors`, `showDamAuthors` a `assetId` sú tie
  isté ako doteraz, len z vlastného riadku.

**Rozhodnutia.**
- **Rôzne výbery v riadkoch jedného assetu sa spoja** (rozhodnutie vlastníka): poradie prvého výskytu zhora nadol.
- **Riadky sa menia až po odpovedi DAM na zápis autorov.** Doteraz sa zdroj riadku s výberom prepísal menami už pred
  zápisom (v skrytom poli); keby sa tak menili aj `damAuthors` súrodencov, po odmietnutom zápise by výber druhého
  riadku ukazoval autorov vybraných v prvom. Po zlyhaní zápisu je teda každý riadok taký, ako ho redaktor nechal.
- **Párovanie po uložení podľa súboru a poradia,** nie podľa indexu: odpoveď oboch aplikácií má poradie odoslania
  (`core-cms` `ImageFacade::multiUpdate:69-91`, admin-ugc `imageWidgetMappings.ts:106-131`), a keby ho backend
  nedodržal, riadky rôznych súborov sa nepomiešajú.
- **Riadok bez `assetId`, ktorý by výber ponúkal** (dnes nenastane: `:174-176`, `:370-371`,
  `UploadQueueDialog.vue:186-187`), je skupinou sám pre seba (kľúč riadku): zdroj z mien, bez zápisu, ako doteraz.
- Mená sa čítajú pod ext systémom stránky ako doteraz (`cachedExtSystemId`), raz za asset.

**Čo sa mení pre používateľa.** admin-cms, galéria, dva a viac riadkov toho istého assetu bez autorov (entita má
obrázok dvakrát, dvakrát „pridať z DAM", duplikát z fronty bez autora):
- autor vybraný v ktoromkoľvek z nich: asset ho dostane raz, **všetky** tieto riadky sa uložia so zdrojom z mien
  a po uložení ukazujú „Zdroj", výber už neponúkajú (doteraz: riadok bez výberu sa uložil so svojím starým alebo
  prázdnym zdrojom a po uložení mal prázdne povinné „Zdroj", alebo oba riadky znova ponúkali prázdny výber);
- rôzni autori v dvoch riadkoch: asset dostane všetkých (doteraz dva zápisy v jednej požiadavke, platil posledný);
- riadok toho assetu, ktorý ukazuje „Zdroj", sa nemení; po uložení si každý riadok nechá výber alebo „Zdroj", aký mal
  (doteraz ho prebral od prvého riadku toho súboru);
- keď DAM zápis autorov odmietne, riadky ostanú, ako boli (výber v tom riadku, kde ho redaktor urobil).
admin-ugc: nič (autorov DAM nemá).

**Na backend.** `PATCH …/metadata-bulk-update`: jeden záznam na asset so zjednotenými autormi (doteraz záznam za každý
riadok s výberom, pri rôznych výberoch dva s tým istým `id`). `GET` mien raz za asset (doteraz raz za riadok
s výberom). Do CMS idú všetky riadky assetu, ktoré výber ponúkali, so zdrojom z mien.

**Obmedzenia.**
- Riadky toho istého súboru sa po uložení párujú v poradí odoslania; backend, ktorý by poradie obrázkov toho istého
  súboru v odpovedi vymenil, by medzi nimi vymenil aj výber a „Zdroj".
- Keď zápis autorov prejde a uloženie obrázkov zlyhá, riadky už majú autorov a zdroj z mien a výber ďalej kreslia
  (s tými autormi); ďalšie uloženie pošle to isté znova.
- Pravidlá FE-18, FE-26, FE-32 a FE-40 sú bez zmeny (ich testy prechádzajú nezmenené).

## FE-57 (149) a FE-58 (138): čítania bočného panela zoznamu assetov

**Čo sa mení v kóde.**
- `assetSelectListActions.ts:140-163`, nová akcia **`readActiveItemAgain`**: čítanie assetu aktívnej dlaždice po
  zavretí detailu (presunuté z `AAssetListInner.vue`). Berie si číslo z toho istého počítadla ako klik
  (`detailRequest`, `:29`, `:150`); odpoveď sa zapíše, len keď je to posledné čítanie (`:156`), a načítavanie panela
  vypína len posledné čítanie (`:161`). Zápis ide ďalej cez `readBesideDetail` skladu (neprepíše otvorený detail).
- `assetDetailStore.ts:74-87`, `readBesideDetail(read, wanted?)`: nový nepovinný druhý argument; odpoveď sa nevezme,
  keď `wanted()` vráti `false`.
- `AAssetListInner.vue:177`: `onCloseEditDialog` volá `readActiveItemAgain()`; import `fetchAsset` a `endPointAsset`
  odišli.
- FE-58, `assetSelectListActions.ts:174-182`: `reset()` zvýši `detailRequest` a vypne `detailLoading`.
- Cyklus 1 a 2, `assetSelectListActions.ts:112-115` a `:121-123`: ext systém stránky (`cachedExtSystemId`) zapíše
  klik hneď, a odpoveď jeho čítania (ak je to stále posledné čítanie) ešte raz, ako pred krokom; pozri „Cyklus 1",
  bod 1, a „Cyklus 2".

**Rozhodnutia.**
- **Zlyhanie čítania po zavretí detailu sa hlási vždy,** ako doteraz, aj keď ho medzitým predbehol klik (zlyhanie
  kliku, ktorý už nie je posledný, sa nehlási, tiež ako doteraz). Zadanie hovorí len o zápise a o načítavaní.
- **„149b" som nepridal a samo nevypadlo:** odpoveď kliku sa zapisuje priamo (`:132`, `setAsset`), mimo
  `readBesideDetail`; detail riadku fronty otvorený počas čítania kliku ňou ostáva prepísateľný.
- Po `reset()` sa zlyhanie vzdaného čítania kliku nehlási (vypadáva z počítadla, ako zlyhanie predbehnutého kliku).

**Čo sa mení pre používateľa.** admin-ugc, zoznam assetov: po zavretí detailu assetu A a rýchlom kliku na dlaždicu B
panel ukáže B v ktoromkoľvek poradí odpovedí, a načítava, kým nepríde odpoveď B (doteraz mohol ukazovať A pri
zvýraznenej B a prestať načítavať pri prvej odpovedi). Po odchode zo zoznamu (alebo zavretí výberu assetov) s čítaním
kliku na ceste: panel ďalšieho zoznamu alebo výberu nenačítava a neukáže asset, ktorý nikto nevybral.

**Na backend.** Tie isté čítania.

**Obmedzenia.** Čítanie po zavretí detailu, ktoré odpovie po `reset()`, sa nezapíše (počítadlo), ale jeho zlyhanie
sa ohlási (ako doteraz).

## Testy a prečo vedia zlyhať

Prvý tvar kroku; čísla riadkov testov v tejto časti a čakanie „potvrdiť" v tabuľke ohybov sú spred cyklu 1 (súbor testu
knižnice je po cykle dlhší). Čo pribudlo a čo sa prepísalo, je v časti „Cyklus 1".

+95 prípadov v piatich súboroch (336 prípadov; pred krokom 241): `consumerProfileImageWidgetLibrary.test.ts` 97
(+56), `consumerProfileImageWidgetMultipleUpload.test.ts` 98 (+9), `consumerProfileAssetDetailOpen.test.ts` 92 (+20),
`consumerProfileAssetListUpload.test.ts` 33 (+4), `assetSelectListActions.test.ts` 11 (+6). Skutočné komponenty,
falošný je len DAM a backend obrázkov; tvrdenia cez DOM a požiadavky.

- **FE-53, FE-54** (`consumerProfileImageWidgetLibrary.test.ts:925-1839`, nový blok): oba widgety jedného obrázka
  (`describe.each`), obe aplikácie; skutočný dialóg obrázka a skutočný `AssetDetailDialog` (nekreslí sa len to, čo
  rámuje); výber z knižnice a dialóg uploadu sú náhrady, ktoré odpovedajú ako skutočné. DAM odpovedá na každé čítanie
  assetu kópiou (to, čo stránka s odpoveďou urobí, nie je stav DAM). admin-cms, 26 prípadov na widget:
  - FE-53 (`:1219-1411`, 8): cesta A (obrázok widgetu po zavretom výbere má svoj povinný „Zdroj", bez výberu, potvrdenie
    nezapíše nič do assetu); cesta B (dva widgety, skutočné výbery a uloženia: dialóg prvého ukáže vlastný prázdny
    výber, potvrdenie bez zmeny nechá zdroj a neuloží asset); asset ponechaný v sklade stránky sa neponúkne
    a vyprázdnenie skladu výber nezruší; obrázok uložený bez autora výber ponúkne znova a vybraní autori idú do jeho
    assetu (presné telo `PATCH`); obrázok uploadu po výbere (ten istý súbor) má „Zdroj"; asset vybraný ako posledný;
    formulár v stránke (`expandMetadata`) ponúka výber aj po uložení bez autora; asset vybraný znova, keď už autorov má.
  - FE-54 (`:1413-1812`, 18): autori z detailu sa stanú zdrojom, výber zmizne, „Zdroj" je povinný, jedno čítanie assetu
    a jedno čítanie mien, uloženie obrázka bez zápisu do assetu; výber v dialógu spred detailu ustúpi; asset bez autorov:
    výber ostane aj s vybraným a „potvrdiť" ho uloží; čaká sa na uloženie detailu na ceste (skutočný formulár
    detailu); mená pod ext systémom licencie assetu; zlyhá čítanie assetu / mien: hláška raz, dialóg ako predtým;
    „potvrdiť" počas čítania čaká (točí sa, druhé stlačenie sa nevezme), obrázok sa uloží so zdrojom z čítania; keď
    čítanie nechá zdroj prázdny, po čakaní príde „opravte chyby"; dialóg zavretý pred odpoveďou (nič sa nezapíše, výber
    sa už neponúkne); dialóg ukazuje obrázok widgetu iného súboru; dialóg ukazuje obrázok iného výberu; widget zanikol
    (odpoveď aj zlyhanie: nič sa nezapíše ani nepovie); widget `readonly`; detail otvorený nad obrázkom widgetu so
    „Zdrojom", kým widget drží asset zavretého výberu (nečíta sa); detail zavretý z loadera (nečíta sa, výber ostane);
    detail, ktorý sa zavrel sám (nečíta sa, výber ostane).
  - obe aplikácie (`:1815-1837`, 1 na widget a aplikáciu): dialóg so „Zdrojom" sa po „upraviť asset" nečíta a nemení.
- **FE-55** (`consumerProfileAssetDetailOpen.test.ts`): štyria hostitelia, obe aplikácie (`:479-530`, 2 na hostiteľa):
  hostiteľ zanikne s otvoreným detailom → sklad zavretý, ten istý hostiteľ pripojený znova nič nekreslí, „upraviť asset"
  je dosiahnuteľné a detail otvorí; hostiteľ zanikne počas čítania → odpoveď sa nevezme, ext systém stránky sa nezmení.
  Dialóg samotný (`:823-877`, 4): zavrie sklad a hostiteľovi nič nepošle; vzdá sa čítania; po vlastnom zavretí a po
  nahradení kľúčom iného hostiteľa nechá detail toho hostiteľa otvorený. Zoznam assetov, admin-ugc
  (`consumerProfileAssetListUpload.test.ts:728-747`, 1): zoznam pripojený znova detail nekreslí.
- **FE-56** (`consumerProfileImageWidgetMultipleUpload.test.ts:1404-1625`, admin-cms, 9): autor vybraný v prvom / druhom
  z dvoch riadkov assetu (jeden zápis, jedno čítanie mien, oba riadky so zdrojom, po uložení ani jeden neponúka výber,
  každý má vlastný zoznam); rôzne výbery v troch riadkoch (zjednotenie v poradí, raz); riadok so „Zdrojom" a riadok
  iného assetu sa nemenia; DAM zápis odmietne (riadky ostanú, ako boli); nič vybrané (nič sa neposiela, riadky ďalej
  ponúkajú); stránka výber nekreslí (nič sa neposiela); po uložení si každý riadok nechá svoje (dve poradia).
- **FE-57, FE-58** (`consumerProfileAssetListUpload.test.ts:651-726`, admin-ugc, 3; skutočné dlaždice a dialóg detailu):
  zavretie detailu A a klik na B v oboch poradiach odpovedí (panel ukáže B, načítava do odpovede B, zvýraznená je B);
  zoznam zanikne s čítaním kliku na ceste a pripojí sa znova (panel nenačítava a neukáže asset). `assetSelectListActions.test.ts:125-222` (6; akcie s falošným API): `reset()` sa vzdá čítania a vypne
  načítavanie; čítanie po zavretí a klik po ňom / pred ním v oboch poradiach; čítanie po zavretí samotné.

**Upravené existujúce prípady** (sedem; pripínali starý mechanizmus, tvrdenia o požiadavkách sa nemenili):
- `consumerProfileImageWidgetLibrary.test.ts:562` („without an author: the dialog offers the authors…"): tvrdenie, že
  sklad detailu drží vybraný asset, je teraz opačné (sklad ostáva prázdny); výber, telo `PATCH`, poradie a zdroj bez zmeny.
- `damImageWidgetSites.test.ts:369` (štyri prípady „are offered where…"): výber autora test zapisoval priamo do assetu
  skladu („ako dialóg"); teraz ho pošle náhrada dialógu emitom `update:damAuthors`, pribudlo tvrdenie, že sklad je
  prázdny a že dialóg vybraných autorov dostane v prope.
- `damAuthorKeywordEndpoints.test.ts:329` (dva prípady „the authors of a picked asset, and those added…"): to isté.
- Bez zmeny správania: `consumerProfileAssetListUpload.test.ts` (`mountWithPickedAsset` berie nastavenie z konštanty),
  `consumerProfileAssetDetailOpen.test.ts` (nepovinné `mountAgain` hostiteľa).

**Dôkaz** (v pamäti, `vitest.bend.config.mts` v TMPDIR, snímok `OP5-L1`; skripty `scratchpad/op5l1-bend.sh`,
`op5l1-bends.py`, `op5l1-bend-set.sh`, výpisy `scratchpad/op5l1-old.log`, `op5l1-bend-*.log`). „Zlyhá" je počet
prípadov v súboroch, nad ktorými ohyb bežal.

Osem produkčných súborov zo snímku (pred krokom) nad ôsmimi súbormi testov: **84 / 401**. Z 95 nových prípadov je
červených 77 (knižnica 42 / 56, galéria 7 / 9, detail 18 / 20, zoznam 4 / 4, akcie 6 / 6), a sedem upravených
existujúcich. Nad snímkom prechádza 18 nových prípadov, ktoré pripínajú, čo sa nemá zmeniť: obrázok uložený bez autora
výber ponúkne znova, asset vybraný ako posledný, asset vybraný znova, formulár v stránke, dialóg so „Zdrojom" sa
nečíta (dva tvary), galéria bez výberu a bez kreslenia výberu, dialóg detailu nezavrie detail iného hostiteľa.

| Ohyb | Zlyhá |
|---|---|
| FE-53: výber sa ponúkne s ktorýmkoľvek obrázkom (bez identity súboru) | 6 / 97 |
| FE-53: upload asset neruší (widget obrázka / obrázka a média) | 1 / 97, 1 / 97 |
| FE-53: nový výber asset neruší (dva widgety) | 1 / 97, 1 / 97 |
| FE-53: dialóg „Zdroj" nikdy nevyžaduje | 6 / 97 |
| FE-53: dialóg vybraných autorov neodovzdá | 35 / 113 |
| FE-53: po uložení autorov sa výber ponúka ďalej | 2 / 97 |
| FE-53: formulár v stránke výber neponúka | 1 / 139 |
| FE-54: pri zavretí detailu sa nečíta | 30 / 97 |
| FE-54: číta sa pri každom zavretí (aj z loadera) | 4 / 97 |
| FE-54: číta sa pre ktorýkoľvek držaný asset | 2 / 97 |
| FE-54: nečaká sa na uloženie detailu | 2 / 97 |
| FE-54: asset s autormi sa drží ďalej | 14 / 97 |
| FE-54: zdroj sa nezapíše | 10 / 97 |
| FE-54: vybrané sa pri assete bez autorov stratí | 2 / 97 |
| FE-54: zápis po zániku widgetu | 2 / 97 |
| FE-54: hláška po zániku widgetu | 2 / 97 |
| FE-54: zlyhanie bez hlášky | 4 / 97 |
| FE-54: zápis pri `readonly` | 2 / 97 |
| FE-54: zápis cez iný výber | 2 / 97 |
| FE-54: zápis do ktoréhokoľvek zobrazeného obrázka | 2 / 97 |
| FE-54: mená pod ext systémom stránky | 2 / 97 |
| FE-54: widget `close` detailu nepočúva (dva widgety) | 15 / 97, 15 / 97 |
| FE-54: „potvrdiť" nečaká (dva widgety) | 2 / 97, 2 / 97 |
| FE-54: po čakaní sa formulár nekontroluje znova (dva widgety) | 1 / 97, 1 / 97 |
| FE-54: druhé stlačenie počas čakania sa vezme (dva widgety) | 1 / 97, 1 / 97 |
| FE-55: dialóg sklad pri odpojení nezavrie | 19 / 125 |
| FE-55: dialóg pri odpojení zavrie akýkoľvek detail | 5 / 223 |
| FE-55: zanikajúci hostiteľ dostane `close` | 2 / 223 |
| FE-56: každý riadok sám (bez zoskupenia) | 4 / 98 |
| FE-56: riadky sa zmenia pred odpoveďou DAM | 1 / 98 |
| FE-56: autori sa opakujú | 1 / 98 |
| FE-56: riadky nedostanú autorov | 4 / 98 |
| FE-56: zdroj len riadku s vlastným výberom | 4 / 98 |
| FE-56: spoločný zoznam autorov | 2 / 98 |
| FE-56: do skupiny aj riadky so „Zdrojom" | 17 / 98 |
| FE-56: po uložení príznaky prvého riadku súboru | 5 / 98 |
| FE-56: bez podmienky `authorEnabled` | 1 / 98 |
| FE-56: posiela sa aj prázdny zoznam | 7 / 98 |
| FE-57: čítanie po zavretí sa zapíše vždy | 4 / 44 |
| FE-57: čítanie po zavretí vždy vypne načítavanie | 2 / 44 |
| FE-57: čítanie po zavretí si číslo neberie | 2 / 44 |
| FE-57: sklad `wanted` nečíta | 4 / 136 |
| FE-58: `reset()` počítadlo nezvýši | 2 / 44 |
| FE-58: `reset()` načítavanie nevypne | 2 / 44 |

Každý z 51 ohybov zhodil aspoň jeden prípad. Tri ohyby pri prvom behu neprešli na červenú a doplnil som prípad
(formulár v stránke; `authorEnabled` v uložení galérie; čítanie po zavretí bez vlastného čísla), jeden ohyb bol
napísaný zle a opravil som ho (zdroj len riadku s výberom). Nedá sa pripnúť (nie je vidieť): po čítaní bez autorov
widget drží čerstvo prečítaný asset namiesto pôvodného (id aj autori sú rovnakí).

**Behy.** Cielené: osem súborov / 401 zelených (päť súborov kroku, dva s upravenými prípadmi
a `imageWidgetsDamAuthorsSave.test.ts`). `oxfmt`, `oxlint`, `eslint` na šestnástich súboroch, `stylelint` na šiestich
čisté, `lint:tsc` 0 (`scratchpad/op5l1-lint.sh`). **CK-LIB OP5-L1 zelená** (`vysledky/OP5-L1-ck.log`):
`test:browser` 316 súborov / 4 665 testov (po OP4-L1-c1 316 / 4 570, +95), `test:eslint` 7 / 82, `lint:tsc`,
`format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.

## Nad rámec znenia zadania

- Spoločný composable `imageDialogDamAuthors.ts` pre oba widgety (namiesto dvoch kópií).
- „Potvrdiť" dialógu obrázka čaká na čítanie po zavretí detailu a potvrdenie sa potom prevezme znova (zadanie
  odkazuje na prístup galérie; bez toho oprava v tom okne neplatí).
- Po čítaní, ktoré nájde autorov, widget asset prestane držať, aj keď obrázok nemení (pozri rozhodnutia FE-54).
- Galéria mení riadky až po úspešnom zápise autorov (pozri rozhodnutia FE-56).
- `readBesideDetail` skladu má druhý nepovinný argument (inak by spoločné poradie nemalo kde rozhodnúť o zápise).
- Šesť prípadov testu `assetSelectListActions.test.ts` (akcie samotné, s falošným API), popri prípadoch zoznamu.

## Nové nálezy (nemenené)

1. **(149b, ostáva) Odpoveď kliku na dlaždicu sa zapisuje priamo do skladu detailu** (`assetSelectListActions.ts:132`,
   `setAsset` mimo `readBesideDetail`): detail riadku fronty otvorený, kým čítanie kliku beží, ňou ostáva prepísateľný.
   Spoločné poradie FE-57 to nezatvára. Z čítania kódu.
2. **Dialóg obrázka číta `authorConflicts` zo skladu detailu, ktorý nikto neplní** (`ImageDetailDialogMetadata.vue:66`,
   `assetDetailStore.ts:18`): výber autorov v dialógu obrázka konflikty nikdy neukáže (galéria má vlastné prázdne pole,
   `ImageWidgetMultipleItem.vue:46`). Staršie; z čítania kódu.
3. **„Potvrdiť" dialógu obrázka hľadá mená vybraných autorov pod ext systémom skladu výberu assetov**
   (`ImageWidgetInner.vue:619`, `ImageMediaWidgetInner.vue:762`, `requireSelectedSelectConfig`): sklad je jeden pre
   stránku, výber iného widgetu nad inou licenciou ho zmení; a kým sa výber na stránke neotvoril, volanie zlyhá
   (dnes sa tam bez výberu nedá dostať). Čítanie po zavretí detailu (FE-54) ide podľa licencie assetu. Staršie.
4. **Druhé „potvrdiť" dialógu obrázka z klávesnice počas ukladania pošle druhé uloženie**
   (`ImageDetailDialogMetadata.vue:96-103`, `onConfirm` nepozerá na `saving`; FE-11 to zavrel len pre dialóg fronty
   a detail). Krok to ošetruje len počas čakania na čítanie. Staršie; z čítania kódu.
5. **Widget jedného obrázka sa nedozvie o autoroch, ktorých asset dostal inde** (iná karta, galéria tej istej stránky,
   druhý widget s tým istým assetom): držaný asset sa pri „upraviť metadáta" nečíta znova, výber sa ponúkne a „potvrdiť"
   s výberom autorov v DAM nahradí (`imageDialogDamAuthors.ts:53`). Staršie (pred krokom rovnako nad assetom skladu).
6. **Uloženie galérie hľadá mená vybraných autorov pod ext systémom stránky** (`ImageWidgetMultipleInner.vue:597`,
   `cachedExtSystemId`), nie pod ext systémom licencie assetu ako FE-32 (`:514`). Staršie; z čítania kódu.
7. **Sklad obrázka dialógu je jeden pre stránku** (`imageMediaWidgetStore.ts:19-36`): dva widgety s `expandMetadata`
   na jednej stránke by zdieľali obrázok formulára; krok sa o to opiera len v podmienke „dialóg tohto widgetu je
   otvorený alebo kreslený v stránke". Známe (komentár propu „only one at once").
8. Zlyhanie čítania bočného panela po zavretí detailu sa hlási aj vtedy, keď ho medzitým predbehol klik alebo `reset()`
   (`assetSelectListActions.ts:158-159`); zlyhanie predbehnutého kliku nie (`:134`). Ponechané, ako bolo.

Nálezy posudkov cyklu 1 mimo zmeny (neopravené, na pokyn vedúceho len zapísané):

9. **(posudok Opus) `onDetailLoadedCallback` je mŕtvy verejný prop.** `AAssetListInner.vue:48,78`,
   `AAssetSelect.vue:45,84` a `AAssetSelectMedia.vue:42,84` ho dávajú vlastnej inštancii `useAssetSelectActions`, ale
   klik na dlaždicu alebo riadok ide cez inštanciu dlaždíc a tabuľky (`AssetSelectListTiles.vue:17`,
   `AssetSelectListTable.vue:17`), ktorá ho nemá: volanie `assetSelectListActions.ts:131` sa nikdy nevykoná.
   admin-cms ani admin-ugc prop nepoužívajú.
10. **(posudok Opus) `AAssetSelectMedia.typeChange` vyprázdni sklady bez vzdania sa čítania kliku**
    (`AAssetSelectMedia.vue:211-215`: `assetSelectStore.reset(false)`, `assetDetailStore.reset()`, mimo `reset()`
    akcií): odpoveď kliku spred prepnutia typu sa zapíše do vyprázdneného skladu a panel ukáže asset predošlého typu.
11. **(posudok Codex) Widgety jedného obrázka zapíšu mená autorov do obrázka skôr, než uložia autorov do assetu**
    (`ImageWidgetInner.vue:622`, `ImageMediaWidgetInner.vue:765`, pred `updateAssetAuthors` na `:624` a `:767`): po
    odmietnutom uložení autorov ostane v skrytom zdroji obrázka text s menami, a „potvrdiť" po vyprázdnení výberu ho
    uloží ako zdroj. Staršie; galéria to od FE-56 robí až po zápise.

## Cyklus 1 (OP5-L1-c1, 13. 10.; dva posudky: FE-53 až FE-57 obstáli, rozhodnutia prijaté; tri body)

Snímok `OP5-L1-c1`, záplata `zaplaty/OP5-L1-c1.diff` (7 súborov, 511 riadkov; mimo `src` a `doc` nič). Zmenené:
`assetSelectListActions.ts` (bod 1), `imageDialogDamAuthors.ts`, `ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`
(bod 2), `consumerProfileImageWidgetLibrary.test.ts`, `consumerProfileAssetListUpload.test.ts`, `doc/changelog/2.0.0.md`.

1. **Ext systém stránky zapíše klik na dlaždicu hneď** (regresia z FE-58, admin-cms; posudok Opus).
   `assetSelectListActions.ts:112-115`: `cachedExtSystemId.value = extSystem` je pred čítaním assetu, nie až za jeho
   odpoveďou. Výber potvrdený skôr, než čítanie kliku odpovie, volá `reset()`, ktorý sa od FE-58 toho čítania vzdá;
   jeho odpoveď bola jediné, čo po výbere z knižnice ext systém stránky nastavilo (`pickAsset` ho nepíše, začína na 0).
   Na čerstvo načítanej stránke tak dialóg obrázka kreslil výber autorov s ext systémom 0, `useAuthorSelectActions`
   zlyhal a nenakreslil sa výber ani „Zdroj".
   - **Je to tá istá hodnota:** ten istý argument `extSystem` toho istého kliku (ext systém licencie, ktorú výber
     prehliada; dlaždice ho dostávajú propom `extId`). Mení sa len čas zápisu.
   - Rozdiely oproti zápisu pri odpovedi: (a) zapíše sa aj po kliku, ktorého čítanie zlyhá alebo sa ho výber vzdá
     (to je účel); (b) pri dvoch klikoch za sebou píše každý klik, platí posledný, ako doteraz platila odpoveď
     posledného. **Oprava v cykle 2:** v cykle 1 som zápis po odpovedi odstránil s tým, že medzi klikom a odpoveďou
     hodnotu nemá čo zmeniť. Neplatí to: hodnota je jedna pre stránku a iný widget ju prepíše, keď mu po kliku dobehne
     vlastná kópia do licencie alebo čakanie na zámok pred uploadom (`ImageWidgetInner.vue:374`, `:351`,
     `ImageMediaWidgetInner.vue:383`, `:361`). Zápis po odpovedi je späť, pozri „Cyklus 2".
   - FE-58 ostáva. Nový prípad bodu 1 po oneskorenej odpovedi vzdaného čítania tvrdí len to, že sa asset nezapíše
     (`consumerProfileImageWidgetLibrary.test.ts:1472`); že po `reset()` neostane načítavanie, drží nezmenený prípad
     zoznamu assetov (`consumerProfileAssetListUpload.test.ts:706-723`).
   - **Pre používateľa:** admin-cms, `AImageWidget` a `AImageMediaWidget` na čerstvo načítanej stránke: „pridať z DAM",
     klik na dlaždicu a „Potvrdiť" skôr, než dobehne čítanie dlaždice, asset bez autorov: dialóg obrázka ponúkne výber
     autorov pod ext systémom výberu (po FE-58 nenakreslil výber ani „Zdroj" a obrázok sa uložil bez zdroja). Vedľajší
     dôsledok: mená autorov a kľúčových slov sa po kliku, ktorého čítanie zlyhalo, hľadajú pod ext systémom výberu,
     nie pod predošlým. **Na backend:** tie isté požiadavky.
2. **Čakajúce „potvrdiť" patrí otvoreniu dialógu, v ktorom ho stlačili** (posudok Codex). Dialóg sa počas čakania
   zavrieť dá (krížik ani zavretie nie sú počas ukladania vypnuté), takže chyba bola dosiahnuteľná: zavrieť, znova
   „upraviť metadáta" toho istého obrázka, a pokračovanie čakania potvrdilo a uložilo znova otvorený dialóg bez
   stlačenia.
   - Čakanie sa presťahovalo z oboch widgetov do composable (`imageDialogDamAuthors.ts:107-138`):
     `holdConfirmForDetailAssetRead(saving, again)` vráti `true`, keď potvrdenie čaká (alebo sa neberie: beží
     uloženie, alebo už jedno čaká), a `again` zavolá po odpovedi čítania, len ak je to stále to isté čakanie.
     Sledovanie `shownImage` (`:118`, `flush: 'sync'`) čakanie zruší, keď sa zmení to, čo dialóg ukazuje: dialóg sa
     zavrie (obrázok je preč) alebo dostane obrázok nanovo (každé otvorenie, výber aj upload kladie do skladu dialógu
     nový objekt). `confirmWaits` (`:110`) točí tlačidlo namiesto `metadataDialogSaving`; po zrušení sa tlačidlo
     prestane točiť hneď. Widgety: `ImageWidgetInner.vue:607-610`, `:979`; `ImageMediaWidgetInner.vue:750-753`, `:1168`.
   - **Rozhodnutia:** (a) zrušenie nie je len pri zavretí, ale pri každej zmene zobrazeného obrázka: formulár
     v stránke (`expandMetadata`) sa nezatvára nikdy a nový výber doň dá iný obrázok (pripnuté testom); (b) odpoveď
     čítania ďalej platí pre neskoršie otvorenie dialógu TOHO ISTÉHO obrázka (zdroj z mien, výber preč; rozhodnutie
     vedúceho, pripnuté tým istým prípadom); (c) podmienka „počas uloženia sa druhé potvrdenie neberie" ostala
     (argument `saving`), teraz má vlastný prípad; (d) `flush: 'sync'`, aby zrušenie nezáviselo od poradia
     mikroúloh; ohyb bez neho testy nezhodili (cez udalosti rozhrania sa rozdiel nedá vyrobiť).
   - **Pre používateľa:** po zavretí dialógu obrázka počas čakajúceho „potvrdiť" sa nič neuloží; dialóg otvorený
     znova ukáže (po odpovedi čítania) zdroj z mien autorov a čaká na nové stlačenie. **Na backend:** ubudlo uloženie
     obrázka bez stlačenia.
3. **Tvrdenie, ktoré nemohlo zlyhať, je preč** (posudok Opus): `expect(loaded).not.toHaveBeenCalled()`
   v `consumerProfileAssetListUpload.test.ts` (skutočné dlaždice klikajú cez vlastnú inštanciu akcií bez callbacku),
   s ním posledná veta odrážky FE-58 v changelogu a veta v tejto poznámke. V changelogu je namiesto nej veta o bode 1,
   a pri FE-54 veta o zrušení čakajúceho potvrdenia.

**Testy** (+10; `consumerProfileImageWidgetLibrary.test.ts` 107 prípadov, päť nových na widget, admin-cms):
- bod 1 (`:1420-1472`): skutočný výber assetov so skutočnými dlaždicami, stránka začína s ext systémom 0; klik na
  dlaždicu (čítanie podržané), „Potvrdiť" výberu, odpovie len čítanie widgetu: dialóg obrázka nakreslí výber autorov
  pod ext systémom výberu, nič pri kreslení nezlyhá; oneskorená odpoveď kliku sa nikde neukáže; vybraný autor sa uloží.
  Čo pri kreslení zlyhá, test zbiera (`errorHandler` pripojenia, `:1129-1132`): vyhodené do stránky by to zhodilo aj
  prípady za ním.
- bod 2 (`:1716-1849`): čakajúce potvrdenie zanikne zavretím dialógu (znova otvorený sa netočí, po odpovedi sa nič
  neuloží, zdroj má z mien, až nové stlačenie uloží); nové stlačenie v znova otvorenom dialógu počká na to isté čítanie
  a uloží raz; potvrdenie hostiteľa nad formulárom v stránke zanikne novým výberom; počas bežiaceho uloženia dialógu
  sa druhé potvrdenie neberie (jeden zápis autorov, jeden obrázok).

**Dôkaz** (v pamäti; `scratchpad/op5l1c1-old.sh`, `op5l1-bend.sh`, výpisy `op5l1c1-old.log`, `op5l1-bend-c1-*.log`).
Štyri produkčné súbory zo snímku `OP5-L1-c1` nad štyrmi súbormi testov: **6 / 167** (bod 1 dva, zavretie dialógu dva,
formulár v stránke dva). Štyri nové prípady nad snímkom prechádzajú, každý pár z iného dôvodu:
- „druhé potvrdenie počas uloženia sa neberie" (dva): to správanie mal aj prvý tvar (podmienka `metadataDialogSaving`);
- „nové stlačenie v znova otvorenom dialógu uloží raz" (dva; `consumerProfileImageWidgetLibrary.test.ts:1788`):
  **prvý tvar to správanie nemal.** Nad snímkom sa nové stlačenie ignorovalo (`metadataDialogSaving` ostalo zapnuté
  cez zavretie aj nové otvorenie) a znova otvorený dialóg uložilo staré čakajúce potvrdenie; prípad tam prechádza
  len preto, že výsledok je rovnaký (jedno uloženie s tým istým obsahom). Staré potvrdenie, ktoré prežije zavretie,
  chytá jedine prípad na `:1767` (zavretý a znova otvorený dialóg bez nového stlačenia).

| Ohyb | Zlyhá |
|---|---|
| bod 1: ext systém zapíše až odpoveď čítania | 2 / 151 |
| bod 1: ext systém nezapíše nikto | 2 / 151 |
| bod 2: čakajúce potvrdenie prežije svoje otvorenie | 4 / 107 |
| bod 2: zrušené potvrdenie tlačidlo ďalej točí | 2 / 107 |
| bod 2: zrušenie len zastaví točenie, čakanie ostane | 6 / 107 |
| bod 2: druhé potvrdenie počas uloženia sa vezme | 2 / 107 |
| bod 2: „potvrdiť" nečaká | 12 / 107 |
| bod 2: po čakaní sa potvrdenie neprevezme | 6 / 107 |
| bod 2: po čakaní sa formulár nekontroluje znova (dva widgety) | 1 / 107, 1 / 107 |
| bod 2: tlačidlo sa počas čakania netočí (dva widgety) | 3 / 107, 3 / 107 |
| bod 2: zrušenie až s ďalším prekreslením (bez `flush: 'sync'`) | 0 / 107 |

Šesť ohybov čakania z prvého tvaru (v tabuľke vyššie „„potvrdiť" nečaká", „po čakaní sa formulár nekontroluje znova",
„druhé stlačenie počas čakania sa vezme", každý pre dva widgety) nahradili ohyby tejto tabuľky nad composable;
ostatné ohyby kroku platia bez zmeny (ich texty sa v kóde nezmenili).

**Behy.** Cielené: štyri súbory / 167 zelených (dva súbory cyklu, `assetSelectListActions.test.ts`,
`imageWidgetsDamAuthorsSave.test.ts`). `oxfmt`, `oxlint`, `eslint`, `stylelint` čisté, `lint:tsc` 0.
**CK-LIB OP5-L1-c1 zelená** (`vysledky/OP5-L1-c1-ck.log`): `test:browser` 316 súborov / 4 675 testov (po OP5-L1
4 665, +10), `test:eslint` 7 / 82, ostatné čisté. **Prvý beh CK bol červený:** 6 prípadov v troch súboroch
(`ImageWidgetCollab.test.ts:734` a `ImageMediaWidgetCollab.test.ts:767`, „waits for its own answer when an earlier
release is refused meanwhile"; štyri prípady `filters/bookmarks/__tests__/FilterBookmarkDialog.test.ts`), všetko
vypršané čakania na skutočný čas pri zaťaženom stroji (`test:browser` trval 356 s namiesto bežných asi 170 s, load
15 až 19; súbežne bežal vitest v admin-dam). Tie tri súbory samotné prešli (112 / 112, bez opakovania) a druhý beh
CK je zelený bez jediného opakovaného prípadu. Výpis prvého behu druhý beh prepísal.

## Cyklus 2 (OP5-L1-c2, 13. 10.; úzke posudky cyklu 1: Opus bez nálezu v kóde a testoch, Codex jeden)

Snímok `OP5-L1-c2`, záplata `zaplaty/OP5-L1-c2.diff` (3 súbory, 90 riadkov; mimo `src` a `doc` nič). Zmenené:
`assetSelectListActions.ts`, `consumerProfileImageWidgetLibrary.test.ts`, `doc/changelog/2.0.0.md` (jedno slovo vo vete
cyklu 1: ext systém sa zapíše pri kliku „a nielen" po odpovedi).

1. **Zápis ext systému stránky po odpovedi čítania je späť** (posudok Codex). `assetSelectListActions.ts:121-123`:
   `cachedExtSystemId.value = extSystem` za podmienkou `request !== detailRequest`, teda na tom istom mieste a pod tou
   istou podmienkou ako pred cyklom 1 (snímok `OP5-L1-c1`, `:117`); zápis pri kliku (`:112-115`) ostáva. `cachedExtSystemId`
   je jedna hodnota pre stránku: iný widget ju prepíše, keď mu po kliku dobehne kópia do licencie alebo upload, a
   odpoveď čítania dlaždice ju pred cyklom 1 vracala na ext systém výberu, pod ktorým sa hneď potom hľadajú mená
   autorov a kľúčových slov assetu. **Pre používateľa:** to, čo platilo pred cyklom 1, platí znova; nič nové.
   **Na backend:** nič.
2. **Poznámka, dôkaz cyklu 1** (posudok Opus): veta „to správanie mal aj prvý tvar" neplatila pre prípad nového
   stlačenia v znova otvorenom dialógu; opravené v časti „Cyklus 1" (čo ten prípad nad snímkom naozaj ukazuje, a že
   prežívajúce staré potvrdenie chytá len prípad zavretého a znova otvoreného dialógu).
3. **Poznámka, bod 1 cyklu 1** (posudok Opus): nový prípad tvrdí po oneskorenej odpovedi len nezapísaný asset;
   načítavanie drží prípad zoznamu assetov. Opravené v časti „Cyklus 1".

**Test** (+1 prípad na widget, `consumerProfileImageWidgetLibrary.test.ts:1480-1497`, 109 prípadov): skutočný výber so
skutočnými dlaždicami na čerstvej stránke; klik na dlaždicu (čítanie podržané) nastaví ext systém výberu; iný widget
medzitým zapíše iný ext systém; po odpovedi čítania je ext systém stránky znova ten z výberu. Otvorenie výberu majú
oba prípady v spoločnom pomocníkovi (`:1427`).

**Dôkaz** (v pamäti; `scratchpad/op5l1c2-old.sh`, výpisy `op5l1c2-old.log`, `op5l1-bend-c2-*.log`,
`op5l1-bend-c1-ext-*.log`). Jeden produkčný súbor zo snímku `OP5-L1-c2` nad tromi súbormi testov: **2 / 153** (nový
prípad v oboch widgetoch).

| Ohyb | Zlyhá |
|---|---|
| ext systém len pri kliku (bez zápisu po odpovedi) | 2 / 153 |
| ext systém len po odpovedi (ohyb cyklu 1, prepísaný) | 4 / 153 (nový prípad a prípad bodu 1 cyklu 1, každý dvakrát) |
| ext systém nezapíše nikto (ohyb cyklu 1, prepísaný) | 4 / 153 |

**Behy.** Cielené: tri súbory / 153 zelených. `oxfmt`, `oxlint`, `eslint`, `stylelint` čisté, `lint:tsc` 0.
**CK-LIB OP5-L1-c2 zelená na prvý beh** (`vysledky/OP5-L1-c2-ck.log`): `test:browser` 316 súborov / 4 677 testov
(po OP5-L1-c1 4 675, +2), `test:eslint` 7 / 82, ostatné čisté; žiadny opakovaný prípad, `test:browser` 156 s.
