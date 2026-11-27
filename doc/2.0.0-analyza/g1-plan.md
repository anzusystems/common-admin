# G1 — plán výmeny Vuelidate (2026-10-05, verzia 9; review: **Claude zelená (kolo 5), Codex zelená (kolo 5)**)

> **STAV 2026-10-06: fáza A je urobená, fáza B (kópia Vuelidate v knižnici ako náhradný engine) bola vlastníkom odmietnutá a je z knižnice odstránená.** Vlastník chcel Regle; tento plán engine zmenil bez neho, čo nemal. Z plánu platí len to, čo sa týka fázy A a playgroundu (4.1, kroky K0–A3, B2, 5.2, 5.3); časti o prevzatom engine (3.2 možnosť O, 3.3, 4.2 výber enginu, 4.3, B1, B3–B5, 5.1) sú história. Aktuálny stav a čo ďalej: [g1-pokracovanie.md](g1-pokracovanie.md).
> - **Urobené a ponechané:** vstup `./validation` v knižnici; len importy zmenené v knižnici (48 súborov) a 6 adminoch (493 súborov), overené strojovo (`verify.mjs`); v každom admine 6 kontrol + produkčný build, testy = východisko. Playground `/view/validation` (S01–S18, 11 form prvkov) s testami, ktoré nemenujú engine.
> - **Vedľajší nález:** `yarn lint:tsc` s teplou cache neprekontroluje testový projekt, keď sa zmení len zdroják mimo `__tests__` (build mód sleduje koreňové súbory projektu; CI je vždy studené).
> - **Neoverené:** e2e adminov; dev servery piatich adminov (blog overený).

Reálny plán implementácie nad aktuálnym stavom repozitárov. Predchádzajúca analýza: [detail-G1-regle.md](detail-G1-regle.md), podklady [`podklady/g1_regle-scope/`](podklady/g1_regle-scope/README.md), aktuálny inventár [`inventar-2026-10-05/REPORT.md`](podklady/g1_regle-scope/inventar-2026-10-05/REPORT.md). **Táto verzia analýzu aktualizuje a mení jej záver o engine** (sekcia 3).

## 0. Zhrnutie
- **Cieľ tejto práce:** (A) všetok kód knižnice a 6 adminov importuje validáciu len cez vstup knižnice, bez zmeny správania; (B) náhrada enginu je v knižnici pripravená a overená na všetkých adminoch, ale **nie je zapnutá** — predvolený engine ostáva npm Vuelidate, kým nerozhodne vlastník.
- **Čo táto práca nedosiahne:** odstránenie `@vuelidate/*` a `vue-demi` z flotily. Na to treba rozhodnutie vlastníka o engine, vydanie knižnice a zvýšenie verzie v adminoch. Výsledok je **stav pred vydaním** (staging): admini fungujú len so skopírovaným buildom knižnice, čerstvá inštalácia vráti registry build bez `./validation` — rovnako ako dnes celá vetva `upgrade-sep-2026` závisí od nevydanej knižnice.
- **Fáza A — najprv API, engine nezmenený:** knižnica dostane vstup `@anzusystems/common-admin/validation`, ktorý zatiaľ len preexportuje skutočný Vuelidate pod rovnakými menami. Knižnica aj 6 adminov sa prepnú na tento vstup (mení sa len riadok importu). Správanie sa nemôže zmeniť, lebo beží ten istý kód.
- **Fáza B — náhrada enginu pripravená, nezapnutá:** zdroják Vuelidate 2.0.3 (MIT) sa prevezme do knižnice ako TypeScript. Testy knižnice vedia bežať nad ktorýmkoľvek enginom (`VALIDATION_ENGINE`). Každý admin sa skúšobne preverí s buildom knižnice, v ktorom sú dva súbory vstupu dočasne prepnuté na prevzatý engine, a potom dostane späť build nad npm Vuelidate. Zapnutie = zmena dvoch súborov vstupu, keď vlastník rozhodne. Keďže po fáze A ide všetko cez jeden vstup, v žiadnej appke nikdy nebežia dva enginy naraz — netreba žiadny most.
- **Čo je pripravená náhrada, na rovinu:** vlastný fork Vuelidate udržiavaný v knižnici (1 536 riadkov prevzatého kódu: jadro 874, použité validátory 476, deklarácie 186), nie Regle. Dôvody sú v sekcii 3; Regle ostáva otvorená možnosť za tým istým vstupom a adminov by sa už nedotkol.
- **Overenie pripravenej náhrady:** diferenčné testy (npm Vuelidate proti prevzatej kópii, stav po krokoch) a celá sada testov knižnice vrátane nového playgroundu so scenármi z adminov a všetkými form prvkami, pustená dvakrát — raz nad každým enginom.
- **Nerobí sa:** oprava 16 brán, ktoré dnes preskakujú pravidlá (správanie sa zachová); zmena sémantiky scope; commity, vetvy, release; `git stash/clean/checkout/reset` (sekcia 8).

