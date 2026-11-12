# COLLAB-OXLINT-TS7: oxlint + oxfmt namiesto eslint + prettier, potom TypeScript 7

Kolaboračný server `/home/volar/projects/petit/collaboration` (vetva `next`, východisko HEAD `4790c13`, TS 6 + `#/`).
Zadanie: `krok5-praca/zadania/zadanie-collab-oxlint-ts7.md`, podklad `COLLAB-OXLINT.md`. Skripty a logy:
`/home/volar/projects/anzusystems/krok5-praca/collab-oxlint-ts7/`. Necommitoval som; `.gitignore` (zmena vlastníka,
`.playwright-cli`) som nechal tak.

## Časť 1: oxlint + oxfmt (22. 10. 2026)

### Zmeny

- **Balíky** (`01-balicky.sh`): preč `eslint`, `@eslint/js`, `@eslint/eslintrc`, `@eslint/compat`,
  `@rushstack/eslint-patch`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `globals`, `prettier`
  (z `yarn.lock` zmizlo 88 balíkov, −7,2 MiB). Pribudli `oxlint 1.89.0` (presne, ako admini) a `oxfmt ^0.74.0`
  (+ natívne `@oxlint/binding-*`, `@oxfmt/binding-*` ako voliteľné). V `yarn.lock` nezostal nijaký `eslint`,
  `prettier` ani `ts-api-utils`, teda ani balík s peer na `typescript` (blok TS < 6.1 je preč).
- **Zmazané** (`git rm`): `eslint.config.mjs`, `.prettierrc.js`, `.prettierignore`. `.eslintignore` neexistoval.
- **`.oxlintrc.json`** = `navrh-final` z analýzy **bez troch importových pravidiel adminov** (`sort-imports`,
  `import/no-duplicates`, `import/consistent-type-specifier-style`), lebo dnešný eslint ich nemá: pluginy
  `eslint, typescript, unicorn, oxc, import`, `env node + es2026`, `ignorePatterns: [dist]`, `correctness: error`
  a 18 pravidiel menom (čo `eslint:recommended` + typescript-eslint `recommended` vynucovali a `correctness` nemá,
  vrátane nursery `no-useless-assignment`). Spolu 116 pravidiel, 119 súborov (bez dvoch zmazaných konfigurácií).
  Predvolené `no-unused-vars` (`caughtErrors: all`) ako dnes, takže tri direktívy
  `// eslint-disable-next-line @typescript-eslint/no-unused-vars` ostávajú platné (oxlint ich priradí; s
  `--report-unused-disable-directives` 0 nepoužitých).
