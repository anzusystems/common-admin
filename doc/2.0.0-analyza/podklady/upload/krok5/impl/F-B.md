# F-B s nálezom 50: „Uložiť" v detaile a paneli počas spracovania, uloženie premietnuté do riadku hromadnej úpravy (impl-dam)

Plán 2.9, riadky „F-B s nálezom 50" (nález 49) a „50"; `analyzy/nalez49-frontend.md` 4.1, 4.2, 7.1, 7.2 (F-B); denník
`upload-postup.md`, nález 50; text F-B schválený 9. 10. (nové znenie). Strom `/home/volar/projects/anzusystems/admin-dam`
(po F5-c2). TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam`. Bash bez `cd`; nič sa nemazalo.

## Podkroky

1. **Snímok `F-B`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam F-B`, hotový. Súbory mimo `src`: žiadne.
2. **Kód:**
   - **Pravidlo jedno pre všetky cesty:** `metadataMayStillChange` (z F-A) je v `uploadQueuesStore.ts` teraz
     exportované; hromadná úprava, detail aj panel zoznamu sa riadia ním (hlavný súbor `uploading`, `uploaded` alebo
     `stored` a asset nie je popísaný).
   - **F-B:** `AssetDetailSidebarMetadata.vue` a `AssetListSidebarMetadata.vue`: `saveBlocked` (pravidlo nad
     `asset` detailu), „Uložiť" `:disabled="saveBlocked"` a pri ňom veta `coreDam.asset.detail.fileStillProcessing`
     (SK „Súbor sa ešte spracúva. Uložiť pôjde po spracovaní; asset potom otvorte znova.", EN „The file is still being
     processed. You can save once it is processed; then open the asset again.", schválené).
   - **Nález 50, smer detail/panel → riadok:** uloženie z detailu zapíše uložené hodnoty do riadkov toho assetu vo
     frontách (`uploadQueueStore.updateAssetMetadata`) vždy, nielen pri pohľade `queue` (`view` sa v detaile už
     nečíta); panel zoznamu to robí po novom tiež. (Po cykle 1: zapíšu sa hodnoty zachytené pri začiatku uloženia
     a uložený prepínač jednorazového použitia, nie `asset.value` po odpovedi.)
   - **Nález 50, smer hromadné uloženie → panel:** `AssetFooterSelectedFull.vue` po úspešnom hromadnom uložení
     znova načíta otvorený panel. (Po cykle 1: len pri otvorenom paneli, podľa assetu, ktorý panel ukazuje, a len ak
     bol medzi odoslanými; nie podľa aktívneho riadku zoznamu.) Pri „Uložiť" aj „Uložiť a ukončiť"; plán cituje
     `:62-79` („Uložiť"), nález hovorí o hromadnom uložení všeobecne.
3. **Celá sada DAM pred novými testami** (cez `tezky.sh`): **70 / 1 247 zelených**, žiadny existujúci test sa
   nezmenil.
4. **Testy:**
   - `src/test/asset/bulkMetadata.test.ts`, „the save of one asset", pre detail aj panel (`describe.each`): „keeps
     Save off, and says why, while the file of an asset nobody described is with the server" (`uploading`,
     `uploaded`, `stored`); „lets Save be pressed, and says nothing of it, when …" (súbor spracovaný, súbor zlyhal,
     asset popísaný); „writes what it saved into the row of the asset in the mass-edit queue" (riadok `edit` dostane
     uložené kľúčové slová, autorov a vlastné polia; detail otvorený zo zoznamu, `view` = `list`). Pomôcka
     `mountPanel` dostala nepovinný asset. Súbor 58/58 (o 14 viac).
   - `src/test/queue/overlaySave.test.ts`, hromadná úprava › „its save button": „the panel of the list: reads it
     again when its asset was saved" a „…: leaves it alone when its asset was not among them".
5. **Na kóde pred krokom** (v pamäti: `vitest.old.config.mts`, `OLD_SNAP=F-B`, sklad, oba panely a prekrytie zo
   snímku, všetky štyri podané): **9 zo 105 červených** (vypnuté „Uložiť" a veta 6×, zápis do riadku 2×, nové
   načítanie panela 1×). **Ohnutie strážcov** (`fb-bend.json`: pravidlo blokuje každý asset so súborom; prekrytie
   načíta panel vždy): všetkých 7 strážcov červených (6× „lets Save be pressed", 1× „leaves it alone"); spolu 24
   červených, lebo blokované „Uložiť" zastaví aj ostatné prípady uloženia.