## 1. Stav repozitárov (2026-10-05)
| Repo | Vetva | Stav | Poznámka |
|---|---|---|---|
| common-admin | `next` (HEAD `0ea35fe2`) | čistý okrem nesledovaných `doc/…`, `lineClamp.json` a zmeny `vitest.config.mts` (vylúčenie `doc/**` z testov, urobené v tejto práci pred východiskom) | `1.47.0-beta.dev-1790167636`; `src/domains`, `src/shared`, testy v `__tests__`; vstupy `.`, `./testing`, `./eslint`, `./vite`, `./styles` |
| admin-cms, -blog, -forum, -inhouse, -ugc (`/home/volar/projects/petit/`), admin-dam (`/home/volar/projects/anzusystems/`) | `upgrade-sep-2026` | čisté; cms a dam majú vlastníkov `stash@{0}` (nedotýkať sa) | `package.json` pinuje registry build `…1790143991`; v `node_modules` je ručne skopírovaný build z `next` (`copy.sh`); vlastné unit testy (happy-dom) |

Všade `@vuelidate/core` ^2.0.3, `@vuelidate/validators` ^2.0.4, Vue 3.5.43, TS ~6.0.3, vitest 5. Vykonávajúca session (Claude Code) má zápis do všetkých 7 repozitárov — overené `test -w` na `src/` a `node_modules/@anzusystems/common-admin` každého admina. Review v read-only sandboxe zápis nemá; to je vlastnosť review, nie vykonania.

**Východisko (K0), namerané:** knižnica `lint:tsc` 0 chýb, testy 248 súborov / 2 523; `lint:tsc` 0 chýb a testy: blog 245, ugc 93, forum 349, inhouse 660, dam 407, cms 2 066 (cms `lint:tsc` za studena 66 s, špička 4,6 GB). `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` kód 0 vo všetkých 7 repozitároch; knižnica `yarn build` (13,6 s) a `check-dist-imports/types/css` kód 0. Výstupy a `git status --porcelain` každého repa: [`podklady/g1_regle-scope/impl/k0/`](podklady/g1_regle-scope/impl/k0/SUMMARY.md). K0 je hotové.

## 2. Inventár (AST prechod 2026-10-05)
| | cms | blog | forum | inhouse | ugc | dam | knižnica |
|---|---|---|---|---|---|---|---|
| súbory s `@vuelidate/core` / `validators` | 281 / 29 | 20 / 3 | 32 / 4 | 57 / 17 | 20 / 0 | 61 / 2 | 43 spolu |
| volania `useVuelidate(` | 341 | 20 | 30 | 59 | 19 | 65 | 24 (+ 7 testov) |
| import: pomenovaný / default / `* as validators` | 262 / 5 / 0 | 20 / 0 / 2 | 30 / 0 / 2 | 56 / 0 / 0 | 18 / 0 / 0 | 52 / 9 / 1 | default |
| typy z `@vuelidate/core` | `Validation` 9, `BaseValidation` 5, `ErrorObject` 2, `ValidationRule` 1 | — | 2 súbory | 2 súbory | 2 súbory | 4 súbory | `ErrorObject` |
| z `@vuelidate/validators` | `helpers`, `createI18nMessage`, `required`, `integer`, `decimal` | `createI18nMessage`, `helpers` | `createI18nMessage`, `helpers` | `integer`, `createI18nMessage`, `helpers`, `required`, `minValue`, `maxValue` | — | `helpers` | `createI18nMessage`, `helpers`, `required`, `requiredIf`, `minLength`, `maxLength`, `minValue`, `maxValue`, `between`, `email`, `url`, `numeric` |
| `helpers.*` | `withMessage`, `regex`, `forEach`, `req`, `withParams` | `regex` | `regex` | `req`, `regex`, `withParams`, `withMessage` | — | `withMessage`, `req` | `regex`, `req` |

Spolu v adminoch 534 volaní, všetky v tvaroch `()`, `(config)`, `(rules, state)`, `(rules, state, config)`; kľúče configu len `$scope`, `$stopPropagation`, `$autoDirty`. Vlastných definícií validátorov ~140, väčšina s closure nad stavom formulára; 19 so `siblings`/`vm`. Čítajú sa aj `$silentErrors`, `$errors[].$message/$uid/$propertyPath`, `v.required.$params.type`, `$error`, `$path`, `$invalid` poľa. Nikde: `withAsync`, `$externalResults`, `$lazy`, `$rewardEarly`, `$validationGroups`, `$model`, Options API. Mimo `src/`: `@vuelidate/core` v `optimizeDeps.include` vo `vite.config.mts` každého admina; v knižnici `vitest.config.mts:51,75` a `vite.config.lib.mts:114-115`. Testy s Vuelidate: knižnica 7 súborov, cms 7 súborov (`src/test/`), ostatní admini žiadne.