- **`.oxfmtrc.json`** = ekvivalent `.prettierrc.js`: `printWidth 120`, `semi false`, `singleQuote`, `trailingComma es5`,
  **bez `sortImports`** (v oxfmt 0.74 je predvolene vypnuté, schéma: „Default: Disabled"), `sortPackageJson: false`
  (predvolené `true`) a `ignorePatterns` ako zoznam povolených `["/*", "!/src", "!/test", "!/*.mts"]`.
  `oxfmt . --list-different` ukázal len `src/types/ClientToServerEvents.ts`, teda `package.json` ani `tsconfig.json`
  nezmení. `singleAttributePerLine`/`bracketSameLine` sa týkajú len JSX/HTML/Vue, preto chýbajú.
- **Skripty** (`package.json:15-23`): `ci` = `run-s lint:tsc lint:tsc:test format:check lint:oxlint`,
  `lint:fix` = `run-s lint:tsc lint:tsc:test lint:oxlint:fix format`, `lint:oxlint(:fix)` = `oxlint . [--fix]
  --disable-nested-config`, `format(:check)` = `oxfmt --disable-nested-config src test vitest.config.mts [--check]`
  (mená ako u adminov). `lint`, `build` (`yarn clean && yarn lint && tsc`), `production`, `test` bez zmeny.
- **CI:** `azure-pipelines.yml` bez zmeny. Šablóna (`collab-opravy/template-yarn.yaml:59-61, 106-121`) spúšťa
  `yarn install`, `yarn run build` (→ `yarn lint` → `yarn ci`) a pri `runYarnTest` `yarn test`; mená skriptov ostali.
  Inde v repozitári eslint/prettier nič nevolá (grep mimo `node_modules`/`dist`: len changelog 1.14.0 a tri direktívy).

### Výsledky

| krok | výsledok |
|---|---|
| `yarn install`, `yarn dedupe`, `yarn dedupe --check`, `yarn install --immutable` | exit 0; varovanie YN0086 sú staré peer `y-protocols`/`yjs` balíkov `@hocuspocus/*` |
| `oxlint` pred opravou (`02-pred-fix.log`) | 0 nálezov, 0 nepoužitých direktív, 0,23 s |
| `oxfmt --list-different` pred opravou | 1 súbor |
| `yarn lint:fix` (`03-lint-fix.log`) | exit 0, **zmenil 1 súbor** (pozri nižšie) |
| `yarn ci` (`04-ci.log`) | exit 0 (tsc, tsc test, „All matched files use the correct format", oxlint bez výstupu) |
| negatívna skúška na kópii (`05-negativ.log`) | oxlint exit 1 (`no-var`, `prefer-const`, `no-empty`, `no-case-declarations`, `no-unused-vars`), `oxfmt --check` exit 1 |
| `VITEST_MAX_WORKERS=2 yarn test` (`06-test.log`) | 13 súborov, 66 testov, všetky prešli |
| `yarn build` (`07-build.log`) | exit 0, `dist` 206 súborov; kópia ako základ TS 6 pre časť 2: `collab-oxlint-ts7/dist-ts6/` |

**`lint:fix` zmenil 1 súbor:** `src/types/ClientToServerEvents.ts:40-43` (+3 −1). Union typ, ktorý sa nezmestí za `=`:
prettier 3.9 ho nechal na jednom odsadenom riadku `A | B | C`, oxfmt dáva každý člen na vlastný riadok s úvodným `|`.
`oxlint --fix` nezmenil nič (0 nálezov). Iné rozdiely formátu (úvodzovky, bodkočiarky, čiarky, šírka, `{ }`) nie sú.
Zhoduje sa s analýzou (1/119, +3 −1).

### Poznámky

- oxlint bez nálezov nevypíše nič, ani súhrn (overené pri výstupe do súboru; `--format=json` hlási 119 súborov,
  116 pravidiel). Exit kód platí.
- Bez `.gitignore` by oxlint lintoval aj `node_modules` (na kópii so symlinkom `node_modules` to tak bolo). V repozitári
  ho vynechá `.gitignore` (`/node_modules`); v CI je `.gitignore` v checkoute.
- Lokálny `.vscode/settings.json` v časti 1 nemenený: globálne nastavenie VS Code už formátuje `[typescript]` cez
  `oxc.oxc-vscode` (1.58.0 nainštalované). Globálne `source.fixAll.eslint: always` tu po odchode eslint nič nerobí.
- Neoverené: beh v Azure (len čítaním šablóny), WebStorm (`.idea/prettier.xml`, `.idea/jsLinters/eslint.xml` sú
  lokálne a ignorované).

## Časť 2: TypeScript 7 (22. 10. 2026, po commite `61f483d`)

### Zmeny

- **`package.json:118`**: `typescript` `^6.0.3` → `^7.0.2` (ostáva v `dependencies`, rozsah `^` ako doteraz; admini majú
  `~6.0.3`, pri TS 7 by `~7.0.2` zastavilo 7.1). `yarn.lock`: `typescript 7.0.2` + 20 platformových balíkov
  `@typescript/typescript-<os>-<cpu>` (voliteľné, nainštalovaný len `linux-x64`: statická Go binárka 24 MB, beží
  pri glibc aj musl). Zabudovaný patch Yarnu `optional!builtin<compat/typescript>` pri 7.0.2 nič nemení (416 súborov,
  rovnako ako tarball).
- **`test/tsconfig.json`**: `"customConditions": ["development"]` s komentárom. Dôvod: nález nižšie.
- **`tsconfig.json` bez zmeny:** nemá nijakú voľbu, ktorú TS 7 zrušil (TS 7 na ňu hlási chybu, `tsc` prešiel čisto).
  `paths` pre `#/` funguje: `--traceResolution` = 207 riešení `#/…` cez `#/*` do `src`, 0 nevyriešených
  (`14-ts7-tsc.log`).
- **Lokálne `.vscode/`** (ignorované): `settings.json` = `js/ts.experimental.useTsgo: true`,
  `js/ts.tsdk.path: ./node_modules/typescript`, `js/ts.preferences.importModuleSpecifier: shortest` (staré
  `typescript.tsdk` a `typescript.preferences.importModuleSpecifier: non-relative` preč, záloha
  `collab-oxlint-ts7/povodne-ts6/vscode-settings.json`). Nový `extensions.json` odporúča
  `TypeScriptTeam.native-preview` a `oxc.oxc-vscode`.

### VS Code

- **`typescript@7.0.2` nemá `lib/tsserver.js`** (v `lib/` sú len `tsc.js`, `getExePath.js`, `version.cjs`; `lib.*.d.ts`
  a binárka sú v `@typescript/typescript-linux-x64/lib/`). Zabudovaná podpora TS vo VS Code ho cez `typescript.tsdk`
  použiť nevie. [overené: `npm pack --dry-run`, `node_modules`]
- VS Code 1.142 (server) má zabudovaný TS 6.0.3. Jeho nastavenie `js/ts.experimental.useTsgo` podľa popisu
  „Disables TypeScript and JavaScript language features to allow usage of the TypeScript Go experimental extension.
  Requires TypeScript Go to be installed". Kľúče `typescript.tsdk` a `typescript.preferences.*` sú tam označené ako
  zastarané v prospech `js/ts.*`. [overené: `extensions/typescript-language-features/package.nls.json`]
- **Postup podľa dokumentácie:** rozšírenie „TypeScript 7" (`TypeScriptTeam.native-preview`, 1.0.1 z 30. 9. 2026,
  nie predbežná verzia, engine `^1.126.0`), `js/ts.experimental.useTsgo: true` a voliteľne
  `js/ts.tsdk.path: ./node_modules/typescript`. [dok: `/microsoft/typescript-go` README a `_extension/README.md`]
  V kóde rozšírenia (vsix som stiahol a len čítal, `collab-oxlint-ts7/vsix/`) sa z cesty tsdk číta `package.json`
  (meno `typescript`, bin `tsc`) a spúšťa sa `@typescript/typescript-linux-x64/lib/tsc --lsp`. Pri prvom otvorení sa
  pýta „This workspace has a TypeScript 7 tsdk configured (7.0.2). Would you like to use it?" (len v dôveryhodnom
  priečinku). **Záver: s TS 7 sa vo VS Code pracovať dá, preto som nezastavil.**
