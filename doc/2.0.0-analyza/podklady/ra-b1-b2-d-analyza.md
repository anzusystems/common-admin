# Remote autocompletes B1 / B2 / D (+ P, X): intentional or bug, and what the factory could absorb

Analysis of 2026-09-28 (subagent, read-only; bugs 1, 2 and X1 re-checked by hand). Clusters from `batch2_design-shell-out/ra_clusters_final.tsv`. Abbreviations: **cms** = admin-cms, **dam** = admin-dam, **inh** = admin-inhouse, **ARA** = `common-admin/src/labs/form/AFormRemoteAutocomplete.vue`, **factory** = `common-admin/src/labs/form/createRemoteAutocomplete.ts`. Line numbers are working-tree lines on that date.

Short version: of the 43 B1/B2/D files, 37 can be absorbed by four small factory extensions (about −1,776 lines). Two are dead and one is really class A. Only three should stay hand-written. There are five live bugs, plus one in the X group.

## 0. How the base component behaves (the cause of most differences)

| Fact | Evidence |
|---|---|
| The fetched list survives a model reset: `resetToEmptyState` only clears the selection cache and the model. | ARA:185, ARA:214-219 |
| A prefetch runs once per instance: `prefetchCompleted` is set and never cleared, so after the inner filter changes, hover/focus do not fetch again. | ARA:292, ARA:309 |
| So a wrapper that changes its inner filter must remount the autocomplete (`:key`). Without a key, the old scope's items stay pickable until the user types or clears. | above |
| The first `prefetch="mounted"` fetch runs in the child's setup, before the wrapper's `onMounted`: a filter written in `onMounted` misses it. | ARA:412-418 |
| An explicit `disabled` beats the collab lock, even `false`; only `undefined` lets the lock disable the field. | ARA:179-182 |
| Undeclared props fall through to ARA and win over the wrapper's own bindings; declared but unbound props are silently dropped ("swallowed"). | Vue fallthrough rules |
| The factory calls `useSelectActions()` with no arguments; only `modelValue` is declared, so a bare `multiple` attribute arrives as `''` (no boolean casting). | factory:90, factory:131-133 |

## 1. B1 "props into inner filter" (12)

| File | What differs from class A | Intentional / bug + evidence |
|---|---|---|
| blog `BlogRubricRemoteAutocomplete.vue` | Required `blog` → `filterData.blog` via an immediate watch (35-41); sort createdAt desc, `prefetch="mounted"`, `disable-auto-single-select` (54-56). | Intentional; its only caller, `RestoreButton.vue:68`, passes a fixed blog. |
| cms `ModelAutocomplete.vue` | `onlyEnabled` → `enabled=true`, written in `onMounted` (38-42); actions with other names (32); defaults `required:false`, `clearable:true`, `disabled:false`. | Works because the caller (`PromptTemplateManage.vue:36`) passes `prefetch="hover"`. Latent: with `prefetch="mounted"` the first fetch ignores the filter. |
| cms `DesignSettingsRemoteAutocomplete.vue` | `0`→`null` (24-31); `articleUsable` in `onMounted` (39-43); `clearable` hard-coded. | Intentional; same `onMounted` latent issue. |
| cms `DeskRemoteAutocomplete.vue` | `deskIds` → `ids`; `siteGroupIds` → `siteGroup` with `[]`→`[0]` (54-74); own `prefetch` prop; no reset, no key. | `[]`→`[0]` intentional (a user without site groups sees no desks). No reset intentional: the callers reset and key it (`ContentHubAutomatManage.vue:72-91`, `InternalTakeoverAutomatManage.vue:83-87`, `ArticleTemplateWidgetArticleSettings.vue:56,63-77,102`). One caller lacks it (bug 5). |
| cms `LayoutTemplateRemoteAutocomplete.vue` | `webEntityType` written once at setup, not reactive (46-47). | Fine: all 7 callers pass constants. |
| cms `NewsletterRemoteAutocomplete.vue` | `type`, `sendableOnly` via `watchEffect` (36-39); once set, never cleared. | Latent only; callers pass constants. |
| cms `PublicExportRemoteAutocomplete.vue` | `discriminator` → filter in `onMounted` (33-37). | The wrapper is fine; both callers misspell the prop (bug 1). |
| dam `PodcastRemoteAutocomplete.vue` | `extSystemId` into the select actions (35); `disableInitFetch` drives prefetch (55); no key, no reset. | `disableInitFetch` unused by both callers; missing key → stale list (bug 3b). |
| dam `VoiceFamilyRemoteAutocomplete.vue` | Required `extSystemId` → select actions (27). | Intentional; the caller passes a constant. |
| inh `LocationRemoteAutocomplete.vue` | Three filter watchers `country` (>0), `importSource`, `enabled` (67-89); redundant `cloneDeep`. | The three props are dead: the only caller (`LocationMonthlySummaryForm.vue:30`) passes none. |
| inh `FilterLocationGroupRemoteAutocomplete.vue` | Filter variant; `type` and `parent` watchers (33-47); sort `SORT_BY_ID` desc, `prefetch="focus"`. | Intentional. |
| inh `LocationGroupRemoteAutocomplete.vue` | `type` defaults to `''` (sibling `null`); declares `errorMessage`, `hideLabel`, `hideDetails`, `disabled` (25-28), binds none. | Dead file: nothing imports it. Delete. |

