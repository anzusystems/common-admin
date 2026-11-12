# OP13-L1: adversarial review (Claude)

Basis: patch `krok5-praca/zaplaty/OP13-L1.diff` (37 files, 2 838 lines; matches `git status`: 29 modified + 8 new),
tree `next` at `96792faa` plus the uncommitted step, snapshot `krok5-praca/snap/OP13-L1/src`. Read whole: IWI, IMWI,
IWMI, DDA (`imageDialogDamAuthors.ts`), `useImageMassOperations.ts`, the three autocompletes,
`DamAssetImageRoiSelect.vue`, the library's and admin-dam's `AssetDetailSidebarROI.vue`, `ImageDetailDialogMetadata.vue`,
`AFileInputDialog.vue`, `ACachedUserChip.vue`, `iconButtonNames.test.ts`, every new and changed test (in the patch), the
brief, PRAVIDLA, the note, the notes OP12-L1 to OP12-L4. Vuetify 4.2.6 read in `node_modules/vuetify/lib` (VTextField,
VAutocomplete, VChip, `composables/validation.js`). Logs read, not re-run: `pracovne/impl-lib-op12/l13-pred-*.log`,
`ohyb-l13-*.log`, `vysledky/OP13-L1-testy.log`, `OP13-L1-linty.log`. I ran nothing (no tests, no bends).

## Findings

### High

None.

### Medium

**M1. Point 10: the "Refresh" of the ROI panels is offered during a region save and its 2 s wait. In the library's
panel a press then drops the cropper's own read.**
- Code. The save no longer turns on the store's loader (`DamAssetImageRoiSelect.vue:115`, `:86-87`). Both panels show
  "Refresh" only while that loader is off: library `AssetDetailSidebarROI.vue:106-123`, admin-dam
  `src/domains/coreDam/asset/components/detail/components/AssetDetailSidebarROI.vue:146-151`. Before the step the button
  was hidden from the save until the read after it, and the OP12-L4 c1 note relies on that (`OP12-L4.md:159-162`).
- Scenario, library asset detail on the ROI tab (the image widgets' "edit asset" opens it):
  1. The user commits a region. The cropper shows its own spinner; the panel still shows the old previews and "Refresh".
  2. The user presses "Refresh" within the 2 s. `loadRois(true)` puts a newly read file object into the store
     (`AssetDetailSidebarROI.vue:54-57,67-70`).
  3. At 2 s `isStillShown` fails on object identity (`DamAssetImageRoiSelect.vue:88-92`), so the cropper reads nothing.
  4. If the panel's read came before the DAM redrew (the reason for the 2 s), the cropper (`:key` is `manipulatedAt`,
     `:150`) and the previews (`?manipulated=`, panel `:156`) stay on the old drawing until another "Refresh".
- admin-dam. Its "Refresh" only bumps `timestampRoiPreviews`, and the previews are cached by URL (`assetRoi.spec.ts:88`).
  Nothing else redraws them there, so pressing it right after a save is the natural move. That is now possible before
  the redraw, and the previews stay stale.
- The note (`:126`) and the changelog (`:211`) say only that the panel no longer shows loading.
- Inferred, not measured: that the DAM's redraw can take longer than the press. That is what the 2 s wait assumes.
- Fix, any of:
  - keep a "busy" state for the cropper's save and read that the store shows, added on top of what is there (e.g. a
    `regionSaving` flag set and cleared where `saving` is), and show the library panel's "Refresh" only when it is off
    (admin-dam in its own step);
  - let the cropper still read when the store holds a newer object of the same file id and region id while its save is
    the latest;
  - at least, say it in the note and the changelog.

### Low

**L1. Point 2 with `expandMetadata`: the watcher empties the form in the page of a pick not yet confirmed, while the
widget still shows the picked image. The host's confirm then saves nothing.**
- In expand mode a pick or an upload leaves `metadataDialog` true until the host confirms (`ImageWidgetInner.vue:629,943`).
  It also replaces the widget's image with the pick (`:704-707`, through `reload(…, true)` at `:539-555`).
