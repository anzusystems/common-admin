# OP2-L2: vyplnenie autorov, pridanie počas uloženia, ten istý súbor znova; nálezy 110, 111, 112 (impl-lib-op2)

**Stav: po cykle 2, čaká na posudok.** Cielené testy a CK zelené po poslednej úprave `src` (CK-LIB OP2-L2-c2, 12. 10.).

Zadanie vedúceho (`overenie-nalezov.md`, „Tretie overenie", tabuľka „FE, knižnica"): FE-26 (110), FE-27 (111),
FE-28 (112). Strom LIB `/home/volar/projects/anzusystems/common-admin`, TMPDIR
`node_modules/.cache/vitest-tmp-impl-lib-op2`. Snímok **`OP2-L2`** (po OP2-L1, s `doc/changelog/2.0.0.md`), záplata
`krok5-praca/zaplaty/OP2-L2.diff` (7 súborov; mimo `src` a `doc` nič).

## Zmenené súbory

- `src/domains/dam/imageWidget/composables/useImageMassOperations.ts`
- `src/domains/dam/uploadQueue/components/UploadQueueDialog.vue`
- `src/domains/ui/file/components/AFileInput.vue`
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageMassOperations.test.ts`
- `src/domains/dam/__tests__/consumerProfileUploadDialogActions.test.ts`
- `src/domains/ui/file/__tests__/AFileInput.test.ts`
- `doc/changelog/2.0.0.md` (jedna odrážka v „Upload queue and its dialogs.", dve v „Image widgets and asset select,
  uploads and picks.")

## FE-26 (110): „vyplniť prázdne" autorov neprepíše vyplnený zdroj, ktorý riadok ukazuje

Pravidlo je v znení po cykle 1 (prvý tvar kroku plnil len riadky, ktoré autorov ponúkajú; pozri „Cyklus 1").

**Čo sa mení v kóde.** `replaceEmptyAuthors` (`useImageMassOperations.ts:36-66`), dve veci:
1. bez `forceReplace` sa riadok plní, keď nemá `damAuthors` (podmienka spred kroku) a zároveň buď autorov ponúka
   (`showDamAuthors`), alebo má prázdny `texts.source` (`:57-61`). Z „vyplniť prázdne" tak vypadol jediný druh
   riadku: ten, čo ukazuje vyplnený zdroj. Čo sa do plneného riadku zapíše, sa nemení (`damAuthors` a mená do
   `texts.source`, `:62-63`);
2. bez `forceReplace` a s prázdnym výberom funkcia skončí hneď, ešte pred čítaním mien (`:38-39`).

`forceReplace` („nahradiť") sa nemení. Ostatné dve operácie súboru (popis, zdroj) sa nemenia. Spoločné pole
`damAuthors` pre všetky riadky (`:62`) ostalo, ako bolo: tabuľka nálezu ho menuje, zadanie nie.

**Čo som zistil.**
- **„Vyplniť prázdne" sa dá stlačiť aj s prázdnym výberom:** tlačidlo pri poli autorov
  (`ImageMassOperations.vue:167-173`) ani „Vyplniť prázdne" pod formulárom (`:248-255`) nemajú `disabled`.
- **Dopyt na mená pri prázdnom výbere** doteraz išiel (`useApiFetchByIds` posiela aj prázdny zoznam id,
  `useApiFetchByIds.ts:74-104`) a potom sa riadkom bez `damAuthors` zdroj vymazal; test to na starom kóde ukázal
  (v tabuľke nálezu „odvodené, nespúšťané"). Po oprave nejde dopyt a nemení sa nič.
- **„Nahradiť" s prázdnym výberom dnes** (nemenené, pripnuté testom): pošle ten dopyt s prázdnym zoznamom a každému
  riadku, aj tomu so zdrojom, nastaví `damAuthors: []` a zdroj `''`.

**Čo sa mení pre používateľa.** admin-cms, hromadné operácie nad galériou (`AImageMassOperations`), keď ponúkajú
autorov:
- „vyplniť prázdne" (pri poli autorov aj spoločné pod formulárom) už neprepíše vyplnený zdroj riadku, ktorý ukazuje
  pole „Zdroj" (asset DAM nevrátil; asset sa pri výbere neprečítal; obrázok nahraného riadku bez metadát);
- prázdny zdroj takého riadku vyplní menami vybraných autorov ako doteraz. Riadok z FE-18 (povinný prázdny „Zdroj")
  sa teda dá vyplniť aj cez „vyplniť prázdne";
- s prázdnym výberom „vyplniť prázdne" nespraví nič; doteraz vymazalo zdroj riadkom bez autorov DAM (aj skrytý
  uložený zdroj riadku, ktorý autorov ponúka).

admin-ugc: nič (autorov DAM nemá, pole autorov sa neukáže).

**Na backend.** Pri prázdnom výbere a „vyplniť prázdne" nejde `GET …/author/ext-system/{id}/search`. Uloženie galérie
pošle do CMS zdroj, ktorý redaktor napísal, nie mená cudzích autorov. Do DAM sa nemení nič: riadok, ktorý ukazuje
prázdny zdroj, dostane do `damAuthors` vybraných autorov ako doteraz, ale uloženie galérie ich do assetu neposiela,
lebo riadok autorov neponúka (`ImageWidgetMultipleInner.vue:485-486`; pripnuté testom v cykle 1).

## FE-27 (111): fronta počas uloženia svojho dialógu neberie súbory

Znenie po cykle 2 (prvý tvar kroku vypínal len „+" a dropzónu dialógu; vlastný vstup hostiteľa pribudol v cykle 2).

**Čo sa mení v kóde.**
- `UploadQueueDialog.vue`: tlačidlo „+" (`:301`) aj dropzóna dialógu (`:359`) dostali
  `:disabled="saveButtonLoading || saveAndCloseButtonLoading"`.
- Dialóg dáva o uložení vedieť von: `useUploadQueueDialog.ts:5-7` má stav modulu `uploadQueueDialogSaving` (kľúč
  fronty, ktorej dialóg práve ukladá, inak `null`). Dialóg ho drží podľa tých istých dvoch príznakov
  (`UploadQueueDialog.vue:96-105`, hneď od začiatku uloženia) a pri zániku ho vráti (`:106-108`), aj uprostred
  uloženia. `useUploadQueueDialog` knižnica nevyváža; žiadny prop, emit ani export sa nemení.
- `AAssetListInner.vue:207-217`, `onFileInput`: kým ukladá dialóg jeho fronty, súbor nevezme, bez hlášky.

**Hostitelia `UploadQueueDialog` a ich vlastné vstupy do fronty.**
- **`AAssetListInner`** (dialóg fronty zoznamu assetov; z adminov ho má len admin-ugc, stránka zoznamu assetov):
  `onFileInput` dostane stránka cez slot `upload-activator` (`:258-264`). admin-ugc ním kreslí tlačidlo „Nahrať"
  a dropzónu cez celé okno (`pages/dam/asset/index.vue:47-72`, `z-index: 9999`), ktorá pri ťahaní leží nad dialógom
  fronty. **Dosiahnuteľné, zastrážené.** Tá istá funkcia obsluhuje aj tlačidlo zoznamu bez slotu (`:265`) a „+"
  a dropzónu dialógu (`:440-441`).
- **`ImageWidgetMultipleInner`** (galéria, admin-cms aj admin-ugc), nezastrážené, lebo sa k nim počas otvoreného
  dialógu nedá dostať:
  - vlastné tlačidlo „Nahrať" (`:624`) a vlastná dropzóna (`:737`) sú v stránke pod dialógom, ktorý je cez celé
    okno (`fullscreen`): myš sa k nim nedostane, klávesnicu drží dialóg, a pustený súbor vezme dropzóna dialógu,
    ktorá pri ťahaní prekrýva celý dialóg aj vypnutá;
  - otázka o limite 50 súborov (`ImageWidgetMultipleLimitDialog`) pridáva až po odpovedi a je modálna nad dialógom
    fronty: kým je otvorená, uloženie sa spustiť nedá, a počas uloženia sa otvoriť nedá (otvára ju len pridanie
    súborov, ktoré je vypnuté);
  - výber z knižnice (`onCopyToLicence`, `:223-255`) sa pod dialógom otvoriť nedá. **Jedna cesta ostáva** (nový
    nález nižšie): kópia do licencie potvrdená ešte pred otvorením dialógu, ktorej odpoveď príde počas uloženia.
- `ImageWidgetInner` a `ImageMediaWidgetInner` majú dialóg jedného súboru, nie tento.

**Čo „+" potrebuje.** Je to `VBtn` v slote `AFileInput`; s `disabled` je to natívne vypnuté tlačidlo, ktoré neprijme
klik myšou ani Enter či medzerník. Vstup súboru pod ním je skrytý a má `tabindex="-1"`, inak než cez „+" sa otvoriť
nedá; systémový výber súboru otvorený pred uložením je modálny, uloženie sa počas neho spustiť nedá. Dropzóna pri
`disabled` pustenie zahodí (`AFileDropzone.vue:46-50`).

**Čo sa mení pre používateľa.**
- admin-cms a admin-ugc, dialóg fronty galérie; admin-ugc, dialóg fronty na stránke zoznamu assetov: kým beží
  „uložiť" alebo „uložiť a použiť", „+" je sivé a súbor pustený do dialógu sa nepridá. Po „uložiť" a po uložení,
  ktoré zlyhalo, sa pridáva ako doteraz.
- admin-ugc, stránka zoznamu assetov: súbor pustený do okna počas uloženia dialógu sa nepridá, bez hlášky (vezme ho
  dropzóna stránky nad dialógom a zoznam ho odmietne).
- Pri ťahaní súboru nad dialógom počas uloženia sa plocha zvýrazní ako inokedy, len bez textu „pustite sem" (tak
  vyzerá vypnutá dropzóna všade; nález 124).

Kým sa neukladá, nemení sa nič.

**Na backend.** V tom okne už nevznikne upload (`POST …/image/licence/{id}`, časti, dokončenie), ktorý sa po uložení
zahodil.

## FE-28 (112): vstup súboru po spracovaní výberu pustí svoje súbory

**Čo sa mení v kóde.** `AFileInput.vue:90-92`, `onInputFileChange`: po `emit('change')` a po odovzdaní súborov
(`filesInput`; aj prázdneho zoznamu, keď ich kontrola formátu a veľkosti odmietla) sa hodnota natívneho vstupu
vynuluje. Mechanizmus `file-input-key` ostáva (`:106-114`, `:136`).

**Kto komponent používa a čo číta.** Hľadané v `src` knižnice a šiestich adminov (admin-cms, admin-ugc, admin-dam,
admin-blog, admin-forum, admin-inhouse).
- Knižnica: `AFileInputDialog.vue:92-101` (štyri miesta v `ImageWidgetInner.vue` a `ImageMediaWidgetInner.vue`),
  `UploadQueueDialog.vue:285`, `AAssetListInner.vue:265`, `ImageWidgetMultipleInner.vue:624`, ihrisko
  `playground/fileView/FileView.vue:18,35`. Všetky berú len `File[]` z `filesInput`.
- Udalosť `change` počúva len `AFileInputDialog` a posiela ju ďalej (`:100`); jeho `change` nepočúva nikto.
- Adminy: len admin-ugc, `pages/dam/asset/index.vue:47,64`, oba razy `@files-input`. admin-dam má vlastný vstup
  (`FileUpload.vue`), nie `AFileInput`.
- Nikto nečíta súbory vstupu po udalosti a nikto sa neopiera o to, že hodnota ostane: vstup je skrytý, bez
  `required`, meno súboru neukazuje. Odovzdané objekty `File` ostávajú platné aj po vynulovaní (test to pripína).

`src/lib.ts` vyváža `AFileInput`; `AFileInputDialog` ani typ `InputFileChangeEvent` nevyváža. Poslucháč `change`
cudzej aplikácie nájde súbory na vstupe počas udalosti ako doteraz (pripnuté testom); po nej už nie.

**Čo sa mení pre používateľa.** admin-ugc, stránka zoznamu assetov, tlačidlo „Nahrať": ten istý súbor sa dá vybrať
znova (po zlyhaní, zastavení aj úspechu); doteraz sa nestalo nič. Ostatní hostitelia si vstup obnovovali kľúčom
fronty; u nich sa mení len to, že ten istý súbor ide vybrať znova aj vtedy, keď sa kľúč nezmenil (súbor odmietnutý
kontrolou: upozornenie príde znova).

**Na backend.** Nič (opakovaný výber spustí upload ako každý iný).

## Testy a prečo vedia zlyhať

Nové prípady (+19; štyri súbory cielených testov, 82 prípadov):

- `consumerProfileImageMassOperations.test.ts` (+5, admin-cms, `:195`): galéria z dvoch riadkov, ktoré autorov
  ponúkajú (bez autorov so skrytým uloženým zdrojom; s autorom), a riadkov so zdrojom (vyplnený, prázdny, zdroj
  z autora assetu; od cyklu 1 aj prázdny zdroj pri `damAuthors`). „Vyplniť prázdne" aj spoločné „vyplniť prázdne"
  plnia podľa pravidla (v prvom tvare kroku len prvý riadok, od cyklu 1 aj riadok s prázdnym zdrojom); s prázdnym
  výberom sa nemení nič a nejde dopyt na mená; „nahradiť" prepíše všetky riadky; „nahradiť" s prázdnym výberom všetkým
  vymaže autorov aj zdroj. Pomocník `mountAbove` je rozdelený na `mountOver` (galéria podľa testu).
- Starší `ImageMassOperations.test.ts` nahrádza moduly a nemenil sa; nové prípady sú v teste nad skutočnými modulmi.
- `consumerProfileUploadDialogActions.test.ts` (+10, obe aplikácie, `:554`): dialóg so skutočným „+" a dropzónou,
  súbory berie hostiteľ ako widget (`addByFiles`). Počas podržaného „uložiť a použiť" aj „uložiť": „+" je vypnuté,
  klik naň neotvorí výber súboru, pustenie nepridá riadok a nejde žiadny `POST` uploadu. Po „uložiť", po zlyhanom
  „uložiť" a po zlyhanom „uložiť a použiť": „+" otvorí výber, vybraný aj pustený súbor pribudnú. Pomocník `pick` je
  rozdelený na `mountDialog`.
- `AFileInput.test.ts` (+4, `:37`): po výbere vstup nedrží súbor a ten istý súbor vybraný znova sa odovzdá znova tým
  istým vstupom; to isté po odmietnutom súbore (dve upozornenia); počas `change` vstup súbory ešte drží; zmena kľúča
  dá nový vstup ako doteraz. Prehliadač výber tých istých súborov nehlási; test ho napodobňuje pomocníkom
  `pickInBrowser` (nepošle `change`, keď vstup tie súbory drží).

**Dôkaz** (v pamäti, `vitest.bend.config.mts`, snímok `OP2-L2`; skript `scratchpad/op2l2-bend.sh`, výpisy
`scratchpad/op2l2-bend-*.log`, `op2l2-old.log`; riadky „autori" sú z prvého tvaru kroku, po cykle 1 platí tabuľka
v časti „Cyklus 1"):

| Ohyb | Zlyhá |
|---|---|
| tri produkčné súbory zo snímku | 9 / 82 (3 + 4 + 2) |
| autori: prázdny je každý riadok bez `damAuthors` (po starom) | 2 |
| autori: plní aj riadok, ktorý autorov má | 3 |
| autori: prázdny výber plní (po starom) | 1 |
| autori: prázdny výber zastaví aj „nahradiť" | 1 |
| autori: „nahradiť" len riadky, ktoré autorov ponúkajú | 2 |
| „+" bez `disabled` (po starom) | 4 |
| „+" vypnuté len pri „uložiť a použiť" / len pri „uložiť" | 2 / 2 |
| „+" vypnuté vždy | 10 |
| dropzóna bez `disabled` (po starom) | 4 |
| dropzóna vypnutá len pri „uložiť a použiť" / len pri „uložiť" | 2 / 2 |
| dropzóna vypnutá vždy | 6 |
| vstup hodnotu nenuluje (po starom) | 2 |
| vstup sa vynuluje pred `change` | 1 |
| vstup sa vynuluje pred prečítaním súborov | 15 |

**Behy.** Cielené (`scratchpad/op2l2-run.sh`): 4 súbory / 82 zelených; okolie (`dam/uploadQueue`, `assetDetail`,
`dam/__tests__`, `imageWidget`, `assetSelect`, `ui/file`) 87 súborov / 1 948 zelených. `oxfmt`, `oxlint`, `eslint` na
šiestich súboroch a `stylelint` na dvoch čisté, `lint:tsc` 0. **CK-LIB OP2-L2 zelená** (`vysledky/OP2-L2-ck.log`):
`test:browser` 314 súborov / 4 414 testov (po OP2-L1 4 395, +19), `test:eslint` 7 / 82, `lint:tsc`, `format:check`,
`lint:oxlint`, `lint:eslint`, `lint:stylelint` čisté.

## Texty na potvrdenie

Žiadne.

## Nové nálezy (nemenené)

- **Dropzóna stránky v admin-ugc obchádza FE-27** (nález 123). Stránka zoznamu assetov má vlastnú dropzónu cez celé okno
  (`admin-ugc/src/pages/dam/asset/index.vue:64-72`, `dropzone-variant="fullscreen"`, `z-index: 9999`,
  `AFileDropzone.vue:115-119`), ktorá pri ťahaní leží nad dialógom fronty. Pustenie počas „uložiť a použiť" teda
  vezme ona, nie vypnutá dropzóna dialógu, `AAssetListInner.vue:207-213` súbor zaradí a `:215-219` ho po uložení
  zahodí. Galérií sa to netýka (ich dropzóna je pod dialógom). Oprava by bola v `onFileInput` zoznamu assetov
  (nevziať súbor, kým dialóg ukladá) alebo v admine.
- **Prázdny zdroj riadku so „Zdrojom" „vyplniť prázdne" autorov nevyplnilo** (prvý tvar kroku): odstránené v cykle 1.
- **„Nahradiť" s prázdnym výberom** vymaže autorov aj zdroj všetkým riadkom a pošle dopyt na mená s prázdnym zoznamom
  (`useImageMassOperations.ts:36-66`). Nemenené, rozhodnutie produktu.
- **Vypnutá dropzóna nemá vlastný vzhľad** (nález 124). Štýly rátajú s triedou `a-file-dropzone--disabled`
  (`AFileDropzone.vue:168,173,190,195`), ktorú šablóna nikdy nenastaví (`:62-70`): vypnutá dropzóna sa pri ťahaní
  zvýrazní ako zapnutá, len bez textu.
- **Hromadné vyplnenie autorov dáva riadkom spoločné pole** (`useImageMassOperations.ts:62`); známe z OP-L3, tabuľka
  nálezu 110 ho menuje, zadanie nie.

## Cyklus 1 (OP2-L2-c1, 12. 10.; rozhodnutie vedúceho po mojom bode o prázdnom zdroji)

Snímok `OP2-L2-c1`, záplata `zaplaty/OP2-L2-c1.diff` (4 súbory). Mení sa len FE-26; FE-27 a FE-28 bez zmeny.

**Pravidlo.** Prvý tvar kroku plnil len riadky, ktoré autorov ponúkajú, a riadku s prázdnym „Zdrojom" tak prestal
zdroj vypĺňať: to vlastník neschvaľoval. `useImageMassOperations.ts:57-61`: bez `forceReplace` sa plní riadok bez
`damAuthors`, ktorý autorov ponúka alebo má prázdny zdroj. Návrat prázdneho výberu a „nahradiť" ostali.

| Riadok | pred krokom | prvý tvar kroku | po cykle 1 |
|---|---|---|---|
| ponúka autorov, žiadnych nemá | plní | plní | plní |
| ponúka autorov, má ich | nie | nie | nie |
| ukazuje vyplnený zdroj, bez `damAuthors` | **prepíše zdroj** | nie | nie |
| ukazuje prázdny zdroj, bez `damAuthors` | plní | **nie** | plní |
| ukazuje zdroj (vyplnený aj prázdny), má `damAuthors` | nie | nie | nie |

**Pre používateľa a na backend** je to popísané vyššie pri FE-26 (znenie po cykle). Riadok s prázdnym zdrojom dostane
mená ako zdroj; do DAM sa mu pri uložení galérie nepošle nič.

**Testy** (+2, jeden prepísaný): `consumerProfileImageMassOperations.test.ts:195` má šesť riadkov (pribudol riadok
s `damAuthors` a prázdnym zdrojom) a očakávanie podľa tabuľky; `consumerProfileImageWidgetMultipleUpload.test.ts`
`:1078` (riadok neprečítaného assetu dostane od „vyplniť prázdne" mená ako zdroj a uloženie galérie pošle autorov len
assetu, ktorý ich ponúka) a `:1094` (zdroj napísaný ručne pri takom riadku ostane).

**Dôkaz** (v pamäti; `scratchpad/op2l2c1.sh`, výpisy `op2l2c1-*.log`; tri súbory, 84 prípadov):

| Ohyb | Zlyhá |
|---|---|
| `useImageMassOperations.ts` zo snímku `OP2-L2-c1` (prvý tvar kroku) | 3 |
| ten istý súbor zo snímku `OP2-L2` (pred krokom) | 4 |
| plní každý riadok bez `damAuthors` (pred krokom) | 3 |
| plní len riadky, ktoré autorov ponúkajú (prvý tvar) | 3 |
| plní len riadky s prázdnym zdrojom | 2 |
| nepozerá `damAuthors` | 3 |
| riadku so zdrojom nepozerá `damAuthors` | 2 |
| „nahradiť" podľa toho istého pravidla | 3 |
| prázdny výber plní | 1 |
| prázdny výber zastaví aj „nahradiť" | 1 |

**Behy.** Cielené 3 súbory / 84 zelených; okolie 87 súborov / 1 950 zelených; `oxfmt`, `oxlint`, `eslint` na troch
súboroch čisté, `lint:tsc` 0. **CK-LIB OP2-L2-c1 zelená** (`vysledky/OP2-L2-c1-ck.log`): `test:browser` 314 súborov
/ 4 416 testov (po OP2-L2 4 414, +2), `test:eslint` 7 / 82, ostatné čisté.

**Changelog.** Odrážka FE-26 prepísaná na toto pravidlo.

**Nálezy zapísané vedúcim:** dropzóna stránky admin-ugc nad dialógom fronty je nález 123 (opravený v cykle 2), vzhľad
vypnutej dropzóny nález 124 (neopravuje sa).

## Cyklus 2 (OP2-L2-c2, 12. 10.; posudky bez chyby v troch opravách, dve veci na dotiahnutie)

Snímok `OP2-L2-c2`, záplata `zaplaty/OP2-L2-c2.diff` (8 súborov). FE-28 bez zmeny.

1. **FE-26, zdroj zo samých medzier** (oba posudky). `useImageMassOperations.ts:58-59`: pre túto operáciu je zdroj
   prázdny aj vtedy, keď má len biele znaky (`trim`), tak ako ho berie kontrola povinného zdroja. Po cykle 1 sa taký
   riadok bez `damAuthors` prestal plniť (pred krokom sa plnil) a s povinným zdrojom sa galéria neuložila.
   `replaceEmptySource` (`:27`) sa nemenil: prázdny zdroj meria ďalej dĺžkou, zdroj z medzier preň prázdny nie je.
   Testu pribudli dva riadky so zdrojom: chýbajúci (`undefined`) a zo samých medzier; oba sa plnia.
2. **FE-27, vlastný vstup hostiteľa** (nález 123; vlastník schválil FE-27 aj pre zoznam assetov admin-ugc). Kód
   a hostitelia sú popísaní vyššie pri FE-27 (znenie po cykle). Stav modulu drží dialóg sledovaním svojich dvoch
   príznakov, nie zápisom v každej vetve obslúh: platí pre obe uloženia aj pre uloženie zastavené kontrolou
   formulára, a uloženie zatvoreného dialógu, ktoré dobehne neskôr, už stav nemení (jeho sledovanie zaniklo
   s dialógom).
3. **Texty:** časť FE-27 poznámky prepísaná (dialóg fronty zoznamu assetov má len admin-ugc); veta o `lib.ts`
   opravená (typ `InputFileChangeEvent` sa nevyváža); changelog FE-27 doplnený o vlastný vstup hostiteľa, FE-26
   o zdroj z bielych znakov.

**Testy** (+14):
- `consumerProfileAssetListUpload.test.ts:335` (+10, obe aplikácie): stránka s vlastným vstupom (slot
  `upload-activator`), jeden súbor nahraný. Počas podržaného „uložiť a použiť" odovzdaný súbor nepribudne a nezačne
  sa upload; počas „uložiť" a počas zlyhaného „uložiť a použiť" tiež nie a po nich áno (dialóg ostal otvorený); po
  zatvorení dialógu uprostred uloženia pribúda znova, a keď uloženie zatvoreného dialógu dobehne počas uloženia
  ďalšieho, stráž ďalšieho ostáva; uloženie dialógu inej fronty zoznam nebrzdí.
- `consumerProfileUploadDialogActions.test.ts` (+4, `:625,641`; doplnené dva staršie prípady): dialóg povie
  o uložení hneď po stlačení a vezme to späť po jeho konci; vezme to späť, keď zanikne uprostred uloženia; uloženie
  zastavené kontrolou formulára nepovie nič a „+" ostane zapnuté.
- `consumerProfileImageMassOperations.test.ts`: osem riadkov, očakávania doplnené (počet prípadov sa nemení).

**Dôkaz** (v pamäti; `scratchpad/op2l2c2.sh`, výpisy `op2l2c2-*.log`; štyri súbory, 153 prípadov):

| Ohyb | Zlyhá |
|---|---|
| tri produkčné súbory zo snímku `OP2-L2-c2` (stav modulu ostáva nový, testy ho po sebe nulujú) | 16 / 153 |
| zdroj z medzier nie je prázdny (po cykle 1) | 2 |
| chýbajúci zdroj nie je prázdny | 2 |
| zoznam berie súbory aj počas uloženia (po starom) | 8 |
| zoznam neberie, kým je dialóg otvorený | 4 |
| zoznam stráži len cudziu frontu | 8 |
| zoznam neberie, kým ukladá hocijaký dialóg | 2 |
| dialóg o uložení nepovie nič | 14 |
| dialóg povie len o „uložiť a použiť" / len o „uložiť" | 6 / 10 |
| dialóg to po uložení nevezme späť | 12 |
| dialóg to nevezme späť pri zániku | 4 |
| dialóg to povie až po vykreslení | 4 |

**Behy.** Cielené 4 súbory / 153 zelených; okolie 87 súborov / 1 964 zelených; `oxfmt`, `oxlint`, `eslint` na
siedmich súboroch a `stylelint` na dvoch čisté, `lint:tsc` 0. **CK-LIB OP2-L2-c2 zelená**
(`vysledky/OP2-L2-c2-ck.log`): `test:browser` 314 súborov / 4 430 testov (po cykle 1 4 416, +14), `test:eslint`
7 / 82, ostatné čisté.

**Nové nálezy (nemenené).**
- **Kópia do licencie, ktorej odpoveď príde počas uloženia dialógu galérie.** Výber z knižnice s kópiou sa potvrdí,
  kým dialóg fronty nie je otvorený, a `copyToLicence` beží (`ImageWidgetMultipleInner.vue:395-400`). Ak redaktor
  medzitým nahrá súbory a stlačí „uložiť a použiť" a odpoveď kópie príde počas toho uloženia, `onCopyToLicence`
  (`:223-255`) zaradí riadky kópií do fronty a koniec uloženia ich s frontou zahodí; kópie ostanú v licencii DAM
  nepripojené. Stráž tohto kroku („nevziať súbor") tu nepomôže: kópie už v DAM sú, treba ich podržať do konca
  uloženia. Okno je úzke (odpoveď kópie musí trvať dlhšie než upload, spracovanie a stlačenie uloženia).
- **Do dialógu fronty sa z klávesnice nedá pridať súbor** (nález 127, zapísal vedúci): „+" má `tabindex="-1"`
  (`UploadQueueDialog.vue:295`).
- **Vypnutá dropzóna sa pri ťahaní zvýrazní** (nález 124), bez zmeny.
