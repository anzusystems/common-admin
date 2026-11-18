# admin-inhouse: merge 7b8ecc04 (origin/develop into next) checked against next's way

Reviewed: `7b8ecc04` = merge of `319fc025` (next) and `a2ae4342` (origin/develop), merge base `1ef7a314` (2.13.0). Develop brought 9 commits: international days (released in 2.14.0), vaccination age groups and articles (#86986), the name day country (#87017) and the create-dialog fix of 11 existing sections.

Read-only review. I ran no tests, type check, lint or build; the merge agent's logs (`krok5-praca/pracovne/merge-inhouse/test.log`: 23 files, 696 tests passed; `fmt.log` clean; `tsc.log`, `eslint.log`, `stylelint.log` hold no output) are taken as reported.

Method: every new file side by side with nameday and schoolHoliday at next; every develop component and composable of the three sections diffed against its merged counterpart (template, and script with imports stripped); each systematic next commit looked up in its nameday/schoolHoliday diff; common-admin 2.0.0-rc1 (installed in `admin-inhouse/node_modules`, same version as the repo) read for every component the new code relies on.

## next's systematic changes checked against

1. Layout `src/domains/<domain>/<entity>/{api,components,composables,factory,filter,store,types,valueObject}`; file-based pages in `src/pages` with `definePage({ path: '…/:id(\\d+)', meta: { requiresAuth, requiredPermissions, systemAccess, layout } })`; typed route names instead of `ROUTE` constants (7c369870, ac9db70d, 4089962c).
2. Explicit, sorted imports from the main `@anzusystems/common-admin` entry (b1a04372, a8be95eb, 25415b15); `defineModel` (c7392707).
3. API helpers `useApiFetchList` / `useApiRequest` / `useApiCommand`, `execute({ urlParams, body, signal })` (00c0e703, 44fce41b).
4. Filters v2: `createFilter` + `createFilterStore`, provide/inject `FilterConfigKey`/`FilterDataKey`, `AFilterWrapper` with `#search` and `#item.<field>` slots, `useFilterHelpers(filterData, filterConfig)` with `loadStoredFilters`; v1 `contains` mapped to `startsWith`.
5. Datatables: `usePagination` + `DatatablePaginationKey`, debounced `getList`, "most recent / oldest" by `id`.
6. Vuetify 4 MD3 typography (`text-subtitle-1` → `text-body-large`, `text-caption` → `text-body-small`, as in 44fce41b).
7. Shared date picker: `AFormDatetimePicker type="date"`, `dateUtcToday`, read with `dateUtcPretty` (7496419b).
8. Dialog emits without `on` (`@open`, `@success`) (f5104fc0).
9. Close back to where the user came from: `AActionCloseButtonHistory` with fallback and sibling skip names (f4084903, 0f191fec).
10. `meta.systemAccess` on every page, the system's current user loaded on demand (fdea2c7b).
11. Tracking fields: `DailyToolsTrackingFields` in detail and edit form, `syncUserAndTimeTracking` after update (46b18f2e).
12. Record-load errors: `useRecordPage` + `fetchData(id, { signal })` → `handleRecordLoadError` → `leave()` (8dc18153).
13. Redirects through `usePageNavigation().push`, nothing sent after leaving (0e9f4065).
14. Permissions: list `_ui` + `_read`, detail `_read`, edit `_read` + `_update`, sidebar item `can(_ui) && can(_read)` (dc781de6).
15. Create dialog: model reset on open, redirect to a page the user may open.
16. Changelog: `Unreleased/3.0.0.md` (with counts), `.order` generated from the directory (4faea0e3, b553315e).
17. Tests: route, close-button, history and sortable guards from `./testing` (glob/route based); field-name contracts in `src/test/filterContracts.test.ts`.
18. Unsaved-changes guard: next uses none (`git grep useUnsavedChangesGuard 319fc025` is empty), so nothing to apply.

## Findings

### High

None found.

### Medium

**M1. The international day range filter shows no chip and is hidden behind "Viac"**

- Where: `src/domains/dailyTools/internationalDay/components/InternationalDayFilter.vue:36-47` — the custom `dayModel` writes `filterData[name]` and `filterConfig.touched` only; `:71-88` draws the two `ADatetimePicker`s in `#item.dayFrom` / `#item.dayTo`, i.e. inside the panel `AFilterWrapper` shows only after "Viac" (common-admin `src/domains/filters/components/AFilterWrapper.vue:199-227`, `v-show="showDetail"`). Config: `internationalDay/filter/InternationalDayFilter.ts:12-13`.
- next's way it misses: every filter value the user sets puts a chip beside the search field (`FiltersSelected`, `AFilterWrapper.vue:177`; the library's own datetime field does it in its setter, `AFilterDatetimePicker.vue:47-57` → `updateSelected` `:79-88`). Where a narrowing filter would have no chip, next draws it in `#search` so it stays on screen (`src/domains/smsGateway/phoneNumber/filter/PhoneNumberFilter.ts:11-14`, `PhoneNumberFilter.vue` `#search`) and guards that in `src/test/filterContracts.test.ts:31-45`.
- develop: the two day pickers sat in the always-visible second row of the filter (develop `src/views/dailyTools/internationalDay/components/InternationalDayFilter.vue:91-106`; the v1 `AFilterWrapper` always renders its default slot).
- What the editor sees: picks "Od dňa" / "Do dňa" under "Viac" and searches — title, id, category and priority get chips, the days none. Once "Viac" is closed, or on coming back to the list (a submit stores the filter in the URL hash and local storage and the list restores it, common-admin `filterFactory.ts:450-475`), the list is cut to a day range with nothing on screen saying so.
- The admin cannot write that chip itself: neither `FilterSelectedKey` nor `AFilterDatetimePicker` is exported (`node_modules/@anzusystems/common-admin/dist/lib.d.ts:300`).
- Fix: in common-admin, a date-only filter field (`AFilterDatetimePicker` passing `type="date"`, chip formatted with `dateUtcPretty`), then `dayFrom`/`dayTo` render without the two custom slots and get chips like every other next filter. Until then, draw the range where it stays visible, as next does for the phone-number window (`#search`).

