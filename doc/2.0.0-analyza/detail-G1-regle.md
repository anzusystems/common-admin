# G1 — vuelidate → Regle: knižnice, scope medzi komponentmi, vrstva (detail)

> **2026-10-06: rozhodnuté ostať na Vuelidate; knižnica aj admini sú vrátení na commitnutý stav. Dôvody a kde je uložená práca na Regle: [g1-pokracovanie.md](g1-pokracovanie.md), prvý blok. Text nižšie je záznam analýzy.**
>
> **AKTUALIZÁCIA 2026-10-06, čítaj najprv toto.** Stav a čo ostáva: [g1-pokracovanie.md](g1-pokracovanie.md); API a rozdiely oproti Vuelidate: [`doc/guide/validation.md`](../guide/validation.md).
>
> **Knižnica je prenesená na Regle 1.29.4** (pracovný strom): vlastný kód je len zber medzi komponentmi nad `useRegle` (variant B z tejto analýzy) a typy `r$`; všetko ostatné je natívne Regle. Admini ešte nie.
>
> **Čo táto analýza neoverila a ukázali až sondy 2026-10-05/06** (uložené: `podklady/g1_regle-scope/runtime/test/closureAndObject.test.mjs`, `src/validation/__tests__/formValidation.test.ts`):
> - Regle **nesleduje závislosti, ktoré validátor číta cez closure**; prepočíta pri zmene hodnoty, deklarovaného parametra alebo pri `$touch()`/`$validate()`. Týka sa väčšiny z ~140 vlastných validátorov flotily; sekcia 10 uvádza ako ručnú prácu len 18. Rieši sa natívne: závislosť sa deklaruje cez `withParams(fn, [() => iné])` alebo parametre `createRule`.
> - **Objekt ako hodnota poľa** berie Regle ako vnorený strom, ak tam je pri vzniku formulára. Rieši sa natívne: taká hodnota sa označí `markStatic`; pole, ktoré začína ako `null`, je pole aj po priradení objektu.
> - Hotové pravidlo Regle sa nedá dodatočne obaliť (`withParams` mu nahradí parametre) a ~~pole nepozná svoju celú cestu, len `$name`~~ — nepravda, opravené 2026-10-06: každý stav Regle má `$path` (aj pole bez pravidiel); sonda vtedy vypisovala len kľúče bez `$`.
>
> **Čo z textu nižšie platí:** sekcie 2–5 a 8–9 (dáta o knižniciach, sémantika `$scope` vo Vuelidate, vzory vo flotile, merania). Sekcie 1, 6, 7, 10–12 a 14 opisujú variant A (presná kópia Vuelidate, výsledok v tvare Vuelidate, dual-stack) — **neplatia**; zvolený je variant B a migrácia naraz.
>
> **Zahodené:** kópia zdrojáka Vuelidate v knižnici ako náhradný engine (noc 5./6. 10.), vlastníkom odmietnutá.

Stav 2026-09-27. Stav na pokračovanie (pravidlá, otvorené rozhodnutia, ďalšie kroky): [g1-pokracovanie.md](g1-pokracovanie.md). Podklady: [`podklady/g1_regle-scope/`](podklady/g1_regle-scope/README.md) (prototypy, 77 testov, merania, katalóg vzorov). Nadväzuje na G1 v [detail-G-roadmapa.md](detail-G-roadmapa.md) (iná session, spike v blogu) — závery sa zhodujú, tento detail pridáva merania, typy, dual-stack, Vue 3.6 a overenie katalógu. Rozhodnutie #117: „zatiaľ nie — rieši sa samostatne“; toto je ten samostatný podklad.

**Dôkaz:** `TEST` = test v `podklady/g1_regle-scope/runtime` alebo `types` · `REPRO` = meranie/beh · `ČÍTANIE` = z čítania kódu (3 prechody, posledný adversariálne overoval prvé dva).

---