The same "prop → filter field" step is written four ways (once at setup, `onMounted`, `watchEffect`, immediate `watch`); only the immediate watch is right in every case. No caller hits the difference today.

## 2. B2 "scoped by parent id" (19)

Axes on which the siblings differ:

| Axis | Variants |
|---|---|
| Filter when the scope becomes unset | **Cleared:** `siteGroupScopedAutocomplete.ts:24` (McpServer, Prompt, PromptSiteSettings, AiModel), `useGameHubDependentFilter.ts:18-22` (Game, GameGenre), GameHub. **Left stale:** cms Author, ForumWidget, LiveBlogFeed, PromoLock, TargetPosition, TaskAnzuUser, the 5 contentHub wrappers, NewsroomSection, cms Rubric. |
| Model reset on change | Most reset when the old value was set. GameHub (48) and dam Author (42) reset to `null` even when `multiple`. Never: TaskAnzuUser; ArticleTemplate and Desk (callers reset). Immediate (fires at mount): dam Author (38-50), AssetLicenceByExtId (72-84). Non-immediate: dam-in-cms Podcast, VoiceFamilySelect. |
| `:key` remount | **Keyed:** McpServer, Prompt, PromptSiteSettings, AiModel, PromoLock, Game, GameGenre, GameHub, TargetPosition, contentHub ×5, dam-in-cms Podcast. **Not keyed:** ForumWidget, LiveBlogFeed, cms Author, TaskAnzuUser, dam Author, NewsroomSection (its caller keys it), dam Podcast, VoiceFamilySelect. |
| `disabled` | Some OR the caller's value with "required scope unset"; NewsroomSection lets an explicit caller value win (67-73); ExternalRubric and ExternalSource declare it and ignore it; others don't declare it, so the caller's attr overrides the wrapper's binding. |

| File | What differs | Verdict |
|---|---|---|
| cms `AuthorRemoteAutocomplete.vue` | Site-group scope, no clear, no key (59-68); extra filters `enabledArticleAssign`, `discriminator` (70-88); site-group suffix in titles decided once at setup (44-45; `authorSelectActions.ts:10-19`). | Suffix intentional; no key → old search results after a site-group change (bug 3c, minor). |
| cms `ForumWidgetSettingsRemoteAutocomplete.vue` | Prefetch hover, no key (58-69), no clear. | **Bug 3a**; its keyed siblings in the same form are fine. |
| cms Game / GameGenre | gameHub helper: clears filter, resets model, keyed. | Consistent. |
| cms `GameHubRemoteAutocomplete.vue` | Resets to `null` even when `multiple` (48). | Latent: no caller uses `multiple`. |
| cms `LiveBlogFeedRemoteAutocomplete.vue` | Site-group scope, no key, `hide-details` hard-coded. | Scope dead: none of its 5 callers passes `site-group-id`. |
| cms McpServer / Prompt / PromptSiteSettings | Shared composable, keyed. | The reference shape. |
| cms `PromoLockRemoteAutocomplete.vue` | Own watcher copy without the clear (42-49). | Latent: both callers mark the scope required. |
| cms `TargetPositionRemoteAutocomplete.vue` | String scope `webEntityType`, keyed, resets. | Intentional. |
| cms `TaskAnzuUserRemoteAutocomplete.vue` | `deskId` → filter (33-41); no reset, no key, no clear. | Unclear: assignees from desk A survive a change to desk B (`TaskManage.vue:91-110`, `TaskCreateDialog.vue:108-113`); both callers pass an undeclared `:client` that lands on the DOM. Owner decision. |
| cms contentHub `ConsumerClientRemoteAutocomplete.vue` | Consumer-client scope, keyed. | Scope dead: none of 11 callers passes it. |
| cms contentHub `ExternalRubricAutocomplete.vue` | Declares `clearable`, `disabled` (16-17), binds neither (50-55, 59-69). | Latent: its caller passes neither. |
| cms contentHub `ExternalSourceRemoteAutocomplete.vue` | As ExternalRubric, plus prefetch hover. | **Bug 2**: `ExternalContentSubscriptionManage.vue:57` passes `clearable`, swallowed. |
| cms contentHub Location / Rubric | Honour `disabled`, `clearable`. | The correct siblings. |
| cms `dam/components/PodcastRemoteAutocomplete.vue` | Asset-licence scope into select actions, non-immediate reset, keyed. | Intentional. |
| dam `AuthorRemoteAutocomplete.vue` | Immediate watcher emitting `null` at mount even for `multiple` (38-50), since `518db086` (2025-02-03). | Latent bug 6; harmless only because the edit views load the entity after the form mounts (`AuthorEditView.vue:30,58-60`, `AuthorCleanPhraseEditView.vue:43,71-73`). The prop is static at all 3 callers. |

