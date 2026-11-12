# DAM, wave 4 - component tests of the upload UI, before step 5 (2026-10-08)

Written in `admin-dam` (`next`, working tree). **Test files only**: ten new test files and one new support file.
No production file, no existing test and no shared support file (`fakeDam.ts`, the two schedulers) was edited.
Nothing was committed; the stash and the two unpushed commits are as they were.

Paths below are relative to `admin-dam/src/`. Rows `DC1`, `DC2`, `DC4`, `DC5` are those of
`../9-tests-coverage.md`, section 3.4 (`DC3` was done before).

```
yarn --cwd admin-dam vitest run <the ten files> --retry=0      (18:27:25 and 18:27:56, on the final content)

 Test Files  10 passed (10)
      Tests  201 passed (201)
```

The whole suite of admin-dam with them, at 18:09: 67 files / 1150 tests green. `lint:tsc` exit 0; `oxlint`, `eslint`
and `oxfmt --check` clean on the eleven new files (18:28).

Production code moved under these tests while they were written: another agent changed
`AssetQueueEditable.vue` (17:52, 18:19) and `AssetQueueItemEditable.vue` (18:19: the refresh event now carries the
row). The ten files were green before and after; the numbers above are from after.

---

## 1. Coverage table

"Before" names the test that covered the behaviour when I started. "Now" names the new file.

### DC1 - the editable row and its list (`asset/components/queue/AssetQueueItemEditable.vue`, `AssetQueueEditable.vue`)

| behaviour | before | now |
|---|---|---|
| the row is validated only while its metadata can be edited | `queue/queueRowValidation.test.ts` (1 case) | not repeated |
| what a refresh does to the row, by the answer of the server (15 outcomes) | `queue/queueRefresh.test.ts`, with the row replaced by a stand-in button | not repeated; the real button reaching the server once: `queueRowActions` |
| cancel offered for loading / waiting / uploading / processing / failed, not for uploaded / stopped; follows the status | - | `queueRowStates` (8) |
| refresh: after 20 s of uploading or processing, counted from the last change of status; never for waiting / loading; gone when the row fails | - | `queueRowStates` (7) |
| refresh on an uploaded row: at once with an error; after 20 s without metadata; not when the metadata comes in time; gone when it comes late; kept beside an error; never with metadata; never for a duplicate | - | `queueRowStates` (8) |
| refresh never for failed / stopped | - | `queueRowStates` (2) |
| delete: enabled only with metadata or for a duplicate (7 states); hidden without the grant `dam_asset_delete` | - | `queueRowStates` (8) |
| edit: disabled until the metadata can be edited; absent on a duplicate | - | `queueRowStates` (2) |
| copy-id button only once the row has an asset | - | `queueRowStates` (1) |
| the picture: waiting / uploading with percent and time / processing / done / nothing for failed; "done" left out for mass edit | - | `queueRowStates` (7) |
| duplicate overlay: text, link to the original in a new tab, no link without an original | - | `queueRowStates` (3) |
| error overlay: message, else chip of the reason (5 reasons), else "unknown"; message wins; shown on any status; not without `hasError` | e2e only | `queueRowStates` (10) |
| the form: disabled until editable, disabled on a duplicate; pinned custom fields, then keywords, authors, switch; fields of the row's asset type; keywords / authors by the ext system; typing writes into the row; the switch reads and writes the row; "Original name" line with the size | - | `queueRowStates` (8) |
| cancel pressed: its own row leaves the queue (by identity), no request; a running upload is aborted and the waiting file starts | store side: `queue/queueOperations.test.ts` | `queueRowActions` (2), through the real button |
| refresh pressed: one read of the asset of that row, the row settled; every refresh button disabled meanwhile; the two warnings as the alerts host shows them | `queueRefresh` (stand-in row, alert mocked) | `queueRowActions` (4) |
| delete pressed: asks first; `DELETE /adm/v1/asset/{id}`, row out, "Record was removed"; the row of the deleted asset and not the one that moved into its place; a refusal keeps the row and shows the error; **a duplicate deletes its own asset, never the original** | e2e only | `queueRowActions` (5) |
| edit pressed: the detail opens from the queue (`view: queue`, loader, arrow keys off), one read; a failed read closes it, shows the error | partly `list/detailRequests.test.ts` (the store, not the button) | `queueRowActions` (2) |
| the list: a card per row of its own queue, in order, a later row too; mass operations only for more than one row; one lookup of the names of all keywords and all authors of its rows | - | `queueRowActions` (4) |
| the keyword input in the row: search and pick; Enter creates a keyword (`POST /adm/v1/keyword`) and adds it; neither offered nor done without `dam_keyword_create` | - | `queueRowKeywordsAuthors` (4) |
| the author input in the row: search and pick; "new author" button only with `dam_author_create`, disabled while the row cannot be edited; author conflicts offered by name and added on press; none while the row cannot be edited | chips alone: `cached/cachedChipUnresolved.test.ts` | `queueRowKeywordsAuthors` (6) |

### DC2 - the compact row (`AssetQueueItemList.vue`, `AssetQueueUploadList.vue`)

