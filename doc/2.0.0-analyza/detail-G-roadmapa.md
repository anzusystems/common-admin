# G — Roadmapa (2.x+) (detail)

Podklady: `batch3/vuelidate-out/` + `regle-deep/` (G1), analýzy závislostí `batch3/info/out/` a prvé kolo (G2–G4).

---

## G1 — vuelidate → Regle · REPRO (spike + probes)
- **Stav vuelidate:** core 2.0.3 (2023-06), validators 2.0.4 (2023-08); README od 2025-06 „LTS mode“ a odkazuje na Regle; ťahá vue-demi 0.13; 212 open issues. Na Vue 3.5.22 aj 3.6.0-rc.9 zber a `$autoDirty` fungujú.
- **Regle NIE je fork vuelidate** (overené: GitHub `fork=false`, vlastná história od 2023-09, autor to volá „successor inspired by Vuelidate“). Je to samostatná knižnica s podobným API. 1.29.3 (2026-09), aktívna, 1 maintainer, ~21,8 KB gzip vs 6,3 KB.
- **Použitie:** knižnica 48 súborov / 29 `useVuelidate` / 14 validátorov; admini 525 volaní (cms 332, inhouse 59, dam 65, forum 30, ugc 21, blog 20), 363 `$scope`. `$lazy`, `$externalResults`, async, `$model` sa nepoužívajú. Backend chyby sa do vuelidate nepushujú (toasty).
- **Kľúčové zistenie:** Regle zbiera validácie **cez celú appku**, vuelidate len podľa **stromu komponentov**. Priamy prechod na scoped API Regle by rozbil: cms `keyword-management` (3 collectory na riadok + merge tlačidlo s prázdnym povinným poľom), dam `assets` (sidebar zoznamu vs detailu, rovnaký symbol), forum codex/prompt/clustering/job (default collector by nevidel pomenované leafy). blog, inhouse, ugc (jeden formulár na stránku) sa netýka.
- **Riešenie:** migrovať **cez API knižnice**, ktoré si drží vlastné zbieranie podľa stromu, a Regle len vyhodnocuje pravidlá. Spike jedného formulára v blogu (`regle-deep/blog-spike/`): 2 zmenené súbory, adaptér ~170 riadkov, `vue-tsc` 0 chýb, **211/211 testov**, nový test prejde na vuelidate aj Regle.
- **Tiché rozdiely** (bez stromového adaptéra): default `autoDirty:true`, `$validate()` vracia objekt (17 miest by prestalo blokovať uloženie), tvar `$errors` (`.map` spadne na poliach), hviezdička `requiredIf`. Adaptér ich rieši.
- **Plán:** 2.0.0 pridať `useAnzuValidation(state, rules, {scope, autoDirty, stopPropagation})` a `useAnzuValidationCollector({scope, stopPropagation})` nad vuelidate + codemod všetkých 525 volaní (mechanické) + minimálne rozhranie namiesto `v?:any` (B8) + typy `useValidate()` bez `@vuelidate` v d.ts. Engine na Regle v 2.1, poradie blog → forum → ugc → inhouse → dam → cms. `@vuelidate/*` peer kým nemigruje posledný admin, eslint zákaz priameho importu.
- **Revidovaný odhad:** ~2 týždne knižnica + 2,5–3,5 týždňa adminy (pôvodne 8–10 týždňov len adminy, vyššie riziko).
- **Pokračovanie (2026-09-27):** [detail-G1-regle.md](detail-G1-regle.md) — porovnanie knižníc, merania (natívny scope Regle 149 ms na úder klávesu pri 60 × 25 poliach, Vuelidate 0,68 ms), dual-stack na migráciu po komponentoch, cena typov (ľahké typy namiesto plných), test zhody typov, overený katalóg (16 brán s preskočenými pravidlami).

## G2 — `@mdi/font` → SVG cez `@mdi/js` · ČÍTANIE
- Font stojí 403 KB woff2 + 347 KB CSS (54 KB gzip, 7448 pravidiel), knižnica používa 97 ikon (16,5 KB path dát). Vuetify renderuje SVG path bez ohľadu na default icon set, takže knižnica môže prejsť skôr bez rozbitia adminov. Admini majú ~880 `mdi-` stringov, 340 unikátnych → codemod. @mdi bez vydania od 7.4.47 (2023-12).

## G3 — `noUncheckedIndexedAccess` · TEST
- Dnes explicitne `false`. Zapnutie: 215 chýb v 47 súboroch, len vnútro knižnice (hotspoty `labs/listEditor`, `alerts.ts`, remote autocomplete filtre). Nemusí čakať na major, dá sa priebežne.

## G4 — rusha → hash-wasm · ČÍTANIE
- rusha posledné vydanie 2021, už sa načítava lazy. SHA-1 musí ostať: backend (core-dam) počíta `sha1_file`, pri nezhode `InvalidChecksum`, duplicity cez `findProcessedByChecksumAndLicence`. WebCrypto `digest` nevie po chunkoch, hash-wasm `createSHA1` áno. Nízka priorita, admin-dam importuje rusha aj priamo.

## Ostatné (zvážené, neodporúčané teraz)
- Temporal namiesto dayjs: v stabilnom Safari (2026-08) ešte nie je; dayjs je v 6 súboroch a udržiavaný — nechať.
- TypeScript 7: vue-tsc stále potrebuje TS 6 API — ostať na `~6.0`.
- Reactive props destructure plošne: riziko straty reaktivity pri podávaní do composables — nie.