## 3. Nové zistenia a rozhodnutie o engine
### 3.1 Čo sondy ukázali (Regle 1.29.3; overené aj nezávislým review)
| Zistenie | Dôsledok pre flotilu |
|---|---|
| Regle **nesleduje reaktívne závislosti vnútri validátora** — pravidlo prepočíta len pri zmene hodnoty poľa alebo deklarovaného parametra (a pri `$touch()`/`$validate()`, takže brána `$touch(); if ($invalid)` ostane správna) | živý stav medzi dotykmi je zastaraný: chyby, odznaky a `$silentErrors` čítané bez `$touch` (napr. cms `aiDigestRunSelectionValidation.ts:99-101`); ~140 vlastných validátorov by bolo treba prepísať tak, aby každá závislosť bola parameter |
| Pole, ktorého **hodnota je objekt**, berie Regle ako vnorený strom; typ stavu určí hodnota pri inicializácii (`null` → pole, objekt → strom, kde `required` je „kľúč“ a vyplnený objekt vyjde neplatný) | rovnaké pravidlá sa správajú inak podľa toho, čo bolo v modeli pri mountnutí; `markStatic` by musel obaľovať hodnoty modelu |
| Pole s hodnotou pole je kolekcia (`$self`, `$each`); zber `$scope` v celej appke a 149 ms na úder klávesu | známe z prvej analýzy |

### 3.2 Možnosti
| | Čo to znamená | Hodnotenie |
|---|---|---|
| **N** — Regle natívne | prepísať vlastné validátory, pri každom poli vedieť typ hodnoty, mapovať tvary | riziko tichých chýb v ~534 formulároch; ručná práca; nedá sa overiť porovnaním dvoch enginov nad rovnakým kódom; bez dozoru nebezpečné |
| **C** — Regle ako úložisko stavu polí | pravidlá vyhodnocuje vrstva, Regle drží `$dirty` | Regle by robil to, čo `ref(false)`; rovnaká vrstva ako O plus závislosť |
| **O** — fork Vuelidate v knižnici | prevziať zdroják 2.0.3 ako TypeScript, engine sa nemení ani o riadok logiky | parita z konštrukcie, žiadna nová závislosť, adminom sa mení len import; kód udržiavame my |

### 3.3 Rozhodnutie
**Fáza A sa vykoná celá. O sa pripraví a overí, ale nezapne.** Fáza A (všetko cez vstup knižnice, engine nezmenený) je užitočná sama osebe a je presne poradie, ktoré vlastník navrhol 29. 9. (sekcia 14 detailu): oddelí adminov od výberu enginu. Sondy robia migráciu na Regle bez dozoru nebezpečnou; neoprávňujú však zvoliť za vlastníka opačné dlhodobé riešenie. Preto sa fork dodá ako hotová, overená možnosť s vyčíslenou cenou údržby, nie ako nový predvolený stav.

Vlastník pôvodne rozhodol „Regle“, nechcel „vesmírnu loď“ a nie je k dispozícii. Fork je vlastný kód na údržbu — to je cena tejto voľby a treba ju povedať otvorene. Navrhnutý je preto, že je jediný overiteľný a vratný: zapnutie sú dva súbory vstupu (`src/validation/core.ts`, `validators.ts`), npm Vuelidate ostáva v testoch ako etalón a otázky „fork áno/nie“ a „Regle áno/nie“ ostávajú vlastníkovi (sekcia 9) bez toho, aby sa muselo čokoľvek v adminoch robiť znova.

## 4. Architektúra v knižnici
### 4.1 Verejný vstup `@anzusystems/common-admin/validation`
Nový vstup buildu vedľa `./testing`: `vite.config.lib.mts` (`lib.entry.validation`), `package.json` (`exports`), `scripts/check-dist-types.mjs` (pridať `validation.d.ts`), nová kontrola `scripts/check-dist-validation.mjs` (4.2).

| Export | Poznámka |
|---|---|
| `useVuelidate` (pomenovaný) | rovnaké meno, signatúra a typy ako v `@vuelidate/core` |
| `required`, `requiredIf`, `minLength`, `maxLength`, `minValue`, `maxValue`, `between`, `email`, `url`, `numeric`, `integer`, `decimal`, `helpers`, `createI18nMessage` | len to, čo flotila a knižnica importujú; rovnaké mená ako `@vuelidate/validators`. Vstup teda **nemá** všetkých členov balíka (chýba `alpha`, `alphaNum`, `and`, `or`, `not`, `sameAs`, `ipAddress`, `macAddress`, `requiredUnless`); `import * as validators` vo flotile (5×) číta len `createI18nMessage`, codemod a `lint:tsc` zachytia čokoľvek iné |
| typy `Validation`, `BaseValidation`, `ErrorObject`, `ValidationRule`, `ValidationArgs`, `GlobalConfig`, `ValidatorFn`, `ValidationRuleWithParams`, `ValidationRuleWithoutParams` | prevzaté deklarácie oboch balíkov (194 + 103 riadkov), vrátane zámerne voľných typov (`helpers.req: Function`, `withI18nMessage` vracia `T`) — typová kontrola adminov sa nemení; v B1 `expectTypeOf<typeof kópia.X>().toEqualTypeOf<typeof npm.X>()` pre každý export |

`useValidate()` ostáva v hlavnom vstupe. Mená sa zámerne nemenia: v adminoch sa tak mení len špecifikátor importu.

