# COLLAB-OXLINT: eslint + prettier → oxlint + oxfmt v kolaboračnom serveri

Analýza bez zásahu do repozitárov. Kolaboračný server `/home/volar/projects/petit/collaboration` (vetva `next`), porovnanie
s `petit/admin-cms` (hlavný vzor), `anzusystems/admin-dam` a `anzusystems/common-admin`. Pracovný priečinok so skriptami,
konfiguráciami a surovými výsledkami: `/home/volar/projects/anzusystems/krok5-praca/oxlint-analyza/` (podrobnosti
v časti 7). Merané 22. 10. 2026.

Snímka kolaborácie (`oxlint-analyza/kopia.info`): HEAD `c8d96a2`, k tomu rozpracované zmeny agenta TS 6 v `package.json`
(`typescript ^6.0.3`), `tsconfig.json` (nodenext, es2025, `types: ["node"]`, `rootDir: src`) a `yarn.lock`. Kópia: `src`
(+ `test`) = 118 súborov `.ts` a 1 `.json`, plus `tsconfig.json`, `vitest.config.mts`, `eslint.config.mjs`,
`.prettierrc.js`, `.prettierignore`, `.gitignore`, `.editorconfig`, `package.json`; `node_modules` je symlink na
kolaboráciu. oxlint 1.89.0 a oxfmt 0.74.0 sú binárky z `admin-cms/node_modules`, `oxlint --type-aware` (tsgolint)
bežal raz so súhlasom vedúceho. eslint, prettier, tsc ani testy sa nespúšťali.

Značky: **[overené]** = prečítané v súbore alebo zmerané na kópii; **[dok]** = z dokumentácie cez ctx7;
**[odvodené]** = úsudok, nemerané.

## Verdikt

- **Odporúčam možnosť A: oxlint + oxfmt, eslint a prettier preč.** Kolaborácia nemá nič, kvôli čomu admini eslint
  nechávajú (Vue šablóny, pinia, vuetify, vlastné pravidlá `anzu/*`, `prefer-const` vo `.vue`). Veľkosť S.
- **Pokrytie pravidiel:** konfigurácia eslint dáva súboru `.ts` 74 pravidiel. oxlint má 66 z nich: 65 stabilných
  a `no-useless-assignment` ako nursery. Chýba 1 (`no-octal`), ktoré v module ESM aj tak stráži parser a TS. Zvyšných
  7 formátovacích pravidiel nahrádza formátovač, `max-len` len čiastočne (dlhé komentáre a reťazce nikto nekontroluje;
  dnes je ich 0). **[overené]**
- **Typové pravidlá: kolaborácia žiadne nepoužíva** (bez `parserOptions.project` a bez `*-type-checked`), takže
  prenášať nie je čo. oxlint `--type-aware` (tsgolint 7.0.2004 nad typescript-go 7.0.2, 60 z 62 typových pravidiel
  typescript-eslint) **na projekte s TS 6 funguje: jeden beh trval 2,2 s a zabral ~0,7 GB RAM.** 15 typových pravidiel,
  ktoré sú v `correctness` zapnuté samy, dalo 32 drobných nálezov; `no-floating-promises` a `await-thenable` 0. Pri
  `strict: false` je 5 pravidiel bez úžitku a snímka `test/tsconfig.json` mala chybu `rootDir`, agent TS 6 ju medzitým
  opravil. Je to neskorší voliteľný krok, nie súčasť prechodu. **[overené]** (časť 2.3)
- **Formát:** oxfmt s ekvivalentom `.prettierrc.js` mení **1 súbor zo 119 (+3 −1)**, jeden union typ. S konfiguráciou
  adminov (`sortImports`) mení **69 súborov (+268 −195)**, celé je to radenie importov. Spolu s importovými pravidlami
  oxlint adminov je jednorazová zmena **70 súborov, +273 −202** a po dvoch behoch `lint:fix` je `ci` čisté. **[overené]**
- **oxlint na kópii:** zrkadlo terajšieho eslint má **0 nálezov** (81 pravidiel, 121 súborov), konfigurácia adminov
  **7 chýb** (všetky importové a opraviteľné automaticky) + 3 nepoužité direktívy. **[overené]**
- **TypeScript 7:** jediné balíky v strome kolaborácie s peer na `typescript` sú `@typescript-eslint/*` 8.72
  (`>=4.8.4 <6.1.0`) a ich `ts-api-utils`. Parser pri TS ≥ 7 zlyhá (`@typescript-eslint/parser/dist/index.js:42`).
  Možnosť A tento blok odstráni úplne, možnosti B a C ho nechajú. **[overené]**

## 1. Súčasný stav

### 1.1 Kolaborácia [overené]

| čo | kde | hodnota |
|---|---|---|
| `ci` | `package.json:9` | `run-s --print-name lint:tsc lint:tsc:test lint:prettier lint:eslint` |
| `lint` | `package.json:10` | `--fix` → `lint:fix`, bez argumentov → `ci` |
| `lint:fix` | `package.json:11` | `run-s --print-name lint:tsc lint:tsc:test lint:prettier:fix lint:eslint:fix` |
| `lint:eslint(:fix)` | `package.json:14-15` | `eslint` / `eslint --fix` (bez ciest: celý projekt) |
| `lint:prettier(:fix)` | `package.json:16-17` | `prettier -c/-w "{src,test}/**/*.{ts,vue}"` (`.vue` tu nie je žiadne) |
| `build` | `package.json:20` | `yarn clean && yarn lint && tsc`, `production` (`:21`) = `build` + Sentry sourcemaps |
| devDependencies | `package.json:123-139` | `@eslint/compat ^2.1.1`, `@eslint/eslintrc ^3.3.7`, `@eslint/js ^10.0.1`, `@rushstack/eslint-patch ^1.16.1`, `@typescript-eslint/eslint-plugin ^8.72.0`, `@typescript-eslint/parser ^8.72.0`, `eslint ^10.13.0`, `globals ^17.13.0`, `npm-run-all2 ^9.0.3`, `prettier 3.9.10` |
| nainštalované | `node_modules/*/package.json` | eslint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0 (peer `typescript >=4.8.4 <6.1.0`), prettier 3.9.10, typescript 6.0.3 |
| `typescript` | `package.json:113` | v `dependencies`: HEAD `^5.9.3`, pracovný strom `^6.0.3` |

