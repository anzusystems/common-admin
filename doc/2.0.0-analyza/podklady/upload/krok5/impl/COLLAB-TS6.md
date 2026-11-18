# COLLAB-TS6: kolaboračný server – TypeScript 6.0.3 a aliasy `#/`

Zadanie `krok5-praca/zadania/zadanie-collab-ts6-aliasy.md`. Repozitár `/home/volar/projects/petit/collaboration`, vetva
`next`, HEAD c8d96a2. **Nič necommitnuté**, žiadne vetvy ani stash; lokálna zmena `.gitignore` (vlastníkova) nedotknutá.
Node v24.15.0 lokálne. Logy a skripty (mimo `/tmp`): `/home/volar/projects/anzusystems/krok5-praca/collab-ts6/`.

Zmenené súbory: `package.json`, `yarn.lock`, `tsconfig.json`, `test/tsconfig.json`, `vitest.config.mts` a 63 súborov
`src`/`test` (len importy). Lokálne, necommitované (v `.gitignore`): `.vscode/settings.json`. Mimo repozitára:
`krok5-praca/perf/collab-next-ts59/` a jeden riadok v `krok5-praca/perf/lib/scenarios.mjs`.

## 0. Výkonový variant `next-ts59` (pred zmenami)

- `node perf/lib/makeVariant.mjs next-ts59` (bez záplat; `collab-next-ts59.patch` má 0 zmenených riadkov) skopíroval
  `dist` a `package.json` z next, `node_modules` je odkaz na next. `distHash` repozitára pred zmenou aj kópie:
  **a8274d7946ac181d** (build z 22. 10. 02:39, rovnaký ako v `results/main/summary.md`).
- Zaregistrovaný v `perf/lib/scenarios.mjs` (zoznam variantov, s komentárom), takže ho `run-all.sh` vie merať.
- Starý `dist` importuje `tslib` (42 súborov). Priama závislosť `tslib` je teraz preč, ale `tslib@2.8.1` ostáva
  vyzdvihnutý v `node_modules` (bullmq, async-mutex). Overené `collab-ts6/checkVariant.sh` (prod skript variantu, env ako
  `checkResolve.mjs`, Mongo na zatvorenom porte): zastaví sa na `MongooseServerSelectionError`, žiadna chyba modulu,
  `tslib` z `node_modules/tslib`, zo `src`/`dist` repozitára nenačíta nič. `checkResolve.mjs` som nespúšťal, lebo by
  prepísal `results/resolve-check/next.files`.
- Nový `dist` next: **e57000ab1086ae4c**. `run-awarefinal.sh` (predvolený `EXPECT_DIST_HASH` a8274d…) ho teda odmietne,
  presne ako má.

## 1. TypeScript 6.0.3

`typescript ^5.9.3` → `^6.0.3` (najnovšia 6.x; `latest` je 7.0.2). Release notes 6.0 cez ctx7
(`/microsoft/typescript-website`). S pôvodným `tsconfig.json` dal TS 6 **54 chýb** (TS2322 37×, TS2345 6×, TS18046 4×, …),
všetky z nového predvoleného `strict: true` (`tsc6-unchanged-config.log`). Deprecation chyby žiadne: es6, `allowJs`,
`importHelpers` ani dekorátory TS 6 neruší.

