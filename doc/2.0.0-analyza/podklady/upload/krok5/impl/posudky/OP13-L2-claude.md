# OP13-L2: adversarial review (Claude)

Basis: patch `krok5-praca/zaplaty/OP13-L2.diff` (17 files, 2 113 lines). `diff -rq` of `snap/OP13-L2/src` against the
tree gives the same 16 source files; the 17th is the changelog. Read whole: IWMI (`ImageWidgetMultipleInner.vue`), DDA
(`imageDialogDamAuthors.ts`), `imageSaves.ts`, `waitLimit.ts`, `assetDetailStore.ts`, `AssetDetailSidebarMetadata.vue`,
IWI (`ImageWidgetInner.vue`), `ImageDetailDialogMetadata.vue`, `imageMediaWidgetStore.ts`, `imageStore.ts`. IMWI
(`ImageMediaWidgetInner.vue`) read at `:255-460`, `:590-700` and `:700-1120`. Also read: every new and changed test (in
the patch), the brief with its addendum, PRAVIDLA, the rows (`stare-nalezy.md:45,76,80,83,85,90,91,95`,
`stare-nalezy-3.md` A3) and the note. Logs read, not re-run: `l2-ohyb-pred-vsetky-2.log`, `l2-ohyb-b1..b17.log`,
`l2-ohyby.py`, `vysledky/OP13-L2-testy.log`, `OP13-L2-linty.log`. Pinia 4.1.0 and the Vue runtime read in
`node_modules`. Admins searched: admin-cms, admin-ugc, admin-blog, admin-forum, admin-inhouse, admin-dam. I ran nothing.

## Findings

### High

None.

### Medium

**M1. Older entries of the same 2.0.0 changelog now say the opposite of what the code does.**
- `doc/changelog/2.0.0.md:196` (A1, "Edit image" reads the held asset anew): "A read that fails is said once, and the
  dialog offers the authors as before." Since 4(b) the dialog shows the source field instead (DDA `:251-254`,
  `:81-85`).
- `:173` (FE-54, the read after the detail closes) has two such sentences:
  - "A read that fails is shown ... and the dialog stays as it was." It now turns to the source field (DDA `:140-146`).
  - "Nothing is written when the image dialog has been closed or shows another image by then (the authors of that
    asset are then offered no more, and the source is typed by hand)". Since 4(a) the widget keeps the asset. The next
    "Edit image" names an empty source (DDA `:135-139`, `:256-261`).
- `:193` (233, "Edit metadata"): "the dialog shows its loading ... till the save is over". It now waits at most the
  limit, then closes (IWI `:344-349`, IMWI `:364-369`).