### 4.2 Súbory
| Súbor | Fáza A (a predvolený stav po tejto práci) | Fáza B / po zapnutí |
|---|---|---|
| `src/validation/index.ts` | verejný vstup, preexportuje `@/validation/core` a `@/validation/validators` (hodnoty aj typy) | bez zmeny |
| `src/validation/core.ts` | `useVuelidate` **a typy** z `@vuelidate/core` (samostatný súbor typov na úrovni vstupu nie je, aby prepnutie dvoch súborov prepínalo hodnoty aj typy vrátane vydaných `.d.ts`) | po zapnutí vlastníkom: z `@/validation/vuelidate/core` |
| `src/validation/validators.ts` | validátory **a ich typy** z `@vuelidate/validators` | po zapnutí vlastníkom: z `@/validation/vuelidate/validators` |
| `src/validation/vuelidate/core.ts`, `validators.ts`, `types.ts` | — | B1: prevzatý zdroják (MIT, hlavička s pôvodom a licenciou); žiadny vstup ho neimportuje — mimo testov (`VALIDATION_ENGINE=vendored`, diferenčné testy) nebeží |
| `src/validation/__tests__/` | test vstupu | diferenčné testy, parita typov, test identity enginu; `engines/npmCore.ts`, `engines/npmValidators.ts` (preexport npm balíkov s rovnakým povrchom ako `core.ts`/`validators.ts`, len pre testy) |
| `src/playground/validationView/` + `__tests__` | — | scenáre a matica prvkov |
| `scripts/codemods/vuelidate-to-validation/` | codemod + fixtures + test | — |

Vnútro knižnice (43 súborov) importuje z `@/validation/core` a `@/validation/validators`; `@vuelidate/*` smie importovať len `src/validation/` a testy — zákaz sa pridá **do existujúceho** záznamu `no-restricted-imports` v `eslint.config.mjs:31-47`; výnimka pre `src/validation/**` a testy je druhý blok, ktorý zákaz `@/lib` zopakuje (flat config pravidlo nahrádza, nespája).

**Výber enginu v testoch (B1):** `vitest.config.mts` číta `VALIDATION_ENGINE` (`npm` | `vendored`); keď je nastavená, alias presmeruje `@/validation/core` a `@/validation/validators` na pomenovaný engine (pred všeobecným aliasom `@`): `vendored` → `src/validation/vuelidate/*`, `npm` → `src/validation/__tests__/engines/npm*.ts`. Bez premennej platí to, čo je v súboroch; neznáma hodnota je chyba konfigurácie. `src/validation/index.ts` preexportuje cez `@/validation/core` a `@/validation/validators` (nie relatívne), aby alias zasiahol aj importy cez index. Celá sada sa dá pustiť nad ktorýmkoľvek enginom bez zmeny testov a bez zmiešaného stromu; `engineIdentity.test.ts` overí pre všetky tri špecifikátory (`@/validation`, `…/core`, `…/validators`), že beží vyžiadaný engine, a bez premennej, že predvolený je npm Vuelidate (po zapnutí forku vlastník zmení jednu konštantu v teste). Testy sú v každom režime tie isté, od režimu závisí len očakávanie — počet testov sa medzi behmi nelíši.

**Build premennú nečíta.** Alias vo Vite prepína len JavaScript; deklarácie generuje TypeScript program (`tsconfig.libdts.json`, `paths` len `@/*`), takže build cez alias by mal JS nad prevzatým enginom a `.d.ts` nad npm typmi (dnes 16 súborov s `import('@vuelidate/core')`). Skúšobný build (B3) preto vzniká **skutočným dočasným prepnutím dvoch súborov vstupu** — presne tým, čo by urobil vlastník — a B5 ich vráti. Dôsledky pre `dist/`:
- predvolený build po B1 obsahuje tri **nedosiahnuteľné** deklarácie `dist/validation/vuelidate/{core,validators,types}.d.ts` (`tsconfig.libdts.json` berie celé `src/**`), ale žiadny ich `.js` (`preserveModules` vydá len moduly dosiahnuteľné zo vstupov);
- skúšobný build nemá import z `@vuelidate/*` v žiadnom `.js` ani `.d.ts`: mimo dvoch súborov vstupu ich importujú len `__tests__`, ktoré `tsconfig.libdts.json` vylučuje;
- stráži to `scripts/check-dist-validation.mjs` (nový; v `.github/workflows/ci.yml` vedľa troch kontrol dist): engine zistí z importov v `src/validation/core.ts` a `validators.ts` (musia sa zhodnúť) a podľa neho overí `dist/` — **npm:** žiadny `.js` pod `validation/vuelidate/` a žiadny import doň zo súboru mimo tohto adresára; **vendored:** žiadny import `@vuelidate/*` v `.js` ani `.d.ts`. Importy číta cez `ts.preProcessFile` (zoznamy `importedFiles`, `typeReferenceDirectives` aj `ambientExternalModules`), nie hľadaním reťazca (hlavička s pôvodom kódu balík menuje); má test s fixtures v node sade.

