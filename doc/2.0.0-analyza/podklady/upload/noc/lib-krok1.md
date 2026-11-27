# LIB, step 1: the eleven alignment patches, each with a test of the target behaviour

Written 2026-10-07 against `next` at `49bd815b` plus the step-0 tests in the working tree. Eleven production
files changed, five test files extended, four test files added. Nothing was committed. Paths are under
`src/domains/dam/` unless they start with `src/`.

## Result

`yarn test:browser` (once, at the end, started 23:08):

```
 Test Files  277 passed (277)
      Tests  2902 passed (2902)
   Duration  162.44s (worker 93%, setup 4%, import 2%, tests 1%)
```

Before: 273 files / 2836 tests. Four files and 66 cases are new. The suite runs with one retry a case; the nine
files below were also run on their own with `--retry=0`, the two with moved clocks or debounces three times.

`yarn test:eslint`:

```
 Test Files  7 passed (7)
      Tests  82 passed (82)
```

`yarn lint:tsc`: clean (it builds the test project too). On the 20 touched files: `oxfmt --check`, `oxlint`,
`eslint` clean; `stylelint` clean on the eight `.vue` files.

**Every new case was seen failing on the unpatched code.** The eleven production files were put back to their
`HEAD` content by file copy (no git write), the nine test files run, and my versions copied back: 38 cases failed,
at least one for each of the eleven items; the 91 others are the cases that pin what must not change. With the
patches all 129 pass.

While the suite ran, another agent began adding files under `uploadQueue/settlement/` (first seen 23:11). Nothing
outside that folder imports them (checked again at 23:15), and it had no test file yet, so the numbers above are
of the tree with my changes only. I saw no error and no failing test from that folder: the suite, and the
`yarn lint:tsc` right after it, were clean. I edited nothing there.

## The patches