`eslint.config.mjs`:

- `:7-16` – starý formát cez `FlatCompat` (`@eslint/eslintrc`), `:23-27` `extends` `eslint:recommended`,
  `plugin:@typescript-eslint/eslint-recommended` a `plugin:@typescript-eslint/recommended`.
- `:33-42` – globály `browser` + `node`, parser `@typescript-eslint/parser`. **Bez `parserOptions.project`
  a `projectService`, žiadna typová informácia.**
- `:45-47` – vypnuté `ban-ts-comment`, `no-explicit-any` a `no-empty-interface` (to posledné v recommended v8 nie je,
  takže nič nemení).
- `:48-82` – sedem formátovacích pravidiel jadra: `semi: never`, `quotes: single, avoid-escape`,
  `object-curly-spacing: always`, `no-multiple-empty-lines {max 1, maxEOF 1}`, `no-trailing-spaces`, `comma-dangle`
  (polia a objekty `always-multiline`, importy, exporty a funkcie `only-multiline`) a `max-len 120` (výnimky: koncové
  komentáre, URL, regexy, riadky `import`). V eslint 10.13 sú zastarané, s `availableUntil: "11.0.0"`
  (`node_modules/eslint/lib/rules/semi.js:22-26`).
- `:21` – `ignores: ['docs/**/*']` nič nerobí, priečinok sa volá `doc`. `:85` – `includeIgnoreFile(.gitignore)`.
- Súbory: override z `eslint-recommended` pridá `**/*.ts`, `**/*.mts`, `**/*.cts`, `**/*.tsx`, eslint k nim lintuje aj
  predvolené `*.js`/`*.mjs`. Spolu 121 súborov (118 `.ts`, `vitest.config.mts`, `eslint.config.mjs` a `.prettierrc.js`):
  oxlint lintuje presne tú istú množinu (`vysledky/oxlint-files.txt`); pri eslint je to odvodené z konfigurácie.

`.prettierrc.js:1-8`: `printWidth 120`, `semi false`, `singleQuote`, `bracketSameLine false`, `trailingComma es5`,
`singleAttributePerLine` (posledné dve platia len pre JSX/HTML/Vue). `.prettierignore`: `node_modules`, `dist`.

Direktívy v kóde: 3× `// eslint-disable-next-line @typescript-eslint/no-unused-vars` nad nepoužitým `catch (error)`
(`src/util/authorization.ts:25`, `src/server/event/listener/changeFieldDataListener.ts:48`,
`src/server/document/onRequestHook.ts:46`) a 5× `// @ts-ignore`. `@rushstack/eslint-patch` sa nikde nepoužíva, je len
v `package.json`.

Východisko: posledný `yarn ci` iného agenta (`krok5-praca/collab-opravy/kontrola-ci-2.log`, 22. 10. 02:42) prešiel:
prettier „All matched files use Prettier code style!", eslint bez výstupu.

CI: `azure-pipelines.yml:22-33` rozširuje `node-ci.yaml@templates` s `runYarnBuild: true` a `runYarnTest: true`
(`runYarnCI` nie). Šablóna spúšťa `yarnBuildCommand`, predvolene `yarn run build` (kópia šablóny:
`krok5-praca/collab-opravy/template-yarn.yaml:59-61, 106-121`). Lint v CI teda beží reťazcom
`build` → `lint` → `ci`. Release (`node-release-k8s`) stavia tiež cez build a obraz kopíruje `dist` aj `node_modules`
(`docker/app/kubernetes/Dockerfile:11-12`), takže dev nástroje idú do obrazu [odvodené: šablóna releasu sa nečítala
celá]. `azure-pipelines.yml` sa pri žiadnej možnosti meniť nemusí.

### 1.2 Admini [overené]

| | admin-cms | admin-dam | common-admin |
|---|---|---|---|
| oxlint | `1.89.0` (`package.json:123`) | `1.89.0` (`:98`) | `1.89.0` |
| eslint-plugin-oxlint | `1.89.0` (`:115`) | `1.89.0` | `1.89.0` |
| oxfmt | `^0.74.0` (`:122`) | `^0.74.0` (`:97`) | `^0.74.0` |
| eslint | `10.13.0` (`:114`) | `10.13.0` (`:89`) | `^10.13.0` |
| ďalší eslint | `@vue/eslint-config-typescript ^14.9.0`, `eslint-plugin-vue 10.11.1`, `eslint-plugin-pinia`, `eslint-plugin-vuetify`, `vue-eslint-parser` | rovnako | rovnako + `@typescript-eslint/parser` |
| prettier | nie (0 výskytov v `package.json`) | nie | nie |
| typescript | `~6.0.3` (`:134`) | `~6.0.3` (`:107`) | `~6.0.3` |

Nainštalované v admin-cms: oxlint 1.89.0 (voliteľný peer `oxlint-tsgolint >=7.0.2003`, `oxlint-tsgolint` nie je
nainštalovaný), oxfmt 0.74.0 (závislosť len `tinypool`), eslint-plugin-oxlint 1.89.0 (peer `oxlint ~1.89.0`).
Aktuálne verzie na npm (22. 10.): oxlint 1.89.0, oxfmt 0.74.0, oxlint-tsgolint 7.0.2004, @oxlint/migrate 1.89.0.

Skripty admin-cms (`package.json:18-31`, admin-dam `:17-31` rovnako):

```
ci          run-s --print-name generate:dts ci:checks
ci:checks   run-p --aggregate-output --continue-on-error --print-label --silent ci:lint test
ci:lint     run-p ... lint:tsc format:check lint:oxlint lint:eslint lint:stylelint
lint        [ "$*" = "--fix" ] && yarn lint:fix || yarn ci
lint:fix    run-s --print-name generate:dts lint:oxlint:fix lint:eslint:fix lint:stylelint:fix format
lint:oxlint      oxlint . --disable-nested-config          (:fix pridá --fix)
format(:check)   oxfmt --disable-nested-config src scripts env.d.ts vite.config.mts vitest.config.mts eslint.config.mjs [--check]
```

