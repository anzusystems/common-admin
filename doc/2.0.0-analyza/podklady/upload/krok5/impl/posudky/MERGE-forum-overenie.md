# admin-forum: merge 07d043d (origin/master into next) checked against next's way

Reviewed: `07d043d` = merge of `524ba60` (next) and `418de02` (origin/master; origin/develop is `b7bb10c`, inside master). Merge bases `f75fa56` and `15206bf` (criss-cross through next's earlier master merge `99095f8`). Master brought 6 commits: `4694c83` (#86666 auto-decline settings and prompt version editing), `9b43988` (#86906 axios and eslint 10), `8461fd3` (PR merge), `cfeebb3` + `b7bb10c` (2.13.0 changelog), `418de02` (release merge) — 20 files: 17 in `src/`, `doc/Admin-Forum-Changelog/2.13.0.md`, `package.json`, `yarn.lock`.

Read-only review. What I ran: oxfmt 0.73.0 through stdin (`--stdin-filepath`, output to stdout, nothing written) on the 14 touched code files and the 4 touched locale files — output identical to the committed files; oxlint 1.88.0 without `--fix` on the 14 code files — no diagnostics (a probe file with a duplicate import and a `debugger` was reported, so the run lints). Not run: vitest, vue-tsc, eslint, stylelint. The merge agent left no logs (`krok5-praca/pracovne/merge-forum/` holds only `fix-cs.py`, `fix-datatable.py`, `fix-manage.py`, `fix-pages.py`; I read all four and checked each resolution against the merged files).

Method: `git diff 524ba60 07d043d` (19 files) read in full; every master file diffed blob-to-blob against its moved counterpart in `07d043d` (all remaining differences are next's systematic changes, listed below); `git show --cc 07d043d` for the conflict hunks; the yarn.lock of master and of the merge parsed and compared package by package; common-admin 2.0.0-rc1 (installed in `admin-forum/node_modules`) read for every component the new code relies on.

## next's systematic changes checked against

1. Domain layout `src/domains/forum/<entity>/{api,components,composables,factory,store,types,valueObject}`, shared code in `src/shared` (8e06689).
2. File-based pages with `definePage`, typed route names instead of `ROUTE`, old paths redirected (bdd4ef4, 9b253d0, b875585).
3. Explicit imports from the main common-admin entry, sorted by oxfmt/oxlint; oxfmt owns formatting (4a58f15, bde66f1, 5386d12, f8eedad, f0ba585).
4. Api helpers, `execute({ urlParams, body, signal })`, whole record as body (d5c8842).
5. Filters v2, `usePagination`, debounced `getList` (3f96b74, b62d593).
6. Vuetify 4: MD3 typography (`text-subtitle-2` → `text-label-large`), grid classes (3f96b74); common-admin 2.0 classes (`a-required-mark`, 57a5eff).
7. i18n: the Slovak taken out of the Czech texts, language errors, "používateľ", placeholders filled (d0b5025, 3c2de24, 95f2ac4, 21ea6e8, f6265b4).
8. `defineModel` (5764cc3), no `any` (81e69f9), five stricter vue rules (fce69da).
9. Close back to where the user came from (61fe39e); tracking fields and `syncUserAndTimeTracking` (bacacab).
10. Record-load errors: `useRecordPage`, `fetchData(id, { signal })`, `handleRecordLoadError`, `leave()` (815bece).
11. Redirects only while the user is on the page (`usePageNavigation`, `onPage()`); versioned edits do not forward once the user left (9e53e43).
12. Permissions the server checks: page `requiredPermissions`, `<Acl>`, row click on `_read` (dea2b30).
13. Tests: vitest harness, page navigation, generated routes, declared dependencies, filter contracts (58b88bf, 6c54b52, 9e53e43).
14. Changelog: `Unreleased/3.0.0.md` with versions counted "since 2.12.0" (3846c3c); `.order` lists every entry, generated from the directory (fd3f302).
15. Dependencies: eslint 10.13, axios 1.20.0, `@typescript-eslint/parser` and `@vue/eslint-config-prettier` dropped, yarn 4.18.1 (f8eedad, 524ba60).
16. Not touched by anything master brought: unsaved changes guard (widget theme only), date utils, dialog emits, filters, remote autocompletes.

## Findings

### High

None found.

### Medium

None found.

### Low

**L1. `.order` does not list 2.13.0**

- Where: `doc/Admin-Forum-Changelog/.order:1` starts with `2.12.0`; the merge adds `doc/Admin-Forum-Changelog/2.13.0.md` (blob `e0f184c`, identical to master's) without a line for it.
- next's way it misses: fd3f302 lists every changelog entry, "generated from the directory rather than appended to, so it cannot drift again without someone adding a file and not the line"; its message says an entry missing from `.order` does not appear in the wiki (the wiki's behaviour I did not check myself). The inhouse merge of this round did it: admin-inhouse `7b8ecc04` adds `2.14.0` on top of its `.order`.
- What the editor sees: nothing in the app; per fd3f302 the changelog wiki built from next leaves out the 2.13.0 page.
- Fix: add `2.13.0` as the first line of `doc/Admin-Forum-Changelog/.order`.

**L2. `Unreleased/3.0.0.md` counts its dependency changes from 2.12.0, and 2.13.0 now sits in between**

- Where: `doc/Admin-Forum-Changelog/Unreleased/3.0.0.md:56` lists `eslint` `9.39.2` → `10.11.0` among the majors; `:57` lists `axios` `1.20.0`, `@vue/eslint-config-typescript` `14.9.0`, `vue-eslint-parser` `10.4.1` and `eslint-plugin-vue` `10.11.0` as 3.0.0 changes.
- With the merge: 2.13.0 already ships eslint 10 (`2.13.0.md:11`, master `package.json` `eslint ^10.12.0`), axios 1.20.0, `@vue/eslint-config-typescript` 14.9.0, `vue-eslint-parser` 10.4.1 and `eslint-plugin-vue` 10.11.1 (master yarn.lock). Counted from 2.13.0, 3.0.0's eslint change is 10.12.0 → 10.13.0 (`package.json:70`), a minor one; axios, `@vue/eslint-config-typescript` and `vue-eslint-parser` do not change; `eslint-plugin-vue` stays 10.11.1 (`package.json:73`), where the text's 10.11.0 reads as a downgrade. `:43` (`@typescript-eslint/parser` gone) stays true: 2.13.0 still declares it.
- Partly older than the merge: 524ba60 bumped the dependencies (eslint 10.13, yarn 4.18.1, Vue 3.5.44, …) without touching `3.0.0.md`, so `:7` (Yarn `4.18.0`) and the versions in `:56`–`:57` trailed `package.json` already.
- What the editor sees: nothing.
- Fix: count the 3.0.0 dependency lines from 2.13.0 — eslint as `10.12.0` → `10.13.0` under minor and patch, drop axios, `@vue/eslint-config-typescript`, `vue-eslint-parser` and `eslint-plugin-vue`, and bring the remaining versions to `package.json` in the same pass.

## Checked and fine

- **Every hunk master brought is in the merge, with master's text**, at next's paths: `extSystem/types/ExtSystem.ts:33` and `extSystem/factory/ExtSystemFactory.ts:44` (`aiReportAutoDeclineEnabled`, default `false`); `extSystem/components/ExtSystemManage.vue:126-135` (the switch under `aiModerationEnabled`, hint, `data-cy="ext-ai-report-auto-decline"`, between the auto-report and e-mail switches as in master); `extSystem/components/ExtSystemDetail.vue:69-74`; `prompt/types/Prompt.ts:29`, `prompt/factory/PromptFactory.ts:35`, `prompt/composables/promptValidations.ts:38-41` (`autoDeclineThreshold`, 0–100); `prompt/components/PromptDetail.vue:51-54` (inside the post-moderation block `:46-55`); `prompt/components/PromptManage.vue:138-151` (the decline threshold field) and the 14 `:disabled="isLocked(…)"` bindings (`:79` … `:283`), identical to master's template; `prompt/composables/promptEditPermissions.ts` identical to master's but for its three import lines. A blob-to-blob diff of all 17 master files against their counterparts shows nothing else but next's systematic changes (domain imports, route names, `useRecordPage`, close history, tracking fields, filters v2, `text-label-large`, the ext system group removal, the i18n fixes).
- **Nothing of next lost**: `git diff 524ba60 07d043d` touches 19 files and only adds master's hunks, swaps `canVersionedEdit` for `canPromptEdit` in the three prompt places and changes one test answer; next's lines in the conflict regions (imports, `onPage()`, route names, `"AI auto-report zapnut"`) are kept.
- **Edit permission and redirect, same meaning as master**: `canPromptEdit` decides the row edit button (`PromptDatatable.vue:156`, inside `<Acl ACL.FORUM_PROMPT_UPDATE>`), the detail's Edit (`pages/config/prompts/[id]/index.vue:52`, `:101-112`) and the edit page's Save and redirect (`[id]/edit.vue:42-48`, `:83`): draft and active editable, inactive only for post moderation, disabled never. The redirect watches `canEdit` as master does and adds next's `onPage()` (`edit.vue:45`, `onPage` from `useRecordPage` `:64`), as the codex and clustering-profile edits do (`codexes/[id]/edit.vue:43`, `clustering-profiles/[id]/edit.vue:57`). The store starts at `PromptStatusDefault` = draft (`PromptFactory.ts:27`, `promptOneStore.ts:9`, reset on unmount), so `canEdit` starts `true` and flips once a non-editable prompt arrives; next's old `status &&` guard is not needed (status is never empty: the default is draft and a save copies only the tracking fields, `promptActions.ts:123`). Discriminator changes cannot trigger the redirect: for draft and active `canPromptEdit` is `true` whatever the type, for inactive the type select is locked (`PromptManage.vue:89`). Codex and clustering profiles keep `canVersionedEdit` (draft or inactive), as in master.
- **The test change is required and right**: with `canPromptEdit` an `active` answer stays editable, so `src/test/pageNavigation.test.ts:95-101` would no longer redirect; `status: 'disabled'` is non-editable for any type, so both cases ("lets through the navigation the user started meanwhile", "redirects when the user stays") keep testing what they did. The other three cases use `ActionsPage`, not the edit page. (Reasoned, not run.)
- **The field locks work with common-admin 2.0.0-rc1**: `AFormTextField` and `AFormTextarea` declare `disabled` and pass it to Vuetify (`node_modules/@anzusystems/common-admin/dist/domains/form/components/AFormTextField.vue.d.ts:18`, `AFormTextarea.vue.d.ts:16`); `ExtSystemSelect` has one root `VAutocomplete` and no `inheritAttrs: false`, so `disabled` falls through (same component as master's); no `strictTemplates`/`checkUnknownProps` in `tsconfig.app.json`.
- **The new fields reach the server**: update and create send the whole record (`promptActions.ts:121`, `:146`; `extSystemActions.ts:115`, `:138`); no other object literal of `Prompt` or `ExtSystemConfiguration` exists (`git grep`), so nothing else has to name the new fields.
- **Locales**: the two keys of each file exist in cs and sk with master's text (`cs|sk/forum/extSystem.json:30,55`, `cs|sk/forum/prompt.json:25,54`), cs and sk have the same key sets, next's own fixes (`zapnut`, `používateľ…`, `definujúca`, `Deaktivace od`) are kept; the new Czech is Czech (zamítnutí, nahlášení, práh) and the Slovak is Slovak (zamietnutie, nahlásení, prah); `xx` needs no entry (`src/locales/xx.ts`); the JSON is formatted as oxfmt formats it.
- **Imports and format**: `canPromptEdit` / `isPromptFieldLocked` are imported from `@/domains/forum/prompt/composables/promptEditPermissions` in sorted position (`PromptDatatable.vue:27-28`, `PromptManage.vue:9`, `edit.vue:21`, `index.vue:22`); the one-line `versionedStatusPermissions` import in `PromptDatatable.vue:28` is exactly 120 characters and oxfmt keeps it; oxlint clean.
- **Dependencies**: `package.json` and `yarn.lock` are next's, unchanged by the merge; the lock's workspace entry matches all 56 declared ranges. Next meets #86906: axios `^1.20.0` → 1.20.0 (`package.json:46`), eslint `^10.13.0` → 10.13.0 (`:70`), `eslint-plugin-vue` `^10.11.1` (`:73`), `vue-eslint-parser` `^10.4.1` (`:93`), `@vue/eslint-config-typescript` `^14.9.0` (`:66`). Of the 49 packages master's lock changed, only the typescript-eslint family (11 packages) and acorn resolve lower in the merge: typescript-eslint 8.70.1 against master's 8.71.1, which came with `@typescript-eslint/parser ^8.71.1`, a direct dependency next dropped (8.70.1 declares `eslint ^8.57.0 || ^9.0.0 || ^10.0.0`, `node_modules/typescript-eslint/package.json:49-51`), and acorn 8.18.0 against 8.19.0 — transitive lint tooling. axios' and eslint's own dependencies (`follow-redirects` 1.16.0, `form-data` 4.0.6, `@eslint/plugin-kit` 0.7.3, `brace-expansion` 5.0.12, `minimatch` 10.2.6) are the same or newer, and the old `brace-expansion` 2.0.2 / `minimatch` 9.0.5 master still carried are gone.
- **No leftovers**: no file under `src/views`, `src/model`, `src/types`, `src/services`, `src/stores`, `src/composables` or `src/components` in `07d043d`, no conflict markers; `Unreleased/86666.md` is not carried, rightly (master released it as `2.13.0.md`).
- **e2e**: the prompt lifecycle edits only a draft (`e2e/tests/ui/aiTools/prompt.spec.ts:104-108`) and never asserts the Edit button on an active or inactive prompt; the ext system page object selects no switch (`e2e/pages/extSystem/extSystemPage.ts`), so nothing there depends on what master changed.
- **Outside the merge**: origin/develop (`b7bb10c`) is inside master; `origin/feature/#86962/widget-api-performance` (three e2e specs, 2026-10-15) is on neither and not part of this merge.

## Not verified here

vue-tsc, eslint (with `anzu/*` rules) and the vitest run of `src/test/pageNavigation.test.ts` were not run; whoever runs them: one at a time, `free -m` first, `VITEST_MAX_WORKERS=2`.
