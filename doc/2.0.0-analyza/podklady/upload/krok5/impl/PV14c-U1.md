# PV14c-U1: obaly obrázkov admin-ugc plnia konfiguráciu DAM svojho mena (impl-ugc-pv14c)

Zadanie `krok5-praca/zadania/zadanie-PV14c-U1.md`, plán `zadania/plan-PV14c.md`. Strom `admin-ugc`, vetva `next`, čistý
na `7ca2b1d`; knižnica v `node_modules` = kópia vedúceho (PV14c-L1 až L6), `useDamConfigStoreOf` v `dist/lib.d.ts`
exportované (overené pred začatím). Snímok **`PV14c-U1`** (s `doc/Admin-UGC-Changelog/Unreleased/3.0.0.md`), záplata
`krok5-praca/zaplaty/PV14c-U1.diff` (5 súborov, 273 riadkov). Knižnica sa nemenila, žiadny zápis do gitu.

## Pred zmenou (nová knižnica, kód `7ca2b1d`)

`generate:dts` kód 0, `test` **15 súborov, 93 prípadov, zelené** (`vysledky/PV14c-U1-pred-1-dts.log`,
`PV14c-U1-pred-2-test.log`). Nič nie je červené kvôli novej knižnici.

## Zmena

`ImageWidget.vue`, `ImageWidgetMultiple.vue`, `AssetList.vue` (`src/domains/blog/image/components/`): obchod, ktorý
plnia, je `useDamConfigStoreOf(props.configName)` namiesto `useDamConfigStore()`, čítaný raz v setupe (s direktívou
`vue/no-setup-props-reactivity-loss`, eslint ju pýta, ako v knižnici). Do neho idú kontrola
`initialized.damPrvConfig`, veľkosti kúskov, licencie → ext. systém 4, vlastné formuláre a konfigurácia ext. systému 4.
`skip-current-user-check`, `EXT_SYSTEM_ID` ani texty sa nemenili. `ImageWidgetSimple.vue` nič nepíše, ostal (plán
hovorí o štyroch obaloch, zadanie o troch).
- *Editor vidí:* nič; žiadny obal nedostáva meno (`configName` má predvolené `'default'`, a pre `default` vracia
  `useDamConfigStoreOf` obchod `useDamConfigStore()`).
- Požiadavky, druhé stlačenie, odchod zo stránky: obal nič nežiada, plní obchod synchrónne v `onMounted`.

## Prípady

Nový `src/test/damWrapperConfigStore.test.ts`, 12 prípadov (`describe.each` cez tri obaly × 4). Skutočný plugin s
`default` a `own` v `coreDam.configs` aj `image.configs` (klienti hodia chybu, keby sa ich niečo pýtalo), vnútorný
komponent knižnice je stub (`vi.mock('@anzusystems/common-admin')` s `importOriginal`), ktorý zapíše meno, čo dostal.
- s `config-name="own"` naplní obchod `own` (licencie → 4, formuláre a konfigurácia 4, kúsky, `initialized`) a obchod
  `default` ostane ako bol — **červený na snímku** (×3);
- bez mena naplní `default` ako doteraz a `own` ostane — zelený aj na snímku (stráž, ×3);
- pod `own`, keď `default` už má kúsky a `initialized`: `own` sa aj tak naplní — **červený na snímku** (×3);
- pod `own`, keď `own` už má kúsky 1500/1500 a `initialized`: kúsky ostanú, zvyšok sa naplní — **červený na snímku** (×3).

Beh na kóde snímku (strom pred zmenou, len nový test): 9 červených, 3 zelené (`pracovne/impl-ugc-pv14c/run1-snapshot.log`);
po zmene 12 / 12.

## Ohyby (pri načítaní, `vitest-tmp-impl-ugc-pv14c/vitest.k3-bend.config.mts`, nič na disku)

- A: `AssetList.vue` plní znova obchod `default` (`useDamConfigStoreOf()`) → 3 prípady `AssetList` pod `own` červené.
- B: `ImageWidget.vue` číta `initialized` z obchodu `default` → 2 prípady (kúsky pod `own`) červené.

## Kontrola (`vysledky/PV14c-U1-*.log`)

1. `generate:dts` kód 0. 2. `test` **16 súborov, 105 prípadov, zelené**. 3. `lint:tsc`, `format:check`, `lint:oxlint`,
`lint:eslint`, `lint:stylelint`, `build` kód 0.

## Rozhodnutia