| Voľba | Pred | Po | Prečo |
|---|---|---|---|
| `target` | `es6` | `es2025` | Node 24 (V8 13.6) má celé ES2025 (iterator helpers, metódy Set, `Promise.try`, `RegExp.escape`, Float16Array, import attributes). Je to aj predvolený target TS 6. `@tsconfig/node24` 24.0.5 má `es2024` + `ESNext.*` knižnice, lebo TS 5 nemal lib es2025; v TS 6 sú tieto knižnice v es2025. Medzi es2024 a es2025 TS v tomto kóde nič neznižuje, emit je rovnaký. |
| `lib` | 66 položiek (ES5…ES2022, ESNext.*, DOM, DOM.Iterable, ScriptHost, WebWorker*) | `["ES2025", "DOM"]` | DOM kód **potrebuje**: `tiptap/marks/Comment.ts` pretypuje na `HTMLSpanElement` (bez DOM 2× TS2304). Signatúry `parseHTML`/`renderHTML` v `@tiptap/core` a `prosemirror-model` používajú `HTMLElement` a pod.; bez DOM by sa pri `skipLibCheck` potichu stali `any`. `Headers`/`URLSearchParams`/`fetch` v testoch berú typy z `@types/node`, DOM na ne netreba. DOM.Iterable je v TS 6 súčasťou DOM (`lib.dom.iterable.d.ts` je prázdny). ScriptHost a WebWorker kód nepotrebuje. |
| `types` (namiesto `typeRoots`) | `typeRoots: ["node_modules/@types"]` (predvolená hodnota) | `["node"]` | TS 6 má predvolené `types: []`. Ostatné `@types` (base64id, cli-progress, cli-table, jsonwebtoken) sa riešia cez importy. |
| `strict` | – (false) | `false` explicitne | Zachová dnešné kontroly; zapnutie (54 chýb) je samostatná úloha. `noImplicitAny: true` ostáva. |
| `rootDir` | – (odvodený `src`) | `"src"` | TS 6 berie predvolene priečinok tsconfigu, výstup by išiel do `dist/src/…`. Mapy sa nezmenili: `sources: ["server/hocuspocus.ts"]`, `sourceRoot: "/"`. |
| `paths` | – | `{"#/*": ["./src/*"]}` | Rieši `#/` v TS; dôvody v časti 2. |
| `esModuleInterop` | `true` | odstránené | V TS 6 ho nemožno vypnúť, platí vždy (a `nodenext` ho aj tak predpokladal). |
| `allowJs` | `true` | odstránené | V `src` nie je žiadny `.js`. |
| `experimentalDecorators`, `emitDecoratorMetadata` | `true` | odstránené | V `src` ani `test` nie je dekorátor. `import 'reflect-metadata'` v `index.ts` som nechal (nesúvisiaci refaktor), dnes nemá využitie. |
| `importHelpers`, `noEmitHelpers` + závislosť `tslib` | `true` | odstránené | Výstup es2025 nepotrebuje žiadny helper (v novom `dist` je 0 helperov; starý mal `__awaiter` 119× a `__rest` 1× z `tslib`). Keby helper niekedy treba bolo, TS ho bez `noEmitHelpers` vloží do súboru. |
| `test/tsconfig.json` `rootDir` | – | `".."` | Testy ležia mimo `src`: s `rootDir: "src"` hlási TS6059 aj pri `noEmit`. |

Ponechané: `module`/`moduleResolution` `nodenext`, `skipLibCheck`, `noImplicitAny`, `sourceMap`, `inlineSources`,
`sourceRoot: "/"` (Sentry), `outDir`. Nové predvolené hodnoty TS 6, ktoré nenastavujeme: `noUncheckedSideEffectImports:
true` (`import 'reflect-metadata'` sa rieši, prejde), `libReplacement: false`.

**`useDefineForClassFields`** (od ES2022 platí `true`, sémantika [[Define]]): nenastavujem, žiadna trieda tým nemení
správanie.
- `NodeError` (`node`, `content = null`) a `AnchorError` (`value = null`) majú inicializované polia. `RangeError` nemá
  rovnomenné vlastnosti ani settery a konštruktor ich potom priradí, výsledok je rovnaký. V emite sa
  `this.node = null` z konštruktora presunulo na pole triedy.
- `SentryTransport extends TransportStream` nemá deklarácie polí, len metódu `log`.
- `LogRecordError`, `MarkError`, `FieldLockContentionError` a trieda v `test/support/hocuspocus.ts` nemajú polia.
- Rizikový prípad (deklarované pole bez inicializátora prekryje vlastnosť, ktorú nastavil základný konštruktor) v kóde nie
  je. tsx (esbuild 0.28.2) target `es2025` pozná a volí tiež define (sonda: `x?: number` po `super()` dá `undefined` pri
  es2025/es2024, `1` pri es6), takže dev aj tsc idú rovnako.