common-admin: `ci` = `run-p ... lint:tsc format:check lint:oxlint lint:eslint lint:stylelint` (`package.json:54`).
CI admin-cms: `runYarnCI: true` (`azure-pipelines.yml`), teda priamo `yarn run ci`.

Konfigurácie:

- `admin-cms/.oxlintrc.json` – `extends` `common-admin/src/eslint/oxlint-admin.json`, `env: browser`, `ignorePatterns`,
  `categories: { correctness: error }`. admin-dam rovnako. common-admin má vlastný `.oxlintrc.json` s tými istými
  pravidlami bez `extends`.
- `common-admin/src/eslint/oxlint-admin.json:5-43` – pluginy `eslint, typescript, unicorn, oxc, vue, import`;
  `no-unused-vars {caughtErrors: none}`, `no-unused-expressions: off`, `no-var`, `prefer-rest-params`, `prefer-spread`,
  päť pravidiel `typescript/*`, `vue/*`, `prefer-const: off` (oxlint ho vo `.vue` nespúšťa, `:26-28`) a importy:
  `sort-imports {ignoreDeclarationSort}`, `import/no-duplicates`, `import/consistent-type-specifier-style:
  prefer-top-level` (`:37-43`).
- `.oxfmtrc.json` (admin-cms = admin-dam): `printWidth 120`, `semi false`, `singleQuote`, `trailingComma es5`,
  `singleAttributePerLine`, `sortImports {sortSideEffects: false, partitionByComment: true}`, `ignorePatterns` ako
  zoznam povolených (`/*`, `!/src`, ...). common-admin rovnako, ale bez `sortImports`.
- `eslint.config.mjs` adminov = `defineAnzuAdminConfig` (`common-admin/src/eslint/adminConfig.mjs:73-253`): vue
  `flat/essential` + `strongly-recommended` + `recommended` (`:116-118`), `vueTsConfigs.recommended` (`:119`, **bez
  type-checked**), pinia (`:120-134`), vlastný plugin `anzu` (`:135`, `valid-route-name` číta šablónu cez
  `parserServices.defineTemplateBodyVisitor`, `validRouteName.mjs:120-122`), vue pravidlá (`:154-186`),
  `no-restricted-imports` (`:189-205`), vuetify (`:223`), `buildFromOxlintConfigFile` (`:227`, vypne v eslint všetko,
  čo beží v oxlint) a blok `owned-by-oxfmt` (`:236-249`, vypína pravidlá vue, ktoré sa bijú s oxfmt).
- **Prečo eslint u adminov zostáva:** šablóny Vue SFC (oxlint má 46 pravidiel `vue/*`, len pre script), pinia,
  vuetify, vlastné pravidlá `anzu/*` a `prefer-const` vo `.vue`. **Typové pravidlá to nie sú:** grep na
  `projectService|parserServices.program|recommendedTypeChecked|typeChecked` v konfiguráciách adminov nenájde nič.
  Jediná zmienka je komentár pri `configureVueProject` (`adminConfig.mjs:88`).
- Editor: `admin-cms/.vscode/extensions.json` odporúča `oxc.oxc-vscode` a `dbaeumer.vscode-eslint`, `settings.json`
  formátuje cez oxc a na uloženie spúšťa `source.fixAll.oxc` aj `source.fixAll.eslint`.

## 2. Pokrytie pravidiel

### 2.1 Mapa: 74 pravidiel aktívnych pre `*.ts` → oxlint 1.89 [overené]

Zdroj: `@eslint/js` 10.0.1 `eslint-recommended.js` (64 pravidiel), `typescript-eslint` 8.72
`eslint-recommended-raw.js` (pre `*.ts` vypne 19 pravidiel jadra a zapne 4) a `eslintrc/recommended.js`
(20 pravidiel, vypne jadrové `no-array-constructor`, `no-unused-expressions` a `no-unused-vars`). K tomu
`eslint.config.mjs:45-82`. Zoznam pravidiel oxlint: `oxlint --rules --format=json` (871 pravidiel, 60 typových).
Skript `02-mapa.py`, výstup `mapa.txt`/`mapa.json`. Kontrolu robil aj oficiálny `@oxlint/migrate@1.89.0`
(`migrate.log`): 81 pravidiel prenesených, preskočené len pravidlá uvedené nižšie.

| skupina | spolu | oxlint `correctness` (zapnuté samo) | treba zapnúť menom | chýba |
|---|---|---|---|---|
| eslint:recommended (bez vypnutých pre TS) | 45 | 36 | 8 | 1 |
| typescript-eslint eslint-recommended (zapína) | 4 | 0 | 4 | 0 |
| typescript-eslint recommended (bez 2 vypnutých v konfigurácii) | 18 | 12 | 6 | 0 |
| formátovacie v `eslint.config.mjs` | 7 | – | – | 7 (→ formátovač) |
| **spolu** | **74** | **48** | **18** | **8** |

Treba zapnúť menom (kategória v oxlint):

- eslint: `no-case-declarations` (pedantic), `no-empty` (restriction), `no-fallthrough` (pedantic),
  `no-prototype-builtins` (pedantic), `no-regex-spaces` (restriction), `no-unexpected-multiline` (suspicious),
  `preserve-caught-error` (suspicious), **`no-useless-assignment` (nursery = len čiastočne: oxlint ho vedie ako
  rozpracované)**.
- z typescript-eslint eslint-recommended: `no-var` (restriction), `prefer-const`, `prefer-rest-params`,
  `prefer-spread` (style).
- typescript-eslint: `no-array-constructor` (pedantic), `typescript/no-empty-object-type`, `typescript/no-namespace`,
  `typescript/no-require-imports` (restriction), `typescript/no-unnecessary-type-constraint` (suspicious),
  `typescript/no-unsafe-function-type` (pedantic).

