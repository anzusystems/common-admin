# OP13-L3: adversarial review (Claude)

Basis: patch `krok5-praca/zaplaty/OP13-L3.diff` (34 files, 2 005 lines). `diff -rq` of `snap/OP13-L3/src` against the
tree gives the same 33 source files; the 34th is the changelog. Read whole: `uploadQueuesStore.ts`,
`UploadQueueDialog.vue`, `UploadQueueDialogSingle.vue`, `assetSelectListActions.ts`, `assetSelectStore.ts`,
`AAssetListInner.vue`, `AAssetSelect.vue`, `useCachedItem.ts`, `defineCached.ts`, `cachedAuthors.ts`, the three name
chips, `AuthorRemoteAutocompleteWithCached.vue`, `AssetDetailSidebarMetadata.vue`, `AssetDetailDialog.vue`,
`assetDetailStore.ts`, `AAlerts.vue`, `AUnsavedConfirmDialog.vue`, `ACustomDataForm.vue`, `ACustomDataFormElement.vue`,
`uploadQueueBindings.ts`, `AssetSelectListTiles.vue`, `subject-select.scss`, `table.scss`; `uploadSettle.ts:120-600`,
`uploadSettlement.ts:558-600`. Every new and changed test (in the patch). The brief with its addendum, PRAVIDLA, the
rows (`stare-nalezy.md:30-32,48,77,79,81,86-89,93,94,104`), the note. Logs read, not re-run: `l3-ohyby.py`,
`l3-ohyby.sh`, `l3-ohyb-b13.log`, `l3-ohyb-pred-vsetky.log`, `l3-ohyb-pred-zmenene.log`, `l3-esc-variant.py`,
`l3-esc.log`, `l3-stav.md`, `vysledky/OP13-L3-testy.log`, `OP13-L3-linty.log`. In `node_modules`: Vuetify 4.2.6
(`VChip.js`, `VChip.css`, `VOverlay.js`, `VBtn.js`, `directives/intersect`), Vue 3.5.44 (`emit`, `refreshComputed`),
VueUse 15 (`useDebounceFn`). core-dam-bundle in `petit/core-dam/vendor` (the duplicate check). Admins searched:
admin-dam, petit admin-cms, admin-ugc, admin-blog, admin-forum, admin-inhouse. I ran no test, build, linter or yarn. I
ran one `node -e` simulation (nothing written), described in M1.

## Findings

### High

None.

### Medium

**M1. ZK13: a chip that asks again for its name makes room by dropping the next oldest name. The re-asks cascade
through the names on screen; with more than 1 000 of them they never end.**
- The ask: `useCachedItem.ts:19-27` calls `askFor` when the item is missing: `add([id])` and `fetch()` (chips:
  `AuthorRemoteAutocompleteCachedAuthorChip.vue:45-54`, `AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:29-36`,
  `KeywordRemoteAutocompleteCachedKeywordChip.vue:43-52`).
- The room: `add` prunes first (`defineCached.ts:133-134`). `prune` drops the oldest loaded entries, shown or not
  (`:173-190`). `updateMap` prunes again before each batch of 100 (`:192-200`; `useApiFetchByIds.ts:43`).
- So a re-ask drops the next oldest name. If a chip shows that one, it asks too, and so on, until a name no chip shows
  is dropped.
- Simulation: `node -e` with the same `isCached`/`add`/`prune`/`updateMap`/batched run and Vue 3.5.44's `watch`, limit
  1 000, batches of 100. The debounce is replaced by running the queue again; in the app each re-ask calls `fetch()`,
  which re-arms it (`:279-294`).
  - Full cache, the 600 shown names the oldest, 400 others, 50 new ids added: all 600 chips turn to spinners and are
    read again (7 requests, 650 ids). On the snapshot 50 chips spun.
  - 1 001 shown names: each run sends 10 or 11 requests (about 1 000 ids) and leaves 901 to 1 000 ids to fetch; at
    most 100 names show. No end in six runs. In the app: a new run about 1.5 s after the last `fetch()`, for as long as
    the chips are on screen.
  - 1 000 shown names and 1 other id: one full re-read (11 requests), then it settles.