Kompatibilita:
- typescript-eslint 8.72: peer aj `SUPPORTED_TYPESCRIPT_VERSIONS` `>=4.8.4 <6.1.0`, eslint bez varovania.
- tsx 4.23.15 balík typescript nepoužíva (esbuild).
- vitest 5.0.5 / vite 8.3.5: oxc číta tsconfig sám, v logu testov nie je varovanie o tsconfig.
- `yarn install` hlási YN0086 (hocuspocus extension-database/logger neposkytujú y-protocols/yjs serveru); to bolo už
  predtým (`collab-opravy/kontrola-install.log`), s TS nesúvisí.

## 2. Aliasy `#/`

`package.json`:

```json
"imports": { "#/*": { "development": "./src/*", "default": "./dist/*" } }
```

- **prod** (`node dist/index.js`, žiadne podmienky) dostane `default` → `./dist/*`.
- **dev**, **watch** (nodemon spúšťa `yarn dev`) a **`command:article:validate`** majú v `NODE_OPTIONS`
  `--conditions=development` → `./src/*.js`, tsx z toho spraví `.ts`. tsx navyše uplatní `paths` z tsconfigu, takže pri
  cwd v repozitári ide `#/` do `src` aj bez podmienky; podmienka ostáva ako výslovný zámer a pre iný cwd. Lokálny docker
  (`docker/app/local`) spúšťa `yarn run dev`.
- **vitest**: predvolené ssr podmienky Vite obsahujú `development|production`, čo je `development` len vtedy, keď
  `NODE_ENV` nie je `production`. Overené dumpom modulov (`VITEST_DEBUG_DUMP`): s `NODE_ENV=production` testy **potichu
  bežali proti starému `dist`** (40 modulov z `dist`, 0 zo `src`, všetko zelené). Preto
  `ssr: { resolve: { conditions: ['development'] } }` vo `vitest.config.mts` (testy prostredia node sa riešia v `ssr`;
  `resolve.conditions` na najvyššej úrovni ide len do `client`). Potom 40 modulov zo `src`, 0 z `dist`, celá sada 66/66
  aj s `NODE_ENV=production`.
- **TypeScript (tsc aj VS Code)**: `paths: {"#/*": ["./src/*"]}`. Skúšal som tri cesty (sondy v scratchpade a tsserver):
  1. Mapovanie `outDir`→`rootDir` (bez podmienky pre TS): funguje pre projekt `src`. V projekte `test` (`rootDir: ".."`)
     mapuje `dist/x.js` na `<repo>/x.ts`, teda zle: TS7016 (s `dist`), resp. TS2307 (bez neho).
  2. Podmienka `types: "./src/*"`: funguje pre tsc v oboch projektoch, ale **automatický import TS 6.0.3 kľúče `imports`
     začínajúce `#/` vynecháva** (`node_modules/typescript/lib/typescript.js`, `tryGetModuleNameFromPackageJsonImports`:
     `if (!startsWith(k, "#") || k === "#" || startsWith(k, "#/")) return void 0;`). tsserver aj s `non-relative`
     ponúkol len `../manager/jobManager.js`.
  3. `paths`: tsc rieši `#/` cez `paths` (`--traceResolution`: „'paths' option is specified… matched pattern '#/*'…
     src/config/config.ts“, `trace-resolution-paths.log`) a automatický import ponúka `#/`.

  Zvolil som 3, jediné, s ktorým editor navrhuje `#/`. Daň: mapovanie je na dvoch miestach (`package.json` pre runtime,
  tsconfig pre TS), obe s jedným riadkom `#/*` → `./src/*`. Vetvu `default` (dist) TS neoveruje v žiadnom variante,
  nezhodu chytia testy a štarty dev/prod. Keď TS začne `#/` z `imports` navrhovať, dá sa `paths` nahradiť podmienkou
  `types` (varianta 2).