Samo zapnuté v `correctness` (48): `for-direction`, `no-async-promise-executor`, `no-compare-neg-zero`, `no-cond-assign`,
`no-constant-binary-expression`, `no-constant-condition`, `no-control-regex`, `no-debugger`, `no-delete-var`,
`no-dupe-else-if`, `no-duplicate-case`, `no-empty-character-class`, `no-empty-pattern`, `no-empty-static-block`,
`no-ex-assign`, `no-extra-boolean-cast`, `no-global-assign`, `no-invalid-regexp`, `no-irregular-whitespace`,
`no-loss-of-precision`, `no-misleading-character-class`, `no-nonoctal-decimal-escape`, `no-self-assign`,
`no-shadow-restricted-names`, `no-sparse-arrays`, `no-unassigned-vars`, `no-unsafe-finally`,
`no-unsafe-optional-chaining`, `no-unused-labels`, `no-unused-private-class-members`, `no-useless-backreference`,
`no-useless-catch`, `no-useless-escape`, `require-yield`, `use-isnan`, `valid-typeof`; z TS
`no-duplicate-enum-values`, `no-extra-non-null-assertion`, `no-misused-new`, `no-non-null-asserted-optional-chain`,
`no-this-alias`, `no-unsafe-declaration-merging`, `no-unused-expressions`, `no-unused-vars`,
`no-wrapper-object-types`, `prefer-as-const`, `prefer-namespace-keyword`, `triple-slash-reference`.

Chýba v oxlint:

- `no-octal` – migrate: „Superseded by strict mode". Modul ESM je strict a oktálový literál je tam syntaktická chyba
  parsera aj TS [odvodené]. Nahradiť netreba.
- (`no-dupe-args` migrate tiež preskočí, ale pre `*.ts` ho vypína už typescript-eslint, takže sa dnes nespúšťa.)
- 7 formátovacích pravidiel, každé so svojou náhradou vo formátovači:

| eslint | náhrada v oxfmt | rovnocenné? |
|---|---|---|
| `semi: never` | `semi: false` | áno |
| `quotes: single, avoid-escape` | `singleQuote: true` (formátovač zvolí úvodzovky s menej escapami) | áno |
| `object-curly-spacing: always` | `bracketSpacing` (predvolené `true`) | áno |
| `no-multiple-empty-lines {max 1}` | formátovač zlúči prázdne riadky na 1 | áno |
| `no-trailing-spaces` | formátovač ich zmaže | áno (okrem obsahu template literálov, kde ich nemení ani eslint) |
| `comma-dangle` | `trailingComma: es5` | prísnejšie: es5 čiarky na viacriadkových poliach, objektoch, importoch a exportoch vyžaduje, eslint ich pri importoch, exportoch a funkciách len dovolí. Dnes ich už píše prettier, takže sa nič nemení. |
| `max-len 120` | `printWidth: 120` zalomí kód | **čiastočne:** dlhý komentár ani reťazec nikto neskontroluje. Dnes je v `src`/`test` 0 riadkov nad 120 znakov. |

`oxlint` číta aj direktívy `eslint-disable*` s menami `@typescript-eslint/...`. Zrkadlová konfigurácia nenašla na troch
riadkoch s `catch (error)` nič a nehlásila ani nepoužité direktívy, takže ich oxlint priradil k `no-unused-vars`
(`vysledky/oxlint-mirror.json`). [overené]

### 2.2 Čo oxlint pridáva

S kategóriou `correctness` beží 119 pravidiel (`navrh-final`: pluginy `eslint, typescript, unicorn, oxc, import`)
až 145 (`admin`, s `vue`), eslint dnes 74. Navyše dáva hlavne `unicorn/*`, `oxc/*` a `import/*`. Na kópii z toho nevzišiel nijaký
nový nález okrem importových pravidiel adminov (časť 4). Iné kategórie len na informáciu (`navrh` + `-W <kategória>`,
`vysledky/oxlint-navrh-*.json`): suspicious 50 nálezov (`no-shadow` 15, `import/no-named-as-default` 13,
`unicorn/consistent-function-scoping` 7), perf 13 (`no-await-in-loop` 5), pedantic 234, restriction 1110, style 2012.
Zapínať ich hromadne neodporúčam.

### 2.3 Typové pravidlá (type-aware)

- **Kolaborácia ich nepoužíva** [overené: `eslint.config.mjs:23-42` bez `parserOptions.project`/`projectService`,
  `extends` bez `*-type-checked`]. Pri prechode sa preto nič typové nestratí.
- **oxlint `--type-aware`** (alebo `options.typeAware: true` v koreňovom `.oxlintrc.json`) potrebuje balík
  `oxlint-tsgolint`. tsgolint je Go binárka nad **typescript-go (TypeScript 7)**. Verzie kopírujú TS, napr. `v7.0.2004`
  = TS 7.0.2 + oprava 004. Z 62 typových pravidiel typescript-eslint má 60, chýbajú `naming-convention`
  a `prefer-destructuring`. [dok: `/oxc-project/tsgolint` README] oxlint 1.89 ich ponúka 60
  (`oxlint --rules`: 15 correctness, 10 suspicious, 21 pedantic ...). Samo sa zapne napríklad `no-floating-promises`,
  `await-thenable`, `no-misused-spread`, `no-base-to-string` a `restrict-template-expressions`, menom treba zapnúť
  `no-misused-promises`. [overené]
- **Zrelosť:** dokumentácia oxc ho už neoznačuje ako alpha. Alpha sú JS pluginy, experimental je `--type-check`
  (diagnostiky kompilátora). [dok: `/websites/oxc_rs`, `/websites/oxc_rs_guide_usage`]
- **TS 6 / TS 7:** tsgolint má vlastný kompilátor TS 7 a balík `typescript` projektu nepoužíva, takže verzia
  6.0.3 v projekte mu nevadí. Dokumentácia však vyžaduje „TypeScript 7.0+": voľby zastarané v TS 6.0 alebo zrušené
  v TS 7.0 (napr. `baseUrl`) treba najprv odstrániť. [dok] Rozpracovaný `tsconfig.json` agenta TS 6 (nodenext,
  es2025, `types`, `rootDir`, bez `baseUrl`, `esModuleInterop` a dekorátorov) nijakú takú voľbu nemá. Beh nižšie
  to potvrdil: tsgolint nehlásil nijakú zrušenú voľbu.

#### Jeden beh `--type-aware` na kópii [overené]

