# Knižnice — surové dáta (2026-09-26)

Zdroj: npm registry (`/downloads/point/*`, `registry.npmjs.org/<pkg>`), GitHub API (`repos`, `commits`, `search/issues`, `releases`).

## npm
| Balík | týždeň | 4 týždne 09/2025 → 03/2026 → 09/2026 | latest | vydané | posledné vydanie |
|---|---|---|---|---|---|
| @vuelidate/core | 462 837 | 1,30M → 1,70M → 1,55M | 2.0.3 | 2023-06-29 | to isté |
| @vuelidate/validators | 463 249 | | 2.0.4 | 2023-08-25 | to isté |
| @regle/core | 50 450 | 31k → 141k → 161k | 1.29.3 | 2026-09-22 | to isté |
| @regle/rules | 50 180 | | 1.29.3 | 2026-09-22 | |
| @regle/schemas | 13 028 | | 1.29.3 | | |
| vee-validate | 1 055 256 | 2,75M → 3,55M → 3,83M | 4.15.1 | 2025-06-07 | 5.0.0-beta.1 2026-03-04 |
| @tanstack/vue-form | 57 079 | 46k → 135k → 199k | 1.33.5 | 2026-08-11 | 2.0.0-alpha.2 2026-08-21 |
| @formkit/vue | 119 783 | | 2.1.2 | 2026-07-24 | |
| @vueform/vueform | 10 375 | | | | |
| zod / valibot | 274M / 17,9M | | 4.6.5 / 1.5.0 | 2026-09 | |

## GitHub
| Repo | ★ | forky | open issues+PR | posledný push | commity 12 m / 90 d | top prispievatelia |
|---|---|---|---|---|---|---|
| vuelidate/vuelidate | 6 867 | 482 | 212 | 2025-06-10 (len docs) | 0 / 0 | dobromir-hristov 246, Frizi 159, shentao 68 |
| victorgarciaesgi/regle | 504 | 22 | 18 | 2026-09-22 | 100+ / 24 | victorgarciaesgi 1280, ďalší ≤ 6 |
| logaretm/vee-validate | 11 264 | 1 300 | 172 | 2026-03-04 | 15 / 0 | logaretm 3441 |
| TanStack/form | 6 698 | 689 | 208 | 2026-09-25 | 100+ / 45 | tannerlinsley 537, crutchcorn 185, … |
| formkit/formkit | 4 767 | 208 | 74 | 2026-07-24 | 100+ / 10 | justin-schroeder 1392 |

## Vuelidate
- README od 2025-06 (PR #1264): „Vuelidate is currently in LTS mode“, sekcia „Possible alternatives“ s Regle ako najbližšou náhradou (model-based), VeeValidate, VueForm.
- Posledný commit do kódu 2023-12-22. 198 otvorených issues, od 2024 zavretých 10. #1265 „Declare project dead/archived“ (2025-07).
- #1255 `$autoDirty` rozbitý vo Vue 3.5.10 — opravilo Vue v 3.5.11, nie Vuelidate.
- Závisí od `vue-demi` 0.13. Na Vue 3.6.0-rc.9 zber aj `$autoDirty`, `helpers.forEach`, i18n a `$reset` fungujú (`runtime/test/vuelidate*.test.mjs`).

## Regle
- Nie je fork Vuelidate (vlastná história od 2023-09; podrobne `../batch3_vuelidate-out/regle-deep/detaily.txt`).
- ~30 releasov za 5 mesiacov (1.23 → 1.29.3), breaking change v minor **1.17.0** (2026-01-16: „Make some rules more specific if input type is not valid“).
- Issues vytvorené za 12 m: 75 zavretých, medián 3,8 dňa, p90 18,8 dňa; 13 otvorených (0 s labelom bug). Známe otvorené: #309 pomalé písanie pri scoped + veľkých poliach, #347 pomalá prvá validácia s Vue Devtools, #395 `$pending` pri async, #396 external errors na scoped.
- Závislosti `type-fest` 5.8.0, `@vue/devtools-api` 8.2.1, `@standard-schema/spec` 1.1.0; peer `vue >=3.3.0`, `pinia >=2.2.5` (optional). Testuje proti Vue 3.4 aj 3.5, TS 6.0.3; 3.6 zatiaľ nie.
- Veľkosť: core 70 KB min / 20,7 KB gzip, rules 18,8 KB / 6,2 KB gzip (pred tree-shakingom). Vuelidate core 3,7 KB + validators 3,3 KB gzip.
- Predvolené `autoDirty: true` (Vuelidate `false`).

## VeeValidate / TanStack / FormKit / Vuetify rules (dôvody vyradenia)
- VeeValidate: stav formulára drží knižnica (`useForm`/`useField`), flotila validuje pinia stav v `*Actions.ts`; v5 v bete od 08/2025, 1 autor, vývoj stojí.
- TanStack Form: prepis všetkých formulárov, Vue je vedľajší adaptér, v2 v alpha (breaking), bez zberu naprieč komponentmi.
- FormKit / Vueform: vlastné UI inputy, konflikt s Vuetify a AForm\*.
- Vuetify rules (`:rules`, `VForm`, `createRulesPlugin` vo Vuetify 4.2.1): validuje len namontované inputy → zbalené riadky list editora a validácia v actions nejdú.
- Zod/Valibot: len schéma; dirty/touch/scope/i18n by sa písali sami. Do Regle sa dajú pripojiť cez `@regle/schemas`.