## 1. Záver
- **Prejsť na Regle, ale cez vlastnú tenkú vrstvu v knižnici** (`useAnzuValidation`), ktorá presne kopíruje sémantiku Vuelidate `$scope` nad obyčajným `useRegle`. Natívny scope Regle (`useScopedRegle`/`useCollectScope`) **nepoužiť** — zbiera v celej appke a je o dva rády pomalší. `TEST`, `REPRO`
- Vrstva vracia `v$` v rovnakom tvare ako dnes → vo flotile sa mení len riadok volania; **codemod na sucho: 565 z 565 volaní** má tvar na automatický prepis. `REPRO`
- **Ľahké typy** (mapované cez kľúče pravidiel) namiesto plných typov Regle: plné typy by admin-cms spomalili rádovo a zabrali GB pamäte. `REPRO`
- **Dual-stack** počas prechodu: Regle a Vuelidate inštancie sa zbierajú navzájom → migrovať sa dá po komponentoch, nie „big-bang“. `TEST`
- Veľkosť vrstvy: **~300 riadkov** (z toho ~40 dočasných) + ~600 riadkov testov; nahrádza dnešných 231 riadkov validátorov a 39 riadkov mostu list editora.
- **Bez zhonu:** Vuelidate na Vue 3.6.0-rc.9 funguje (zber, `$autoDirty`, `helpers.forEach`, i18n, `$reset`). Dôvod prechodu je, že ho nikto neudržiava, nie že padá. `TEST`

## 2. Knižnice
| Možnosť | Popularita (npm/týž., ★) | Údržba | Náročnosť prechodu | Pokrytie |
|---|---|---|---|---|
| **Vuelidate 2** (ostať) | 463k, 6,9k★ | mŕtva: posledné vydanie 06/2023, kód 12/2023, README „LTS mode“ + odkaz na Regle; 198 open, od 2024 zavretých 10 | 0 | 100 % dnes, bez opráv do budúcna |
| **Regle** | 50k (~9× menej), 0,5k★; 5× rast za rok | veľmi aktívna: 1.29.3 (2026-09-22), ~30 releasov / 5 mes., medián zavretia issue 3,8 dňa, 13 open; **1 autor (~98 % commitov)**; breaking v minor 1.17.0 | stredná, najnižšia z alternatív | ~90 % priamo; `$scope` a `siblings`/`vm` validátory cez vrstvu |
| VeeValidate 4/5 | 1,06M, 11,3k★ | spomaľuje: stabilná 06/2025, v5 beta od 08/2025, posledný commit 03/2026, 1 autor | vysoká (knižnica drží stav formulára) | validácia nad pinia stavom nie |
| TanStack Form (Vue) | 57k, 6,7k★ | veľmi aktívna, viac maintainerov; v2 alpha | veľmi vysoká (prepis formulárov) | bez zberu naprieč komponentmi |
| Vuetify rules | súčasť Vuetify 4 | aktívna | veľmi vysoká + strata funkcií | len namontované inputy |
| Zod/Valibot + vlastné | 274M / 18M | veľmi aktívne | veľmi vysoká (vlastný framework) | len schéma; dá sa cez `@regle/schemas` |
| FormKit / Vueform | 120k / 10k | aktívne | nereálne (vlastné UI inputy) | — |

Surové dáta: [`kniznice.md`](podklady/g1_regle-scope/kniznice.md). Trend (4 týždne 09/2025 → 09/2026): Regle 31k → 161k, TanStack vue-form 46k → 199k, vee-validate 2,75M → 3,83M, Vuelidate 1,30M → 1,55M (od 03/2026 klesá). Skutočný trend ekosystému je Standard Schema — Regle ho podporuje, cesta sa nezatvára.