Vedúci ho povolil raz, pri ≥ 6 GB voľnej RAM a bez behu vitest/tsc/tsgo/yarn iného agenta. Skript `13-typy.sh`,
výstupy `vysledky/oxlint-typy.json`, `typy-beh.log` a `typy-time.txt`.

- Nástroj: `oxlint-tsgolint@7.0.2004` stiahnutý `npm install --prefix oxlint-analyza/tsgolint` (binárka 22,5 MB)
  a odovzdaný cez `OXLINT_TSGOLINT_PATH`; oxlint 1.89.0 z admin-cms. Konfigurácia `konfig/oxlint-typy.json`
  = `navrh-final` + `options.typeAware` + všetkých 45 typových pravidiel mimo `correctness` ako `warn` (179 pravidiel).
  Kópia je snímka z 09:45, v nej `tsconfig.json` a `test/tsconfig.json` z rozpracovanej práce agenta TS 6.
- Podmienky: pred behom 10 988 MB voľných, nijaký vitest, tsc, tsgo ani yarn (bežali len tsserver-y VS Code).
- **Spotreba: 2,22 s, CPU 414 % (user 6,9 s, sys 1,8 s). Špička RSS oxlint + tsgolint spolu 711 MB** (vzorka každých
  0,1 s), samotný tsgolint 391 MB, najväčší jednotlivý proces podľa `/usr/bin/time -v` 420 MB. Po behu 11 026 MB
  voľných.
- **1467 diagnostík:**
  - 14× `tsconfig-error` v `test/tsconfig.json` snímky: „File … is not under 'rootDir' …/src" (13 testov
    + `vitest.config.mts`), lebo základný `tsconfig.json` má `rootDir: src`. Tieto súbory sa typovo neanalyzovali.
    Agent TS 6 medzitým pridal do `test/tsconfig.json` `"rootDir": ".."`, čo rieši presne toto [odvodené: znova sa
    nespúšťalo].
  - 515 = 5 pravidiel × 103 súborov s hlásením „requires the `strictNullChecks` compiler option"
    (`no-unnecessary-boolean-literal-compare`, `no-unnecessary-condition`, `no-useless-default-assignment`,
    `prefer-nullish-coalescing`, `strict-boolean-expressions`). Pri `strict: false` sú bez úžitku a treba ich vypnúť.
  - 7 známych importových nálezov (bez typov).
  - **931 skutočných typových nálezov** (929 v `src`). Z 15 pravidiel zapnutých samo (`correctness`) je to **32**:
    `no-meaningless-void-operator` 22 (`return void answer(...)`, napr. `joinCollabRoomListener.ts:89`),
    `restrict-template-expressions` 4 a `no-base-to-string` 4 (pole `info.*` z winston v template literáli,
    `logger/appLogger.ts:66, 76`, `config/config.ts:142`), `no-redundant-type-constituents` 1
    (`manager/roomDataManager.ts:26`) a `no-useless-default-assignment` 1. Zvyšných 10 pravidiel má 0 nálezov:
    **`no-floating-promises`**, **`await-thenable`**, `unbound-method`, `no-misused-spread`, `no-for-in-array`,
    `no-implied-eval`, `no-array-delete`, `no-duplicate-type-constituents`, `no-unsafe-unary-minus`
    a `require-array-sort-compare`.
  - Mimo `correctness` (899): `prefer-readonly-parameter-types` 237; `no-unsafe-*` 399 (member-access 110,
    assignment 105, call 80, return 51, argument 29, type-assertion 24), všetko následok `any`;
    `no-confusing-void-expression` 62, `strict-void-return` 25, `return-await` 21, `no-misused-promises` 11 (async
    handler socket.io vrátený tam, kde sa čaká `void`, napr. `joinCollabRoomListener.ts:25`) a menšie.
- **Záver:** typové lintovanie funguje na projekte s TS 6 bez balíka TS 7 (tsgolint nesie vlastný kompilátor) a je
  lacné (2 s, < 1 GB). Prínos je dnes skromný: plávajúce promisy sa nenašli a predvolená sada dáva 32 skôr štýlových
  nálezov. Silnejšie pravidlá (`no-misused-promises`, `no-unsafe-*`) sú pri `strict: false` a `any` hlučné. Je to
  voliteľný neskorší krok (6.10): začať predvolenou sadou, opraviť alebo vypnúť `no-meaningless-void-operator`
  a 5 pravidiel `strictNullChecks` nechať vypnutých, kým bude `strict: false`.
- Mimochodom: `src/config/config.ts:142` má v texte chyby navyše `}` (`… config!}`), drobný preklep [overené].
- Pri možnosti B by sa typové pravidlá dali brať aj z typescript-eslint (`recommendedTypeChecked`). To však znamená
  `projectService` (pomalšie, viac RAM) a trvalý blok TS < 6.1.

## 3. Formátovanie: prettier 3.9 → oxfmt 0.74 [overené]

Skript `06-oxfmt.sh`, výstupy `vysledky/oxfmt-*`. Na kópiách beží `oxfmt --check src test` (prettier dnes kontroluje
tie isté priečinky), potom zápis a `git diff --no-index` proti nedotknutej kópii.

| konfigurácia | súbory so zmenou | riadky | poznámka |
|---|---|---|---|
| ekvivalent `.prettierrc.js` (`fmt-pretty`) | **1 / 119** | +3 −1 | `src/types/ClientToServerEvents.ts:40-41`; koreňové `vitest.config.mts`, `eslint.config.mjs` a `.prettierrc.js` bez zmeny |
| admin `.oxfmtrc.json` so `sortImports` (`fmt-admin`) | **69 / 119** | +268 −195 | len `sortImports`: 69 súborov, +265 −194; v 8 súboroch pribudne iba prázdny riadok medzi skupinami |
| admin oxfmt + importové pravidlá oxlint, po `lint:fix` (`final`) | **70** (src 57, test 13) | +273 −202 | src +240 −183, test +33 −19; okrem jedného union typu sa všetko týka importov |

- `oxfmt --migrate=prettier` vyrobil z `.prettierrc.js` presne tie isté voľby, k tomu `sortPackageJson: false`
  a `ignorePatterns: ["node_modules", "dist"]` (`vysledky/oxfmtrc-migrate.json`).