- The new entries `:224-228` describe the change ("It offered the pick of the asset as read before", "It loaded until
  the editor closed it"). The document now states both behaviours as current. PRAVIDLA §5 has reviewers compare the
  sentences line by line. OP13-L1 amended superseded entries in place (its patch replaces three changelog lines). This
  step only appends.
- Fix: amend the three sentences, or fold the new entries into them. Say in the note that they were amended.

### Low

**L1. Point 3 is per asset only in the gallery. In one image widget, the read after a detail closes still waits for the
read, and the detail save, of the asset the widget held before. The changelog says otherwise.**
- DDA `:203-215` chains every read after `detailAssetRead`, whatever asset that read is for.
  - `savingOf(of.asset.id)` (`:206`) is right.
  - But the earlier read in the chain awaits `savingOf` of its own asset.
  - IWMI got per-asset chains (`:639-645`). DDA did not.
- Scenario in `AImageWidget` or `AImageMediaWidget`:
  1. Pick asset A without authors, "Edit asset", save in the detail (the PATCH is slow), close the detail. Read A
     waits for the PATCH.
  2. Close the image dialog, "Replace from DAM" with asset B without authors, "Edit asset", close.
  3. Read B starts only after A's PATCH, A's GET and A's names.
  4. Meanwhile "Confirm" spins. With a stuck PATCH it says "Request to API timed out." every 30 s.
  5. "Edit image" of B's image (`readHeldAnew`, DDA `:229`) waits on the same chain with no limit.
- Changelog `:222` says, also for `AImageWidget` and `AImageMediaWidget`: "not after a save of another asset". The note
  `:36` says the same.
- Rare: A's detail save must still be on its way when B's detail closes. Inferred from the code, not run.
- Fix, either of:
  - chain only reads of the same held asset, e.g. keep `{ of, read }` and use
    `pending?.of === of ? pending.read : Promise.resolve()`. `holdConfirmForDetailAssetRead` and `readHeldAnew` keep
    using the latest read;
  - or narrow the changelog sentence to the gallery and to separate widgets.

**L2. 4(b) with a confirm that waits: once the read fails, the press is taken again on a form that has turned from the
pick into the source field. With a source already there, the image is saved without the authors that were picked.**
- DDA `:186-194` calls `again()` for every answer except `WAIT_RAN_OUT`. That includes `null`, a failed read
  (`:140-146`, which has just set `staleIn`).
- `again()` runs the dialog's confirm again (IWI `:806-807`, IMWI `:969-970`).
  - `damAuthorsAsset` is now null (IWI `:822`), so no author is written.
  - The source is checked as required (`ImageDetailDialogMetadata.vue:84-86`).
- Empty source (the usual pick): a validation error next to the read's error, and nothing saved. That is acceptable.
- Non-empty source while the pick is offered. This happens for an image saved elsewhere with a source and taken via
  `imageSavedSince`, or after L3.
  - The image is saved and the dialog closes.
  - The authors the editor had picked when pressing are dropped. Only the read's error message is shown.
  - Before the step, `again()` went on with the pick and the A2 read before the write.
- Neither the note nor the changelog says what happens to a confirm whose read fails.
- Fix: treat `answer === null` as the limit is treated. Drop the press and do not call `again()`, so the editor
  confirms the form they see.

**L3. 4(b): a source typed while the pick is hidden is saved, and the widget keeps holding the asset. The next "Edit
image" offers the pick again and hides that source. A pick then replaces it.**
- The confirm in that state leaves `held` alone: `offerNoDamAuthors()` runs only in the authors branch (IWI `:868`,
  IMWI `:1031`).
- At the next "Edit image" the read succeeds, and the asset still has no authors.
  - `anew.of.asset = anew.asset` (DDA `:257`).
  - The dialog draws the author input in place of the source (`ImageDetailDialogMetadata.vue:252-280`).
  - A pick and "Confirm" set `texts.source` to the authors' names (IWI `:867`).
- The note (`:48-49`) says only "pri ďalšom otvorení výber znova". The changelog (`:225`) says "the next 'Edit image'
  reads the asset again". Neither says that the typed source is hidden and may be replaced.
- Before the step the editor could not type a source in that state.
- Fix, either of:
  - when a confirm saves the image of the held file while the pick is not offered, drop the held asset
    (`offerNoDamAuthors()`): the image has a source of its own;
  - or describe this in the note and the changelog.

**L4. 4(c): the one limit is the time of one DAM request, for a wait of up to four DAM requests in a row.**
- `waitLimit.ts:14-22` uses `coreDam.apiTimeout`: 30 s in admin-cms `src/main.ts:63` and admin-ugc `src/main.ts:72`.
- The wait (DDA `:186`, made of `:122-124`) runs these in a row:
  - the rest of the detail PATCH;
  - GET of the asset;
  - the licence lookup, when it is not cached;
  - GET of the authors.
- Each has its own 30 s axios timeout in admin-cms (`src/shared/apiClients/damClient.ts:13`).
- On a slow but working DAM (about 10 s a request), the press is dropped with "Request to API timed out." though no
  request timed out. The next press waits for the rest. No data is harmed.
- The 233 waits (one CMS save) use the same 30 s. That is above the CMS and blog clients' own 15 s (admin-cms
  `public/config.json.dist:25`, admin-ugc `:8`), so there the limit only catches a client without a timeout. That is
  its purpose.
- Fix, if wanted: for 4(c) a limit of a few request times (e.g. `3 × apiTimeout`), or start the clock once the detail
  save has answered. Otherwise leave it: the brief asked for one limit.

**L5. 233 makes the gallery's load longer. A pick or an upload applied during the load is lost, and the host's save says
"unknown error".**
- While IWMI waits for other widgets' saves (`:183`, up to the limit), `imagesLoading` stays on.
- "Upload" and "Add from DAM" (`:884-910`) and the dropzone (`:1001-1009`) stay drawn during the load.
- Rows added meanwhile are replaced:
  - `onAssetSelectConfirm` (`:434-451`) and `onAssetUploadConfirm` (`:549`) add rows to the store;
  - the load's `imageStore.setImages(...)` (`:209`) replaces them;
  - the pick is gone without a word, and an upload's queue has been stopped by then (`:551`).