**Stabilita Vuelidate vs Regle:** na dnešnom stacku je stabilnejší Vuelidate (nič sa nemení). Dlhodobo bezpečnejší je Regle (niekto opravuje). Riziko Regle (1 autor, rýchle releasy) mitigujú pinnutá verzia, vrstva (flotila závisí od API knižnice, nie od Regle) a testy, ktoré pri zmene Regle spadnú (sekcia 9).

## 3. Ako funguje `$scope` vo Vuelidate — `TEST` (8 scenárov, `vuelidate.test.mjs`)
| Pravidlo | Dôsledok |
|---|---|
| dieťa hlási len inštanciám **najbližšieho predka**, ktorý volá `useVuelidate` (`@vuelidate/core/dist/index.mjs:663`) | medzikomponent s iným scope potomkov potichu vyradí (tieňovanie) |
| collector `true` (aj `useVuelidate()`) berie deti **akéhokoľvek** scope okrem `false` (`:650`) | forum stojí na tom, že `useVuelidate()` zoberie deti so Symbol scope |
| pomenovaný collector berie len rovnaký Symbol | dieťa s default scope pod pomenovaným collectorom sa stratí |
| `$scope: false` a `$stopPropagation` (na dieťati) sú bariéry | nezberá sa komponent ani jeho potomkovia |
| zber podľa stromu | dva súrodenecké collectory s rovnakým Symbolom sa nevidia |
| dve inštancie v tom istom komponente sa nevidia | collector a pravidlá v jednom komponente = collector je k nim slepý |

## 4. Prečo nie natívny scope Regle — `TEST` (`regle-native.test.mjs`), `REPRO` (`perf.test.mjs`)
| Vlastnosť Regle 1.29.3 | Kde to zlyhá |
|---|---|
| zbiera **v celej appke** (store `WeakMap` podľa `app`, `createScopedUseRegle`), nie podľa stromu | dam asset list (sidebar + detail / pätička), cms keyword management (3 collectory na riadok) |
| `useCollectScope()` bez namespace **nezbiera** inštancie s namespace | forum brány (job, codex, prompt, clusteringProfile) by prestali blokovať |
| namespace len `string` | 102 `Symbol.for` + 5 `Symbol()` by sa mapovali |
| collector sa nedá zaregistrovať vyššie | reťaze (79 z 91 composables na 2 úrovniach, Page 5 úrovní, PublicExport hĺbka 7) |
| bez tieňovania a bariér | 33× `$scope:false`, 15× `$stopPropagation` by zmenili správanie |
| inštanciu zruší, ak jej `$el` nie je v `document` | unit testy musia montovať s `attachTo` |
| pri každej zmene deep watch nad všetkými inštanciami a nový zlúčený `r$` (`regle-core.js:4719`) | cena úderu klávesu nižšie |

**Úder klávesu, ms (Chromium, vitest browser; happy-dom má rovnaké pomery):**
| inštancie × polia | Vuelidate | Regle natívny scope | vrstva A (compat) | vrstva B (tree) |
|---|---|---|---|---|
| 5 × 10 | 0,05 | 4,6 | 0,03 | 0,02 |
| 20 × 10 | 0,08 | 16,7 | — | — |
| 20 × 25 | 0,24 | 45 | 0,03 | 0,03 |
| 60 × 25 | 0,68 | 149 | 0,06 | 0,04 |

Na Vue 3.6 RC je natívny Regle ~2× rýchlejší, stále o dva rády pomalší ako Vuelidate.