- Turned read-only, the watcher calls `onMetadataDialogClose()` (`:1031`), which runs `setDetail(null)` (`:753`).
- Editable again:
  - the form (`ImageDetailDialogMetadata.vue:132-203`) has no detail and draws nothing;
  - expand mode draws no "edit" button (`:1089`);
  - the preview still shows the pick, while the model keeps the old image;
  - `metadataConfirm()` reaches `onMetadataDialogConfirm`, which returns at `:765` without a word.
    `afterMetadataSaveSuccess` never comes, and the embed dialogs wait for it.
- Before the step the form came back with the pick. No cancel of the user reaches `onMetadataDialogClose` in expand
  mode: `ImageDetailDialogMetadata.vue:111-114` is the VDialog's only. IMWI is the same (`:1211`, `:850-852`).
- Not reachable today. The only expand-mode widgets (admin-cms `EmbedImageDialog.vue:118-128`, admin-ugc
  `EmbedImageDialog.vue:123-133`) bind no `readonly`.
- Fix, either of:
  - in expand mode, give the lock back without emptying the form (only `metadataDialog = false`);
  - discard consistently and restore the widget's own image too.
- Add a case with `expandMetadata`.

**L2. Point 3: an extra request can happen at two places. That is the brief's stop condition, and the note does not
say where.**
- How the lookup works. `getExtSystemByLicence` (`damConfigState.ts:312-331`) answers from
  `damConfigLicenceExtSystem`, otherwise it GETs the licence. Only a success is cached.
- No new request in practice where the asset was picked:
  - the outer widgets load their `uploadLicence` and `selectLicences` at mount (`AImageWidget.vue:94,113`,
    `AImageMediaWidget.vue:99,118`, `AImageWidgetMultiple.vue:70,90`, cache filled at `damConfigState.ts:283`);
  - the pickers list only those licences;
  - this covers IWI `:673,812`, IMWI `:816,975` and IWMI `:326`.
- A new request is possible at two places:
  - the gallery save (`ImageWidgetMultipleInner.vue:627`);
  - "fill empty" (`useImageMassOperations.ts:49-53`), which looks up every distinct licence of every row, also rows
    it does not fill.
  - Both go by `dam.licenceId` of rows loaded from the entity (`ImageWidgetMultipleInner.vue:145,166-178`). A licence
    outside the widget's select and upload licences is read once per page, before the names. A failure is logged,
    falls back, and is asked again next time.
- Does it matter: not functionally (one GET, rare, safe fallback). But the brief said to stop or to say so, and the note
  (`:41`) says only "reads the licence once and remembers it".
- Fix that needs no request: at those two places read only the cache
  (`useDamConfigStore().damConfigLicenceExtSystem.get(licence)?.extSystem ?? fallback`). Or name the two places in the
  note.

**L3. The note's outside finding 3 is wider: the author inputs of the dialog and of the row list authors of
`cachedExtSystemId` too.**
- `ImageDetailDialogMetadata.vue:166,260` and `ImageWidgetMultipleItem.vue:128` (like `ImageMassOperations.vue:160`)
  use `cachedExtSystemId`. The picker sets it to the ext system of its licence (`assetSelectListActions.ts:168,180`).
- The names of those picks are now looked up under the asset's licence: A2 at `ImageWidgetInner.vue:812` and IMWI
  `:975`, the gallery save at `ImageWidgetMultipleInner.vue:627`.
- Where the two ext systems differ, a picked id may not be found, and the source is written empty or short. Today's
  data are the same, so nothing happens now.
- Fix: note it for A2 and the gallery save, as for "fill empty".

**L4. Point 5 adds a list search beside the by-id read of a clear onto a non-empty default. Whichever ends first hides
the spinner.**
- `AFilterRemoteAutocomplete.vue:247-254` starts `apiSearch('')` while `loadListItems` runs (from the watcher at `:358`,
  or here for a held default).
- `loadListItems` turns `loading` off in its `finally` whatever else runs (`:164-166`). `apiSearch` turns it off when it
  is the latest (`:181`).
- WithMinimal is the same (`:266-268`, with `showValue` at `:331-333,345-347`).
- So point 7's rule ("hide it only when the latest request ends") does not hold on the very path point 5 adds. The note
  files the shared spinner as outside the step (its outside finding 2). Cosmetic.
- Fix: count pending requests for `loading`, or let `loadListItems` leave it on while a search runs.

