# B — Breaking zmeny pre 2.0.0 (detail)

Podklady: `batch2/breaking-out/` — `codemod.mjs` (B4, B5, B6, B7), `b9-acl-import-codemod.mjs`, `b10-codemod-i18n.mjs`, dry-run diffy per admin, `changelog-breaking-draft.md`, `migration-checklist.md`, `b2-static-config-design.ts`. Dopad je počet súborov/miest v adminoch. Odhad migrácie spolu: cms ~4 h, ugc 3–4 h, dam ~3 h, forum 1,5 h, blog/inhouse ~1 h.

---

## B1 — Zmazať deprecated aliasy `ANestedSortableListEditor` · ČÍTANIE
- **Kde:** `ANestedSortableListEditor.vue:1451-1485`, `defineExpose:1530` — `addAfterId`, `addChildToId`, `removeById`, `updateData`, `resetDirtyBaseline`, `clearUnsavedState`, `hasUnsavedChanges`. Verejný typ `ExposedNestedListEditorHandle`.
- **Prečo:** rieši stratu dát A10d. Jediný konzument cms `LinkedListManage.vue:44-48,103,111,172`. Ak ostanú, sú API celej 2.x.
- **Pozor pri portovaní:** `addChildToId` pridáva na začiatok, `addChild` na koniec; exposed `commit` musí čistiť aj `movedKeys`; handle nemá `expand` (cms migrácia to potrebuje).
- **Odhad:** knižnica 2–3 h (50 test/playground referencií), cms 0,5 h ručne.

## B2 — Neexportovať zapisovateľné stores · ČÍTANIE
- **Kde:** `useDamConfigStore` (ugc 3 súbory, dam 17 len čítanie), `useImageStore` (cms 1, ugc 2). Ugc ich plní ručne (~50 riadkov ×3): `admin-ugc/.../ImageWidget.vue:94-145`, `ImageWidgetMultiple.vue:69-120`, `AssetList.vue:59-113`.
- **Prečo ugc kopíruje widgety:** DAM-user check bez vypnutia, neforwardovaný slot, chýba `AAssetList`.
- **Návrh:** `coreDam.configs[name].staticConfig`, read-only `useDamConfig()`, nový `AAssetList`; knižnica resetuje image store sama (rieši A2). Dizajn `b2-static-config-design.ts`, ugc diff `b2-ugc-migration.diff`.
- **Odhad:** knižnica 1–1,5 d, ugc 2–3 h, dam 1–2 h, cms 5 min.

## B3 — `useCollabState()` bez `collabSocket` · ČÍTANIE
- **Kde:** `collabState.ts:59-68`. cms číta len `collabReconnecting`, `gatherBufferData`, `collabFieldDataBufferState`, `collabRoomInfoState` (+ zapisuje `collabFieldDataBufferState`).
- **Dopad:** ~20 socket typov (`lib.ts:1061-1093`) vypadne z API, žiadny admin ich nepoužíva. `fetchCachedUsers` typ opraviť (4 zbytočné casty). Collab používa len cms — zvážiť presun, ale `./collab` subpath netreba.
- **Odhad:** 2–3 h, 0 v adminoch.

## B4 — Zrušiť re-export `useI18n` · REPRO
- **Kde:** `lib.ts:207`/`1105`. 84 súborov v adminoch importuje z knižnice, 2159 z `vue-i18n`.
- **Codemod:** 84 súborov, 0 ručne, výstup re-parsuje. Jediný neoxfmt-clean súbor dam `plugins/vuetify.ts` rieši aj tak B10.

## B5 — Premenovania + A-prefix · REPRO
- **Kde:** `ImageWidgetUploadConfig`→`…Key` (ugc 3; s B2 sa stane interným), `SystemScopeSymbol`/`SubjectScopeSymbol`→`…Key` alebo `useSystemEntityScope()` (cms 2, forum 1), preklep súboru `imageWidgetInkectionKeys.ts`, A-prefix pre 10 `Dam*` komponentov (25 admin súborov).
- **Codemod:** 114 miest / 31 súborov, 0 ručne. Kľúče používajú `Symbol.for`, deprecated alias = 1 riadok.
- **Nepremenúvať:** `createFilterStore` (245 súborov), `useTheme`, dvojité `*TypeType` (kozmetické), `MakeFilterOption` (244 súborov).

