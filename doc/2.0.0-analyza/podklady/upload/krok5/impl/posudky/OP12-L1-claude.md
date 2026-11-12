# OP12-L1 review (Claude): finding 163, the held asset read anew (A1, A2, G)

Read-only review, 18 Oct, of `common-admin` `next` at f7fc44d1 with the step uncommitted (patch
`krok5-praca/zaplaty/OP12-L1.diff`). Paths are under `src/domains/dam/` unless they say otherwise; line numbers
are the working tree's. DDA = `imageWidget/composables/imageDialogDamAuthors.ts`, IWI = `ImageWidgetInner.vue`,
IMWI = `ImageMediaWidgetInner.vue`, IWMI = `ImageWidgetMultipleInner.vue`, IDDM = `ImageDetailDialogMetadata.vue`
(components under `imageWidget/components/`).

What I did: read the patch, DDA, IWI, IWMI, IDDM, `ImageWidgetMultipleItem.vue`, `useImageMassOperations.ts`,
`__tests__/support/fakeDam.ts` and the three new test files whole, IMWI in its edit/pick/confirm parts, and every
changed existing case. Verified from the logs, not re-run: snapshot 35 of 39 red, 4 green guards
(`krok5-praca/pracovne/impl-lib-op12/ohyb-stare.log`); bends 18/2/4/1/7/2 (`ohyb-*.log`), as the note says; full
check 340 files / 4,991 cases green (`krok5-praca/vysledky/OP12-L1-testy.log:977-984`), lints green
(`OP12-L1-linty.log:26`). The six new locale strings are identical to design 2.6 (compared by a script). I ran one
test file once, with an in-memory bend through the implementer's `vitest.bend.config.mts` (finding 2); nothing in
the tree was changed.

## Verdict

A1, A2 and G do what the brief says, with the guards, ordering and lock behaviour it asks for. I found no path that
still writes stale authors outside the read-to-write window the note names. Two Medium findings: the "a source the
image/row has stays" rule keeps a source the user could not see, which persists a wrong credit and contradicts the
new warnings and every other path of the library (1); an unchanged existing case now passes through A2's conflict
path only because the fake DAM aliases, proven by a bend (2). The rest is Low.

## Checked and correct (point 1)

- **A1 ordering.** `readHeldAnew` notes `of` at the press and chains after `detailAssetRead` (DDA:173-185). No new
  FE-54 read can start while A1 loads: IDDM shows only the spinner then, without "edit asset" (IDDM:219-224). The
  changed case `consumerProfileImageWidgetLibrary.test.ts:1915-1938` pins "FE-54 drops the held asset, A1 still
  names the source".
- **Guards after every await.** A1: `answerTakenFor` (IWI:350, IMWI:372) covers a closed dialog, another dialog's
  form in the store, and a widget that is gone. `takeHeldAnew` covers read-only and another file (DDA:194-195). A2:
  `confirmIsOver()` is checked in the catch and after the read (IWI:789,792; IMWI:952,955). G: `unmounted ||
  readonly` after both awaits (IWMI:613,620).
- **Second press.**
  - A1: the dialog is modal and Confirm is disabled while it loads (IDDM:352). A host's `metadataConfirm` meets
    `detail === null` (IWI:762).
  - A2: `metadataDialogSaving` (IWI:766-769).
  - G: the host's save button is loading (`admin-cms/src/domains/cms/gallery/composables/galleryActions.ts:154`).
- **Field lock.** A2's conflict and failure returns are inside the try. The `finally` gives the lock back only when
  no dialog of the widget is open (IWI:883-885, IMWI:1047-1049), so the lock stays while the dialog stays.
- **`saveImages` always resolves a boolean.** Every G exit returns `false`, and failures go to the existing catch
  (IWMI:695-699). `detailAssetRead` never rejects. One observation, no change: G answers `false` when the widget
  turns read-only during its read, while the same condition answers `true` at IWMI:568 and :641. The brief asked
  for `false`, and admin-cms passes no `readonly` to the gallery (`admin-cms/.../GalleryEdit.vue:107-115`).
