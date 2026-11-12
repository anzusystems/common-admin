# Podklady k reportu 2.0.0

Surové výstupy analýz, na ktoré odkazujú detailné MD v nadradenom adresári. Slúžia na to, aby čítajúca session nemusela nič znova zisťovať.

Priečinky (predpona = pôvodná dávka):
- `batch2_breaking-out` — dopad breaking zmien, codemody, changelog draft, migračný checklist
- `batch2_csslayer-out` — CSS @layer analýza, runtime diff, a11y prototyp
- `batch2_dts-out` — d.ts po moduloch: diffy, dopad na adminov
- `batch2_restructure-out` + `_tools` — reštrukturalizácia: mapping, build-compare, presúvací skript
- `batch2_design-shell-out` — návrhy shell/filtre/autocomplete/testing (sketche)
- `batch3_devloop_out` — meranie dev loopu, návrh `dev:admin`
- `batch3_info_out` — patche a merania (VSnackbarQueue, fonty, uuid, publicDir, peers, dark, Vue 3.6)
- `batch3_quickwins_out` — per-admin patche (forum, inhouse, ugc, dam)
- `batch3_repro_out` — reprodukcie (aclvalue, init)
- `batch3_vuelidate-out` — inventár vuelidate, Regle spike a probes
- `g1_regle-scope` — G1 pokračovanie: katalóg scope vzorov, porovnanie knižníc, prototypy vrstvy (77 testov), benchmark typov, codemod na sucho

## Zámerne vynechané
- Bezpečnostné a auth podklady (XSS, refresh/JWT/cookie, impersonate) — na žiadosť vlastníka a aby čítajúcej session fungoval filter.
- `node_modules`, veľké dist snapshoty a plné repo kópie — regenerovateľné.
- Spojený `fixes.patch`/`tests.patch` knižnice (obsahuje aj bezpečnostné hunky) — kód sa dá pri schválení konkrétneho bodu vygenerovať z detailu.

## Pozor
- Cesty vnútri niektorých súborov ukazujú do pôvodného `scratchpad/` — sú to len referencie, nie živé odkazy.