- 119 súborov = 118 `.ts` + `test/tsconfig.json`: oxfmt formátuje aj JSON, prettier tu kontroluje len `*.ts`.
  `test/tsconfig.json` zostal bez zmeny.
- Jediný štýlový rozdiel formátovača: union typ, ktorý sa nezmestí za `=`. prettier 3.9 ho nechá na jednom odsadenom
  riadku `A | B | C`, oxfmt dá každý člen na vlastný riadok s úvodným `|`.
- Úvodzovky, bodkočiarky, koncové čiarky, šírka 120 a medzery v `{ }`: **bez rozdielu**. Predvolený `printWidth` oxfmt
  je 100 (prettier 80), tu je nastavený na 120.
- **Radenie importov** (`sortImports`, ako u adminov): skupiny `builtin` → `external` → `internal`+`subpath` →
  `parent`/`sibling`/`index` → `style` → `unknown`, medzi skupinami prázdny riadok (`newlinesBetween: true`), v skupine
  abecedne bez ohľadu na veľkosť písmen, importy s vedľajším účinkom ostávajú na mieste a komentár delí bloky. Mená
  v zátvorkách radí `sort-imports` z oxlint. `internalPattern` je predvolene `["~/", "@/", "#"]` a `#/...` je
  `subpath`, takže **plánované aliasy `#/` budú jedna skupina** (schéma `oxfmt/configuration_schema.json`). Po ich
  zavedení sa väčšina importov aj tak prepíše, preto treba číslo 69/70 zmerať znova až po tom commite.
- **Dôležité predvolené hodnoty oxfmt:** `sortPackageJson: true`. Bez `ignorePatterns` by `oxfmt .` zmenil
  `package.json` aj `tsconfig.json` (`--list-different`, `12-kontrola.sh`). Navrhnutý zoznam povolených
  `["/*", "!/src", "!/test", "!/*.mts"]` to zastaví. `.editorconfig` oxfmt číta; explicitné voľby majú prednosť.
- Čas: `oxfmt --check` 0,10 s, `oxlint` 0,22 s (121 súborov, konfigurácia `navrh`). eslint a prettier sa nemerali.

## 4. oxlint na kópii [overené]

Skripty `04-oxlint.sh`, `07-fix.sh`, `08-fix-poradie.sh` a `11-navrh-final.sh`, výstupy `vysledky/oxlint-*.{json,txt}`.
Všetky behy: `--disable-nested-config --report-unused-disable-directives`, 121 súborov.

| konfigurácia | pravidiel | nálezy podľa pravidla |
|---|---|---|
| `mirror` – výstup `@oxlint/migrate` z `eslint.config.mjs` (opravený, pozri nižšie) | 81 | **0** |
| `mirror-nursery` – to isté + `no-useless-assignment` | 82 | **0** |
| `admin` – `extends` zdieľaný `oxlint-admin.json`, `env node`, `correctness: error` | 145 | **7 chýb**: `import/consistent-type-specifier-style` 3, `sort-imports` 3, `import/no-duplicates` 1; **+3 varovania** „Unused eslint-disable directive" |
| `navrh` – pluginy adminov bez vue + `node`, `vitest` + pravidlá z 2.1 | 135 | 7 tých istých + `vitest/require-mock-type-parameters` **42** (v teste `vi.fn()` bez typového parametra) + 3 nepoužité direktívy |
| **`navrh-final/.oxlintrc.json`** (odporúčaná, bez `vitest` a `node`, predvolené `no-unused-vars`) | 119 | **7 chýb** (tie isté importové), 0 direktív |

- Zrkadlo s 0 nálezmi zodpovedá čistému behu eslint (časť 1.1). Pri prechode teda nevznikne nový falošný nález
  a nič, čo eslint dnes zachytí, sa nestratí, okrem riadkov z 2.1.
- Tri nepoužité direktívy pri `admin`/`navrh`: zdieľané pravidlo adminov má `no-unused-vars {caughtErrors: "none"}`,
  takže nepoužité `catch (error)` už nehlási. Riešenie: nechať predvolené `caughtErrors` (ako eslint dnes, tak to robí
  `navrh-final`), alebo prepísať na `catch {` a direktívy zmazať.
- `@oxlint/migrate` (`oxlintrc-migrate.json`) dal override pre `*.ts` s `"files": [null, null]`: súbory z override
  `FlatCompat` neprečítal. Na `["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]` som ho opravil ručne. Do
  `ignorePatterns` skopíroval celý `.gitignore`. Hodí sa ako kontrola, nie ako hotová konfigurácia.
- **Reťazec opráv** (`08-fix-poradie.sh`, `11-navrh-final.sh`): poradie adminov `oxlint --fix` → `oxfmt` potrebuje
  pri prvom prechode **dva behy**. `import/no-duplicates` zlúči `import { Redlock }` a `import { Lock }` na
  `{ Redlock, Lock }` a `sort-imports` ich zoradí až v druhom behu. Potom `oxlint` exit 0 a `oxfmt --check` exit 0.
  Opačné poradie (najprv oxfmt) nechá 4 súbory neformátované (`07-fix.sh`), preto `format` patrí na koniec, ako
  u adminov.

## 5. Možnosti

### A: iba oxlint + oxfmt (eslint aj prettier preč)

- **Výhody:** pokrytie z 2.1 (66/74, `no-octal` netreba, 6 formátovacích pravidiel plne a `max-len` čiastočne cez
  oxfmt). Zmizne celý typescript-eslint, a tým aj strop TS < 6.1 a blok TS 7. Namiesto 9 dev balíkov dva. Tie isté
  nástroje a štýl konfigurácie ako admini (oxfmt rovnaký okrem `ignorePatterns`, oxlint je podmnožina zdieľaných
  pravidiel). Rýchle (desatiny sekundy). Neskôr sa dá zapnúť `--type-aware`. Zmizne aj starý `FlatCompat`/eslintrc
  a 7 pravidiel, ktoré ESLint 11 zruší.