| # | Files changed | What changed | Tests |
|---|---|---|---|
| 1 | `api/damAssetApi.ts:38-40, :215, :265` | `listItemsToMetadataBulkItems` and `updateAssetMetadata` no longer put `mainFileInternal` / `mainFileOverrideInternal` into the body. The body has a type of its own without the two; `AssetMetadataBulkItem`, the type of the answer, is as it was (changed in review round 1, below). Reading is untouched: `imageWidget/utils/metadataToImageMap.ts:42` still takes `mainFileInternal` from the answer into `dam.internal`. | `__tests__/damAssetApiBulkMetadata.test.ts`: both bodies asserted exactly (`toEqual`), so neither key is there; three new cases: the answer says internal / not / unknown → `mapUploadMetadataToImages` gives `dam.internal` true / false / false, `flags.internal` stays off. |
| 2 | `uploadQueue/components/UploadQueueItemEditable.vue:151-154, :200-205, :341` | New `showRemove` = refresh is offered **or** the row is failed; the trash button follows it. The status watch has a `Failed` branch: the 20 s timer is cleared and refresh is shown at once exactly when the row has an `assetId`. | `uploadQueue/__tests__/uploadQueueRowRefresh.test.ts`, new `describe('the buttons of a failed row')` (7 cases): remove + refresh at once with an asset; remove alone without one; remove confirmed emits `removeItem`; a row failing while uploading / processing / uploaded gets them at once and its wait is dropped; they go when the row is settled as uploaded after all. Plus 3 cases that waiting / uploading / processing rows are as before. |
| 3 | `imageWidget/components/ImageWidgetMultipleInner.vue:717`, `assetSelect/components/AAssetListInner.vue:435` | `@drop="onFileInput"` on `UploadQueueDialog` in both hosts: the handler of each host's own `@files-input`. | `uploadQueue/__tests__/uploadQueueDialogDrop.test.ts` (new, 10 cases, no module mock): both hosts mounted over the real store and, for the widget, the real limit dialog; the queue dialog is a stub that emits. Each case runs for `filesInput` and for `drop`. Widget: 2 + 3 queued; 49 + 3 → the limit dialog asks and nothing is queued; a read-only widget queues nothing. Asset list: queued and started; 49 + 3 → 52 rows, nobody asked; an empty drop makes no queue. |
| 4 | `uploadQueue/components/UploadQueueDialogSingleSidebar.vue:60-81` | `waitsForMetadata` (boolean) became `waitsFor`: `'file'` while the item is `processing`, `'metadata'` while it is uploaded without metadata, else `null`. The existing watch arms the 20 s (`SHOW_REFRESH_AFTER_SECONDS`) on every change of it, so each wait counts from its own start, as in the row. The button and `useUploadQueueItemRefresh` were already there. | `uploadQueue/__tests__/uploadQueueDialogSingle.test.ts`, 8 new cases: refresh after the wait on a processing item, with and without tabs, the click settles it with its metadata; it stays while the server says "not processed yet"; not offered when the item settles in time; taken back and offered anew when the item turns uploaded without metadata; not offered for an uploading, waiting or failed item. |
| 5 | `uploadQueue/store/uploadQueuesStore.ts:532-533` | `updateFromDetail` also copies `mainFileSingleUse` from the asset it re-reads. | `uploadQueue/__tests__/uploadQueueOperations.test.ts`, 2 cases (`true`, `false`): rows of the asset in both queues take it, the row of another asset does not, and the next bulk save of the queue sends it. |
| 6 | `assetDetail/components/AssetCustomMetadataForm.vue:49-52` | `|| 2` → `?? 2`. | `assetDetail/__tests__/AssetCustomMetadataFormPinned.test.ts` (new, 7 cases, real form): 1, 3, 4, 5 → that many pinned; 0 → none pinned, all behind "show all"; setting missing, or no image settings at all → two. |
| 7 | `uploadQueue/composables/uploadService.ts:100-103` | `useUpload` hands `useCommonAdminCoreDamOptionsGlobal().apiTimeout` to `useDamUploadChunkSize`; `undefined` and `null` fall to the composable's default of 30. | `uploadQueue/__tests__/uploadServiceApiTimeout.test.ts` (new, 5 cases, real service against the fake DAM): 3000 bytes at a given 100 B/s go out as 1000/1000/1000 with 30 s, 1500/1500 with 60 s, 3000 with 120 s, and 1000/1000/1000 when the option is `undefined` or `null`. |
| 8 | `uploadQueue/composables/uploadService.ts:170-175` | In the retry loop: `lastLoaded = 0; lastTimestamp = 0` when `attempt > 1`. | `uploadQueue/__tests__/uploadServiceRetry.test.ts`, new `describe('the speed of an upload')`, 2 cases with a clock the test moves: a try that got 900 000 of 1 000 000 bytes out and failed, then a retry reporting 10 000 → reports `[900, 900, …]`, all positive (unpatched: the second is about −4000). And: the first try of the *next* chunk still measures from the chunk before (1000 and 2500 B/s → 1750). |
| 9 | `author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue`, `author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue`, `keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue` | All three read `unresolved` from `useCachedItem` and show `'#' + id` for it, with the existing text `common.model.cachedUnavailable` as a tooltip (chip) or `title` (text only), as `ACachedChip` does. The conflicts chip lost its one-shot latch for `useCachedItem`. | `__tests__/damNameChipsUnresolved.test.ts` (new, 14 cases, real caches over a fake DAM that returns one author and one keyword and not the others): spinner while asked, then `#id` without a spinner in all three; chip and text-only variants; a known id shows its name and no tooltip; a caller's `title` wins; no id → `-`; the conflicts chip can still be added, and shows the name once the author is known after all. |
| 10 | `uploadQueue/store/uploadQueuesStore.ts:36-38, :101, :132` | Module-level `queueItemSequence` and `uniqueQueueItemKey(prefix)` as in the app (`admin-dam … uploadQueuesStore.ts:67-69`). Used for file rows **and** copy rows. | `uploadQueueOperations.test.ts`, 2 cases: five rows from files named `a.jpg` ×4 and `b.jpg` in two queues have five keys; an asset copied twice has two. |
| 11 | `uploadQueue/store/uploadQueuesStore.ts:509-520` | `stopItemUpload` looks the row up (`queue.items.indexOf(queueItem)`) and removes that; nothing is removed when it is not in the queue. The third parameter stayed, optional and unused (`_index?: number`). | `uploadQueueOperations.test.ts`, 4 cases: the waiting row stopped with position 0, 1 or 7 → that row goes, the two uploads are not aborted; a row already removed, stopped with position 0 → no row goes. |

