# OP12-L4 (with c1) — review (Claude, adversarial)

Scope: `krok5-praca/zaplaty/OP12-L4.diff` against the snapshot `krok5-praca/snap/OP12-L4`; briefs `zadanie-OP12-L4.md`, `zadanie-OP12-L4-c1.md`, `PRAVIDLA.md`; note `impl/OP12-L4.md`. `diff -rq` of the snapshot's `src` and the tree shows exactly the 14 patched files under `src/` (plus the changelog), so this covers OP12-L4 alone. Read-only; I ran no vitest and wrote no file but this one.

Evidence besides reading the changed files whole:
- installed Vuetify 4.2.6 (`VAutocomplete.js`, `VTextField.js`, `composables/validation.js`), Vue 3.5.44 (`@vue/reactivity` watch job, `@vue/runtime-core` emit);
- the library's and admin-dam's ROI panels (`AssetDetailSidebarROI.vue` in each tree);
- the step's logs: `vysledky/OP12-L4-testy.log` (348 files, 5 072 cases green), `OP12-L4-lib-browser.json` (all 5 072 `failureMessages` empty: no case passed on a retry), `OP12-L4-linty.log` (green).

"By reading" below means traced through the sources cited, not run.

## Findings

### 1. Medium — clearing a one-value filter whose value is its non-null default leaves the field and `filterSelected` empty while the filter keeps the default (regression of this step)

Where:
- `src/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue:239-241` (`onClickClear` is now `clearField()`, `:230-233`), `:283-293` (`onSelectedUpdate` writes `filterData[name] = null`), `:327-347` (the watcher of the filter value).
- Order in Vuetify 4.2.6: `VTextField.js:109-116` runs `reset()` and then the `click:clear` handlers in one `nextTick` callback. `reset()` sets the model to `null` (`composables/validation.js:114-116`), which reaches `VAutocomplete.js:446,316-321` and AFilter's `update:model-value` synchronously.
- Vue calls no watch callback when the getter's value is the same at the next run: `node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js:1947-1948`.

Scenario (by reading): a filter field `{ name: 'site', default: 3 }` (one value, clearable), holding 3 (as `createFilterStore` makes it, or after an earlier clear). The user presses the clear icon.
1. `onSelectedUpdate(null)`: `filterData.site = null`, `emit('change')`.
2. Same tick: `onClickClear` → `clearOne` (`filters/composables/filterFactory.ts:202-205`) writes 3 again; `filterSelected.delete('site')`.
3. The watcher's job runs once, finds 3 → 3, and its callback is not called.

