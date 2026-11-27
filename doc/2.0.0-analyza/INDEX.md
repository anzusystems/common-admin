# common-admin 2.0.0 — index nálezov a návrhov

Stav 2026-09-26. Analýza knižnice `@anzusystems/common-admin` a 6 adminov (cms, blog, forum, inhouse, ugc, dam).

>>> PRE ČÍTAJÚCU SESSION: Tento adresár je na ROZHODOVANIE. Pri každom bode daj len
>>> popis + návrh + dôkaz z detailného MD a počkaj na rozhodnutie áno/nie.
>>> NEOVERUJ znova, nespúšťaj testy, nestav patche — dôkazy sú hotové v podklady/.
>>> Bezpečnostné/auth veci sú zámerne vynechané.

**Do repa ani adminov nebolo nič zapísané.** Opravy, testy a patche sú v kópiách v scratchpade. Cesty v detailoch sú relatívne k `scratchpad/`.

**Ako čítať:** tu je index — číslo, stručný popis, návrh riešenia, dôkaz, odporúčanie a odkaz na detail. Plný rozpis (súbor:riadok, scenár, oprava, čo sa zmeralo/zreprodukovalo, kde je patch) je v detailných súboroch.

**Dôkaz:** `TEST` = test v kópii padá na starom kóde a po oprave prejde · `REPRO` = spustená reprodukcia/meranie · `ČÍTANIE` = potvrdené čítaním · `✓` = overené osobne.
**Odporúčanie:** `2.0.0` · `2.x` (aditívne, počká) · `ROZHODNI` (čakám na teba).

> Bezpečnostné nálezy sú mimo rozsahu tohto reportu a vedú sa samostatne.

## Obsah detailov
- [A — Bugy knižnice](detail-A-bugy.md)
- [U — Core utils](detail-U-utils.md)
- [B — Breaking zmeny 2.0.0](detail-B-breaking.md)
- [C — Balík a typy](detail-C-balik.md)
- [D — Presun z adminov do knižnice](detail-D-presun.md)
- [E — Štruktúra](detail-E-struktura.md)
- [F — DX, tooling, UX](detail-F-dx.md)
- [G — Roadmapa 2.x+](detail-G-roadmapa.md)
- [G1 — vuelidate → Regle: knižnice, scope, vrstva](detail-G1-regle.md) · [stav na pokračovanie](g1-pokracovanie.md)
- [Rozhodnutia](rozhodnutia.md)

---

## A. Bugy knižnice — opravené a otestované v spojenej kópii `batch2/all`
71 súborov opráv, 65 testových; celá sada **1961 testov `--retry 0` prechádza**. 96 zo 105 nových testov na starom kóde padá. Všetko **2.0.0**, patch pripravený. [Detail →](detail-A-bugy.md)

| # | Popis | Návrh | Dôkaz |
|---|---|---|---|
| A1 | Upload queue nedrží limit 2 paralelných uploadov | spúšťať `MAX − bežiace` | TEST ✓ |
| A2 | Multi-image widget prenesie obrázky z článku A do B a uloží ich | reset store pri mount/unmount | TEST |
| A3 | Zlyhaný DAM config sa tvári ako `ready`, uploady zlyhajú | `Promise.all` namiesto `allSettled` | TEST |
| A4 | `loadDamPrvConfig` nuluje zlý flag → dam po štarte zbytočne znova načíta pub config | nemeniť cudzí flag | TEST |
| A5 | 0-bajtový súbor zasekne queue; Stop medzi chunkmi asset aj tak vytvorí | reject + kontrola Stop pred finišom | TEST |
| A6 | Kontrola veľkosti súboru pre `*`/`.ext` obrátená | otočiť porovnanie | TEST ✓ |
| A7 | Fallback polling skončí po 1 sieťovej chybe → položka „processing“ navždy | try/catch + znovunasadenie | TEST |
| A8 | Filter hash: Back neobnoví; `type:'string'` a `007` → number; `splice(-1)` zmaže zlý chip | `replaceState`, nemeniť typ pri `string` | TEST |
| A9 | `useApiQueryBuilder` `fromName` namiesto `untilName` → nulové časové okno | opraviť názov | TEST |
| A10 | List editory — 8 bugov (o.i. strata dát pri legacy aliasoch v cms) | 6 súborov + `customRef` | TEST |
| A11 | Unsaved guard prečíta `Ref` len raz | čítať pri evente | TEST |
| A12 | Remote switch/checkbox: `loading` navždy po chybe, id z `Date.now()` | try/finally + `useId()` | TEST |
| A13 | `<Acl>` s AllowOwner bez subjectu hodí výnimku v render | chytiť a vrátiť `false` | TEST ✓ |
| A14 | `useLoginStatus` sa nevyčistí → redirect loop na `/unauthorized` | jednorazové čítanie | TEST |
| A15 | Asset select: staršia odpoveď prepíše novšiu, detail A pre B, preskočená strana | AbortController + counter | TEST |
| A16 | `:v` na `AFormSwitch` sa ignoruje → validačné chyby sa nezobrazia (6× cms) | deklarovať a napojiť `v` | TEST |
| A17 | `ACopyText`, `AAdminSwitcher`, `collabRoom`/`collabInit`, `ACollabLockedByUser`, stale fetch usera, `ACurrentUserDropdown` | viď detail | TEST |
| A18–A33 | Opravy v patchi, ktoré index nemal: DAM widgety a hlášky, ROI, remote autocomplete race, filtre (interval, log, subject select), API logger, 2× CSS, reorder snapshot, `stringSplitOnFirstOccurrence` | viď detail | TEST (CSS ČÍTANIE) |

