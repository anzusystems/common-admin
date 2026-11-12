# 6 - Author and keyword building blocks (LIB vs DAM)

Read-only analysis, both repos on branch `next`. Nothing was built or run.

Path shorthand:
- `D/` = `/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/`
- `L/` = `/home/volar/projects/anzusystems/common-admin/src/domains/dam/`
- `DAM/` = `/home/volar/projects/anzusystems/admin-dam/`, `LIB/` = `/home/volar/projects/anzusystems/common-admin/`
- Component shorthand: KA = `keyword/components/KeywordRemoteAutocompleteWithCached.vue`, AA = `author/components/AuthorRemoteAutocompleteWithCached.vue`, KC = `...CachedKeywordChip.vue`, AC = `...CachedAuthorChip.vue`, ACC = `...CachedAuthorChipConflicts.vue`, ACB = `author/components/AuthorCreateButton.vue`.

Classes: STRUCTURAL / PRODUCT / DRIFT-BUG / UNKNOWN as defined in the task. "inferred" marks a conclusion drawn without reading the deciding line.

## Headlines

1. **The two sides are the same components with four real differences**: (a) where the ext system and the client come from, (b) DAM's create ACL, (c) what "disabled" looks like (LIB: label + chips and no "+"; DAM: a disabled input and a disabled "+"), (d) which cache and which upload store a chip reads. Everything else is typing, naming or a defect one side has.
2. **The two caches are the same cache definition** apart from the ext system source and the client argument. The request, the stored shape, the limits and the singleton nature are identical (section B). DAM cannot use the library's cache "as it is" for one reason only: neither the cache composables nor `useExtSystemIdForCached` are exported from `LIB/src/lib.ts`, and that ext system ref starts at `0` and is written only by image widgets and the asset select.
3. **None of the library's files of this family is exported today.** `LIB/src/lib.ts` exports only the types, the two factories, `useDamAuthorType`, `useDamCachedUsers` and the two *filter* autocompletes (`lib.ts:410-415, 499-500, 504, 821-822, 870-872, 887, 1052-1057`).
4. **No DAM file of this family is released by the upload work alone.** The keyword autocomplete is also held by the asset detail (one file), the author autocomplete by the asset detail and the licence form (two files); the keyword chip and the conflicts chip go when their autocomplete goes. The author chip is imported by five non-upload pages, the author cache by eight files besides the store and the queue container, the keyword cache by five, `AuthorCreateButton` by the author list page (section C).
5. **`KeywordCreateButton.vue` is not part of this family.** Neither side's keyword autocomplete uses it; both create the keyword inline (`D/KA:111-121`, `L/KA:125-135`). Its only importer is `D/keyword/components/KeywordListView.vue:7`. The library has no counterpart and needs none.
6. **The chip, not the autocomplete, is what ties this family to the upload store**: it calls `useUploadQueuesStore()` in setup to draw the "new" icon (`D/KC:30, 39-45`, `L/KC:30, 34-40`, same in AC). That single read decides the order of work (section E).

---

# PART I - FACTS

## A. Per pair, every difference

### A.1 `KeywordRemoteAutocompleteWithCached.vue` (D 237 lines, L 273 lines)

Identical on both sides (checked hunk by hunk with `diff -w`): props `queueId, label, required, disabled, multiple, clearable, dataCy, validationScope` and their defaults (`D/KA:26-47`, `L/KA:25-48`); the `required` rule built from `requiredIf(requiredComputed)` and the scope read once at setup (`D/KA:63-74`, `L/KA:66-77`); the inner filter provided to the base (`D/KA:78-80`, `L/KA:90-92`); `removeLastComma`, `searchChange`, `itemSlotIsSelected`; the "create" rule: name without trailing comma, nothing below 2 characters (`D/KA:111-121`, `L/KA:125-135`); `showAdd` (not while loading, 2-255 characters, no case-insensitive name match among fetched items: `D/KA:142-150` minus the ACL line, `L/KA:152-159`); every prop handed to `AFormRemoteAutocompleteWithCached` except `disabled` (`filter-by-field="text"`, `:filter-sort-by="null"`, `item-title="name"`, `item-value="id"`, `:min-search-chars="2"`, `min-search-text="common.damImage.keyword.filterMinChars"`, `@keyup.enter`, `@keyup.,`: `D/KA:155-178`, `L/KA:188-211`); the `#item`, `#chip`, `#append-item` slots and the sticky "add" bar style. Both use the library's base component and `useValidate` (DAM imports them from the package entry, `D/KA:2-10`).

| # | Difference | DAM | LIB | Class |
|---|---|---|---|---|
| K1 | Ext system | `useCurrentExtSystem()` read when the keyword is created (`D/KA:109, 112`) and, in the select actions, at every fetch (`D/keyword/composables/keywordActions.ts:157, 181, 189, 195`) | required prop `extSystem: IntegerId` (`L/KA:28`), read once at setup (`L/KA:82, 88, 126`) | STRUCTURAL. No runtime difference in DAM: the current ext system is set once per page load (`DAM/src/domains/system/composables/appInitialize.ts:103`, guarded by `isAppInitialized`, `DAM/src/router/beforeEachRoute.ts:65-74`) and a licence switch reloads the page (`D/asset/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue:141`) |
| K2 | Guard at setup | none | throws `KeywordRemoteAutocompleteWithCached: Ext system must be initialised.` when the ext system config is not in the store (`L/KA:79-85`), and again inside `useKeywordSelectActions` (`L/keyword/composables/keywordActions.ts:14-19`) | STRUCTURAL. In DAM the config of the current ext system is always loaded before any page (`appInitialize.ts:114-118`) into the same library store |
| K3 | Client / API | `createKeyword(data)` over DAM's own `damClient` (`D/keyword/api/keywordApi.ts:60-63, 28-35`) | `createKeyword(damClient, data)` with the client from `useCommonAdminCoreDamOptions()` (`L/KA:79, 130`, `L/keyword/api/keywordApi.ts:34-44`) | STRUCTURAL. Same request (`POST /adm/v1/keyword`, system `coreDam`, entity `keyword`); DAM registers its client as the library's default (`DAM/src/main.ts:39-43`) |
| K4 | Create ACL | Enter, comma and the "+ name" entry need `ACL.DAM_KEYWORD_CREATE` (`D/KA:128-143`); without it nothing is offered and the keys do nothing | no check (`L/KA:142-159`) | STRUCTURAL (DAM only; added by `ed0553bc feat: buttons, menu items and pages ask for the permissions core-dam checks`, 2026-10-05) |
| K5 | `disabled` | forwarded to the input: `:disabled="disabled"` (`D/KA:167`, added by `e577c589 feat!: common-admin 2.0.0 building blocks and the fixes that surfaced`). The user sees a disabled autocomplete with its chips inside (inferred from the Vuetify component, not from a running app) | the input is not rendered at all; instead `ARow` with the label as title and one chip per id (`L/KA:164-176`; single mode `:177-187`), the input is `v-else` and gets no `disabled` (`L/KA:188-200`) | UNKNOWN. LIB's branch came with `4da99073 asset select sidebar info` (2024-12-03) for the read-only asset-select sidebar (`L/assetDetail/components/AssetMetadata.vue:132, 158` pass `:disabled="readonly"`); the queue row inherited it (`L/uploadQueue/components/UploadQueueItemEditable.vue:388`). Settled by a product look at a waiting row on both sides (same open point as R7 in report 5) |
| K6 | `data-cy` while disabled | still on the input (`D/KA:172`) | absent: the `ARow` branch carries no `data-cy` (`L/KA:164-187`) | follows from K5 |
| K7 | `v-model` typing | `defineModel<DocId[]>({ required: true })` (`D/KA:48`, from `adbc95c7 refactor: declare component models with defineModel`; narrowed to arrays by `1e76a29b Fix no-explicit-any + update (#213)`) | `modelValue: DocId \| null \| DocId[] \| any` + `update:modelValue` emit (`L/KA:27, 49-51`) | STRUCTURAL (typing). At runtime both emit a fresh array (`D/KA:53-55`, `L/KA:57-59`) |
| K8 | Single (non-multiple) mode | removed: `afterCreate` handles arrays only (`D/KA:90-96`) | still present: `afterCreate` assigns the bare id (`L/KA:102-111`) | DRIFT-BUG, latent, LIB: the setter spreads whatever it gets (`L/KA:57-59`), so a string id would be emitted as an array of characters. Not reachable: every caller on both sides passes `multiple` (usage map, C). DAM is right (typed it away) |
| K9 | Slot guards | none | `v-if="itemSlotItem"` / `v-if="chipSlotItem"` (`L/KA:214, 240`, from `e5cc06f4 New image widget + several changes (#212)`) | no visible difference (inferred: the base always passes `internalItem`, `LIB/src/domains/remoteAutocomplete/components/AFormRemoteAutocompleteWithCached.vue:310-331`) |
| K10 | Cache | `useCachedKeywords` / `useCachedKeywordsForRemoteAutocomplete` (`D/KA:18-21, 88, 160`) | `useDamCachedKeywords` / `useCachedKeywordsForRemoteAutocomplete` (`L/KA:8-11, 100, 194`) | STRUCTURAL, see B |
| K11 | Generic | `generic="I extends DamKeywordMinimal"` (`D/KA:1, 61`) | `any` (`L/KA:64`) | typing only |