## 5. Vzory vo flotile — `ČÍTANIE`, plne v [`katalog-scope.md`](podklady/g1_regle-scope/katalog-scope.md)
- Rozsah: ~510 súborov importuje Vuelidate, ~565 volaní `useVuelidate(`, ~1 680 väzieb `:v=`, ~390 `$scope`, ~180 collectorov bez pravidiel. admin-cms ≈ 60 % (332 volaní, 97 Symbol collectorov, žiadny `useVuelidate()`).
- P1 collector v `*Actions.ts` · P2 `useVuelidate()` zbiera Symbol deti (forum, dam, inhouse, blog) · P3 reťaze · P4 riadky vo v-for + most list editora (11) · P5 `$scope:false` (33) · P6 `$stopPropagation` (15) · P7 `validationScope` prop drilling (74 komponentov, 95 call sites) · P8 rovnaký scope naraz (dam asset list, cms keyword management) · P9 16 brán s preskočenými pravidlami · P10 collector s pravidlami ako brána · P11 nested routes / keep-alive **žiadne** · P12 `$errors` podľa `$propertyPath`, `$validate` cez `ACustomDataForm`, collectory v Pinii, `:v="v$"` do `ACreateDialog`.
- **16 brán, ktoré dnes potichu preskakujú pravidlá** (všetky cms; napr. keywords/new nevynúti žiadne create pravidlo, `EmbedRelatedDialog` nekontroluje `embed.title`). Sú to dnešné bugy nezávislé od migrácie; vrstva variant A ich správanie zachová.

## 6. Návrh: vrstva `useAnzuValidation` — `TEST`
```ts
const v$ = useAnzuValidation({ scope: FaqValidationSymbol })               // collector
const v$ = useAnzuValidation(state, rules, { scope: FaqValidationSymbol }) // pravidlá + zber (ako Vuelidate)
useAnzuValidation(state, rules, { scope: false })                          // bariéra
useAnzuValidation({ scope: S, stopPropagation: true })                     // koreň dialógu
```
- Každý komponent cez provide/inject poskytne zoznam prijímačov (ako `__vuelidateInjectInstances`); inštancia sa hlási prijímačom najbližšieho predka, tie filtrujú podľa scope.
- Agregát: vlastný `r$` + deti, `$invalid/$error/$dirty/$pending` cez `some`/`every`, `$touch/$reset/$validate` rozoslané; `$validate()` vracia `boolean` ako dnes.
- Proxy `v$`: polia (`v$.value.article.title`) z Regle, príznaky z agregátu; vracia `ShallowRef`, takže `v$.value.$touch(); if (v$.value.$invalid) return` aj `:v="v$.article.title"` ostávajú.
- `autoDirty: false` (Regle má default `true`); `onShadowed` v dev móde ukáže tieňované inštancie.
- Symboly sú priamo kľúče → `validationScope` props, typ `ValidationScope` a 102 deklarácií bez zmeny.

| Vuelidate | Vrstva |
|---|---|
| `useVuelidate()` | `useAnzuValidation()` |
| `useVuelidate({ $scope: X })`, `useVuelidate({}, {}, { $scope: X })` | `useAnzuValidation({ scope: X })` |
| `useVuelidate(rules, state, { $scope: X, $autoDirty })` | `useAnzuValidation(state, rules, { scope: X, autoDirty })` |
| `$stopPropagation: true` | `stopPropagation: true` |
| `useListEditorScopeValidity` (falošné pravidlo) | registrácia obyčajného uzla (overené vo variante B) |

**Varianty:** A = presná kópia Vuelidate (`anzuCompat.mjs`, 9 testov + 8 spoločných scenárov) — migrácia neutrálna v správaní. B = čistá sémantika (`anzuScope.mjs`, 16 testov): len explicitné collectory, bez tieňovania, bariéry explicitne — zmení správanie tam, kde dnes niečo tieňuje. **Odporúčanie: A, B prípadne až po migrácii podľa `onShadowed`.**

**Dual-stack** (`anzuDual.mjs`, 7 testov): migrovaná inštancia si počas prechodu vytvorí skrytý Vuelidate collector pre starých potomkov a reportér s jedným premosteným pravidlom, ak je najbližší validujúci predok ešte Vuelidate (`$touch`/`$reset` sa zrkadlia späť). Overené: V stránka > R list, R stránka > V list, V > R > V, R > V > R bez dvojitého počítania, tieňovanie a bariéry v zmiešanom strome. Číta interný `__vuelidateInjectInstances` (Vuelidate je zamrznutý); po migrácii ide preč.