## U. Core utils — 13 bugov, opravené v `coretests`
[Detail →](detail-U-utils.md)

| # | Popis | Návrh | Dôkaz |
|---|---|---|---|
| U1 | `getMonthInterval`: „Minulý mesiac“ prázdny/obrátený interval 5 dní v roku (9 cms filtrov) | `setMonth(m,1)` naraz | TEST ✓ |
| U2 | `stringIsValidEmail` odmieta `jan+news@…` | povoliť `+` v local-part | TEST |
| U3 | `stringToSlug` nechá `_`, zahodí `ł ß đ ø…` | `_`→`-` + transliterácia | TEST |
| U4 | `ADatatableOrdering` plytký watch, in-place `sortBy` sa neprejaví | watch getter | TEST |
| U5 | `AActionDeleteButton` varianty ignorujú `disabled`/`loading` | prepustiť props | TEST |
| U6 | `prettyDuration` hodiny pretečú po dni | opraviť výpočet | TEST |
| U7 | Ikonové varianty Edit/Create majú ikonu uloženia | `mdi-pencil`/`mdi-plus` | TEST |
| U8 | `isInt` orezáva na 32 bitov | `Number.isInteger` | TEST |
| U9 | `arrayFlatten([1,[]])` → `[]` | opraviť | TEST |
| U10 | `objectGet/Set/DeleteValueByPath` hádžu pri null medzikroku | ošetriť null, set vytvorí | TEST |
| U11 | `cloneDeep(ref/proxy)` chybný; `stringUrlTemplateReplace` neenkóduje | `toRaw` + `encodeURIComponent` | TEST |
| U12 | `parseBoolean('   ')`→true; `dateTimeNow(false)` zlý formát | opraviť | TEST |

## B. Breaking zmeny pre 2.0.0
Dopad na adminov zmeraný, codemody vyskúšané naprázdno. [Detail →](detail-B-breaking.md)

| # | Popis | Návrh | Dôkaz |
|---|---|---|---|
| B1 | Deprecated aliasy `ANestedSortableListEditor` (rieši stratu dát A10) | zmazať; cms 1 súbor | ČÍTANIE |
| B2 | Zapisovateľné stores `useDamConfigStore`/`useImageStore` | neexportovať, statický config; ugc 3 | ČÍTANIE |
| B3 | `useCollabState()` vracia `collabSocket` → ~20 typov v API | odstrániť zo return | ČÍTANIE |
| B4 | Re-export `useI18n` | zrušiť; codemod 84 súborov | REPRO |
| B5 | Kľúče `…Config`/`…Symbol` + A-prefix 10 `Dam*` | premenovať; codemod 114 | REPRO |
| B6 | 15 verejných emits s `on` prefixom | zjednotiť; codemod 316 (props NIE) | REPRO |
| B7 | Staré typy `SortableNested*`, `FilterStore` | do cms / zmazať | ČÍTANIE |
| B8 | `CancelToken`, dayjs typy, `v?:any` vo verejnom API | nahradiť/skryť | ČÍTANIE |
| B9 | `Acl` netypovaný + TS2300 v adminoch | `GlobalComponents` + `AclRegistry`; codemod 115 | REPRO |
| B10 | Dve i18n inštancie | jedna cez plugin, deep-merge, typed keys | ČÍTANIE |

## C. Balík a typy
[Detail →](detail-C-balik.md)

| # | Popis | Návrh | Dôkaz |
|---|---|---|---|
| C1 | Bundlovaný d.ts: 80 typových chýb, `any` sloty v adminoch | `bundleTypes:false` → 0 chýb | TEST ✓ |
| C2 | Lib build kopíruje `public/` do balíka (~137 KB) | `copyPublicDir:false` + css.d.ts z pluginu | TEST |
| C3 | Peers priveľmi voľné, chýba `@mdi/font`, `socket.io-client` | zdvihnúť rozsahy, doplniť | TEST |
| C4 | Zatúlaný `src/labs/api/package.json` | zmazať | ✓ |
| C5 | CI nebuildí knižnicu na PR | build job + `tsc` nad d.ts, concurrency | ČÍTANIE ✓ |
| C6 | Vue 3.6 rc.9 kompatibilita | kompatibilné; CI job na rc | TEST |

