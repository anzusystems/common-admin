# F — DX, tooling, UX (detail)

Podklady: `batch3/devloop/out/` (F1), `batch2/csslayer-out/` (F5, F6), `batch3/info/out/` (F8, F9, F10), `batch2/dts-out`/`batch2/all` (F2, F4, F7).

---

## F1 — Rýchlejší dev loop · REPRO (meranie)
- **Dnes:** úprava knižnice → stránka v admine ~21,6 s (`yarn build` 18,4 s, z toho 14,4 s d.ts; `copy.sh` 0,3 s; restart + re-optimize deps ~2,9 s).
- **Návrh:** `dev:admin` = `vite build --watch` bez d.ts do `node_modules/.cache/common-admin-dev` + plugin `devCopyToAdmins()` kopíruje len zmenené súbory (17–20 ms) a zapíše ich do `.common-admin-updated`; `dev:admin:types` na obnovu d.ts (17 s, paralelne). `commonAdminDevWatch({ prebundle })` do `./vite` nahradí 6 kópií `watchCommonAdmin`; `prebundle:false` invaliduje zmenené súbory + reload bez reštartu.
- **Namerané:** úprava → stránka **1,06–1,27 s**. Watch výstup byte-identický s normálnym buildom (JS, CSS, assety), lazy chunky rovnaké, locale id stabilné.
- **Alias na zdroj knižnice** (skutočné HMR, `.vue` update 87–95 ms) funguje v prototype, ale blokuje `@` kolízia (customResolver končí vo Vite 9), Docker volume, iné poradie CSS, i18n runtime kompilácia → neskôr, voliteľne.
- **Pred nasadením:** smoke test v prehliadači a beh v Dockeri; `COMMON_ADMIN_PREBUNDLE` do kontajnera cez `.env.docker.local` alebo flag `bin/dev`. Podklad `devloop/out/proposal/`.

## F2 — Test setup · ✓
- `src/test/setup.ts` volá `createVuetify` bez `useCommonVuetifyConfig()` → 490 warningov `Failed to resolve component: ABtnPrimary` (helper `src/test/support/commonVuetify.ts` z coretests to rieši). `silent:'passed-only'` stíši 11,9 tis. riadkov výstupu. `vitest.config.mts` i18n include `./src/locales/**.json` nematchuje vnorené súbory (build/playground majú `**/*.json`).

## F3 — Pokrytie testami · ✓
- Priame importy pokrývajú 126 z 492 modulov (~24,8 z 60,9 tis. riadkov), nástroj na coverage nie je. Testy z tohto reportu (A, U) výrazne dvíhajú util, validátory, buttony a filtre. Netestované veľké oblasti: `damImage` (20 %), `dam` (2 %), `collab` (10 %), `services/stores` (0 %). Návrh: `@vitest/coverage-v8`, premenovať testy pomenované podľa ticketov.

## F4 — Typed lint · REPRO
- typescript-eslint našiel v `src` 132 `no-floating-promises`, 3 `no-misused-promises`, 1 `await-thenable` (~22 s). 10 reálnych bugov (upload queue, ROI — pokryté v A). Návrh: samostatný typed eslint v CI len nad `src` (bez test/playground), `no-floating-promises` s `allowForKnownSafeCalls` pre `nextTick`; predtým `defineCached.fetch` typovať ako `() => void` (−19 hitov).

## F5 — CSS `@layer` · TEST
- **Problém:** knižnica je mimo `@layer`, Vuetify 4 má všetko v `@layer vuetify-*`, takže knižnica prebije Vuetify aj adminov bez ohľadu na špecificitu, a aj tak má 87× `!important`. Utility bez prefixu (`.cursor-pointer` koliduje s Vuetify), `@media (any-hover:none) .v-tooltip {display:none !important}` skryje všetky tooltipy na dotyku. Reset (63 riadkov) je v každom admine.
- **Návrh:** postcss plugin zabalí knižničné CSS do `@layer anzu-common`, reset presunúť do knižnice ako `src/styles/reset.scss`. Odporúčané poradie vrstiev: `@layer vuetify-core, vuetify-components, vuetify-overrides, anzu-common, vuetify-utilities, vuetify-final; @layer vuetify-final.transitions, vuetify-final.trumps;`.
- **Overené:** voči Vuetify **0 zmien pri súčasnom poradí** (P1), 4 pravidlá/9 miest pri odporúčanom (P2, viditeľné `.asset-list-tiles__item-text`); voči CSS adminov 45 kandidátov, ručne overené, žiadny reálny. Runtime test (376 elementov, 199 tis. hodnôt) potvrdil. `!important`: vo vrstve sa správa opačne, ~61 sa dá zahodiť. Admin, ktorý poradie nezmení, dostane P1 (ako dnes).
- **Utility (F5b):** `.cursor-pointer` zmazať (Vuetify má), `.system-border-*`→Vuetify `border-*`, `.line-clamp-1`→`text-truncate`, `.line-clamp-2`→`a-line-clamp-2`, nepoužité zmazať, `label span.required`→`a-required-mark`. Codemod ~44 prepisov cms, 8–17 ostatní.
- **Pozn.:** `.line-clamp-2` fix (`display:box`→`-webkit-box`) sa **cms nedotkne** (cms si to patchuje sám, vyzerá rovnako); reálne sa zmení len log datatable v blog/forum/inhouse/dam.

