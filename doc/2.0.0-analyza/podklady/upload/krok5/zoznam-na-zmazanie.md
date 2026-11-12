# Zoznam na zmazanie po kroku 5 (U9)

Do 11. 10. sa z tohto zoznamu nič nemazalo. **Zmazané 11. 10. so súhlasom vlastníka (krok U9a, snímok a záplata
`U9a`):** časť 1 celá (18 súborov kódu, 9 ikon a dva priečinky, ktoré po nich ostali prázdne: `src/assets/meta-icons`
a `src/domains/coreDam/shared/components/customMetadata`) a časť 2 (štyri exporty). **Zmazané 11. 10. (krok U9b,
snímok a záplata `U9b`):** časť 7, všetkých 28 kľúčov v `sk` aj `en`, a k nim päť kľúčov `coreDam.asset.metaIcons`
(`fullHd`, `2k`, `qhd`, `4k`, `8k`), ktoré nepýtal nikto už pred krokom 5; prázdne objekty `metaIcons`,
`assetFileFailReason`, `author.button` a `author.meta` zanikli. Overenie pred zmazaním: doslovný výskyt, skladanie z
predpony aj z prípony a všetky miesta, kde sa kľúč podáva premennou, v `src` a `e2e` admin-dam aj v `src` knižnice
(skript `kluce-over.py`); kľúče sa skladajú len ako `system.entita.model.*`, `system.entita.filter.*` a
`error.apiForbiddenOperation.*`. **Zmazané 11. 10. (krok U9c, snímok a záplata `U9c`):** časť 4, všetkých sedem
súborov, a priečinok `src/domains/coreDam/user/types`, ktorý po nich ostal prázdny. Overenie pred zmazaním (skript
`sedem-over.py`, 1 075 súborov admin-dam vrátane `e2e`, skriptov, konfigurácií a generovaných `.d.ts`): meno súboru,
kebab meno komponentu a každý vyvezený symbol sa mimo sedmičky nevyskytuje; jediný nedoslovný `import()` je
`./locales/${code}.ts`; `import.meta.glob` je len v testoch a číta zdroje ako text; žiadny `defineAsyncComponent`,
`resolveComponent`, globálna registrácia komponentov ani plugin automatického importu komponentov. Mená súborov ostali
v `scripts/explicit-imports.manifest.json` (záznam jednorazového codemodu k jeho vstupnému commitu, nik ho nečíta) a
v starších changelogoch. Časti 5 a 6 a časť „LIB a PRACA" ostávajú na rozhodnutie vlastníka (stav 18. 10.: časť 5 vybavená, časť 6 zmazaná, z „LIB a PRACA" ostáva posledné zmazanie).