**Veľkosť:**
| Časť | Prototyp | Realisticky v TS | Trvanie |
|---|---|---|---|
| jadro (zber, agregát, Proxy) | 52 | ~90 | natrvalo |
| ľahké typy | 51 | ~60 | natrvalo |
| dual-stack | +30 | ~40 | len migrácia |
| port `useValidate()` | 38 | ~100 | natrvalo, nahrádza 231 riadkov v 14 súboroch |
| adaptér poľa AForm\* | 11 | ~30 | natrvalo, nahradí duplicitu v 10 komponentoch |
| most list editora | — | ~15 | nahrádza 39 riadkov |
| **spolu** | | **~300** | + ~600 riadkov testov |

Pre porovnanie: zber `$scope` má Vuelidate v 51 riadkoch, natívny scope Regle v 115. Pravidlá, správy, kolekcie, dirty a `$validate` ostávajú na Regle. „Vesmírna loď“ by vznikla len obaľovaním celého API Regle, vlastnými pravidlami/chybami alebo hneď variantom B.

## 7. Typy — `REPRO` (`types/out`), `TEST` (`types/src/types`)
**Cena typovej kontroly** (tsc 6.0.3, Check time / pamäť):
| Scenár | Vuelidate | Regle priamo | vrstva s plnými typmi | vrstva s ľahkými typmi |
|---|---|---|---|---|
| 1 formulár × 12 polí | 0,05 s / 112 MB | 0,33 s / 154 MB | 0,40 s / 165 MB | 0,33 s / 154 MB |
| 20 formulárov × 12 polí | 0,19 s / 113 MB | 1,80 s / 327 MB | 1,51 s / 304 MB | 0,43 s / 179 MB |
| 60 formulárov × 12 polí | 0,33 s / 161 MB | 5,14 s / 1,07 GB | 4,05 s / 779 MB | **0,56 s / 221 MB** |
| 1 formulár 600 polí + 6 kolekcií | 0,30 s / 155 MB | 4,34 s / 970 MB | 3,69 s / 805 MB | **0,51 s / 211 MB** |

admin-cms má ~235 inštancií s pravidlami → plné typy by znamenali desiatky sekúnd a GB navyše (`lint:tsc` knižnice už dnes beží s limitom 4 GB). **Ľahké typy** kontrolujú: neznáme pole, neznáme pravidlo, `$each`, pole primitív ako kolekciu so `$self`, `$validate(): boolean`, väzbu `:v=` v šablóne (vue-tsc). Strácajú typovaný `$value` a výstup `$validate`. Kontrolu „pravidlo vs typ poľa“ nerobí ani čistý Regle (`minLength` na boolean, `email` na number prejdú).

**Test zhody** (`conformance.ts`, ~10 riadkov): priradí `RegleFieldStatus`/`RegleCollectionStatus` do ľahkých typov. Simulované premenovanie člena v Regle → `TS2741 … is missing in type 'RegleFieldStatus'` (pole aj `$self`); iný typ `$errors` → chyba vo väzbe `:v=`. Bez neho by ručne písané typy potichu klamali.