## Existing assertions changed, and why

1. `__tests__/damAssetApiBulkMetadata.test.ts` (step 0) › "sends what the row holds…" and › "sends the asset in the
   shape of the bulk save…": `toMatchObject` → `toEqual` on the whole body. Step 0 left the two `internal` keys out
   on purpose (R11); with them gone the body can be pinned exactly. The header comment says so now. The asset of
   the second case is built with `mainFileInternal: true, mainFileOverrideInternal: true`, to show they are not
   sent back.
2. `uploadQueue/__tests__/uploadQueueRowRefresh.test.ts` (older, tracked) › "is not offered when %s before the wait
   is over": the row `['the row fails', …]` is gone, the other row became a plain `it`. It pinned "a row that fails
   has no refresh once the wait is over"; by R8 a failed row with an asset has it at once. `mountRow` takes an
   optional `Partial<UploadQueueItem>`.

Nothing else was changed in an existing case. In particular the single-dialog case "offers refresh on an uploaded
item still without its metadata" still sees exactly one 20 s wait: the wait for the file is replaced by the wait
for the metadata.

## Decisions taken alone

- **6, missing value.** A configured number is used, 0 included. When there is none (no setting, or no settings
  for the asset type) the fallback stays **2**, as today; the app's is 0. The backend always sends the number
  (report 7), so the two differ only on a malformed configuration. One character to change if the app's fallback
  is wanted before the form becomes shared.
- **7, where the option is read.** In `useUpload`, as the app does, not as a new default of
  `useDamUploadChunkSize`: that composable is a public export, admin-dam passes its own value, and
  `damUploadChunkSize.test.ts` runs it without any plugin options. `apiTimeout` is a global option, not one of a
  named config, and `useCommonAdminCoreDamOptionsGlobal()` already returned it: nothing was missing in
  `composables/commonAdminCoreDamOptions.ts`, and I did not touch that file (step 2 rewrites the options there).
  admin-cms and admin-ugc both pass the literal `30` (`main.ts:63`, `main.ts:71`), so nothing changes for them.
- **7, `null`.** Treated as absent (`apiTimeout ?? undefined`): a `null` from a config file would otherwise make
  every threshold 0.
- **9, tooltip.** Added, with the key `ACachedChip` uses. No text was added or changed.
- **9, conflicts chip.** The latch was replaced by `useCachedItem`, not extended: the cache asks again for a
  not-found id on the next `add()`, and a latched placeholder would keep `#id` after the name arrived. Side
  effects, the same as in the two sibling chips: it follows a changed `id` prop, and goes back to the spinner
  when the cache prunes its entry.
- **9, order.** A `title` given by the caller wins over `#id`, as in `ACachedChip`.
- **10, copy rows too.** `asset_<id>` became `asset_<id>_<n>`. The brief names the file rows only and the app
  left its `asset_<id>` alone, but a copy that already exists answers with the existing asset, so the same asset
  can be added twice (`imageWidget/components/ImageWidgetMultipleInner.vue:225-227`), and step 2 wants an immutable key per row. No
  reader of the key format exists (grep). To undo: `uploadQueuesStore.ts:101`.
- **10, the sequence** is per module, shared by every store instance and never reset, as in the app.
- **11, signature.** `(queueKey, queueItem, _index?)`: the caller in `UploadQueueEditable.vue:45` and three test
  calls pass a position and compile unchanged. A row that is no longer in the queue is still marked `Stop` and
  its request aborted, as in the app; nothing is removed.
- **4, which states.** `processing` only, as the plan says. The row of the queue also counts 20 s from
  `uploading`; the dialog does not. A failed item gets no refresh in this dialog: item 2 is about the queue row,
  and this dialog always has its close button.
- **2, how little.** The timer of the row still tests the status it was armed with
  (`UploadQueueItemEditable.vue:185-189`). With the `Failed` branch clearing it, no status is left for which that
  matters, so it was not rewritten.
