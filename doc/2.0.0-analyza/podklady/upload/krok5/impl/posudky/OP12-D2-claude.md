# OP12-D2 — review (Claude, adversarial)

Scope: `krok5-praca/zaplaty/OP12-D2.diff` (3 files: `AssetDetailSidebarROI.vue`, new `src/test/asset/roiTab.test.ts`, `doc/changelog/3.0.0.md`) and `pracovne/impl-dam-op12/OP12-D2-e2e.diff`, on admin-dam `next` with OP12-D1 uncommitted underneath; library = the C15a copy in `node_modules/@anzusystems/common-admin`. Brief `zadanie-OP12-D2.md`, note `impl/OP12-D2.md`. Read-only. I ran no test, build or e2e: every claim cites what I read, and what is inferred or not checkable here says so. I read the implementer's logs: snapshot run `pracovne/impl-dam-op12/log/d2-old-1.log`, bends `bends/vysledok.txt:67-81`, CK `vysledky/OP12-D2-testy.log` (130 files / 1 953 tests green; `roiTab.test.ts` wrote nothing to stdout/stderr) and `OP12-D2-linty.log` (green).

Short names: `ROI.vue` = admin-dam `src/domains/coreDam/asset/components/detail/components/AssetDetailSidebarROI.vue` (tree); `Select.vue` = common-admin `src/domains/dam/cropper/components/DamAssetImageRoiSelect.vue` (same code as the installed `dist/domains/dam/cropper/components/DamAssetImageRoiSelect.vue_vue_type_script_setup_true_lang.js:29-79`).

## Answers to the five checks

### 1. Correctness: the switch is complete; the re-read is right while the tab stays open
- **Store.** A grep of admin-dam `src` for `useImageRoiStore|damImageRoiStore|imageRoiStore` finds one user, `ROI.vue` (`:6,32`, now `useDamImageRoiStore`). The old `src/domains/coreDam/asset/store/imageRoiStore.ts:7` (id `damImageRoiStore`) has no importer, and no test touches either store. The copy exports the store at runtime (`dist/common-admin.js:300`, `$i as useDamImageRoiStore`) and in types (`dist/lib.d.ts:331`), id `commonAdminDamImageRoiStore` with all twelve members (`dist/domains/dam/cropper/store/imageRoiStore.js:4-40`). The old id string is nowhere else in `src` or in the dist. `RegionOfInterest` is identical field by field (`dist/domains/dam/types/Roi.d.ts` vs `src/domains/coreDam/asset/types/Roi.ts`), and `fetchImageFile` already returns the library's `AssetFileImage` (`imageApi.ts:10-17`): no cast or adapter, as the note says.
- **Three views.** `AssetDetailView.vue:221-224`, `AssetFileDetailView.vue:207-210` and `AssetDetailDialog.vue:288-291` draw `ADamAssetImageRoiSelect` for `DAM_REGION_OF_INTEREST_UPDATE`. All three draw the same `AssetDetailDialogSidebar` → `ROI.vue` (`AssetDetailDialogSidebar.vue:163-168`), and there is one Pinia store, so all three get the data. Tested: the page (`roiTab.test.ts`) and the list dialog (`externalProviderDetail.test.ts:184-202`); the file detail only by construction.
- **Rotation re-read** (`ROI.vue:63-80`). The cropper is keyed by `imageFile.manipulatedAt` and loads `…?manipulated=<manipulatedAt>` (`Select.vue:49-54,116-125`), so `setImageFile` of the re-read file is what redraws it. `forceReloadCropper()` (`:79,90`) still sets a time nobody reads (harmless). Both guards work as the note says. `rotatedReads` is per instance (it lives in `<script setup>`), and the id check compares with the file the store holds when the answer lands.
- **Spinner.** It is on during the read (`:67`) and the cropper is unmounted meanwhile (`Select.vue:97-102` needs `!loader`). `loadRois` hides it. After a failed re-read the alert shows (`:73-75`), then `loadRois` runs and hides it, unless `loadRois` itself fails (finding 3).
- **Leaving or switching during the re-read.** The guard keeps another slot's or another asset's file out of the frame, but the rest of `afterRotate` still runs (finding 4).
- **`reset()` when the detail closes.** There is none; only a panel's mount resets (`ROI.vue:94`, library `AssetDetailSidebarROI.vue:87`). This is harmless for a stale store: the reset runs in the same flush as the mount of the cropper, before anything is painted. The real cost is that the mount re-seeds from the asset detail store, not from what the rotation read (finding 1).