| behaviour | before | now |
|---|---|---|
| drawn over a slot for every status but uploaded; cancel of uploading / processing / failed takes it out | `queue/slotUploadRow.test.ts` (through `AssetSlotListItem`) | not repeated |
| icon: spinner for waiting / loading / uploading / processing, endless until there is progress; green check; yellow warning with `data-cy="icon-duplicate"`; red warning in place of the spinner | e2e for two icons | `queueListRow` (7) |
| what the icon says when pointed at: reason, else message; reason wins; nothing without an error | - | `queueListRow` (5) |
| cancel there for the five statuses, not for uploaded / stopped; takes its own row out | partly, see first row | `queueListRow` (8) |
| the line: title or "no title"; remaining time while there is some | - | `queueListRow` (2) |

### DC4 - the two overlays that save a queue (`footer/AssetFooterUploadOverlayFull.vue`, `AssetFooterSelectedFull.vue`)

| behaviour | before | now |
|---|---|---|
| neither can be saved while no row would be sent | `queue/saveNothing.test.ts` (4) | not repeated |
| what the bulk save sends, in batches of ten | `asset/bulkMetadata.test.ts` (the API) | the body as the overlay sends it: `overlaySave` |
| upload overlay toolbar: "Upload" + "Uploading n/N" while unfinished, "Save and finish" only when all rows are settled; mass operations open or folded by the window width, toggled by their button; hide button | e2e (page object) | `overlaySave` (5) |
| upload overlay "save": PATCH with the editable rows only, list read again, "Record was updated", queue and overlay stay; invalid form sends nothing and says so; a row that would not be saved does not stop it; a failed save (500, 422, non-200) | - | `overlaySave` (6) |
| upload overlay "save and finish": the same, then the queue is stopped and emptied, the overlay hidden, the list read; invalid or failed keeps everything | - | `overlaySave` (5) |
| upload overlay close: at once when settled; asks while uploading, "yes" aborts and empties; "no" changes nothing | the button alone: `upload/uploadStopConfirm.test.ts` | `overlaySave` (3) |
| mass-edit overlay: "Selected files: N"; "save and finish" offered also while an asset loads | - | `overlaySave` (2) |
| mass-edit "save": PATCH, alert, **no** list read, selection stays; invalid sends nothing | buttons only (`saveNothing`), e2e | `overlaySave` (2) |
| mass-edit "save and finish": PATCH, queue emptied, assets unticked in the list, overlay hidden; invalid or failed keeps everything | - | `overlaySave` (5) |
| mass-edit close: asks, then empties, unticks, hides, saves nothing; "no" changes nothing | - | `overlaySave` (2) |

### DC5 - the panel of the slot uploads (`footer/AssetFooterUploadSlotsOverlay.vue`)

| behaviour | before | now |
|---|---|---|
| title and counter; lists the slots queue only; comes up (compact) with the first upload, then stays as the user has it | - | `slotsOverlay` (4) |
| "clear": hidden while a row is unfinished; empties the slots queue and hides the panel, no question, other queues untouched | - | `slotsOverlay` (2) |
| close: at once when nothing is under way; asks while uploading, "yes" aborts and empties the slots queue only; "no" changes nothing | the button alone | `slotsOverlay` (3) |

### Added to the list (step 5, part 4)

| component | before | now |
|---|---|---|
| mass operations (`AssetQueueSelectedSidebar.vue`): which of keywords / authors are offered, that "fill all" / "replace all" call the store with the right flag | `queue/massOperationsSidebar.test.ts` (store mocked) | not repeated |
| mass operations: what the store writes for one call | `queue/lazyMetadata.test.ts` (3) | not repeated |
| mass operations, end to end over the real store and the real inputs: panels per asset type, first type open; a scratch line per writable field; fill / replace of a custom field (own type only, other fields untouched, replace with nothing typed); fill / replace of keywords and authors (searched and picked in the real input; never into a type that has them off; shown by name in the rows); "fill all empty", "replace all", "clear form" | - | `massOperationsRows` (14) |
| `AssetCustomMetadataForm.vue`: validation scope | `asset/assetMetadataValidation.test.ts` (6), `queueRowValidation` | not repeated |
| `AssetCustomMetadataForm.vue`: what is pinned (1 of 3; 3 and 10 of 3; nothing configured), fields of its asset type and following the type, slots before and after the pinned, "show more details" (shows, hides, one choice for every form, of no use while a hidden field fails), what it gives back | - | `customMetadataForms` (10) |
| `AssetCustomMetadataFormMassOperations.vue`: every field at once whatever is pinned, no line for a read-only field, keeps what is typed, what its two buttons ask for | not validated: `assetMetadataValidation` (1) | `customMetadataForms` (4) |
| stop button (`AssetFooterUploadButtonStop.vue`): name, at once when idle, asks while uploading, "yes", Esc | `upload/uploadStopConfirm.test.ts` (4) | not repeated |
| stop button: the text of the question and its two buttons, "cancel", the cross of the toolbar (the real `ADialogToolbar`), asked by the state at the press, "yes" after the uploads ended, `data-cy` | - | `upload/uploadStopQuestion.test.ts` (6) |
| fail-reason chip (`AssetFileFailReasonChip.vue`): a text for each of the six reasons, in English and in Slovak; the six are all the library knows; no chip for an unknown reason; what the row then shows | - | `failReasonChip` (15); in the row: `queueRowStates` (5 reasons) |

### Not written, and why