- `saveImages` refuses with `showUnknownError()` (`:653-656`). admin-cms `galleryActions.ts:161-165` adds no message of
  its own.
- This existed already for the read itself (one or two requests). The step adds the wait, only when another widget is
  saving those images.
- Fix, either of:
  - let an add wait for the load: keep a `loaded` promise and await it in both handlers before `addImages`;
  - or keep the rows added meanwhile in `setImages`.

**L6. 233 in the gallery: a gallery taken away during its DAM authors' write still sends its image save, and that save
is noted only once it is sent. A copy whose read answers in between shows the old texts and later writes them back.**
- IWMI `:729-751` has no `unmounted` check between `await bulkUpdateAssetsAuthors(...)` and
  `noteImagesSave(... bulkUpdateImages ...)`. The single widgets stop at that point (`confirmIsOver`, IWI `:866`).
- Scenario: gallery B is drawn while A's authors PATCH runs.
  1. B holds the images (`:178`) and its read answers.
  2. `imageSavesOfOthersOver` finds no save on its way (`:158-162`), so B shows the texts it read.
  3. A sends its image save, and it lands.
  4. B's next save writes the old texts over it.
- The window is the remainder of one DAM PATCH. Inferred from the code, not run.
- Fix, either of:
  - note the gallery save for its ids from the start of `saveImages`: marks added before the first await, and settled
    when the bulk save settles or the save stops;
  - or stop before the image save once the gallery is gone, as the single widgets do.

**L7. The 233 changelog entries leave out two things the editor runs into.**
- While the `expandMetadata` form loads (`showReadInForm`, IWI `:380-404`, IMWI `:402-426`), the host's confirm takes
  nothing.
  - `onMetadataDialogConfirm` returns on an empty detail (IWI `:803`).
  - In admin-cms (`EmbedImageDialog.vue:78-82,118-128`), "Confirm" does nothing and says nothing, up to the limit.
  - The note says so (`:59-61`, "hostiteľovo potvrdenie nič neberie"). The changelog `:229` does not.
- After the limit, the form and the gallery keep the texts they read (IWI `:394-403`, IWMI `:164-168,185-190`).
  - A save that answers later is not taken.
  - The next confirm or save writes the read texts over it.
  - `:229-230` imply this ("after the wait ran out as well"), but do not say it.
- Fix: one clause each.

## The decisions

**2(b): the copy and the "as is" read run at the same time, the "as is" rows are added first, the queue dialog after.
Sound.**
- The copy request still goes out first: `copyToLicence` calls the client synchronously (`damImageApi.ts:269-291`).
- `assetSelectConfirmMap` cannot reject: it catches per licence (IWMI `:333-384`). So no rejection goes unhandled while
  the copy is awaited.
- The dialog opens once (`:478`), after `addImages` (`:477`), so the copies always come after the "as is" rows.
- Cost: the dialog opens when the slower of the two requests ends. Meanwhile nothing shows progress, as for an
  "as is" pick before the step.

**3: `saving` replaced by `setSaving(assetId, save)` and `savingOf(assetId)`. Sound and internal.**
- The store is in neither `src/lib.ts` nor `src/testing/index.ts`.
- No admin uses it (grep of admin-cms, admin-ugc, admin-blog, admin-forum, admin-inhouse). admin-dam has its own store,
  `damAssetDetailStore`.
- The store's path does not exist on `main`, so `saving` was never released.
- `setSaving` joins the saves of one asset (`Promise.all`), and the cleanup deletes only its own entry
  (`assetDetailStore.ts:96-107`).
- `savingOf` is a Pinia action: `node_modules/pinia/dist/pinia.js:1154-1160` wraps a returned promise anew on each
  call, as the note says. That is harmless where it is awaited.
- The gallery part is complete. The single widgets: L1.

**4(b): `staleIn` hides the pick for that opening. Sound for "never write authors over DAM's", with L2 and L3 as side
effects.**
- Keeping the asset rather than dropping it is argued correctly: a dropped asset would lose the naming of an empty
  source after a later read that succeeds.
- The identity check holds:
  - `detail` is a deep ref, so `detail.value` is the cached reactive proxy;
  - `staleIn` (a `shallowRef`) keeps that proxy;
  - the sync watcher resets it on every new detail and on a close (DDA `:162-169`).

