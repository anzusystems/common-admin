# OP13-D1 — review (Claude, adversarial)

Scope: `krok5-praca/zaplaty/OP13-D1.diff` (16 files) and `pracovne/impl-dam-op12/OP13-D1-e2e.diff`, against the
admin-dam tree (`next`, HEAD `35326f20`, step uncommitted; `git diff --stat -- src doc scripts` = the patch's 15 files +
the new test; `git diff -- e2e` is byte-identical to the e2e diff). Library = the installed copy in
`admin-dam/node_modules/@anzusystems/common-admin` (dist). Backend = `core-dam/vendor/anzusystems/core-dam-bundle/src`
(`B/` below). Brief `zadanie-OP13-D1.md`, `PRAVIDLA.md`, note `impl/OP13-D1.md`, background `impl/OP12-D1.md`,
`impl/OP12-D2.md`, logs `pracovne/impl-dam-op12/log/op13-old-1.log`, `bends/vysledok.txt:104-118`, `bends/op13-*.json`,
`vysledky/OP13-D1-testy.log` (131 files / 1 971 tests green), `vysledky/OP13-D1-linty.log` (green).
Read-only: I ran no test, build or browser. "Verified" = I read it at the cited place; "inferred" = reasoning from
code or css that I did not execute.

Short names: `ROI.vue` = `src/domains/coreDam/asset/components/detail/components/AssetDetailSidebarROI.vue`,
`Rotate.vue` = `…/components/AssetFileRotate.vue`, `store.ts` = `src/domains/coreDam/asset/store/assetDetailStore.ts`,
`Select.js` = installed `dist/domains/dam/cropper/components/DamAssetImageRoiSelect.vue_vue_type_script_setup_true_lang.js`,
`css` = installed `dist/common-admin.css`.

## Verdict

The seven points are done as the brief words them, in every view they concern. No High or Medium finding of the
step. Four Low ones: an ordering hole in the new `manipulatedAt` guard that the backend's second-precision timestamps
open (a narrow regression against the snapshot), point 1 being unreachable against core-dam while the changelog
advertises it, sentences of the changelog and the note that say more than the code, and two stale test comments.
Outside the step, one Medium (older): a "Fókus" tab opened again while a rotation is still running keeps the
pre-rotation image and region and lets the same file be rotated a second time at once.

## Answers to the checks

### 1. The seven points against the brief

1. **Slot without an image** — done. `ROI.vue:104-110`: flag, `setRoi(null)`, `setImageFile(null)`, `hideLoader()`;
   text `ROI.vue:150-155`, keys `locales/{sk,en}/coreDam/asset.json:183` (exact brief texts). Verified in the
   library: with no `imageFile` the frame renders neither `ACropper` nor `VImg` (`Select.js:65`), a commit returns
   without one (`Select.js:51-52`), and the cropper's own late read after a region save stops on the identity check
   (`Select.js:39`, `M.imageFile === e.file`). The rotate buttons go because of the existing
   `v-if="imageRoiStore.imageFile"` (`ROI.vue:194`): that follows from "nothing can be dragged or saved" and the
   changelog says it ("nothing can be dragged or rotated there"). "Znovu načítať náhľady" stays and only bumps a
   timestamp with no region: harmless, and the same as before for that state. The panel is shared by the three
   views with a "Fókus" tab, so it holds for all three. **But see Low 2: core-dam never lists such a slot.**
2. **Rotation answered after leaving / after another slot** — done. `Rotate.vue:39-44` reads the file right after the
   PATCH and writes it into the detail store in `then`, which runs after an unmount (Vue drops only the emit:
   `@vue/runtime-core/dist/runtime-core.esm-bundler.js:4570-4571`, verified). `store.ts:213-218` writes only the
   held asset's main file by id and not an older `manipulatedAt`. The panel's guards stay as they were
   (`ROI.vue:87-93`, `isCurrent` in `readFile` `:72`). Holes: Low 1 (same-second rotations) and, older, Outside A
   (tab opened again before the answer).