| what | why |
|---|---|
| the compact floating panel of the uploads (`footer/AssetFooterUploadOverlay.vue`) | not on the list; it stays in DAM and is the twin of the slots panel (same title, counter and list, plus "Add description"). Half an hour with the new support file if wanted |
| `AssetQueueSelectedSimple` / `AssetQueueSelectedItemSimple` (the strip of the mass-edit selection) | not on the list; stays in DAM (plan, step 5, part 6) |
| the preview picture of a settled row (`imagePreview.url`) | `VImg` draws no `<img>` under happy-dom (it waits for an intersection that never comes), so nothing on the page carries the address. The texts over the picture are pinned |
| the copy-id button actually copying | the library's button; the clipboard of happy-dom was not driven. Only its presence is pinned |
| a new author created through the dialog of the "new author" button | `AuthorCreateButton` is one of the shared blocks of step 5 with a form of its own; only the grant and the disabled state of the button in the row are pinned |
| that the mass operations hand every row the very same array | known (LIB finding 5, owner: step 5). Pinning it would pin the fault; the values written are pinned |
| "the form is not drawn before the config is loaded" (both custom forms throw in `setup`) | tried and dropped: a component that throws in `setup` leaves Vue's current instance set for the rest of the file, so every later case in the file talks to the stores of the dead application. `startUploadUi` now refuses to start in that state and says why |

---

## 2. Files

| file | cases | mounts |
|---|---|---|
| `test/support/uploadUi.ts` | - | the support file, see section 3 |
| `test/queue/queueRowStates.test.ts` | 64 | `AssetQueueEditable` with real rows |
| `test/queue/queueRowActions.test.ts` | 17 | the same |
| `test/queue/queueRowKeywordsAuthors.test.ts` | 10 | the same |
| `test/queue/queueListRow.test.ts` | 22 | `AssetQueueUploadList` with real compact rows |
| `test/queue/overlaySave.test.ts` | 30 | `AssetFooterUploadOverlayFull`, `AssetFooterSelectedFull`, each whole |
| `test/queue/slotsOverlay.test.ts` | 9 | `AssetFooterUploadSlotsOverlay`, whole |
| `test/queue/massOperationsRows.test.ts` | 14 | `AssetQueueEditable` with rows and the real sidebar |
| `test/queue/customMetadataForms.test.ts` | 14 | the two forms under a parent that holds their value |
| `test/queue/failReasonChip.test.ts` | 15 | the chip; one case the row |
| `test/upload/uploadStopQuestion.test.ts` | 6 | the stop button |
| | **201** | |

## 3. How the tests are built

`test/support/uploadUi.ts` puts the application around the component as `main.ts` does, and nothing of the
application is replaced by it:

- the plugin of the library installed with the application's `damClient`, the application's `i18n` with the
  **real English messages** (so a case reads what the user reads), `createAnzuVuetify`, a router, the alerts host
  (`AAlerts`) beside the component, so an alert is read from the page;
- the config of DAM written into the library's config store as its load writes it; `initCurrentExtSystemAndLicence()`
  runs for real;
- a user in the auth store with **grants** (`resolvedPermissions`), so `ACL` and `useAuth` are the real ones;
- the real upload queue store, upload service, name caches (keywords, authors), detail and list stores;
- every start evaluates all modules anew (`vi.resetModules()`), and **time is faked from the start of a case to
  its end** and thrown away with it.

What is faked:

| edge | how |
|---|---|
| HTTP | `vi.mock('@/shared/apiClients/damClient')` in each test file, handing out the client of `fakeDam.ts`. The only `vi.mock` in the ten files |
| time | `vi.useFakeTimers()` in `startUploadUi`, `vi.useRealTimers()` in `stopUploadUi` |
| the page of the router | a router with two routes: `/` and the detail of an asset under its real name and path |
| `window.visualViewport`, `FileReader` | stubs (happy-dom has no usable ones); `FileReader` by `fakeDam.ts` |

**No child component is stubbed.** The keyword and author inputs, the custom metadata forms, `AssetImage`,
`AssetLink`, `AssetUpload` with its `FileUpload`, the dialogs and the library's buttons all run. The inputs are
driven as a user drives them: a text typed, the debounce waited out, the option the server found clicked.

Why the clock is always fake: the first version ran most cases on the real clock. A lookup of names is put off by
1.5 s by the cache; started in one case, it fired in a later one and landed in **that** case's server, because
the mocked `damClient` reads the server of the moment. A full-suite run of another agent at 17:53 caught it
(`queueRowActions`, "asks first, and sends nothing"). With a fake clock per case nothing can cross.

Selectors: each file has one function that knows how the component is built (`card()`, `row()`, `field()`), so a
replaced component costs one function, not every case. Buttons are found by their accessible name or text.

Waiting: `eventually()` of the support file in place of a bare `vi.waitFor` - it moves the fake clock at each try
and gives up after 15 s, not after one: the suite of this repository is set up for runs that lose the processor
(`vitest.config.mts`, the comment on `testTimeout`), and other suites were running beside mine all afternoon.

---

## 4. Production lines bent to prove the cases

**No production file was changed on disk, not even for a moment.** Other agents were editing and reviewing the
very files these tests guard (see above), and a backup or a review taken while a line was bent would have carried
the bent line on. The lines were bent in memory instead: a second vitest config
(`admin-dam/node_modules/.cache/vitest-tmp-dam-w4/vitest.w4-mutate.config.mts`, in the temporary directory of my
runs - it imports the real config and adds one plugin) replaces the text in a production module as vitest loads
it. The case then runs against the bent module, which is the same proof. Every edit had to match its file exactly
once, and every edit of a round was confirmed applied.