## F6 — a11y · TEST
- 75 tlačidiel len s ikonou bez prístupného mena (20 bez tooltipu: close v `ADialogToolbar.vue:20`, stránkovanie, list editor, datatables; 55 len s `VTooltip`, ktorý dáva `aria-describedby`, nie meno, a na dotyku je skrytý). Prototyp doplní `aria-label` centrálne v `ABtn*`/`AAction*`/`ATable*` (+87 riadkov, 3 testy, existujúca sada prešla 1410/1411). Globálne `persistent:true` (`commonVuetifyConfig.ts:103`) → Esc nezatvorí žiadny z 31 dialógov; `persistent` **ponechať** (inak 87 formulárových dialógov stratí vstup pri kliku mimo), pridať Esc do 6 confirm dialógov. Touch tooltip pravidlo (2023) nahradiť defaultmi bez hover/focus otvárania na dotyku.

## F7 — TS flagy zadarmo · TEST ✓
- Namerané cez scratch tsconfig nad `tsconfig.app.json`: `noImplicitOverride` 0 chýb, `noFallthroughCasesInSwitch` 0, `noImplicitReturns` 6/5 súborov, `erasableSyntaxOnly` 19/10 (12 v playgrounde). Zapnúť všetky 4. `verbatimModuleSyntax` je už cez `@vue/tsconfig`. `tsconfig.libdts.json` je písaný ručne a rozišiel sa — nech dedí z `tsconfig.app.json`. (`noUncheckedIndexedAccess` = G3.)

## F8 — `AAlerts` → `VSnackbarQueue` · TEST / ROZHODNI
- `AAlerts.vue` má `@ts-nocheck` a stojí na @kyvg/vue3-notification (8,7 KB JS vo vendore). Prototyp na `VSnackbarQueue` (Vuetify 4.2, `totalVisible`/`displayStrategy`/`timeout`/`closable`) sa správaním zhoduje, vue-tsc bez `@ts-nocheck`. **Ale nie je to čistý drop-in:** e2e helpery adminov selektujú `.v-alert`/`.v-alert__close` (48+10 hitov) → treba nechať markup VAlert vnútri `text` slotu; queue nepustí `class`/`style` na snackbary. Bonus (nezávislý fix): `showApiValidationError` dnes zlomí riadky do jedného (`white-space: pre-line`). Patch `item1-vsnackbarqueue-prototype.patch`.

## F9 — webfontloader, uuid · TEST
- **webfontloader** (posledné vydanie 2017) len v `plugins/webfontloader.ts` (`loadCommonFonts()`, volajú všetci). Náhrada: injektnúť `<link …css2?family=Roboto:wght@300;400;500;700;900&display=swap>` (otestované, FOUT rovnaký, rovnaké Google hosty). Zmazať `@types/webfontloader`.
- **uuid** (`utils/generator.ts`, `@ts-ignore`): `generateUUIDv1` len na list keys. Náhrada: 10-riadkový generátor s fallbackom na `getRandomValues` — `crypto.randomUUID()` chýba na `*.sme.local` dev hostoch (nie secure context), preto nie čistý `randomUUID`. `generateUUIDv1`→deprecated alias v4. Patch `item2-uuid-fonts.patch`.

## F10 — Dark mode · TEST
- 4 reálne kontrastné problémy (namerané WCAG): caret vnoreného list editora `ANestedSortableListEditor.vue:1998` (1.12:1), badges `listEditor/styles/_tokens.scss:18-27` bez dark variantu (success 1.5:1, warning 1.79:1), card border (1.03:1), add-bar autocompletu `Author/KeywordRemoteAutocompleteWithCached` (biely pruh v tmavom menu). Harmless (overené): `v-chip #adadad` (pod 12 % vrstvou 14:1), `#505050` ikony nad opaque placeholderom, `#ccc` AssetImage, FiltersSelected (má dark override). Návrh: dark varianty pre list editor a theme surface pre add-bar.
