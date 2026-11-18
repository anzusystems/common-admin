# C — Balík a typy (detail)

Podklady: `batch2/dts-out/` (library.diff, admin-eslint.config.diff, cms-tsc-new.txt, build-times.txt, size.txt), `batch3/info/out/` (item2/3/4/6 patche a merania).

---

## C1 — d.ts po moduloch · TEST ✓
- **Problém:** bundlovaný `dist/common-admin.d.ts` má 80 chýb — 79 odkazov na nedeklarované `__VLS_*` v slot typoch (40 komponentov: ACard, ARow, AFormTextField, AFilterWrapper, ADatetimePicker…) + 1 `MessageSchema`. Admini majú `skipLibCheck`, takže ich slot props sú potichu `any`. Príčina: vue-tsc zapíše `declare var __VLS_13`, api-extractor ju pri bundlovaní zahodí; navyše 358 číslovaných interných mien, go-to-definition končí v 13,5-tis. riadkovom súbore.
- **Oprava:** `bundleTypes: false` + `insertTypesEntry: true`. Výsledok: 565 d.ts po moduloch, **0 chýb v `dist/`**, build CPU 44,7→36,1 s, go-to-definition do `dist/components/ACard.vue.d.ts`, odpadne `@microsoft/api-extractor`. Augmentácie `GlobalComponents` (ABtn*, Acl, `dataCy`) presunúť do modulov, ktoré `lib.ts` re-exportuje, cieľ `declare module 'vue'`; vylúčiť playground v `tsconfig.libdts.json`; nový export `globalComponentNames` z `./eslint` + test proti driftu.
- **Dopad na adminov:** `vue-tsc --build --force` — ugc 0→0, **cms 0→1** (`users-new/[id]/edit.vue:201`, knižničný typ je správny, jednoriadková úprava v admine), blog/forum/inhouse/dam 0→0.
- **Podmienka:** eslint config adminov číta `commonAliases` regexom z bundlu — s per-module d.ts spadne. Náhrada `globalComponentNames` (D7) musí ísť v tom istom kroku ako bump na 2.0.0. Diff `admin-eslint.config.diff`, otestované v ugc.
- **Veľkosť:** tgz 1,45→1,52 MB; declaration súbory 2→496 (216 z nich interné, neškodné).
- **Riziká:** `AFormTextarea.vue.d.ts` importuje hlboko `vuetify/lib/.../VCounter.mjs`; `@vueuse/shared` v 15 d.ts (viď C3).

## C2 — `copyPublicDir:false` + css.d.ts z pluginu · TEST
- **Problém:** lib build kopíruje `public/` do `dist/` — favicony, mstiles, `site.webmanifest`, `browserconfig.xml`, `safari-pinned-tab.svg`, `playground/cropper-*.png` (~137 KB v npm balíku). `common-admin.css.d.ts` je v `public/`, preto tam `public/` ostáva.
- **Oprava:** `copyPublicDir: false`, css.d.ts presunúť do `types/` a emitovať malým pluginom (`generateBundle`). Overené: `dist/` má 19 položiek bez faviconov, `./styles` typy sa resolvnú (bez súboru TS2882). Patch `item3-copyPublicDir.patch`.

## C3 — Peer dependencies · TEST
- **Zistené:** `socket.io-client` je v builde external a d.ts ho importuje (`:20,:38`), ale nie je peer (má ho len cms). `@vueuse/shared` presakuje do d.ts (`Fn`, `Promisify`, `RemovableRef`, `UseDebounceFnReturn`), nedeklarovaný, funguje len vďaka hoistingu. `@mdi/font` nie je deklarovaný, pritom 97 ikon v 228 miestach. Spodné hranice peers sú staršie než testované; celá sada prešla so všetkými na spodnej hranici, ale vue-tsc hlási TS2882 na `vuetify/styles` pod 4.0.5.
- **Návrh:** `vuetify ^4.0.5`; pridať `@mdi/font ^7.4.47`; `socket.io-client ^4.8.0` optional peer; `@vueuse/shared` buď anotovať návratové typy z `@vueuse/core`, alebo deklarovať. Ostatné (vue ^3.5.27, vue-router ^5.0.1, vue-i18n ^11.2.8, pinia ^4.0.2, axios ^1.13.4, dayjs ^1.11.19) nechať.

## C4 — Zatúlaný `src/labs/api/package.json` · ✓
- `npm init` leftover (`"name":"api"`, PR #212). Pre 10 modulov v `labs/api/` je to najbližší package.json → bundlery ho môžu brať namiesto koreňového. Do `dist/` sa nedostane. Zmazať.

## C5 — CI (lint/test/build) · ČÍTANIE ✓
- **Problém:** `ci.yml` spúšťa len lint a testy, build je až v release workflowe → chyba d.ts (C1) sa na PR nezachytí.
- **Návrh:** build job + `tsc --skipLibCheck false` nad vydaným d.ts (počítať len chyby v `dist/`, Vuetify/vueuse majú pod strict ~630 vlastných); `concurrency` s cancel-in-progress; `timeout-minutes`; `playwright install-deps chromium` vždy (pri cache hite sa OS deps preskočia); api-extractor `apiReport` commitnutý + CI fail pri zmene → každý PR ukáže zmeny verejného API. Script `prepare` Yarn 4 nespúšťa.

## C6 — Vue 3.6 rc.9 · TEST
- **Zistené:** `^3.5.27` prijme 3.6.0 automaticky. V kópii s node_modules symlinkovanými okrem `vue`/`@vue/*` (rc.9): vue-tsc na app aj test tsconfig **0 chýb**, celá sada **1484/1484 testov** prejde. Cold-start zlyhanie 3 súborov bolo z Vite pre-bundlingu, rerun prešiel — harness, nie Vue.
- **Návrh:** nechať `^3.5.27`, pridať CI job proti rc pred vydaním. Nekontrolované: Vue warnings medzi 3.5 a 3.6.