- **Prepis importov** skriptom `collab-ts6/rewriteImports.mjs`: **263 špecifikátorov v 63 súboroch** (statické
  import/export 224, dynamické `import()` 5, `vi.mock` 34), cieľ vždy `#/<cesta od src>.js`.
  - Ponechané: `import('../package.json')` v `keepalive.test.ts`.
  - `./…` ostáva relatívne: 39 v tom istom priečinku a 60 do podpriečinka (`./processor/…`, `./document/…`,
    `./fixtures/…`, `./support/…`); zadanie mení len `../`.
  - Prettier potom zlúčil jeden viacriadkový import (`requestToJoinListener.ts`). Mimo `../package.json` v `src`/`test`
    žiadne `../` neostalo.
- **eslint**: konfigurácia nemá pravidlá poradia importov ani resolver (len `@typescript-eslint` recommended a štýlové
  pravidlá, parser bez `project`), preto bez zmeny. eslint je čistý.

## 3. VS Code

Vytvorený `.vscode/settings.json` (predtým neexistoval; `git check-ignore` potvrdzuje `.gitignore:4:.vscode`):
`typescript.tsdk: node_modules/typescript/lib`, `typescript.preferences.importModuleSpecifier: non-relative`.
Overené tsserverom z `node_modules` (ten, na ktorý VS Code ukazuje `tsdk`), skript `collab-ts6/autoImportProbe.mjs`:
otvorí súbor v pamäti s jedným nenaimportovaným menom a pýta si opravy TS2304 („Add import from …“). Výsledok
`auto-import-probe.log`:

| Prípad | `non-relative` (nastavené) | `shortest` (predvolené) |
|---|---|---|
| `useJobManager` do `src/server/hocuspocus.ts` (iný priečinok) | `#/manager/jobManager.js` | `#/manager/jobManager.js` |
| `useRoomLockManager` do `src/manager/jobManager.ts` (ten istý priečinok) | `#/manager/roomLockManager.js` | `./roomLockManager.js` |
| `stringToNumber` do `test/config.test.ts` | `#/util/helper/scalarHelper.js` | `#/util/helper/scalarHelper.js` |

`non-relative` je nastavené podľa zadania, ale ponúka `#/` aj v rámci priečinka, teda proti pravidlu z časti 2. Pravidlu
zodpovedá predvolené `shortest`: stačí riadok `importModuleSpecifier` vynechať. Rozhodnutie nechávam na vlastníkovi.
Neoverené v skutočnom okne VS Code, len cez tsserver.

## 4. Kontroly (finálny stav, `collab-ts6/runChecks.sh`, logy `final-*.log`)

| Kontrola | Výsledok |
|---|---|
| `yarn install` | exit 0 (YN0086 ako predtým) |
| `yarn dedupe --check` | exit 0, „No packages can be deduped“ |
| `yarn lint:fix` | exit 0 (tsc src + test, prettier, eslint) |
| `yarn ci` | exit 0 |
| `yarn test` (`VITEST_MAX_WORKERS=2`) | **13 súborov, 66/66** (rovnaký počet ako v `collab-opravy`), ~7 s; aj s `NODE_ENV=production` 66/66 zo `src` |
| `yarn build` | exit 0; `dist/index.js` (nie `dist/src`), 206 súborov |
| `yarn tsc` | exit 0 |
| prod štart (`yarn prod`) | zastaví sa na `MongooseServerSelectionError: getaddrinfo ENOTFOUND mongo-anzu`, exit 1 |
| `yarn dev` | to isté |
| hook `collab-ts6/resolveLog.mjs` (resolve + load, súbory repozitára mimo `node_modules`) | prod: **src 0, dist 96**, 24 `#/` špecifikátorov všetky → `dist`; dev: **src 96, dist 0**, všetky → `src/*.ts`; dev s hookom pred tsx: src 96, dist 0; Sentry injection ako pri ESM (ioredis, mongodb) |
| `command:article:validate --help` | exit 0; s hookom src 45, dist 0 |
| `yarn watch` | na Mongo, nodemon čaká na zmenu (timeout 60 s) |
| `sentry-cli sourcemaps inject` na kópii `dist` (+ skutočný `package.json`, `collab-ts6/checkSentryInject.sh`) | 103/103 súborov s debug ID, `node --check` 0 chýb, 158 `#/` špecifikátorov injekcia nezmenila, import `fetchDocument.js` cez `#/` prejde |
| schéma (`nastroje/schema-parita`) | `server-schema-ts6.json` je bajtovo zhodný s ESM behom; proti `cms-schema-icons.json` len poradie uzlov (D6), proti `cms-schema-noicons.json` len ikona (D5) |
| variant `next-ts59` | štart po Mongo, `tslib` z vyzdvihnutého `node_modules` (časť 0) |
| Dockerfile (čítaním) | `docker/app/kubernetes/Dockerfile` kopíruje `dist`, `node_modules` a `package.json` (teda aj `imports`). Supervisor spúšťa `yarn run prod`, bez podmienok, takže `#/` → `dist`. `src` v obraze nie je a netreba ho. |