- Reach: only a chip without a title asks (`AuthorRemoteAutocompleteCachedAuthorChip.vue:50`). The chips an
  autocomplete draws have one (`AuthorRemoteAutocompleteWithCached.vue:246,262`). Without one: conflict chips, the
  chips of disabled rows (`:181-199`), admin-dam's `ADamAuthorCachedChip` pages. Over 1 000 on one screen is unlikely
  today; a cascade on a full cache, on a page left open long, is plausible.
- The brief asked for "the smaller sound fix"; this one is smaller, not sound. The case
  `damNameChipsDroppedFromCache.test.ts:53-66` drops the shown name by adding 1 000 names no chip shows: the only order
  in which one re-ask is enough.
- Fix: the brief's other option, pin what is shown. `useCachedItem` counts the ids its chips show (mount, id change,
  unmount); `prune` skips pinned ids (`defineCached.ts:182-189`), so the cache exceeds 1 000 only by what is on
  screen. A re-ask is then needed only for an id nobody added. A rate limit per id would only slow the loop.

**M2. Older entries of the same changelog still describe the behaviour this step changed.**
- Plainly:
  - `2.0.0.md:163`: the "+" of a conflict chip "is named "Add author" for a screen reader
    (`author.button.addConflict`)". Now "Add author {name}" (`:240`).
  - `:188`: after a failed further page "Load more" "asks again ... when the button has left the view and comes back
    into it". Now only once the list was scrolled meanwhile (`:238`; `assetSelectListActions.ts:181-184`).
- In part:
  - `:179-180`: "the tile of the asset clicked last is the active one"; "closing a detail has the side panel read the
    asset of the tile clicked last". After a click whose read failed, it is now the panel's asset; after "Edit" of the
    panel, the asset the detail showed (`:235`).
  - `:136`: after a failed read "the rows of that asset take the keywords, authors, custom data and single-use switch
    the detail saved". Now only the fields not changed while the read ran (`:232`).
  - `:183`: "'Load more' is not offered until the first page of the new list is asked for". With a request on its way
    it is now drawn, spinning, through the pause (`:237`).
- PRAVIDLA §5 has reviewers compare changelog sentences with the code. The new entries say what "was", so the document
  states both as current. Same pattern as OP13-L2 (its M1).
- Fix: amend these sentences in place, or fold the new entries into them; say so in the note.

### Low

**L1. FE-1: when two detail saves of one asset have their reads out at once, the second keeps the first save's
values.**
- Each `updateFromDetail` notes the rows as it starts (`uploadQueuesStore.ts:358-361`). `writeUnchanged` keeps every
  field that differs from that note, whoever changed it (`:65-83`).
- Scenario, queue dialog:
  1. Save in the detail. The PATCH answers; read 1 goes out (`:363`).
  2. Close the detail while its save still spins; nothing stops it (`AssetDetailDialog.vue:44-48`;
     `AssetDetailSidebarMetadata.vue:65-67` says so).
  3. Open the same row's detail again (`UploadQueueDialog.vue:216-223`), change a field, Save. Call 2 notes the rows;
     read 1 is not back yet.
  4. Read 1 writes save 1 into the rows. Read 2 finds every field changed since its note and keeps save 1. A custom key
     save 1 lacked is deleted from save 2's write (`:75-76`).
  5. The rows hold save 1, the DAM save 2; the next save of the queue sends save 1 back.
- On the snapshot read 2 replaced everything: right in this order (wrong only when the reads answered out of order).
- Narrow: read 1 must outlast a second detail read and PATCH. Inferred, not run.
- Fix: only the latest `updateFromDetail` of an asset writes (a per-asset counter checked after the read, in both
  paths). Its own note keeps what was typed during either read.

**L2. FE-1 is done for typing during the read, not during the detail's save request; the brief says "before the read
answered".**
- The note is taken when `updateFromDetail` starts, after `await sent` (`AssetDetailSidebarMetadata.vue:75-77`). What
  is typed into the row while the PATCH runs (the detail closed right after Save) is in the note, counts as unchanged
  and is replaced, as on the snapshot.