- **Nevýhody:** jednorazový diff (1 súbor bez `sortImports`, 70 s ním), `blame` sa posunie. oxfmt je 0.x a jeho
  výstup sa môže meniť medzi minor verziami (`^0.74.0` drží 0.74.x, ako u adminov). `no-useless-assignment` je
  v oxlint nursery. Dlhé komentáre a reťazce nikto nekontroluje. Editor: vo WebStorme treba plugin Oxc, vo VS Code
  `oxc.oxc-vscode`; lokálne `.idea/prettier.xml` a `.idea/jsLinters/eslint.xml` sú len lokálne (`.idea` je
  v `.gitignore`). Pravidlá z pluginov eslint by išli len cez JS pluginy (alpha), kolaborácia však žiadne nepotrebuje.
- **Veľkosť: S** (1 – 2 h vrátane kontroly, dva commity).
- **Skripty** (namiesto `package.json:9-17`):

```json
"ci": "run-s --print-name lint:tsc lint:tsc:test format:check lint:oxlint",
"lint": "[ \"$*\" = \"--fix\" ] && yarn lint:fix || { [ \"$*\" = \"\" ] && yarn ci; }",
"lint:fix": "run-s --print-name lint:tsc lint:tsc:test lint:oxlint:fix format",
"lint:tsc": "tsc --noEmit",
"lint:tsc:test": "tsc -p test",
"lint:oxlint": "oxlint . --disable-nested-config",
"lint:oxlint:fix": "oxlint . --fix --disable-nested-config",
"format": "oxfmt --disable-nested-config src test vitest.config.mts",
"format:check": "oxfmt --disable-nested-config src test vitest.config.mts --check",
```

  Mená `format`/`format:check` a `lint:oxlint(:fix)` sú ako u adminov. `run-s` ostáva: projekt je malý a `tsc` aj tak
  beží za sebou. `run-p` ako u adminov by ušetril len desatiny sekundy.
- **CI:** `azure-pipelines.yml` bez zmeny (`build` → `lint` → `ci`). Natívne binárky (`@oxlint/binding-linux-x64-gnu`,
  `@oxfmt/binding-linux-x64-gnu`) sa inštalujú ako voliteľné závislosti. Pipeliny adminov na tej istej šablóne
  a obraze `node24` ich už používajú [odvodené].
- **TS 7:** z lint nástrojov nič na `typescript` nezávisí. oxlint má len voliteľný peer `oxlint-tsgolint`, oxfmt len
  `tinypool` [overené]. Po odstránení `@typescript-eslint/*` a `ts-api-utils` nemá v strome nijaký balík peer na
  `typescript` [overené: `10-ts-peer.py`, `yarn.lock:1928,1993,2020`]. Prechod na TS 7 potom závisí len od
  `tsc`/`tsconfig` (tsx a vitest balík `typescript` nepoužívajú [odvodené]).

### B: hybrid adminov (oxlint + eslint s eslint-plugin-oxlint + oxfmt)

- **Čo by eslint robil:** `buildFromOxlintConfigFile` vypne všetko, čo beží v oxlint. Formátovacích 7 pravidiel musí
  preč, lebo zdvojujú oxfmt (u adminov blok `owned-by-oxfmt`). V eslint by zostalo `no-useless-assignment` (ak nie
  v oxlint ako nursery) a `no-octal`, teda 1 – 2 pravidlá na celom zásobníku eslint + typescript-eslint.
- **Výhody:** tá istá štruktúra ako u adminov. Miesto pre budúce pluginy eslint (`@stylistic`, `eslint-plugin-n`,
  typescript-eslint type-checked).
- **Nevýhody:** typescript-eslint zostáva, a s ním strop TS < 6.1 a pád pri TS ≥ 7. Dva lintery a k nim
  `eslint-plugin-oxlint`, ktorý musí sedieť s oxlint presne (peer `~1.89.0`). `eslint.config.mjs` treba aj tak
  prepísať (bez `FlatCompat`, bez formátovacích pravidiel, s `buildFromOxlintConfigFile`). Pomalšie. Pre kolaboráciu
  bez reálneho prínosu.
- **Veľkosť: S – M.**
- **Skripty:** `ci` = `lint:tsc lint:tsc:test format:check lint:oxlint lint:eslint`, `lint:fix` = `lint:tsc
  lint:tsc:test lint:oxlint:fix lint:eslint:fix format`. devDependencies: pribudne `oxlint`, `oxfmt`
  a `eslint-plugin-oxlint`, ubudne `prettier`, `@eslint/eslintrc`, `@eslint/compat` a `@rushstack/eslint-patch`
  (prípadne `typescript-eslint` namiesto dvoch balíkov `@typescript-eslint/*`). CI bez zmeny.