- **`expandMetadata` and the host's `metadataConfirm`.** A2 runs through IDDM's `confirm` and has a case
  (`imageWidgetsAuthorsGivenBeforeTheWrite.test.ts:298-326`). On a conflict nothing is emitted, so admin-cms's
  `EmbedImageDialog.vue:127` (waits for `afterMetadataSaveSuccess`) stays open with the names.
- **Extractions.** `namesOf` (DDA:75-79) and `authorNamesOf` (IWMI:506-517) are equivalent to the FE-54 code they
  replace.

## Findings

### 1. Medium: the "a source it has stays" rule keeps a source the user could not see

Where: IWMI:626, DDA:205, IWI:795, IMWI:958.

**What the rule actually keeps.** A row that offers the pick does not draw its source
(`ImageWidgetMultipleItem.vue:110-145`), and neither does the dialog of a held image (IDDM:252-280). Such a source
was not typed in this session. It is one of:
- (a) the image's stored source: a row offers the pick whenever its asset has no authors at load, whatever the
  image's source is (IWMI:174-175);
- (b) the names "fill empty authors" wrote into every offering row (`useImageMassOperations.ts:60-64`);
- (c) the text "fill empty source" wrote (`useImageMassOperations.ts:27-28`, which does not check the pick).

**Every other path overwrites it:**
- FE-54 in the gallery (IWMI:540-543) and in the single widgets (DDA:105-107);
- the queue duplicate (IWMI:477-481);
- the successful save of a pick (IWMI:645-649);
- "fill empty" itself (`useImageMassOperations.ts:60-62`: "A row that does not offer the authors shows its
  source").

**Where the rule came from.** Design 2.2 justified keeping the source with "this matches the gallery's rule for
rows with a source, `IWMI:507`". In the snapshot, IWMI:507 reads "A row that has its source is left alone". That
sentence is about rows that do **not** offer the pick: the code skips them (`!image.showDamAuthors`, now :540) and
overwrites the source of the rows that do. The owner's decision 3 and the brief rest on that misreading.

**Scenario A**, pinned by `imageWidgetMultipleAuthorsGivenMeanwhile.test.ts:243-265`:
1. Rows 12 and 13 have no DAM authors. "Fill empty" picks author-7: both rows pick author-7 and get the hidden
   source "Name of author-7".
2. asset-12 is given author-3 elsewhere.
3. Save: the save stops, and the warning says "Their names are now the source of those images; the authors you
   picked there were not saved".
4. Row 12 now shows "Name of author-7" with `damAuthors` `['author-3']` (:258).
5. The editor saves again. Image 12 goes out crediting author-7, whom the DAM does not have for that asset and
   whose pick, as the warning says, was not saved.

**Scenario B**, pinned by the changed case `consumerProfileImageWidgetMultipleUpload.test.ts:1952-2006`:
1. The detail gives asset-12 author-9, and FE-54's read fails.
2. G stops the next save and leaves `source 12` (:1998-2002); the third save saves `source 12` (:2005).
3. When FE-54's read succeeds, the very same DAM state ends with "Name of author-9" (:1834-1850, :1843, :1849).

So the credit depends on which read noticed the authors.

**Fix.** Treat the source of a row or dialog that offers the pick as not the user's, and replace it with the DAM
names unconditionally at IWMI:626, DDA:205, IWI:795 and IMWI:958. This is bend g-2, which turns exactly the two G
cases red. Then:
- flip the expectations of `imageWidgetMultipleAuthorsGivenMeanwhile.test.ts:187-213` (second row) and
  `:243-265`, and of `consumerProfileImageWidgetMultipleUpload.test.ts:1998-2005` to "Name of author-9" (then equal
  to :1849);
- adjust the two changelog clauses "; a source the image has stays" and "(a source a row has stays, also the names
  "fill empty" … wrote there)".