- Changelog `:232` and note `:10-14` say "while the queue read the asset": accurate. The brief point is half done.
- Fix: take the note when Save is pressed and pass it to `updateFromDetail`, or name the remaining window as a limit in
  the note.

**L3. 4(a): a failed read of a dialog closed meanwhile shows its error over the next upload of the same widget.**
- `UploadQueueDialogSingle.vue:204` returns only when the queue has no row. The single widgets reuse their queue key
  (`ImageWidgetInner.vue:514`). Close the dialog (queue stopped and emptied, `:89-93`), drop another file, and let the
  old read fail after that: `item` is the new row, and the old error is shown over the new upload.
  - A computed of an unmounted component still evaluates anew in Vue 3.5 (`@vue/reactivity` `refreshComputed`).
  - The snapshot's check (asset id mismatch) kept it quiet.
- Plausible when the DAM hangs and the user closes and retries; the old read then times out. Inferred.
- Fix: note the row before the await (`const row = item.value`); report only while `item.value === row`. That keeps
  4(a) (same row, new asset) and drops the read of a closed dialog.
- 4(a) itself follows the brief's words. The reported read is of the duplicate's own asset while the dialog shows the
  original read by point 2; the user can do nothing about it. The note flags it (`OP13-L3.md:162-163`).

**L4. 222: the rule assumes a layout change keeps the scroll offset; scroll anchoring moves it.**
- `assetSelectListActions.ts:37-45,175-188` takes a return at the same `scrollTop` for "layout only".
- Neither the library nor Vuetify sets `overflow-anchor` (grep), so Chromium and Firefox anchor. As the side panel opens
  or closes, the tiles above the view reflow and the browser moves `scrollTop` to keep the visible tile in place.
  - The two moves need not cancel; the margin changes over a 0.2 s transition (`subject-select.scss`).
  - In the inline list of admin-ugc the content's margin stays 0, so no anchoring suppression applies.
- Such a return counts as scrolled and asks again, with another error: the limit stays where it matters most.
- The cases (`assetSelectListLimits.test.ts:206-228`) call the handler with no layout change. Note `:64-65` states the
  assumption as fact.
- Inferred from the CSS Scroll Anchoring spec; not tried in a browser.
- Fix: try it with the e2e skill (failed page, list scrolled to the button, panel opened and closed). If it asks again,
  use a scroll the user made (wheel, touch, scroll keys on the scroller while the button is out of view) in place of
  offsets, or drop the automatic retry after a failure (press only; owner decision).

**L5. 4(b) reads for every row `Processing` in any queue; only a row of the asset's licence can become its row.**
- `uploadQueuesStore.ts:355-357`. The DAM finds duplicates within a licence: `ImageStatusFacade.php:63-65` uses
  `findProcessedByChecksumAndLicence` (`AbstractAssetFileRepository.php:63`), called from `store`
  (`AbstractAssetFileStatusFacade.php:268-276`).