**L5. Changelog and note, point 6: the old clear did empty the value at once; a non-exported name; a missing caveat.**
- "Emptied the value only after it" (changelog `:213`, note `:79-80`) is not what happened. Vuetify empties the model
  before `click:clear`: `VTextField.js:109-115` calls `reset()`, which sets the model to null (`validation.js:114-116`),
  and `VAutocomplete.js:316-320` empties the selection. That reached `onAutocompleteModelUpdate`
  (`AFormRemoteAutocomplete.vue:389-401,459`) and WithMinimal's `onSelectedUpdate`. What came after the answer was
  AForm's second `modelValue` write and WithMinimal's default (`clearField`).
- The entries name `AFilterRemoteAutocompleteWithMinimal`, which `lib.ts` does not export. The component admins have is
  `ADamAuthorFilterRemoteAutocomplete` (`lib.ts:518,840`), the name the changelog uses elsewhere (`:209`).
- "One request … as the clear of AFilterRemoteAutocomplete does": with a search still typed, AForm asks again 300 ms
  later when it prefetches, or empties the list when it does not (`AFormRemoteAutocomplete.vue:366-381`). The AFilter
  entry (`:212`) says so; the new entry does not.
- Nit in the note: the IWMI cancel of reordering is at `:746` (snapshot `:740`), not `:736`.
- Fix: reword these sentences.

**L6. The changelog misses the new public prop `chipProps` of `ADamAuthorCachedChip`.**
- The component is exported (`lib.ts:1557`); the prop is at `AuthorRemoteAutocompleteCachedAuthorChip.vue:27,37,101`.
- Only `closeLabel` of `ACachedUserChip` is named (`:209`).
- Fix: add one clause.

**L7. The changed case `consumerProfileImageWidgetLibrary.test.ts:2137-2151` no longer pins the read-only guard of
FE-54.**
- Point 2 now closes the dialog first, so `imageOfHeld()` (`imageDialogDamAuthors.ts:65-68`) is null either way.
- With `readonly()` taken out of `:113`, the read would only drop `held` (`:120`). The case does not look at `held`, so
  it would stay green.
- The guard still matters where the image stays shown (`expandMetadata`).
- Fix: assert what the guard keeps (editable again, "edit image" reads anew and offers the pick), or add an
  `expandMetadata` variant.

**L8. Point 2 tests: two claims of the note are not pinned.**
- The case of a loading pick (`imageWidgetsReadonlyWithDialog.test.ts:189-219`) checks `lock.released` only after
  `reads.release()`. Nothing asserts that the lock is held until then (note `:29-30`).
- No case covers a save that fails while the widget is read-only, where the watcher closes the dialog once
  `metadataDialogSaving` falls (note `:27-28`).
- Fix: `expect(lock.released).toEqual([])` before `reads.release()`, and one failing-save case through the image API
  stand-in.

## The decisions

**Point 2: sound for the dialogs, apart from L1.**
- What closes is exactly what is drawn under `!readonly`: IWI `:1083,1237`, IMWI `:1263,1446`.
- The picker, the asset detail and the upload dialog are drawn always (IWI `:1255-1293`, IMWI `:1471-1499`). They keep
  the lock while open, as they should.
- The lock goes back once, through the existing watchers: `clickMenuOpened` for the menu, `anyWidgetDialogOpened` for
  the dialog. `releaseFieldLockLocal` is guarded by `lockedLocal` (`:207-212`).
- A pick still loading holds the lock through `assetPicksPending` until its read ends, as a cancel by the user does.
  `answerTakenFor` (`:309-316`) refuses its answer, so nothing reopens. The waits of `actionEditMeta` are let go
  (`cancelSaveWait`, `answerTakenFor`).
- A save on its way:
  - the A2 part already stops on `props.readonly` (`:781`), and an image save already sent runs on;
  - so the exception for a saving dialog cannot be seen in any outcome (closing it at once would end the same way);
  - that is also why the "save on its way" case cannot tell the two apart. Harmless.
- A confirm waiting for the FE-54 read (`confirmWaits`, not `metadataDialogSaving`) is dropped by the close, through
  `watch(shownImage, dropWaitingConfirm)`. That matches today, where its `again()` reached an unmounted form.
- Gallery unchanged, correctly: under `!readonly` it draws only the upload and library buttons
  (`ImageWidgetMultipleInner.vue:790-816`), and it has no field lock.

