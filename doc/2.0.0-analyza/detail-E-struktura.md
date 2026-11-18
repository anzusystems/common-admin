# E — Štruktúra (detail)

Podklady: `batch2/restructure-out/` (move-report.json, mapping-expanded.tsv, build-compare.txt, git/diff-summary.txt), skript `batch2/restructure-tools/`.

---

## E1 — Reštrukturalizácia priečinkov · REPRO (dry run)
- **Problém:** `labs/` už nič neznamená — všetkých 132 súborov je exportovaných z `lib.ts`, importuje sa oboma smermi (318 labs→zvyšok, 91 opačne). `exports` vystavuje len entry pointy, takže interné cesty nie sú verejné API a presun konzumentov nerozbije.
- **Návrh:** plochý layout podľa domén — `api/`, `core/` (utils, types, validators, plugins, errors), `system/`, `cached/`, `ui/` (ACard…, buttons, datetime, form, view, file), `filters/` (+ datatable, bookmarks), `listEditor/`, `subjectSelect/`, `unsavedGuard/`, `auth/` (+ Acl), `anzuUser/`, `permission/`, `job/`, `log/`, `dam/` (api, config, types, assetSelect, assetDetail, uploadQueue, imageWidget, cropper, author, keyword, user), `collab/`, `customDataForm/`, `playground/`, `test/`.
- **Overené (dry run):** skript presunie 608 súborov (88 bez zmeny obsahu), prepíše 3050 importov v 587 súboroch. Po presune prejdú vue-tsc, oxfmt, oxlint, eslint, stylelint, node testy 47, browser 1484, build. **Exporty rovnaké (374), `common-admin.d.ts` byte-identický, 791/791 JS modulov identických po normalizácii ciest, CSS rovnaké pravidlá aj poradie, lazy chunky zachované.**
- **Vynútené premenovania (5):** `labs/filters/datatableColumns`→`createDatatableColumnsConfig`, `userAdminConfig.ts`→`userAdminConfigApi.ts` (case kolízia TS1149), `imageMassOperations.ts`/`uploadQueueDialog.ts`→`use…` (kolízia s `.vue`), `router/playground.ts`→`playground/router.ts`.
- **Pozor:** upraviť `eslint/plugin.mjs:4` (hardcoded `labs/api/useApiRequest`), nemeniť localStorage kľúče `labsAnzuUser_*`/`labsPermissionGroup_*`, Sentry raz pregrupuje issues (2.0.0 aj tak mení dist layout).
- **Git:** rename detection 605/608, medián podobnosti 93 %; pod 50 % len `useValidate.ts`, `AssetLicence.ts`, `AssetLicenceGroup.ts` (`--follow -M30%` ich nájde).
- **Odporúčanie:** jeden move-only commit (builduje sa → bisect funguje) pred rc, hash do `.git-blame-ignore-revs`, refaktor až potom. Ručne: ~40 rozhodnutí o umiestnení, ~150 ciest v docs. Odhad ~1 deň.

## E2 — DAM cykly · TEST
- **Kde:** `damAssetApi.ts` → `damConfigState.ts` → `damAssetCustomFormApi.ts`/`damConfigApi.ts` → späť, uzatvára len konštanta `SYSTEM_CORE_DAM` (22 modulov ju importuje z 377-riadkového API súboru). `uploadApi.ts:12` → `uploadQueuesStore` → `uploadService` → `uploadApi`.
- **Oprava:** `SYSTEM_CORE_DAM`/`SYSTEM_DAM` do `dam/damConstants.ts` (26 importérov), `uploadApi` bez store (3 callbacky). 31 súborov, +84/−46; oba cykly preč, `common-admin.d.ts` aj CSS ostanú identické. Overené v `restructure-step2`.

## E3 — Mŕtvy kód · ✓
- **Súbory:** z 692 je dosiahnuteľných 499, 191 testy/playground; nedosiahnuteľné len 2 playground helpery v lib priečinkoch (`components/TestRouteSwitch.vue`, `plugins/vuetify.ts`) → do `playground/`.
- **Exporty:** 104 nikto neimportuje (väčšinou typy len vo vlastnom súbore); naozaj mŕtve: `parseBoolean`, re-export `initCommonAdminCollabOptions`, `isCollabOccupiedAccessRoomCallback`, `ADamKeywordCreateValidationScopeSymbol`, `JobStatusType` (loginStatus), 13 `collab*EventBusKey`, 2 typy vo `Vuetify.ts`.
- **i18n:** 45 kľúčov mŕtvych všade (hlavne `common.sortable.*`, `*.meta.*`, `userSystem.table.*`, `damImage.keyword.*`, `*.assetType.*`). Pozor na dynamické kľúče (`${system}.${subject}.filter.*` a pod.) — 47 ďalších sa staticky dokázať nedá; namespace používané len adminmi (`routeSettings.help.*`, `dayOfWeek.*`, `confirmDialog.*`) zdokumentovať ako verejné API.
- **CSS:** nepoužité triedy (`line-clamp-3/4`, `white-space-pre`, `image-loading-effect`+`shimmer`, `v-toolbar--custom-tiny`, `dam-image-detail__image`…).

## E4 — Migračný dokument · ✓
- `doc/API-HELPERY-MIGRACIA.md` je vykonaný (legacy api helpery preč, jeden `useJobApi`, mapovanie chýb na jednom mieste). Označiť ako historický.

## E6 — Po 2.0.0 (2.x)
- List editory (`ANestedSortableListEditor.vue` 2160, `ASortableListEditor.vue` 2031, `AListEditor.vue` 1116, ~320 spoločných riadkov) → `useListEditorShell`.
- DAM widgety (`ImageMediaWidgetInner` 1003, `ImageWidgetInner` 836, 335 spoločných) → `useImageWidgetCollabLock`/`useImageWidgetActions`. `AAssetSelectMedia` je 94 % kópia `AAssetSelect` (rozišla sa) → mode prop.
- `filterFactory.ts` (603) rozdeliť; `AUserSystemOverview.vue` (705) handlery do composable; `uploadQueuesStore.ts` (546) oddeliť front od orchestrácie.