The 2.6 texts are then true as written. The new source is visible before any save: the dialog stays open, and the
row now shows its source field. In the single widgets this almost never changes anything, because the picked image
of a held asset is built with an empty source (IWI:622, 666-689). This is an owner decision (point 3, new findings
1 and 2).

### 2. Medium: an unchanged existing case now passes through A2's conflict path, only because the fake DAM aliases

Where: `__tests__/damAuthorKeywordEndpoints.test.ts:325-352` (assertion at :346). It is not in the note's list of
changed cases.

**Cause.**
- `own()` answers the object the fake DAM holds (`fakeDam.ts:211-213`).
- `useApiRequest` hands `res.data` on as it is (`domains/api/composables/useApiRequest.ts:209`).
- `pickDamAuthors` writes into the held asset (DDA:69-72).

**What the case now does.**
1. The pick of `asset-without` makes the widget hold the fake DAM's own object (IWI:657, :689).
2. The pick of `author-2` is written into that object.
3. A2's GET answers the same object, now with `['author-2']`.
4. `namesOf` asks for `author-2`; the names rule of the file answers an empty list, so `givenMeanwhile` is `''`
   and not null.
5. Conflict path: none of the confirm's own names lookup (IWI:802-807, IMWI:965-970), no PATCH, no image, and a
   warning nobody asserts.

The case only counts the names lookups and their address (:346-350), and A2's lookup goes to the same address, so
the case stays green.

**Proof.** One run of that file with an in-memory bend that changes only `namesOf`'s address (DDA:77,
`'/bent-namesOf' + endPointAuthor`). Both widget rows fail at :346 with
`GET /bent-namesOf/own/v2/author/ext-system/1/search` as the second request; the 26 other cases pass. The second
lookup the case pins is therefore A2's, which the code makes only when its read finds authors.

**Effect.** The case no longer pins that "confirm" asks for names and writes under a named configuration (the 2.0.0
item "DAM author and keyword endpoints in the configuration"). It pins a path that never happens in production.

**Fix.** Add the copy rule to that describe's `beforeEach` (as at
`consumerProfileImageWidgetLibrary.test.ts:1108-1119`), and assert the PATCH
(`[{ id: 'asset-without', authors: ['author-2'], described: true }]`) and `shownAlerts()` empty. Better, fix
`own()` (point 3, new finding 3).

### 3. Low: both warnings vanish after 3 s

Where: IWI:796, IMWI:959, IWMI:629. `showWarningT` defaults to 3 s (`domains/system/composables/alerts.ts:16,57-60`).

Scenario: a gallery save stops on a conflict. The host says nothing (`galleryActions.ts:162-164`), and the 41-word
(en) / 29-word (sk) warning is gone after 3 s. Vuetify pauses the timer only while the alert is hovered
(`node_modules/vuetify/lib/components/VSnackbar/VSnackbar.js:159-166`). An editor who looked at the rows first sees
a save that "did nothing". Fix: point 3, new finding 6.

### 4. Low: once A1 or A2 drop the held asset, the names live only in the dialog's copy

Where: DDA:204-205, IWI:794-795, IMWI:957-958.

Scenario:
1. "Edit image": A1 finds author-3, and the dialog shows "Name of author-3".
2. The editor closes the dialog with X.
3. "Edit image" again: nothing is held, so nothing is read (DDA:175). The dialog shows an empty, required source,
   and the editor must type the names the DAM has.

The same happens after FE-54 (pinned at `consumerProfileImageWidgetLibrary.test.ts:2038-2060`), and option B would
cover it. The brief, the changelog and the note do not say it. Fix: no code change for 163; say it in the
changelog and the note ("closed without "Confirm", the names are not offered again").

### 5. Low: in the gallery the "moment" between read and write grows with the number of picked assets

Where: IWMI:611 (one GET per picked asset, an uncapped `Promise.all`) and IWMI:634-639 (one names lookup per asset,
one after another; this loop is old), all before the PATCH at :643.