## 8. Overené správanie Regle, na ktorom vrstva stojí — `TEST`
| Čo | Výsledok |
|---|---|
| Vue 3.6.0-rc.9, Chromium | 77/77 testov všade (happy-dom 3.5, Chromium 3.5, happy-dom 3.6) |
| port `useValidate()` s vue-i18n 11.4.12 | správy s `{min}`/`{max}`/`{otherDateName}`, zmena jazyka reaktívna, `datesCompare` s reaktívnym druhým dátumom |
| `$reset()` | hodnoty ponechá ako Vuelidate a posunie `$initialValue` na aktuálnu hodnotu; `toInitialState`/`toOriginalState` pri `reactive` stave hodnotu **nevrátia** (flotila to nepotrebuje) |
| tvary stavu | `{ article }` z refu aj po výmene objektu, writable computed, `storeToRefs` + `reset`/`$patch` |
| Pinia | collector `v$` v setup aj options store funguje |
| mimo setup | funguje, ale Vue varuje `inject() can only be used inside setup()` a efekty visia → cms `notificationActions.ts:112` obaliť do `effectScope` |
| pole primitív | kolekcia, chyby/pravidlá/`$path` v `$self` → rieši adaptér AForm\* a ľahké typy |
| `requiredIf` | Regle hlási aktívne `$rules.required` (aj `$type: 'required'`) → hviezdička sa ukáže, Vuelidate ju dnes pri `requiredIf` nezobrazí (**zmena**) |
| adaptér AForm\* | jedna funkcia obslúži pole z Vuelidate aj Regle (`$errors`, `$path`, povinné pole, `$self`) |
| cross-field (`siblings`) | `createRule` s getter parametrom a `withParams` s reaktívnou závislosťou |
| `autoDirty` | globálne `false` + field-level `$autoDirty: true` |
| bundle | Regle core + rules ~27 KB gzip pred tree-shakingom, Vuelidate ~7 KB → ~+20 KB na appku |

## 9. Riziká a čo ich chytí
| Riziko | vue-tsc | testy (CI `yarn ci` + `yarn test:run`) |
|---|---|---|
| ľahké typy prestanú sedieť s tvarom poľa v Regle | áno, **len s testom zhody** | — |
| Regle zmení správanie v minor (pravidlá, texty, `$reset`, `autoDirty`) | nie | testy portu `useValidate`, `$reset`, tvarov stavu, `$self`, `$rules.required.$active` |
| sémantika scope, Proxy `v$` | nie | 8 spoločných scenárov, náhrada `v$`, zmiešané stromy |
| dual-stack a interný `__vuelidateInjectInstances` | nie | testy dual-stacku; Vuelidate zamrznutý, dual-stack dočasný |
| 1 autor Regle | — | vrstva: na Regle závisia len 3 miesta v knižnici (vrstva, port `useValidate`, adaptér AForm\*) |

Regle pinnúť na presnú verziu. Upgrade = zvýšiť verziu a pustiť CI. Zapísané aj v G1 v `doc/2.0.0-NAVRHY.md`.

## 10. Čo zostáva ručne
- 18 validátorov so `siblings`/`vm` (forum 10, blog 3, inhouse 4 súbory, dam 1) → `createRule` s getterom; `vm.required` v inhouse `GeoLocation` → closure nad props.
- ~20 miest s priamym čítaním `$errors`/`$message`/`$params` mimo AForm\* (zoznam v katalógu) a 2 filtre podľa `$propertyPath` (`organizationActions.ts:84`, `personActions.ts:108`) — **odpadá**, ak vrstva ukazuje polia v tvare vuelidate (sekcia 12); ostáva len čítanie `$params` hodnôt pravidiel (`$params.values` namiesto pomenovaných) a `$uid`.
- priame importy `@vuelidate/validators` v adminoch → cez knižnicu; typy `Validation`/`BaseValidation`/`ErrorObject` v 26 súboroch; 22 cms komponentov s `v?: any`.
- `notificationActions.ts:112` mimo setup.
- **Bez zmeny:** 7× `helpers.forEach` → priamo `$each` (šablóny chyby položiek nečítajú), 31× `$reset()`, všetky `:v=` väzby.

**Codemod na sucho** (`types/codemod-dry.mjs`, 2026-09-27): common-admin 39, cms 333, dam 65, inhouse 59, forum 30, ugc 19, blog 20 — všetky tvary `()`, `({ $scope… })`, `({}, {}, opts)`, `(rules, state)`, `(rules, state, literálne opts)`, `(rules, state, cond ? opts : undefined)`, 0 ručných.

