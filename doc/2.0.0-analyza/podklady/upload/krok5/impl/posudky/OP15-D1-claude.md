# OP15-D1: adversarial review (Claude)

Scope: step OP15-D1 in `/home/volar/projects/anzusystems/admin-dam` (patch `krok5-praca/zaplaty/OP15-D1.diff`, 4 files,
473 lines; snapshot `krok5-praca/snap/OP15-D1`). Paths are relative to admin-dam unless absolute. Read-only, nothing
run. The working tree matches the patch (diffed against the snapshot). Read whole: `AssetFooterSelectedFull.vue`,
`assetDetailStore.ts`, `assetListActions.ts`, `AssetListView.vue`, `MainWrapper.vue`, `AssetListSidebarMetadata.vue`,
`AssetQueueItemEditable.vue`, `assetDetailFileChange.ts`, `whileOnPage.ts`, the bulk part of `assetApi.ts`, both test
files; from `node_modules`: the library's `AUnsavedConfirmDialog`, `ATableEditButton`, `commonVuetifyConfig`, Vuetify
4.2.6 `VBtn`, `VDialog`, `stack.js`, `focusTrap.js`. Logs: `pracovne/impl-dam-op12/log/op15-*.log`,
`pracovne/impl-dam-op12/bends/op15-bez-otazky.log`, `vysledky/OP15-D1-*.log`.

## Answers to the checks

1. **Both buttons: correct and complete.** Identical code (`src/domains/coreDam/asset/components/footer/AssetFooterSelectedFull.vue:134-139`,
   `:161-166`), after validation, before the request. "Zostať" returns before `try` with the spinner off: nothing sent,
   nothing read, the mass edit open. "Odísť aj tak": `answerLeaveUnsaved(true)` sets `typedLeft`
   (`assetDetailStore.ts:173-179`), the save goes out, `readAgainIfSaved` -> `showLoader()` leaves `typedLeft` alone
   when no question is open (`:197-201`), so `panelHoldsUnsavedMetadata` is false behind that read (`:161-163`).
   Texts verified: `src/locales/sk/coreDam/asset.json:198-199,222-223` ("Uložiť a pokračovať", "Uložiť a ukončiť");
   the list's `AUnsavedConfirmDialog` (`AssetListView.vue:200-203`) with the library's "Máte neuložené zmeny. Naozaj
   chcete odísť?", "Zostať", "Odísť aj tak". It is drawn above the full-page mass edit (`MainWrapper.vue:166-175`):
   an overlay activated later gets the last z-index + 10 (`node_modules/vuetify/lib/composables/stack.js:16-18`); it is
   persistent, Esc answers "Zostať" (`AUnsavedConfirmDialog.vue_vue_type_script_setup_true_lang.js:30-35`).
2. **Second press.** By mouse not reachable: the question is modal with a scrim, the pressed button is `loading`
   (`pointer-events: none`, `vuetify/lib/components/VBtn/VBtn.css:237-239`), the other one is disabled
   (`AssetFooterSelectedFull.vue:210,221`). While the save runs after "Odísť aj tak" the spinner is on and no button
   has the focus (the dialog has no activator to give it back to, `VDialog.js:58-65`). By keyboard while the question
   opens: L3.
3. **Panel switching to another asset while the question is open.** No way of the editor gets past the modal (the arrow
   keys are off under a full-page queue, `assetListActions.ts:621,629`); the reads of a file change keep a typed form
   (`assetDetailFileChange.ts:97-135`); whatever replaces the form or starts a read (`setAsset`, `showLoader`, `reset`,
   `hideDetail`) answers the open question "Zostať" (`assetDetailStore.ts:194,200,244,438`), so nothing is sent then.
   Fine.
4. **Failed save.** Nothing read, `typedLeft` cleared, the text stays, the next save asks
   (`src/test/list/massEditAsksPanel.test.ts:291-306`). A race in the clearing: L2. A partial failure: "Na neskôr" 1.
5. **Nothing typed: nothing asked** (`AssetFooterSelectedFull.vue:105`); the guard case is green on the snapshot and
   under the bend.
6. **Red before.** `op15-pred.log`: 5 of 6 red, the guard green. The two "asks first" cases fail on the right assertion
   (`[0, 1]` for `[1, 0]`: no question, the PATCH sent). The "Zostať" and "Odísť aj tak" cases fail by a `TypeError`
   inside `answer()` (`massEditAsksPanel.test.ts:56-59`): no question to click - the right cause, not an assertion. The
   failure case came after the code and is red under the bend only because no question comes; `typedKeptAfterFailure`
   has no case that needs it (the note says so). The rewritten case `src/test/list/olderLimitsPanel.test.ts:477-505` was
   red on the new code before the rewrite (`op15-po.log`). Full check green: 151 files / 2 075 cases; lints green.
7. **Changelog.** The Ctrl/Alt sentence at `doc/changelog/3.0.0.md:133` is now true (the edit button stops the click,
   `AssetTableRowItem.vue:154-159` and the library's `ATableEditButton`; Alt goes to the browser through vue-router's
   guard). Not exact: L1, and L4 for the new entry.

## High

None.

## Medium

None.

## Low

### L1. Changelog: a wrong pointer and a loose clause

- `doc/changelog/3.0.0.md:256` ends "(the next entry)"; the next entry is "A save sent just before its asset was
  deleted…" (`:257`), the mass edit entry is `:288`. Fix: "(the entry on the mass edit below)".