6. `oxfmt`, `oxlint` 0. **Prvá CK-DAM F-B červená** (testy 70 / 1 263 zelené): `lint:tsc` v teste
   (`bulkMetadata.test.ts:283`, pomôcka `notDescribed` brala `string` namiesto stavu súboru falošného servera) a
   `lint:eslint` `vuetify/no-deprecated-typography` (`text-caption` v oboch paneloch). Moja chyba: CK som spustil
   súbežne s `lint:tsc`, ktorého výsledok som nevidel. **Oprava:** typ `FakeAssetFile['fileAttributes']['status']`;
   `text-caption` → `text-body-small` (trieda, akú admin-dam má pri podobných popisoch). Potom `lint:tsc` a `eslint`
   na súboroch kroku (cez `tezky.sh`) 0. **CK-DAM F-B znova** (`krok5-praca/vysledky/F-B-ck.log`): zelené, `test`
   70 súborov / 1 263 testov (1 247 + 16 nových), všetko čisté vrátane buildu. **Záplata** `zaplata.sh F-B`:
   `krok5-praca/zaplaty/F-B.diff`, 8 súborov (zoznam nižšie); zmeny mimo `src` a `doc`: žiadne.

## Zmenené súbory

- `src/domains/coreDam/asset/store/uploadQueuesStore.ts` (export pravidla)
- `src/domains/coreDam/asset/components/detail/components/AssetDetailSidebarMetadata.vue`
- `src/domains/coreDam/asset/components/list/components/AssetListSidebarMetadata.vue`
- `src/domains/coreDam/asset/components/footer/AssetFooterSelectedFull.vue`
- `src/locales/sk/coreDam/asset.json`, `src/locales/en/coreDam/asset.json` (jeden kľúč)
- `src/test/asset/bulkMetadata.test.ts`, `src/test/queue/overlaySave.test.ts`

## Cyklus 1 (posudky Codex + Opus nad `zaplaty/F-B.diff`)

Pravidlo, texty a vypnutie tlačidiel správne; nedostatky v náleze 50 a umiestnení vety. Snímok **`F-B-c1`**.

1. (Codex, vysoké) Detail aj panel po požiadavke uloženia brali **aktuálne** `asset.value`: prepnutie assetu počas
   požiadavky zapísalo do riadku iného assetu. **Oprava:** uloženie zachytí asset pri začiatku (`cloneDeep`
   knižnice, bezpečný aj pre reaktívny objekt) a ten pošle aj zapíše do riadku. Prípad „writes into the row of the
   asset it saved, though another asset was opened while it was on the wire" (detail aj panel).
2. (oba) `mainFileSingleUse`: riadok dostal hodnotu z otvorenia assetu, nie uložený prepínač. **Oprava:** zachytený
   asset nesie prepínač detailu (`mainFileSingleUse` zo skladu detailu). Prípad „writes the single-use switch it
   saved into the row, not the one the asset was opened with" (detail aj panel; tvrdí aj, čo odišlo).
3. (oba) Obnova panela kontrolovala aktívny riadok zoznamu. **Oprava:** len pri otvorenom paneli
   (`useMainWrapper().sidebarRight`), podľa assetu v sklade detailu a jeho id, ak bol medzi odoslanými (zoznam id
   zachytený pred uložením); čítanie cez `fetchAsset` s tokenom požiadavky detailu (`startDetailRequest`,
   `isCurrentDetailRequest`). Prípady v `overlaySave.test.ts` (tri namiesto dvoch): otvorený panel s iným assetom
   než aktívny riadok (číta sa asset panela, nie riadku), zatvorený panel (žiadny GET), otvorený panel s assetom mimo
   uložených (žiadny GET).