- Effect: the telling never goes off (admin-ugc's panel "Edit" included). Every such detail save waits for one more
  GET while any upload anywhere is processed (`AssetDetailSidebarMetadata.vue:76-78` awaits it before "updated"). A
  failing one goes to Sentry (`fetchAsset`, default `report`).
- Fix: `item.licenceId === asset.licence` in `mayBecomeRowOfAsset` (`types/UploadQueue.ts:70`, `types/Asset.ts:78`).
  The changed FE-20 case copies into the asset's licence and keeps its read.

**L6. The new entries: three imprecisions.**
- `2.0.0.md:239`: the chip asks again for a name "the cache has dropped". The code asks for any id missing when the
  chip mounts (`useCachedItem.ts:20-26`, `immediate`), also one its page never added.
  - That is new behaviour of the exported `ADamAuthorCachedChip`. admin-dam draws it in `AuthorDetail.vue:33,41`,
    `AssetLicenceDetail.vue:53`, `AuthorCleanPhraseDetail.vue:24`, `AuthorEditForm.vue:79`,
    `AuthorCleanPhrasePlaygroundButton.vue:112`.
  - The new optional `askFor` of the exported `useCachedItem` (`lib.ts:872`) is not mentioned. The note mentions the
    first (`:164-165`).
- `:237`: "while a list is on its way". The case fixed and tested is a further page on its way
  (`consumerProfileAssetPickersList.test.ts:486-505`); say "a list or a further page".
- `.a-datatable__row--active` loses its styling with no changelog line; removed classes are listed at `:39`. No admin
  uses the class (grep), so optional.

## The implementer's decisions

- 1 (note the fields before the read, replace only unchanged ones, also after a failed read): right for one save; see
  L1, L2. Custom data key by key and the 4(b) row taking all work as the note says.
- 2, 3, 11: right. `UploadQueueDialogSingle.vue:190-209`; an uploaded row can still take a later duplicate
  (`uploadSettle.ts:411-422` skips only `Stop`). `UploadQueueDialog.vue:114-118,159-166`. The prime case stubs the
  rows, so only `prime` (`uploadQueueBindings.ts:64-70`, called at `UploadQueueEditable.vue:123`) asks.
- 4(a): the brief's words; see L3.
- 4(b): the mechanism holds (`uploadSettle.ts:516-544` writes `status` and `assetId` together after reading the
  original); too broad, L5.
- 5 skipped: verified.
  - `AAlerts.vue:65` `:_disable-global-stack="true"`, added in `aef095d0` (28 Sep).
  - VOverlay joins the global stack unless that prop is set (`VOverlay.js:130`). Esc reaches a dialog only while it is
    the global top (`:279-295`).
  - admin-cms's own toast host opts out too (`InAppNotificationToastList.vue:34`).
  - The pin `AUnsavedConfirmDialogEscUnderAlert.test.ts` was never bent; by that code it fails if the alerts go back on
    the stack (inferred). `stare-nalezy.md:104`, third part, is stale (O3).
- 6: right. `setActiveByAssetId` (`assetSelectStore.ts:146-153`) after a failed latest click
  (`assetSelectListActions.ts:227-233`). `detailOfPanel` keeps "read what the detail showed" to the panel's own "Edit"
  (`AAssetListInner.vue:169-183`); `AssetDetailDialog.vue:42-58` hands over what it showed. Corner: with a queue row's
  detail open when the click's read fails, the store's asset is that row's and its tile is marked; consistent once the
  detail closes.
- 7: right in both modes. The tiles keyed by asset id (finding 194, left by the owner) are untouched.
- 8: within the brief. Before: spinning, hidden 200 ms, spinning; now spinning throughout.
  - A press asks nothing: `fetchNextPage` returns on `loader` (`:142`); VBtn does not block clicks while loading
    (`VBtn.js:152-160`).
  - The loader cannot stick: the pending read always runs (VueUse 15 `useDebounceFn` has no cancel on unmount), and
    `reset(true)` clears it (`assetSelectStore.ts:254`).
  - Vuetify observes `v-intersect` anew on every update of the button (`directives/intersect/index.js`, `updated`);
    during the pause `hasNextPage` is not `true`, so nothing is asked.
- 9: per instance and per list turn, as the note says. The new observation on every update records the out-of-view
  offset again; that does not break it. See L4.
- 10: see M1.
- 12: right; the class is used nowhere (grep of the library, admin-dam, the petit admins). Dark theme: O2.
- 13: right; the same words in sk, en, cs; the old key stays for `ImageWidgetInner.vue:512`,
  `ImageMediaWidgetInner.vue:531`.
- 14: right, and nothing on screen changes.
  - Keyboard: a `<button>` as before; the focus order is unchanged.
  - Look: Vuetify's close rules are descendant selectors (`VChip.css:95-104,344-366`) and `.v-chip__content` is
    inline-flex, centred (`:334-337`). The button now sits inside the content, not beside it, with the same margins.
    Read, not rendered.
  - Click: Vuetify's close also set the chip's own model to false (`VChip.js:136-141`). The parent's
    `offeredConflicts` (`AuthorRemoteAutocompleteWithCached.vue:104-108`) takes the chip away instead.
  - The kept `close-label` is never rendered: `closeProps` is read only with a close (`VChip.js:133-142,179,274`). The
    rule test holds root chips because a caller may pass `closable` (`iconButtonNames.test.ts:95-100`).
  - admin-dam's selectors (`src/test/queue/queueRowKeywordsAuthors.test.ts:221,238`) are descendant ones; they match.

## Tests, bends, check

- Red on the snapshot (`l3-ohyb-pred-vsetky.log`): 27 of the 36 new cases; the 9 green ones are the guards and the two
  pins, as the note says. Also the new side-panel case. The 12 changed cases (FE-65 2, FE-74 2, FE-20 2, key 6) were red
  (`l3-ohyb-pred-zmenene.log` and the first run).
- Bends (`l3-ohyby.py`): 15, one per fix. The per-list half of 222 has none (b9 bends the layout rule); its case was red
  on the snapshot.
- b13 fails only because `commonT` has no messages in that file: the log shows "Missing en translation" for both keys,
  so the case compares raw keys. With messages loaded, the two keys give the same words and the case could not fail.
  Note only.
- No case covers M1's cascade, L1's overlapping saves or L4's real layout change.
- The changed cases change for reasons the brief gives: FE-65 and FE-74 are points 6 and 8, FE-20 follows from 4(b),
  the key cases from 13.
- CK: `OP13-L3-testy.log` 369 files / 5 229 green; `OP13-L3-linty.log` green, `lint:tsc` included.

## Public API and admins

- `useCachedItem` (exported): an optional second parameter, compatible. The admins call it with one (admin-cms,
  admin-blog, admin-forum `CachedUserChip.vue`; admin-dam `CachedDamUserChip.vue:29`).
- `ADamAuthorCachedChip` (exported) asks for a missing id itself (L6). admin-dam's pages add the ids too (e.g.
  `authorCleanPhraseActions.ts:86`), so at most the read comes up to 1.5 s later (debounce re-armed).
