# admin-cms merge b9cb70012: does the code from develop-beta follow what `next` changed?

Repository `/home/volar/projects/petit/admin-cms`, branch `next`, working tree clean at `b9cb70012`.
Merge base `37cd8f352`; `next` parent `f7d77800b` (124 commits since the base); develop-beta parent `f008b3068`
(50 commits, 147 files, 24 of them new). The merge changes 150 files against `next`: the base's 147 plus the
2.0.0 changelog line and two test mocks. Nothing was run that builds or tests; read-only lint/format runs only
(section 4).

## 1. `next`'s systematic changes checked against

From `git log 37cd8f352..f7d77800b` (commit bodies of bcfb65003, c1e7f0535, 319f2a29c, 2f14df5eb, 5109b7902,
c76e67edc, 50150a1d7, f1e48cdf1, 0f8cf879e, 021687afd, 0ebffb32b, c1ab62111, b9245820b, 2b0980df3, 57de1e17d,
54f3281b0, 8cee24296, 164ba0eb1, 757c277e0), `doc/Admin-Cms-Changelog/Unreleased/2.0.0.md` and common-admin
`doc/changelog/2.0.0.md` "Changed — migrating an admin":

1. Explicit imports, no auto-import (vue, vue-router, pinia, vue-i18n, vuelidate, common-admin helpers and types,
   `src/shared/*`); imported prop types are now validated at runtime in dev.
2. `@anzusystems/common-admin/labs` gone; everything from the main entry.
3. 2.0 api helpers: `execute` with `body`, `useApiFetchList(pagination, filterData, filterConfig)`,
   `useApiFetchItems` for bare arrays (`anzu/prefer-api-fetch-items`), `useApiCommand`.
4. Sorted imports (oxfmt `sortImports`), top-level `import type`, no new import cycles (12 before/after).
5. Components imported, never through the plugin's global registration (`AChipNoLink`, 8cee24296);
   `ABtn*` and `Acl` stay global.
6. Emits without `on` (`ADialogToolbar @cancel`, ...), `Dam*` -> `ADam*`, removed utility classes.
7. ACL: every action gated by the key its endpoint checks (021687afd), TODO(BE) where core-cms is wrong.
8. Record pages: `useRecordPage`, `handleRecordLoadError`, `usePageNavigation`/`onPage()`; the article's
   secondary reads take `isStale` and write nothing once the page is left (0f8cf879e), pinned by
   `src/test/articleStaleHelpers.test.ts`.
9. Tracking fields through `CoreTrackingFields`; updates copy the answer's tracking (`syncUserAndTimeTracking`).
10. Collab: a `:collab` field never binds `disabled` to `false` (0ebffb32b, `src/test/collabFieldLock.test.ts`);
    a field that takes its own lock re-acquires it (`collabFieldReacquire.test.ts`).
11. Filters v2 (`createFilter`/`createFilterStore`), `usePagination`, `defineModel`, `AActionCloseButtonHistory`,
    breadcrumbs, unsaved-changes guard and list editor labels, no `:v` on plain `VSwitch`.
12. Article links by docId (`ArticleByDocIdChip`, `/(cms)/articles/[docId]/[[version]]`).
13. Editor out of the first view (`src/test/layouts/editorAtStart.test.ts`).
14. i18n: sk/en key parity and order, sk.ts/en.ts in the same order, English UI says "Media Library" not "DAM"
    (2b0980df3), leftover English values in Slovak translated (57de1e17d) unless no Slovak term exists
    (54f3281b0), no vue-i18n special characters in messages.
15. Config templates `config.json.dist` and `.cf.dist` mirror each other, `damUploadLicence` unquoted.
16. Vuetify 4 / MD3 typography (`text-body-small`, `text-label-large`, ...).
17. Tests: guard tests per convention, mocks follow what a component reads.

## 2. Findings

High: none. Medium: none. Low: 4.

### L1. Four new English labels say "DAM" (misses 2b0980df3, "Media Library in the English UI")

`src/locales/en/cms/contentHubAutomat.json:37-40` — `damVideoAuthor` "DAM video author", `damVideoAuthorHint`
"Video author in DAM, ...", `damVideoDistributionService` "DAM video distribution service",
`damVideoDistributionServiceHint` "DAM distribution service, ...". After the merge these six lines (with :34-35,
which the 2026-10-07 develop merge brought) are the only "DAM" left in `src/locales/en`.
Editor sees: in English, the content hub automat form and detail say "DAM" while every other screen says
"Media Library". Slovak keeps "DAM" by the same rule, so `sk` is fine.
Fix: "Media Library video author", "Video author in the Media Library, e.g. BANG Showbiz; required when taking
over video", "Media Library video distribution service", "Media Library distribution service, e.g. jw_cms;
required when taking over video"; the same for :34-35.