**M2. Substring search lost on four fields (inherited from next, not a merge error)**

- Where: `internationalDay/filter/InternationalDayFilter.ts:9` (title), `vaccinationAgeGroup/filter/VaccinationAgeGroupFilter.ts:9-10` (slug, title), `vaccinationArticle/filter/VaccinationArticleFilter.ts:9` (title): `variant: 'startsWith'`. develop: `variant: 'contains'` (develop `src/model/dailyTools/filter/InternationalDayFilter.ts:13`, `VaccinationAgeGroupFilter.ts:13` and `:16`, `VaccinationArticleFilter.ts:13`).
- Why it is next's way: filters v2 have no `contains` (`dist/domains/filters/composables/filterFactory.d.ts:64`); next has no `contains` left where the merge base had 15 (e.g. `nameday/filter/NamedayFilter.ts:12`, `saintsDay/filter/SaintsDayFilter.ts:10`), and says so in `src/test/filterContracts.test.ts:9-11`. `Unreleased/3.0.0.md` does not mention it. v1 sent `filter_contains[…]` (common-admin `1463ce82^:src/types/Filter.ts:27`, `src/services/api/queryBuilder.ts:33`), which the backend accepts (`core-daily-tools/vendor/anzusystems/common-bundle/src/ApiFilter/ApiParams.php:20`).
- What the editor sees: the search finds a title (or slug) only by its beginning; a word from the middle finds nothing. In develop (international days live since 2.14.0) any part of the title matched. International day titles mostly start with the same words ("Medzinárodný deň …", "Svetový deň …" — inferred from the domain, not checked against data), so there the prefix search is close to useless.
- Fix: not in the merge. Either add `contains` to common-admin's `FilterVariant` (the query builder already sends `filter_<variant>[…]`, `useApiQueryBuilder.ts:43-46`) and switch these four fields and next's other former `contains` fields back, or keep the decision and write it into `Unreleased/3.0.0.md` as a change editors will notice.

### Low

**L1. No filter contract test for the new day range.** `InternationalDayFilter.ts:12-13` aims `dayFrom`/`dayTo` at `apiName: 'day'` with `gte`/`lte` — the kind of pair next asserts (`src/test/filterContracts.test.ts:21-28`, the menu item position range: a wrong name "would look like 'the filter does nothing'"). The merge adds no test (`git diff --name-status 319fc025 7b8ecc04` has no `src/test` file). Editor: nothing. Fix: one `it` for `useInternationalDayListFilter` asserting both `apiName`s and variants.

**L2. `Unreleased/3.0.0.md` counts no longer match.** `:23` "23 edit forms", `:24` "the 23 updates", `:86` "All 50 details and edits". With the three sections: `syncUserAndTimeTracking` in 26 files (23 before), detail and edit pages of weather, sms gateway, daily tools and brick (users, permission groups and logs left out) 56 (50 before). Editor: nothing. Fix: update the numbers or name the three sections.