4. (Opus) Veta v detaile bola v teleportovanej lište akcií s pevnou výškou. **Oprava:** veta je v obsahu sidebaru nad
   formulárom (`v-if="isActive && saveBlocked"`), pod právom `DAM_ASSET_UPDATE`. Výšky sa v happy-dom merať nedajú
   (nemá rozloženie) a `playwright-cli` je podľa pravidiel vlastníka len na jeho vyvolanie; preto test tvrdí, že veta
   nie je v lište akcií (`#anzu-asset-detail-sidebar-actions`), a vzhľad ostáva na pohľad vlastníka.
5. (oba) Veta v paneli bola mimo `<Acl DAM_ASSET_UPDATE>`. **Oprava:** vlastný `<Acl>` okolo vety.
6. Táto poznámka: dve tvrdenia opravené (vyššie a nižšie).

**Na kóde pred opravami** (v pamäti: `vitest.old.config.mts`, `OLD_SNAP=F-B-c1`, oba panely a prekrytie): **7 zo 110
červených** (všetky nové prípady); kontrola umiestnenia vety na starom detaile: **3 z 6 červené** (detail, tri stavy
súboru). Po opravách oba súbory 110/110; `lint:tsc` a `eslint` (cez `tezky.sh`) 0. CK-DAM F-B-c1 zelené: 70 súborov, 1 268 testov (U2: 1 263, +5),
build prešiel (`vysledky/F-B-c1-ck.log`). Záplata `zaplaty/F-B-c1.diff` (310 riadkov, 5 súborov, nič mimo `src`).

## Cyklus 2 (posudky Codex + Opus nad `zaplaty/F-B-c1.diff`)

Body 1, 2, 4 a 5 z cyklu 1 posudky uzavreli. Obnova panela (bod 3) mala dve chyby. Snímok **`F-B-c2`** je po U3, takže
záplata nesie len c2.

1. **Súbeh (oba).** Obnova brala nový token zo zdieľaného počítadla detailu, ale loader nikdy neznížila. Postup chyby:
   - Klik na B (`assetListActions.ts:301-311`) alebo „Upraviť" riadku v tom istom prekrytí
     (`AssetQueueItemEditable.vue:149-164`) zapne loader a nechá A v sklade, kým sa B načíta.
   - Obnova A medzitým zobrala novší token, takže odpoveď B zahodila a jej `hideLoader` sa preskočil.
   - Panel ostal na točení s A pod ním.

   **Oprava** v `AssetFooterSelectedFull.vue`: obnova sa nespustí, kým beží iné načítanie detailu
   (`assetDetailStore.loader`). To načítanie zapíše sklad samo. Ak sa iné načítanie začne až po obnove, zoberie
   novší token a odpoveď obnovy sa zahodí ako doteraz. Loader obnova nezapína ani nevypína.

   Dva nové prípady v `overlaySave.test.ts` držia uloženie aj čítanie B na drôte, kým ich test nepustí:
   - „the panel of the list: reads nothing while a click on another asset is read, and ends on that one": klik na
     dlaždicu B v skutočnom `AssetListTilesView`;
   - „reads nothing while the edit button of a row is read, and the detail ends on that asset": „Edit more" riadku B
     v prekrytí.

   Oba po uložení tvrdia: v sklade je B, loader je dole, A sa nečítalo.
2. **Regresia (Opus).** Po c1 sa pri zatvorenom paneli nič nečítalo, ale sklad držal A. Prepínač
   (`MainWrapper.vue:116`) panel otvorí bez čítania, takže panel ukázal A spred hromadného uloženia a jeho Uložiť
   by hromadné uloženie vrátil. **Oprava:** po hromadnom uložení sa znova číta asset skladu detailu podľa id, ak bol
   medzi uloženými, **bez ohľadu na panel** (ako pred c1, no podľa id). Podmienka `sidebarRight` a `useMainWrapper`
   vypadli. Funkcia sa volá `refreshDetailAsset`, nie `refreshOpenPanel`.

   **Zmena testu s dôvodom:** riadok „leaves a closed panel alone" (z c1, `overlaySave.test.ts:531`) sa otočil a
   je samostatný prípad „the panel of the list: reads its asset while it is closed too, so that it opens on what was
   saved". Pri zatvorenom paneli prebehne jedno čítanie A. Po otvorení panela (`sidebarRight = true`) žiadne ďalšie
   čítanie nepríde a sklad má uložené hodnoty. Dôvod je bod 2. Ostatné dva riadky `it.each` (otvorený panel s iným
   assetom než aktívny riadok, asset mimo uložených) ostali. Príprava sa presunula do pomocníka `panel()` a stav
   panela vracia `onTestFinished`.