### 4.3 Prevzatý engine (fáza B)
- Prevod `@vuelidate/core/dist/index.mjs` (774 riadkov) po funkciách, vrátane `useVuelidate`, `ResultsStorage`, `nestedValidations`, asynchrónnej vetvy, `$externalResults`, `$lazy`, `$rewardEarly`, `$validationGroups` — nič sa „nezjednodušuje“, aby neexistovalo správanie, o ktorom by bolo treba rozhodovať. Z validátorov len exportované v 4.1 (+ interné `common`).
- Zámerné rozdiely oproti originálu, len štyri: importy z `vue` namiesto `vue-demi`; kľúče provide/inject cez `Symbol.for('anzu:validation:1:…')`; počítadlo `$registerAs` na `globalThis` pod `Symbol.for` kľúčom s tou istou verziou protokolu (`1`; zmena tvaru výsledkov = nová verzia, takže dve rôzne verzie forku v jednom strome sa navzájom nezbierajú — test); vlastnosti na inštancii komponentu, v ktorých sú jeho collectory, majú vlastné mená (`__vAnzuValidationInject/Remove`), aby sa s npm balíkom nečítali navzájom. Druhý a tretí chránia pred zdvojenou inštanciou modulu (dva vstupy jedného balíka v dev bundli, `src/vite/devWatch.mjs:27` opisuje to isté pri Vuetify): bez nich by collector potichu nič nezbieral alebo by si deti prepisovali kľúče.
- Vetva Options API (`componentOptions.validations`) sa prevezme tiež; nepoužíva sa, ale je to 20 riadkov a drží kópiu úplnú.
- Regulárne výrazy sa preberajú bajt po bajte (vrátane `\u00a1-\uffff` ako escape, nie ako znaky); `src/validation/vuelidate/` musí byť čisté ASCII (test), `helpers` ostáva `Object.freeze({ __proto__: null, … })`.

### 4.4 Závislosti
- Fáza A: bez zmeny závislostí (`@vuelidate/*` ostávajú peer aj dev).
- Až po zapnutí vlastníkom (mimo tejto práce): `@vuelidate/*` z `peerDependencies` preč, v `devDependencies` ostávajú natrvalo ako etalón; z `vite.config.lib.mts` `external` preč; `yarn.lock` sa zmení (`yarn install`), lebo CI inštaluje `--immutable`. V `vitest.config.mts` `optimizeDeps.include` `@vuelidate/*` **ostávajú** (testy ich importujú; nevymenovaná závislosť zahodí testové súbory uprostred behu).
- Admini: `package.json` a `yarn.lock` sa **nemenia** (pinujú registry build bez `./validation`; `@vuelidate/*` v nich ostáva, kým vlastník nevydá knižnicu a nezvýši verziu). Do vtedy admin funguje len so skopírovaným buildom; `yarn install` v admine ho prepíše registry buildom a admin sa neskompiluje — to platí už dnes pre celú vetvu `upgrade-sep-2026`.

## 5. Kroky a brány
Ďalší krok sa nezačne, kým brána predchádzajúceho nie je zelená. **Kontroly sa púšťajú po jednej**, nikdy `yarn ci`/`yarn lint` (paralelné): `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint`, `vitest run --maxWorkers=4`, každá s limitom pamäte; cms `lint:tsc` vždy sám. „6 kontrol“ knižnice zahŕňa aj `yarn test:eslint` (node sada, načítava `vite.config.lib.mts`). **Každý build admina** beží s `env -u APP_DEPLOY_ENV -u SENTRY_URL -u SENTRY_AUTH_TOKEN` (inak by `anzuSentry` pri nastavených premenných nahral release a source mapy, `src/vite/sentry.mjs:21`), s `--outDir` mimo repa a pred behom sa overí, že premenné v prostredí nie sú. Počet testov sa porovnáva s predchádzajúcim krokom (nesmie klesnúť).