Texts: none differ. Both use the library key `common.damImage.keyword.filterMinChars` = "Zadajte minimálne 2 znaky" (`LIB/src/locales/sk/common/damImage.json:179`); the label comes from the caller.

### A.2 `KeywordRemoteAutocompleteCachedKeywordChip.vue` (D 98, L 82)

Identical: props (`id, title, queueId, forceRounded, textOnly, size, containerClass`), the `empty` slot, the text-only and chip variants, the spinner while not loaded and no title was given, the "new" icon rule (`mdi-new-box` when the queue's `suggestions.newKeywordNames` has the cached name: `D/KC:39-45`, `L/KC:34-40`).

| # | Difference | DAM | LIB | Class |
|---|---|---|---|---|
| C1 | How the cached item is read | a one-shot latch: `watch(item)` copies the first loaded item into `cached` and never again (`D/KC:32-37, 55-64`) | `useCachedItem(() => getCachedKeyword(props.id))`, a computed that follows the cache and the id (`L/KC:32`, `LIB/src/domains/cached/composables/useCachedItem.ts:6-17`; introduced by `0bf1095d wip`, applied to the chips in `e5cc06f4`) | DRIFT-BUG, DAM. Three effects: (1) an id the server did not return (`_unresolved`, `_loaded: false`, `LIB/src/domains/cached/composables/defineCached.ts:208-214`) never passes DAM's latch (`D/KC:59`), so DAM **spins forever**; LIB settles (`useCachedItem.ts:9-10`) and draws an **empty chip** - it does not use the `unresolved` flag the composable offers (`useCachedItem.ts:13-15`), unlike `ACachedChip` (`LIB/src/domains/cached/components/ACachedChip.vue:56-67`). (2) DAM keeps the first name if `id` changes on a live instance; LIB follows. (3) After the cache prunes an entry (`defineCached.ts:173-190`, limit 1000) DAM keeps the name, LIB goes back to the spinner. LIB is right on (1) and (2); neither is complete on (1) |
| C2 | Cache | `useCachedKeywords` (`D/KC:7, 29`) | `useDamCachedKeywords` (`L/KC:4, 29`) | STRUCTURAL |
| C3 | Upload store | DAM's `useUploadQueuesStore` (`D/KC:6, 30`), id `damUploadQueuesStore` | the library's (`L/KC:5, 30`), id `commonUploadQueuesStore` | STRUCTURAL - and the one that matters: a library chip mounted in DAM asks the library store for the queue, gets `null` (`L/uploadQueue/store/uploadQueuesStore.ts:69-74`) and never shows the "new" icon. Mounting it also creates the library store, which subscribes to DAM notifications in its setup (`L/uploadQueue/store/uploadQueuesStore.ts:48-67`; side finding 5 of report 3) |
| C4 | `empty` slot default | `" - "` (`D/KC:70`) | `"-"` (`L/KC:54`) | formatter (`90ce7261 style: reformat templates with oxfmt`); no visible difference |

### A.3 `AuthorRemoteAutocompleteWithCached.vue` (D 262, L 291)

Identical: all props incl. `authorConflicts` (`D/AA:26-49`, `L/AA:23-48`), validation, inner-filter provide, `addAuthor` (a conflict chip adds its id once: `D/AA:85-90`, `L/AA:88-93`), `showAdd`, the base's props (min 2 characters, `min-search-text="common.damImage.author.filterMinChars"` = "Zadajte minimálne 2 znaky", `damImage.json:203`), the `#item` slot with `:force-reviewed="itemSlotItem.raw?.raw?.reviewed"` (`D/AA:195`, `L/AA:222`), the "+" button's `variant="icon"`, `data-cy="add-author"`, `disable-redirect`, `:initial-value` (`D/AA:224-233`, `L/AA:252-261`), Enter/comma opening the create dialog prefilled with the typed text (`D/AA:126-136`, `L/AA:130-138`), the conflicts block and its condition `!disabled && authorConflicts?.length > 0` with the text `common.damImage.author.conflicts` = "Konflikt autorov" (`D/AA:236-252`, `L/AA:264-280`; DAM already uses the library key).

| # | Difference | DAM | LIB | Class |
|---|---|---|---|---|
| A1 | Ext system | `useAuthorSelectActions()` reads the current one at every fetch (`D/AA:79`, `D/author/composables/authorActions.ts:177, 203, 211, 218`); the create button reads it itself | prop `extSystem` (`L/AA:26`), read once (`L/AA:82`), handed to the button (`L/AA:255`) | STRUCTURAL (as K1) |
| A2 | Create ACL | `ACL.DAM_AUTHOR_CREATE`: Enter and comma do nothing, no "+ name" entry (`D/AA:127, 133, 139`), the "+" button is not rendered (`D/AA:225`) | none | STRUCTURAL (as K4, same commit) |
| A3 | `disabled`: the input | **not forwarded** (`D/AA:151-173` has no `disabled`); in the queue row the input is disabled by the surrounding `VForm` (`D/asset/components/queue/AssetQueueItemEditable.vue:437`; Vuetify resolves `props.disabled ?? form.isDisabled`, `DAM/node_modules/vuetify/lib/composables/form.js:130`) | label + chips instead of the input (`L/AA:152-175`), input is `v-else` (`L/AA:176-177`) | UNKNOWN (as K5) |
| A4 | `disabled`: the "+" button | rendered, disabled (`D/AA:223-233`) | hidden with `v-show="!disabled"` (`L/AA:251`), still mounted | UNKNOWN (part of K5; same commit `4da99073`) |
| A5 | Button event | `@on-success` (`D/AA:232`) | `@success` (`L/AA:260`; renamed in `aef095d0 feat!: 2.0.0 fixes, the admins' shared building blocks and their guard tests`) | STRUCTURAL (naming) |
| A6 | `v-model` typing and clone | `defineModel<DocId[]>`, setter `cloneDeep` (`D/AA:50-58`) | props + emit, setter `[...newValue]` (`L/AA:25, 49-60`) | typing; same result for string arrays |
| A7 | Single mode | removed (`D/AA:100-106`) | present (`L/AA:103-112`) | DRIFT-BUG, latent, LIB (as K8) |
| A8 | Slot guards | none | `v-if` on both slots (`L/AA:202, 229`) | no visible difference (inferred) |
| A9 | Inner filter | `text` + `canBeCurrentAuthor` (default `null`) (`D/author/filter/AuthorFilter.ts:27-40`) | `text` only (`L/author/filter/AuthorFilter.ts:5-20`) | STRUCTURAL. Same request from this component: a `null` filter is skipped (`LIB/src/domains/api/composables/useApiQueryBuilder.ts:104-109, 178-181`). The extra field exists for DAM's other autocomplete (`D/author/components/AuthorRemoteAutocomplete.vue:12-15`) |
| A10 | Inner filter subject | `author` (`D/author/filter/AuthorFilter.ts:4, 35`) | `keyword`: the file imports `ENTITY` from the **keyword** api (`L/author/filter/AuthorFilter.ts:3`, since `3d773b5b wip`) | DRIFT-BUG, latent, LIB. Only the filter's `titleT` is derived from it (`LIB/src/domains/filters/composables/filterFactory.ts:142-146`), and this component draws its label from the `label` prop, so nothing shows |
| A11 | Cache | `useCachedAuthors` / `...ForRemoteAutocomplete` (`D/AA:19-22, 98, 156`) | `useDamCachedAuthors` / `useDamCachedAuthorsForRemoteAutocomplete` (`L/AA:8-11, 101, 182`) | STRUCTURAL |

### A.4 `AuthorRemoteAutocompleteCachedAuthorChip.vue` (D 124, L 108)

Identical: props incl. `forceReviewed`, title = name + ` (identifier)` (`D/AC:50-56`, `L/AC:45-51`), the "new" icon rule over `suggestions.newAuthorNames` (`D/AC:42-48`, `L/AC:37-43`), the green `mdi-shield-check` with the tooltip `common.damImage.author.model.flags.reviewed` = "Schválený" in both variants (`D/AC:92-98, 105, 115-121`, `L/AC:76-82, 89, 99-105`). DAM uses the library key here, not its own `coreDam.author.model.flags.reviewed` = "Skontrolovaný" (`DAM/src/locales/sk/coreDam/author.json:8`).

| # | Difference | DAM | LIB | Class |
|---|---|---|---|---|
| AC1 | Latch vs computed | latch (`D/AC:35-40, 64-73`) | `useCachedItem` (`L/AC:35`) | DRIFT-BUG, DAM (as C1) |
| AC2 | "Reviewed" source | the live cache item (`D/AC:58-62`, `item.value?.reviewed`) | the settled item (`L/AC:53-57`, `cached.value?.reviewed`) | none visible: an unloaded placeholder has `reviewed: false` on both sides (`D/author/composables/cachedAuthors.ts:14-16`, `L/author/composables/cachedAuthors.ts:15-17`) |
| AC3 | Cache / upload store | DAM's (`D/AC:7-8, 32-33`) | the library's (`L/AC:3-4, 32-33`) | STRUCTURAL (as C2, C3) |
| AC4 | `empty` slot default | `" - "` (`D/AC:81`) | `"-"` (`L/AC:65`) | formatter |

### A.5 `AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue` (D 69, L 70)

`diff -w` shows imports and one line: the cache composable (`D/ACC:25` `useCachedAuthors`, `L/ACC:26` `useDamCachedAuthors`). Both still carry the latch (`D/ACC:27-28, 41-50`, `L/ACC:28-29, 42-51`), so both spin forever on an unresolved id. Template identical (closable chip, `mdi-plus` as the close icon, emits `addAuthor`). Class: STRUCTURAL (cache only). Neither side reads the upload store here.

### A.6 `AuthorCreateButton.vue` (D 197, L 214)

Identical: props `initialValue, disableRedirect, variant, buttonT, buttonClass, dataCy, disabled, validationScope` and defaults; `open(textOverride)` exposed (`D/ACB:57-61, 100-102`, `L/ACB:64-71, 108-110`); validate, create, emit, "created" alert, close (`D/ACB:73-95`, `L/ACB:82-104`); dialog with name (required, Enter confirms), identifier, type; `data-cy` values `create-panel`, `author-name`, `author-identifier`, `author-type`, `button-cancel`, `button-confirm`; entity scope `coreDam` / `author` (`D/ACB:145-148` via `ENTITY`, `L/ACB:162-165` as a literal).

| # | Difference | DAM | LIB | Class |
|---|---|---|---|---|
| B1 | Ext system | current (`D/ACB:50, 53, 58`) | prop `extSystem`, required (`L/ACB:25, 60, 68`) | STRUCTURAL |
| B2 | Guard | none | throws `AuthorCreateButton: Ext system must be initialised.` at setup and on open (`L/ACB:51-56, 65-67`) | STRUCTURAL |
| B3 | Client / API | `useCreateAuthor()` over DAM's client (`D/ACB:19, 83, 98`, `D/author/api/authorApi.ts:28-35`) | `createAuthor(damClient, …)` (`L/ACB:11, 50, 92`, `L/author/api/authorApi.ts:35-45`) | STRUCTURAL; same `POST /adm/v1/author` |
| B4 | Emit | `onSuccess` (`D/ACB:46-48, 84`) | `success` (`L/ACB:46-48, 93`) | STRUCTURAL (naming) |
| B5 | Redirect after create | to `/(coreDam)/authors/[id]` unless `disableRedirect` (`D/ACB:67, 87-89`) | commented out (`L/ACB:96-98`) | STRUCTURAL - and dead in DAM: both callers pass `disable-redirect` (`D/author/components/AuthorListView.vue:34`, `D/AA:230`) |
| B6 | Accessible name of the icon button | tooltip only (`D/ACB:116-133`) | `aria-label` + tooltip (`L/ACB:132-150`, added in `aef095d0`; enforced by `LIB/src/test/a11y/iconButtonNames.test.ts:95-99`) | DRIFT-BUG, DAM. A tooltip is not a name (`iconButtonNames.test.ts:4-6`); LIB is right |
| B7 | `listItem` variant | does not exist (`D/ACB:28`) | exists (`L/ACB:28, 114-121`), unused anywhere (`rg listItem L/` finds only this file) | DRIFT-BUG, latent, LIB: `@click.stop="onClick"` (`L/ACB:119`) passes the click event as `textOverride`, so the name would become the event object (`L/ACB:69`) |
| B8 | Default validation scope | `anzu:author-create-validation-scope` (`D/shared/validationScopes.ts:3`) | `anzu:common:author-create-validation-scope` (`L/composables/uploadValidations.ts:17`) | STRUCTURAL; no collector uses either symbol (`rg` finds only the definitions and the two defaults) |
| B9 | Text keys | `coreDam.author.button.add`, `.meta.create`, `.model.name|identifier|type` (`D/ACB:131, 142, 152, 162, 171`) | `common.damImage.author.*` same leaf names (`L/ACB:134, 148, 159, 169, 179, 188`) | Slovak strings identical ("Pridať nového autora", "Vytvorenie autora", "Meno", "Identifikátor", "Typ": `DAM/src/locales/sk/coreDam/author.json:4-6, 27, 30` vs `LIB/src/locales/sk/common/damImage.json:181-200`). **English differs in one**: dialog title "Create author" (`DAM/src/locales/en/coreDam/author.json:27`) vs "Creating author" (`LIB/src/locales/en/common/damImage.json:200`). UNKNOWN which English is wanted; DAM ships `sk` and `en` only (`DAM/src/locales/`) |

### A.7 `KeywordCreateButton.vue` (DAM 170) - no library counterpart

A dialog button like the author's with one field (`D/keyword/components/KeywordCreateButton.vue:140-149`), redirect to `/(coreDam)/keywords/[id]` unless disabled (`:85-87`), emit `onSuccess` (`:44-46, 82`). **Imported by one file**, `D/keyword/components/KeywordListView.vue:7, 34` (with `disable-redirect`, `:36`). The keyword autocompletes do not use it on either side. The library has only leftovers of one: the unused keys `common.damImage.keyword.button.add|meta.create|model.name` (`LIB/src/locales/sk/common/damImage.json:169-178`; no code reads them - `rg "damImage\.keyword\." LIB/src` finds only `filterMinChars`, `L/KA:207`) and the unused symbol `ADamKeywordCreateValidationScopeSymbol` (`L/composables/uploadValidations.ts:15`). Its icon variant has no accessible name (`:107-124`) and is unused (the list view uses the default `button` variant).

### A.8 Composables

| Pair | Differences | Class |
|---|---|---|
| `author/composables/cachedAuthors.ts` (D 48, L 49), `keyword/composables/cachedKeywords.ts` (D 45, L 47) | see B | STRUCTURAL |
| `author/composables/authorConfig.ts` (D) vs `damAuthorConfig.ts` (L); `keyword/composables/keywordConfig.ts` (D) vs `damKeywordConfig.ts` (L) | name (`useAuthorAssetTypeConfig(assetType)` vs `useDamAuthorAssetTypeConfig(assetType, extSystem)`); ext system from `useCurrentExtSystem()` (`D/author/composables/authorConfig.ts:10-12`) vs parameter (`L/author/composables/damAuthorConfig.ts:7-9`); `useDamConfigState(damClient)` vs `useDamConfigState()` - the getter never touches the client (`LIB/src/domains/dam/config/composables/damConfigState.ts:230-232`); `?? false` vs `!!` (`D:18, 22`, `L:16, 20`); error text | STRUCTURAL, no behaviour difference. Both read the config once, non-reactively |
| `author/composables/authorValidation.ts` (D 26, L 27) | imports only (`diff -w`): name required + min 2, identifier min 3 on both (`D:10-20`, `L:11-21`) | identical |
| `keyword/composables/keywordValidation.ts` (D 23) | no library counterpart; used by `D/keyword/components/KeywordEditForm.vue:7` and `KeywordCreateButton.vue:18` | DAM-only, not upload |
| `author/composables/authorActions.ts` (D 227, L 66) - `useAuthorSelectActions` only | DAM: no argument, ext system read per fetch (`D:176-227`); LIB: `extSystem` argument bound when the composable is created, a guard, and one more function `fetchItemsMinimalByIds` (`L:12-66`). Mapping to minimal / value object identical (`D:180-190`, `L:21-31`) | STRUCTURAL |
| `keyword/composables/keywordActions.ts` (D 204, L 59) - `useKeywordSelectActions` only | same pattern (`D:156-204`, `L:12-59`) | STRUCTURAL |
| API | DAM: composable factories over its own client, `urlParams` given at call time (`D/author/api/authorApi.ts:11-35`, `D/keyword/api/keywordApi.ts:11-35, 55-63`); LIB: functions taking the client and the ext system (`L/author/api/authorApi.ts:13-45`, `L/keyword/api/keywordApi.ts:12-44`). Endpoints, `system`, `entity`, `isSearchApi` identical. DAM additionally has update and fetch-one for its pages (`D/author/api/authorApi.ts:37-53`, `D/keyword/api/keywordApi.ts:37-53`) | STRUCTURAL |
| Factories | none: DAM uses the library's `useDamKeywordFactory` / `useDamAuthorFactory` (`D/KA:8, 108`, `D/ACB:11, 52`) | - |

## B. The two caches

| | DAM `useCachedAuthors` / `useCachedKeywords` | LIB `useDamCachedAuthors` / `useDamCachedKeywords` |
|---|---|---|
| Definition | `defineCached<DocId, DamAuthor, DamAuthorMinimal>(mapFullToMinimal, mapIdToMinimal, fetch)` at module top (`D/author/composables/cachedAuthors.ts:18-26`; keywords `D/keyword/composables/cachedKeywords.ts:16-23`) | the same call (`L/author/composables/cachedAuthors.ts:19-27`; `L/keyword/composables/cachedKeywords.ts:17-25`) |
| Options | defaults: `idProp 'id'`, limit 1000, `retryNotFound: true`, batches of 100 (`LIB/src/domains/cached/composables/defineCached.ts:89-95`) | the same defaults |
| What is stored | author `{ id, name, identifier, reviewed }`, placeholder with empty strings and `reviewed: false` (`D:7-16`); keyword `{ id, name }` (`D/keyword/...:7-14`) | identical (`L:8-17`; `L/keyword/...:8-15`) |
| Ext system | `useCurrentExtSystem().currentExtSystemId`, read inside the fetch callback, i.e. when the debounced fetch fires (`D:22-25`; `D/keyword/...:20-22`). Module-private ref, set only in `initCurrentExtSystemAndLicence` (`D/asset/composables/currentExtSystem.ts:21, 45, 49, 54, 92`) | `useExtSystemIdForCached().cachedExtSystemId`, read inside the callback (`L:24-26`). A module-level `ref(0)` (`L/composables/extSystemIdForCached.ts:4`), **written by whoever used a DAM widget last**: `L/imageWidget/components/ImageWidgetInner.vue:313, 331, 347, 526`, `ImageMediaWidgetInner.vue:322, 339, 355, 637`, `ImageWidgetMultipleInner.vue:201, 210, 220, 392`, `AImageWidgetMultiple.vue:73`, and `L/assetSelect/composables/assetSelectListActions.ts:117`. The upload store and the queue container use the cache without setting it (`L/uploadQueue/store/uploadQueuesStore.ts:37-38`, `L/uploadQueue/components/UploadQueueEditable.vue:52-53`) |
| Client | DAM's `damClient` import (`D/author/api/authorApi.ts:4, 13`) | `useCommonAdminCoreDamOptions().damClient`, config `default`, resolved inside the callback (`L:25`; throws when the plugin is not configured, `L/composables/commonAdminCoreDamOptions.ts:36-42`, which `defineCached` turns into an unresolved item, `defineCached.ts:216-227`) |
| Request | `GET /adm/v1/author/ext-system/{id}/search` + the by-ids query (`D/author/api/authorApi.ts:7-18`); keywords `/adm/v1/keyword/ext-system/{id}/search` (`D/keyword/api/keywordApi.ts:7-8, 19-26, 55-58`) | the same url, the ext system bound when the helper is created (`L/author/api/authorApi.ts:9-24`, `L/keyword/api/keywordApi.ts:8-23`). `useApiFetchByIds` treats call-time and creation-time `urlParams` alike (`LIB/src/domains/api/composables/useApiFetchByIds.ts:95-96`) |
| Returned API | `addManualToCached…`, `addManualMinimalToCached…`, `addToCached…`, `fetchCached…`, `toFetchCached…`, `cached…`, `hasCached…`, `getCached…`, `isLoadedCached…` (`D:28-40`); `…ForRemoteAutocomplete` = `{ fetch, add, addManualMinimal }` (`D:42-48`) | the same nine names (`L:29-41`) and the same trio (`L:43-49`). Only the composables' own names differ; the keyword trio is even spelled identically on both sides (`useCachedKeywordsForRemoteAutocomplete`, `L/keyword/...:41`) |
| Singleton | one per module evaluation, app-wide | the same. **In DAM both instances are alive today**: DAM's own, and the library's, which `AAssetSelect` fills (`assetSelectListActions.ts:103-104, 117-124`) and the library's `AssetMetadata.vue` reads. DAM mounts `AAssetSelect` in three places (`D/asset/components/ImagePreview.vue:183`, `D/asset/components/detail/components/slots/AssetSibling.vue:82`, `D/extSystem/components/ExtSystemTtsSettingsForm.vue:110`) |

**Could DAM use the library's cache as it is? No, for two mechanical reasons, none behavioural.**
1. Nothing of it is exported: `LIB/src/lib.ts` has no `useDamCachedAuthors`, `useDamCachedKeywords` or `useExtSystemIdForCached` (the only `Cached` exports are `defineCached`, `useCachedItem`, `ACachedChip`, `ACachedUserChip`, `useDamCachedUsers`, `createCachedChip`, `useCachedAnzuUsers`, `useCachedPermissionGroups`: `lib.ts:34-35, 287-293, 504, 1468-1475`).
2. `cachedExtSystemId` is `0` until a widget writes it. In DAM the only writer would be the asset select's item click (DAM mounts no image widget: `rg "AImageWidget|ImageWidget" DAM/src` finds none). All three DAM asset selects pass `[currentAssetLicenceId]` (`ImagePreview.vue:184`, `AssetSibling.vue:85`, `ExtSystemTtsSettingsForm.vue:38, 111`), so that write equals DAM's current ext system today - by coincidence of the callers, not by design.

With the ref set to DAM's current ext system once, at the same place DAM sets its own, every request below is the same request as today.

### Every DAM file that uses DAM's caches

Authors (10 files) - "change" assumes the library cache with `cachedExtSystemId` equal to DAM's current ext system:

| File | What it does with the cache | Part of | Would switching change anything? |
|---|---|---|---|
| `D/asset/store/uploadQueuesStore.ts:45, 82, 326, 330, 646-648, 660` | adds the items' authors and conflicts, fetches | upload | no |
| `D/asset/components/queue/AssetQueueEditable.vue:10, 68, 70-80` | primes authors on mount | upload | no |
| `D/author/components/AuthorRemoteAutocompleteWithCached.vue:19-22, 98, 156` | `addManual` after create; hands the trio to the base | upload + elsewhere | no |
| `D/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue:8, 32` | `getCachedAuthor` | upload + elsewhere | no |
| `D/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:6, 25` | `getCachedAuthor` | upload + asset detail | no |
| `D/asset/store/assetDetailStore.ts:6, 70-78` | adds the asset's authors and conflicts | asset detail | no |
| `D/author/composables/authorActions.ts:28, 79, 87-93, 118, 126-132` | adds current/child authors of the viewed author | author detail + edit pages | no |
| `D/assetLicence/composables/assetLicenceActions.ts:25, 30, 77-79, 112-114` | adds `internalRuleAuthors`; note the destructuring at module top (`:30`) | licence detail + edit pages | no. (Existing behaviour either way: the authors are looked up under the *current* ext system, not the licence's) |
| `D/authorCleanPhrase/composables/authorCleanPhraseActions.ts:9, 77, 85-88` | adds the replacement author | clean-phrase detail | no |
| `D/authorCleanPhrase/components/AuthorCleanPhrasePlaygroundButton.vue:8, 45, 57-60` | adds the authors the playground answered | clean-phrase playground | no |

Keywords (7 files):

| File | What it does | Part of | Change? |
|---|---|---|---|
| `D/asset/store/uploadQueuesStore.ts:46, 83, 646, 661` | adds the items' keywords, fetches | upload | no |
| `D/asset/components/queue/AssetQueueEditable.vue:11, 67, 70-80` | primes on mount | upload | no |
| `D/keyword/components/KeywordRemoteAutocompleteWithCached.vue:18-21, 88, 160` | `addManual` after create; trio to the base | upload + asset detail | no |
| `D/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue:7, 29` | `getCachedKeyword` | upload + asset detail | no |
| `D/asset/store/assetDetailStore.ts:7, 72-77` | adds the asset's keywords | asset detail | no |
| `D/extSystem/composables/extSystemActions.ts:28, 35, 109-112` | adds the ext system's TTS auto keyword | ext system detail + edit | no. (Existing behaviour either way: looked up under the current ext system, not the viewed one) |
| `D/extSystem/components/ExtSystemDetail.vue:9, 19, 65` | hands `getCachedKeyword` to the library's `ACachedChip` | ext system detail | no (same getter signature) |

Tests that replace DAM's caches by path: `DAM/src/test/list/detailRequests.test.ts:31-36`, `DAM/src/test/queue/slotNotifications.test.ts:50-55`, `DAM/src/test/queue/lazyMetadata.test.ts:41-46`.

What *would* change with one cache instead of two: entries the asset select loaded are reused by DAM's screens and the other way round (fewer requests, nothing visible).

## C. Usage map

### C.1 DAM

| File | Importers: upload / queue | Importers: elsewhere |
|---|---|---|
| KA | `D/asset/components/queue/AssetQueueItemEditable.vue:27` (used `:456`), `D/asset/components/queue/AssetQueueSelectedSidebar.vue:10` (`:174`) | `D/asset/components/AssetMetadata.vue:23` (`:119`, asset detail) |
| KC | - | only KA (`D/KA:17`) |
| AA | `AssetQueueItemEditable.vue:25` (`:479`), `AssetQueueSelectedSidebar.vue:9` (`:227`) | `D/asset/components/AssetMetadata.vue:21` (`:142`, asset detail), `D/assetLicence/components/AssetLicenceEditForm.vue:14` (`:113`, licence form) |
| AC | (through AA: `D/AA:16`) | `D/author/components/AuthorDetail.vue:6` (`:34, 42`), `D/author/components/AuthorEditForm.vue:13` (`:79`), `D/assetLicence/components/AssetLicenceDetail.vue:7` (`:54`), `D/authorCleanPhrase/components/AuthorCleanPhraseDetail.vue:6` (`:25`), `D/authorCleanPhrase/components/AuthorCleanPhrasePlaygroundButton.vue:7` (`:106`) |
| ACC | - | only AA (`D/AA:17`) |
| ACB | (through AA: `D/AA:15`) | `D/author/components/AuthorListView.vue:7` (`:32`, author list page) |
| `KeywordCreateButton.vue` | - | `D/keyword/components/KeywordListView.vue:7` (`:34`) |
| `author/composables/cachedAuthors.ts` | store, `AssetQueueEditable` | eight more, see B |
| `keyword/composables/cachedKeywords.ts` | store, `AssetQueueEditable` | five more, see B |
| `author/composables/authorConfig.ts` | `AssetQueueItemEditable.vue:26` (`:197`) | `D/asset/components/AssetMetadata.vue:22` (`:82`) |
| `keyword/composables/keywordConfig.ts` | `AssetQueueItemEditable.vue:28` (`:192`) | `D/asset/components/AssetMetadata.vue:24` (`:77`) |
| `author/composables/authorValidation.ts` | (through ACB: `D/ACB:20`) | `D/author/components/AuthorEditForm.vue:15` |
| `keyword/composables/keywordValidation.ts` | - | `D/keyword/components/KeywordEditForm.vue:7`, `KeywordCreateButton.vue:18` |
| `author/composables/authorActions.ts` | `useAuthorSelectActions`: AA (`D/AA:18`) | `useAuthorSelectActions`: `D/author/components/AuthorRemoteAutocomplete.vue:5`; list/detail/edit actions: `AuthorEditView.vue:14`, `AuthorListView.vue:9`, `AuthorEditForm.vue:14`, `AuthorDatatable.vue:26`, `AuthorFilter.vue:14`, `AuthorDetailView.vue:14` |
| `keyword/composables/keywordActions.ts` | `useKeywordSelectActions`: KA (`D/KA:22`) | `useKeywordSelectActions`: `D/extSystem/components/ExtSystemTtsSettingsForm.vue:20`, `D/voiceFamily/components/VoiceFamilyEditForm.vue:14`; the rest: `KeywordListView.vue:9`, `KeywordDetailView.vue:14`, `KeywordEditForm.vue:6`, `KeywordDatatable.vue:25`, `KeywordEditView.vue:14`, `KeywordFilter.vue:12` |
| `author/api/authorApi.ts` | cache (`cachedAuthors.ts:5`), ACB (`:19`) | `AuthorFilter.ts:4`, `AuthorEditForm.vue:11`, `AuthorDatatable.vue:23`, `D/asset/components/AssetCreateButton.vue:20`, `authorActions.ts:22-27` |
| `keyword/api/keywordApi.ts` | cache (`cachedKeywords.ts:5`), KA (`:16`) | `KeywordFilter.ts:4`, `KeywordEditForm.vue:5`, `KeywordCreateButton.vue:17`, `KeywordDatatable.vue:23`, `keywordActions.ts:22-27` |
| `author/filter/AuthorFilter.ts` | `useAuthorInnerFilter`: AA (`:23`) | `AuthorRemoteAutocomplete.vue:6`, `AuthorDatatable.vue:27` |
| `keyword/filter/KeywordFilter.ts` | `useKeywordInnerFilter`: KA (`:23`) | `KeywordDatatable.vue:26`, `VoiceFamilyEditForm.vue:15`, `ExtSystemTtsSettingsForm.vue:21` |

Test mocks by path: KA `DAM/src/test/queue/queueRowValidation.test.ts:64`, `DAM/src/test/queue/massOperationsSidebar.test.ts:30`; AA `queueRowValidation.test.ts:60`, `massOperationsSidebar.test.ts:35`; caches see B. No DAM test or e2e file names the chips, the create buttons or the config composables (`rg` over `DAM/src/test` and `DAM/e2e`).

DAM already consumes the library's *other* author/keyword components with the ext system as a prop: `ADamKeywordFilterRemoteAutocomplete` and `ADamAuthorFilterRemoteAutocomplete` with `:ext-system="currentExtSystemId"` (`D/asset/components/list/components/AssetListFilterForm.vue:41-52`). Those run the library's `useAuthorSelectActions(props.extSystem)` / `useKeywordSelectActions` in DAM today (`L/author/components/DamAuthorFilterRemoteAutocomplete.vue:22`, `L/keyword/components/DamKeywordFilterRemoteAutocomplete.vue:21`).

### C.2 LIB

| File | Importers: upload / queue | Importers: elsewhere | Exported from `lib.ts`? |
|---|---|---|---|
| KA | `L/uploadQueue/components/UploadQueueItemEditable.vue:21` (`:379`), `AssetQueueSelectedSidebar.vue:9` (`:167`), `UploadQueueDialogSingleSidebarMetadataContent.vue:15` (`:116`) | `L/assetDetail/components/AssetMetadata.vue:16` (`:125`) | no |
| KC | - | only KA (`L/KA:15`) | no |
| AA | `UploadQueueItemEditable.vue:19` (`:403`), `AssetQueueSelectedSidebar.vue:8` (`:223`), `UploadQueueDialogSingleSidebarMetadataContent.vue:14` (`:141`) | `AssetMetadata.vue:15` (`:150`), `L/imageWidget/components/ImageWidgetMultipleItem.vue:11` (`:116`), `ImageMassOperations.vue:10` (`:141`), `ImageDetailDialogMetadata.vue:10` (`:158, 248`) | no |
| AC | - | only AA (`L/AA:15`) | no |
| ACC | - | AA (`L/AA:16`); test `L/uploadQueue/__tests__/uploadQueueDialogSingle.test.ts:11, 171, 260` | no |
| ACB | - | only AA (`L/AA:18`) | no |
| `author/composables/cachedAuthors.ts` | `L/uploadQueue/store/uploadQueuesStore.ts:6`, `UploadQueueEditable.vue:8` | AA `:8-11`, AC `:3`, ACC `:4`, `L/assetSelect/composables/assetSelectListActions.ts:14`; mocked in `L/assetSelect/__tests__/assetSelectListActions.test.ts:43` | no |
| `keyword/composables/cachedKeywords.ts` | `uploadQueuesStore.ts:15`, `UploadQueueEditable.vue:7` | KA `:8-11`, KC `:4`, `assetSelectListActions.ts:15`; mocked in the same test `:44` | no |
| `composables/extSystemIdForCached.ts` | - | the two caches (`:6` each), the image widgets and the asset select (list in B) | no |
| `author/composables/damAuthorConfig.ts`, `keyword/composables/damKeywordConfig.ts` | `UploadQueueItemEditable.vue:23-24` (`:164, 170`), `UploadQueueDialogSingleSidebarMetadataContent.vue:19-20` (`:69, 75`) | `AssetMetadata.vue:17-18` (`:68, 74`) | no |
| `author/composables/authorValidation.ts` | - | ACB (`L/ACB:9`) | no |
| `author/composables/authorActions.ts` | - | AA `:17`, `DamAuthorFilterRemoteAutocomplete.vue:2` | no |
| `keyword/composables/keywordActions.ts` | - | KA `:7`, `DamKeywordFilterRemoteAutocomplete.vue:2` | no |
| `author/filter/AuthorFilter.ts`, `keyword/filter/KeywordFilter.ts` | - | the autocompletes and the two filter autocompletes | no |
| `author/factory/AuthorFactory.ts`, `keyword/factory/KeywordFactory.ts` | - | ACB `:13`, KA `:19` | **yes** (`lib.ts:414-415, 870-871`) |

Library tests that name these components: `L/imageWidget/__tests__/ImageMassOperations.test.ts:35-39, 78` stubs `AuthorRemoteAutocompleteWithCached` **by component name**; `uploadQueueDialogSingle.test.ts:165-173` stubs `AFormRemoteAutocompleteWithCached` and the conflicts chip by name.

## D. Verdict per file

### D.1 DAM files

| DAM file | Verdict |
|---|---|
| `keyword/components/KeywordRemoteAutocompleteWithCached.vue` | **CAN BE REPLACED after the library's gains two things.** (1) A create gate that DAM can bind to `dam_keyword_create` and that is off when not set (K4). (2) A way to keep the input, disabled, instead of label + chips (K5) - unless the owner picks one look for both. Also requires the cache (B) and the chip's store read (C3) to be settled. DAM then passes what it passes today plus `:ext-system="currentExtSystemId"`: `queue-id`, `label`, `clearable`, `multiple`, `required`, `validation-scope`, `disabled`, `data-cy`, `v-model` (`AssetQueueItemEditable.vue:456-465`, `AssetQueueSelectedSidebar.vue:174-180`, `AssetMetadata.vue:119-128`). All three callers have to switch for the file to go; two of them are upload |
| `keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue` | **CAN BE REPLACED** once the library chip reads the same cache as DAM's fillers and gets its "new" names from the queue DAM actually uses (C3). Disappears together with DAM's KA (its only importer). The DAM-side defect C1 is patched by the switch; the library's empty chip for an unresolved id remains |
| `author/components/AuthorRemoteAutocompleteWithCached.vue` | **CAN BE REPLACED after the library's gains** (1) the create gate for `dam_author_create` covering Enter, comma, the "+ name" entry and the "+" button (A2), (2) the disabled look: input kept (disabled through the form or the prop) and the "+" rendered disabled instead of hidden (A3, A4). DAM passes today's props plus `:ext-system`; four callers (`AssetQueueItemEditable.vue:479-489`, `AssetQueueSelectedSidebar.vue:227-233`, `AssetMetadata.vue:142-152`, `AssetLicenceEditForm.vue:113-120`), two of them outside upload |
| `author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue` | **CAN BE REPLACED after the library's is exported** and under the same two conditions as the keyword chip. **Not released by the upload work**: five non-upload files import it (C.1). They pass only `id` (+ `class`), so no prop is missing |
| `author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue` | **CAN BE REPLACED by the library's as it is** (one cache line differs). Disappears with DAM's AA |
| `author/components/AuthorCreateButton.vue` | **CAN BE REPLACED after the library's is exported**; nothing has to be added to it. DAM passes `:ext-system="currentExtSystemId"`, listens to `@success` instead of `@on-success`; `disable-redirect` becomes a no-op. Consequences: the English dialog title changes (B9) unless a text is aligned first; the icon button gains its accessible name (B6, a patch). Held by `AuthorListView.vue:32` outside upload; inside the autocomplete it goes with DAM's AA |
| `keyword/components/KeywordCreateButton.vue` | **MUST STAY in DAM.** Not used by upload on either side; a list-page control. The library should be left alone (no counterpart to create) |
| `author/composables/cachedAuthors.ts`, `keyword/composables/cachedKeywords.ts` | **CAN BE REPLACED after the library exports its cache composables and the ext system ref** (or an equivalent setter), and DAM sets that ref where it sets its own. Ten and seven importers respectively; the file can stay as a two-line re-export under DAM's names so that none of them and none of the three test mocks change |
| `author/composables/authorConfig.ts`, `keyword/composables/keywordConfig.ts` | **CAN BE REPLACED after the library's are exported** (call with `currentExtSystemId.value` as the second argument). The queue row stops needing them once the row is the library's; `D/asset/components/AssetMetadata.vue:77, 82` still does, so they stay until that file switches |
| `author/composables/authorValidation.ts` | **CAN BE REPLACED by the library's as it is** if exported (identical rules); otherwise **stays** for `AuthorEditForm.vue:15`. Not needed for upload |
| `keyword/composables/keywordValidation.ts` | **MUST STAY** (keyword pages; no counterpart) |
| `author/composables/authorActions.ts`, `keyword/composables/keywordActions.ts` | **MUST STAY** (list, detail, edit actions; and the select actions serve `AuthorRemoteAutocomplete.vue`, `ExtSystemTtsSettingsForm.vue`, `VoiceFamilyEditForm.vue`). Only the import from KA/AA goes with those files. Library files: leave alone |
| `author/api/authorApi.ts`, `keyword/api/keywordApi.ts` | **MUST STAY.** After the family is unified, `useCreateAuthor` loses its only caller (`D/ACB:19`), and `useFetchAuthorListByIds` / `fetchKeywordListByIds` keep one each (`authorActions.ts:217`, `keywordActions.ts:195`) |
| `author/filter/AuthorFilter.ts`, `keyword/filter/KeywordFilter.ts` | **MUST STAY** (datatables, `AuthorRemoteAutocomplete.vue`, voice-family and TTS forms) |

### D.2 LIB files

| LIB file | Verdict | Exported today |
|---|---|---|
| `keyword/components/KeywordRemoteAutocompleteWithCached.vue` | gains the create gate and the disabled-look option; must be exported | no |
| `author/components/AuthorRemoteAutocompleteWithCached.vue` | gains the same two; must be exported | no |
| `keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue` | either unchanged (if the upload store is unified first) or loses its store read in favour of something the queue hands down (C3); no export needed (DAM uses it only inside KA) | no |
| `author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue` | same as the keyword chip; **must be exported** (five DAM pages use the chip directly) | no |
| `author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue` | unchanged; no export needed | no |
| `author/components/AuthorCreateButton.vue` | unchanged for DAM's needs; export needed only for `AuthorListView.vue`. Defect B7 (unused `listItem` variant) is independent | no |
| `author/composables/cachedAuthors.ts`, `keyword/composables/cachedKeywords.ts` | unchanged; `useDamCachedAuthors` and `useDamCachedKeywords` must be exported | no |
| `composables/extSystemIdForCached.ts` | unchanged; must be exported (or wrapped by an exported setter) | no |
| `author/composables/damAuthorConfig.ts`, `keyword/composables/damKeywordConfig.ts` | unchanged; export only for DAM's `AssetMetadata.vue` | no |
| `author/composables/authorValidation.ts` | unchanged; export optional | no |
| `author/composables/authorActions.ts`, `keyword/composables/keywordActions.ts`, both `api/*`, `keyword/filter/KeywordFilter.ts` | unchanged; no export | no |
| `author/filter/AuthorFilter.ts` | unchanged for this work; defect A10 (wrong `ENTITY` import) is independent | no |

## E. Order and risks (facts)

### E.1 What the row and the sidebar pull in

- The library row imports KA, AA and both config composables (`L/uploadQueue/components/UploadQueueItemEditable.vue:19-24`); the sidebar imports KA and AA (`L/uploadQueue/components/AssetQueueSelectedSidebar.vue:8-9`); the container and the store import both caches (`UploadQueueEditable.vue:7-8`, `uploadQueuesStore.ts:6, 15`). DAM's row, sidebar, container and store mirror this exactly (C.1).
- Therefore a shared row or sidebar running in DAM needs, **before** it: (a) one cache that asks under DAM's ext system (B); (b) chips that find the "new" names of the queue the row belongs to (C3) - today each chip finds them only in its own side's store; (c) the create gate (K4, A2), or DAM users without the ACL get a create offer that the API refuses; (d) a decision or an option for the disabled look (K5, A3, A4). ACB, ACC, the config composables and `authorValidation` need nothing.
- (b) is the only dependency on the upload store. If the store is unified first, (b) is already satisfied and the chips need no change.

### E.2 Risks

1. **Path mocks in DAM tests stop matching silently.** `massOperationsSidebar.test.ts:30, 35` and `queueRowValidation.test.ts:60, 64` replace DAM's KA/AA by file path. Once the row or the sidebar takes them from the package entry, the mocks do nothing and the real library components mount: they call `useCommonAdminCoreDamOptions()` (`L/KA:79`), which throws without the plugin (`L/composables/commonAdminCoreDamOptions.ts:36-42`). `queueRowValidation.test.ts:64-80` also relies on its stub registering a required field in the row's scope - that has to be kept in whatever replaces it. Both tests already override entry exports through `vi.mock('@anzusystems/common-admin', …)` (`massOperationsSidebar.test.ts:22-25`, `queueRowValidation.test.ts:35-46`), which is where the stubs would move.
2. **An entry mock does not reach inside the library.** `massOperationsSidebar.test.ts:22-25` replaces `useDamConfigState` on the entry; library components import it internally (`L/KA:20`), so they would see the real, empty config store and throw the "Ext system must be initialised" guard (`L/KA:82-85`).
3. **Cache mocks**: `detailRequests.test.ts:31-36`, `slotNotifications.test.ts:50-55`, `lazyMetadata.test.ts:41-46` mock DAM's cache files by path. They survive only as long as DAM's stores keep importing from those paths.
4. **`cachedExtSystemId` is a shared global with several writers** (B). Any future DAM use of the asset select or an image widget with another licence's ext system would redirect every DAM chip lookup to that ext system until the next write.
5. **The library chip creates the library upload store** on any page that shows an author chip (`L/AC:33`), and that store subscribes to DAM notifications (`L/uploadQueue/store/uploadQueuesStore.ts:48-67`). DAM's own chip does the same with DAM's store today (`D/AC:33`), so this is a change of *which* store only while two stores exist.
6. **Library guard tests** that a ported or changed file must pass: `LIB/src/test/i18nLiteralKeys.test.ts:56-66` (every literal key in en, sk **and cs**; DAM has no `cs`), `LIB/src/test/a11y/iconButtonNames.test.ts:95-99` (icon-only `VBtn` needs `aria-label`/`title` - DAM's `AuthorCreateButton.vue:116-125` and `KeywordCreateButton.vue:107-115` would fail as they are), `LIB/src/test/publicExportsAdded.test.ts:44-68` (2.0.0 convention: exported components start with `A`), `LIB/src/test/importCycles.test.ts` (the chips import the store, the store imports the caches; no cycle today).
7. **Name-based stubs in library tests** (`ImageMassOperations.test.ts:35-39, 78`, `uploadQueueDialogSingle.test.ts:165-173`) break if the component files are renamed; an export alias does not affect them.
8. **e2e selectors DAM relies on exist identically in the library's components**: `[data-cy="add-author"]` (`DAM/e2e/pages/assets/assetBulkEditPage.ts:169`, `assetDetailPage.ts:149`; `L/AA:256`), `[data-cy="author-name"]`, `author-identifier`, `author-type`, `create-panel`, `button-confirm` (`assetBulkEditPage.ts:163-175`, `DAM/e2e/pages/settings/authorPage.ts:14-25`; `L/ACB:156, 172, 181, 190, 206`), the "+ name" option button (`assetBulkEditPage.ts:151`, `assetDetailPage.ts:140`; `L/KA:253-258`), `[data-cy="custom-field-keywords|authors"] .v-chip` (`DAM/e2e/tests/assets/audioAsset.spec.ts:75-76`). One exception: with the library's disabled look the `data-cy` is gone while the field is disabled (K6).
9. **Visible edge changes that come with the switch even if nothing else changes**: an author or keyword the server does not return shows an empty chip instead of an endless spinner (C1); the English title of the author dialog (B9).

### Side findings (not part of any pair's verdict)

- DAM's keyword input opts out of a disabled `VForm` when its own `disabled` is an explicit `false`, DAM's author input never does (`D/KA:167` vs `D/AA:151-173`; Vuetify `form.js:130`). The two differ only for a row that is editable **and** a duplicate (`AssetQueueItemEditable.vue:437`); the store sets `canEditMetadata = false` together with `isDuplicate` (`D/asset/store/uploadQueuesStore.ts:675-677`), so it does not show in the normal flow (inferred for the external-provider path, `D/shared/services/upload/externalProviderImportService.ts:26-29`).
- Both autocompletes default `validationScope` to `undefined`, which Vuelidate reads as "collect every child" (`DAM/node_modules/@vuelidate/core/dist/index.mjs:650, 697`), including the nested create button, whose empty name is invalid from the start (`D/ACB:53, 69`, `L/ACB:60, 78`). Every caller on both sides passes a symbol or `false` (C), which keeps that out (inferred, not run).
- `L/user/filter/DamUserFilter.ts:3` has the same wrong `ENTITY` import as A10.

---

# PART II - PROPOSALS (my own, not facts)

## P1. One cache first, with DAM's files kept as shims

Export `useDamCachedAuthors`, `useDamCachedKeywords` and `useExtSystemIdForCached` from `lib.ts`. In DAM, set `cachedExtSystemId.value` in `initCurrentExtSystemAndLicence` next to each write of `currentExtSystemId` (`currentExtSystem.ts:45, 49, 54, 92`) and reduce `cachedAuthors.ts` / `cachedKeywords.ts` to re-exports under today's names. Seventeen importers and three test mocks stay untouched, there is one cache at runtime, no request changes. This is the cheapest step and unblocks everything else. Risk 4 stays; if the owner wants it closed, the cleaner design is for the cache to take the ext system from the component that adds the id rather than from a global, but that is a library change of its own and not needed for parity.

## P2. Take the upload store out of the chips

Replace the chips' `useUploadQueuesStore()` with an injected set of "new" names that the queue container provides for its queue (`UploadQueueEditable` in LIB, `AssetQueueEditable` in DAM until the containers are one), defaulting to "none". Same pixels on both sides, and it removes risk 5 and side finding 5 of report 3 for good. If the store unification is scheduled before this family anyway, skip P2: it is then unnecessary for parity.

## P3. Create gate as core-DAM config, not as a prop

Add `keywordCreateAcl` and `authorCreateAcl` to `CommonAdminCoreDamConfig`, next to `roiUpdateAcl` / `imageRotateAcl` (`LIB/src/AnzuSystemsCommonAdmin.ts:63-75`), resolved in `useCommonAdminCoreDamOptions` and checked with `useAclAllowed` (`LIB/src/domains/auth/composables/aclAllowed.ts:11-23`). Default: no check, so the other admins keep today's behaviour; DAM sets both in `main.ts:39-43`. A prop would have to be threaded through the row, the sidebar, the single-upload sidebar and the asset metadata form.

## P4. Disabled look: ask the owner once, otherwise one prop

Recommendation: put the question to the owner as "a waiting row shows keywords and authors as a label with chips (library) or as greyed inputs (DAM): which one for both?". If the answer is "keep each", add one prop to both autocompletes (for example `disabledAs: 'chips' | 'input'`, default `'chips'`); in `'input'` mode render the base with `:disabled="disabled || undefined"` and keep the "+" rendered and disabled. The library row then needs to pass it, which is one more row prop for the list in report 5.

## P5. Exports and names

Export under `A`-prefixed aliases without renaming the files (keeps the name-based stubs of risk 7 working): the two autocompletes, the author chip, the author create button; plus `useDamAuthorAssetTypeConfig` and `useDamKeywordAssetTypeConfig` for DAM's asset detail.

## P6. Patches that the "one side has a bug" rule allows

- C1/AC1: DAM gets the non-spinning chip by switching. Worth finishing in the library at the same time: use the `unresolved` flag and show what `ACachedChip` shows (`#id` with a tooltip), for the two chips and the conflicts chip (which still has the latch on both sides).
- B6: DAM's icon button gets its accessible name by switching.
- A10, B7, K8/A7: three latent library defects; fix or delete while the files are open (import `ENTITY` from the author api; drop the unused `listItem` variant; drop or type away the single mode).
- B9: decide the English title ("Create author" vs "Creating author") and align the library text before DAM switches, so the switch itself changes no string.

## P7. Order I would take

1. P1 (cache). No UI change, no test change.
2. P3 + P4 in the library autocompletes, P5 exports, P6 text alignment. Library-only, defaults keep every other admin unchanged.
3. Chips: after the store unification, or P2 now.
4. DAM switches its non-upload callers first (`AssetMetadata.vue`, `AssetLicenceEditForm.vue`, the five author-chip pages, `AuthorListView.vue`): they have no path mocks and exercise the library components in DAM before the queue depends on them.
5. DAM's row and sidebar switch (or are replaced by the library's), with the four test mocks of risk 1 moved to the entry mock in the same change. Then delete DAM's KA, KC, AA, AC, ACC, ACB; `authorConfig.ts` / `keywordConfig.ts` go when `AssetMetadata.vue` has switched.

What stays in DAM at the end: `KeywordCreateButton.vue`, `keywordValidation.ts`, `authorActions.ts`, `keywordActions.ts`, both api files, both filter files, `AuthorRemoteAutocomplete.vue`, and optionally the two cache shims and `authorValidation.ts`.

## Decisions the owner has to make

1. Disabled look of keywords/authors in a waiting row (P4).
2. English title of the author dialog (B9).
3. Whether an unresolved author/keyword should show `#id` (P6) - a small visible change on both sides, justified as a bug fix.