Scenario: 40 rows filled by "fill empty" send 40 parallel GETs, then 40 sequential lookups (seconds) before the
bulk PATCH. An author given in those seconds is still overwritten. The changelog's "in the moment between them" and
the note's "medzi GET a PATCH" understate this.

Fix (optional): run the lookups in parallel, or the check right before :642. At least, the note should say that in
the gallery the window spans the names lookups.

### 6. Low: test gaps against PRAVIDLA rule 5

- **G.** The guard after the read (IWMI:613) is not pinned on its own. Both "gone / read-only" cases
  (`imageWidgetMultipleAuthorsGivenMeanwhile.test.ts:288-313`) give the asset authors, so the guard after the names
  (:620) stops them as well. Without :613, a widget that goes while the DAM still has no authors writes the pick
  and the images after it is gone (:643, :652). Add "gone during the read, DAM without authors: nothing written".
- **A2.** There is a case for a closed dialog (`imageWidgetsAuthorsGivenBeforeTheWrite.test.ts:376-402`), but none
  for a widget gone during the read. None pins the lock kept after a conflict either (the new files have no
  collaboration). Both rest on unchanged code (IWI:776, :883-885).
- **A1.** No case closes and reopens the dialog while the first read is still out. `answerTakenFor` handles it
  (IWI:309).

### 7. Low: inaccuracies in the note

- "N39L_OLD = DDA, IWI, IMWI, IWMI a tri locale": `ohyb-stare-applied.txt` lists only
  `src/locales/en/common/damImage.json` as served old.
- "Medze": "pripína to `:1987`" is the snapshot's numbering. In the tree the case is
  `consumerProfileImageWidgetLibrary.test.ts:2011`; the note's other line numbers are the tree's.
- `:1967` "(G číta tiež a zlyhá)": in the second row of that `it.each`, G's read succeeds and its names lookup
  fails.
- A1 "Pri chybe jedno „Neznáma chyba"": the error is whatever `showErrorsDefault` says (no access, time-out, …),
  and the unknown error only otherwise (DDA:197).
- "Zmenené existujúce prípady" lacks finding 2.

## Point 2: the tests

- **The 39 new cases** test what their names say and are red on the snapshot. The four that are green there are the
  guards of design 4.1/6 (`imageWidgetsHeldAssetReadAnew.test.ts:385-406`), as intended. The cases of the "closed /
  gone" kind are red on the snapshot only because no read happens there. What pins their guards are bends 4 (A2)
  and the `answerTakenFor` path; see finding 6 for the G guard.