**4(c): one limit, `withinWaitLimit`. Sound.**
- On expiry, `dropWaitingConfirm` stops the spinner, the message shows, and the press is not taken.
- A press after that waits again.
- An answer after the limit confirms nothing by itself, because the waiting confirm was dropped.
- The size of the limit: L4. "Edit image" on the same read has no limit (O1).

**6: `waitLimit.ts`, the DAM `apiTimeout` or 30 s, also for waits on CMS image saves. Acceptable.**
- It reads `coreDamOptions` directly (safe in tests that mock the options), takes `isNumber && > 0`, else 30, and clears
  its timer in `finally`.
- No CMS-side option exists in the library, so the DAM option is a stand-in. The admins' CMS clients end their
  requests at 15 s (L4).
- The copy's dialog closes on expiry, so no stale text can be confirmed.
  - The close sets `metadataDialog = false`. The lock goes back through the `anyWidgetDialogOpened` watcher (IWI
    `:1036-1047`).
  - At that point this equals `onMetadataDialogClose`: the detail, `loadingInDialog` and `cancelSaveWait` are already
    null.
- The form and the gallery show what they read after the limit. That is a fair trade (the form cannot be closed), but
  the changelog should say so (L7).

**233 for galleries: `noteImagesSave` and `holdImages`. Sound.**
- `holdImages` keeps `holdImage`'s semantics: release, drop of the note, the count of answered saves.
- `noteImagesSave` notes each id and swallows the rejection of each id. It returns the original promise, so a failure
  still reaches the gallery.
- `if (unmounted) return true` (IWMI `:753`) keeps a gallery that is gone out of the next gallery's store.
  - Its `emit` after unmount was already a no-op (`@vue/runtime-core/dist/runtime-core.cjs.js:4547-4548`).
  - So the host sees no difference.
- Gaps: L5 and L6.

**7 (finding 224) stopped. The reasoning holds; I agree to leave it.**
- The medium dialog can be opened only after X closes the image dialog.
- A confirm with nothing to await sends `createImage` at the press. A confirm with awaits stops on `confirmIsOver()` if
  X comes first (IMWI `:999,1019,1029`). So the create is out before the medium dialog exists.
- `tryMediaConfirm` already refuses while a save runs (IMWI `:947`).
- `MediaAware` has no slot for a CMS image id (`MediaAware.ts:3-7,16`).
- `callDeleteApiOnRemove` appears nowhere in admin-cms.
- Every switch from an image to a medium already leaves the image in CMS: `tryMediaConfirm` sets `imageModel = null`
  and deletes nothing (IMWI `:950-955`).

**8 (rest of FE-78): verified without a change. I agree.**
- The confirm ends after the authors' write without `offerNoDamAuthors()` (IWI `:866`, IMWI `:1029`).
- The next "Edit image" of that file reads the asset, finds the authors and drops it (DDA `:260-261`). A failed read
  offers nothing (4(b)).

**1, 2(a), 5, 9: sound.**
- 1 is a safeguard only: no production code changes a row's `damAuthors` in place. A search for
  `push`/`splice`/index writes on `damAuthors` finds nothing.
- 5 marks only rows with an asset (IWMI `:739-741`). Rows without one stay as before.

## Actions touched (check 2)

- **Gallery pick (2).**
  - Gone or read-only: `addingIsOver` after both waits.
  - Two picks at once: each adds its own rows.
  - A copy that fails: a message, the "as is" rows are still added, no dialog.
  - Messages after unmount: O2.
- **Gallery remove (9).** Synchronous. With `callDeleteApiOnRemove` the index comes from before the await, as the note
  says (outside).
- **Gallery save (5, 233).**
  - Gone by the answer: nothing is written into the store.
  - A failed image save after the authors' write: the rows show the source, and the next save saves (pinned by b11).
  - Gone during the authors' write: L6.
- **Gallery load (233).**
  - Unmounted: `cancelSaveWaits` lets the wait go, and `if (unmounted) return`.
  - Expiry: the rows read, with the message.
  - A failed save: the rows read.
  - During the wait: L5.
- **Detail close (3, gallery).** Per-asset chain. A failure is said. Gone or read-only: nothing is written.
- **"Edit metadata" (6).**
  - Closed, turned read-only or unmounted during the wait: `cancelSaveWait`, and `answerTakenFor` refuses.
  - Expiry: close, message, the lock back.
  - The limit and the answer at the same moment: whichever settles first wins. When the limit wins, the next opening
    takes the save through `imageSavedSince`. No stale write either way.