## 3. D "custom logic" (12)

| File | What differs / verdict | Factory fit |
|---|---|---|
| cms `PromptTemplateRemoteAutocomplete.vue` | String ext id model mapped to and from int (27-32). Intentional. | Hand-written. |
| cms `AiModelRemoteAutocomplete.vue` | Shared composable plus a type-desc sort (54-55). Plain B2. | scope |
| cms `ArticleTemplateRemoteAutocomplete.vue` | `rubricId` → filter, keyed, no reset; caller resets (`ArticleButtonCreate.vue:144-149`). | filterFromProps + scope |
| cms `BoxSelectionAddAutocomplete.vue` | An "add a box" picker, not an entity wrapper (comments 17, 35-36, 49). | Hand-written. |
| cms `NewsroomSectionRemoteAutocomplete.vue` | Null filter on `update:selected` redundant: the caller ignores null (`UserAuthorWizardStepNewsroomSection.vue:100-103`) and keys it. | scope |
| cms `FilterRubricRemoteAutocomplete.vue` | `siteId` → `site`, keyed by `join('-')`; keeping a rubric when the site filter changes is the convention for filter pairs. | filterFromProps + scope (no reset) |
| cms `RubricRemoteAutocomplete.vue` | Three scopes; key and reset only for scopes flagged `*Required` (55-89, since `c30de2969`, 2025-09-30); filters never cleared; the disabled check stops at the first `*Required` flag; dead `loading` ref (115); exposes `tryLoadModelValue`. | Hand-written (expose, several scopes, 30 callers). Its gating causes bug 4. |
| cms contentHub `PermissionGroupRemoteAutocomplete.vue` | Copy of the common permission-group wrapper; nothing imports it. | Delete. |
| dam `AssetLicenceByExtIdRemoteAutocomplete.vue` | Fetches only once an `extId` is typed (57-66); immediate reset at mount (72-84) also calls the caller's handler (`AssetToolbarExtSystemLicenceDialog.vue:171-179`), whose `onMounted` preset (183-188) runs after it. | scope + a local fetch guard |
| dam `DistributionCategoryRemoteAutocomplete.vue` | `assetType` → filter; type-only model cast. | filterFromProps |
| dam `VoiceFamilySelect.vue` | Ext-system scope, correct non-immediate reset, not keyed. | **Bug 3b.** scope + `useSelectActions(props)` |
| dam `UserRemoteAutocomplete.vue` | Really class A; drops `data-cy` (declared at 16, never bound). | Current factory. |

## 4. Bugs

Live:

1. **PublicExport discriminator never applied (medium).** Both callers write `:disriminator=` (`LinkedListItemKindPublicExportForm.vue:66,115`): the attribute falls through to the DOM, the filter stays null and the picker lists every public-export kind instead of ArticleList only. Copied since `86df86099` (2024-08-22). Re-checked.
2. **ExternalSource swallows `clearable` and `disabled` (low-medium).** No clear button in `ExternalContentSubscriptionManage.vue:57`; `disabledComputed` also returns an explicit `false`, which overrides the collab lock. ExternalRubric has the same defect, no caller hits it. Re-checked.
3. **Stale list after a scope change (medium).** The fetched list survives a model reset and `prefetchCompleted` stays true (§0).
   - (a) ForumWidget: in site edit the site group can change (`SiteManage.vue:227-231`); the field empties, the menu still lists group A's settings, one can be saved on a group-B site.
   - (b) dam Podcast and VoiceFamilySelect: in the synthesize dialog, after switching ext system (`TtsNarrationRequestSynthesizeButton.vue:59-64,115-157`) the old system's items are listed.
   - (c) cms Author: old search results stay (minor).
   - Also in X: MinuteFeed (`ContentHubAutomatManage.vue:276-280`).