3. **Search icon** — done, `AssetSearchInput.vue:39-46`. Vuetify's `VIcon` adds only `role`/`tabindex`/`aria-hidden`
   for a clickable icon and no key listener (`vuetify/lib/components/VIcon/VIcon.js`, 4.2.6), so the new listeners are
   the only ones: no double search. The forms search on their `submit` event only (`AssetToolbarSearch.vue`,
   `ExternalProviderAssetToolbarSearch.vue`, `@submit.prevent`), which a key on an `<i>` does not fire; `.stop` keeps
   the key from `VField` and the form (the case checks the form sees nothing, `drawnControls.test.ts:296-321`). Both
   lists use the component. Nothing visual changes.
4. **Colours** — done, `FilterClosestColor.vue:45-48,52,103,123`. One tooltip "name (code)", `aria-label` = name,
   no `title`. The ten keys match core-dam's colour set exactly (`core-dam/config/packages/image_settings.php:15-78`:
   red … brown) and the brief's texts in both locales; no other `color` key in either `asset.json`. `te` checks the
   locale chain as `t` does (`vue-i18n/dist/vue-i18n.mjs:658-674`, 11.4.16) and the app has `fallbackLocale: false`
   (`src/plugins/i18n.ts:19`), so a key missing in the current locale shows the key, as the brief wants. The
   OP12-D1 keys (`:106-110`) are unchanged.
5. **Narrow layout** — done in all four (`AssetDetailView.vue:218`, `AssetFileDetailView.vue:204`,
   `AssetDetailDialog.vue:285`, `ExternalProviderAssetDetailDialog.vue:207`), on the element the library frame puts
   it on (installed `AssetDetailDialogFrame.vue_vue_type_script_setup_true_lang.js:22,129`). A grep of `src` finds no
   fifth element holding `__left` and `__sidebar`. CSS (verified in `css`; effect inferred):
   - `@media (width<=1144.98px)` `.dam-image-detail__content{flex-direction:column;overflow:hidden;height:calc(100dvh - 48px)!important}`
     is the only rule on the class. Its `!important` height beats Vuetify's `.h-100{height:100%!important}`: the rule
     sits inside `@layer anzu-common{…}` (bytes 371–56974 of `css`, rule at 27776), `index.html:17` orders
     `anzu-common` before `vuetify-utilities`, and for important declarations the earlier layer wins. The note's
     "pevná výška 100dvh − 48px" holds.
   - 840–1144 px: the box's only in-flow child is the picture with fixed heights (`calc(100dvh - 50px)`, or `35dvh`
     with the panel open); the panel is `position:absolute;top:0` with its own `!important` heights and scrolls
     inside (`.sidebar-info__content{overflow-y:auto}`, `AssetDetailDialogSidebar.vue:147`); the card around already
     had `overflow:hidden!important` and the wrapper a fixed `100dvh`. So nothing visible changes and nothing becomes
     unreachable by scrolling; the page views inside `AppLayoutMain` (`pages/(coreDam)/assets/[id].vue:10`) keep
     whatever page scroll they had, because the card's height does not depend on the box. **Not a regression.**
   - below 840 px: before, the row box gave the picture `flex:none` + `w-100` and the panel `width:100%;overflow:hidden`,
     so the panel shrank to zero width; now the picture (35dvh or 0) is above a visible panel. See Low 3 for the
     changelog's wording of the "before".
   - OP12-D1's 840 px rule: `inert`/`aria-expanded` code untouched; the closed panel's `translate(110%)` is now
     clipped by the box instead of the card (same view).
6. **Manifest** — entry removed, totals hand-edited. Regeneration is not possible: `run.mjs` step 1 regenerates
   `src/auto-imports.d.ts` and needs `unplugin-auto-import` (codemod `README.md`, "Commit B" step 1), which admin-dam
   no longer has (not in `package.json`, no `src/auto-imports.d.ts`). The hand edit matches the script's formulas
   (`run.mjs:287-306`): 510 entries counted = `totals.files`; the removed entry's names came from two modules
   (`git show 72ee1f3d:src/domains/coreDam/asset/store/imageRoiStore.ts:2-3`: `pinia`, `vue`) → −2 declarations. The
   note's "27 more deleted files" is right (counted, all 27 missing).
7. **e2e comments** — 13 comment edits in 11 specs, nothing else (`git diff --stat -- e2e`); no `KNOWN-BUGS`
   reference is left in `e2e/`, `src/`, `doc/` or `README.md`; each edited comment stays true.

### 2. Every action touched

