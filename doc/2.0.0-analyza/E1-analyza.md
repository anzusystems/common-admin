# E1 — reštrukturalizácia priečinkov: analýza (2026-09-28)

Požiadavky vlastníka: doménová štruktúra (čo spolu súvisí, v jednej doméne), bez `labs/`, presuny rozpoznateľné gitom ako premenovania, exporty rovnaké.

## Skript (`podklady/batch2_restructure-tools/move.mjs` + `mapping.mjs`)

**Návrh je dobrý:** plán sa vypočíta pred zápisom, deterministicky; odmietne zastarané mapovanie, polopresunutý strom, kolízie mien líšiacich sa len veľkosťou písmen a kolízie výstupov buildu; prepíše `@/…` aj relatívne importy, `import()`, `vi.mock()`, `importOriginal`, `@use`/`@import` v štýloch, cesty `src/…` v configoch a globoch, odkazy v dokumentácii (`--docs`); `--format` preformátuje prepísané súbory.

**Tak ako je, nepôjde — mapovanie je zastarané** (z 25. 9., pred prácou na 2.0):
- 2 pravidlá na súbory, ktoré už neexistujú (`src/plugins/vuetify.ts`, `src/components/TestRouteSwitch.vue`), 1 zbytočné mazanie (`src/labs/api/package.json`);
- 115 súborov bez pravidla: testy z tejto práce, `src/testing/` (vstup `./testing`), `src/components/appShell/`, `alertsQueue.ts`, `globalComponents.ts`, `messageSchema.d.ts`.

Nástroje sú mimo repa (v nesledovanom `doc/2.0.0-analyza/`); patria do `scripts/restructure/`, nech sa dajú použiť aj neskôr.

## Pokus v labe (klon `aef095d0`, dočasné pravidlá pre 115 súborov)

- **Presun:** 715 súborov (96 bajtovo nezmenených), 3436 ciest prepísaných v 693 súboroch, 0 ručných zásahov; 2 importy cez template literal sú v playgrounde na `locales/` (neprenáša sa); 15 odkazov v dokumentácii (7 odkazov prepíše `--docs`, 8 v texte ručne).
- **Build:** 2138 súborov pred aj po; exporty 397 = 397 mien; `common-admin.d.ts` bajtovo rovnaký; 813/813 JS modulov identických po normalizácii ciest; CSS rovnaké pravidlá v rovnakom poradí (mení sa len 14 hashov `data-v-…` odvodených od cesty súboru); lenivé importy rovnaké.
- **Kontroly:** vue-tsc ×3, oxfmt, oxlint, eslint, stylelint 0; testy v prehliadači 2184/2184, v node 79/79.
- **Git premenovania** (`git diff -M`): 712 z 715 rozpoznaných — 461 s podobnosťou ≥ 90 %, 222 so 70–89 %, 29 s 50–69 %. Pod 50 % sú 3 krátke súbory zložené skoro len z importov (`types/coreDam/AssetLicence.ts` 49 %, `AssetLicenceGroup.ts` 42 %, `validators/vuelidate/useValidate.ts` 30 %); nájde ich `git log --follow -M30%` / `git merge -X find-renames=30%` (overené v labe: s 40 % ostane konflikt v `useValidate.ts`), alebo postup pre vetvu v `scripts/restructure/README.md` (bez hľadania premenovaní).
- **Admini** siahajú len na verejné vstupy (`/styles`, `/testing`, `/vite`, `/eslint`), žiadne vnútorné cesty — E1 sa ich nedotkne.

## Doménová štruktúra — nálezy

1. **Cyklus 8 domén** (`api`, `auth`, `collab`, `filters`, `form`, `listEditor`, `system`, `ui`), vznikol v 2.0: `system/alerts.ts` a `api/apiErrors.ts` importujú z `auth/refreshSession.ts` len `AuthUnavailableError`, `SessionExpiredError` a `isInCauseChain`. Tie patria k ostatným chybám knižnice (`model/error` → `core/errors`); po presune ostane len cyklus `api ↔ filters ↔ form`.
2. **Remote autocomplete je roztrhaný** medzi `form/` (formulárový, `createRemoteAutocomplete`, WithCached) a `filters/` (filtrový, WithMinimal); formulárový siaha do filtrov (inner filter, pagination) a naopak. Návrh: vlastná doména `remoteAutocomplete/`.
3. **`api` → `filters`:** zoznamové pomocníky používajú `SortOrder` (v `datatableColumns.ts`) a `usePagination` z `filters/datatable/`. Sú to primitíva dopytu; návrh: `pagination.ts` a `SortOrder` do `api/` (vyžaduje oddeliť `SortOrder` z `datatableColumns.ts` — malá zmena kódu pred E1), alebo cyklus `api ↔ filters` prijať.
4. **Testy** v pôvodnom mapovaní ostávajú v zrkadlovom strome `src/test/<doména>/`; rozhodnuté: `__tests__/` pri entite (vlastník, 2026-09-28).
5. Doménové typy v `core/types` (napr. `AnzuUser`, `CreatedByAware`) sú tam kvôli závislostiam (používajú ich všetky domény) — v poriadku.

## Cieľová štruktúra (návrh, 2026-09-28)