**200 of the 201 cases went red in at least one round** (34 rounds, 168 edits). The one that did not:
`failReasonChip`, "has a text for every reason the library knows of" - it compares the table of the test with the
library's list of reasons, so it fails when the library learns a reason, not when a line of admin-dam changes.

The rounds that bend `AssetQueueEditable.vue` or `AssetQueueItemEditable.vue` were all run, or run again, after the
review fix of 18:19 was in those two files (`row`, `row2` and `actions3` again at 18:32, with the same counts). A
scan of `admin-dam/src` for the markers every bent line carried (`W4`, `data-w4`) found nothing at 18:31, before
those three rounds, and again at 18:32, after them.

Two things the rounds showed about the tests themselves:

- `queueRowActions`, "asks the server once for the names of all the keywords and all the authors its rows hold"
  stays green when the list alone stops asking (`AssetQueueEditable.vue`, `addToCachedKeywords(item.keywords)`):
  the keyword input of each row asks for the same ids, and the cache makes one request of both. It goes red only
  when neither asks (round `actions4`). The case pins what the server sees, not which of the two asked.
- `queueRowStates`, "never comes for a row that is failed / stop" stays green when the last line of the watcher
  (`showRefresh.value = false`) is removed, because nothing has set it before. It goes red when a failed row is
  counted as still running (round `row3`).

The rounds, each with the production lines it bent (the line as it stands in the file, at the line number of
18:20) and how many cases of the file went red:

**`compact`**, against `queueListRow`: 13 of 22 cases red.

- `AssetQueueItemList.vue:40` `UploadQueueItemStatus.Loading,`
- `AssetQueueItemList.vue:62` `UploadQueueItemStatus.Failed,`
- `AssetQueueItemList.vue:28` `if (props.item.error.assetFileFailReason !== AssetFileFailReason.None) {`
- `AssetQueueItemList.vue:99` `color="warning"`
- `AssetQueueItemList.vue:105` `icon="mdi-check"`
- `AssetQueueItemList.vue:132` `{{ item.displayTitle || t('coreDam.asset.list.noTitle') }}`
- `AssetQueueItemList.vue:142` `v-if="item.progress.remainingTime && item.progress.remainingTime > 0"`
- `AssetQueueUploadList.vue:25` `uploadQueuesStore.stopItemUpload(data.queueId, data.item)`

**`compact2`**, against `queueListRow`: 5 of 22 cases red.

- `AssetQueueItemList.vue:83` `v-if="item.error.hasError"`
- `AssetQueueItemList.vue:91` `:indeterminate="loadingProgress === null"`

**`compact3`**, against `queueListRow`: 6 of 22 cases red.

- `AssetQueueItemList.vue:64` `).includes(props.item.status)`

**`compact4`**, against `queueListRow`: 2 of 22 cases red.

- `AssetQueueItemList.vue:64` `).includes(props.item.status)`

**`row`**, against `queueRowStates`: 26 of 64 cases red.

- `AssetQueueItemEditable.vue:210` `UploadQueueItemStatus.Processing,`
- `AssetQueueItemEditable.vue:132` `const SHOW_REFRESH_AFTER_SECONDS = 20`
- `AssetQueueItemEditable.vue:235` `if (props.item.error.hasError) {`
- `AssetQueueItemEditable.vue:242` `if (props.item.canEditMetadata || props.item.isDuplicate) return`
- `AssetQueueItemEditable.vue:247` `if (props.item.canEditMetadata || props.item.isDuplicate) return`
- `AssetQueueItemEditable.vue:264` `if (canEdit && props.item.status === UploadQueueItemStatus.Uploaded && !props.item.error....`
- `AssetQueueItemEditable.vue:255` `showRefresh.value = false`
- `AssetQueueItemEditable.vue:421` `:disabled="!item.canEditMetadata && !item.isDuplicate"`
- `AssetQueueItemEditable.vue:420` `:acl="ACL.DAM_ASSET_DELETE"`
- `AssetQueueItemEditable.vue:369` `v-if="!item.isDuplicate"`
- `AssetQueueItemEditable.vue:372` `:disabled="!item.canEditMetadata"`
- `AssetQueueItemEditable.vue:295` `:show-processing="processing"`
- `AssetQueueItemEditable.vue:123` `return !props.disableDoneAnimation && props.item.status === UploadQueueItemStatus.Uploaded`
- `AssetQueueItemEditable.vue:321` `v-if="item.duplicateAssetId"`
- `AssetQueueItemEditable.vue:346` `v-if="item.error.message.length"`
- `AssetQueueItemEditable.vue:439` `<VForm :disabled="!item.canEditMetadata || item.isDuplicate">`
- `AssetQueueItemEditable.vue:449` `v-if="keywordEnabled"`
- `AssetQueueItemEditable.vue:501` `v-model="mainFileSingleUse"`
- `AssetQueueItemEditable.vue:430` `v-if="item.displayTitle"`

**`row2`**, against `queueRowStates`: 29 of 64 cases red.

