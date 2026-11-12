# PV14b: meno konfigurácie DAM v strome komponentov (impl-komp-lib)

**Stav: cyklus 2 (PV14b-c2, len test), CK zelená, čaká na posudok.** Posudky Codex a Opus: kód bez nálezu.

Plán `plan-implementacie.md` 2.9 riadok „PV14b" (`:1101`); návrh komponentov 2.13, 2.12 (práva vytvorenia), 2.11;
analýza `analyzy/pv14-pomenovane-konfiguracie.md` časť 2 (inventár) a 4.1 body 5 a 6; podklad `impl/36.md` („Podklad
pre PV14b"). Strom LIB `/home/volar/projects/anzusystems/common-admin` (po PV14a-c1), TMPDIR
`common-admin/node_modules/.cache/vitest-tmp-impl-komp-lib`.

Skratky: `L/` = `src/domains/dam/`, `LT0/` = `L/__tests__/`.

## Podkroky

1. **Snímok `PV14b`** pred prvou úpravou.
2. **Meno** (`L/composables/damConfigName.ts`, nový, nevyvezený): `DamConfigNameKey` a `useDamConfigName(explicit?)`:
   výslovné meno, inak meno najbližšieho komponentu nad ním, ktorý ho má, inak `default`; meno poskytne potomkom.
3. **Komponenty s vlastnosťou `configName`** (36; skript `pv14b-props.py`, potom `pv14b-fixup.py`): predvolená hodnota
   `'default'` → `undefined`; za makrami skriptu pribudol riadok `const damConfigName = useDamConfigName(props.configName)`;
   všetko, čo čítalo `props.configName` (skript) alebo `configName` (šablóna), číta `damConfigName`. Zoznam:
   `L/assetDetail/components/` (8: `AssetMetadata`, `AssetDetailSidebarMetadata`, `AssetDetailSidebarROI`,
   `AssetDetailSidebarFrame`, `AssetDetailDialog`, `AssetDetailDialogSidebar`, `AssetFileRotate`,
   `AssetDetailDialogFrame`), `L/uploadQueue/components/` (6: `UploadQueueDialog`, `UploadQueueDialogSingle`,
   `UploadQueueDialogSingleSidebar`, `…SidebarMetadata`, `…SidebarMetadataContent`, `UploadQueueEditable`),
   `L/assetSelect/components/` (6: `AAssetSelect`, `AAssetSelectMedia`, `AAssetListInner`, `AssetSelectFilter`,
   `AssetSelectFilterForm`, `AssetDistributionServiceNameFilter`), `L/imageWidget/components/` (11: tri widgety, tri
   vnútorné, tri „simple", `AImagePublicInput`, `ImageWidgetMultipleItem`), `L/components/DamAdminAssetLink.vue`,
   `L/user/components/` (2), `L/cropper/components/` (2).
4. **Miesta, ktoré čítali `default` napevno** (analýza 2, druhy A a B; skript `pv14b-manual.py`):
   - `UploadQueueDialog.vue` (uloženie, mapovanie na obrázok aj `customUploadMetadataToImageMap`, detail riadku),
     `AssetDetailSidebarMetadata.vue` (uloženie metadát a `updateFromDetail(asset, meno)`), `AImagePublicInput.vue`;
   - výber assetu: `useAssetSelectActions(meno, …)` v troch výberoch namiesto `'default'`, a v ich častiach
     (`AssetSelectFilter`, `AssetSelectFilterForm` svojím menom; `AssetSelectListTiles`, `AssetSelectListTable`,
     `FilterPodcastRemoteAutocomplete` zdedeným);
   - mená: `useAuthorSelectActions(extSystem, configName?)`, `useKeywordSelectActions(extSystem, configName?)`; vstupy
     `KeywordRemoteAutocompleteWithCached`, `AuthorRemoteAutocompleteWithCached`, tlačidlo `AuthorCreateButton` a oba
     filtrové výbery dostali nepovinnú vlastnosť `configName` (inak zdedené meno); `keywordCreateAcl` a
     `authorCreateAcl` sa čítajú z konfigurácie vstupu;
   - obrázky: `useImageMassOperations(configName?)`, `ImageMassOperations.vue` (`AImageMassOperations`) s nepovinnou
     `configName`; validácia popisu a zdroja pod menom (`ImageWidgetMultipleItem.vue`, `ImageDetailDialogMetadata.vue`).
5. **Meno do skladu front** (PV14a): `addByFiles(…, meno)` a `addByCopyToLicence(…, meno)` v `ImageWidgetInner.vue`,
   `ImageMediaWidgetInner.vue` (po dve a dve volania), `ImageWidgetMultipleInner.vue` (kópia, dve volania),
   `ImageWidgetMultipleLimitDialog.vue` (súbory galérie, zdedené meno), `AAssetListInner.vue` (súbory).
6. **Lint, podľa ktorého sa upravil prvý prechod:** `vue/require-default-prop` (vlastnosť musí mať predvolenú
   hodnotu → `undefined`), `vue/define-macros-order` (riadok mena až za `defineEmits`, `defineModel`, `defineSlots`),
   `vue/no-setup-props-reactivity-loss` (direktíva nad riadkom mena; nad riadkami, ktoré už vlastnosť nečítajú,
   zanikla).
7. **Testy** (+39, dva nové súbory):
   - `LT0/damConfigName.test.ts` (5): `default`; výslovné meno; zdedené cez komponenty bez mena; vlastné meno má
     prednosť pre komponent a to, čo je v ňom, nie vedľa; výslovné `default` pod iným menom.
   - `LT0/damNamedConfigurationComponents.test.ts` (34): stránka s `default` a `own` (iný klient; adresy assetu,
     obrázka, autorov a kľúčových slov). Kde komponent meno berie, beží prípad dvoma cestami: meno dostane, alebo
     je vnútri komponentu pod `own`. Mená: skladačky hľadania; hromadná operácia autorov; vstupy autorov a
     kľúčových slov hľadajú; filtre hľadajú; nové kľúčové slovo; nový autor tlačidlom; právo vytvoriť z konfigurácie
     vstupu (bez práva sa neponúkne pod `own`, pod `default` bez práva áno). Výber assetu: zoznam a detail
     skladačkou; klik v dlaždiciach a v tabuľke vnútri výberu. Detail: uloženie a spätné čítanie do riadkov.
     Upload: pustený súbor v troch widgetoch (galéria cez dialóg limitu), kópia do licencie v troch widgetoch, oba
     dialógy uploadu „uložiť a použiť" (uloženie, mapovanie, meno autora z adresy `own`).
   - `LT0/damAuthorKeywordEndpoints.test.ts`: prípady bez zmeny a zelené (počty požiadaviek sa nezmenili); dva
     komentáre „by the default configuration" hovoria nový dôvod (nedostali meno a nie sú vnútri pomenovaného).
8. **Dôkaz** (v pamäti, snímok `PV14b`; skript `pv14b-bends.sh`, dva súbory, 39 prípadov; počty pred prípadom
   tabuľky sú z 38): výslovné meno až po zdedenom → 2; meno sa neposkytne → 16; nededí sa → 16; vstup kľúčových
   slov s voľbami `default` → 4, s hľadaním `default` → 2; vstup autorov s hľadaním `default` → 2, s právom z
   `default` → 2; tlačidlo autora → 2; filtre autorov → 2, kľúčových slov → 2; skladačky hľadania bez mena → 5 a 5;
   hromadná operácia → 1; dlaždice → 1; tabuľka → 1; detail: uloženie → 2, spätné čítanie → 2, vlastnosť s
   predvoleným `'default'` → 1; pustenie: widget → 1, widget s médiom → 1, dialóg limitu → 1; kópia: 1, 1, 1; dialóg
   fronty s voľbami `default` → 2, s predvoleným `'default'` → 1; dialóg jedného súboru s predvoleným `'default'`
   → 1; tlačidlo s predvoleným `'default'` → 1. Produkčné súbory kroku zo snímku (`N39L_OLD`) → 30 / 38.
9. **Behy** (skripty `pv14b-check.sh`, `pv14b-new.sh`): cielené `L/` a `src/test` 111 súborov / 2 164 zelených;
   `oxfmt`, `oxlint`, `eslint` na 54 zmenených súboroch čisté, `lint:tsc` 0.
10. **Návrh**: `navrh-komponenty.md` 2.13 (odsek „Hotové v kroku PV14b").
11. **Záplata** `zaplata.sh PV14b` → `krok5-praca/zaplaty/PV14b.diff`. **CK-LIB PV14b v LIB zelené** (`vysledky/PV14b-ck.log`): `test:browser` 311 / 4 246 (PV14a-c1 + 39, dva nové súbory),
    `test:eslint` 7 / 82, ostatné čisté, `lint:eslint` 4 staršie varovania.

## Zmenené súbory

- nový `src/domains/dam/composables/damConfigName.ts`
- 36 komponentov s vlastnosťou (podkrok 3)
- `src/domains/dam/assetSelect/components/AssetSelectListTiles.vue`, `AssetSelectListTable.vue`,
  `FilterPodcastRemoteAutocomplete.vue`
- `src/domains/dam/author/composables/authorActions.ts`, `author/components/AuthorRemoteAutocompleteWithCached.vue`,
  `AuthorCreateButton.vue`, `DamAuthorFilterRemoteAutocomplete.vue`
- `src/domains/dam/keyword/composables/keywordActions.ts`, `keyword/components/KeywordRemoteAutocompleteWithCached.vue`,
  `DamKeywordFilterRemoteAutocomplete.vue`
- `src/domains/dam/imageWidget/composables/useImageMassOperations.ts`, `imageWidget/components/ImageMassOperations.vue`,
  `ImageDetailDialogMetadata.vue`, `ImageWidgetMultipleLimitDialog.vue`
- testy: nové `src/domains/dam/__tests__/damConfigName.test.ts`, `damNamedConfigurationComponents.test.ts`; komentáre
  v `damAuthorKeywordEndpoints.test.ts`
- `doc/2.0.0-analyza/podklady/upload/krok5/navrh-komponenty.md` (2.13)

## Čo sa mení pre používateľa

V admin-cms, admin-ugc a admin-dam nič: majú len `default`, nikto iné meno nepodáva a bez poskytnutého mena vyjde
každé čítanie na `default` ako doteraz (admin-ugc podáva `default` výslovne). Aplikácia s druhou konfiguráciou dostane
pod widgetom, výberom alebo detailom s menom všetky požiadavky komponentov na klienta a adresy tej konfigurácie:
upload a jeho dialógy, výber assetu a jeho detail, uloženie detailu, hľadanie a vytvorenie autorov a kľúčových slov s
právom tej konfigurácie, hromadné operácie obrázkov, validácie. Cache mien (autori, kľúčové slová, používatelia) a
notifikácie ostávajú spoločné pre stránku a idú cez `default` (PV14c).

**Verejné rozhranie** pribúda o nepovinnú `configName` na `AImageMassOperations`,
`ADamKeywordRemoteAutocompleteWithCached`, `ADamAuthorRemoteAutocompleteWithCached`, `ADamAuthorCreateButton`,
`ADamAuthorFilterRemoteAutocomplete`, `ADamKeywordFilterRemoteAutocomplete`. Skladačky `useAuthorSelectActions`,
`useKeywordSelectActions` a `useImageMassOperations` verejné nie sú (z `src/lib.ts` idú len komponenty); ich nový
parameter je vnútorný.

**Jedna zmena nie je len prírastok** (opravené po posudku Opus, PV14b-c1): `AImagePublicInput` čítal pod svojím menom
len obrázkové voľby a voľby DAM z `default`; teraz číta pod menom oboje. S menom, ktoré aplikácia má len v
`image.configs` a nie v `coreDam.configs`, preto pri vzniku hodí výnimku pluginu (predtým fungoval s voľbami DAM z
`default`). Tri adminy to nemajú; veta pre changelog v Z je v `navrh-komponenty.md` 2.13.

## Odchýlky

1. **Meno rieši každý komponent s vlastnosťou, nie len 14 vstupných** (návrh 2.13 bod 2): jeden riadok v 36
   komponentoch. Pre strom je to isté (výslovné, inak zdedené, inak `default`), a komponent s vlastnosťou, ktorému ju
   rodič nepodá, zdedí meno namiesto `default` (miesta „C" analýzy sa tým opravia bez zoznamu).
2. **Predvolená hodnota vlastnosti je `undefined`, nie „bez predvolenej"** (návrh 2.13 bod 1): vyžaduje to
   `vue/require-default-prop`; správanie je to isté.
3. **Dokumentácia** (`doc/changelog/2.0.0.md:70`, `doc/guide/installation.md:62`) sa podľa plánu píše v Z, tu nie.
4. **`useUploadQueueItemRefresh(configName)`** ostáva s podpisom, ktorý meno nečíta (návrh 2.13 bod 4).

## Čo testy nepripínajú (len transformácia a lint)

- časti výberu `AssetSelectFilterForm.vue` a `FilterPodcastRemoteAutocomplete.vue`; skladačka, oba zoznamy, od
  cyklu 1 celý zoznam stránky (`AAssetListInner.vue`: výpis, klik cez skutočný zoznam, súbory stránky) a od cyklu 2
  oba dialógové výbery (`AAssetSelect.vue`, `AAssetSelectMedia.vue`: licencia, výpis cez ich filter, klik cez ich
  zoznam) pripnuté sú;
- `AImagePublicInput.vue`; komponent `ImageMassOperations.vue` (vlastnosť, validácie, text zdroja; skladačka je
  pripnutá); validácia pod menom v `ImageWidgetMultipleItem.vue` a `ImageDetailDialogMetadata.vue`;
- `addByFiles` z výberu súboru cez menu v dvoch widgetoch jedného obrázka (pustenie je pripnuté), vetva „kópia už
  existuje" (vetva „kópia" je pripnutá);
- komponenty, kde sa zmenila len predvolená hodnota a zdroj mena (ROI, otočenie, rámce detailu, odkaz do DAM, výbery
  používateľov, „simple" widgety, cropper): s výslovným menom sa nemenia, zdedenie robí ten istý riadok ako v
  pripnutých komponentoch.

## Zblíženia navyše (tvar registra)

Žiadne (krok sa týka len knižnice; admin-dam nič neposkytuje a ostáva na `default`).

## Nové nálezy

Nálezy z tejto poznámky a z posudku Opus zapisuje vedúci do denníka (84 až 86); kód sa pre ne nemení.

- **Cache mien sa pýta aj počas ďalšieho prípadu testu:** cache stránky (autori, kľúčové slová, používatelia) sa
  pýta cez `default` 1,5 s po tom, čo dostane id, čiže často počas prípadu po tom, ktorý jej ho dal; a čo sa
  nespýtala, drží ďalej. V prvom behu to dalo náhodné zlyhanie. Od cyklu 1 nový súbor to čakanie drží (spolu s
  dlhými, od 1,2 s) a pustí ho až po skončení prípadu: počas prípadu sa cache nepýta nič, každý prípad začína s
  prázdnou frontou cache, a tvrdenia o klientovi `default` sú úplné, bez filtra.
- **Pridania do fronty nemajú `catch`** (nemenené). Widgety jedného obrázka a
  zoznam assetov volajú `uploadQueuesStore.addByFiles(…)` a `addByCopyToLicence(…)` bez `await`: odmietnutie skladu
  (neinicializovaný ext systém; od PV14a-c1 aj iné meno konfigurácie do fronty s riadkami, čiže dva widgety s jedným
  kľúčom fronty pod rôznymi konfiguráciami) je neodchytené zamietnutie a dialóg uploadu sa otvorí bez nových
  riadkov. Dialóg limitu galérie pridanie čaká (`ImageWidgetMultipleLimitDialog.vue`, `onDialogConfirm`), ale bez
  `catch`: pri odmietnutí ostane točiť načítavanie, dialóg sa nezavrie a `afterAdd` sa nevyšle; `checkForLimit` jeho
  výsledok nečaká.
- **`/adm/v1/cms/asset/…`** (otázka widgetu s médiom na vybraný asset) je adresa, ktorú konfigurácia nemenuje; ide
  klientom konfigurácie widgetu (analýza 1, „pevné adresy"). Pripnuté len ako poznámka v prípade kópie.

## Cyklus 1 (PV14b-c1, 11. 10.; posudky Codex a Opus; len testy a zápisy)

Snímok `PV14b-c1` (strom po PV14b). Produkčný kód sa nemení; mení sa
`src/domains/dam/__tests__/damNamedConfigurationComponents.test.ts` (34 → 40 prípadov).

1. **Vyvezený výber pripojený celý** (Codex a): describe „the list of assets of a page, given the name of a DAM
   configuration" pripája `AAssetListInner` s `configName: 'own'` tak, ako ho pripája stránka: skutočný zoznam, jeho
   filter a dlaždice alebo tabuľka; zástupcami sú len lišta, riadky, metadáta vybraného assetu, detail, dialóg fronty
   a vstupy filtra. Prípady: výpis ide na adresu `own` jeho klientom a klik v skutočnom zozname prečíta asset tam
   (klient `default` nedostane nič, `own` nemá nezodpovedanú požiadavku); súbory vybrané na stránke sa pošlú na `own`.
   Strata mena na hranici zoznam → jeho časti by predtým prešla (skladačka a zoznamy boli testované oddelene).
2. **Právo vytvoriť, používateľ s právom** (Codex b): pod `own`, ktorá právo menuje, sa používateľovi s právom nové
   kľúčové slovo ponúkne a Enter ho vytvorí na adrese `own`; nový autor sa ponúkne (tlačidlo aj „+ meno"). Oboma
   cestami (meno dostane; je vnútri pomenovaného).
3. **Bez filtra otázok cache** (Codex c): filter `CACHE_LOOKUP` zanikol. Čakanie cache (1,5 s) sa drží spolu s dlhými
   (`holdLongWaits(1 200)`) a po každom prípade sa pustí (`afterEach`: `waits.elapseAll()`), takže cache sa počas
   prípadu nepýta a nič si nenesie do ďalšieho; každé tvrdenie „klient `default` nedostal nič" je `toEqual([])` nad
   všetkými jeho požiadavkami. Podvrhnutý DAM odpovie aj na otázku na používateľov (prázdny zoznam).
4. **Zápisy** (Opus): `AImagePublicInput` a meno len v `image.configs` (oddiel „Čo sa mení pre používateľa", veta pre
   changelog v `navrh-komponenty.md` 2.13); tri skladačky nie sú verejné; nález o pridaniach bez `catch` spresnený
   (galéria pridanie čaká).

**Dôkaz** (v pamäti, snímok `PV14b-c1`; skript `pv14bc1-bends.sh`, dva súbory, 45 prípadov): všetkých 28 ohnutí
z PV14b je červených aj nad novým súborom (počty: výslovné meno až po zdedenom 2; neposkytne sa 18; nededí sa 18; vstup
kľúčových slov s voľbami `default` 6, s hľadaním `default` 2; vstup autorov 2 a 2; tlačidlo 2; filtre 2 a 2;
skladačky 5 a 5; hromadná operácia 1; dlaždice 2, tabuľka 1; detail 2, 2, 1; pustenie 1, 1, 1; kópia 1, 1, 1; dialógy
2, 1, 1; tlačidlo s predvoleným `'default'` 1). Nové: zoznam stránky vypisuje pod `default` → 2; zoznam meno
neposkytne tomu, čo je v ňom → 1; súbory stránky bez mena → 1; právo kľúčového slova iné než konfigurácie → 5; právo
autora iné → 3.
**Behy**: cielené `L/` a `src/test` 111 súborov / 2 170 zelených; `oxfmt`, `oxlint`, `eslint` čisté, `lint:tsc` 0.
Záplata `zaplaty/PV14b-c1.diff`. **CK-LIB PV14b-c1**: zelená, 311 súborov / 4 252 testov (`vysledky/PV14b-c1-ck.log`; PV14b + 6).

## Cyklus 2 (PV14b-c2, 11. 10.; posudok Codex k PV14b-c1; len test)

Snímok `PV14b-c2` (strom po PV14b-c1). Mení sa len
`src/domains/dam/__tests__/damNamedConfigurationComponents.test.ts` (40 → 42 prípadov).

1. **Vyvezené dialógové výbery pripojené celé a otvorené** (Codex a): prípad cyklu 1 pripájal `AAssetListInner`
   priamo, takže strata mena vo vyvezenom `AAssetSelect` by stále prešla. Nový describe „…given the name of a DAM
   configuration and opened" beží pre `AAssetSelect` aj `AAssetSelectMedia` s `configName: 'own'`: výber, jeho filter
   a dlaždice alebo tabuľka sú skutočné (zástupcami sú lišta, riadky, metadáta vybraného assetu a vstupy filtra).
   Licenciu stránka vopred nepozná, takže si ju výber prečíta sám (`/adm/v1/asset-licence/…`, adresa mimo
   konfigurácie, klientom `own`); po `open()` jeho filter vypíše assety z adresy `own` a klik v jeho zozname prečíta
   asset tam. Tvrdenia: presný zoznam troch požiadaviek na `own`, žiadna nezodpovedaná, klient `default` nič.

**Dôkaz** (v pamäti, snímok `PV14b-c2`; skript `pv14bc2-bends.sh`, súbor 42 prípadov), pre každý z dvoch výberov:
výber meno neposkytne tomu, čo je v ňom (filter ho ešte dostane vlastnosťou) → 1 (klik číta cez `default`); výber
meno nepodá vôbec (ani filtru) → 1; výber sám číta pod `default` ako pred krokom → 1. Šesť ohnutí, každé zhodí
prípad svojho výberu.
**Behy**: cielené `L/` a `src/test` 111 súborov / 2 172 zelených; `oxfmt`, `oxlint`, `eslint` čisté, `lint:tsc` 0.
Záplata `zaplaty/PV14b-c2.diff`. **CK-LIB PV14b-c2**: zelená, 311 súborov / 4 254 testov (`vysledky/PV14b-c2-ck.log`; PV14b-c1 + 2).