Result: `selected` stays `null` (Vuetify's `v-model`), the field is empty, the chip of `AFiltersSelected` is gone, and `filterData.site` is 3: the next submit filters by 3, which nothing on the page shows. Before the step the watcher ran with `null` (reset, list) and, after `onClickClear`'s own fetch, again with 3: `loadListItems(3)` put "3" back into the field and into `filterSelected`.
- Not affected: a filter of several values (`cloneDeep` gives a new array, the watcher runs and loads the default by id), a default that differs from the value, a `null` default.
- The close of the chip of a one-value filter (`:299-303`) has behaved so since OP12-L2 c3 (it called `clearField()` synchronously). This step gives the clear of the field the same behaviour; no case has a non-null default (`AFilterRemoteAutocompleteClear.test.ts:42`, `libraryControlNames.test.ts:261`).
- Exposure: no one-value remote filter with a non-null default in this repository or in admin-dam (`admin-dam/src/domains/coreDam/assetLicence/filter/AssetLicenceFilter.ts:10` is `null`). Other admins not checked.
- The note says the opposite for this case: part 4 "Hodnota a filterSelected sa vyprázdnia ako predtým", and finding 2 "Watcher načíta položky predvolenej hodnoty podľa id".

Fix: after `clearField()`, when the value cleared to is not empty, put it back into the field, e.g. `if (!isEmpty(filterData[props.name])) loadListItems(filterData[props.name])`. When the default differs from the old value the watcher's later call supersedes this one through `byIdsCounter`, at the cost of one by-ids request; to avoid it, keep the value the clear started from and re-apply only when it equals the default. Cases: a one-value filter, default 3, value 3, cleared by the field and by the chip close: the field shows "Group 3" and `filterSelected` has `group`.

### 2. Low — "asks for the list once … and shows the newest answer" does not hold once a search was typed

Where: the search watcher `AFilterRemoteAutocomplete.vue:243-257`; `VAutocomplete.js:41` (`clearOnSelect` defaults to `false`), `:350-352`, `:178-183`; `doc/changelog/2.0.0.md:212`. The cases put the old search into the inner filter (`AFilterRemoteAutocompleteClear.test.ts:77`) and never type, so the search watcher never runs in them.

Scenario (by reading): the podcast filter of the asset select (`podcastIds`, several values, `dam/assetSelect/components/FilterPodcastRemoteAutocomplete.vue:36` `prefetch="hover"`). The user types "pod", ticks two podcasts (Vuetify 4 keeps "pod" in the field), and presses the clear icon while still in the field.
- The watcher of the filter asks `apiSearch('')`; 300 ms later the search watcher sees '' after 'pod' and asks `apiSearch('')` again: two requests for one clear.
- With `prefetch: false` (keywords and users: `DamKeywordFilterRemoteAutocomplete.vue:36`, `DamUserFilterRemoteAutocomplete.vue:35`) there is one request, but at 300 ms the search watcher empties `fetchedItems` without a counter: an answer that came before is wiped, one that comes after stays. What the list shows depends on the network.

Pre-existing (the old clear asked more often), not a regression; but the changelog line and the note promise more than the code does, and the brief's "one clear starts one fetch" holds only for an empty search.

Fix: let the clear own the request (the search watcher ignores the emptying of the search a clear causes), or narrow the changelog line and the note. Add a case that types a search, for several values, with `prefetch` set and with `false`.

### 3. Low — the cropper's guard knows "the shown file" only by its id

Where: `src/domains/dam/cropper/components/DamAssetImageRoiSelect.vue:76-89`.

(a) admin-dam's change of slot keeps file A in the store while it reads B. `admin-dam/src/domains/coreDam/asset/components/detail/components/AssetDetailSidebarROI.vue:99-114` sets the region to `null` and shows the loader at once, and puts B into the store only when `readFile` (`:69-81`) answers.
- Scenario: a region of slot A saved at t=0; slot B picked at t=1.9; B's read takes 300 ms. At t=2.0 the timer still finds A shown and reads it; at t=2.1 it writes A and hides the spinner of the change of slot. The cropper draws A without a region until B lands.
- The cases model the change of slot as an instant `setImageFile(file-b)` (`damRoiLateRead.test.ts:82,92`) and do not see this window.

(b) A rotation reads the same file anew.
- The rotate buttons of the library's panel are not gated by the loader (`dam/assetDetail/components/AssetDetailSidebarROI.vue:163-169`, `AssetFileRotate.vue:33-44`). `afterRotate` → `loadRois(true)` → `loadImageFile` puts the rotated file into the store (`:54-57,59-80`); admin-dam does the same (`:86-97`).
- Scenario: rotation pressed during the two seconds. The timer's read is served before the rotation takes effect but answers after the panel's read: it writes the file before the rotation over the rotated one. Its width and height then feed `regionToCrop`/`cropToRegion`, its `manipulatedAt` the image and preview URLs.
- Pre-existing race, the same late write this step closes for another slot.

Fix: apply only while the store holds what the read started from and the region that was saved. E.g. capture `const shown = imageRoiStore.imageFile` and `region.id`, and `applies = () => save === savedRegions && !unmounted && imageRoiStore.imageFile === shown && imageRoiStore.roi?.id === regionId` (admin-dam's change of slot clears the region first; a rotation puts a new object). Cases: a change of slot done as admin-dam does it (region `null` and loader at once, file B later), and a newer object of file A put into the store while the read is on its way.

### 4. Low — note and comments that do not say what the code does

- `impl/OP12-L4.md` c1, "Spresnenie nálezu 4": its example of who hides the loader during the save ("Znovu načítať náhľady" of the library) cannot do so: that button is hidden while the loader is on (`AssetDetailSidebarROI.vue:106-123`). In the library only the rotation (not gated, `:163-169`) ends a `loadRois` meanwhile; in admin-dam the change of slot too.
- `impl/OP12-L4.md` finding 1 ("neošetrené odmietnutie") and the comment `AFilterRemoteAutocompleteClear.test.ts:100-101` ("the clear threw, unhandled"): the TypeError was thrown in an `update:search` handler, which Vue's `emit` runs through `callWithAsyncErrorHandling` (`@vue/runtime-core/dist/runtime-core.esm-bundler.js:4631-4637`). It went to the app's `errorHandler` (or the console), which is where the case catches it, not to an unhandled rejection.
- `impl/OP12-L3.md:47-51` still lists the clone at `imageWidgetMultipleAuthorsGivenMeanwhile.test.ts:471` as kept because "falošný DAM ich nenahrádza", while `:64-68` of the same note (corrected in this step) calls it a workaround removed in OP12-L4.
- Line references written before c1: `saved, :96-98` (now `:100-101`), `reloadSavedFile (:75-85)` (`:78-89`), `onUnmounted (:112-116)` (`:117-121`), `AFilterRemoteAutocomplete.vue:232-238` (`:235-241`).

Fix: correct these sentences.

## Checked and found correct

**Test support (part 1).**
- `copyOf` (`fakeDam.ts:157-165`) copies every answer (`:263`) and every recorded body (`:250`). The library sends only JSON text or a `FormData` (`useApiRequest.ts:131`, `useApiFetchItems.ts:142`, `damImageApi.ts:42-45,140-174,227-229,292`, `imageApiCms.ts:112`), so for bodies the switch to JSON changes nothing.
- What JSON loses: no answer of `own()`, a rule or a hold in the files built on the fake carries a `Date`, `File`, `Blob`, `Map`, `Set` or an explicit `undefined` field (grep). The full run is green with no retried case. The JSDoc of `FakeDamAnswer.data` and of `copyOf` says what JSON does.
- The seven changed runs (`uploadPollRead.test.ts:151-168`, two rows × three profiles; `uploadNotificationEvents.test.ts:375-376`) now change the stored asset, which is what `own()` answers from (`fakeDam.ts:231-233`): same answer, same claim. Every other use of what `fileBecomes` returns only reads it or hands it to `updateFromDetail` (`uploadQueueOperations.test.ts:412,615,639,694,710,824`; `uploadPollRead.test.ts:84`), which reads the DAM again on success and copies on failure.
- The two removed clones were dead: the detail gets its asset by a read by file, a copy since OP12-L3, and `keepAuthorsOf` (`consumerProfileImageWidgetMultipleUpload.test.ts:1667-1672`) replaces the stored `authors` instead of writing into a shared array.
- The admin-ugc stand-ins (`consumerImageApi.ts:106-133`) hand out copies; `has()` still returns the stored object, to the test only.
- New cases red on the snapshot by reading: `fakeDam.test.ts:117-155` (`structuredClone` refuses the proxy, keeps the shared entry; `fileBecomes` returned the stored asset) and the three admin-ugc rows of `consumerImageApiCopies.test.ts`; its admin-cms rows are green on both, as the note says.

**Cropper (part 2), apart from finding 3.**
- The read is of the file of the commit (`imageFile` taken before the `await`, `:92,100`).
- Nothing is read when another file is shown at the timer. Nothing is written, reported or hidden when the file changed or the component went.
- `onUnmounted` clears the timer; a save answered after the unmount sets a timer whose read stops at `!unmounted`. A newer save replaces the timer, and the counter drops an older answer.
- The five cases fail on the old code by reading.

**Finding 76 (part 3).**
- The success path gives each row its own lists and a deep copy of the custom data (`uploadQueuesStore.ts:317-319`); the failure path already did (`:341-343`); `authorConflicts` is a new array per row (`assetSuggestions.ts:14-24`).
- Other paths that hand one read to several rows, the settlement's (`uploadSettle.ts:146-156,525-527`), give each row its own lists and its own top-level custom data. Nested values stay shared there, but nothing writes into them in place: `uploadQueueFill.ts:24` replaces with `.slice()`, and the custom data form replaces values.
- Both new cases are red on the snapshot (one shared `assetRes`). The changelog line (`2.0.0.md:135`) says what the code does.

**Clear (part 4), apart from findings 1 and 2.**
- For a `null` or `[]` default and an empty search: one clear, one `apiSearch('')` under the counter. Value and `filterSelected` are emptied.
- `change` is emitted once, as before: from `onSelectedUpdate`, before `clearField`, so a listener that reads the value synchronously sees `null`, as before.
- The chip close calls the same function. A `null` search is '' in `onSearchUpdate` and in the watcher.
- The red-before results (`['grou', '']`, `['grou', '', '']`, the TypeError) check out by reading.

## Outside the step (not weighed)

- `AFormRemoteAutocomplete.vue:337-354` and `AFilterRemoteAutocompleteWithMinimal.vue:234-259` keep both problems this step fixed in `AFilterRemoteAutocomplete`: `query.length` of the `null` search for an unfocused one-value field (a TypeError to the error handler), and a clear that fetches by itself, with the search typed before, outside the counter, writing its answer whenever it comes.
- `AFilterRemoteAutocomplete.vue:171-182`: two `apiSearch` calls on their way share `loading`; the first to end hides the spinner while the second runs (e.g. the two requests of finding 2).

## Verdict

One Medium: finding 1, a regression of the new `onClickClear` for one-value filters whose value is their non-null default (no such filter in this repository or admin-dam). Fix it, with a case, before closing. Findings 2-4 are Low: a changelog claim wider than the code, a guard that could be tighter, and wording. The test-support part and finding 76 are sound; the step's run is green with no retried case.