- `AssetQueueItemEditable.vue:212` `UploadQueueItemStatus.Failed,`
- `AssetQueueItemEditable.vue:218` `status === UploadQueueItemStatus.Uploading || status === UploadQueueItemStatus.Processing`
- `AssetQueueItemEditable.vue:350` `<div v-else-if="item.error.assetFileFailReason !== AssetFileFailReason.None">`
- `AssetQueueItemEditable.vue:330` `v-if="item.error.hasError"`
- `AssetQueueItemEditable.vue:305` `v-if="item.isDuplicate"`
- `AssetQueueItemEditable.vue:296` `:show-waiting="waiting"`
- `AssetQueueItemEditable.vue:298` `:uploading-progress="uploadProgress"`
- `AssetQueueItemEditable.vue:472` `v-if="authorEnabled"`
- `AssetQueueItemEditable.vue:67` `emit('update:customData', { ...props.customData, ...newValue })`
- `AssetQueueItemEditable.vue:444` `:asset-type="assetType"`
- `AssetQueueItemEditable.vue:436` `<span v-if="item.file?.size">`
- `AssetQueueItemEditable.vue:380` `v-if="item.assetId"`

**`row3`**, against `queueRowStates`: 27 of 64 cases red.

- `AssetQueueItemEditable.vue:214` `).includes(props.item.status)`
- `AssetQueueItemEditable.vue:421` `:disabled="!item.canEditMetadata && !item.isDuplicate"`
- `AssetQueueItemEditable.vue:502` `:label="t('common.damImage.asset.model.mainFileSingleUse')"`
- `AssetQueueItemEditable.vue:439` `<VForm :disabled="!item.canEditMetadata || item.isDuplicate">`
- `AssetQueueItemEditable.vue:297` `:show-done="done"`
- `AssetQueueItemEditable.vue:295` `:show-processing="processing"`
- `AssetQueueItemEditable.vue:218` `status === UploadQueueItemStatus.Uploading || status === UploadQueueItemStatus.Processing`

**`row4`**, against `queueRowStates`: 11 of 64 cases red.

- `AssetQueueItemEditable.vue:214` `).includes(props.item.status)`
- `AssetQueueItemEditable.vue:223` `clearTimeout(refreshTimer.value)`
- `AssetQueueItemEditable.vue:228` `if (stillRunning(props.item.status)) showRefresh.value = true`
- `AssetQueueItemEditable.vue:247` `if (props.item.canEditMetadata || props.item.isDuplicate) return`
- `AssetQueueItemEditable.vue:264` `if (canEdit && props.item.status === UploadQueueItemStatus.Uploaded && !props.item.error....`

**`actions`**, against `queueRowActions`: 12 of 17 cases red.

- `AssetQueueEditable.vue:57` `uploadQueuesStore.stopItemUpload(data.queueId, data.item)`
- `AssetQueueEditable.vue:33` `refreshDisabled.value = true`
- `AssetQueueEditable.vue:37` `if (outcome === 'pending') showWarningT(`
- `AssetQueueEditable.vue:46` `if (outcome === 'error' && !ended) showWarningT(`
- `AssetQueueEditable.vue:108` `v-if="list.length > 1"`
- `AssetQueueEditable.vue:69` `addToCachedKeywords(item.keywords)`
- `AssetQueueItemEditable.vue:173` `showRecordWas('deleted')`
- `AssetQueueItemEditable.vue:144` `assetDetailStore.setView('queue')`
- `AssetQueueItemEditable.vue:158` `assetDetailStore.reset()`
- `uploadQueuesStore.ts:106` `return { reader: 'asset', settleOn: 'event', duplicate: 'markDuplicate', metadata: 'load' }`

**`actions2`**, against `queueRowActions`: 11 of 17 cases red.

- `AssetQueueEditable.vue:61` `uploadQueuesStore.removeByAssetId(props.queueId, assetId)`
- `AssetQueueItemEditable.vue:138` `emit('refreshItem', { index: props.index, assetId: props.item.assetId, item: props.item })`
- `AssetQueueItemEditable.vue:175` `showErrorsDefault(error)`
- `AssetQueueItemEditable.vue:153` `assetDetailStore.setAsset(asset)`
- `AssetQueueItemEditable.vue:162` `showErrorsDefault(error)`
- `AssetQueueItemEditable.vue:145` `assetListStore.keyboardNavigationDisable()`
- `AssetQueueEditable.vue:89` `v-for="(item, index) in list"`
- `AssetQueueEditable.vue:70` `addToCachedAuthors(item.authors)`

**`actions3`**, against `queueRowActions`: 1 of 17 cases red.

- `AssetQueueItemEditable.vue:172` `emit('removeItem', props.item.assetId)`
- `AssetQueueEditable.vue:61` `uploadQueuesStore.removeByAssetId(props.queueId, assetId)`

**`actions4`**, against `queueRowActions`: 1 of 17 cases red.

- `AssetQueueEditable.vue:69` `addToCachedKeywords(item.keywords)`
- `KeywordRemoteAutocompleteWithCached.vue:160` `:use-cached="useCachedKeywordsForRemoteAutocomplete"`

**`actions5`**, against `queueRowActions`: 1 of 17 cases red.

- `AssetQueueItemEditable.vue:418` `<AActionDeleteButton`

**`overlay`**, against `overlaySave`: 13 of 30 cases red.