### L2. English values in the new Slovak lists (misses 57de1e17d / 54f3281b0)

`src/locales/sk/cms/articleKind.json:466-483` (`aiClassification.articleFormat`): "Explainer", "Fact Check",
"Editorial", "Obituary", "Live Coverage", "Special Report", "Press-Digest", "Preview", "Retrospective",
"Portrét/Feature", "Listicle/Prehľad", next to translated "Správa", "Analýza", "Reportáž", "Recenzia",
"Rozhovor". The same file already has "Náhľad" for a preview (:44). :454-461 (`userNeed`) are all English
("Update Me", ...). :410 `fromAiHint` "Evergreen a životnosť ..." while the field it names is
"Nadčasový obsah" (:405).
Editor sees: English labels in the Slovak AI classification widget (article detail and edit) and in the desk
analytics tabs and series.
Fix: translate where Slovak has the term (Nekrológ, Úvodník, Retrospektíva, Náhľad/Ukážka, Overenie faktov,
Špeciálna reportáž, Live prenos, ...), "Nadčasovosť a životnosť ..." in the hint. Owner's call for the user-needs
model names, which may be kept in English on purpose.

### L3. The new article read is not pinned by the stale-load test (misses next's test convention for #8)

`src/domains/cms/article/composables/articleEditActions.ts:172` `fetchArticleAiClassification(docId, isStale)`
follows `fetchArticleMultiTitles` exactly (checks `isStale()` after the answer and in the `catch`), and both
loaders pass `left` (`articleDetailActions.ts:91`, `articleEditActions.ts:318`). But
`src/test/articleStaleHelpers.test.ts` pins the contract only for the multi titles (:46) and the related entities
(:84), and the two page tests stub the new read out (`articleDetailLeftDuringLoad.test.ts:43`,
`articleEditLeftDuringLoad.test.ts:33`). The 2.0.0.md line the merge added claims the read "writes nothing once the
page is left"; no test would notice a regression.
Editor sees: nothing today.
Fix: an "AI classification" `describe` in `articleStaleHelpers.test.ts` with the same three cases (lands for the
page that stayed; leaves `aiClassification` alone once gone; fails silently once gone), mocking
`useFetchArticleMetadata` the way the file mocks `useFetchArticleMultiTitleList`.

### L4. The whiteboard lock test mocks the ACL key the component no longer reads

`src/test/inboxWhiteboardLock.test.ts:64` mocks `ACL: { CMS_INBOX_UPDATE: 'u' }`; the component now reads
`ACL.CMS_INBOX_WHITEBOARD_UPDATE` (`src/domains/cms/distributionManagement/components/InboxWhiteboardBox.vue:72`),
which is `undefined` in the mock. The test passes only because the mocked `can` ignores its argument.
Editor sees: nothing.
Fix: `ACL: { CMS_INBOX_WHITEBOARD_UPDATE: 'w' }` in the mock (optionally a case that a `can` refusing that key
keeps Edit off and closes an open edit, which is the base's new `watch(canEdit)` at :179).

## 3. Checked and fine

- Nothing of the base was lost. Every line the base added is in the merge or replaced by its adaptation
  (old import lines, `executeRequest`/`executeFetch`/`object`, `/labs`, `DamAssetLicenceRemoteAutocomplete`,
  a reformatted template). Every line the base removed is gone except ones still used elsewhere in the same file
  (`required,` in two validation files, `</AChipNoLink>` in the two takeover tables). No line `next` added is
  missing except where the base's change replaces it on purpose (widened import lines, the multi-title `await` now
  inside `Promise.all`, the old takeover detail rows now `TakeoverDetail`); nothing `next` removed came back (the
  flagged lines are duplicates still used elsewhere in the same file). The base touched no file `next` deleted or renamed.
- Explicit imports: no auto-imported name (vue, vue-router, pinia, vue-i18n, vuelidate, the 25 common-admin helpers,
  the 9 types, the `src/shared/*` exports) is used without an import in the 98 touched source files; every template
  component is imported (only `V*`, `ABtn*`, `Acl` global); every named import resolves to an export (local modules
  and the installed common-admin 2.0.0-rc1 `dist/lib.d.ts`); no unused import.