**Point 3:** see L2. No request where the asset was picked; possibly one per unknown licence at the gallery save and
"fill empty"; it does not matter functionally, but the brief's condition is met there.

**Point 4: sound.** Read at `imageDialogDamAuthors.ts:102-127,191-204`.
- The FE-54 answer is reused only for the same `HeldAsset` object, noted at the press.
- A failed FE-54 read (`null`) or another held asset is read anew.
- `detailAssetRead` resolves to the latest chained read, and "edit asset" cannot be pressed again while the dialog
  loads, so the newest answer wins.
- The reused read was sent before the press. An author given in that window is still caught by A2 before any write.

**Point 8: sound.**
- Read in Vuetify: the slot props (`VAutocomplete.js:600-617`) carry `onMousedown` with `preventDefault` and
  `stopPropagation`, and the control's mousedown toggles the menu (`:184-187`). Passing `onMousedown` would stop a press
  on the chip from opening the list.
- Keyboard is not lost: the close is a native button (`VChip.js:133-141,268-281`).
- Remark: `modelValue: true` is not passed either. Where the value does not follow (an admin's one-way `model-value`),
  the cached chip still hides itself on close, unlike Vuetify's own. Passing it too would not change the press. No admin
  makes these chips closable today (checked the Vuetify defaults of admin-cms, admin-ugc and admin-dam).

**Point 9: sound.**
- Five root chips plus the `ACachedUserChip` prop. A caller's attribute wins through fallthrough, pinned by "names it as
  its caller does".
- On the snapshot the guard flagged exactly these 7 chips (`l13-pred-9-guard.log`).
- Chips drawn through `AChipNoLink` (`AJobPriorityChip`, `ALogLevelChip`, `AssetFileFailReasonChip`) inherit the label.

**Point 10: the mechanism is sound and as the brief prefers. M1 is its cost.**
- The store file is untouched.
- Every exit turns `saving` off: a failed save (`:122`) and every path of the read (`:103-106`). Unmounting takes the
  loader along, and admin-dam's loader of the slot change is not touched.
- The rewritten OP12-L4 c1 case is legitimate. With the cropper hidden while `saving`, a second save before the read
  cannot happen, and the rewritten case is red on the snapshot.
- `savedRegions` stays as a guard that no case can reach now.

**The implementer's outside findings:**
- 1 is verified: `UploadQueueDialog.vue:146-194` emits `apply` and leaves the close to the widget, and IWMI `:474`
  returns before `:490`.
- 2 is verified.
- 3 is verified but wider (L3).

## Actions touched (check 2)

- **Point 1:** synchronous, no request.
- **Point 2:** see the decisions. Repeated flips (on, off, on) are idempotent.
- **Point 3:** every new `await getExtSystemByLicence` sits before an existing guard:
  - `answerTakenFor`: IWI `:691`, IMWI `:832`;
  - `authorsSendIsOver`: IWI `:818`, IMWI `:981`;
  - `unmounted` and `readonly`: IWMI `:633-634`;
  - `imageStore.readonly`: mass operations `:67`.
  - A failed licence read falls back.
- **Point 4:** a double press lets the second opening own `loadingInDialog`, and the answer is taken once. A widget that
  is gone is checked through `disposed` and `unmounted`.
- **Points 5 to 7:**
  - each clear raises the counter; an older answer is dropped and leaves the spinner on;
  - a failure is said once, and the latest request turns the spinner off;
  - a `null` search is guarded at both entries (`onSearchUpdate` and the watcher);
  - defaults: AFilter reads by id through the watcher or the held-default branch; WithMinimal uses `showValue`; AForm
    has none;
  - chips: closing an AFilter chip of one value goes through `onClickClear`, so it asks for the list too; the chips of
    WithMinimal and AForm are unchanged.
- **Point 10:** see the decisions.

## Public API (check 3)

- Additions only:
  - `ACachedUserChip.closeLabel` (default `common.button.remove`);
  - `ADamAuthorCachedChip.chipProps` (and the same on the keyword chip, which is not exported);
  - the close of the five chips is now "Remove", and a caller can override it.
- No export removed, no type changed, every `defineExpose` unchanged.
- `useDamImageRoiStore`: `cropper/store/imageRoiStore.ts` is not in the patch, and its members are unchanged.
  `ADamAssetImageRoiSelect` no longer calls `showLoader` or `hideLoader`, so an admin that reads `loader` sees no save
  (M1).
- The exported `AFormRemoteAutocomplete`, `AFilterRemoteAutocomplete`, `ADamAuthorFilterRemoteAutocomplete` (through
  WithMinimal), `AImageMassOperations`, `AImageWidget`, `AImageWidgetMultiple` and `AImageMediaWidget` behave as the
  changelog says, apart from L5.

## Tests, bends, changelog and note (check 4)

- **New cases:** 52 in 8 new files (5 076 → 5 128 matches). I read the reasons they were red on the snapshot in the
  logs, and they are the right ones:
  - point 2: lock `[]` instead of `[12]`, and the dialog came back;
  - point 3: the name was looked up "in 1" instead of "in 2";
  - points 5 to 7: searches `['grou']` or `[]` instead of `['']`, a TypeError, and spinner `false` instead of `true`;
  - point 9: the guard flagged the 7 chips;
  - point 11: `held.stop is not a function`.
- **Bends:** all 12 red (`ohyb-l13-*.log`).
- **Full check:** tests 356 files / 5 128 cases green, linters green. Both parts started after the last source edit:
  two test files changed at 19:07:00, linters started at 19:07:02, tests at 19:07:28.
- **Changed existing cases,** each for a reason the brief gives:
  - point 1: MultipleUpload "gives the row the widget had …" and "gives them to every row of that asset …";
  - point 4: Library "drop a confirm that waits …" and "take a confirm pressed anew …";
  - point 2: Library `:2137` (but see L7);
  - point 3: the `ImageMassOperations.test.ts` mock;
  - point 10: `damRoiLateRead` c1 and `damRoiLoaderOnFailure`;
  - point 11: `fakeDam.test.ts`;
  - point 9: the self-test in `iconButtonNames`.
- **Changelog and note:** see L5 and L6. The consequence in M1 is stated in neither.

## Outside the step (old, not caused by the step)

- **O1. A pick or an upload confirmed while the widget is read-only is dropped without a word.**
  - The picker and the single upload dialog are drawn whether or not the widget is read-only (IWI `:1255-1293`, IMWI
    `:1471-1499`).
  - `onAssetSelectConfirm` and `onAssetUploadConfirm` return early (IWI `:601-602,932-933`; IMWI `:675-676,1106-1107`),
    and the single dialog closes itself (`UploadQueueDialogSingle.vue:88-92,171-178`).
  - The gallery's variant, where the dialog stays open, is the note's outside finding 1.
- **O2. Mass operations and the gallery's pick can write into another gallery.**
  - `replaceEmptyAuthors` has no guard for a widget that is gone. After its awaits (now two, and maybe licence reads)
    it writes into the page's shared `useImageStore`, so into the rows of a gallery drawn after the one it was pressed in
    (`useImageMassOperations.ts:40-82`; the store is reset at `ImageWidgetMultipleInner.vue:129`).
  - The gallery's pick is the same: `addImages` after its reads (`ImageWidgetMultipleInner.vue:401,422`).
- **O3. `getExtSystemByLicence` caches only successes and does not share a read in flight** (`damConfigState.ts:312-331`).
  A licence whose read fails is asked again at every lookup, and lookups of the same uncached licence at the same time
  each send a request. This step adds callers.
- **O4. In expand mode the lock waits for the host's confirm.** A pick or an upload keeps `metadataDialog`, and with it
  the field lock, until the host confirms (`ImageWidgetInner.vue:629,943`). This is the background of L1.

## Verified and inferred

- **Verified by reading:**
  - every statement above that carries a file:line;
  - the Vuetify paths, in `node_modules` 4.2.6;
  - the counts, from the logs (not re-run);
  - the admins' use of `expandMetadata` and `readonly`, by grep in admin-cms, admin-ugc and admin-dam.
- **Inferred:**
  - the stale result in M1, which depends on how long the DAM's redraw takes;
  - how often a gallery holds rows from licences the widget did not load (L2);
  - the merge order in Vue between a component's own `close-label` and a caller's `closeLabel`. A passing case pins it;
    I did not read it in Vue's source.
