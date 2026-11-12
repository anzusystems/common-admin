# LIB, wave 4: component tests of the DAM upload UI (before step 5)

Written 2026-10-08 on `next`, working tree as it was at 17:30 (nothing committed, nothing of mine committed
either). Only test files and two test-support files were added. No production file, no existing test and no
support file of another agent was changed. Rows asked for: LC1 to LC10 (`9-tests-coverage.md`, 3.4) and B1 to B7,
C1 to C10 (`8-tests-consumers.md`, 7.2).

## Result

`npx vitest run <the 12 files below> --retry=0`, with `TMPDIR=node_modules/.cache/vitest-tmp-lib-w4`:

```
 Test Files  12 passed (12)
      Tests  261 passed (261)
```

Green in three consecutive runs after the last edit, and in three before it (about 21 s each). `yarn lint:tsc` exit 0; `oxlint`, `eslint`
and `oxfmt --check` clean on the 14 files. The repo-wide guard tests in `src/test/` (import cycles, declared
dependencies, i18n keys, component names, public exports) still pass with the new files in place.

One flake was found and removed while writing (see "A trap for whoever writes more of these").

## Coverage table

"Before" = what already pinned the row when I started (file › case). "Now" = what this wave adds.

| row | before | now |
|---|---|---|
| **LC1** row states | partly. `uploadQueueRowRefresh.test.ts`: "the buttons of a row that has not failed" (waiting / being sent / waiting for the server, before and after the wait), "the buttons of a failed row" (13 cases), "the refresh button of an uploaded row still without its metadata". `consumerProfileUploadDialog.test.ts`: duplicate notice with the form of the original, reason chip, unknown error (through the dialog) | `uploadQueueRowStates.test.ts` (30): the `Loading` row; what the picture says per state and the percentage; `cancelItem {index,item,queueKey}`; an uploaded row with metadata has none of the three buttons also after the wait; "done" and `disableDoneAnimation`; "edit asset" disabled without metadata and `showDetail(assetId)`; the title line with the size; the duplicate line; error text: message over reason over "unknown", also on a row that has not failed; form disabled until the metadata; what typing hands the queue; keyword and author inputs |
| **LC2** list: cancel, remove, detail, sidebar | only refresh: `uploadQueueItemRefresh.test.ts` › "the upload queue › refreshes the item whose row asked for it" | `consumerProfileUploadQueueRows.test.ts`: "cancel" (row being sent, row that waits), "remove", '"edit asset"', "the mass operations" (beside rows / not beside an empty queue / room only while switched on) |
| **LC3** queue dialog buttons | partly. `consumerProfileUploadDialog.test.ts` (title, `1/1`, no "save and apply" while unfinished, disabled buttons); `uploadQueueDialogSave.test.ts` (4); `queueRowValidation.test.ts`; `uploadQueueDialogDrop.test.ts` (file input and drop handed to the host: the `filesInput` re-emit, not rewritten) | `consumerProfileUploadDialogActions.test.ts`: '"save"' (3), "the button that closes it" (3), '"edit asset" of a row', "the button of the mass operations" |
| **LC4** stop button | none (only ever a stub) | `uploadQueueButtonStop.test.ts` (6) |
| **LC5** map of an upload to images | the address only: `damAuthorKeywordEndpoints.test.ts` › "the map of an upload to images, by the address it is handed" | `metadataToImageMap.test.ts` (16) |
| **LC6** apply of the queue dialog | one row, position 1: `consumerProfileUploadDialog.test.ts` › '"save and apply" saves the row and hands over an image…'; `uploadQueueDialogSave.test.ts` › "applies the uploaded items and leaves a failed one out" (store mocked) | `consumerProfileUploadDialogActions.test.ts` › '"save and apply"' (3): positions after the widget's last, `damAuthors` / `showDamAuthors`, the arguments of the application's map, a failed row left out, with the real store |
| **LC7** single dialog | refresh, single-use switch on save, duplicate notice, author conflicts: `uploadQueueDialogSingle.test.ts`; the author address: `damAuthorKeywordEndpoints.test.ts` › "the dialog of a single file" | `consumerProfileUploadDialogSingle.test.ts`: '"save and apply"' (apply with one image at position 1, then queue emptied, detail dropped, dialog closed; empty answer), "once the file is uploaded" (the region tab), "the button that closes it". "A processing row shows no refresh" is obsolete (step 1, patch 4) and pinned the other way by the existing file |
| **LC8** apply into the widgets | the limit: `ImageWidgetMultipleLimitDialog.test.ts`; files into the open dialog: `uploadQueueDialogDrop.test.ts`; copy answered `copy` / refused (API mocked): `ImageWidgetMultipleCopyToLicence.test.ts`; failed copy: `ImageWidgetsCopyToLicenceFailure.test.ts` | single: `consumerProfileImageWidgetUpload.test.ts`; gallery: `consumerProfileImageWidgetMultipleUpload.test.ts`; asset list: `consumerProfileAssetListUpload.test.ts`; copy answered `copy` / `exists` / refused: `consumerProfileImageWidgetLibrary.test.ts` (single, 3) and the gallery file (1) |
| **LC9** mass operations sidebar | the composable: `uploadQueueMassOperations.test.ts`; validation: `massOperationsValidation.test.ts` | `consumerProfileUploadMassOperations.test.ts` (20) |
| **LC10** single-use switch | none | `uploadQueueRowStates.test.ts` › "the single-use switch of a row" (3); under the profiles in the rows and single-dialog files |
| **B1** single dialog, save and apply, per profile | the queue dialog only (`consumerProfileUploadDialog.test.ts`); the payload: `damAssetApiBulkMetadata.test.ts` | `consumerProfileUploadDialogSingle.test.ts` › '"save and apply"', '"save"'; the dialog of the image that follows: `consumerProfileImageWidgetUpload.test.ts` |
| **B2** single dialog, what a finished upload shows | none | `consumerProfileUploadDialogSingle.test.ts` › "while the server works on the file", "once the file is uploaded" (3) |
| **B3** region editor editable or not | the option only: `cropper/__tests__/roiUpdateAcl.test.ts` | `consumerProfileUploadDialogSingle.test.ts` › "the editor of the region of interest" |
| **B4** queue dialog, save / apply per profile | as LC6 | `consumerProfileUploadDialogActions.test.ts` ("save": only editable rows, the row's switch; apply); the rows of the widget (author field or source): `consumerProfileImageWidgetMultipleUpload.test.ts` › "a row of the widget" and the apply case |
| **B5** UGC row has no switch, author, keyword | none | `consumerProfileUploadQueueRows.test.ts` › "the form of a row" |
| **B6** refresh asks the profile's endpoint | the row alone: `uploadQueueRowRefresh.test.ts`; API mocked: `uploadQueueItemRefresh.test.ts` | `consumerProfileUploadQueueRows.test.ts` › "refresh" (2, and a third for admin-cms: uploaded without metadata) |
| **B7** closing during an upload | the store: `uploadQueueOperations.test.ts` › "a queue stopped"; `uploadStopBetweenChunks.test.ts` | through the button of each dialog: `consumerProfileUploadDialogActions.test.ts` and `consumerProfileUploadDialogSingle.test.ts` › "the button that closes it" |
| **C1** UGC inner widget asks for no configuration; picker | none | `consumerProfileImageWidgetLibrary.test.ts` › "the asset picker of the widget" (3) |
| **C2** CMS outer widget loads its configuration | with the config state mocked: `config/__tests__/damWidgetUploadAccess.test.ts`, `imageWidget/__tests__/damWidgetConfigLoadFailure.test.ts` | `consumerProfileImageWidgetLibrary.test.ts` › "the outer image widget of admin-cms, over a DAM configuration nobody has loaded yet" (4) |
| **C3** a file is queued under the widget's key | none | `consumerProfileImageWidgetUpload.test.ts` › "a file picked through the menu of the widget" |
| **C4** expanded options and metadata | the store only: `ImageWidgetInnerExpandMetadata.test.ts` | `consumerProfileImageWidgetUpload.test.ts` › "with its options and its image form expanded" (3), '"save and apply" of its upload dialog' (create / update through the image API) |
| **C5** picking an asset from the library | the author address: `damAuthorKeywordEndpoints.test.ts`; locks: `ImageWidgetCollab.test.ts` | `consumerProfileImageWidgetLibrary.test.ts` › "an asset picked in the library" |
| **C6** asset list page uploads through the slot | files into its open dialog, CMS config: `uploadQueueDialogDrop.test.ts` | `consumerProfileAssetListUpload.test.ts` (16) |
| **C7** a file type the ext system does not list | the store: `uploadQueueOperations.test.ts` › "are left out when the ext system does not list their type as an image" | what the user gets: `consumerProfileImageWidgetUpload.test.ts` › "of a type the ext system does not take…"; `consumerProfileUploadDialogSingle.test.ts` › "over a queue without a row" |
| **C8** gallery: load, apply, save | image API and asset read mocked: `ImageWidgetMultipleInner.test.ts` | `consumerProfileImageWidgetMultipleUpload.test.ts` (16) |
| **C9** a queue outlives its widget | none | `consumerProfileImageWidgetUpload.test.ts` › "a queue whose widget is taken away while the upload dialog is open" |
| **C10** exports and the store shape | other names: `src/test/publicExportsAdded.test.ts` | `src/test/publicExportsDamConsumers.test.ts` (32) |

Not written: no row is left without a test. Four details differ from what the reports asked, each because the
code does otherwise (pinned as it is, see "NEW" where it looks like a bug):

- LC7 "a processing row shows no refresh": obsolete, see the row.
- C1 "the picker does not open": it does open, empty (NEW 6).
- C4 "three buttons": with `expand-metadata` the "edit" button is hidden, so an empty widget has two; pinned as two.
- C2 "licence that does not load → simple image": my case checks the error text and that no widget is drawn; the
  simple image of an entity that already has one stays with the existing `damWidgetUploadAccess.test.ts`.

Deliberately not pinned: **the address of the copy-to-licence request** (open finding 20 in `upload-postup.md`);
the copy cases answer any `PATCH …/copy-to-licence`.

## Files and case counts

New test files (12, 261 cases):

| file | cases | rows |
|---|---|---|
| `src/domains/dam/uploadQueue/__tests__/uploadQueueRowStates.test.ts` | 30 | LC1, LC10 |
| `src/domains/dam/uploadQueue/__tests__/uploadQueueButtonStop.test.ts` | 6 | LC4 |
| `src/domains/dam/imageWidget/__tests__/metadataToImageMap.test.ts` | 16 | LC5 |
| `src/domains/dam/__tests__/consumerProfileUploadQueueRows.test.ts` | 21 | LC2, LC10, B5, B6 |
| `src/domains/dam/__tests__/consumerProfileUploadDialogActions.test.ts` | 22 | LC3, LC6, B4, B7 |
| `src/domains/dam/__tests__/consumerProfileUploadDialogSingle.test.ts` | 34 | LC7, B1, B2, B3, B7, C7 |
| `src/domains/dam/__tests__/consumerProfileUploadMassOperations.test.ts` | 20 | LC9 |
| `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetUpload.test.ts` | 24 | LC8, B1, C3, C4, C7, C9 |
| `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetMultipleUpload.test.ts` | 16 | LC8, B4, C8 |
| `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetLibrary.test.ts` | 24 | LC8, C1, C2, C5 |
| `src/domains/dam/assetSelect/__tests__/consumerProfileAssetListUpload.test.ts` | 16 | LC8, C6 |
| `src/test/publicExportsDamConsumers.test.ts` | 32 | C10 |

New support files (2, mine):

- `src/domains/dam/__tests__/support/uploadUi.ts`: the texts as a mounted component renders them (`uiText`,
  `damText`), the alerts raised (`shownAlerts`, `alertText`, `forgetAlerts`), a one-pixel image, and the user of the
  DAM (`signInToDam`, `signOutOfDam`).
- `src/domains/dam/__tests__/support/consumerImageApi.ts`: where a widget saves its images under each profile
  (admin-cms: the library's own API against a recording client; admin-ugc: six stand-in functions), read back as
  one list of calls.

All files run under both profiles (`describe.each(consumerProfiles)`) except the row alone, the stop button, the
map and the exports. No `vi.mock` and no fake timers anywhere. The edge that is faked: the HTTP client (`fakeDam`),
the socket (`damSocket`), the long waits (`longWaits`).

Two things about the test setup worth knowing:

- `import en from '@/locales/en'` gives compiled messages, not texts; `uiText` translates through an instance of
  its own built from them, as `src/test/setup.ts` does.
- Alerts translate through the plugin's instance, which a test has not installed, so an alert's text is its key
  (or whatever that instance makes of it). `alertText(key)` asks the same instance.

## Stand-ins used (and nothing else)

| file | not mounted for real |
|---|---|
| row states | `AFormRemoteAutocompleteWithCached` (the inner input of keywords and authors: asks the DAM for names to offer) |
| queue rows | `AssetImage` (would ask the image server), `AFormRemoteAutocompleteWithCached`, `AssetQueueSelectedSidebar` (has its own file) |
| dialog actions | `AssetImage`, `AFormRemoteAutocompleteWithCached`, `AssetQueueSelectedSidebar`, `AFileInput`, `AFileDropzone` |
| single dialog | `AssetImage`, `DamAssetImageRoiSelectLazy` (the cropper), `AssetDetailSidebarROI` (asks the DAM for regions), `AFormRemoteAutocompleteWithCached` |
| mass operations | `AFormRemoteAutocompleteWithCached` |
| image widget upload | `AAssetSelect` (picker), `AssetDetailDialog`, `VImg`, `AssetImage`, `AImageWidgetSimple`, `DamAssetImageRoiSelectLazy`, `AssetDetailSidebarROI`, `AFormRemoteAutocompleteWithCached` |
| gallery | `ASortableListEditor` (a stand-in that draws the rows and takes `commit`), `AAssetSelect`, `AssetDetailDialog`, `AImageWidgetSimple`, `AssetImage`, `AssetQueueSelectedSidebar`, `AFileDropzone`, `AFormRemoteAutocompleteWithCached` |
| widget and library | `VImg`, `AImageWidgetSimple`, `AssetDetailDialog`, `UploadQueueDialogSingle`, `AFormRemoteAutocompleteWithCached`, the tiles, table and metadata of the picker, the six inputs of its filter; the picker itself only in the cases about a picked asset |
| asset list | the bar, tiles and table of the list, `AssetMetadata`, `AssetDetailDialog`, `UploadQueueEditable`, the six inputs of the filter |

## Production lines bent to prove the cases

Each was changed by an exact replacement, the file's tests run, and the line put back by the reverse replacement;
the sha256 of every file after the restore equals the one before (checked by the script each time). 103 bends in 16
rounds (a few lines twice). Several bends of a round can hit one case, and a red case shows only its first failing
assertion: the bends hidden that way were run again in a round of their own. Every bend turned at least one case red,
except the one marked "not caught".

- `uploadQueue/components/UploadQueueItemEditable.vue` (12): `Loading` out of the cancel statuses; `index` of
  `cancelItem`; the `canEditMetadata` guard of the uploaded wait; `:disabled` of "edit"; the id of `showDetail`; the
  message branch; the switch `v-if`; `disableDoneAnimation`; the duplicate line; the title line; the form's
  `:disabled`. **Not caught:** the merge in `emit('update:customData', { ...props.customData, ...newValue })`: the
  form below already hands over the whole object, so the case holds either way.
- `imageWidget/utils/metadataToImageMap.ts` (6): `trim`, `mainFileInternal`, the "only when there are ids" guard,
  the separator, the file filter, the blank-name filter.
- `uploadQueue/components/UploadQueueButtonStop.vue` (3).
- `uploadQueue/components/UploadQueueEditable.vue` (7), `composables/uploadQueueItemRefresh.ts` (1: the
  "still processing" warning), `store/uploadQueuesStore.ts` (1: the endpoint of the read).
- `uploadQueue/components/UploadQueueDialog.vue` (17 in two rounds): the "updated" alert, both validation guards,
  the uploaded filter, `position`, `showDamAuthors`, the order of the map's arguments, `stopUpload` and the dialog
  ref on close, the queue of `showDetail`, the mass-operations toggle, `v-if="isFinished"`, the `n/N` count.
- `uploadQueue/components/AssetQueueSelectedSidebar.vue` (8).
- `uploadQueue/components/UploadQueueDialogSingle.vue` (7), `UploadQueueDialogSingleSidebar.vue` (1),
  `UploadQueueDialogSingleSidebarMetadataContent.vue` (1).
- `imageWidget/components/ImageWidgetInner.vue` (8 for the upload, 5 for a picked asset, 3 for the copy).
- `imageWidget/components/ImageWidgetMultipleInner.vue` (6 + 3 + 1).
- `assetSelect/components/AAssetListInner.vue` (5), `AssetSelectFilterForm.vue` (1), `AAssetSelect.vue` (1),
  `imageWidget/components/AImageWidget.vue` (1).
- `src/lib.ts` (2 exports taken out).

Not bent (each can still fail for a visible reason, but I did not prove it by a bend): the name and `data-cy` of
the stop button; "offers no field beside a queue without rows"; the store-shape cases of the exports file; the
"asks nothing of the DAM" cases.

## NEW (not fixed)

All pinned as they are today; each is marked in its test by the comment "Today's behaviour, pinned as it is".

1. **A save the DAM refuses says nothing** (both dialogs, "save" and "save and apply"). The bulk save rejects with
   the bare axios error, which `showErrorsDefault` lets pass. The user sees the button stop spinning. Also a 422
   with field errors. Same family as the silent refresh and the silent copy fixed in the third set.
   `consumerProfileUploadDialogActions.test.ts`, `consumerProfileUploadDialogSingle.test.ts`.
2. **The single dialog: a save answered with no asset is silent too** (`throw new Error('Fatal error…')`, not an
   Anzu error). Same test file.
3. **A file the ext system does not take opens the upload dialog on an endless loader.** The file input of the
   image widget turns the file away (warning), hands the widget an empty list, and `onFileInput` opens the dialog
   all the same. `AAssetListInner` has the guard (`if (files.length === 0) return`), `ImageWidgetInner` does not.
   Both profiles. `consumerProfileImageWidgetUpload.test.ts`.
4. **Gallery: "save and apply" counts the position twice.** The queue dialog raises `maxPosition` for each image
   and so does the widget: two new images after positions 1, 2 get 5, 6. Order is kept, numbers have a gap.
   `consumerProfileImageWidgetMultipleUpload.test.ts`.
5. **Gallery save in admin-cms writes `authors: []` into the DAM** for every image whose asset had no author when
   the widget read it, picked or not (one `metadata-bulk-update` per save). An author added in the DAM meanwhile
   would be wiped. Same file.
6. **The picker opens after saying the licence is not allowed.** `AAssetSelect.onOpen` raises the alert and
   returns, but the widget has already set its `v-model`: the dialog is drawn, over no licence, listing nothing.
   Reachable where the page has no DAM user and does not skip the check. `consumerProfileImageWidgetLibrary.test.ts`.
7. **Mass operations: "replace all" takes keywords and authors off every row** when the form has none picked,
   while a custom field left untouched is not written. Filling one custom field and pressing "replace all" thus
   clears both lists on all rows (admin-cms). `consumerProfileUploadMassOperations.test.ts`.
8. **A picked asset that cannot be read is offered all the same**, as an image without texts, after the error.
   `consumerProfileImageWidgetLibrary.test.ts`.

Smaller, for the clean-up of step 5.5 rather than as bugs:

- The image saved after an upload carries `authorIds` and `assetId` of the upload map into the image API
  (admin-cms: in the body of `POST /adm/v1/image`).
- After it creates an image the widget reads that image once more (`GET /adm/v1/image/{id}`): its model value
  changed.
- The single dialog sends `mainFileSingleUse: false` for a row whose value is `null`; the queue dialog sends
  `null`.

## A trap for whoever writes more of these

Two files added together are started side by side, and **which of them asks the DAM first is not fixed**: the fake
DAM names files in the order of the start requests, so `file-1` is not always the first file of the list. A case
that assumed it passed alone and failed when the twelve files ran together. Take the ids from the rows
(`item.fileId`, `item.assetId`), or tell the files apart by size or name, as `fakeDam.chunkOf` already does.