## B6 — Zjednotiť emits · REPRO
- **Kde:** 32 emitov s `on` prefixom (výsledok `onOnClose`), z toho len 15 verejných (7 komponentov). Mix kebab/camel.
- **Codemod:** 316 miest / 204 súborov, všetko `@on-x` forma, 0 ručne. Zmena kebab→camel v deklaráciách nerozbije šablóny (Vue normalizuje), zmení sa len 13 knižničných testov.
- **Props NIE (aditívne, 2.x):** doplniť chýbajúce props je aditívne; `v` vs `validationScope` sú rôzne koncepty; `value` je správne na display komponentoch; `readonly` väčšinou nie je deklarovaný prop (265 miest ide do Vuetify root). Bonus nález (funkčný, patrí do A): `:v` na `AFormSwitch` sa ignoruje (A16).

## B7 — Staré typy · ČÍTANIE
- **Kde:** `SortableNested`, `SortableNestedItem`, `SortableItemWithParentDataAware` (`lib.ts:816-819`) — starý tvar stromu, používa len cms linkedList; nový je `NestedTree`/`NestedTreeNode`. `FilterStore` (`filterFactory.ts:601`) je štruktúrou totožný s `FilterData`.
- **Návrh:** staré presunúť do cms, `FilterStore` zmazať. `SortableItemDataAware` ostáva exportovaný (31 cms súborov).
- **Codemod:** cms 16 miest / 4 súbory.

## B8 — Závislosti vo verejných typoch · ČÍTANIE
- **CancelToken:** `UploadQueueItem.latestChunkCancelToken: CancelTokenSource` → `AbortController` (14 použití v 5 súboroch; dam používa `CancelToken` aj priamo — 6 súborov).
- **dayjs typy:** `dateDiff`, `dateToUtc` vystavujú `QUnitType`/`dayjs.ConfigType` v d.ts → vlastné uniony.
- **`v?:any`:** 10 komponentov → minimálne rozhranie (`$touch`, `$errors[].$message`, `$path`, `$invalid`, `$error`, `required?.$params.type`). Pripravuje G1.
- **Aditívne (2.x):** generický `useAnzuUserActions<TUser>` (8 castov), generický `Permissions<TAcl>` (5 adminov), `generateDatatableMinMaxSelectStrategy` typ (11 castov), `useRouteHistory` typ (TS2589).

## B9 — `Acl` typovanie · REPRO
- **Kde:** plugin registruje `Acl` globálne, ale nie je v `GlobalComponents`. Všetkých 6 adminov ho deklaruje ručne; blog/forum `plugins.d.ts:4` importujú `AclValue`, ktorý neexistuje → `requiredPermissions: any[]`. Augmentácia `AclValue` v adminoch je duplicitný identifikátor (TS2300, skrytý `skipLibCheck`) → ako ACL prejde akýkoľvek string.
- **Návrh:** pridať do `GlobalComponents` (`declare module 'vue'`) + `AclRegistry`; alebo prestať registrovať globálne. Codemod importu 115 súborov, 0 ručne.

## B10 — Jedna i18n inštancia · ČÍTANIE
- **Kde:** komponenty používajú `useI18n()` (inštanciu admina), ale `alerts.ts`, `uploadService.ts`, `formatAndSizeCheck.ts` + 16 modulových väzieb `const {t}=i18n.global` (14 validátorov, `damNotifications.ts:11`, `commonAdminCoreDamOptions.ts:6`) používajú singleton knižnice. Každý admin ručne synchronizuje oba stromy; `modifyLanguageSettings().setLanguage` aktualizuje len jeden. Admini majú 41 vlastných väzieb na singleton. Spready správ sú plytké, ugc nemôže rozšíriť `error`.
- **Návrh:** `app.use(plugin, { i18n })`, singleton zmazať; `mergeCommonMessages('sk', appMessages)` deep-merge; `commonPluralRules`; typed keys `CommonMessageKey` pre props `*T` (13 mien).
- **Odhad:** knižnica ~5 h, cms 1,5 h, ostatní 0,5–1 h. Typed keys + merge adopcia v 2.x.
- **Podmienky (vlastník, 2026-09-26):**
  - Singleton vznikol preto, lebo preklady knižnice inak neboli preložené alebo nereagovali na zmenu jazyka. Pred zmenou treba funkčný test: admin prepne jazyk a zmenia sa preklady admina aj knižnice (komponent, validátor, alert). Test napísať na dnešnom stave, zmena len ak po nej ostane zelený. Validátory a ďalších 16 miest čítajú `t` pri importe (`b10-i18n-global-sites.md`), tie musia prejsť na čítanie pri volaní — test ich musí pokryť.
  - cms má tretiu inštanciu `src/shared/i18nContent.ts` zámerne: prekladá obsah editora podľa jazyka obsahu, nie UI. B10 ani codemod sa jej nesmú dotknúť.

## Changelog a checklist
`batch2/breaking-out/changelog-breaking-draft.md` (sekcia Breaking v štýle `2.0.0.md`) a `migration-checklist.md` (poradie codemodov + ručné položky per admin).