- `AssetFooterUploadOverlayFull.vue:166` `v-if="isFinished"`
- `AssetFooterUploadOverlayFull.vue:156` `{{ t('coreDam.asset.upload.uploading') }} {{ queueProcessedCount + 1 }}/{{ queueTotalCoun...`
- `AssetFooterUploadOverlayFull.vue:85` `fetchAssetList()`
- `AssetFooterUploadOverlayFull.vue:78` `if (v$.value.$invalid) {`
- `AssetFooterUploadOverlayFull.vue:106` `await onStopConfirm()`
- `AssetFooterUploadOverlayFull.vue:242` `:is-uploading="isUploading"`
- `AssetFooterUploadOverlayFull.vue:67` `massOperations.value = !massOperations.value`
- `AssetFooterSelectedFull.vue:41` `assetListStore.clearSelected()`
- `AssetFooterSelectedFull.vue:73` `showRecordWas('updated')`
- `AssetFooterSelectedFull.vue:116` `{{ t('coreDam.asset.selected.selectedFiles') }}: {{ queueTotalCount }}`

**`overlay2`**, against `overlaySave`: 16 of 30 cases red.

- `AssetFooterUploadOverlayFull.vue:59` `uploadQueuesStore.stopUpload(QUEUE_ID_UPLOAD_GLOBAL)`
- `AssetFooterUploadOverlayFull.vue:44` `const massOperations = ref(!mobile.value)`
- `AssetFooterUploadOverlayFull.vue:88` `showErrorsDefault(error)`
- `AssetFooterUploadOverlayFull.vue:109` `showErrorsDefault(error)`
- `AssetFooterUploadOverlayFull.vue:98` `if (v$.value.$invalid) {`
- `AssetFooterUploadOverlayFull.vue:229` `@click.stop="setMinimalUpload"`
- `AssetFooterSelectedFull.vue:93` `await onClearConfirm()`
- `AssetFooterSelectedFull.vue:66` `if (v$.value.$invalid) {`
- `AssetFooterSelectedFull.vue:95` `showErrorsDefault(error)`
- `AssetFooterSelectedFull.vue:40` `uploadQueuesStore.clearQueue(QUEUE_ID_MASS_EDIT)`

**`overlay3`**, against `overlaySave`: 8 of 30 cases red.

- `AssetFooterSelectedFull.vue:85` `if (v$.value.$invalid) {`
- `AssetFooterSelectedButtonClear.vue:33` `const onCancel = () => {`
- `AssetFooterSelectedFull.vue:127` `:disabled="saveButtonLoading || nothingToSave"`
- `AssetFooterUploadOverlayFull.vue:60` `hideUpload()`
- `AssetQueueItemEditable.vue:104` `return props.item.canEditMetadata ? AssetMetadataValidationScopeSymbol : false`

**`slotsA`**, against `slotsOverlay`: 5 of 9 cases red.

- `AssetFooterUploadSlotsOverlay.vue:158` `v-show="!isUploading"`
- `AssetFooterUploadSlotsOverlay.vue:43` `uploadQueuesStore.stopUpload(QUEUE_ID_UPLOAD_SLOTS)`
- `AssetFooterUploadSlotsOverlay.vue:141` `:is-uploading="isUploading"`

**`slotsB`**, against `slotsOverlay`: 3 of 9 cases red.

- `AssetFooterUploadSlotsOverlay.vue:102` `<div>{{ queueProcessedCount + 1 }}/{{ queueTotalCount }}</div>`
- `AssetFooterUploadSlotsOverlay.vue:170` `<AssetQueueUploadList :queue-id="QUEUE_ID_UPLOAD_SLOTS" />`
- `AssetFooterUploadSlotsOverlay.vue:37` `if (newValue !== oldValue && newValue > 0) {`

**`slotsC`**, against `slotsOverlay`: 1 of 9 cases red.

- `AssetFooterUploadSlotsOverlay.vue:76` `v-if="isUploading"`
- `AssetFooterUploadSlotsOverlay.vue:92` `v-if="isUploading"`

**`slots2`**, against `slotsOverlay`: 3 of 9 cases red.

- `AssetFooterUploadSlotsOverlay.vue:44` `hideUpload()`
- `AssetFooterUploadSlotsOverlay.vue:163` `@click.stop="onStopConfirm"`

**`sidebar`**, against `massOperationsRows`: 10 of 14 cases red.

- `AssetQueueSelectedSidebar.vue:37` `uploadQueuesStore.queueItemsReplaceEmptyCustomDataValue(props.queueId, data)`
- `AssetQueueSelectedSidebar.vue:43` `uploadQueuesStore.queueItemsReplaceEmptyKeywords(props.queueId, massOperationsKeywords.va...`
- `AssetQueueSelectedSidebar.vue:52` `uploadQueuesStore.queueItemsReplaceEmptyAuthors(props.queueId, massOperationsAuthors.valu...`
- `AssetQueueSelectedSidebar.vue:111` `massOperationsKeywords.value = []`
- `AssetQueueSelectedSidebar.vue:135` `panels.value.push(assetTypes.value[0])`
- `AssetCustomMetadataFormMassOperations.vue:61` `<div v-if="element.attributes.readonly" />`

**`sidebar2`**, against `massOperationsRows`: 12 of 14 cases red.