- Obal s menom, ktoré aplikácia v pluginu nemá, si obchod toho mena vyrobí skôr, ako vnútorný komponent zlyhá na
  `useCommonAdminCoreDamOptions` (ako predtým zlyhal). V knižnici komponenty a `useDamConfigState` meno overia skôr, ako
  vezmú obchod, a neznáme meno obchod nedostane; `useDamConfigStoreOf` samo, `useDamDistributionServiceType` a
  `useDamUploadChunkSize` však obchod vyrobia pre akékoľvek meno. Opravené v c1 (nižšie).
- Changelog: „Changed", posledná položka.

## Staršie nálezy (neopravené)

- `ImageWidgetMultiple.vue` má vo `withDefaults` predvolené hodnoty props, ktoré nedeklaruje (`image`, `lockable`,
  `lockedById`, `expandOptions`); bez účinku.
- Stavy `'error'` a `'uploadNotAllowed'` (`ImageWidget.vue`, `ImageWidgetMultiple.vue`) a `'error'` (`AssetList.vue`)
  sa nikdy nenastavia; ich vetvy šablón sú mŕtve.

## c1 (posudky `impl/posudky/PV14c-U1-claude.md` a `PV14c-U1-codex.md`, obe len Low)

Snímok **`PV14c-U1-c1`**, záplata cyklu `krok5-praca/zaplaty/PV14c-U1-c1.diff` (5 súborov, 177 riadkov); záplata kroku
`PV14c-U1.diff` znova od snímku `PV14c-U1` (5 súborov, 331 riadkov).

**1. Najprv meno (Low 1).** Tri obaly volajú v setupe `useDamConfigState(undefined, props.configName)` pred
`useDamConfigStoreOf(props.configName)` (s direktívou eslint, krátky komentár prečo). Bez klienta nič nežiada; pre meno,
ktoré aplikácia v `coreDam.configs` nemá, hodí „Composable can't be used without properly configured common admin."
skôr, ako sa obchod toho mena vyrobí. Jeho `isDamPrvConfigLoaded()` nahradilo čítanie `initialized.damPrvConfig` (ten
istý príznak toho istého obchodu). Pre `default` bez zmeny (`checkDamConfigName` hneď vráti).
- *Editor vidí:* nič; s neznámym menom (dnes ho nikto nedáva) obal nič nevykreslí, ako predtým, len chyba príde zo
  setupu obalu, nie z vnútorného komponentu.
- Prípad (×3, `describe.each`): s `config-name="typo"` jedna chyba s tým textom (zachytená `app.config.errorHandler`),
  v `pinia.state.value` žiadny `commonAdminDamConfigStore:typo`, vnútorný komponent sa nevytvoril. Na snímku c1
  (obaly podané z `snap/PV14c-U1-c1` cez `vitest-tmp-impl-ugc-pv14c/vitest.old.config.mts`): 3 červené (žiadna chyba),
  12 zelených; na strome 15 / 15. Dva prvé prípady každého obalu navyše žiadajú prázdny zoznam chýb.
- Ohyb C: `ImageWidget.vue` vezme obchod pred overením mena → 1 červený (obchod `typo` existuje). Ohyb D:
  `ImageWidgetMultiple.vue` volá `useDamConfigState(undefined)` bez mena → 3 červené (typo a oba prípady kúskov pod
  `own`, lebo príznak sa číta z `default`).

**2. Changelog (Low 2)** `doc/Admin-UGC-Changelog/Unreleased/3.0.0.md:49`: znenie z posudku Claude (kúsky a označenie
konfigurácie za inicializovanú, len kým nie je; ext. systém 4 pre licenciu nahrávania v `ImageWidget`,
`ImageWidgetMultiple` a pre licencie výberu v `AssetList`); pridaná veta, že meno mimo `coreDam.configs` hodí v setupe
obalu skôr, ako vznikne jeho obchod.

**3. Poznámka:** veta o knižnici a neznámych menách opravená (časť Rozhodnutia).

**Kontrola** (`vysledky/PV14c-U1-*.log`, prepísané; kódy z výstupu skriptov `pracovne/impl-ugc-pv14c/check12.sh` a
`check3.sh`): 1. `generate:dts` kód 0; 2. `test` **16 súborov, 108 prípadov, zelené**; 3. `lint:tsc`, `format:check`,
`lint:oxlint`, `lint:eslint`, `lint:stylelint`, `build` kód 0.

Mimo cyklu (z posudku Claude, neopravené): `ImageWidget`/`ImageWidgetMultiple` píšu len licenciu nahrávania, `AssetList`
len licencie výberu; licencia výberu mimo obchodu by sa pýtala na `/adm/v1/asset-licence/:id`, ktorú trasy UGC nemajú.
Dnes všetky miesta dávajú jednu a tú istú licenciu.