### 2. Tests
- **Red on the snapshot, and why.** All six fail at the same line: `openTab()`, `roiTab.test.ts:72`, with "expected null to be 'https://dam.test/file-1/detail.jpg?ma…'" (`d2-old-1.log:25`). The C15a cropper reads the library store, which the snapshot panel never fills. That is the right reason for the store switch. What each case checks is shown red only by the bends (`vysledok.txt:75-81`: no re-read → 3, 5, 6; no guard → 5, 6). Cases 2 (refresh) and 4 (slot) have no red of their own. With C15a the DAM-B6 TypeError can no longer happen, so that is inherent, not a defect. Each guard is pinned by one case: 5 needs the id check, 6 the counter. The bend removed both at once, which is enough.
- **Real page.** Yes: `AssetDetailView` under the router, the real sidebar and panel, the library's real `ADamAssetImageRoiSelect` and `ACropper`. Only the client is fake.
- **`__vueParentComponent`.** Keep it.
  - How it works: Vue sets it in `mountElement` only when `NODE_ENV !== 'production'` or with prod devtools (`@vue/runtime-core/dist/runtime-core.esm-bundler.js:5875-5878`). vitest runs the dev build. `.a-cropper` is `ACropper`'s root element (`ACropper.vue:648`; dist `ACropper.vue_vue_type_script_setup_true_lang.js:14,276`), so the property holds that instance and `props.src` is its prop.
  - It fails closed: if Vue stops setting it, or the class moves under a child component, `framed()` returns `null` and all six go red. It cannot pass falsely.
  - A stub would be worse. The library is inlined (`vitest.config.mts:56`), so its internal `dist/.../ACropper.js` could be mocked by path. That would tie the test to the bundler's file layout and drop the real `ACropper` (its `src` watch, `ACropper…lang.js:258`). admin-dam has no `@vue/test-utils`.
  - It is the only use of `__vueParentComponent` in either repository; `roiTab.test.ts:36-37` says why it is used.
- **`externalProviderDetail.test.ts`.** No expectation changed. The file is the HEAD version: `git status` does not list it, and `diff -rq` of the snapshot `src` against the tree lists only `ROI.vue` and the new test. Its case "shows the picture of its asset after the detail of an image of DAM was left on its region of interest" (`:184-202`) was red on the snapshot, because there was no `.a-cropper` (`d2-old-1.log:43-44`, `{ picture: false, frame: false }`). It is green after D2 (CK). It is the only coverage of the list dialog's cropper.
- **Gaps**: finding 5.

### 3. The implementer's two older findings: both confirmed, both older than the step
The snapshot `ROI.vue:32-65` has the same code. See findings 2 and 3; one change fixes both, and finding 4 with them.

### 4. e2e
- **The change.** It removes the title tag ` @bug`, `test.fail()` with its DAM-B6 comment, the `bug` annotation and the blank line after them (`git diff` equals `OP12-D2-e2e.diff`). Nothing else under `e2e/` changed (`git status`). The brief's letter was "the marker and its comment", but the tag and the annotation only make sense with the marker, so their removal belongs to it. Nothing filters on `@bug` (`e2e/playwright.config.ts`, `e2e/package.json`, `e2e/README.md`).
- **The comment.** It is at `assetRoi.spec.ts:94` now (`:97` in HEAD), not `:91` as the note and the request say. It should be reworded, and so should the file header (finding 7).

### 5. Changelog and note
I checked every sentence against the code; three do not match exactly (findings 1, 6 and 7). The rest is accurate:
- the trace of the bug (old `ROI.vue:50-65`, `?timestamp=undefined`);
- "admin-dam's own is no longer used";
- the guard and the failed read;
- the Slovak labels (`locales/sk/coreDam/asset.json:121,170,173,174`);
- the note's counts (324-line patch, 130 files / 1 953 tests, the bends).