- **Rozšírenie dnes nainštalované nie je** (z TS/lint je tam len oxc, eslint a prettier). Kým sa nenainštaluje,
  `useTsgo: true` nechá editor v tomto priečinku bez podpory TS. Neinštaloval som ho (zásah do editora používateľa):
  `code --install-extension TypeScriptTeam.native-preview` alebo cez odporúčanie z `extensions.json`.
- **Sonda jazykového servera** (`19-lsp-probe.mjs`, `19-lsp-probe-final.log`): ten istý server, ktorý by spustilo
  rozšírenie, otvorí súbor s chýbajúcim menom a vypíše ponúknutý import. Na `workspace/configuration` odpovedá po
  sekciách ako VS Code; server sa pýta na `js/ts`, `typescript`, `javascript` a `editor`.

| nastavenie | iný priečinok (`hocuspocus.ts` ← `jobManager`) | ten istý priečinok | z testu (`config.test.ts` ← `scalarHelper`) |
|---|---|---|---|
| plánované: priečinok `js/ts` shortest, používateľ `typescript` non-relative | `#/manager/jobManager.js` | `./roomLockManager.js` | `#/util/helper/scalarHelper.js` |
| len `typescript` non-relative (doterajšie) | `#/manager/jobManager.js` | `#/manager/roomLockManager.js` | `#/util/helper/scalarHelper.js` |
| nič (predvolené shortest) | `#/manager/jobManager.js` | `./roomLockManager.js` | `#/util/helper/scalarHelper.js` |

  `js/ts.*` v nastavení priečinka teda prebije `typescript.*` z nastavení používateľa. Výsledky sú rovnaké ako pri TS 6
  (`collab-ts6/auto-import-probe.log`).