| Krok | Obsah | Brána |
|---|---|---|
| K0 | východisko: doplniť 4 chýbajúce kontroly v každom repe, build + dist kontroly knižnice; zapísať `git status --porcelain` každého repa | uložené v `podklady/g1_regle-scope/impl/k0/` |
| **A1** | knižnica: vstup `./validation` ako preexport; vnútro knižnice a jej 7 testov na `@/validation/*`; eslint zákaz priameho `@vuelidate/*`; strážne testy verejného API; `scripts/check-dist-validation.mjs` + krok v CI; `src/vite/devWatch.mjs:89-90` — filter `prebundle: false` rozšíriť z presného mena balíka aj na jeho podvstupy (+ prípad v `src/test/vite/devWatch.test.ts`) | 6 kontrol; všetky testy (≥ 2 523); `yarn build` **dvakrát po sebe** s rovnakým odtlačkom `dist/` (sha256 každého súboru podľa cesty) — determinizmus, na ktorom stojí B5; ak by build deterministický nebol, premenlivé súbory sa vymenujú, z odtlačku vynechajú a zapíšu; 4 kontroly dist: `check-dist-imports`, `check-dist-types` (aj `validation.d.ts`), `check-dist-css`, `check-dist-validation` |
| **A2** | codemod + fixtures + test; beh na sucho | test codemodu; na sucho: každý import z `@vuelidate/*` v 6 adminoch klasifikovaný, 0 neznámych mien |
| **A3** | pred každým adminom jeho východiskový produkčný build (`vite build --outDir <mimo repa>`, s limitom pamäte). Admini blog → ugc → forum → inhouse → dam → cms: `./copy.sh <cesta admina>` (explicitne; `.env.local` má len cms a ugc), **odtlačok** skopírovaného `dist/` = odtlačok buildu knižnice; codemod; `oxlint --fix` + `oxfmt` len na zmenených súboroch; do `optimizeDeps.include` vo `vite.config.mts` pridať `'@anzusystems/common-admin/validation'` (jediná zmena mimo `src/`) | 6 kontrol admina + produkčný build (`vite build --outDir <mimo repa>`); počet testov = východisko; `grep -r "@vuelidate/" src` prázdny; **mechanická brána** nad `src/**`: (1) po odstránení deklarácií importu je každý zmenený súbor bajtovo zhodný s verziou v `HEAD`; (2) množina importovaných mien a ich zdrojov je rovnaká, líšia sa len špecifikátory `@vuelidate/*` → vstup knižnice; (3) diff `vite.config.mts` je presne jeden pridaný prvok poľa. Po poslednom admine zapísať odtlačok celého `dist/` knižnice a zvlášť odtlačok jeho `.js` (**J**) |
| **B1** | prevziať engine, validátory a deklarácie; alias `VALIDATION_ENGINE` vo `vitest.config.mts` a `engineIdentity.test.ts`; diferenčné testy a parita typov (5.1) | nové testy zelené; 6 kontrol; `yarn build` + 4 kontroly dist, odtlačok `.js` = **J** (prevzatý kód sa do JS nedostal); **celá sada s `VALIDATION_ENGINE=vendored`** zelená a s rovnakým počtom testov ako bez premennej (súbory vstupu ukazujú na npm) |
| **B2** | playground: scenáre S1–S18 a matica form prvkov; testy na správanie | celá sada zelená dvakrát: `VALIDATION_ENGINE=npm` a `VALIDATION_ENGINE=vendored`, bez výnimiek a bez preskočených testov |
| **B3** | skúšobné prepnutie zdroja knižnice: (1) `yarn build` predvoleného stavu, zapísať odtlačok celého `dist/` (**D**; jeho `.js` = **J**); (2) **záloha:** oba súbory vstupu skopírovať bajt po bajte do `podklady/g1_regle-scope/impl/trial/entry-npm/` a overiť, že sha256 kópií = sha256 originálov (súbory nie sú commitnuté, odtlačok sám by ich nevedel vrátiť); prepnuté varianty pripraviť do `trial/entry-vendored/`; (3) zapísať `podklady/g1_regle-scope/impl/TRIAL-STATE.md` (odtlačky, cesty záloh, stav „zdroj prepnutý“) — **pred** akýmkoľvek prepísaním; (4) `src/validation/core.ts` a `validators.ts` nahradiť variantmi z `trial/entry-vendored/` (importy z `@/validation/vuelidate/*`); (5) `lint:tsc`, `yarn build` | `lint:tsc` 0 chýb (knižnica oproti prevzatým deklaráciám); build; 4 kontroly dist — `check-dist-types` prejde prevzaté deklarácie bez `skipLibCheck`, `check-dist-validation` v režime vendored (žiadny import `@vuelidate/*` v `.js` ani `.d.ts`); zapísať odtlačok skúšobného buildu (**T**). Červená → B5 a stop |
| **B4** | skúška adminov nad skúšobným buildom, po jednom: admina pripísať do `TRIAL-STATE.md` **pred** kopírovaním; skopírovať; odtlačok skopírovaného `dist/` = **T**; 6 kontrol + produkčný build; výsledok zapísať | výsledky všetkých 6 zapísané. **Fork sa označí za overený, len ak je všetkých 6 zelených**; inak sa po B5 uvedie ako neoverená možnosť so zoznamom zlyhaní |
| **B5** | obnova — vždy, keď `TRIAL-STATE.md` existuje a nie je „obnovené“: (1) dva súbory vstupu obnoviť **kópiou zo zálohy** `trial/entry-npm/`, ich sha256 = zapísané; (2) `yarn build`; odtlačok `dist/` = **D**; 4 kontroly dist (`check-dist-validation` v režime npm: žiadny `.js` pod `validation/vuelidate/`); (3) skopírovať do **všetkých 6** adminov (aj tých, čo v B4 neprešli alebo sa k nim skúška nedostala); odtlačok každého skopírovaného `dist/` = **D** | knižnica: `lint:tsc` + celá sada bez premennej (vrátane testu, že predvolený engine je npm); v každom admine `lint:tsc` + testy + produkčný build = výsledok z A3; `TRIAL-STATE.md` označiť „obnovené“ |
| K9 | návod (`doc/guide/validation.md`), changelog, aktualizácia analýzy (`detail-G1-regle.md`, `g1-pokracovanie.md`, G1 v `2.0.0-NAVRHY.md`), zoznam zmenených súborov na repo | — |