## 5. `dist` pred a po (`collab-ts6/compareDist.mjs`, `dist-compare.txt`)

Tri buildy: pred = `perf/collab-next-ts59/dist` (TS 5.9, es6, tslib), medzikrok = TS 6 + es2025 ešte s relatívnymi
importmi (`collab-ts6/dist-ts6-relative`, vplyv kompilátora a targetu), po = finálny `dist` s `#/`.

| | súbory | spolu B | .js B | .map B | riadky .js | `tslib` import | `__awaiter(` | `yield` | `async`/`await` | `?.`/`??` | `void 0` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| pred | 206 | 537 707 | 192 298 | 345 409 | 4 540 | 42 | 119 | 236 | 0/0 | 0/0 | 261 |
| TS 6, relatívne | 206 | 527 545 | 182 574 | 344 971 | 4 469 | 0 | 0 | 0 | 119/236 | 9/10 | 0 |
| po (`#/`) | 206 | 525 769 | 181 817 | 343 952 | 4 469 | 0 | 0 | 0 | 119/236 | 9/10 | 0 |

- Rovnaké mená súborov vo všetkých troch. Kompilátor a target zmenili 51 `.js` (a ich mapy), ostatné sú bajtovo zhodné.
  Aliasy zmenili 47 `.js` a 49 máp: dve mapy navyše, lebo `inlineSources` nesie zmenený zdroj aj tam, kde sa import iba
  typu z `.js` vypustil.
- `.js` spolu −10,5 kB (−5,5 %). Najviac `manager/roomUserManager.js` −1 163 B, `roomLockManager.js` −1 009 B,
  `joinCollabRoomListener.js` −880 B. Narástol len `document.model.js` o 1 B, lebo numerický oddeľovač `11_000` už nemusí
  ísť na `11000`.
- Vzorky:
  - `async function` / `await` namiesto `__awaiter(this, void 0, void 0, function* () { … yield … })` a importu `tslib`
    (`fetchDocument.js`).
  - `?.` a `??` namiesto `(_a = …) !== null && _a !== void 0 ? _a : …` (`sentryTransport.js`).
  - Polia tried `node = null;` namiesto priradení v konštruktore (`NodeError.js`).
  - `'#/types/RoomInfo.js'` namiesto `'../types/RoomInfo.js'` (`roomUserManager.js`).
- Mapy: `sourceRoot: "/"`, `sources` ako predtým (napr. `server/hocuspocus.ts`), `sourcesContent` prítomné, takže
  Sentry rieši rámce rovnako.

## Neoverené

- Build docker obrazu a beh v ňom. Overené len čítaním a štartom z `dist` lokálne (Node 24.15; obraz má 24.21).
  `.dockerignore` vylučuje `dist` aj `node_modules`, hoci ich Dockerfile kopíruje; to je stav pred touto zmenou
  a CI šablóna zrejme používa iný kontext. Nemenil som to.
- Skutočné okno VS Code (len tsserver, časť 3).
- Ako oxc vo vitest spracuje target `es2025` (žiadne varovanie a žiadna trieda, ktorej by sa to týkalo).
- Či CI šablóna nastavuje `NODE_ENV`. Po zmene vo `vitest.config.mts` to na testy už nemá vplyv.
- Výkonové meranie `next-ts59` proti TS 6 buildu som nespúšťal, variant je len pripravený a overený štartom.