- **3, which handler.** `onFileInput`, as asked, although `ImageWidgetMultipleInner` has an `onDrop` with the
  same body for its own dropzone.
- **8, the second case** pins that the first try of a chunk does *not* start the measuring anew. That is today's
  behaviour and D4 turns it around in step 5; the comment above the case says so. Delete it if a pin on a
  behaviour that is to change is unwanted.
- **Liveness check by file copy.** Described under "Result". It was done before the step-2 files appeared, and
  each file was compared with my copy before and after.

## Not done

- "Obe: rola riadku v type `UploadQueueItem`" (the last line of step 1 in the plan) is not among the eleven items
  of the brief. `types/UploadQueue.ts` is untouched.
- `doc/changelog/2.0.0.md` is untouched. Visible to a user: 2, 3, 4, 9 (and 6 where an ext system pins 0).

## Looked wrong, left alone

1. *(Settled in review round 1: the public type is strict again.)* **`AssetMetadataBulkItem` is public through
   `customUploadMetadataToImageMap`.** With the two fields optional, an
   application that reads `bulkItem.mainFileInternal` as `boolean | null` gets a type error. admin-ugc ignores the
   argument; admin-cms was not checked.
2. **`apiTimeout: 0`** (axios' "no timeout") makes every threshold 0 and pins the chunk at the minimum size, here
   as in admin-dam. Not guarded.
3. **The chunk request has its own timeout of 420 s** (`api/damImageApi.ts:13`, pinned by A1), while the chunk is
   sized against `apiTimeout`. The two numbers have nothing to do with each other.
4. **The retry's samples.** After the reset the first report of a retry only sets the time, and the next sample
   counts `loaded` from zero over the time since: the bytes of that first report are counted in. The samples of
   the failed try stay in the average (the last 15). Both as in the app.
5. **An empty drop.** `AFileDropzone` emits `drop` also when no file passed its check. `AAssetListInner` returns
   early; `ImageWidgetMultipleInner.onFileInput` hands `[]` to the limit dialog, which "adds" nothing and emits
   `afterAdd`. Harmless, and the same for its own dropzone today.
6. **`ImageWidgetMultipleInner.vue:714`** passes `multiple` to `UploadQueueDialog`, which has no such prop.
7. **`updateFromDetail` on a row still waiting for its file** writes the metadata, and now the switch, without
   marking the metadata as loaded, so the read that settles the row overwrites all of it (step 0, finding 5).
8. **UGC and `#id`.** The name lookups always go to `/adm/v1/…` (step 0, finding 4). If a UGC asset ever carries
   an author or keyword id and that request is refused, its chip was empty and now shows `#id` with "The record
   could not be loaded".
9. **The chips mount the upload store** to draw the "new" icon (report 6, headline 6); the test of the chips has
   to install the plugin options for that reason alone.

## How to run

```
npx vitest run \
  src/domains/dam/__tests__/damAssetApiBulkMetadata.test.ts \
  src/domains/dam/__tests__/damNameChipsUnresolved.test.ts \
  src/domains/dam/assetDetail/__tests__/AssetCustomMetadataFormPinned.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadQueueRowRefresh.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadQueueDialogDrop.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadQueueDialogSingle.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadQueueOperations.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadServiceApiTimeout.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadServiceRetry.test.ts
```

About 20 s. (Since review round 1 no case waits for the 1.5 s debounce of the name caches.)

## Review round 1

2026-10-08, after the reviews of Codex and Opus (`review-lib-r1-codex.txt`, `review-lib-r1-opus.md`): no bug in
the eleven patches, one type fix, five tests repaired. One production file changed (`api/damAssetApi.ts`, types
only), four test files of mine. Nothing was committed.

### What changed

| Finding | File | What changed |
|---|---|---|
| PROPOSAL 1 | `api/damAssetApi.ts:31-44, :186, :209, :262` | `AssetMetadataBulkItem` is byte for byte what it is on `HEAD`: both `internal` fields required, `boolean \| null`. The request body has a type of its own, private to the module: `AssetMetadataBulkItemBody = Omit<AssetMetadataBulkItem, 'mainFileInternal' \| 'mainFileOverrideInternal'>`, used by `listItemsToMetadataBulkItems`, `updateMetadataSequence` and `updateAssetMetadata`. The public `UploadMetadataToImageMapFn` is unchanged for every consumer. No runtime change; no new export. |
| T1 | `__tests__/damNameChipsUnresolved.test.ts` (rewritten, 15 cases) | Every case sets up what it reads: `beforeEach` empties both name caches and their queues, and holds the caches' pause (`holdLongWaits(1_000)` catches the 1.5 s debounce and its 5 s `maxWait`); the describes that need answered names ask and `elapse()` in their own `beforeEach`. The "still asked for" case holds the two lookups with `dam.hold` and asserts the spinner before the pause is over **and** while the request is on its way, then releases. No case waits real time for the debounce (the file's tests take about 1.4 s together). New 15th case: the cache asks again for a not-found id, the conflicts chip goes back to the spinner and then shows the name. |
| T2 | `uploadQueue/__tests__/uploadQueueDialogDrop.test.ts` (rewritten, 10 cases) | Both hosts are mounted with the **real** `UploadQueueDialog`, its real `AFileInput` and real `AFileDropzone`; only the list of rows (`UploadQueueEditable`) is a stub. Files are picked by setting `files` on the dialog's `<input type="file">` and dispatching `change`, and dropped by dispatching a `DragEvent('drop')` with a `DataTransfer` on the dialog's `.a-file-dropzone`. Every case runs both ways. The ext system of these cases takes images up to 1000 bytes; the "mixed" cases hand over a fitting jpg, a pdf, a jpg of 1001 bytes and a png of exactly 1000, and expect the first and the last queued, in both hosts. The limit case (49 + 3) and the read-only case go through the real dialog too. |
| T4 | same file | The case "are not asked for when nothing passed the check" is **removed**. With or without the guard in `AAssetListInner.onFileInput` nothing observable differs (no file, no row, no queue); what a user can see of that path, files the ext system does not take being left out, is what the mixed cases pin. |
| T3 | `uploadQueue/__tests__/uploadServiceApiTimeout.test.ts` (7 cases) | The two "no timeout configured" cases run at 200 B/s and expect `[1500, 1500]`. 30 s gives that; thresholds of 0 give `[1000, 1000, 1000]`; 60 s gives `[3000]`. Two cases beside them pin 30 → `[1500, 1500]` and 60 → `[3000]` at the same speed. |
| T5 | `uploadQueue/__tests__/uploadQueueDialogSingle.test.ts` (18 cases, as before) | The processing cases mount the sidebar as the dialog draws an item that is not uploaded yet (`enableRoiTab: false`), and turn the region tab on at the point where the dialog does (item uploaded, asset read). The variant of the refresh case is now the application's option, not a drawing: with `simpleAssetSidebar` on, the sidebar has its tabs while the file is processed (asserted) and loses them once the asset is read (asserted). The props the test hands the sidebar are reactive for that. The three older cases that mount with `enableRoiTab: true` are untouched. |