**Na kóde pred opravami** (`vitest.old.config.mts`, `OLD_SNAP=F-B-c2`, `AssetFooterSelectedFull.vue`): **3 z 5
červené**, a to všetky nové a otočené prípady:
- otočený prípad: 0 čítaní namiesto 1;
- klik na B: A, loader hore, 1 čítanie A;
- „Edit more": to isté.

Ohnutie len podmienky `loader` (`fbc2-loader.json`) nad `overlaySave.test.ts`: **2 z 50 červené** (oba súbehy).
`oxfmt`, `oxlint` 0; `eslint` a `lint:tsc` (cez `tezky.sh`) 0; `overlaySave` a `bulkMetadata` 112/112.

Po c2 ostali dva úzke prípady, **opravené v cykle 3**: (a) čítanie toho istého uloženého A, ktoré odišlo pred
uložením, a (b) klik na to isté A do 5 s od jeho posledného načítania zo zoznamu (`checkQuickDetailReFetch`).

CK-DAM F-B-c2 zelené (`vysledky/F-B-c2-ck.log`): 72 súborov / 1 277 testov (U3: 1 275, +2: dva súbehy, otočený
prípad nahradil riadok `it.each`), build prešiel. Záplata `zaplaty/F-B-c2.diff` (206 riadkov, 2 súbory:
`AssetFooterSelectedFull.vue`, `overlaySave.test.ts`); mimo `src` a `doc` nič.

## Cyklus 3 (posudky Codex + Opus nad `zaplaty/F-B-c2.diff`)

Oba nálezy c1 posudky uzavreli. Prípady (a) a (b) z c2 nie sú neškodné: keď nastanú, sklad drží A spred uloženia.
Uložiť panela je zapnuté bez ohľadu na zmenu (`AssetListSidebarMetadata.vue:176`), pošle staré hodnoty a hromadné
uloženie vráti. Snímok **`F-B-c3`** (po U5b).

1. **Skratka posledného načítania (b, a cesta Opusa 3).** Zoznam do 5 s nečíta asset, ktorý čítal naposledy
   (`assetListActions.ts:95-100`). Po hromadnom uložení by tak ostal uložený asset v stave spred uloženia, keď
   odpoveď obnovy zahodí novšie čítanie: klik na to isté A, alebo klik na X a návrat na A.
   **Oprava:** `assetDetailStore.forgetLastFetched(ids)` vymaže `lastFetchedId` a `lastFetched`, ak je posledný
   načítaný asset medzi uloženými. Volá sa pri dokončení uloženia a znova tesne pred opakovaným čítaním, lebo
   čítanie spred uloženia skratku medzitým nastaví znova.
2. **Čítanie na ceste pri dokončení uloženia (a, širšie Opus 4).** c2 obnovu pri bežiacom čítaní preskočil a
   veril tomu čítaniu, hoci jeho odpoveď môže byť spred uloženia. **Oprava** je v `assetDetailStore.ts` a
   v `AssetFooterSelectedFull.vue`:
   - „Generácia" je počítadlo požiadaviek detailu, ktoré už každé čítanie berie pri štarte (`startDetailRequest`).
   - `readAfterCurrentRead(read)` pri dokončení uloženia spustí `read` hneď, ak nič nebeží. Inak si zapamätá
     hodnotu počítadla a `read`.
   - `hideLoader()`, kde končí každé čítanie, ktoré je pri svojom konci aktuálne, spustí zapamätané `read` len
     vtedy, keď sa počítadlo odvtedy nezmenilo. Dopadlo teda práve čítanie spred uloženia.
   - Novšie čítanie začalo po uložení, jeho odpovedi sa verí a zapamätané `read` sa zahodí.
   - `read` (`readAgainIfSaved`) číta asset skladu, len ak je medzi uloženými. Berie vlastný token, takže ho novšie
     čítanie preruší, a zapne loader a sám ho zníži. Panel tak počas opakovaného čítania neukazuje staré hodnoty
     pod zapnutým Uložiť. Čítanie, ktoré dopadlo, sa nezahodí a jeho loader spadne.
   - Opakované čítanie teraz zapína loader aj vtedy, keď nič nebeží, ako `refreshActiveItem` pred c1.