- The conflict chip is not exported; `class="v-chip__close"` and `data-testid="close-chip"` are kept.
- New keys reach the admins through `messagesSk/En/Cs` (admin-cms and admin-ugc `src/locales/sk.ts:1`). No admin
  overrides `onlyOneFile` (grep).
- `assetSelectStore` and `uploadQueuesStore` are not exported; `unselectAllExcept` stays internal. admin-dam's
  `toggleSelectedByIndex` belongs to its own stores.

## Verified and inferred

- Verified by reading: everything cited with a line; the red-before and bend results from the logs (not re-run); the
  duplicate check per licence in core-dam-bundle.
- Verified by the simulation: M1's cascade and loop, for the algorithm as written (not the running app).
- Inferred: L1, L3 (timing); L4 (scroll anchoring, not tried in a browser); that the Esc pin can fail; that the
  conflict chip looks the same (CSS read, not rendered).

## Outside the step

- O1. The drop-and-spin of ZK13 remains for the generic `ACachedChip` (`src/domains/cached/components/ACachedChip.vue:56`)
  and `ACachedUserChip` (`ACachedUserChip.vue:41`), both exported, and for the admins' user chips on `useCachedItem`:
  none passes `askFor`. A fix there should take M1's way (pinning), not the re-ask.
- O2. FE-76's `outline: 1px solid blue` (`AssetSelectTableRowItem.vue:98-100`) and the tiles' `border-color: blue` in
  the dark theme (`AssetSelectListTiles.vue:216-220`) are about 1.9:1 against #212121 and 2.2:1 against #121212; WCAG
  1.4.11 asks 3:1 for a state indicator. Computed from the colours, not rendered. The note's "visible, lower contrast"
  understates it.
- O3. `stare-nalezy.md:104`, third part of "medze FE-44" (Esc under a fresh alert), no longer holds since `aef095d0`;
  the register should drop it.