## 11. Poradie
0. **Hneď, nezávisle:** opraviť 16 brán z P9 ešte na Vuelidate (zámerná zmena správania oddelene od výmeny knižnice). `ROZHODNI`
1. **Knižnica (B8 v 2.0.0):** typ poľa a brány namiesto `v?: any`, adaptér AForm\* pre oba tvary.
2. **Knižnica (minor 2.x):** vrstva s dual-stackom, port `useValidate`, testy (sekcia 9), Vuelidate ostáva peer.
3. **Pilot:** blog alebo ugc (~20 volaní) — codemod + preklikanie.
4. forum, inhouse (`siblings` validátory), dam, cms po doménach.
5. Zmazať dual-stack a Vuelidate; potom zvážiť variant B.

**Otvorené rozhodnutia:** základná vetva (`feat/list-editors` je 1 242 commitov pred `main` a mení aj validácie a most list editora) · hviezdička pri aktívnom `requiredIf` (odporúčam áno) · variant A (odporúčam) · admini importujú pravidlá len cez knižnicu (odporúčam, Regle ostane skrytý).

**Vzťah k plánu v detail-G-roadmapa (G1):** tam je navrhnuté v 2.0.0 API knižnice nad Vuelidate a engine Regle v 2.1 po adminoch. Je to kompatibilné: dual-stack umožní prepnúť engine po komponentoch namiesto po celých adminoch. Odhad tam: ~2 týždne knižnica + 2,5–3,5 týždňa admini.

## 12. Overené v skutočnom kóde knižnice — `TEST` ([`podklady/g1_regle-scope/real/`](podklady/g1_regle-scope/real/README.md))
V git worktree (bez vetvy, nad snapshotom pracovného stromu vrátane necommitnutých B5/B8/B10 inej session) pribudol len modul `src/validators/anzu/useAnzuValidation.ts` a test. **12/12 v Chromiu so skutočnými komponentmi, bez zmeny v nich:**
- `AFormTextField`: label z cesty, hviezdička (`requiredIf` len kým platí), chyby až po blur, stabilný `v` objekt.
- `ACreateDialog` blokuje `callCreate`, kým je zozbieraný formulár neplatný.
- `AListEditor` + dnešný vuelidate most: zbalený neplatný riadok blokuje nový collector, `$touch` ho odhalí.
- Dual-stack: `ADatetimePicker` s vlastným `useVuelidate` sa zozbiera; vuelidate stránka zozbiera migrovaný formulár.
- Typy z B8 (`AFormFieldValidation`, `ACreateDialogValidation`) pole aj bránu prijmú bez zmeny.
- `yarn lint:tsc` 0 chýb, za studena 19,3 s / 2,74 GB (bez vrstvy 18,6 s / 2,72 GB); eslint, oxlint, oxfmt čisté.

**Zmena návrhu oproti sekcii 6:** vrstva ukazuje polia z Regle **v tvare vuelidate** (`$errors[]` s `$message`/`$propertyPath`/`$property`/`$validator`, pravidlá ako `v.required.$params.type`, neaktívne pravidlo sa vynechá). Preto netreba adaptér v AForm\*, AForm\* ani `ACreateDialog` sa nemenia, B8 typ inej session ostáva a z ručnej práce (sekcia 10) odpadajú priame čítania `$errors`/`$message` a filtre podľa `$propertyPath`.