**Zmazané 18. 10. (vlastník: „upracme"):** DAM časť 6 a LIB časť 1, teda všetky priečinky `vitest-tmp-*` v
`node_modules/.cache` oboch repozitárov (28 v admin-dam, 26 v knižnici, spolu asi 53 GB; od kroku Z ich pribudlo), k tomu
`tsc-app-probe.tsbuildinfo` a `tsc-test-probe.tsbuildinfo` knižnice a 24 pozostatkov vitestu v `/tmp` (14. a 15. 10.,
292 MB). Predtým overené, že nebeží žiadny vitest. Voľné súbory z priečinkov (konfigurácie ohnutí a starého kódu,
`w4-*`, `*-applied`, spolu 2 435 súborov, 3,3 MB) sú skopírované s celou cestou do `krok5-praca/zaloha-cache/`
a zmiznú s PRACA. `ck-lib.sh` a `ck-dam.sh` si svoj priečinok vytvoria znova. Ostáva posledné zmazanie (worktree
`lib-u` a PRACA), až po tagu.

## DAM (U9a)

Strom `/home/volar/projects/anzusystems/admin-dam`, stav po C3-c1 a PV16-D-c1 (CK-DAM 73 súborov / 1 286 testov).
Zostavil impl-dam v kroku Z; `src` sa pritom nemenil.

**Ako som overoval** (skript `z-dam-dead.py` v scratchpade, len čítanie):
- Pre každý súbor som hľadal jeho import podľa cesty `@/…` (s príponou aj bez) a relatívny import z toho istého
  priečinka, v celom `src` (`.ts`, `.vue`, `.scss`, `.mts`, `.json`).
- V `e2e` som hľadal jeho meno ako slovo.
- Nehľadal som dynamické importy skladané z častí ani globálne registrované komponenty podľa mena.
- Cesty sú od koreňa stromu admin-dam.

### 1. Súbory bez importéra po kroku 5

Žiadny z nich neimportuje živý kód ani test a `e2e` ich nespomína. Stĺpec „importuje ho" uvádza len iný súbor
z tohto zoznamu.

| Súbor | Importuje ho | Od kroku |
|---|---|---|
| `src/domains/coreDam/asset/components/AssetImage.vue` | nik | U3 (obrázok), U5c (riadok fronty) |
| `src/domains/coreDam/asset/components/AssetImageMetaIcons.vue` | `AssetImage.vue` | U3 |
| `src/domains/coreDam/asset/components/assetImageIconsConfig.ts` | `AssetImageMetaIcons.vue` | U3 |
| `src/assets/meta-icons/2k.svg`, `4k.svg`, `8k.svg`, `fhd.svg`, `low.svg`, `qhd.svg`, `rss.svg`, `slot.svg`, `tts.svg` (celý priečinok, 9 súborov) | `assetImageIconsConfig.ts` | U3 |
| `src/domains/coreDam/shared/services/upload/fileValidation.ts` | nik | U3 |
| `src/domains/coreDam/asset/composables/windowFilesDragWatcher.ts` | nik | U3 |
| `src/domains/coreDam/asset/components/footer/AssetFooterUploadButtonStop.vue` | nik | U5a |
| `src/domains/coreDam/shared/components/customMetadata/AssetCustomMetadataFormMassOperations.vue` | nik | U5b |
| `src/domains/coreDam/shared/components/customMetadata/AssetCustomMetadataForm.vue` | nik | U5c |
| `src/domains/coreDam/keyword/components/KeywordRemoteAutocompleteWithCached.vue` | nik | U5c |
| `src/domains/coreDam/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue` | `KeywordRemoteAutocompleteWithCached.vue` | U5c |
| `src/domains/coreDam/author/components/AuthorRemoteAutocompleteWithCached.vue` | nik | U5c |
| `src/domains/coreDam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue` | `AuthorRemoteAutocompleteWithCached.vue` | U5c |
| `src/domains/coreDam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue` | `AuthorRemoteAutocompleteWithCached.vue` | U5c |
| `src/domains/coreDam/author/components/AuthorCreateButton.vue` | `AuthorRemoteAutocompleteWithCached.vue` | U5c |
| `src/domains/coreDam/asset/components/AssetFileFailReasonChip.vue` | nik | U5c |
| `src/domains/coreDam/asset/valueObject/AssetFileFailReason.ts` | `AssetFileFailReasonChip.vue` | U5c |
| `src/domains/coreDam/author/composables/authorConfig.ts` | nik | U5c |
| `src/domains/coreDam/keyword/composables/keywordConfig.ts` | nik | U5c |

- Spolu 18 súborov kódu a 9 ikon.
- Mazať treba celú skupinu naraz: súbory sa importujú navzájom a zmazanie len časti rozbije `lint:tsc`.
- JPEG zástupcu `src/assets/image/placeholder16x9.jpg` **nemazať**, používajú ho štyri iné súbory.
- **Testy, ktoré ich čítajú podľa cesty: žiadne.** Posledné sa prepli v U5a, U5b a U5c. Mŕtva náhrada
  `AssetImage.vue` v `queueRowValidation.test.ts` vypadla s prepisom v U5c.

### 2. Exporty bez volajúceho (súbor ostáva, maže sa len export)

Používal ich už len niektorý súbor z časti 1.

| Export | Kde | Používal ho |
|---|---|---|
| `useCreateAuthor` | `src/domains/coreDam/author/api/authorApi.ts:28` | `AuthorCreateButton.vue` |
| `AuthorCreateValidationScopeSymbol` | `src/domains/coreDam/shared/validationScopes.ts:3` | `AuthorCreateButton.vue` |
| `useCachedAuthorsForRemoteAutocomplete` | `src/domains/coreDam/author/composables/cachedAuthors.ts` | `AuthorRemoteAutocompleteWithCached.vue` |
| `useCachedKeywordsForRemoteAutocomplete` | `src/domains/coreDam/keyword/composables/cachedKeywords.ts` | `KeywordRemoteAutocompleteWithCached.vue` |

Meno každého z nich sa v živom kóde, v testoch ani vo vlastnom module inde nevyskytuje.

### 3. Nemazať, hoci to tak môže vyzerať

- `prime` vo väzbe zoznamu (`src/domains/coreDam/asset/components/queue/AssetQueueEditable.vue`): nestráži ho
  žiadny test, ale nie je mŕtvy. Pre typ assetu s vypnutými kľúčovými slovami alebo autormi je jediný, kto si tie
  mená vypýta (posudok U5c).
- `resetList()` v `src/domains/coreDam/asset/store/distributionListStore.ts`: po PV16-D-c1 ho nikto nevolá. Je to
  staršia akcia skladu, nie zvyšok kroku 5. Na rozhodnutie.

### 4. Šesť modulov bez importéra už na HEAD (mimo kroku 5, na vedomie)

| Súbor | Poznámka |
|---|---|
| `src/domains/coreDam/asset/api/assetCustomFormApi.ts` | nik |
| `src/domains/coreDam/asset/components/list/components/AssetListItemImage.vue` | nik |
| `src/domains/coreDam/asset/components/toolbar/AssetToolbarExtSystemLicence.vue` | nik |
| `src/domains/system/composables/userDisplayHelper.ts` | nik |
| `src/domains/coreDam/user/types/User.ts` | importuje ho len `userDisplayHelper.ts`. Hľadanie mena v `e2e` našlo slovo „User" v `e2e/tests/settings/user.spec.ts` a `userPermission.spec.ts`; je to bežné slovo, nie import tohto súboru (`types/User` sa v `e2e` nevyskytuje) |
| `src/domains/coreDam/job/composables/jobValidations.ts` | nik |
| `src/domains/coreDam/distributionCategorySelect/composables/distributionCategorySelectValidation.ts` | nik |

Sedem súborov v šiestich moduloch (`User.ts` patrí k `userDisplayHelper.ts`).

### 5. Na rozhodnutie: augmentácia v `src/plugins.d.ts` (nález 71)

**Stav 18. 10.: vybavené.** Mŕtvu deklaráciu v `declare module '@anzusystems/common-admin'` zmazali kroky OP-D
(12. 10., `overenie-nalezov.md`, nález 71 s `resetList()`); v `src/plugins.d.ts:32` ostala len deklarácia
pre `vue-i18n`.

`src/plugins.d.ts:29`: `export interface DefineLocaleMessage extends MessageSchema {}` vnútri
`declare module '@anzusystems/common-admin'`. Podľa nálezu 71 je mŕtva; tú istú deklaráciu má `declare module
'vue-i18n'` o tri riadky nižšie (`:33`). Neodstraňoval som ju a neoveroval, čo by jej zmazanie urobilo s typmi.
Rozhodne vlastník.

### 6. Priečinky dočasných súborov testov

`du -sh /home/volar/projects/anzusystems/admin-dam/node_modules/.cache/vitest-tmp-*` (stav pri kroku Z):

| Priečinok | Veľkosť |
|---|---|
| `node_modules/.cache/vitest-tmp-impl-dam` | 6,6 G |
| `node_modules/.cache/vitest-tmp-dam-c` | 5,7 G |
| `node_modules/.cache/vitest-tmp-testy-dam` | 3,0 G |
| `node_modules/.cache/vitest-tmp-dam-w4` | 2,1 G |
| `node_modules/.cache/vitest-tmp-dam-b` | 708 M |
| `node_modules/.cache/vitest-tmp-main` | 438 M |
| `node_modules/.cache/vitest-tmp-dam` | 337 M |
| `node_modules/.cache/vitest-tmp-overenia` | 103 M |
| `node_modules/.cache/vitest-tmp-vedouci` | 71 M |
| `node_modules/.cache/vitest-tmp-veduci` | 44 M |
| `node_modules/.cache/vitest-tmp-overenie49` | 27 M |

- Spolu 11 priečinkov, asi 19 G.
- `vitest-tmp-impl-dam` je môj. Okrem dočasných súborov vitestu drží konfigurácie ohnutí a behov starého kódu
  (`vitest.k3-bend.config.mts`, `vitest.old.config.mts`), súbory úprav `*.json` a záznamy `*-applied.txt`. Nič z toho
  nie je v gite a po uzavretí kroku to netreba.
- Ostatné priečinky patria iným agentom a behom; ich obsah som nečítal.

### 7. Nepovinné (U9b): kľúče jazykov, ktoré už žiadny kód nepýta

Hľadané ako doslovný reťazec kľúča v `src` mimo `src/locales`. Kľúč skladaný z častí by toto hľadanie nevidelo; pri
týchto kľúčoch som skladanie v kóde nenašiel. Platí pre `sk` aj `en` (rovnaké kľúče).

Pýtali ich len súbory z časti 1:
- `system.upload.stop`, `system.upload.stopConfirmQuestion` (`AssetFooterUploadButtonStop.vue`);
- `system.upload.uploading`, `system.upload.processing`, `system.upload.waiting`, `system.upload.done`
  (`AssetImage.vue`);
- `coreDam.asset.metaIcons.low`, `.rss`, `.slots`, `.tts` (`AssetImageMetaIcons.vue`);
- `coreDam.asset.assetFileFailReason.none`, `.unknown`, `.invalidChecksum`, `.invalidMimeType`, `.downloadFailed`,
  `.invalidSize` (`AssetFileFailReason.ts`);
- `coreDam.asset.massOperations.fillOneEmpty`, `.replaceOne` (`AssetCustomMetadataFormMassOperations.vue`);
- `coreDam.author.button.add`, `coreDam.author.meta.create` (`AuthorCreateButton.vue`).

Nepýta ich už nik, ani súbory z časti 1 (texty sidebaru a riadku, ktoré sa v U5b a U5c stali obalmi):
- `coreDam.asset.massOperations.description`, `.general`, `.fillAllEmpty`, `.replaceAll`, `.clearForm`;
- `coreDam.asset.queueItem.error`, `.copyAssetId`, `.displayTitle`.

Spolu 28 kľúčov. Hľadal som len v menných priestoroch, ktorých sa krok 5 dotkol (`system.upload`,
`system.uploadErrors`, `coreDam.asset.queueItem`, `.massOperations`, `.metaIcons`, `.assetFileFailReason`,
`coreDam.author.button`, `.meta`, `coreDam.keyword.button`, `.meta`); ostatné jazykové súbory som neprechádzal.

## LIB a PRACA

Zostavil impl-komp-lib v kroku Z (11. 10.); nič sa nemazalo a `src` knižnice sa nemenil. Strom
`/home/volar/projects/anzusystems/common-admin` po PV14b-c2 (CK-LIB 311 súborov / 4 254 testov). Veľkosti sú z `du`
pri kroku Z.

**V `src` knižnice krok 5 nenechal žiadny súbor na zmazanie** (poznámky krokov LIB žiadny neuvádzajú).

### 1. Priečinky dočasných súborov testov knižnice

Pod `/home/volar/projects/anzusystems/common-admin/node_modules/.cache/`:

| Priečinok | Veľkosť |
|---|---|
| `vitest-tmp-impl-komp-lib` | 14 M |
| `vitest-tmp-main` | 13 M |
| `vitest-tmp-lib-c1a` | 2,8 M |
| `vitest-tmp-lib-c1b` | 2,8 M |
| `vitest-tmp-lib-w4` | 2,5 M |
| `vitest-tmp-testy-k2` | 1,6 M |
| `vitest-tmp-jadro-lib` | 1,5 M |
| `vitest-tmp-komp-lib` | 904 K |
| `vitest-tmp-testy-lib` | 892 K |
| `vitest-tmp-vedouci` | 752 K |
| `vitest-tmp-veduci` | 752 K |
| `vitest-tmp-lib-b` | 4 K |
| `vitest-tmp-overenia` | 4 K |

- Spolu 13 priečinkov, asi 41 M.
- Vedúci ich v kroku Z zaradil do posledného zmazania (plán 2.8 ich mal v prvom). Na vedomie: ohnutia prípadného
  neskorého cyklu potrebujú `vitest.bend.config.mts` z `vitest-tmp-impl-komp-lib`.
- `vitest-tmp-impl-komp-lib` a `vitest-tmp-komp-lib` sú moje. Okrem dočasných súborov vitestu držia konfigurácie
  ohnutí a behov starého kódu (`vitest.bend.config.mts`, `vitest.n39l.config.mts`), súbory ohnutí `bend-*.json` a
  záznamy `*-applied.txt`. Nič z toho nie je v gite a po uzavretí kroku to netreba.
- Ostatné priečinky patria iným agentom a behom; ich obsah som nečítal.
- `node_modules/.cache/tsc` (1,1 M) sem nepatrí: nie je to priečinok kroku 5.

### 2. Posledné zmazanie: worktree `lib-u` a celá PRACA

Až keď vlastník krok 5 uzavrie, v tomto poradí (plán 2.8, Z bod 8):

| # | Cesta | Čo to je | Veľkosť |
|---|---|---|---|
| 1 | `/home/volar/projects/anzusystems/krok5-praca/wt/lib-u` | worktree gitu knižnice (`03c3a108`, odpojený HEAD), od I1 zmrazený | `wt` spolu 499 M |
| 2 | `/home/volar/projects/anzusystems/krok5-praca/wt/lib-u-zaklad` | obyčajný priečinok (len `src`), nie worktree; ide s PRACA | v tých 499 M |
| 3 | `/home/volar/projects/anzusystems/krok5-praca` | celá PRACA: `nastroje`, `zamok.lock`, `snap` (1 003 M), `kos`, `ohyb`, `zaplaty` (2,1 M), `vysledky` (164 M), `znacky` (7,9 M), `balik` (44 M), `wt` | 1,7 G |

- **`lib-u` sa neodstraňuje mazaním priečinka.** Najprv kontrola vedúceho
  `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/kontrola-lib-u.sh` (kód 0), potom vlastník
  `git -C /home/volar/projects/anzusystems/common-admin worktree remove --force /home/volar/projects/anzusystems/krok5-praca/wt/lib-u`.
  Zmazanie PRACA pred odstránením worktree by nechalo v gite záznam „prunable".
- **`git worktree prune` sa nespúšťa.** `git worktree list` ukazuje aj cudzí worktree `common-admin-main-sync` v
  `/tmp/claude-1000/…/0c60a27e-…/scratchpad/` (vetva `chore/main-from-1.47.0-beta.dev-1784059879-fix1`), označený
  „prunable"; `prune` by odstránil aj jeho záznam. Nie je z kroku 5.
- **PRACA sa maže posledná.** Kým práca kroku 5 nie je v commite, `zaplaty` (rozdiely každého kroku a cyklu) a `snap`
  (snímky pred každým krokom) sú jediný záznam o tom, čo ktorý krok zmenil, a `nastroje` so zámkom treba na `ck-lib.sh`
  a `ck-dam.sh` po prvom zmazaní.
- `kos` drží jediný súbor `probe2` (0 bajtov).