4. **Rubric not reset when the article's site changes (probable; owner's call).** `ArticleWidgetBaseSettings.vue:78-88`: no `site-required`, so neither keyed nor reset; the backend `RubricMatchesSite` (`ArticleKind.php:100`) rejects the save. Regression from `c30de2969`; may be deliberate for collab.
5. **Job desk-article migrate keeps a stale source desk (caller).** `JobCreateFormDeskArticleMigrate.vue:53,81-103` has no watcher on the source site group, unlike both automat forms; the backend accepts the inconsistent source (`JobDeskArticleMigrateValidValidator.php:91-100`).

Latent:

6. dam Author and AssetLicenceByExtId emit `null` at mount (dam Author even for an array); only mount/fetch order saves them.
7. 13 wrappers do not clear the filter when the scope is unset; masked because callers mark the scope required.
8. GameHub resets a `multiple` model to `null` instead of `[]`.
9. Filters written in `onMounted` (Model, DesignSettings, PublicExport) are missed by a `prefetch="mounted"` first fetch; Newsletter's values are never cleared.
10. Swallowed props: dam User `data-cy`; dead inh LocationGroup 4 props.
11. TaskAnzuUser: assignees survive a desk change, the undeclared `:client` leaks to the DOM. Owner decision.

Outside the clusters asked about (X group):

X1. `KeywordRemoteAutocompleteWithCached` (dam), `LocationRemoteAutocompleteWithCached`, `LocationGroupRemoteAutocompleteWithCached` (inh) declare `disabled` and never forward it: the upload-queue keywords ignore `:disabled="!item.canEditMetadata"` (`AssetQueueItemEditable.vue:449`, re-checked), the district field ignores `districtDisabled` (`LocationEditForm.vue:85`), the import-location fields ignore `priorityOnly` (`JobCreateFormMetNoImport.vue:78`, `JobCreateFormOpenMeteoImport.vue:79`).

Intentional, not to be unified away: Desk `[]`→`[0]`; Desk and ArticleTemplate leaving the reset to callers; the non-immediate resets; cms Author's setup-time suffix; filters not resetting when a sibling filter changes; BoxSelectionAdd; cms Rubric's `tryLoadModelValue`; PromptTemplate's string model.

Dead code: inh `LocationGroupRemoteAutocomplete.vue`, cms contentHub `PermissionGroupRemoteAutocomplete.vue` (no importers); the scope props of LiveBlogFeed and ConsumerClient; the three props of inh LocationRemoteAutocomplete; cms Rubric's `loading` ref.

## 5. Proposed factory extensions

Declarative on purpose: the bugs come from 19 hand-written copies of the same watcher; a free callback would let each admin write its own watcher again.

```ts
createRemoteAutocomplete({
  ...existingOptions,
  // (a) the component's own props: declared, so booleans are cast and they are reactive; not forwarded
  props: { siteGroupId: { type: Number, default: null }, siteGroupRequired: Boolean },
  // (b) useSelectActions receives them
  useSelectActions: (props) => usePodcastSelectActions(() => props.extSystemId),
  // (c) inner-filter fields that follow the props: written in setup and again on every change
  filterFromProps: (props) => ({ siteGroup: props.siteGroupId || null }),
  // (d) what the list depends on
  scope: {
    of: (props) => props.siteGroupId || undefined, // key of the inner autocomplete
    requiredWhen: (props) => props.siteGroupRequired, // disabled while `of` is undefined
    reset: true, // default
  },
})
```

Rules the implementation must keep (each prevents a bug above):
- `filterFromProps` runs immediately in setup, before the child exists (fixes 9), and writes every key each time, so an unset scope writes `null` (fixes 7).
- `scope.of` is the key of the inner `h(AFormRemoteAutocomplete)` vnode (fixes 3).
- The reset is not immediate, fires only when the old value was defined, and emits `[]` when `multiple`, else `null` (fixes 6, 8): `multiple` becomes a declared Boolean prop of the factory, still forwarded.
- `disabled` is `true` when the scope is required and unset, otherwise the caller's value, `undefined` when not set, so the collab lock still works (ARA:179-182); not overridden by the attrs spread (factory:142).
- Admin presets keep call sites to one line, e.g. `...siteGroupScoped('siteGroup')` in admin-cms (replacing `siteGroupScopedAutocomplete.ts`) and `...gameHubScoped()`.