## 13. Neoverené
- `yarn build` s Regle v `external` (inak ho rolldown zbalí), d.ts, export v `lib.ts`, optional peer pri `preserveModules`.
- Port `useValidate()` na Regle v knižnici (overený len v prototype).
- Beh v skutočných adminoch.
- vue-tsc na reálnom admin-cms s ľahkými typmi (čísla sú zo syntetiky).
- Behový výkon veľkých reálnych formulárov (napr. `contentItemKindValidations.ts`, 1 448 riadkov).
- Vplyv Regle devtools na prvú validáciu (#347).

## 14. Variant: najprv vlastný zber nad Vuelidate, engine až potom (2026-09-29) — `ČÍTANIE`, čiastočne `TEST`
Otázka vlastníka: vypnúť auto propagáciu Vuelidate všade (`$scope: false`), zber robiť vlastným provide/inject v knižnici a až potom vyberať knižnicu. Vyhrali by populárnejšie?

**Nie, ale zmení sa poradie a riziko klesne.** Zhoduje sa to s plánom v detail-G-roadmapa (2.0.0 API nad vuelidate, 2.1 engine).

Po kroku 1 od knižnice ostáva: validácia nad existujúcim stavom (pinia, `{ article }` z refu), pravidlá ako objekt pri poli (computed, `requiredIf`, `$each`, cross-field), dirty/touch/chyby a `$path` po poliach, synchrónny `$invalid`.
| | Regle | VeeValidate | TanStack Form | Zod/Valibot + vlastné |
|---|---|---|---|---|
| nad existujúcim stavom | áno (overené) | nie, stav drží `useForm` | nie | áno |
| pravidlá ako dnes | skoro 1:1 | schéma, ručne | validátory polí, ručne | schéma, ručne |
| stav polí (dirty, touch, chyby, `$path`) | áno | áno | áno | písali by sme sami |
| údržba | aktívna, 1 autor | stojí, 1 autor | aktívna, v2 breaking | aktívna |

- VeeValidate sa stane realizovateľným, ale ostane drahý: problémom je vlastníctvo stavu formulára, nie zber — formuláre nad pinia by sa prestavali alebo synchronizovali obojsmerne, codemodom to nejde.
- Zod/Valibot: najpopulárnejšie, ale stav polí + i18n by bola vlastná knižnica. Rozumne ako jazyk pravidiel v Regle cez `@regle/schemas` (napr. nové formuláre).
- Regle stále vyhráva a je ešte jednoduchší: dual-stack netreba robiť cez interné `__vuelidateInjectInstances`, oba enginy sa hlásia do registra knižnice cez adaptér; pri zániku Regle sa mení len adaptér.

**Postup:**
1. `useAnzuValidation(rules, state, { scope })` interne `useVuelidate(…, { $scope: false })` + registrácia do registra knižnice (provide/inject); collector `useAnzuValidation({ scope })`. Codemod všetkých 565 volaní naraz vrátane 35 v knižnici (nemigrovaná inštancia pod obalenou by sa pohltila cez `$scope: false`). `v$` a typy ostávajú vuelidate — typová kontrola bez zmeny. Bez novej závislosti.
2. Register najprv s presnou sémantikou vuelidate + diagnostika tieňovania (krok 1 mechanický a neutrálny), potom vedome opraviť 16 brán a miesta s tieňovaním, až potom prípadne čistá sémantika (B).
3. Engine Regle za rovnakým adaptérom po admine/komponente; ručne len pravidlá (port `useValidate`, `helpers.*`, 18 validátorov so `siblings`/`vm`).

Overené: jadro zberu prototypu je nezávislé od enginu a register zozbiera vuelidate inštanciu cez adaptér (`real/`, test s `ADatetimePicker`). **Neoverené:** krok 1 nad čistým Vuelidate (`$scope: false` + register) ako celok.

## Opravy tvrdení z pôvodnej session (2026-09-26)
- „Vue 3.6 je hlavný dôvod prechodu“ — neplatí, Vuelidate na 3.6 RC funguje.
- „Reset hodnôt je voliteľný cez `toInitialState`“ — pri `reactive` stave v 1.29.3 nefunguje; nepotrebné.
- „~55 brán s preskočenými pravidlami“ — 16 brán (55 boli call sites).
- „LinkedListItemKindManageDialog tieňuje LinkedList scope“ — nie, je to samostatná zámerná brána.
