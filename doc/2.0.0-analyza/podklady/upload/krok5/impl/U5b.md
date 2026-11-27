# U5b: obal sidebaru hromadných operácií admin-dam (impl-dam)

Plán 2.7 „U5b"; návrh komponentov (`navrh-komponenty.md`): 1.3 (HO2 R10, HO5, HO10), 2.4 (väzba
`UploadQueueMassOperationsBinding`), 2.5 (formulár hromadných operácií sa nevyváža), 4.1 (riadok U5b, `:1154`), ZK7,
ZK8; bod z U4 (posudok Codexu c4). Strom `/home/volar/projects/anzusystems/admin-dam` (po U5a), knižnica v kópii
C2. TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam`. Bash bez `cd`, nič sa nemazalo.

## Podkroky

1. **Snímok `U5b`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam U5b`, hotový. Mimo `src` nič.
2. **Kód:** `D/asset/components/queue/AssetQueueSelectedSidebar.vue` (363 → 33) je obal `ADamUploadQueueMassOperations`.
   - Vlastnosť `queueId` ostáva a `AssetQueueEditable.vue` sa nemení.
   - Komponentu podáva `:queue-key`, aktuálny ext system a väzbu `operations`.
   - Väzba volá `getQueueItemsTypes` a tri akcie skladu admin-dam (`queueItemsReplaceEmpty*`) s `forceReplace`.
     Zápis tak ostáva tam, kde je dnes (HO5): kľúčové slová a autori len do riadkov typu, ktorý ich má zapnuté (C49).
3. **Testy podľa plánu (4.1):**
   - `DT/queue/massOperationsRows`:
     - Texty EN podľa R10 (HO2): „Fill empty field", „Replace everywhere", „Fill only empty", „Clear", panel
       „Main" namiesto „General". „Replace all" a názvy typov a polí sú rovnaké.
     - Konštanty `GENERAL`, `SHOW_MORE`; hlavička odkazuje validáciu na knižničný `massOperationsValidation.test.ts`.
     - **Prípad `:141` dostal tvrdenie**, že všetky zapisovateľné polia sú naraz, nič nie je skryté a niet
       „Show more details", hoci ext system pripína 1. Prenáša tak prvý z vypustených prípadov `customMetadataForms`.
   - `DT/queue/customMetadataForms`: vypadol celý blok štyroch prípadov formulára hromadných operácií aj import
     `:253-254` formulára admin-dam. Hlavička teraz hovorí o jednom formulári. Oprava v cykle 1:
     `massOperationsRows:141-200` netvrdilo všetok ich účinok. Dve kontroly ostali bez náhrady (dve upravené polia
     držia obe hodnoty; vyplnenie nedotknutého poľa podá `undefined`) a doplnil ich až cyklus 1.
   - `DT/asset/assetMetadataValidation`: vypadol prípad `:114` aj import formulára hromadných operácií. Tvrdí ho
     knižničný `LT/massOperationsValidation:41`.
   - `DT/queue/massOperationsSidebar`: **prepis nad `uploadUi.ts`** so skutočným sidebarom knižnice v skutočnom
     zozname.
     - Náhrady skladu, výberov a formulára podľa cesty vypadli, lebo vnútro knižnice nezasiahnu.
     - Čo sidebar žiada od skladu, zachytávajú `vi.spyOn` nad `queueItemsReplaceEmptyKeywords` a `…Authors`
       skladu admin-dam.
     - Ostali tri prípady. **Bod z U4 je v druhom prípade:** fronta bez obrázkov (video, audio), ktorých typy majú
       oboje vypnuté, kým obrázok ich má zapnuté. Panely sú len `['Video', 'Audio']`, bez všeobecného, a „fill all"
       ani „replace all" nič nežiadajú.
   - `DT/a11y/iconButtonNames`: súbory 3 → 1, tlačidlá 8 → 2, dvojice bubliny a mena 8 → 2, názov prípadu bez
     hromadných operácií.
   - `queueRefresh` bez zmeny: obal ďalej nahrádza podľa cesty.
4. **Dôkazy** (`u5b-bend.py`, `u5b-bend-run.sh`; nad `massOperationsSidebar` a `massOperationsRows`, 17 prípadov;
   každé ohnutie použité 1×):
   - Väzba so všetkými typmi namiesto typov fronty: 3 zo 17 červené (panely v oboch súboroch, prípad z U4).
   - `fillKeywords` bez `forceReplace`: 5 zo 17 červených.
   - Obal s `:ext-system="2"`: 17 zo 17 červených.
   - Knižničný sidebar so všeobecným panelom vždy (`Q.value || $.value` → `true`): 1 zo 17 červený, a to práve
     prípad z U4.
   - **Sidebar zo snímku** (`vitest.old.config.mts`, `OLD_SNAP=U5b`): 17 zo 17 červených. Texty a panely sú iné, takže
     testy čítajú sidebar knižnice.