- **Nález (TS 7 oproti TS 6):** bez `customConditions` ponúkal TS 7 v teste vo všetkých troch nastaveniach
  `#/src/util/helper/scalarHelper.js` (TS 6 `#/util/...`). Testový projekt má `rootDir: ".."` a zdedený `outDir: dist`,
  TS 7 preto odvodí cestu z cieľa `default: ./dist/*`. Taký import **prejde `tsc -p test`, ale vitest zlyhá**
  („Cannot find module '#/src/util/helper/scalarHelper.js'") a node s `development` hľadá `src/src/...`
  (`21-src-import.log`, na kópii). S `customConditions: ["development"]` (podmienka, cez ktorú `#/` rieši vitest)
  ponúkne TS 7 `#/util/...` (`20-varianty.log`: rovnako v `test/tsconfig.json` aj v základnom, zvolil som len test).
  Ručne napísaný `#/src/...` prejde `tsc -p test` aj s opravou, zachytí ho až `yarn test`.

### Výsledky (`22-zaver2.log`, `kontroly-ts7/`, `start-ts7/`)

| krok | výsledok |
|---|---|
| `yarn install`, `yarn dedupe --check` | exit 0 |
| `yarn lint:fix` | exit 0, nezmenil nijaký súbor |
| `yarn ci` | exit 0 (`tsc --noEmit` a `tsc -p test` už pod TS 7, `format:check`, oxlint) |
| `VITEST_MAX_WORKERS=2 yarn test` | 13 súborov, 66 testov, všetky prešli |
| `yarn build`, `yarn tsc` | exit 0, `dist` 206 súborov |
| `dist` oproti TS 6 (`dist-ts6/`, `16-mapy.log`) | **103/103 `.js` bajtovo zhodných**; 98/103 `.map` zhodných; 5 `.map` (`config`, `roomUserManager`, `hocuspocus`, `datetimeHelper`, `exectionLockHelper`) má v TS 7 navyše spolu 11 segmentov mapovania, žiadny nechýba. Ide o ` = predvolená hodnota` parametra s typom (napr. `hocuspocus.js:16` `debugging = false` → `: boolean = false`). `sources`, `sourcesContent` a `names` sú rovnaké. Kozmetické. |
| `yarn prod` | exit 1 po 32 s, `MongooseServerSelectionError: getaddrinfo ENOTFOUND mongo-anzu` (stack `dist/index.js:35`), ako pri TS 6 |
| `yarn dev` | exit 1 po 33 s, tá istá chyba (stack `src/index.ts:40`) |
| `yarn command:article:validate --help` | exit 0 |
| `sentry-cli sourcemaps inject` na kópii `dist` (`sentry-ts7/`) | exit 0, 103/103 `.js` s debug ID, 103 máp s `debugId`, 158 špecifikátorov `#/` nezmenených, `node --check` 0 chýb, import cez `#/` ide |
| JS API `typescript` | v repozitári nič (`src`, `test`, `bin`, `vitest.config.mts`, docker); v `node_modules` žiadny balík nemá `typescript` v dependencies/peer/optional a žiadny súbor ho nenačíta menom (`11-ts-api.py` + grep), teda ani tsx, vitest, vite či sentry-cli. Hlavný export TS 7 je len `lib/version.cjs` (API je pod `typescript/unstable/*`). |

### Čas `tsc` (`12-cas-ts6.log`, `12-cas-ts7.log`, 3 behy, `/usr/bin/time`)

| | TS 6.0.3 | TS 7.0.2 |
|---|---|---|
| `tsc --noEmit` | 4,84 – 5,16 s, ~615 MB | 1,23 – 1,27 s, ~370 MB |
| `tsc -p test` | 5,09 – 5,45 s, ~669 MB | 1,24 – 1,52 s, ~415 MB |
| `tsc` (emit) | 4,91 – 5,26 s, ~623 MB | 1,26 – 1,29 s, ~380 MB |
| `--extendedDiagnostics` | total 4,55 s (check 3,05 s), 419 MB, 1076 súborov | total 1,18 s (check 0,96 s), 305 MB, 1076 súborov |

Asi 4× rýchlejšie a o ~40 % menej pamäte.

### Neoverené

- Skutočný VS Code s rozšírením (nenainštalované). Overený je len jazykový server, ktorý spúšťa.
- Beh v Azure. Že `linux-x64` binárka v obraze `node24` pobeží, je odvodené (statická binárka, `os`/`cpu` sedia).
- WebStorm s TS 7 som neskúmal.