**Keď je brána červená:** zastaviť, nič nevracať, zapísať stav a príčinu do `g1-pokracovanie.md` a prácu neoznačiť za dokončenú. Výnimky: B4 je skúška — červený výsledok sa zapíše a pokračuje sa ďalším adminom; B5 sa vykoná vždy, keď je zdroj knižnice prepnutý alebo sa do niektorého admina dostal skúšobný build, aby ani knižnica, ani žiadny admin neostali na prevzatom engine. **Po páde alebo novom štarte session:** ak `TRIAL-STATE.md` existuje a nie je označený „obnovené“, prvým krokom je B5 pre všetkých 6 adminov, až potom čokoľvek iné (zapísané aj v `g1-pokracovanie.md`).

**Neoverené touto prácou (uvedie sa vo výsledku):** e2e testy adminov (potrebujú bežiace prostredie s backendom, `BASE_URL`) — teda žiadna kontrola validácie v reálnom prehliadači nad skutočnou appkou; dev server adminov.

### 5.1 Diferenčné testy (B1)
Testový súbor importuje oba enginy priamo (`@vuelidate/core` a `@/validation/vuelidate/core`), ten istý scenár postaví raz nad každým (dva oddelené stromy) a po každom kroku — pred flushom aj po ňom — porovná celý pozorovateľný stav (serializovaný strom výsledku: `$invalid`, `$dirty`, `$anyDirty`, `$error`, `$pending`, `$errors`/`$silentErrors` s `$message/$propertyPath/$property/$validator/$uid/$params`, výsledky pravidiel, kľúče objektu).
- **Validátory:** každý export proti originálu nad maticou hodnôt (prázdne, reťazce, čísla, polia, objekty, `Date`, `ref`); `$params`, texty, `createI18nMessage` (`withArguments`, `messagePath`, `messageParams`), `helpers.forEach`.
- **Engine, kroky:** zmena hodnoty, `$touch`, `$reset`, `$validate`, výmena objektu modelu, `$autoDirty` (plytký, nie na koreni, dedený cez config), hodnoty objekt/pole/`null`, `siblings` (na koreni Refy, vnorené rozbalené), `this === vm`, volanie mimo setup (`vm` = `{}`), validátor vracajúci Promise bez `$async`, výnimka vo validátore.
- **Cache výsledkov:** computed pravidlá s rovnakými kľúčmi a `$params`, ale novou closure → ostáva starý validátor aj text (dnes živé v cms `thinkingConfigValidation.ts:11-18`); úrovne bez pravidiel sa necachujú (`$dirty` koreňa po prepočte pravidiel); pravidlá sa aplikujú až pre-flush watcherom (synchrónne čítanie po zmene vidí staré pravidlá, `$touch` v tom ticku sa stratí).
- **Tvar výsledku:** computed vracia nový obyčajný objekt s deťmi pod `_vuelidate_N` (kľúče sa porovnávajú podľa poradia, počítadlá enginov sa líšia); poradie `$errors` podľa registrácie.
- **Tvary volania:** žiadny argument, jeden argument = config, tri argumenty s explicitným `undefined` (knižnica `anzuUserValidations.ts:61`).
- **Typy:** `expectTypeOf<typeof kópia.X>().toEqualTypeOf<typeof npm.X>()` pre `useVuelidate`, každý validátor, `helpers`, `createI18nMessage`.
- **Zber:** 8 scenárov `$scope` z prototypu (`true` berie každý scope, pomenovaný len svoj, tieňovanie, `false`, `$stopPropagation`, reťaz, súrodenci, dve inštancie v komponente), registrácia a odhlásenie pri v-for, pravidlá vytvorené v setup Pinia store.
- **Async, `$externalResults`, `$lazy`, `$rewardEarly`, `$validationGroups`:** po jednom scenári, lebo kód sa preberá, hoci ho flotila nepoužíva.

### 5.2 Scenáre playgroundu (B2)
S1 collector v `*Actions` + stránka a `*Manage` · S2 collector bez scope zbiera deti so Symbol scope · S3 hlboká reťaz s bránou, ktorá má aj vlastné pravidlá · S4 riadky vo v-for · S5 list editory so zbaleným riadkom · S6 dialóg so `$scope: false` · S7 vždy namontované dialógy so `$stopPropagation` · S8 scope cez props a `<component :is>` · S9 dva collectory s rovnakým Symbolom naraz · S10 pravidlá, ktoré brána dnes nevidí · S11 collector v pinia store · S12 `ACreateDialog` · S13 `ACustomDataForm.validate()` · S14 `$errors` podľa `$propertyPath` · S15 `$reset()` · S16 computed pravidlá, `requiredIf`, `helpers.forEach`, cross-field cez `siblings`, regexy, `datesCompare`, zmena jazyka · S17 `ADatetimePicker` pod default a Symbol collectorom · S18 pole s hodnotou pole a objekt.
Matica prvkov: každý komponent s `v` (10 form polí, `DamUserRemoteAutocomplete`, `ACreateDialog`) — label z cesty, hviezdička, chyby až po touch, `required` prop.
Scenáre aj komponenty knižnice berú engine z `@/validation/core` a `@/validation/validators`; testy scenárov o engine nevedia. Nad oboma enginmi bežia tak, že sa celá sada pustí dvakrát s `VALIDATION_ENGINE` (4.2) — v jednom behu je v celom grafe modulov jediný engine.