Celá mapa: `E1-mapa.tsv` (952 riadkov: 717 presunov, 231 bez zmeny, 4 nové súbory z commitu pred E1). Výpočet: `podklady/e1-design.py`.

Pravidlá (konvencia admin-cms):
- `src/domains/<doména>/[<entita>/]<druh>/`, druhy `components`, `composables`, `api`, `store`, `factory`, `filter`, `types`, `valueObject`, `utils`, `styles`; `labs/` zaniká.
- `src/shared/` (chyby, typy, utils, validátory, `commonConfig`, `injectionKeys`, `statusCodes`), `src/plugins/` (i18n, `pluginOptions`, `commonVuetifyConfig`, webfontloader).
- Testy v `__tests__/` entity, ktorú testujú (podľa mena, inak podľa importov, 20 ručne). V `src/test/` ostávajú testy celej knižnice (a11y, import cykly, i18n kľúče, CSS, verejné exporty, názvy globálnych komponentov), `setup.ts`, `README.md`, `support/commonVuetify.ts`. Pomocníky cropper testov idú do `dam/cropper/__tests__/support/`.
- Testy `src/eslint` a `src/vite` ostávajú v `src/test/eslint`, `src/test/vite`: oba priečinky sa publikujú ako zdroj (`package.json` `files`), `__tests__` v nich by išli do balíka.
- Bez zmeny: `locales/`, `styles/`, `assets/`, `playground/`, `eslint/`, `vite/`, `testing/` (verejné vstupy), `lib.ts`, `AnzuSystemsCommonAdmin.ts`.

Cykly medzi doménami (za behu, po commite pred E1): `api ↔ filters` len na úrovni domény (api → koreň filters, `filters/bookmarks` → api; medzi entitami bez cyklu), `shared ↔ plugins` (validátory → i18n, ako v admin-cms). Typové importy tvoria väčší cyklus (napr. `shared/types/AnzuUser` → `auth/types/Permission`); nemenia správanie, neriešia sa.

Mimo premenovaní E1 zmení konfiguráciu:
- `tsconfig.app.json`, `tsconfig.libdts.json`: `src/**/__tests__/*` → `src/**/__tests__/**/*` (vnorené `support/`);
- `tsconfig.test.json`: include `src/**/__tests__/**/*`;
- `eslint.config.mjs`: testové pravidlá aj pre `**/__tests__/**`;
- globy `importCycles`, `i18nLiteralKeys` (`.ts`): vylúčiť `**/__tests__/**` (`iconButtonNames` hľadá len `.vue`, v `__tests__` žiadne nie sú);
- `vitest.config.mts` (projekt New York): cesty štyroch testov prepíše skript.

## Plán

0. ~~Rozhodnutia (testy, `remoteAutocomplete/`, `SortOrder`/`pagination`)~~; schválenie cieľovej štruktúry.
1. Malý commit kódu pred E1: `AuthUnavailableError`, `SessionExpiredError`, `isInCauseChain` do `model/error`; `SortOrder` do vlastného súboru. Testy, CI.
2. Mapovanie doplniť (115 súborov + nové domény), skript do `scripts/restructure/` vo vlastnom commite pred presunom (vetva ho dostane mergom `<move>^`); dry run.
3. E1 commit: len presuny, prepísané cesty a konfigurácia vyššie; overiť compare-build (identický), všetky kontroly, CI adminov; hash do `.git-blame-ignore-revs` v nasledujúcom commite.
4. Balík bez testov: `npm pack --dry-run` nesmie obsahovať `*.test.*`, `__tests__`, `src/test`, a `dist` žiadnu cestu k testom ani `vitest` / `@vue/test-utils`. Dnes (`aef095d0`) platí: 1615 súborov, zo `src/` len `src/eslint`, `src/vite`, v `dist` nič z testov. Návrh: stála kontrola v node teste (`src/test/vite/`), aby to strážilo aj CI.

## Stav (2026-09-28)

Hotové, lokálne commity na `feat/list-editors` (bez pushu):
- `5aa98c5f` refactor: chyby autentifikácie do `model/error`, `SortOrder` do vlastného súboru;
- `85417526` refactor: the domain layout (E1: 721 presunov + prepísané cesty + 14 náhrad z tabuľky);
- `003f884f` refactor: nothing named labs (id storov `commonAdmin…`, kľúče v prehliadači `common…`, komentáre, test eslint pravidla, changelog; `doc/API-HELPERY-MIGRACIA.md` presunutý sem).

Nástroj presunu (`move.mjs`, tabuľka, verify, compare-build, README s postupom pre vetvu) v repe nie je (vlastník): je v labe `~/.cache/anzu-devloop-lab/e1/e1wt/scripts/restructure/`. Vetva spred E1 sa zmerguje s `git merge -X find-renames=30%`.

Overené: graf importov rovnaký (3673 hrán), build 397 exportov, 817/817 JS modulov, 520 `.d.ts` (14 len iný modul toho istého typu), CSS rovnaké; kontroly knižnice, 2184/2184 testov v prehliadači; CI kroky šiestich adminov na novom builde. `.git-blame-ignore-revs` čaká na rozhodnutie vlastníka.