## Findings

### 1. Medium: after a rotation, leaving the tab and coming back draws the image from before the rotation again
- **Where.** `ROI.vue:93-105` seeds the store on every mount from `assetDetailStore.asset.mainFile` (`:101`), and nothing updates that copy after a rotation:
  - `AssetFileRotate.vue:26-38` only emits `afterRotate`;
  - `afterRotate` writes only the ROI store (`ROI.vue:71`);
  - the detail is read again only when `useAssetFileChanged` tells it to (callers: `AssetFileMainRoute.vue:63`, `assetDetailSidebarSlotsActions.ts:110,125`), or on a notification whose status differs (`assetDetailStore.ts:244`).
- **Scenario.**
  1. On the asset page or in the list dialog, open "Fókus" and press "Otočiť doprava". The frame draws the rotated image (`m2`).
  2. Open "Info", then "Fókus" again. The panel and the cropper mount again (`AssetDetailDialogSidebar.vue:163-168`, `AssetDetailView.vue:221`).
  3. `reset()` + `setImageFile(mainFile)` give the cropper the pre-rotation `manipulatedAt`, so it loads the URL it loaded before the rotation (`Select.vue:49-54`). It also gets the pre-rotation `imageAttributes`; only the region is read anew.
  4. The region maths uses that width and height (`cropperJsService.ts:22-50`). A drag therefore saves a region computed from the old dimensions (`Select.vue:77-95`), which is exactly what the re-read was meant to stop.
  5. This lasts until the asset is read again.
- **Claims affected.** The changelog's "After a rotation the file is read again and the frame draws the rotated image" and the note's "Po otočení orezávač nakreslí otočený obrázok" hold only until the tab is left. No case covers it: every case stays on the tab.
- **Fix.**
  - When the rotated file is the asset's main file, put a copy of the re-read into the detail store too. Use a small store action next to `setMainFile` (`assetDetailStore.ts:192-199`), e.g. `if (asset.value?.mainFile?.id === file.id) asset.value.mainFile = file`, called from `afterRotate` after `:71`.
  - Case: rotate, open "Info", open "Focus" → `framed()` is `…?manipulated=m2`. It is red today.
  - This goes beyond the brief's letter (which asked for the re-read) but stays within its intent. The leader decides whether it is a D2 c1.
- **Not verified here:** what the server returns after a rotation (dimensions, when `manipulatedAt` changes). The fake keeps 800×450.

### 2. Medium (older than the step): a late answer of a slot change or a regions read overwrites a later choice; a drag can then save one file's region with another file's dimensions
- **Where.**
  - `activeSlotChange` (`ROI.vue:82-91`) awaits the file (`:86`) and writes it unconditionally (`:87`).
  - `loadRois` (`:38-54`) takes the file id at `:41`. After two awaits it writes the region (`:44`) without checking that the store still holds that file.
  - The cropper recomputes its crop on every new `roi` (`Select.vue:59-65`) and saves with the store's current `roi` and `imageFile` (`:77-95`).