- **The changed existing cases.**
  - `consumerProfileImageWidgetLibrary.test.ts:699` (copy rule): legitimate. Its assertions are unchanged.
  - `:1588`: legitimate. A2's GET is caught by the same `holdReadsOf` and answered.
  - `:1915`: legitimate. The reopened dialog loads, and the expectations are unchanged.
  - `:1942`: legitimate. What it pinned (a press in the reopened dialog waits for FE-54's read) can no longer
    happen on that path, because the dialog loads until FE-54 and A1 have answered. "Pressed again while it waits,
    it is taken once" stays pinned at `:1834-1860`.
  - `consumerProfileImageWidgetMultipleUpload.test.ts:1967`: reflects the code, but pins the rule of finding 1. It
    contradicts `:1849` and the warning text.
  - `imageWidgetsDamAuthorsSave.test.ts:72` and `damImageWidgetSites.test.ts:350` (copy rules): legitimate.
  - `consumerProfileImageWidgetMultipleUpload.test.ts:2010` (unchanged): correct. Row 12 stops offering the pick
    after FE-54, so G reads nothing and the held GET catches nothing.
  - The names-lookup holds at `consumerProfileImageWidgetLibrary.test.ts:2340` and `:2369` (design 4.2 asked for a
    re-check) still pin the confirm's own lookup: with no authors in the DAM, A2 answers `null` without a lookup
    (DDA:216).
- **The copy rule** is sound: it answers each read with a new object, as JSON over the network does. It is the same
  pattern as the existing generic rule at `consumerProfileImageWidgetLibrary.test.ts:1108-1119` and
  `imageWidgetsConfirmOfAnImage.test.ts:101-104`. Its weakness is that it is per file and per URL, and finding 2 is
  a case it missed.

## Point 3: recommendations on the implementer's new findings

1. **New finding 1 (texts versus the own-source rule).** Do not change the texts. Treat a source the row or dialog
   does not show (a row or dialog that offers the pick) as not the user's, and give it the DAM names: finding 1, fix
   as described. This needs the owner, because it reverses decision 3. The argument for the owner is that decision 3
   rests on design 2.2's reading of IWMI:507, which is the rule for rows that show their source. Changing only the
   texts would leave the wrong credit of scenario A, since the widget cannot tell a "fill empty" source from a
   stored one.
2. **New finding 2 (FE-54 overwrites, A1/A2/G keep).** Yes, they should agree, by A1/A2/G taking FE-54's rule. This
   is the same change as 1. Changing FE-54 instead would make a detail save leave "fill empty" names in place too.
3. **New finding 3 (fake DAM answers its own object).** Yes, `own()` should answer copies: `structuredClone` for
   `byFile`, for each item of `byIds`, for `one`, and for the `mainFile` of `finish`. `hold().release()` without an
   answer goes through `own()` as well (`fakeDam.ts:300`). Finding 2 shows the per-file rules are not enough. Make
   it a step of its own with a full run, since `createFakeDam` is used by 59 test files; the per-file copy rules can then
   go. Within OP12-L1, add the copy rule and the PATCH assertion to `damAuthorKeywordEndpoints.test.ts`.
4. **New finding 4 (read-only while A1 loads).** Accept. The same already happens to any open dialog of a widget
   that turns read-only: the dialog disappears through `v-if="!readonly"` (IWI:1217, IMWI:1426) while
   `metadataDialog` stays true and keeps the lock. `takeHeldAnew` applies nothing, and the confirm returns on
   read-only (IWI:761). An optional later step: close the dialog when the widget turns read-only.
5. **New finding 5 (names under different ext systems).** Accept, as FE-54 does. With today's data they are the
   same (161). Record it with 161: once 161 is fixed, the confirm's lookup (IWI:802-807, IMWI:965-970) and IWMI:637
   should name authors as `namesOf` / `authorNamesOf` do.
6. **New finding 6 (3 s for a long text).**
   - Every warning of the library uses the default 3 s; none passes a duration: `onlyOneFile` (IWI:470, IMWI:489,
     `domains/ui/file/components/AFileInput.vue:82`), `metadataJustLoaded`
     (`domains/dam/uploadQueue/components/UploadQueueDialog.vue:158`, the closest analogue: a save stopped, "Check
     them and save again", 14 words), `restrictiveGrantKept` (`APermissionEditor.vue:111`), `maxDeepExceed`,
     `nameUniqueError`, `kickedFromRoom`, `notificationsNotConnected`.
   - The messages of a save that did not happen stay until closed (`-1`): `showErrorsDefault`, `showUnknownError`,
     `showApiValidationError` (`alerts.ts:72,113,130`).
   - The new texts are 33 and 41 words in en, 2 to 3 times the longest default-duration warning. The gallery's is
     the only feedback of a save that stopped.
   - Recommend `showWarningT(key, -1)` at IWI:796, IMWI:959 and IWMI:629 (owner's call). `shownAlerts()` compares
     only colour and text, so no case changes; a case may pin the timeout.

New findings 4 and 5 need no change in this step.

## Point 4: changelog and note

- **Changelog** (`doc/changelog/2.0.0.md:189`). Every sentence matches the code as it stands. Notes:
  - The two clauses on the kept source change if finding 1 is taken.
  - "in the moment between them" understates the gallery's window (finding 5).
  - The single-widget warning is quoted while the gallery's is named only by its key.
  - Finding 4 is not said.
- **Note** (`impl/OP12-L1.md`). It matches the code and the logs (counts, bends, check results), apart from the
  points of finding 7.
