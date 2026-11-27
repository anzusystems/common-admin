# G1 — vzor overený v skutočnom kóde knižnice (2026-09-27)

Cieľ: vyskúšať, že stromová vrstva nad Regle naozaj funguje so skutočnými komponentmi knižnice, bez zmeny v nich. **Nie je to hotová implementácia** a do repa sa nič neaplikovalo.

## Kde a na čom
- Git worktree `../common-admin-wt-g1` (mimo repa), `--detach`, bez novej vetvy.
- Báza: snapshot pracovného stromu `feat/list-editors` (`HEAD` 842ab0a5 + necommitnuté zmeny inej session: B5 `*ScopeKey`, B8 `AFormFieldValidation`, B10 `commonT` …), vytvorený cez `git stash create` → commit `3c796315` (pracovný strom repa sa nezmenil), nesledované súbory doň skopírované okrem `doc/`.
- Do worktree pridané len: `@regle/core` a `@regle/rules` 1.29.3 (devDependencies), `src/validators/anzu/useAnzuValidation.ts`, `src/test/validators/anzuValidation.test.ts`.

## Súbory
| Súbor | Čo |
|---|---|
| `useAnzuValidation.ts` | vrstva: zber podľa stromu ako vuelidate `$scope`, dual-stack, polia z Regle v tvare vuelidate, ľahké typy (332 riadkov po oxfmt vrátane typov a komentárov) |
| `anzuValidation.test.ts` | 12 testov so skutočnými komponentmi knižnice |
| `g1-anzu-validation.patch` | `git diff` voči snapshotu (nové súbory + `package.json`; `yarn.lock` vynechaný, stačí `yarn install`) |
| `test-output.txt`, `lint-tsc.txt` | výstupy |

## Čo sa overilo (Chromium, `--project chromium --retry 0`: 12/12)
| Test | Skutočný komponent | Výsledok |
|---|---|---|
| label z cesty Regle poľa | `AFormTextField` | `cms.article.model.title` ako pri vuelidate |
| hviezdička | `AFormTextField` | pri `required` áno, pri inom pravidle nie, pri `requiredIf` len kým platí podmienka |
| chyby po blur | `AFormTextField` | pred blur žiadne, po blur správy z Regle |
| stabilný `v` | — | `v$.article.title` je medzi rendermi ten istý objekt |
| chyby v tvare vuelidate | — | `$errors[]` s `$message`, `$propertyPath`, `$property`, `$validator` na poli aj na bráne; `$validate()` → `boolean` |
| brána | `ACreateDialog` | pri neplatnom zozbieranom formulári `callCreate` nezavolá, po oprave áno |
| most list editora | `AListEditor` + `useListEditorScopeValidity` (vuelidate) | zbalený neplatný riadok blokuje nový collector, `$touch` ho odhalí, oprava bránu uvoľní |
| dual-stack | `AFormDatetimePicker` → `ADatetimePicker` (vlastný `useVuelidate`) | nový collector ho zozbiera (`required` true → `$invalid` true, false → false) |
| dual-stack opačne | stránka s `useVuelidate({ $scope })` | zozbiera migrovaný formulár, `$touch` k nemu dôjde |
| izolácia súrodencov | — | dva collectory s rovnakým scope vedľa seba sa nevidia |
| typy | typ `AFormFieldValidation` a `ACreateDialogValidation` z B8 (iná session) | pole aj brána ich spĺňajú bez zmeny; `$validate` je `Promise<boolean>`; preklep v poli je chyba |

**Nezmenené:** AForm\*, `ACreateDialog`, `AListEditor`, `useListEditorScopeValidity`, `src/types/Validation.ts`, `lib.ts`.

## Kontroly
- `yarn lint:tsc` (vue-tsc --build, app + test): 0 chýb. Za studena 19,3 s / 2,74 GB vs. snapshot bez vrstvy 18,6 s / 2,72 GB.
- eslint, oxlint, oxfmt na nových súboroch: čisté.

## Čo sa neoverilo
- `yarn build`: `@regle/core`/`@regle/rules` treba pridať do `external` vo `vite.config.lib.mts`, inak ich rolldown zbalí do `dist/vendor/`. Pri `preserveModules` by Regle ťahal len modul vrstvy → peer môže byť optional, kým admin nemigruje (overiť).
- d.ts výstup a export v `lib.ts`.
- Port `useValidate()` na Regle v knižnici (overený len v `../runtime/useValidateRegle.mjs`).
- Beh v adminoch.

## Spustenie znova
```sh
cd ../common-admin-wt-g1   # ak ešte existuje; inak: SNAP=$(git stash create) && git worktree add --detach <cesta> $SNAP, skopírovať nesledované súbory, git apply g1-anzu-validation.patch
SKIP_PLAYWRIGHT_INSTALL=true yarn install
NODE_OPTIONS=--max-old-space-size=2048 npx vitest run src/test/validators/anzuValidation.test.ts --project chromium --retry 0
yarn lint:tsc
```
Upratanie: `git worktree remove --force ../common-admin-wt-g1` (worktree má vlastné `node_modules`).
