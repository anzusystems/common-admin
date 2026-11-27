# G1 — scope medzi komponentmi pri prechode na Regle (podklady)

Prototypy, testy a merania k [detail-G1-regle.md](../../detail-G1-regle.md). Všetko beží mimo knižnice aj adminov; admini sa len čítajú (codemod na sucho).

| Súbor / priečinok | Čo to je |
|---|---|
| `katalog-scope.md` | inventár `$scope` vzorov vo flotile (P1–P12), 16 brán s preskočenými pravidlami, fakty pre migráciu |
| `kniznice.md` | surové dáta o knižniciach (npm, GitHub, stav údržby) |
| `runtime/` | prototypy vrstvy a 14 testových súborov (77 testov) |
| `runtime/anzuCompat.mjs` | variant A: presná sémantika Vuelidate `$scope` nad `useRegle`, `v$` v rovnakom tvare |
| `runtime/anzuDual.mjs` | variant A + dual-stack: Regle a Vuelidate inštancie sa zbierajú navzájom (postupná migrácia) |
| `runtime/anzuScope.mjs` | variant B: čistá sémantika (len explicitné collectory, bez tieňovania) |
| `runtime/useValidateRegle.mjs` | port `useValidate()` z knižnice na Regle (rovnaké i18n kľúče a parametre) |
| `types/` | typovaná vrstva (plné typy Regle aj ľahké typy), test zhody s typmi Regle, benchmark typovej kontroly, codemod na sucho |
| `out/` | výstupy posledných behov (2026-09-27) |
| `real/` | vzor overený v skutočnom kóde knižnice (git worktree): vrstva, 12 testov so skutočnými komponentmi, patch, výsledky |

## Spustenie
Najprv `npm i` v `runtime/` aj `types/` (`node_modules` sa necommitujú; `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, Chromium je v `~/.cache/ms-playwright` z knižnice).

```sh
cd runtime
NODE_OPTIONS=--max-old-space-size=1536 npx vitest run --maxWorkers=2                       # happy-dom, Vue 3.5.43
NODE_OPTIONS=--max-old-space-size=1536 npx vitest run --config vitest.browser.config.mjs --no-file-parallelism   # Chromium
npm i --no-save --legacy-peer-deps vue@3.6.0-rc.9 && npx vitest run --maxWorkers=2; npm i   # Vue 3.6 RC, potom späť

cd ../types
npx vue-tsc --noEmit -p tsconfig.json     # typy, väzba :v= v šablóne, test zhody
sh bench/run.sh                            # cena typovej kontroly (postupne, heap 2 GB)
node codemod-dry.mjs <repo> [<repo> ...]   # klasifikácia volaní useVuelidate, len čítanie
```

## Pozor na WSL
- Spúšťať po jednom. Benchmark typov má prípady s ~1,1 GB na proces (`regle`/`layer` pri 60 formulároch a 40 × 15 poliach); `bench/run.sh` ich púšťa postupne s limitom heapu.
- Browser testy s `--no-file-parallelism` (jedna inštancia Chromia).
- `vitest` s `--maxWorkers=2`, nie default (16 jadier = veľa workerov).

## Výsledky (out/)
- `tests-happydom-vue35.txt`, `tests-chromium-vue35.txt`, `tests-happydom-vue36.txt` — 77/77 vo všetkých troch.
- `types-check.txt` — vue-tsc 0 chýb; simulácia zmeny v Regle (premenovaný člen, iný typ `$errors`) zlyhá v `conformance.ts` resp. vo väzbe v šablóne.
- `types-bench.txt` — Check time / instantiations / pamäť pre vuelidate, Regle priamo, vrstvu s plnými typmi a s ľahkými typmi.
- `codemod-dryrun.txt` — všetky volania `useVuelidate(` v 7 repách majú tvar na automatický prepis.

## Poznámka k lintu
`yarn lint:oxlint` v roote knižnice (`oxlint .`) prechádza aj `doc/`, takže tieto `.mjs` (rovnako ako `../batch3_vuelidate-out`) hlási. Pred commitom `doc/2.0.0-analyza` buď pridať do `ignorePatterns` v `.oxlintrc.json`, alebo podklady necommitovať.