- **What the server does (the implementer's open question)** — verified: every successful rotation sets
  `manipulatedAt = App::getAppDate()` (`B/Domain/Image/ImageFacade.php:53`), which is the time the kernel booted
  (`contracts/src/AnzuApp.php:55,176-183`, called in `common-bundle/src/Kernel/AnzuKernel.php:55-57`; the deployment
  runs php-fpm, `core-dam/docker/kubernetes/app-deployment.yaml:102`, so one boot per request — inferred). The
  column is `Types::DATETIME_IMMUTABLE` (`B/Entity/ImageFile.php:37-38`), written by Doctrine as `Y-m-d H:i:s`
  (`doctrine/dbal/src/Types/DateTimeImmutableType.php:40`, `Platforms/AbstractPlatform.php:2182-2185`): a GET returns
  whole seconds, serialized `Y-m-d\TH:i:s.u\Z` (`serializer-bundle/.../Configuration.php:21`,
  `core-dam/config/services/_default.php:15`). So it rises on every rotation **that starts in a later second**; two
  rotations started within one second read back equal. Region create/update/delete raise it too
  (`B/Domain/RegionOfInterest/RegionOfInterestFacade.php:38,52,62`). The PATCH itself answers with the rotated file
  (`B/Controller/Api/Adm/V1/ImageController.php:237-249`, the same `ImageFileAdmDetailDto` as `GET`, `:205-210`),
  with the in-memory `manipulatedAt` (microseconds; inferred from PHP's `new DateTimeImmutable()`); admin-dam's
  `rotateImage` resolves it (`imageApi.ts:118-125`) and nobody reads it.
- **Rotation, second press.** Same instance: hidden while the PATCH runs (`Rotate.vue:60-85`), shown again during the
  read (older); the two reads are then ordered by `manipulatedAt` only → Low 1. New instance (tab left and opened
  again, or the empty-slot path) → Outside A.
- **Late answers.** After another slot: not drawn, the asset gets the main file (case `roiTab.test.ts:349-372`).
  After leaving the tab: one GET, the asset gets it (`:505-523`). After another asset in the detail: `held.id !==
  file.id` (`store.ts:215`); a file has one asset (`B/Entity/ImageFile.php:30-32`), so no file of another asset can be
  written. After a reset of the detail: `!asset.value`. While the next asset loads: written into the old asset, then
  replaced by `setAsset` — harmless.
- **Failures.** PATCH: alert as before. Read: alert only from a current panel load (`ROI.vue:76-78`, `:48-52`),
  silent otherwise; no unhandled rejection (`Rotate.vue:40-43` second handler, the panel's `try`).
- **Can the re-read write an older file?** Yes, in the tie of Low 1. **Break OP12-D2's guards?** No: `afterRotate`'s
  early return, `loads` and `gone` are unchanged, the ROI store is still written only in `readFile` under
  `isCurrent`, the library's identity guard is untouched, and the new store write touches no ROI-store state. Nothing
  in `detail/` or `list/` watches `asset.mainFile` (grep of `watch(`; the only `asset` watcher,
  `AssetListSidebarMetadata.vue:142-152`, fires on replacement, not deep).
- **Search icon / colours.** A second press searches / toggles again, as a click does; Enter auto-repeat repeats as on
  a native button. No request of their own beyond that.

### 3. Tests, bends, changelog and note

- Snapshot run (`log/op13-old-1.log`): 11 of 33 red, each at the assertion it is about (colour name and `title`,
  tooltip text, search count 0, the missing class ×4, no GET after leaving / after another slot, the frame keeping
  `file-1` on the empty slot, `mainFile` `m1`). Green there: the ordering case (expected — the snapshot never wrote a
  late read; pinned by its bend) and "are the four read here".
- Bends (`bends/op13-*.json`, results `vysledok.txt:104-118`): six, each red where it should be. Meaningful.
- `imageDetailLayout.test.ts:65-67` ("are the four read here") can fail only when one of the four files is gone, and
  then the four `it.each` cases fail too; it does not look for a fifth detail. Redundant, not wrong.
- The ordering case (`roiTab.test.ts:374-400`) uses distinct `m2`/`m3`, so it cannot show Low 1.
- Changelog `3.0.0.md:140-144` and the note, line by line: accurate except the sentences in Low 2 and Low 3.

### 4. Keyboard, names, locales

Search icon: Enter on keydown, Space on keyup, the other two edges only prevented, all stopped; name "Vyhľadať" /
"Search" from OP12-D1. Swatches: name = translated colour (or the key), OP12-D1's keys unchanged, tooltip one
`VTooltip`. sk and en both have the ten colours and `slotWithoutImage`; the types (`MessageSchema = typeof sk`) and
`lint:tsc` are green.

## Findings of the step

### Low 1 — Two rotations started within one second: the earlier read can become the asset's main file (narrow regression)
- **Where.** `store.ts:216` (`if (manipulatedAt(file) < manipulatedAt(held)) return`) and `Rotate.vue:39-43`, which
  writes every read, no longer only the panel's current load (snapshot `ROI.vue:95` wrote only when
  `isCurrent(load)`).
- **Scenario.** In the tab, rotate; the buttons are back as soon as the PATCH answers (`Rotate.vue:48-50`), rotate
  again before the wall clock reaches the next second after the first PATCH started. Read 1 (sent at the first
  answer) returns the 90° file with `…T10:00:05.000000Z`, read 2 the 180° file with the same string (section 2).
  If read 1 answers last, `'…05' < '…05'` is false and the asset's main file becomes the 90° file, while the frame
  shows 180° (the panel's `loads`). On the next visit `ROI.vue:124-127` seeds the frame with the 90° `imageAttributes`
  under the same `?manipulated=` address as the 180° image; a region dragged there is computed with width and
  height swapped (`Select.js:53`). On the snapshot the later press always won in the tab.
- **Likelihood.** Needs the tie and read 1 slower than PATCH 2 plus read 2. Rare.
- **Also.** The note ("vyhrá neskoršia zmena, nie neskoršia odpoveď") and `3.0.0.md:140` ("of two such reads, the
  one of the later change") hold only for changes in different seconds.
- **Fix (either).** (a) Use the rotation's own answer instead of a GET: it is the rotated `ImageFileAdmDetailDto` with
  a per-request microsecond `manipulatedAt`, and it removes the request after leaving the tab; check its shape in a
  browser first. (b) Keep the GET and order by press: a module-level `Map<DocId, number>` in `Rotate.vue` bumped at
  press, and write only the read of the latest press of that file, keeping the `manipulatedAt` guard for a newer
  asset read. Case: fake answers with equal `manipulatedAt` for both reads, read 1 last → next visit draws the
  second.

### Low 2 — Point 1 cannot happen against core-dam, the changelog advertises it, and its path drops an in-flight rotation
- **Where.** `ROI.vue:104-110`; `3.0.0.md:141`; fixture `roiTab.test.ts:183` (`assetFile: null`).
- **Why unreachable (verified in `B/`).** The slot list is the asset's slot entities
  (`Domain/AssetSlot/AssetSlotFacade.php:33-44`), each serialized through
  `AssetSlotAdmListDecorator::getAssetFile(): AssetFile` (`Model/Dto/AssetSlot/AssetSlotAdmListDecorator.php:40-44`),
  which throws for a slot without a file (`Entity/AssetSlot.php:171-192`); saving slots drops entries without a file
  (`AssetSlotFacade.php:54`). `AssetDetailSlotSelect.vue:57-63` passes `null` only when the list changes under an
  open select. In the e2e environment an image has one slot and the select is disabled
  (`e2e/tests/assets/assetRoi.spec.ts:72-79`).
- **Scenario if reached** (`slot` null). `setImageFile(null)` unmounts `AssetFileRotate` (`ROI.vue:193-198`). A rotation
  in flight loses its emit; choosing the slot with that image again mounts a new instance with both buttons enabled
  while the PATCH still runs, and the frame shows what the slot read returned (pre-rotation if read before the
  commit). Before the step the instance stayed mounted (the file was not cleared) and its emit reached the panel.
- **Fix.** Keep the code as a guard, but drop `3.0.0.md:141` (the brief wants the changelog for what the editor
  sees) or say it is defensive; the in-flight part goes with Outside A.

### Low 3 — Sentences of the changelog and the note that say more than the code
- `3.0.0.md:140` "and the tab draws it when opened again": only when it is opened after the read landed. Opened while
  the rotation runs, the tab draws the main file from before it and keeps it after the answer (Outside A).
- `3.0.0.md:140` "once the tab is left nothing more is asked or said but the read of a rotated file": "Record was
  updated" is still said after leaving (`Rotate.vue:35`; `roiTab.test.ts:520` pins it).
- `3.0.0.md:140` "(of two such reads, the one of the later change)": Low 1.
- `3.0.0.md:144` "below 840 px the picture stood beside the panel instead of above it", note point 5 "predtým stál
  vedľa neho": with the old row box the panel had zero width (section 1, point 5) — there was no panel, only the
  picture, gone when toggled. Inferred from the css, not seen.
- Note point 2 "Editor vidí … aj vtedy, keď otočenie skončilo až po odchode": only when he comes back after the read;
  its "overené to nemám" can now cite section 2. Note point 1 "Editor vidí": Low 2.
- **Fix.** Reword the five places.

### Low 4 — Two test comments contradict the step
- `roiTab.test.ts:346`: the old line "another one shown by its answer is not read for it" stayed above the new block
  (`:347-348`) that says the main file is read anew.
- `roiTab.test.ts:554-555`: "nothing it asked for writes, asks or says anything after" / "does nothing more once it is
  left…": the rotation's read now writes the asset's main file after leaving (`Rotate.vue:40-43`).
- **Fix.** Delete `:346`; reword `:554-555` and assert `mainFile.manipulatedAt === 'm2'` there.

## Outside the step (older findings)

### Medium A (since OP12-D2) — A "Fókus" tab opened again while a rotation runs keeps the image from before it, and the file can be rotated twice at once
- **Where.** `Rotate.vue:25,30-51` (`loading` per instance, result only by emit); `ROI.vue:121-129` (mount seeds from
  `assetDetailStore.asset.mainFile`); `ROI.vue:86-96`.
- **Scenario.** "Fókus", "Otočiť doprava"; while the PATCH runs (it rotates every resize and writes storage,
  `B/Domain/Image/ImageRotator.php:44-57,90-122`), open "Info" and "Fókus" again. The new panel draws the main file as
  the detail holds it (before the rotation) and reads its region; its `AssetFileRotate` is new, so both buttons
  show. The PATCH answers: "Record was updated"; the old instance's emit is dropped; with this step the asset's main
  file becomes the rotated one, but the open frame keeps the old file, its `imageAttributes` and the region read
  before the commit. A drag sends a region computed with the old width and height (`Select.js:50-61`). Pressed
  meanwhile, a rotate button sends a second PATCH while the first runs: both requests start from the same
  `rotation` and resize paths, and the first one's `emptyAll()` deletes the files the second reads
  (`B/Domain/AssetFile/FileStash.php:37-42`, `ImageFacade.php:56`), so the second fails or one rotation is lost
  (inferred from reading, not run). Same on the snapshot, except that there the asset kept the old file too.
- **Fix.** (1) Rotations in flight by file id in a module-level map in `Rotate.vue`, read by every instance: spinner
  instead of buttons while that file rotates. (2) Let the panel learn of a rotation through the store, not the emit:
  e.g. in `ROI.vue` watch `assetDetailStore.asset?.mainFile`, and when it has the id of `imageRoiStore.imageFile` and a
  newer `manipulatedAt`, run the load `afterRotate` runs (`++loads`, `setImageFile`, `loadRois`); or keep the read in
  the map and let a mounting panel await it. Case: hold the PATCH, "Info", "Fókus", release → frame `m2`; a press
  meanwhile sends no second PATCH.

### Low B (since OP12-D1) — Below 840 px "Info karta" / "Toggle info" shows or hides the picture, not the info
- **Where.** The four toggles (e.g. `AssetDetailView.vue:178-198`); `detailInfoPanel.ts:4-7` says so. The library's frame
  shows `mdi-image-outline` instead below Vuetify's md breakpoint (`AssetDetailDialogFrame…lang.js:93-100`). Now that
  the panel is visible below 840 px, name and icon say "info" while the button hides the picture above it.
- **Fix.** Below 840 px an image icon and a name such as "Obrázok" (new key, owner's text), as the library does.

### Confirmed from the note's own list
- The manifest names 27 more deleted files (counted).
- `e2e/tests/settings/authorCleanPhrase.spec.ts:152` still has `test.fail()` for DAM-B4 while `3.0.0.md:224` lists
  its fix (read, not run).