- **TS 7:** blokované ako pri C. Obísť sa to dá len súbežným TS 6 pre lint (alias `@typescript/typescript6`, ako
  odporúča typescript-eslint) alebo počkať, kým typescript-eslint podporí TS ≥ 7.1 (issue #10940). [dok]

### C: ponechať

- **Výhody:** teraz nulová práca a žiadny diff.
- **Nevýhody:** iné nástroje ako admini (prettier vs. oxfmt, iný štýl konfigurácie). ESLint 11 zruší 7 formátovacích
  pravidiel (`availableUntil: "11.0.0"`), a pri aktualizácii sa konfigurácia rozbije. Ostáva starý `FlatCompat`
  a mŕtvy `@rushstack/eslint-patch`. typescript-eslint zastaví TS 6.1 (peer `<6.1.0`) aj TS 7 (pád v parseri,
  `@typescript-eslint/parser/dist/index.js:42`) [overené].
- **Veľkosť:** teraz 0, neskôr aj tak S – M (ESLint 11 alebo TS 7).
- **Skripty a CI:** bez zmeny.
- **TS 7:** blokované, kým typescript-eslint nepodporí TS ≥ 7.1, alebo cez súbežný TS 6 alias. [dok]

## 6. Odporúčanie a kroky

**A, so `sortImports` a importovými pravidlami ako u adminov**, ako samostatná zmena **až po commite TS 6 + aliasov
`#/`** (ten mení tie isté `package.json`, `yarn.lock` a importy). Typové pravidlá zvlášť a neskôr.

1. Počkať na commit agenta TS 6 / `#/` na `next`. Až potom vetva pre lint.
2. `yarn remove eslint @eslint/js @eslint/eslintrc @eslint/compat @rushstack/eslint-patch @typescript-eslint/eslint-plugin
   @typescript-eslint/parser globals prettier` a `yarn add -D oxlint@1.89.0 oxfmt@^0.74.0` (verzie ako admini).
   Potom `yarn dedupe`.
3. Pridať `.oxlintrc.json` a `.oxfmtrc.json` z `krok5-praca/oxlint-analyza/navrh-final/`. Na kópii sú overené a ich
   obsah je v prílohe nižšie.
4. Zmazať `eslint.config.mjs`, `.prettierrc.js` a `.prettierignore`.
5. Prepísať skripty podľa 5.A (`package.json:9-17`). `build` (`:20`) ostáva, volá `yarn lint`.
6. Spustiť `yarn lint:fix` **dvakrát** (prvý prechod, kaskáda `no-duplicates` → `sort-imports`). Potom `yarn ci` musí
   byť čisté. Zmeny: približne 70 súborov, iba importy a jeden union typ (po `#/` treba zmerať znova).
7. Commity: (a) nástroje (`package.json`, `yarn.lock`, konfigurácie, zmazané súbory), (b) iba formát a importy.
   Commit (b) sa dá dať do `.git-blame-ignore-revs` pre lokálny `git blame` (Azure DevOps ho podľa mňa nečíta
   [odvodené]).
8. Overiť `yarn build` (cesta CI) a `yarn test`. `azure-pipelines.yml` sa nemení.
9. Voliteľne `.vscode/extensions.json` s `oxc.oxc-vscode` ako u adminov. WebStorm: plugin Oxc namiesto Prettier a ESLint.
10. Neskôr, voliteľne: `yarn add -D oxlint-tsgolint` a v `.oxlintrc.json` `"options": { "typeAware": true }`.
    Na snímke je to 32 nálezov predvolenej sady (2.3), `no-floating-promises` 0. Vypnúť 5 pravidiel, ktoré
    vyžadujú `strictNullChecks`, rozhodnúť o `no-meaningless-void-operator` (22) a až potom zapnúť v CI.
    Predpoklad: `test/tsconfig.json` s `rootDir: ".."` (agent TS 6 ho už pridal).
11. Nepovinné: tri `catch (error)` s direktívou prepísať na `catch {` a direktívy zmazať.

Príloha – `navrh-final/.oxlintrc.json`:

```jsonc
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["eslint", "typescript", "unicorn", "oxc", "import"],
  "env": { "node": true, "es2026": true },
  "ignorePatterns": ["dist"],
  "categories": { "correctness": "error" },
  "rules": {
    // What eslint:recommended and typescript-eslint's recommended enforced here and oxlint's correctness
    // category does not include.
    "no-var": "error",
    "prefer-const": "error",
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "no-case-declarations": "error",
    "no-empty": "error",
    "no-fallthrough": "error",
    "no-prototype-builtins": "error",
    "no-regex-spaces": "error",
    "no-unexpected-multiline": "error",
    "preserve-caught-error": "error",
    // In eslint:recommended since ESLint 10; in oxlint still a nursery rule.
    "no-useless-assignment": "error",
    "no-array-constructor": "error",
    "typescript/no-empty-object-type": "error",
    "typescript/no-namespace": "error",
    "typescript/no-require-imports": "error",
    "typescript/no-unnecessary-type-constraint": "error",
    "typescript/no-unsafe-function-type": "error",

    // As in the admins (common-admin src/eslint/oxlint-admin.json): oxfmt sorts the statements, these sort
    // the names inside the braces, merge two imports of one module and keep types in their own `import type`.
    "sort-imports": ["error", { "ignoreDeclarationSort": true }],
    "import/no-duplicates": ["error", { "considerQueryString": true }],
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"]
  }
}
```

Príloha – `navrh-final/.oxfmtrc.json`:

```json
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 120,
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "sortImports": {
    "sortSideEffects": false,
    "partitionByComment": true
  },
  "ignorePatterns": ["/*", "!/src", "!/test", "!/*.mts"]
}
```

(`singleAttributePerLine` a `bracketSameLine` z prettier sa týkajú len JSX/HTML/Vue, preto tu nie sú.)

## 7. Reprodukcia (`/home/volar/projects/anzusystems/krok5-praca/oxlint-analyza/`)

| súbor | čo robí |
|---|---|
| `01-kopia.sh`, `kopia.info` | snímka kolaborácie do `kopia/`, `fmt-admin/` a `fmt-pretty/` |
| `02-mapa.sh`, `02-mapa.py`, `mapa.txt`, `mapa.json` | mapa 74 pravidiel eslint → oxlint (`oxlint-rules.json` = `oxlint --rules --format=json`) |
| `03-migrate.sh`, `migrate.log`, `oxlintrc-migrate.json` | `@oxlint/migrate@1.89.0 --details` na kópii `eslint.config.mjs` |
| `konfig/oxlint-{mirror,mirror-nursery,admin,navrh}.json` | konfigurácie behov z časti 4 |
| `04-oxlint.sh`, `05-pocty.py`, `vysledky/oxlint-*` | behy oxlint a počty podľa pravidla |
| `06-oxfmt.sh`, `vysledky/oxfmt-*` | oxfmt check, zápis a diff; `oxfmt --migrate=prettier` |
| `07-fix.sh`, `08-fix-poradie.sh` | poradie `lint:fix`, iba `sortImports`, ostatné kategórie |
| `navrh-final/`, `11-navrh-final.sh`, `vysledky/final*` | odporúčaná konfigurácia, overená ako v repozitári (`final/`) |
| `09-cas.sh`, `10-ts-peer.py`, `12-kontrola.sh` | časy, peer na `typescript`, rozdelenie diffu, koreňové súbory |
| `13-typy.sh`, `konfig/oxlint-typy.json`, `tsgolint/`, `vysledky/oxlint-typy.json`, `typy-beh.log`, `typy-time.txt` | jeden beh `--type-aware` s meraním RAM a času |