### Checks

- `yarn lint:tsc`: clean. `oxfmt --check`, `oxlint`, `eslint` clean on `api/damAssetApi.ts` and the five test
  files (the four above and `damAssetApiBulkMetadata.test.ts`).
- Eight of my nine test files together, twice, `--retry=0`: `Test Files 8 passed (8)`, `Tests 101 passed (101)`.
  The ninth, `uploadQueueOperations.test.ts`, is being repaired by another agent: not run and not touched by me
  in this round. The whole suite was not run (yours to run).
- `damNameChipsUnresolved.test.ts`: each of the 15 cases run alone (`-t "<suite> > <case>"`, `--retry=0`): 15 of
  15 pass, on the final file.
- T2, that the assertions bite: with the size limit of the cases set where it does not bite (in the test, not in
  production), the four mixed cases fail and the six others pass. I did not mutate `UploadQueueDialog.vue` to
  prove the reviewer's two mutations: other agents and your suite run share this tree.
- T3: a temporary case showed `useDamUploadChunkSize(null)` at 200 B/s stays at 1000, which the new expectation
  rejects. `uploadService.ts` itself was not mutated, for the same reason.

### Found on the way

1. **`/tmp` filled up at about 00:00.** Every `vitest run` leaves `/tmp/<id>/client/` (40 to 108 MB of
   transformed modules) behind; 324 of them had used all 7.9 G. Runs then ended with "no tests", and the harness
   lost command output. Reported to the lead; I deleted nothing outside my own scratchpad. From then on my runs
   had `TMPDIR` at `node_modules/.cache/lib-krok1-tmp`, emptied after each run and removed at the end. Three of
   the first one-by-one runs of the chips file reported "no tests", most likely for this reason, and passed when
   repeated.
