# OP-L3: vstup súboru a mená, nálezy 81, 82, 67 (impl-lib-op)

**Stav: posúdené bez nálezu v kóde kroku (cyklus 1).** CK zelená po poslednej úprave `src` stromu (CK-LIB OP-L-c1, 12. 10.).

Zadanie vedúceho (`overenie-nalezov.md`, tabuľka „FE, knižnica"): FE-6 (81), FE-8 (82), FE-9 (67). Strom LIB, TMPDIR
`node_modules/.cache/vitest-tmp-impl-lib-op`. Snímok **`OP-L3`** (po OP-L2, s `doc/changelog/2.0.0.md`), záplata
`krok5-praca/zaplaty/OP-L3.diff` (12 súborov; mimo `src` a `doc` nič).

## Zmenené súbory

- `src/domains/ui/file/components/AFileInput.vue`
- `src/domains/dam/imageWidget/components/ImageMassOperations.vue`
- `src/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue`
- `src/locales/sk/common/damImage.json`, `src/locales/en/common/damImage.json`, `src/locales/cs/common/damImage.json`
- `src/test/i18nLiteralKeys.test.ts` (stráž kľúčov vidí aj `close-label="…"`)
- `src/domains/ui/file/__tests__/AFileInput.test.ts`
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetUpload.test.ts`
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageMassOperations.test.ts` (nový)
- `src/domains/dam/__tests__/damAuthorConflictChipName.test.ts` (nový)
- `doc/changelog/2.0.0.md` (tri odrážky v „Image widgets and asset select, uploads and picks.")

## FE-6 (81): dropzóna dialógu výberu súboru vezme prvý platný súbor

**Čo sa mení v kóde.** `AFileInput.vue:74-84`, `onDropzoneDrop`: bez `multiple` sa skontrolujú všetky pustené súbory,
ďalej ide prvý, ktorý kontrolou prejde, a keď ich prejde viac, ukáže sa `common.damImage.upload.onlyOneFile` (text
nálezu 47). S `multiple` ide pustenie ako doteraz cez `validateData`. Výber cez systémový dialóg (`onInputFileChange`)
sa nemení. `AFileDropzone` a `AFileInputDialog` sa nemenia.

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, widget obrázka a widget obrázka s médiom, dialóg „Nahrať
obrázok" z menu (a z tlačidiel `expandOptions`), pustenie súborov do jeho dropzóny:
- zlý formát alebo veľkosť a za ním platný súbor: platný sa nahrá, zlý je vymenovaný v upozornení. Doteraz sa dialóg
  zavrel a nenahralo sa nič.
- viac platných súborov: nahrá sa prvý a ukáže sa „Sem sa dá nahrať len jeden súbor; použije sa prvý." Doteraz prvý
  bez slova.
- upozornenie o formáte teraz vymenuje všetky odmietnuté súbory pustenia, nie len prvý.

**Kto ešte komponent používa.** `AFileInput` vyváža `src/lib.ts`. S `use-dropzone` a bez `multiple` ho v knižnici má len
`AFileInputDialog` (štyri miesta v `ImageWidgetInner.vue` a `ImageMediaWidgetInner.vue`). Ostatné použitia sú
s `multiple` alebo bez dropzóny a nemenia sa: `UploadQueueDialog.vue:264`, `AAssetListInner.vue:261`,
`ImageWidgetMultipleInner.vue:618`, ihrisko `playground/fileView/FileView.vue`. V aplikáciách (admin-dam, admin-cms,
admin-ugc, admin-blog, admin-forum, admin-inhouse; hľadané v `src`) ho priamo používa len admin-ugc,
`pages/dam/asset/index.vue:47,64`, oba razy s `multiple`. `AFileInputDialog` knižnica nevyváža.

**Na backend.** V prvom prípade vyššie pôjde upload platného súboru, ktorý doteraz nešiel. Inak nič.

**Odchýlka od znenia zadania.** Zadanie: upozorniť, „keď bolo pustených viac než jeden". Urobené: keď kontrolou
prejde viac než jeden, tak ako to od nálezu 47 robia widgety na vlastnej dropzóne
(`ImageWidgetInner.vue:337`). Dôvod: pri dvojici „zlý, platný" by text „použije sa prvý" neplatil (prvý bol odmietnutý
a je vymenovaný v druhom upozornení). Pripína to ohyb `input-warns-by-dropped`. Ak má platiť doslovné znenie, je to
jeden riadok (`:82`).

## FE-8 (82): tlačidlá hromadných operácií galérie menujú svoje pole

**Čo sa mení v kóde.** `ImageMassOperations.vue:40-42` a šesť `aria-label` (`:113,129,168,184,214,230`): existujúce
kľúče `fillOneEmptyField` a `replaceOneField` s menovkou poľa (popis, autori, zdroj podľa `sourceLabel`), ako
`AssetQueueSelectedSidebar.vue:42-43`. Bubliny ostávajú na `fillOneEmpty` a `replaceOne`.

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, `AImageMassOperations` nad galériou: čítačka povie „Vyplňte
prázdne pole: Popis", „Nahradiť všade: Popis" a to isté pre druhé pole (autori, alebo zdroj pod menom aplikácie).
Doteraz mali obe dvojice rovnaké dve mená. Viditeľne sa nemení nič.

**Na backend.** Nič.

## FE-9 (67): „+" na chipe konfliktu autora sa volá „Pridať autora"

**Čo sa mení v kóde.** `AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:48`:
`close-label="common.damImage.author.button.addConflict"`; nový kľúč v sk, en a cs (`damImage.json:204`).
`VChip` meno prekladá sám (`VChip.js:133-134`), cez i18n aplikácie (`createAnzuVuetify`,
`commonVuetifyConfig.ts:167-172`), preto dostáva kľúč, nie hotový text. Hotový text by vue-i18n hľadal ako kľúč
a obsluha `missing` aplikácií by pri každom vykreslení chipu písala do konzoly „Missing sk translation: Pridať
autora" (`admin-cms/src/plugins/i18n.ts:23-27`). Všetkých šesť aplikácií aj ihrisko prekladajú Vuetify cez vue-i18n
(`plugins/vuetify.ts`).

Kľúč v atribúte stráž `src/test/i18nLiteralKeys.test.ts` nevidela (pozná `t('…')` a atribúty `…-t`), preto jej
pribudol vzor pre `close-label="…"` (`:29-30`).

**Čo sa mení pre používateľa.** admin-cms (a všade, kde sa ponúkajú konflikty autorov): čítačka povie na „+" chipu
„Pridať autora" namiesto „Zatvoriť". Viditeľne nič.

**Na backend.** Nič.

## Testy a prečo vedia zlyhať

- `AFileInput.test.ts` (+11): skutočná dropzóna a skutočné pustenie. Jeden súbor: platný za odmietnutým (typ, veľkosť);
  prvý z viacerých platných s upozornením; obe upozornenia naraz; jeden súbor bez slova; nič platné; výber cez vstup
  ako doteraz (štyri tvary, aj dva súbory podstrčené skriptom). `multiple`: všetky platné, bez upozornenia o počte.
- `consumerProfileImageWidgetUpload.test.ts` (obe aplikácie, oba widgety, +8): pustenie do dialógu „Nahrať obrázok":
  platný za odmietnutým sa zaradí; z dvoch platných prvý a jedno upozornenie.
- `consumerProfileImageMassOperations.test.ts` (nový, 12: admin-cms s autormi DAM a bez nich, admin-ugc): mená
  štyroch tlačidiel podľa poľa a navzájom rôzne; bubliny bez poľa; každé tlačidlo urobí so svojím poľom, čo hovorí
  jeho meno (popis; autori s menami z DAM, alebo zdroj).
- `damAuthorConflictChipName.test.ts` (nový, 3): chip s Vuetify knižnice nad vue-i18n so správami sk, en, cs: meno
  „+" v každom jazyku, nie „Zatvoriť"; klik pridá autora.
- `src/test/i18nLiteralKeys.test.ts`: nový vzor (počet prípadov sa nemení).

Starší `ImageMassOperations.test.ts` nahrádza moduly a nemenil sa.

**Dôkaz** (v pamäti, `vitest.bend.config.mts`, snímok `OP-L3`; `scratchpad/opl3-bend.sh`, výpisy
`scratchpad/opl3-bend-*.log`, `opl3-old.log`):

| Ohyb | Zlyhá |
|---|---|
| tri komponenty a tri súbory textov zo snímku | 28 / 92 |
| pustenie berie prvý pustený (po starom) | 13 |
| bez upozornenia o jednom súbore | 6 |
| upozornenie podľa počtu pustených, nie platných | 7 |
| ďalej idú všetky platné | 6 |
| `multiple` ako jeden súbor | 1 |
| popis: meno bez poľa | 9 |
| autori pomenovaní zdrojom | 3 (admin-cms s autormi) |
| zdroj: obe tlačidlá „vyplniť" | 6 |
| „nahradiť" popisu pomenované zdrojom | 11 |
| chip bez `close-label` | 3 |
| kľúč chýba v sk / en / cs (zvlášť) | 2 (jazyk chipu a stráž kľúčov) |

**Behy.** Cielené (`scratchpad/opl3-run.sh`): 51 súborov / 918 zelených (`ui/file`, `dam/imageWidget`, `dam/__tests__`,
`dam/author`, `src/test/a11y`, `src/plugins`, stráž kľúčov); po oprave typu v jednom teste ešte 7 súborov / 99.
`oxfmt` (aj tri JSON), `oxlint`, `eslint` čisté, `lint:tsc` 0. **CK-LIB OP-L3 zelená** (`vysledky/OP-L3-ck.log`):
`test:browser` 314 súborov / 4 355 testov (OP-L2 +2 súbory, +34), `test:eslint` 7 / 82, ostatné čisté.

## Texty na potvrdenie

| Kľúč | sk | en | cs |
|---|---|---|---|
| `common.damImage.author.button.addConflict` | Pridať autora | Add author | Přidat autora |

Znenia sú zo zadania; vlastník ich potvrdí. Nový je len tento kľúč. `upload.onlyOneFile` (FE-6) a
`fillOneEmptyField`, `replaceOneField` (FE-8) sú existujúce texty na novom mieste.

## Nové nálezy (nemenené)

- **Hromadné vyplnenie autorov galérie dáva riadkom spoločný zoznam.** `useImageMassOperations.ts:56`:
  `item.damAuthors = value` priradí každému obrázku to isté pole (to, ktoré drží formulár operácií). Fronta uploadu
  dáva každému riadku kópiu (`uploadQueueFill.ts:39,54`). Dôsledok som nenašiel: výber autorov v riadku aj vo
  formulári pole pri zmene nahrádza novým.
- **`AFileInput` používa text z `damImage`.** `upload.onlyOneFile` je v súbore textov DAM a číta ho všeobecný
  komponent vstupu súboru (`AFileInput.vue:82`). Funguje; ak má byť text všeobecný, patrí pod `common.system.upload`.
- **Upozornenie o formáte v dialógu teraz menuje aj súbory, ktoré by sa aj tak nepoužili** (platný a za ním
  zlý: nahrá sa platný a zlý je vymenovaný). Plynie z „skontrolovať všetky pustené"; widgety na vlastnej dropzóne to
  robia rovnako.

## Cyklus 1 (OP-L-c1, 12. 10.; posudky Codex a Opus)

FE-6, FE-8 a FE-9 bez nálezu; odchýlka FE-6 a kľúč v `close-label` (FE-9) posúdené ako správne. V kóde tohto kroku sa
v cykle nemenilo nič (cyklus je zapísaný v `OP-L1.md` a `OP-L2.md`).

**Nový nález z posudkov (nemenený).** „+" každého chipu konfliktu má teraz rovnaké prístupné meno („Pridať autora");
`close-label` meno autora niesť nevie, lebo ho Vuetify prekladá ako kľúč bez parametrov.
