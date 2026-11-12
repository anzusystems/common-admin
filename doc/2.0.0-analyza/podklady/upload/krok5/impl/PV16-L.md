# PV16-L: voľba `report` v `useApiFetchList` (impl-komp-lib)

**Stav: hotový, čaká na posudky.** CK zelená.

Plán `plan-implementacie.md` 2.9 riadok „PV16-L"; návrh jadra 5.2 PV16, možnosť (a) (rozhodnutie vlastníka 9. 10.),
4.1. Strom LIB `/home/volar/projects/anzusystems/common-admin` (po PK3-c1), TMPDIR
`common-admin/node_modules/.cache/vitest-tmp-impl-komp-lib`. Časť admin-dam (dopytovanie distribúcií, `resetList()`)
je PV16-D, nie tu.

## Podkroky

1. **Snímok `PV16-L`** pred prvou úpravou.
2. **Kód** (`src/domains/api/composables/useApiFetchList.ts`): `FetchListParams` dostal nepovinné `report?: boolean`
   s komentárom ako v `useApiRequest` (`useApiRequest.ts:25-33`); `execute` ho číta ako `report: reported = true` a v
   `catch` hodí `reported ? report(error, context) : error`. Chyba sa mapuje ako doteraz (`mapApiError`), mení sa len
   to, či ju dostane zapisovač. Predvolene (bez `report` alebo s `true`) bez zmeny.
3. **Test** (`src/domains/api/__tests__/useApiFetchListContract.test.ts`, nový describe „a list call that asks not to
   be reported", 1 prípad, vzor `useApiRequestContract.test.ts:288-326`): so zapisovačom `vi.fn()` volanie s
   `report: false` hodí `AnzuApiAxiosError` (500) a zapisovač nič nedostane; to isté pri chybe, ktorú hodí pomocník sám
   (200 bez tela → `AnzuApiResponseCodeError`); volanie bez `report` a s `report: true` sa zapíšu (2 záznamy, kontext
   `system`, `entity`, `status: 500`). Zapisovač sa po prípade vráti na `defaultApiErrorLogger` (stav modulu).
4. **Dôkaz** (v pamäti, `vitest.bend.config.mts`, snímok `PV16-L`): ohnutie `bend-pv16-report.json` (`throw
   report(error, context)` vždy) → nový prípad červený 1 / 11; `useApiFetchList.ts` zo snímku (`N39L_OLD`) → ten istý
   1 / 11 („expected "vi.fn()" to not be called at all, but actually been called 1 times").
5. **Behy** (skripty `pv16-check.sh`, `pv16-lint.sh`): cielené `src/domains/api/__tests__` 12 súborov / 191
   zelených; `oxfmt`, `oxlint`, `eslint` na dvoch súboroch čisté, `lint:tsc` 0.
6. **Záplata** `zaplata.sh PV16-L` → `krok5-praca/zaplaty/PV16-L.diff` (2 súbory v `src`; mimo `src` a `doc` nič),
   pred CK. **CK-LIB PV16-L v LIB zelené** (`vysledky/PV16-L-ck.log`): `test:browser` 305 / 3 995 (PK3-c1 + 1),
   `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:stylelint` čisté, `lint:eslint` 0 chýb a
   4 staršie varovania.

## Zmenené súbory

- `src/domains/api/composables/useApiFetchList.ts`
- `src/domains/api/__tests__/useApiFetchListContract.test.ts`

## Čo sa mení

Verejné rozhranie knižnice len pribudne (nepovinné pole v `FetchListParams`). Žiadny volajúci v knižnici ho nepodáva,
takže sa nič nemení, kým ho nepoužije admin-dam v PV16-D (dopytovanie distribúcií: `report: failures === 0`).
Používateľ nevidí nič; udalosti Sentry pri 5xx (`httpClientIntegration`) sa nemenia.

## Odchýlky

Žiadne.

## Zblíženia navyše (tvar registra)

Žiadne.

## Nové nálezy

Žiadne.