- `AssetQueueSelectedSidebar.vue:40` `uploadQueuesStore.queueItemsReplaceEmptyCustomDataValue(props.queueId, data, true)`
- `AssetQueueSelectedSidebar.vue:46` `uploadQueuesStore.queueItemsReplaceEmptyKeywords(props.queueId, massOperationsKeywords.va...`
- `AssetQueueSelectedSidebar.vue:49` `uploadQueuesStore.queueItemsReplaceEmptyAuthors(props.queueId, massOperationsAuthors.value)`
- `AssetQueueSelectedSidebar.vue:99` `if (authorEnabled.value) {`
- `AssetQueueSelectedSidebar.vue:81` `assetType: DamAssetType.Audio,`
- `AssetQueueSelectedSidebar.vue:109` `massOperationsData.value = { image: {}, video: {}, audio: {}, document: {} }`
- `AssetQueueSelectedSidebar.vue:275` `v-if="assetTypes.includes(DamAssetType.Image)"`
- `uploadQueuesStore.ts:812` `if (item.assetType !== data.assetType) continue`
- `uploadQueuesStore.ts:838` `if (!enabled(item.assetType)) continue`

**`forms`**, against `customMetadataForms`: 7 of 14 cases red.

- `AssetCustomMetadataForm.vue:45` `return configExtSystem[props.assetType]?.customMetadataPinnedAmount ?? 0`
- `AssetCustomMetadataForm.vue:61` `<slot name="before-pinned" />`
- `AssetCustomMetadataForm.vue:57` `@any-change="emit('anyChange')"`
- `AssetCustomMetadataFormMassOperations.vue:29` `modelValue.value = { ...modelValue.value, ...updated }`
- `AssetCustomMetadataFormMassOperations.vue:78` `@click.stop="fillEmptyField(element.property, modelValue[element.property])"`
- `AssetCustomMetadataFormMassOperations.vue:61` `<div v-if="element.attributes.readonly" />`

**`forms2`**, against `customMetadataForms`: 9 of 14 cases red.

- `AssetCustomMetadataForm.vue:36` `return configAssetCustomFormElements[props.assetType]`
- `AssetCustomMetadataForm.vue:54` `:pinned-count="pinnedCount"`
- `AssetCustomMetadataForm.vue:58` `@update:model-value="modelValue = $event"`
- `AssetCustomMetadataForm.vue:64` `<slot name="after-pinned" />`
- `AssetCustomMetadataFormMassOperations.vue:48` `return configAssetCustomFormElements[props.assetType]`
- `AssetCustomMetadataFormMassOperations.vue:36` `emit('replaceField', { assetType: props.assetType, elementProperty, value })`

**`forms3`**, against `customMetadataForms`: 8 of 14 cases red.

- `AssetCustomMetadataForm.vue:54` `:pinned-count="pinnedCount"`
- `AssetCustomMetadataFormMassOperations.vue:55` `v-for="element in elements"`

**`chip`**, against `failReasonChip`: 6 of 15 cases red.

- `AssetFileFailReason.ts:20` `title: t('coreDam.asset.assetFileFailReason.invalidChecksum'),`
- `AssetFileFailReason.ts:26` `{`
- `AssetFileFailReasonChip.vue:22` `<AChipNoLink v-if="reasonOption">`

**`chip2`**, against `failReasonChip`: 8 of 15 cases red.

- `AssetFileFailReason.ts:12` `title: t('coreDam.asset.assetFileFailReason.none'),`
- `AssetFileFailReason.ts:16` `title: t('coreDam.asset.assetFileFailReason.unknown'),`
- `AssetFileFailReason.ts:24` `title: t('coreDam.asset.assetFileFailReason.invalidMimeType'),`
- `AssetFileFailReason.ts:32` `title: t('coreDam.asset.assetFileFailReason.invalidSize'),`

**`stopA`**, against `uploadStopQuestion`: 3 of 6 cases red.

- `AssetFooterUploadButtonStop.vue:39` `dialog.value = false`
- `AssetFooterUploadButtonStop.vue:49` `:data-cy="dataCy"`

**`stopB`**, against `uploadStopQuestion`: 3 of 6 cases red.

- `AssetFooterUploadButtonStop.vue:73` `{{ t('system.upload.stopConfirmQuestion') }}`
- `AssetFooterUploadButtonStop.vue:34` `emit('confirm')`

**`stopC`**, against `uploadStopQuestion`: 1 of 6 cases red.

- `AssetFooterUploadButtonStop.vue:27` `if (!props.isUploading) {`

**`stopD`**, against `uploadStopQuestion`, `slotsOverlay`, `overlaySave`: 4 of 45 cases red.

- `AssetFooterUploadButtonStop.vue:38` `const onCancel = () => {`

**`inputs`**, against `queueRowKeywordsAuthors`: 6 of 10 cases red.

- `KeywordRemoteAutocompleteWithCached.vue:131` `if (!can(ACL.DAM_KEYWORD_CREATE)) return`
- `KeywordRemoteAutocompleteWithCached.vue:143` `if (!can(ACL.DAM_KEYWORD_CREATE)) return false`
- `AuthorRemoteAutocompleteWithCached.vue:225` `v-if="can(ACL.DAM_AUTHOR_CREATE)"`
- `AuthorRemoteAutocompleteWithCached.vue:231` `:disabled="disabled"`
- `AuthorRemoteAutocompleteWithCached.vue:237` `v-if="!disabled && authorConflicts && authorConflicts.length > 0"`
- `AuthorRemoteAutocompleteWithCached.vue:87` `if (!modelValueComputed.value.includes(id)) {`
- `uploadQueuesStore.ts:535` `addToCachedAuthors(queues.value[queueId].items[foundIndex].authors)`

**`inputs3`**, against `queueRowKeywordsAuthors`: 4 of 10 cases red.