3. **Testy** (`overlaySave.test.ts`):
   - Pomocník `reads(assetId, …)` odpovedá na čítania assetu po poradí rôznymi hodnotami, hneď alebo keď ich test
     pustí.
   - `tilesOf` kliká na dlaždice skutočného `AssetListTilesView`.
   - Dva prípady z c2 („reads nothing while…") sú prepísané: čítanie B spred uloženia odpovie `before`, opakované
     `saved`. Sklad má `saved`, loader je dole, B sa čítalo 2×, A 0×.
   - Nové prípady:
     - (a) vlastný asset panela s čítaním na ceste: 2 čítania, `saved`.
     - Čítanie, ktoré začalo po uložení: 1 čítanie, verí sa mu.
     - Klik na B po uložení, kým čítanie A spred uloženia ešte beží: B sa číta 1×. Stráži generáciu.
     - (b) klik na A znova do 5 s.
     - Cesta Opusa 3: klik na X a návrat na A do 5 s. Pri oboch posledných sú 3 čítania A a sklad má `saved`.

**Na kóde c2** (`vitest.old.config.mts`, `OLD_SNAP=F-B-c3`, pätka aj sklad): **5 z 55 červených**: tri čítania na
ceste, (b) a cesta Opusa 3.

**Ohnutia** (`fbc3-bend.py`, každé použité 1×, nad `overlaySave`, 55 prípadov):
- Skratka sa nevymaže: 2 červené, (b) a cesta Opusa 3.
- Po dopadnutí sa nič nečíta: 3 červené.
- Opakované čítanie aj po novšom čítaní: 1 červený, prípad generácie.
- Opakované čítanie neznižuje loader: 3 červené.
- Čítanie hneď bez čakania (stav pred c2): 3 červené.

`oxfmt`, `oxlint` 0; `eslint` a `lint:tsc` (cez `tezky.sh`) 0. CK-DAM F-B-c3 zelené
(`vysledky/F-B-c3-ck.log`): 72 súborov / 1 277 testov (po U5b 1 272, +5), build prešiel. Záplata
`zaplaty/F-B-c3.diff` (312 riadkov, 3 súbory: `assetDetailStore.ts`, `AssetFooterSelectedFull.vue`,
`overlaySave.test.ts`); mimo `src` a `doc` nič.

## Cyklus 4 (posudky Codex + Opus nad `zaplaty/F-B-c3.diff`)

Všetky poradia sú po c3 bez starých dát okrem jedného úzkeho, ktorého koreň je starší než F-B. Skratka „do 5 s bez
čítania" sa riadi len `lastFetchedId` (`assetListActions.ts:95-100`), kým „Upraviť" riadku fronty zapíše do skladu
iný asset bez pečiatky (`AssetQueueItemEditable.vue`, `showDetail`). Snímok **`F-B-c4`** (po U5c).

1. **Oprava (jedna podmienka)** v `checkQuickDetailReFetch`: skratka platí, len keď sklad drží ten asset
   (`assetDetailStore.asset?.id === assetId`). Poradie chyby: klik na X, „Upraviť" A, hromadné uloženie, klik na
   X do 5 s. Klik vzal skratku, zahodil opakované čítanie A a sklad ostal na A spred uloženia.
2. **Testy** (`overlaySave.test.ts`, päť nových prípadov panela), každé ohnutie zvlášť nad celým súborom (60
   prípadov) dá **1 červený, práve svoj prípad** (`fbc4-bend-run.sh`):

   | Prípad | Ohnutie |
   |---|---|
   | klik na X, „Edit more" A, uloženie, klik na X: číta sa X (2×), sklad má X | bez novej podmienky |
   | klik na A, klik na X (drží sa), uloženie, klik na A: A sa číta, sklad má `saved` | bez `forgetLastFetched` pri dokončení uloženia (`AssetFooterSelectedFull.vue:86`) |
   | klik na A (drží sa), uloženie, čítanie dopadne, opakované čítanie (drží sa), klik na A: A sa číta tretíkrát, `saved` | bez `forgetLastFetched` pred opakovaným čítaním (`:66`) |
   | počas opakovaného čítania je loader hore, po ňom dole | bez `showLoader` v opakovanom čítaní |
   | dve uloženia po sebe cez jedno čítanie B na ceste, druhé už B neposiela (riadok odišiel z fronty): B sa prečíta znova | bez reťazenia čakajúceho čítania v sklade (`before?.()`) |

3. **Na kóde c3** (`OLD_SNAP=F-B-c4`, `assetListActions.ts`): 1 zo 60 červený, prípad novej podmienky. Ostatné
   štyri nové prípady na kóde c3 prechádzajú: pripínajú, čo c3 už robil.
4. **Oprava poznámky:** časť „Čo sa mení pre používateľa" hovorila, že zatvorený panel sa nečíta, čo odporovalo
   cyklu 2. Je prepísaná a doplnená o to, čo menia c3 a c4.

`oxfmt`, `oxlint` 0; `eslint` a `lint:tsc` (cez `tezky.sh`) 0. CK-DAM F-B-c4 zelené
(`vysledky/F-B-c4-ck.log`): 73 súborov / 1 280 testov (po U5c 1 275, +5), build prešiel. Záplata
`zaplaty/F-B-c4.diff` (133 riadkov, 2 súbory: `assetListActions.ts`, `overlaySave.test.ts`); mimo `src` a `doc` nič.

## Čo sa mení pre používateľa (rozhodnutia vlastníka 9. 10.)

- Detail a pravý panel zoznamu: „Uložiť" je vypnuté, kým asset nie je popísaný a jeho súbor sa ešte spracúva, a pri
  ňom je veta „Súbor sa ešte spracúva. Uložiť pôjde po spracovaní; asset potom otvorte znova."
- Uloženie z detailu alebo pravého panela zapíše do riadku hromadnej úpravy toho assetu (a do každého riadku toho
  assetu vo frontách) hodnoty, ktoré odoslalo: kľúčové slová, autorov a vlastné polia zachytené pri začiatku uloženia
  a uložený prepínač jednorazového použitia. Neskoršie hromadné uloženie teda pošle uložené, nie staré hodnoty;
  prepnutie na iný asset počas požiadavky nezapíše nič do jeho riadku. Mení, čo pošle neskoršie hromadné uloženie
  (rozhodnuté).
- Po hromadnom uložení sa asset, ktorý drží sklad detailu, načíta znova podľa id, ak bol medzi odoslanými. Platí
  to pre pravý panel zoznamu, **aj zatvorený** (od c2: prepínač ho otvára bez čítania), aj pre dialóg detailu. Asset
  mimo odoslaných sa nečíta. Zlyhané čítanie nechá detail, ako bol (zápis do konzoly), uloženie samo prešlo.
- Od c3:
  - Počas tohto opakovaného čítania je nad panelom loader, takže panel neukazuje hodnoty spred uloženia pod
    zapnutým Uložiť.
  - Ak pri dokončení uloženia práve beží čítanie detailu (klik na iný asset, „Upraviť" riadku), nechá sa dopadnúť.
    Keď prinesie uložený asset, ten sa hneď prečíta druhýkrát.
  - Uložený asset sa po hromadnom uložení číta aj pri kliku do 5 s od jeho posledného načítania. Skratka „bez
    čítania" preň neplatí.
- Od c4: skratka „do 5 s bez čítania" platí len vtedy, keď detail naozaj drží ten asset. Po „Upraviť" riadku
  fronty sa asset načítaný zoznamom naposledy číta znova.

## Odchýlky, zblíženia navyše, ohnuté súbory, nové nálezy

- Odchýlka: nové načítanie panela aj pri „Uložiť a ukončiť", nielen pri „Uložiť" (plán cituje riadky „Uložiť").
- Zápis z detailu ide cez existujúce `updateAssetMetadata` skladu do riadkov toho assetu vo všetkých frontách, ako
  pri pohľade `queue` doteraz (aj riadok uploadu toho assetu, ak je vo fronte).
- Zblíženia navyše: žiadne. Ohnuté súbory na disku: žiadne. Nové nálezy: žiadne.