### 5.3 Codemod (A2)
- `'@vuelidate/core'` a `'@vuelidate/validators'` → `'@anzusystems/common-admin/validation'`; default import `useVuelidate` → pomenovaný; `import * as validators` ostáva (menný priestor vstupu má len členy z 4.1; flotila z neho číta iba `createI18nMessage`, iné meno by zachytil `lint:tsc`); dva importy z toho istého modulu sa zlúčia, typové ostanú `import type`.
- Nič iné sa nemení: volania, argumenty, pravidlá, vlastné validátory, čítania výsledku.
- Potom `oxlint --fix` (poradie importov) a `oxfmt` len na dotknutých súboroch (vzor `scripts/codemods/explicit-imports/sort.mjs`).
- Hlási a končí chybou: meno, ktoré vstup neexportuje; iný tvar importu, než pozná.
- V adminoch sa nepridáva eslint zákaz (flat config by prepísal `app/no-relative-imports`); zvyškové importy stráži `grep` v bráne.

## 6. Čo dokazuje čo
| Tvrdenie | Dôkaz |
|---|---|
| fáza A nemení správanie | engine je ten istý balík; diff adminov obsahuje len importy (mechanická brána); všetky kontroly + produkčný build |
| prevzatý engine = Vuelidate | diferenčné testy stavu po krokoch; parita typov; celá sada (vrátane 7 existujúcich testov validácie a playgroundu) zelená nad každým enginom |
| form prvky a komponenty knižnice fungujú | matica prvkov a S1–S18 nad oboma; celá sada testov knižnice po prepnutí |
| admin by po zapnutí fungoval | B4: jeho 6 kontrol + produkčný build so skúšobným buildom (JS aj deklarácie nad prevzatým enginom); v jeho `src/` sa v B nič nemení. Bez e2e (neoverené) |

## 7. Riziká
| Riziko | Zmiernenie |
|---|---|
| chyba pri prevode zdrojáka do TS | prevod po funkciách bez úprav logiky; diferenčné testy; npm balík ostáva etalónom natrvalo (`VALIDATION_ENGINE=npm`) |
| vlastný kód na údržbu (1 536 riadkov prevzatých) | zamrznutá sémantika, testy; pri zmene Vue to isté riziko ako dnes, ale s možnosťou opravy |
| zdvojená inštancia modulu (dva vstupy balíka) | `Symbol.for` kľúče, počítadlo na `globalThis`; test, ktorý modul načíta dvakrát |
| admin `yarn install` prepíše skopírovaný build, alebo v admine ostane starý build | zapísané (4.4, 9); odtlačok skopírovaného `dist/` pred každou bránou |
| pád WSL | po jednej kontrole, limity pamäte, priebežný zápis stavu |
| codemod zmení poradie/štýl importov | `oxlint --fix` + `oxfmt`; brána „len riadky importov“ |

## 8. Návrat
Agent nerobí `git stash`, `git clean`, `git checkout`, `git reset` ani iný zásah do indexu. Pri červenej bráne ostane diff na mieste. Pre vlastníka sa ku koncu zapíše pre každé repo: `git status --porcelain` pred prácou (K0) a zoznam súborov, ktoré táto práca zmenila alebo pridala (`podklady/g1_regle-scope/impl/manifest-<repo>.txt`), aby sa dali vrátiť cielene. Fáza B nemení predvolený engine; prevzatý kód je v `src/validation/vuelidate/` a žiadny vstup ho neimportuje, takže v builde nie je jeho JS (len tri nedosiahnuteľné `.d.ts`). Dočasné prepnutie dvoch súborov vstupu (B3) a skúšobný build v adminoch (B4) sú zapísané v `TRIAL-STATE.md` a B5 ich vždy vráti.

## 9. Ostáva vlastníkovi
- **Engine:** zapnúť fork (prepnúť `src/validation/core.ts` a `validators.ts` na `@/validation/vuelidate/*` a konštantu predvoleného enginu v `engineIdentity.test.ts`; potom `@vuelidate/*` z `peerDependencies` a z `external`, v `devDependencies` nechať ako etalón, `yarn install` kvôli `yarn.lock`), alebo ostať na npm Vuelidate za vstupom, alebo Regle (dôkazy v 3.1). Cena forku: 1 536 riadkov prevzatého kódu na údržbu. Ak fork odmietne: zmazať `src/validation/vuelidate/`, diferenčné testy, alias a vetvu vendored v `check-dist-validation.mjs` — vstup a fáza A ostávajú.
- Commity a release knižnice; potom v adminoch zvýšiť verziu a — ak bude fork zapnutý — odstrániť `@vuelidate/*` z `package.json`, `yarn.lock` a z `optimizeDeps.include`. Do vydania je všetko stav pred vydaním (sekcia 0).
- e2e adminov nad skopírovaným buildom.
- 16 brán, ktoré dnes preskakujú pravidlá — nezmenené; cms `thinkingConfigValidation` (zastaraná closure) tiež.
