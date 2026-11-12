# Metodika a mapa podkladov

Ako táto analýza vznikla, ako sa overovala a kde ležia surové výstupy. Slúži na pokračovanie v novej session.

## Postup
1. **Prvé kolo (7 paralelných analýz)** knižnice a adminov: verejné API, pohľad adminov, štruktúra/legacy vs labs, bugy/kvalita, závislosti, DX/testy/tooling, i18n/štýly/a11y. Výstup: kandidátne nálezy z čítania kódu a statických skriptov.
2. **Overovanie bugov (kolo 2)**: každý nález z časti A dostal izolovanú kópiu repa (`scratchpad/verify/*`), v nej test, ktorý na súčasnom kóde padá, a minimálnu opravu, po ktorej prejde. Súvisiace existujúce testy museli ďalej prechádzať.
3. **Druhá dávka analýz (batch2)**: integrácia všetkých opráv do jednej kópie, d.ts po moduloch, dry-run reštrukturalizácie, dopad breaking zmien, dizajn presunov do knižnice, core-utils testy, CSS layer, bezpečnosť.
4. **Tretia dávka (batch3)**: rýchle opravy v adminoch, dev loop, vuelidate/Regle, doplnenie informácií, reprodukcia admin bugov.

## Ako čítať dôkaz
- **TEST** — v kópii je test padajúci na starom kóde a zelený po oprave; celá sada `batch2/all` beží `--retry 0`.
- **REPRO** — spustená reprodukcia (skutočné interceptory adminov, meranie dev loopu, PHP v dockeri, codemod dry-run) alebo runtime probe.
- **ČÍTANIE** — potvrdené čítaním kódu, bez spusteného testu (dôvod uvedený v detaile).
- **✓** — overil som osobne (spot-check).

## Kde sú podklady (relatívne k `scratchpad/`)
| Oblasť | Cesta |
|---|---|
| Spojené opravy + testy knižnice | `batch2/all-out/fixes.patch`, `tests.patch`; kópia `batch2/all` |
| Core-utils testy a opravy | `batch3/coretests-out/` |
| d.ts po moduloch | `batch2/dts-out/` |
| Reštrukturalizácia | `batch2/restructure-out/`, skript `batch2/restructure-tools/` |
| Breaking + codemody | `batch2/breaking-out/` |
| Dizajn auth/session | `batch2/design-auth-out/` |
| Dizajn shell/filtre/testing | `batch2/design-shell-out/` |
| CSS layer + a11y | `batch2/csslayer-out/` |
| Dev loop | `batch3/devloop/out/` |
| vuelidate/Regle | `batch3/vuelidate-out/` + `regle-deep/` |
| G1 scope, vrstva, merania (2026-09-27) | v repe: `doc/2.0.0-analyza/podklady/g1_regle-scope/` (spustiteľné, návod v jeho `README.md`) |
| Doplnenie info (AAlerts, fonts, uuid, publicDir, peers, dark, Vue 3.6) | `batch3/info/out/` |
| Rýchle opravy adminov | `batch3/quickwins/out/<admin>.patch` (+ `.fallthrough.patch`, `.cached-chips.patch`) |
| Reprodukcia admin bugov | `batch3/repro/out/` (item2–item6, COMMANDS.txt, tests/) |

## Dôležité poznámky pre pokračovanie
- **Do repa ani adminov nebolo nič zapísané.** Jediná stopa: `doc/2.0.0-NAVRHY.md` v common-admin (prvé kolo). Ak sa nemá použiť, zmazať.
- Kópie majú `node_modules` symlinkované na reálne — nikdy do nich nezapisovať. Vitest/vite spúšťať s `--configLoader runner` a cacheDir v kópii.
- Pasce pri testoch: `vi.mock('.../damAssetApi', importOriginal)` deadlockne browser runner (cyklus) — mockovať explicitne; vueuse `useDebounceFn` 200 ms → `vi.waitFor`; Vuetify menu cez `userEvent.click`; `src/test/setup.ts` nemá `useCommonVuetifyConfig()`; pri overovaní `--retry 0` (default retry hlási zavádzajúcu druhú chybu).
- Známe load-flaky testy (nie sú to bugy): `damRoiClickthrough`, `DamAssetImageRoiSelectLazy`, `FilterBookmarkDialog`, `ACachedChip`, `useApiFetchListContract`.
- admin-dam dostal 2026-09-26 od inej session commit s `release:*` skriptami; quickwins patche sa ho netýkajú.

## Poznámka o bezpečnosti
Bezpečnostné nálezy sa v tomto reporte nevedú (na žiadosť vlastníka). Sú mimo tohto adresára a mimo indexu.