- `KeywordRemoteAutocompleteWithCached.vue:93` `modelValueComputed.value = [...modelValueComputed.value, keyword.id]`
- `AuthorRemoteAutocompleteWithCached.vue:88` `modelValueComputed.value = [...modelValueComputed.value, id]`
- `AssetQueueItemEditable.vue:485` `:author-conflicts="item.authorConflicts"`
- `KeywordRemoteAutocompleteWithCached.vue:146` `if (fetchedItemsMinimal.value.size === 0) return true`

**`inputs4`**, against `queueRowKeywordsAuthors`: 2 of 10 cases red.

- `KeywordRemoteAutocompleteWithCached.vue:173` `:min-search-chars="2"`
- `AuthorRemoteAutocompleteWithCached.vue:168` `:min-search-chars="2"`

---

## 5. NEW (not fixed)

Each is pinned as it is today by the case named.

| # | what | where | pinned by |
|---|---|---|---|
| N1 | **A save of a queue that fails says nothing.** In both overlays a refused bulk save (500, a 422 with validation errors, an answer other than 200) stops the spinner and shows no alert: the PATCH is made by hand, rejects with a bare axios error or with the list of answers, and `showErrorsDefault` knows neither, so it returns `false` and nobody reads that. The user cannot tell a failed save from a slow one | `asset/api/assetApi.ts:228-265`; `footer/AssetFooterUploadOverlayFull.vue:87-89`, `:108-110`; `footer/AssetFooterSelectedFull.vue:74-76`, `:94-96` | `overlaySave`, nine cases "says nothing when the save fails" |
| N2 | **Author conflicts of an asset picked for mass edit never get their names.** The batch load puts the conflicts on the row and asks the name cache for the row's authors only; the chips of the conflicts spin for good. An uploaded row is fine: the settlement asks for both | `asset/store/uploadQueuesStore.ts:528-535` (against LIB `uploadSettle.ts:165-166`) | `queueRowKeywordsAuthors`, "…without their names: the chips go on spinning" |
| N3 | **"Replace all" with no keyword and no author picked erases the keywords and authors of every row.** A custom field nothing was typed into is skipped by "fill all" / "replace all", keywords and authors are always written. The single "replace" button of an untouched custom field likewise writes `undefined` over every row of the type | `queue/AssetQueueSelectedSidebar.vue:54-107` | `massOperationsRows`, "…takes the keywords and the authors of every row away…", "takes the value of the rows away…" |
| N4 | **A fail reason the application has no text for shows nothing.** The chip is not drawn; the editable row then says "Error" and nothing else (the unknown-error text is the `else` of the reason, not of the chip); the compact row loses its message too, because the reason is looked up first | `AssetFileFailReasonChip.vue`, `AssetQueueItemEditable.vue:345-358`, `AssetQueueItemList.vue:27-33` | `failReasonChip` (2), `queueListRow` (1) |
| N5 | In the question "Are you sure you want to stop the upload?" the button that stops and the cross that does not have the same name: "Close" / "Zatvoriť" (`system.upload.stop` is both the name of the stop button and the text of the confirm button) | `footer/AssetFooterUploadButtonStop.vue:67-88` | `uploadStopQuestion`, first case |
| N6 | A pressed author conflict disappears (Vuetify closes a closable chip), but the row keeps the conflict: the heading "Author conflicts" stays over nothing, and the chips are back at the next draw | `author/components/AuthorRemoteAutocompleteWithCached.vue:236-252` | `queueRowKeywordsAuthors`, the upload-row conflict case |

Known before, met again (not new): the icon buttons without an accessible name - cancel of the compact row, "save"
of both overlays, the mass operations toggle, the hide chevrons, the close of the mass-edit overlay (owner's
deferred finding 14); the shared array of the mass operations (LIB finding 5).

Not a fault, worth knowing for step 5: **a duplicate row in DAM keeps the id of the asset its own upload made**
(`duplicate: 'markDuplicate'`), and its delete button deletes that asset. With the library's `becomeOriginal` the
same button would delete the original. Pinned by `queueRowActions`, "deletes the asset the upload of a duplicate
made, never the original".

## 6. For whoever runs these next

- A case that needs names from the name caches waits 5 s of fake time (`NAMES_READ`): the cache puts a lookup off by
  1.5 s after the last id, at most 5 s.
- `seedQueue` of `fakeDam.ts` leaves the counters of a queue at zero processed; `startUploadUi` recounts them.
- The mass operations start open or folded by the width of the window at mount (`useDisplay().mobile`); happy-dom
  is 1024 px wide, which Vuetify calls mobile. `setWindowWidth` of the support file changes it for one case.
- A failed edit button shows no alert while a navigation is pending (`usePageNavigation().onPage()`); the support
  file therefore finishes its first navigation before anything mounts.

## 7. Left behind, for the one clean-up

Nothing of this is in a repository.

| what | where |
|---|---|
| the temporary directory of my runs, with the config that bends lines in memory and the edits and reports of the 34 rounds | `admin-dam/node_modules/.cache/vitest-tmp-dam-w4/` |
| my scripts and their results | session scratchpad: `dam-w4-*`, `w4-files.txt`, `probe.ts` |
| `mutate.py` in the session scratchpad | **my mistake:** a file of that name was there (it looks like the first version of another agent's `mutate2.py`) and I overwrote it with my script at 18:02. Its content is lost; the file now only says so. Nothing in a repository was touched by it |