- **`expandMetadata` form (233).**
  - A newer opening or another image wins (`loadingInDialog`, `heldId() !== id`).
  - The spinner is always reset by whoever took `loadingInDialog` over.
  - After expiry: L7.
- **Confirm wait (4(c)).**
  - A second press is not taken.
  - A close or a new image drops the waiting confirm.
  - Expiry drops the press.
  - A failed read: L2.
- **Detail read (4(a), 4(b)).**
  - Dialog closed: the asset is kept.
  - Failure: `staleIn`.
  - Unmounted: nothing, and no message.
- No path leaves a lock or a spinner on, or opens a dialog twice.

## Public API and admins (check 3)

- No exported component, composable, store, prop, emit or `defineExpose` changes. `saveImages` and `metadataConfirm`
  are unchanged.
- `assetDetailStore.saving`: internal, never released, used by no admin (see 3).
- `coreDam.apiTimeout`:
  - admin-cms and admin-ugc hardcode 30 in `main.ts`, not their `envConfig.dam.apiTimeout`;
  - the upload already measures its chunks with it;
  - its use here is reasonable; see L4.

## Tests, bends, changelog, note (check 4)

- **New cases:** 32 (14 + 8 + 10), 5 180 against 5 148 after OP13-L1.
- **On the snapshot:** 40 red (`l2-ohyb-pred-vsetky-2.log:3608`), 27 new and 13 changed. The 5 guards the note names
  pass. The red reasons I read are the right ones:
  - `savingOf is not a function` for the 5 cases of point 3;
  - `['author-7']` offered instead of null (4(b));
  - `''` instead of the names (4(a));
  - `[13, 3]` (9);
  - a shared `['author-5']` (1);
  - `file-20` added (2(a));
  - the queue `'gallery'` before the read (2(b));
  - `showDamAuthors` true (5);
  - 0 reads (3);
  - rows shown at once, `[11, 12]` instead of `[21]`, and no long wait (233 gallery);
  - `[true, true, null]` (6).
- **Bends:** 17. Each breaks only its own fix (`l2-ohyby.py`), and each turns 1 to 6 cases red (`l2-ohyb-b*.log`).
- **Full check:**
  - tests 360 files / 5 180 cases green (started 21:08:16); linters green (started 21:03:52);
  - last source edits 20:30-20:34, the test support at 21:03:40, so both parts ran on the final code.
- **The 13 changed cases** each have a reason from the brief: 3 (×5), 4(b) (×6), 4(a) (×2).
  - The detail-save case traded `toBe(onItsWay)` for a request count and `toBeInstanceOf(Promise)`.
  - The Pinia wrapper forces that. The case still pins one request and a save that never rejects.
- **Changelog and note:** M1, L1, L3, L7. L2 is described nowhere. No new text: no locale file is in the patch, and the
  existing `error.apiTimedOut.message` (sk, en, cs) is used.

## Outside the step

- **O1. "Edit image" waits for a detail read with no limit** (DDA `:225-238`). A detail save that never answers keeps
  the dialog loading until the editor closes it, and every new "Edit image" of that image loads again. Old; 4(c) covered
  "Confirm" only.
- **O2. The gallery still speaks after it is gone.**
  - A failed copy (IWMI `:473`), failed "as is" reads (`:384`) and a failed save (`:803`) are still said once the
    widget is gone.
  - `addingIsOver` guards only the adding.
  - Cosmetic.
- **O3. The implementer's three outside notes are verified:**
  - `useImageMassOperations.ts:77` (`item.damAuthors = value`) is harmless today (see 1);
  - the index of `removeItem` (IWMI `:814-831`);
  - the host's `image` counted as read when given (IWI `:581-583`).

## Verified and inferred

- **Verified by reading:**
  - every statement above that carries a file:line;
  - Pinia's wrapping of actions and Vue's `emit` after unmount, in `node_modules`;
  - the admins' `apiTimeout`, their clients, their use of `expandMetadata` and `callDeleteApiOnRemove`, and that they
    do not use the store;
  - the counts, from the logs (not re-run).
- **Inferred, not run:**
  - the timing in L1, L4, L5 and L6;
  - how often DAM reads fail, which sets how often L2 and L3 happen;
  - whether editors act during the 233 wait (L5).