5. `oxfmt`, `oxlint` 0, `eslint` (cez `tezky.sh`) 0.
   - **`lint:tsc` bol najprv červený:** `massOperationsSidebar.test.ts(25,86)`, typy ako `string[]`. Teraz sú
     `DamAssetTypeType[]`, `lint:tsc` 0.
   - Päť zmenených testov 38/38.
6. **CK-DAM U5b** (`krok5-praca/vysledky/U5b-ck.log`) zelené: 72 súborov / 1 272 testov (po U5a 1 277: −4
   `customMetadataForms`, −1 `assetMetadataValidation`), všetko čisté vrátane buildu. **Záplata** `zaplata.sh U5b`:
   `krok5-praca/zaplaty/U5b.diff` (904 riadkov, 6 súborov); mimo `src` a `doc` nič.

## Cyklus 1 (U5b-c1, len testy; posudok Codexu)

Z vypustených prípadov `customMetadataForms.test.ts:293` (snímok U5b) sa stratili dve kontroly. Snímok **`U5b-c1`**.
Obe sú doplnené nad obalom v `massOperationsRows.test.ts` (blok „a custom field of the mass operations"):

1. „keeps what was typed into it while another field is typed into, each written by its own buttons". Do `title` a
   `note` panela Image sa napíše hodnota. „Fill empty field" poľa `title` potom zapíše prvú hodnotu, „Replace
   everywhere" poľa `note` druhú. **Ohnutie knižnice** (formulár podá len naposledy písané pole, bez
   `...E.modelValue`): 1 zo 16 červený, len tento prípad. Kontrolu teda predtým nikto nedržal.
2. „asks for no value to be filled in when nothing was typed into it". `vi.spyOn` nad
   `queueItemsReplaceEmptyCustomDataValue` skladu, bez náhrady implementácie. „Fill empty field" nedotknutého poľa
   žiada `{ assetType: 'image', elementProperty: 'title', value: undefined }` a prázdny riadok dostane `undefined`,
   vyplnený ostane. **Ohnutie obalu** (`value ?? ''`): 2 zo 16 červené, tento prípad a existujúci „takes the value
   of the rows away…".

Bez ohnutia 16/16. `oxfmt`, `oxlint` 0; `eslint` a `lint:tsc` (cez `tezky.sh`) 0. CK-DAM U5b-c1 zelené
(`vysledky/U5b-c1-ck.log`): 72 súborov / 1 279 testov (po F-B-c3 1 277, +2), build prešiel. Záplata
`zaplaty/U5b-c1.diff` (36 riadkov, 1 súbor: `massOperationsRows.test.ts`); mimo `src` a `doc` nič.

## Zmenené súbory (6, všetky v `src`)

- `src/domains/coreDam/asset/components/queue/AssetQueueSelectedSidebar.vue`
- `src/test/queue/massOperationsRows.test.ts`, `src/test/queue/massOperationsSidebar.test.ts`,
  `src/test/queue/customMetadataForms.test.ts`, `src/test/asset/assetMetadataValidation.test.ts`,
  `src/test/a11y/iconButtonNames.test.ts`

## Súbory bez importéra po U5b (R-K13, pre U9)

`D/shared/components/customMetadata/AssetCustomMetadataFormMassOperations.vue`: bez importéra v produkcii aj v
testoch. Ostáva na disku a prekladá sa. Výbery KA a AA admin-dam má ďalej `AssetQueueItemEditable.vue` (do U5c);
test `massOperationsSidebar` ich už nenahrádza.

## Zblíženia, odchýlky, nálezy

- ZK7: panely typov podľa fronty. ZK8: „Vyčistiť" vymaže výber vždy. Texty R10 (HO2) prichádzajú so sidebarom
  knižnice.
- Doplnené po posudku Opusa: U5b vymenil v sidebare aj oba výbery (kľúčové slová, autori) a tlačidlo nového autora
  za knižničné. Zblíženia výberov ZK13 až ZK19 a EN titulok „Creating author" sa preto v sidebare hromadných
  operácií prejavia už od U5b, nie až v U5c.
- Odchýlky: žiadne (`massOperationsSidebar` prepísaný, čo plán dovoľuje; vedúci prepis prijal). Nové nálezy:
  žiadne. Ohnutia a beh starého kódu len v pamäti.