- api helpers: no `executeRequest`, `executeFetch`, `object:` or `common-admin/labs` left in `src`.
  `fetchArticleAiClassification` and the desk analytics call `useApiFetchItems().execute({ body })`;
  `ScenarioJobVerdictTable.vue` calls `useApiFetchList().execute(pagination, filterData, filterConfig)` through
  `useFetchScenarioJobListByResource` (signatures checked against the installed `.d.ts`).
- Article AI classification: read beside the multi titles with `left`, related entities after it, `reset()` clears
  it, the widget shows only when there is one; the endpoint checks the resource read permission
  (core-cms `ScenarioJobController.php:42`) for the verdict table, so no extra gate is needed.
- ACL: `cms_inbox_whiteboardUpdate` gates the one endpoint that checks it; no other new action needs a key.
- Record pages / navigation: the base adds no page, no redirect and no record load; `desks/[id]/dashboard.vue`
  keeps `next`'s `definePage` path, `useRecordPage` signal and `replace`, and only adds the analytics' site group.
- Tracking: takeovers have time tracking only (core-cms `AbstractTakeover.php:26-29`), so `TakeoverDetail.vue`
  showing dates without users matches `next`'s own dialog; automat updates keep `syncUserAndTimeTracking` and copy
  the quota usage after it.
- Collab: the new "Take from AI classification" switch has no `:collab` (it broadcasts `recommender.manual` itself,
  as `next`'s other widgets do with `useCollabField`), so its `:disabled="readonly"` overrides no lock; the
  `:collab` fields beside it keep `|| undefined`; `collabFieldLock`, `collabFieldReacquire` and
  `articleCollabFieldKeys` tests do not see anything new to flag.
- Emits, classes, props: `ADialogToolbar @cancel` in both takeover dialogs; no `@on-*` on common-admin components
  (`@on-confirm` in `EmbedTimelineDialog.vue:78` is the admin's own `TimelineSelectTable` emit); no removed utility
  class, no `:v` on plain `VSwitch`, MD3 typography only; `TakeoverDetail`, `ScenarioJobVerdictTable`,
  `DeskAnalyticsDashboard`, `ArticleByDocIdChip` and `RubricRemoteAutocomplete` get only props they declare.
- Links: the takeover detail links the article through `ArticleByDocIdChip` (docId route, new tab).
- Filters/pagination: `useScenarioJobListFilter` is `next`'s `createFilter`; `usePagination(SORT_BY_ID)`.
- i18n: every static `t()` key in the touched files exists in sk and en (dynamic-prefix keys excepted); datatable
  column titles resolve (`cms.<entity>.model.<key>`); sk and en have the same keys in the same order in all 19
  touched locale files; `takeoverAutomat`/`takeoverDetail` sit at the same place in `sk.ts` and `en.ts`; no vue-i18n
  special characters; the removed `internalTakeover.model.producedArticleDocId`/`sourceLanguage` are read nowhere;
  no e2e spec reads a text the base changed.
- Config: `senderPrefill` in both templates and `.env`, `damUploadLicence` stays unquoted in `config.json.dist`.
- Editor at start: a re-implementation of `editorAtStart.test.ts`'s static walk over `b9cb70012` finds no path from
  the five entries to the editor or TipTap/ProseMirror/yjs (sanity: minute management does reach it).
- Import cycles: 12 strongly connected components with 106 modules in both `f7d77800b` and `b9cb70012`.
- Formatting and lint, run read-only on the 98 touched files: oxfmt (admin `.oxfmtrc.json`, stdin mode) changes
  nothing (control: it does reorder the base's own versions); oxlint with the admin config exits 0; eslint (shared
  config, `vue/no-undef-components`, `anzu/*` on) exits 0.
- Changelog: the added 2.0.0.md line matches the code (including "the related entities still follow them").

## 4. Outside the question (not counted)

- The local, gitignored `public/config.json` here has no `cms.newsletter.senderPrefill`;
  `src/shared/EnvConfigService.ts:161-162` reads it without a fallback and `:225` turns that into
  "Unable to load env config", so this checkout's admin does not start locally until the key is added by hand
  (as 757c277e0 did for `damUploadLicence`).
- Carried from develop-beta as it was: `doc/Admin-Cms-Changelog/.order` lists 1.108.0 and 1.107.0 but not 1.106.0
  (f6ac87e73 added the file only); `src/domains/cms/timeline/components/TimelineDetail.vue:61-62` prints
  `showFullEventDates` as raw `true`/`false` instead of `ABooleanValue`.

Scripts and outputs: `/home/volar/projects/anzusystems/krok5-praca/pracovne/overenie-merge-cms/`.