## Checked and fine

- File set: each new section has every file kind nameday and schoolHoliday have (api, components with value-object chips, actions, validations, factory, filter, store, types, valueObject, three pages, locale json, ACL constants, sidebar item, breadcrumbs, `DAILY_TOOLS_UI_ACL`); the existing sections have no per-section tests either. No old-layout file left (`git ls-tree 7b8ecc04 -- src/views src/model src/services src/stores src/types src/router/routes src/composables src/components src/utils` is empty).
- Pages (9): identical to nameday's but for names — `:id(\\d+)` paths, `[_UI, _READ]` / `[_READ]` / `[_READ, _UPDATE]`, `systemAccess: { systems: ['dailyTools'] }`, typed `useRoute`, `useRecordPage` with fallback and sibling skip, `fetchData(id, { signal })` → `leave()`, close-button skips, Edit/Delete/Save under `detailLoading === false`, typed breadcrumbs.
- Actions, api, store, factory, types, validations: line for line as `namedayActions.ts` and `namedayApi.ts` (labs helpers, `handleRecordLoadError`, aborted load leaves `detailLoading` alone, `syncUserAndTimeTracking`, `usePageNavigation().push`).
- No develop logic lost: the template and script diff of every develop component and composable against its merged counterpart shows only next's mechanical changes (emits, route names, filter v2 wiring, `datePretty` → `dateUtcPretty`, `DailyToolsDateField` → `AFormDatetimePicker type="date"`, `utcDateToday` → `dateUtcToday`, `AUserAndTimeTrackingFields` → `DailyToolsTrackingFields` plus the edit-form rows, the two MD3 class renames). The entries editor (add, move up/down, remove with its confirm text, a note clears its url), slug from title, the advert toggle, validations and constraints are unchanged.
- Datatables: columns, chips, ordering options and default sort = option 1 (`usePagination('day' | 'position', SortOrder.Asc)`, what develop's `usePagination(…, false)` meant; common-admin `pagination.ts:26-44`, `ADatatableOrdering.vue:31-34` starts on option 1), debounced, stored filters loaded.
- Day range query (apart from M1): `ADatetimePicker type="date"` emits `YYYY-MM-DDT00:00:00.000000Z` (common-admin `datetimePickerValue.ts:62-65`, `datetime.ts:10`), the format develop's `utcDateOf` produced, sent as `filter_gte[day]` / `filter_lte[day]`; the clear emits `null`, the filter reset clears both.
- Create buttons (11 merged + 3 new): develop's `v$.$reset()` on open and the permission redirect, in next's syntax with `@open`/`@success`. `ACreateDialog` does not reset `v` itself (common-admin `ACreateDialog.vue:48-51`), so the reset is needed. `can(_update) ? edit : detail` always lands on a page the user may open: each create button sits only on its list page, which requires `_read` (`src/pages/daily-tools/*/index.vue:15`).
- Name day country (#87017): type, factory default, value object, chip, create select, read-only row in detail and edit, datatable column, v2 filter field with an `#item.country` slot, validation and locale keys — all of develop's changes, in schoolHoliday's value-object pattern.
- Sidebar (`SidebarDailyToolsItems.vue:33-50`): `can(_UI) && can(_READ)`, typed route names, develop's order and data-cy; it also draws the `/daily-tools` landing page.
- Locales: the three new json files and the nameday additions are identical to develop's; `sk.ts` imports sorted; breadcrumb and sidebar keys added; filter labels and column headers resolve (`<system>.<subject>.filter|model.<field>`).
- `auth.ts`: the 15 ACL constants and the three `_UI` entries of `DAILY_TOOLS_UI_ACL`, as develop.
- Changelog: `2.14.0.md`, `.order` (2.14.0 on top), `Unreleased/86986.md` and `87017.md` carried. The 2.14.0 path `/daily-tools/international-day` becomes `/daily-tools/international-days` without a redirect, as `3.0.0.md:32` declares for every path; next redirects only the old user paths (`src/router/legacyRedirects.ts`).
- Guard tests are glob or route based (`routes.test.ts`, `closeButton.test.ts`, `routeHistory.test.ts`, `sortable.test.ts`) and cover the new pages without edits; e2e has no daily tools specs and its smoke walk reads the generated routes.
- `package.json`: develop's axios `^1.20.0` was already in next.

## Not verified

- The backend: the local `core-daily-tools` checkout predates the three entities, so permission names, filterable fields and how an age-group update treats its entries were not checked against it.
- Runtime: nothing was run in a browser; test, type-check and lint results are the merge agent's.