2. **A store action makes its own pinia the active one**, also long after its component is gone. The first
   version of the rewritten drop test failed one of its ten cases on every run, now the picked and now the dropped
   variant of one list case: the asset list of an earlier case fetched its list 200 ms after it mounted (a
   debounce), by then inside a later case, and the test's own `useUploadQueuesStore()` then read the queue of the
   earlier case's pinia. Two repairs in the test: it reads
   stores as `useUploadQueuesStore(pinia)`, and the list cases wait for the list request and its answer before
   they go on. Worth knowing for any test here that makes a pinia per case and calls a store outside a component.
3. **Looked wrong, left alone:** that debounced list fetch also runs after `AAssetListInner` is unmounted:
   `assetSelectStore.reset(true)` leaves `selectedLicenceId` as it was, so the guard in
   `assetSelect/composables/assetSelectListActions.ts:61` does not stop it. In an application: one request whose
   answer goes into a reset store.

### Not taken up (as told)

Opus PROPOSAL 4 (what Refresh says on a row whose chunks failed) is logged for the owner. PROPOSALS 2, 3 and 5
and Codex TEST 2 are about files another agent has now, or were not asked of me.

### After round 1: the tree while the store is being rewired (about 00:40)

Run again once the store wiring of step 2 had begun (`uploadQueuesStore.ts`, `uploadApi.ts`, `uploadService.ts`,
`uploadQueueItemRefresh.ts` are another agent's now; I edited none of them in round 1):

- My step-1 changes are still in those files: the unique key (`uploadQueuesStore.ts:42, :167, :197`), stop by
  identity (`:349-357`), the single-use switch in `updateFromDetail` (`:373`), `apiTimeout` and the retry baseline
  (`uploadService.ts:103-104, :173`). `api/damAssetApi.ts` carries my type split beside that agent's constant.
- The same eight files: 7 pass, 96 of 101 cases. **Five cases of `uploadQueueDialogSingle.test.ts` are red, none
  of them mine and none changed by me:** "does not offer it when the metadata comes before the wait is over",
  "keeps the single-use switch…", "offers the author conflicts of the item", and "sends the single-use switch of
  the item on save / saveAndApply". Each sends a metadata notification and waits up to 1 s for the form
  (`:226, :340, :360, :413`); the rewired store reads 2 s after that notification (D8,
  `settlement/uploadPollSchedule.ts:49`), and the file's own timer shim holds only waits of 10 s and more
  (`:100-104`). The plan gives this helper to step 2 (item 12). I left the cases as they are: the fix depends on
  the rhythm the wiring settles on, and two agents in one test file is what the round-1 message ruled out. The 13
  other cases of the file, mine among them, pass on the rewired store.
- `yarn lint:tsc`: four errors, none in a file of mine: `__tests__/damImageApiUploadRequests.test.ts:170` and
  `uploadQueue/__tests__/uploadStatusFallback.test.ts:104, :153, :183` call `damUploadFinish` with the sixth
  argument the wiring has removed. `oxfmt --check` is clean on my five round-1 files.

### To delete (I no longer run `rm`)

- `/home/volar/projects/anzusystems/common-admin/node_modules/.cache/vitest-tmp-lib-b/` (my `TMPDIR` for vitest).
- In the session scratchpad: `files.txt`, `chips-names.txt`, `chips-one-by-one.txt`.

Nothing of mine is left under `src/` that should not be there.