- **Scenario A (the implementer's).** Slot `B` is chosen and its file read is slow. Then `C` is chosen and read fast, so the frame shows `C`. `B`'s answer lands: `setImageFile(B)`, then `B`'s regions. The select says `C`, but the frame and "Otočiť…" (`ROI.vue:161`) act on `B`.
- **Scenario B (worse, not in the note).** Slot `B` is chosen; its file read is fast, its regions list is slow. Then `C` is chosen and finishes (`C` + `ROI-C`). `B`'s list answers and `setRoi(ROI-B)` lands over file `C`. The frame draws `C` with `B`'s region, and a drag sends `PUT /roi/<ROI-B>` with points computed from `C`'s width and height, which corrupts `B`'s region.
- **D2's share.** `afterRotate` adds one more racer of this kind: its `loadRois` (`:77`) against a slot change made meanwhile. D2's guard protects only the file, not the region.
- **Fix** (one change for 2, 3 and 4): one load counter for everything the panel loads (mount, slot change, rotation), plus an unmount flag.
  - Each action takes `const load = ++loads`. After every `await` it writes `imageFile`, `roi` or the loader only while `load === loads && !gone`.
  - This replaces `rotatedReads` and the id check, because a slot change bumps the counter too.
  - `activeSlotChange` and `afterRotate` wrap their file read the same way: if a read fails while it is current, they show the alert, hide the loader and stop. The early return for a slot without an image hides the loader that a superseded load left on.
  - Sketch:
  ```ts
  let loads = 0
  let gone = false
  onUnmounted(() => (gone = true))
  const isCurrent = (load: number) => load === loads && !gone

  const loadRois = async (load: number) => {
    const file = imageRoiStore.imageFile
    imageRoiStore.showLoader()
    try {
      const list = file ? await fetchImageRoiList(file.id, pagination, filterData, filterConfig) : []
      const roi = list.length > 0 && list[0].id ? await fetchRoi(list[0].id) : null
      if (isCurrent(load)) imageRoiStore.setRoi(roi)
    } catch (error) {
      if (isCurrent(load) && !showErrorsDefault(error)) showUnknownError()
    } finally {
      if (isCurrent(load)) imageRoiStore.hideLoader()
    }
  }
  ```
  - Cases: choose slot `B` then `C`, with `B`'s file (scenario A) or `B`'s regions list (scenario B) answered last. The frame and the region stay `C`'s.

### 3. Low (older than the step): a failed regions read leaves both spinners on for good and says nothing
- **Where.** `loadRois` (`ROI.vue:38-54`) has no `try`; the loader is hidden only on the success paths (`:45,49,53`). None of its callers catches:
  - `onMounted` (`:102`), so `:104` never runs;
  - `activeSlotChange` (`:88`), and its own file read at `:86`;
  - `afterRotate` (`:77`), whose new `try` covers only the file read.
- **Scenario.** The tab opens, a slot is chosen or a rotation ends, and `GET /image/{id}/roi` or `GET /roi/{id}` fails. `loader` stays `true`:
  - the panel spins (`:129-137`);
  - "Znovu načítať náhľady" is gone (`:111`);
  - the cropper shows its spinner instead of the frame (`Select.vue:97-115`).

  The rejection goes to Vue's error handling: Sentry's handler when configured (`main.ts:52-55`), the console otherwise. No alert is shown. The only way out is to leave the tab and come back (the mount runs `reset()`).
- **Fix.** The `try/catch/finally` in the sketch of finding 2, as the library's own panel has it (common-admin `src/domains/dam/assetDetail/components/AssetDetailSidebarROI.vue:59-80`); the same for the slot change's file read. Case: the regions list answers 500 → an alert, no spinner, the button is back.

### 4. Low: `afterRotate` goes on after its guard has said "stale", and after the panel is gone
- **Where.** `ROI.vue:70-79`. When the write is skipped (`:70` false), or when the panel was unmounted during the read, `loadRois()` (`:77`) and both `forceReload…` calls still run.
- **What D2 changed.** Before D2, a rotation answered after the tab was left did nothing, because Vue drops the emits of an unmounted component (`@vue/runtime-core/dist/runtime-core.esm-bundler.js:4571`). A rotation answered before ran `loadRois` at once. Now the read at `:69` can outlast the panel, and whatever follows it (a new `loadRois` with its two requests, or the alert) starts after the panel is gone.
- **Scenarios.**
  - Two rotations, read 2 answered first. Read 1 lands and is skipped, but its `loadRois` shows the loader again: the frame drawn after read 2 is unmounted and mounted again (a drag in progress is lost), and the regions are read twice. `roiTab.test.ts:236-241` passes through this without noticing.
  - The same after a slot change (case 5): the new slot's frame flashes and its regions are read again.
  - Rotate, then open "Info" (or close the page) while the read runs. The store still holds the file (there is no reset on unmount), so the answer is written, and `GET …/roi` and `GET /roi/{id}` go out after leaving. A failed read shows its alert on whatever page the user is on; the pages suppress that with `onPage()` (`AssetDetailView.vue:94,106`).
  - In the list dialog, when the next asset's panel has mounted meanwhile: the old `loadRois` reads the new asset's file (it reads the store at call time) and toggles the loader under the new panel's own load.
- **Fix.** Return right after the read when it is not the latest or the panel is gone: no `loadRois`, no alert; the newer load owns the loader. This falls out of the counter in finding 2.

### 5. Low: missing cases
- **Failed re-read.** No case covers it, though the changelog promises "A read that fails says so, and the frame keeps the image it has" and PRAVIDLA rule 5 asks for it. Suggested case: after `openTab`, set `server.fileBy('image', 'file-1', () => { throw httpError(500) })` and rotate. Expect one alert (`ui.alerts()`), `framed()` still `m1`, the previews back and no spinner.
- **Leaving the tab after a rotation.** No case does it (finding 1).
- **Weak check in case 4.** `roiTab.test.ts:197` (slot) checks `stringContaining('…preview.jpg?timestamp=')`, which `?timestamp=undefined` (the DAM-B6 symptom) also passes. Case 1 (`:158`, `\d+$`) is the one that pins it; use the same pattern in case 4.

### 6. Low: three sentences say a little more or a little less than the code
- **Changelog `3.0.0.md:140`, slot change.** It says "…and the choice of another slot stopped with an error where they reload the previews, which were never drawn anew". For the slot change, the old code threw at `forceReloadRoiPreviews()` only after `loadRois()` had set the new region and hidden the loader (snapshot `ROI.vue:62-63`). So the chosen slot's previews were drawn (other URLs, with `?timestamp=undefined`); only the reload button and the rotation left them undrawn. Suggest: "…stopped with an error where they reload the previews; after the reload and after a rotation they were never drawn anew".
- **Same entry, "no later rotation was read meanwhile".** The counter drops an older read as soon as a later rotation has *started* its read (`ROI.vue:66,70`), not once that read has finished. Suggest "and no later rotation is being read". The comment at `ROI.vue:61-62` ("unless another rotation read it meanwhile") has the same imprecision.
- **"The frame shows the rotated image"** (title and body): only until the tab is left (finding 1). If finding 1 is not fixed in D2, say so.

### 7. Low: e2e comments that the one exception left behind (outside D2's exception: for the leader or the owner)
- **`e2e/tests/assets/assetRoi.spec.ts:94`.** It reads "A guard for the bug above: whatever the reload button does or fails to do, it must not damage the asset." The test above no longer names a bug. Suggest: "Whatever the reload button does, it must not touch the asset: its main file stays."
- **The header (`:16-25`).** It says "**There is no cropper** … `PUT /roi/<id>`, which nothing in this build calls". That is wrong for a user with `dam_regionOfInterest_update`, which DAM-B6's `test.fail()` presupposed (only then was the library's definition made first). For that user the left pane is the library's cropper, and a drag calls `PUT /roi/<id>` (`Select.vue:84`, `damImageRoiApi.ts:22-31`). After D2 that is certain. The header should say instead that the spec does not drag the cropper.
- **Note `OP12-D2.md:31`.** The comment is at `:94`, not `:91`.
- **No list to close DAM-B6 in.** `KNOWN-BUGS.md` is nowhere in admin-dam, although other specs still cite it.

### 8. Info
- **Dead calls.** `forceReloadCropper()` (`ROI.vue:79,90`) sets `timestampCropper`, which nothing reads (grep of `src` and of the library's dist). Harmless; they can go with the counter fix.
- **Manifest entry.** When the leader deletes `src/domains/coreDam/asset/store/imageRoiStore.ts`, `scripts/explicit-imports.manifest.json:645` still names it. That manifest is a record of the codemod (named only in `3.0.0.md:84`) and no script reads it.

## Verdict
The switch to the library's store is complete and correct. The three views get their frame back, the rotation re-read and its two guards do what the note says while the tab stays open, and the e2e change is limited to the marker.

Before closing:
- **Finding 1.** The rotated image is lost on the next visit of the tab, and it is the step's headline promise. The fix is one store write and one case.
- **Findings 6 and 7.** Wording only.

Findings 2–4 are one counter-and-catch change in the same component: 2 and 3 are older than the step, 4 is opened by its new `await`. I would do them together with the two cases of finding 5, as a c1 or as the next item.