| Extension | Files | Lines now → est. | What it unifies |
|---|---|---|---|
| (a)+(c) `props` + `filterFromProps` | 14: BlogRubric; cms Model, DesignSettings, Desk, LayoutTemplate, Newsletter, PublicExport, ArticleTemplate, FilterRubric, TaskAnzuUser; dam DistributionCategory, Author; inh Location, FilterLocationGroup | 899 → ~304 (−595) | One timing (fixes 9); dam Author loses its mount-time reset (fixes 6); TaskAnzuUser keyed, assignees kept until decided (11). |
| (b) `useSelectActions(props)` | 2: dam Podcast, VoiceFamily (+4 in the next row) | 103 → ~38 (−65) | One-line change. |
| (d) `scope` (with a, b, c) | 21: cms ForumWidget, LiveBlogFeed, McpServer, PromoLock, Prompt, PromptSiteSettings, AiModel, NewsroomSection, Game, GameGenre, GameHub, TargetPosition, contentHub ×5, dam-in-cms Podcast, Author; dam VoiceFamilySelect, AssetLicenceByExtId | 1,524 → ~408 (−1,116) | Fixes 2, 3a/b/c, 7, 8, part of 6. One change: in NewsroomSection an explicit `disabled=false` no longer overrides "required" (its caller passes `isNull(siteGroup)`). |
| **Total** | **37 of 43** | **2,526 → ~750 (−~1,776)** | |
| Current factory | dam User (callers switch to `:prefetch="false"`) | 58 → ~16 | Fixes the swallowed `data-cy` (10). |
| Delete | 2 dead files | −161 | |
| Hand-written | cms Rubric, BoxSelectionAdd, PromptTemplate | | |

Estimates assume ~14-16 lines of a migrated class-A file plus ~1 line per extra prop, filter field or scope entry.

Worth it: (d) yes, the largest duplication and bugs 3, 7, 8, part of 6 in one place; (a)+(c) yes, mainly consistency; (b) trivial, with (a). Not worth it: a mapping callback for PromptTemplate, an expose passthrough for cms Rubric. Separate fixes: bug 1 (caller typo; `strictTemplates` would catch the class, not enabled in admin-cms), bug 4 (decision), bug 5 (a watcher in the caller), X1 (forward `disabled` in the three WithCached wrappers).

## 6. P "local permissionGroup copy" (list only, no proposal — D10 area)

All six wrap the admin's own `usePermissionGroupActions` and a local inner filter, duplicating `common-admin/src/labs/permissionGroup/APermissionGroupRemoteAutocomplete.vue` and its filter counterpart: blog `PermissionGroupRemoteAutocomplete.vue` (form, `client`, createdAt desc, mounted, chips + closable, hide-details), cms `FilterPermissionGroupRemoteAutocomplete.vue` (filter, `client`, hover), cms `PermissionGroupRemoteAutocomplete.vue` (form, `client`, `v-model:selected`, chips, hide-details, hover), dam `PermissionGroupRemoteAutocomplete.vue` (form, mounted unless `disableInitFetch`, chips, hide-details), dam `PermissionGroupRemoteSelect.vue` (filter, `usePermissionGroupSelectAction`), forum `PermissionGroupSelect.vue` (form, `client`, createdAt desc, mounted, chips + closable, hide-details). The dead cms contentHub copy (D) is the same family.

## 7. X classification check (23)

- Real forms: 2 (dam `ExtSystemTtsSettingsForm.vue`, `VoiceFamilyEditForm.vue`).
- Wrappers of `AFormRemoteAutocompleteWithCached` with custom slots, rightly outside the factory: 5 (dam Author and Keyword WithCached; inh Menu, Location, LocationGroup WithCached); three have X1.
- Misclassified `AFormRemoteAutocomplete` wrappers: 16. Site-group scope (keyed) plus an `appendLink` edit button: Countdown, CrossBox, DangerBox, Faq, LinkedList, Timeline, TrendingArticleGroupList, ForumFeed. MinuteFeed: same, no key (bug 3). Appointment: site scope, excluded ids, link. Box: `type` filter, keyed, link. ExternalSnippet: `useAsContentItem` filter, link. Page: link to the page tree. Inbox: custom logic (allowed inboxes, localStorage). Site: site-group scope (number or array, resets on any change), `#locked` collab slot — not migrated. ArticleIntentionCategory: site-group scope, `#locked` slot. 11 of the 16 would fit `scope`; the edit link would need one more option (e.g. `editRoute`).