## D. Presun z adminov do knižnice (~7,8 tis. riadkov, aditívne)
[Detail →](detail-D-presun.md)

| # | Popis | Návrh | Dôkaz |
|---|---|---|---|
| D1 | Auth pipeline (guard, session, refresh interceptor) | knižnica; interceptor 5/6 adminov chybný | REPRO |
| D2 | App shell (`AppLayout` ×6, `ActionbarWrapper` ~770 stránok) | komponenty knižnice | ČÍTANIE |
| D3 | Bootstrap (Sentry, env, vuetify) | `createAnzuAdmin` a helpery | ČÍTANIE |
| D4 | Axios klienti (~30 factory) | `defineApiClient` | ČÍTANIE |
| D5 | 193 mŕtvych `inject` blokov + 210 forwardov vo filtroch | zmazať v adminoch dnes | REPRO |
| D6 | 136 remote-autocomplete wrapperov | `createRemoteAutocomplete` (95 z nich) | ČÍTANIE |
| D7 | eslint/vite presety (byte-identické konfigy) | `defineAnzuAdminConfig` (s C1) | ČÍTANIE |
| D8 | ~4,2 tis. riadkov duplikovaných testov | `./testing` entry | ČÍTANIE |
| D9 | Chýbajúce exporty, ktoré si admini definujú sami | doexportovať | ČÍTANIE |
| D10 | **TODO 2.x.** Upload queue knižnice je upravená kópia damovej (jadro na viac queue), kópie sa rozchádzajú | spoločné jadro v knižnici, dam a widgety nad ním | ČÍTANIE |

## E. Štruktúra
[Detail →](detail-E-struktura.md)

| # | Popis | Návrh | Dôkaz |
|---|---|---|---|
| E1 | `labs/` už nič neznamená | reštrukturalizovať podľa domén, 1 commit | REPRO (dry run) |
| E2 | 2 DAM cykly | konštanta + store-free `uploadApi` | TEST |
| E3 | Mŕtvy kód (2 súbory, 45 i18n kľúčov, CSS triedy) | zmazať | ✓ |
| E4 | `API-HELPERY-MIGRACIA.md` vykonaný | označiť historický | ✓ |

## F. DX, tooling, UX
[Detail →](detail-F-dx.md)

| # | Popis | Návrh | Dôkaz |
|---|---|---|---|
| F1 | Dev loop úprava→stránka ~21 s | `dev:admin` watch → **~1,1 s** | REPRO (meranie) |
| F2 | Test setup bez `useCommonVuetifyConfig()` (490 warningov), zlý i18n glob | doplniť config, opraviť glob | ✓ |
| F3 | Pokrytie 126/492 modulov | testy z tejto analýzy | ✓ |
| F4 | 132 `no-floating-promises` (10 reálnych bugov) | typed eslint v CI | REPRO |
| F5 | CSS mimo `@layer`, utility bez prefixu, tooltipy skryté na dotyku | `@layer anzu-common` + reset | TEST |
| F6 | 75 tlačidiel len s ikonou bez prístupného mena; Esc nezatvorí dialóg | mená centrálne, Esc do confirm | TEST |
| F7 | Vypnuté lacné TS flagy | zapnúť 4 (0/0/6/19 chýb) | TEST ✓ |
| F8 | `AAlerts` na @kyvg s `@ts-nocheck` | `VSnackbarQueue` (nie čistý drop-in) | TEST / ROZHODNI |
| F9 | webfontloader (2017), uuid `@ts-ignore` | `<link>` + vlastný generátor | TEST |
| F10 | Dark mode: 4 reálne kontrastné problémy | dark varianty | TEST |

## G. Roadmapa (2.x+)
[Detail →](detail-G-roadmapa.md)

| # | Popis | Návrh | Dôkaz |
|---|---|---|---|
| G1 | vuelidate neudržiavaný | → Regle cez API knižnice; spike funguje; stromová vrstva nad `useRegle` + dual-stack + ľahké typy, [detail](detail-G1-regle.md) | REPRO, TEST |
| G2 | `@mdi/font` 403 KB + 347 KB CSS, 97 ikon | SVG cez `@mdi/js` | ČÍTANIE |
| G3 | `noUncheckedIndexedAccess` vypnuté | zapnúť (215 chýb, vnútro) | TEST |
| G4 | rusha neudržiavaná | hash-wasm (SHA-1 ostáva) | ČÍTANIE |

---

Rozhodnutia, kde čakám na teba: [rozhodnutia.md](rozhodnutia.md)