- `:236` "is read again when it was among the saved ones … - once the question about what was typed into the panel was
  answered "Odísť aj tak"": reads as if every read after a bulk save waited for a question; with nothing typed none is
  asked. Fix: "…; when what was typed into the panel was asked about first, once "Odísť aj tak" was answered (…)".

### L2. `typedLeft`, set at the answer, has to last the whole save; other questions meanwhile change it

Where: `AssetFooterSelectedFull.vue:112-114,145,177`; `assetDetailStore.ts:173-179,197-201`.

"Odísť aj tak" sets `typedLeft` before the request. While the request is on the wire no loader is up, so every other
way still asks about the same text (correct: the save can fail). Two races follow from the one shared flag:

- Failure: during the save the editor puts the mass edit away (its chevron) and clicks another tile -> asked ->
  "Odísť aj tak" -> that tile is read behind the loader. The save fails while that read is on its way:
  `typedKeptAfterFailure` clears `typedLeft`, `panelHoldsUnsavedMetadata` is true again behind a loader that was let
  go, and a click on a third tile, the arrow keys, a way out of the page and a reload ask once more about text that
  read is about to replace; "Zostať" keeps nothing.
- Success: the same, but the save is answered while that tile's question is still open: `readAgainIfSaved` ->
  `showLoader()` answers it "Zostať" and sets `typedLeft = false`; the click is dropped, and behind the loader of the
  read after the mass save the panel asks again - what `:256` now says does not happen. The same with "Upraviť" of a
  mass-edit row pressed during the save (the mass edit need not be put away).

Fix: in the catch `if (left && !assetDetailStore.loader) assetDetailStore.typedLeft = false` (with typed text a loader
is up only for a read that was let go, and its `hideLoader`/`setAsset` clears the flag). For the success path hand the
answer to the read: `refreshDetailAsset(savedAssetIds, left ? held.id : null)`, and in `readAgainIfSaved` right after
`showLoader()` `if (shown.id === leftId) assetDetailStore.typedLeft = true`.

### L3. A second key press while the question opens takes away the first press's spinner

Where: `AssetFooterSelectedFull.vue:125-139,152-166`; `assetDetailStore.ts:166-171`; `VDialog.js:47-54`; `VBtn.js:184`.

Pressed by Enter, the button keeps the focus (`loading` gives it `tabindex=-1`, which does not blur it) until the
question's enter transition ends and `onAfterEnter` moves the focus into the dialog. A second Enter or Space in that
window runs the handler again: `askToLeaveUnsaved()` answers `false` at once because a question is open, `left` is
`null`, and the spinner goes off. The first question stays with neither button spinning; after "Odísť aj tak" the save
runs without a spinner and with the other button enabled, and a further press asks again and sends a second bulk save
beside the first. (Before the step a double Enter sent two saves outright; not worse, but the new `null` branch turns
off a spinner it does not own.)

Fix: return at the top while the button spins: `if (list.value.length === 0 || saveButtonLoading.value) return` in
`onSave`, the same with `saveAndCloseButtonLoading` in `onSaveAndClose`.

### L4. Asked, and read, for a row the save does not send

Where: `AssetFooterSelectedFull.vue:97,105`; `src/domains/coreDam/asset/api/assetApi.ts:212-213,241-243`.

`assetIdsToSave` takes every row with loaded metadata (`hasMetadataToSave`), but `bulkUpdateAssetsMetadata` leaves
out the row of a described asset that nobody changed (`assetApi.ts:241-243`), and makes no request when every row is
so. A Shift range always takes the active tile, i.e. the panel's asset: with text typed into the panel and only other
rows edited (or "Vyplniť prázdne" that leaves its row as it was), the save asks although nothing of that asset goes
out; "Zostať" holds back the whole mass save, "Odísť aj tak" reads the asset and drops the text for nothing (before the
step the same read dropped it without a word). The new entry `:288` "that save the asset the panel beside the list
holds" says less than the code asks about.

Fix: take the ids from the rows that go out - export from `assetApi.ts`
`metadataBulkAssetIds = (items) => listItemsToMetadataBulkItems(items).map(({ dtoItem }) => dtoItem.id)` and use it in
`assetIdsToSave`; the read after the save then skips unchanged assets as well.

## Na neskôr

1. After "Odísť aj tak" the panel can keep the text over a form older than what the mass save wrote: a later batch fails
   (11 rows or more, ten a batch, `assetApi.ts:65,341-365`) after the batch with the panel's asset went through, and
   nothing is read (`AssetFooterSelectedFull.vue:144-146`); or the read after a good save fails and the panel keeps what
   it had (`:80-82`). The panel's "Uložiť" sends the whole form (`assetApi.ts:385-395`) and writes the older keywords,
   authors and custom data back over the mass save. Older, the same path. Later: let the thrown error carry the ids of
   the batches that went through, and read those in the catch.
2. Text typed into the panel while the save is on the wire (the mass edit put away during it) is replaced by the read
   after the save without a question: the check runs at the press only. A race of the older kind.
3. "Zostať" leads the editor to save the panel first; that save writes its values into the asset's row of the mass edit
   and makes them the row's baseline (`uploadQueuesStore.ts:742-761`, called at `AssetListSidebarMetadata.vue:117`):
   what was edited in that row goes without a word, and the next bulk save does not send the row. Older design
   (changelog `:235`).
4. Tests: no case needs `typedKeptAfterFailure`, none covers "also while a save of the panel is on its way".

## Verdict

Correct for both buttons on every path an editor normally takes; the question is the existing one, drawn on top, and
nothing is sent after "Zostať". No High, no Medium. Four Lows (a doc pointer, two races of one shared flag, an over-ask
for unsent rows) and four items for later.
