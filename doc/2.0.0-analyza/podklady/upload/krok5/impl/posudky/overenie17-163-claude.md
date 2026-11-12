# Verification 17: finding 163 (accepted limit FE-53) and the "refetch before" the owner asks about

Read-only analysis of `common-admin` at `next` 38a725cf (working tree), 18. 10. Paths are relative to
`common-admin/src/domains/dam/` unless they start with a project name. `IWI` = `imageWidget/components/ImageWidgetInner.vue`,
`IMWI` = `imageWidget/components/ImageMediaWidgetInner.vue`, `IWMI` = `imageWidget/components/ImageWidgetMultipleInner.vue`,
`DDA` = `imageWidget/composables/imageDialogDamAuthors.ts`, `IDDM` = `imageWidget/components/ImageDetailDialogMetadata.vue`.
"Edit image" is the label of "upraviť metadáta" (`locales/en/common/damImage.json:12-14`, sk "Upraviť obrázok").
Marked *(inference)* where I reason past what the code shows. Nothing was run.

## 0. Verdict

163 still holds, **fully** for the write it describes, in both single-image widgets (IWI and IMWI), in admin-cms
only. Two parts of its wording need correcting. The window is not narrow: it lasts from the pick to the end of the
page. And it also holds for the **gallery** (IWMI), where the window is the whole editing session. No other
DAM-owned field is affected: the dialog writes nothing into the DAM except `authors` (and `described: true`). The
recommended fix has three parts. A1: read the held asset when "Edit image" opens. A2: check the asset right before
the authors are written. G: the same check in the gallery's save. Together about 7 to 10 h. One owner decision
concerns the gallery.

## 1. Does 163 hold today?

### 1.1 Single-image widget (`ImageWidgetInner`), step by step

| # | Step | Where |
|---|---|---|
| 1 | The widget keeps its own "held" asset, `{ asset, file }`, in memory, one per widget instance | `DDA:39` |
| 2 | A pick reads the asset once. When the asset has no authors, the ext system has authors on, and its metadata is settled, the widget holds the asset for the file of the picked image | `IWI:635`, `IWI:652-658`, `IWI:667` → `DDA:55-57` |
| 3 | A confirm with nothing picked writes nothing into the DAM and keeps the held asset. Only a confirm that wrote authors drops it | `IWI:757-785` (branch only for `authors.length > 0` at `:759`; `offerNoDamAuthors()` at `:783`) |
| 4 | The held asset is dropped or refreshed only by a new pick (`IWI:598`), an applied upload (`IWI:893`), a successful authors write (`IWI:783`), or the re-read after the dialog's own "Edit in DAM" detail closes (FE-54: `DDA:77-104`, triggered only by `DDA:145-157` via `IWI:1223`). Nothing else re-reads it. *(inference: the held asset can therefore stay as it was read for hours)* | as cited |
| 5 | "Edit image" puts a copy of the widget's image into the dialog and opens it. **It reads nothing from the DAM** | `IWI:315-341` (`:338` `setDetail`, `:340`) |
| 6 | The dialog offers the held asset's authors because the image's file is the held file | `DDA:47-53`; props `IWI:1181-1182` |
| 7 | The dialog then draws the authors pick and hides "Source", which is not required in that state | `IDDM:252-280`, `IDDM:84-86` |
| 8 | The editor picks authors; the pick is written into the held asset in memory | `DDA:64-67` |
| 9 | Confirm: names are looked up, then `updateAssetAuthors(…, authorsAsset)` sends `{ id, authors, described: true }` | `IWI:759-779`; `api/damAssetApi.ts:326-335` |
| 10 | The backend **replaces** the authors collection with what was sent | `core-dam-bundle/src/Domain/Asset/AssetMetadataBulkManager.php:55-66` (`colUpdate`), called from `:25-41` |

If the asset got authors elsewhere between steps 2 and 9, step 10 overwrites them. That covers admin-dam in another
tab, another editor, and the other widget of the page (each widget has its own held asset, `DDA:39`). There is no
optimistic locking: `FormProvidableMetadataBulkUpdateDto` and `AssetMetadataBulkFacade` have no version, ETag, or
`modifiedAt` check (grep found none).

Reach: admin-cms only. The pick is drawn only when the ext system has DAM authors on (`IWI:653-656`); admin-ugc has
none (`imageWidget/__tests__/imageWidgetsDamAuthorsSave.test.ts:39-40`).

### 1.2 Image and media widget (`ImageMediaWidgetInner`)

The path is the same, line for line:
- Pick: `IMWI:775` → `:793-799` → `:806`
- "Edit image" without a read: `IMWI:334-361` (`:358`, `:360`)
- Confirm: `IMWI:918-946`; the write is at `:935`

A medium the widget holds has no authors pick: `isMediaAware` takes the media branch at `IDDM:292-346`. **Holds
fully** for its image.

### 1.3 Gallery (`ImageWidgetMultipleInner`)

- **Load.** The gallery reads its assets when it loads. A row offers the pick when its asset has no authors:
  `IWMI:139-191`, `:174-175`. Unlike the single widgets, the gallery is current again after a page reload.
- **Pick.** Same rule: `IWMI:272-377`, `:371-373`.
- **Where picks come from.** The row's input writes the pick into the row (`ImageWidgetMultipleItem.vue:110-131`).
  "Fill empty" of the mass operations writes `damAuthors` into the rows (`composables/useImageMassOperations.ts:36-67`,
  `:62-64`).
- **Save.** For every asset with something picked in an offering row, the gallery sends
  `bulkUpdateAssetsAuthors`: `IWMI:582-607`, `api/damAssetApi.ts:345-352`. The backend replaces the authors in the
  same way.
- **Re-read.** The only re-read is after the row's own detail closes (`IWMI:511-555`).

Window: from the gallery's load or pick to the save of the gallery entity. admin-cms calls `saveImages()` from
`useGalleryEditActions.onUpdate` (`admin-cms/src/domains/cms/gallery/composables/galleryActions.ts:161-165`).
**Holds** whenever an offering row has a pick at save time. Rows with nothing picked write nothing (`IWMI:598`).

### 1.4 Other DAM-owned fields (description, source)

No other DAM field is overwritten:
- The single widgets write into the DAM only `id`, `authors`, `described` (`api/damAssetApi.ts:327-331`).
- The gallery writes only `id` and `authors` (`:345-352`, items built at `IWMI:599`).
- The backend leaves `customData` alone when the body omits it (`AssetMetadataBulkManager.php:120-127`), and the same
  goes for keywords (`:43-53`).

Description and source are texts of the **CMS image**. The pick copies them from the asset (`IWI:641-651`), and
confirm saves them through the image API only (`imageWidget/utils/damImage.ts:36-41`, `IWI:786-790`). The UI says so:
"If you overwrite the description here, it will not change in the image storage"
(`locales/en/common/damImage.json`, `image.help.texts.description`). Their drift from the DAM is by design and loses
nothing.

`described: true` sets the flag and removes suggestions (`AssetMetadataBulkManager.php:129-141`). Only the single
widgets send it, and only together with authors.

### 1.5 Corrections to the wording of 163

- **"narrow window":** not accurate. The held asset lives as long as the widget does (`DDA:39`). Nothing re-reads it
  on a timer or on "Edit image" (step 4 above). The window is narrow only in likelihood: someone must give that same
  asset authors while it is held, and the editor must then pick authors in the widget.
- **"after a page reload the widget shows the Source":** confirmed. After a reload nothing is held (only a pick sets
  it, `IWI:667`), so the dialog shows the image's own "Source", required (`IDDM:84-86`, `:272-280`). Side effect: an
  image confirmed without an author shows an empty required "Source" after a reload, even while its asset still has
  no authors. Option B in 2.5 addresses this; it is not part of 163.

### 1.6 Side observation (same code, not in 163)

Authors picked in a dialog that was then closed with X come back when "Edit image" reopens it.
- Cause: `pickDamAuthors` writes into the held asset (`DDA:64-67`), and `onMetadataDialogClose` does not reset it
  (`IWI:727-736`, `IMWI:867-876`).
- Path: image confirmed without an author → "Edit image" → pick "X" → close with X → "Edit image" again. The dialog
  shows "X" picked, and confirm writes it.
- *(inference: no test pins this; the nearest, `consumerProfileImageWidgetLibrary.test.ts:1721`, keeps picks within
  one opening only.)*

A1 removes it as a side effect.

## 2. Design of the refetch

The owner's question was "refetch before?". The answer is yes, at two moments, with one shared helper:

- **A1, when "Edit image" opens:** fixes what the dialog shows.
- **A2, right before the authors are written:** the only part that actually prevents the overwrite. It also covers
  the form drawn in the page (`expandMetadata`, embed dialogs), which has no "open" moment.

**A2 alone fixes the data loss. A1 alone does not.**

### 2.1 What is read, and through which configuration

- **The read.** The asset is read by its id with `fetchAsset(damClient, endPointAsset, id)`
  (`api/damAssetApi.ts:57-72`). The client and end points come from `useCommonAdminCoreDamOptions(configName)`, which
  the composable already resolves under the widget's named DAM configuration (`DDA:33`; PV14a/b,
  `register-zblizeni.md:197,223`). The id is the held asset's id; the held file is the image's file. This is the same
  read FE-54 already makes (`DDA:84`).
- **Author names.** They are looked up under the ext system of the asset's licence, falling back to the page's:
  `getExtSystemByLicence(asset.licence) ?? cachedExtSystemId` (`DDA:87-89`). Extract these lines into a small
  `namesOf(asset, pageExtSystem)` and reuse it in all three places.
- **Licence.** None is needed: `/asset/:id` does not take one, unlike `fetchAssetListByIds` (`api/damAssetApi.ts:134-174`).

### 2.2 A1: read when "Edit image" opens (IWI, IMWI)

**When.** In `actionEditMeta` (`IWI:315-341`, `IMWI:334-361`), after the existing wait for another widget's save
(`:319-332`) and before `setDetail`. The read runs only when the widget holds an asset for the shown image's file
(`held.file === resImage.dam.damId`), and not when it is read-only. Every other image opens instantly, as today.

**While it reads.** The dialog reuses the existing "edit" loading state: a new `loadingInDialog = Symbol('edit')`,
`setDetail(null)`, `metadataDialogLoading = true`, `metadataDialog = true`, exactly as `IWI:322-331` does. So:
- The title stays "Edit image" (`IWI:1189`, `IDDM:80-82`).
- A spinner shows (`IDDM:219-224`) and "Confirm" is disabled (`IDDM:352`).
- A host's `metadataConfirm` does nothing, because `detail` is null (`IWI:740`).
- All existing concurrency rules apply unchanged: a dialog closed during the read (`IWI:727-736`), another dialog
  opened meanwhile (`answerTakenFor`, `IWI:301-308`), the widget gone (`disposed`), and the confirm's
  `dialogOfAnotherPick` test (`IWI:806-809`, which already counts a loading dialog).

**Ordering.** The read is chained after any FE-54 re-read still in flight (`detailAssetRead`, `DDA:107,150-153`), so
the newer answer wins. It captures the held asset at the click: the FE-54 read may drop it meanwhile, and the
reopened dialog should still get its names. This is what `consumerProfileImageWidgetLibrary.test.ts:1903-1922`
expects today.

**Applying the answer.** Only once `answerTakenFor` accepts it, and only into the dialog's copy (`setDetail` clones,
`imageWidget/store/imageMediaWidgetStore.ts:40-43`). Nothing is written to the widget's image without a confirm.
- **The asset still has no authors:** the held asset becomes the fresh one, so the pick starts from what the DAM has.
  The stale-pick issue in 1.6 goes away.
- **The asset has authors now:** the held asset is dropped, so the pick goes and "Source" shows and is required. If
  the image's source is empty, it gets the authors' names. A source the image already has is the user's text and
  stays; this matches the gallery's rule for rows with a source, `IWMI:507`.
- **Applied only to the image of the held file:** guard on `detail.dam.damId === file`.

**On failure.** The read's error is shown once (`showErrorsDefault`, as `DDA:101-103`). The dialog opens with what
the widget holds, the pick as before. No block: A2 guards the write.

**The confirm itself.** Nothing changes in `IWI:738-848` for A1.

### 2.3 A2: check right before the authors are written (IWI, IMWI)

**Where.** In `onMetadataDialogConfirm` (`IWI:757-760`) and `tryImageConfirm` (`IMWI:918-921`), first thing inside
`authorsAsset.authors.length > 0`. It runs before the picked authors' names are fetched, so no lookup is wasted.

**What.** One helper in the composable, `authorsGivenMeanwhile(asset): Promise<string | null>`. It re-reads the asset
by id and returns the names of its authors, or `null` while it has none.
- **Read fails:** show the error once (`if (!showErrorsDefault(e)) showUnknownError()`, as `IWMI:537`) and save no
  image. The dialog stays, with the pick and "Confirm" free, like a refused write today (`IWI:776-778`).
- **The DAM has authors now:** write nothing. Drop the pick (`offerNoDamAuthors()`). Give an empty source the names.
  Show a warning (new text, 2.6) and return. The dialog stays open with "Source" filled and required. The
  description the editor typed stays: it is the same object, `pressedOn`, so nothing typed is lost. The next confirm
  saves the image, and no DAM write happens because nothing is offered any more.
- **The DAM still has none:** go on exactly as today.

**Concurrency.** `confirmIsOver()` is checked after the await, as at `IWI:771,781`. The lock of the field is kept
while the dialog stays open: the `finally` releases it only when no dialog is open (`IWI:844-846`).

**Not atomic.** The window shrinks to the milliseconds between the GET and the PATCH. A real compare-and-set needs the
backend, for example an expected-authors or `If-Match` field on `metadata-bulk-update`. That is out of scope; noted
in section 5.

### 2.4 G: the gallery's save (IWMI)

**Where.** In `saveImages`, after `offering` is built (`IWMI:582-595`) and before any names lookup or
`bulkUpdateAssetsAuthors` (`:596-607`).

**What.**
- Re-read with `fetchAsset` each asset that has something picked in an offering row, with `Promise.all`. There are
  usually few. Reading by id avoids the licence grouping and the silent omission by licence that `fetchAssetListByIds`
  has (`IWMI:269-270`).
- After the await: `if (unmounted || props.readonly)` return, as at `IWMI:520,604`.
- **Any of them has authors now:** the rows of those assets that offer the pick take them, named. This is the
  existing body of `takeAuthorsOfDetailAsset`, `IWMI:517-535`, extracted as `rowsTakeAuthorsOf(asset, pageExtSystem)`.
  Then show a warning, write **nothing** (no authors, no images), and return `false`. All or nothing: other assets'
  picks wait for the next save.
- **A read fails:** the existing `catch` (`IWMI:658-662`) says it, and the save returns `false`.

**Host.** admin-cms's gallery already handles `false` without an alert of its own (`galleryActions.ts:161-165`). The
gallery entity is not saved; the editor sees the rows with their new sources and saves again.

**Mass operations.** Nothing special: "fill empty" only fills `damAuthors` of rows (`useImageMassOperations.ts:62-64`),
and the check sees them as picks.

### 2.5 Option B (not needed for 163): read on "Edit image" also when nothing is held

The single widget would ask the DAM whenever the image's source is empty, not only when it holds an asset. Read by
file id (`fetchAssetByFileId`, `api/damAssetApi.ts:86-96`). Offer the pick when the asset has no authors (same
conditions as `IWI:652-656`); fill the names when it has some. This removes the "after reload: required empty Source"
inconsistency in 1.5 and brings the widget in line with the gallery at load (`IWMI:174-175`).

Extra work it needs:
- At confirm, take the names under the asset's licence instead of `assetSelectStore.requireSelectedSelectConfig()`
  (`IWI:766`, `IMWI:927`). That function throws when the picker was never opened (`assetSelect/store/assetSelectStore.ts:258-263`),
  which is the case after a reload (finding 161's direction).
- Set `cachedExtSystemId` from the asset's licence, as `onEditAsset` does (`IWI:713-719`). Otherwise the authors input
  has no ext system after a reload (see test `consumerProfileImageWidgetLibrary.test.ts:1556-1565`).

About +3 to 4 h. It is a product change.

### 2.6 What the user sees

- **"Edit image"** of an image whose asset this widget picked without authors and still holds: a short spinner in the
  dialog (one GET, plus a names lookup when the asset has authors), then either the authors pick reset to what the
  DAM has, or "Source" with the authors' names. Every other "Edit image" behaves as today.
- **"Confirm" with authors picked:** one extra GET. If the DAM has authors by then, the new warning shows and the
  dialog stays.
- **Gallery save with picks:** one GET per asset that has a pick. If the DAM has authors by then, the new warning
  shows, nothing is saved, and the rows show the names as their source.

New texts (proposed keys under `common.damImage.image.meta`, in `locales/{sk,en,cs}/common/damImage.json`):

| Key | sk | en | cs |
|---|---|---|---|
| `authorsGivenMeanwhile` | Asset medzitým dostal autorov v DAM. Ich mená sú teraz zdrojom obrázka; vybraní autori sa neuložili. Skontrolujte a potvrďte znova. | The asset has been given authors in the Media Library in the meantime. Their names are now the source of the image; the authors you picked were not saved. Check and confirm again. | Asset mezitím dostal autory v DAM. Jejich jména jsou nyní zdrojem obrázku; vybraní autoři se neuložili. Zkontrolujte a potvrďte znovu. |
| `galleryAuthorsGivenMeanwhile` | Assety niektorých obrázkov medzitým dostali autorov v DAM. Ich mená sú teraz zdrojom týchto obrázkov; autori vybraní pri nich sa neuložili a nič sa neuložilo. Skontrolujte a uložte znova. | The assets of some images have been given authors in the Media Library in the meantime. Their names are now the source of those images; the authors you picked there were not saved, and nothing was saved. Check and save again. | Assety některých obrázků mezitím dostaly autory v DAM. Jejich jména jsou nyní zdrojem těchto obrázků; autoři vybraní u nich se neuložili a nic se neuložilo. Zkontrolujte a uložte znovu. |

Shown as warnings (`showWarningT`; IWI already destructures it, `IWI:229`). Read failures reuse the existing generic
alerts; no new text.

## 3. Implementation steps

1. **`DDA`**
   - Extract `namesOf(asset, pageExtSystem)` from `:85-90`.
   - Add `readHeldAnew(file)`: returns `null` unless the widget holds an asset for `file` and is not read-only.
     Otherwise it returns a promise, chained after `detailAssetRead`, that resolves to
     `{ of, asset, names } | { of, failed }` and shows its own error once.
   - Add `takeHeldAnew(anew, image)`: guards for unmounted, read-only and a different file; then sets the held asset
     to the fresh one, or drops it and fills an empty source.
   - Add `authorsGivenMeanwhile(asset)`, which throws on a failed read.
   - Export all three.
2. **`IWI`**
   - `actionEditMeta` (`:315-341`): the loading section around `readHeldAnew` (reuse the `:322-331` pattern), then
     `setDetail`, then `takeHeldAnew(anew, detail.value)`, then `ownImageInDialog = detail.value`.
   - `onMetadataDialogConfirm`: A2 inside `:759`.
   - Add `showUnknownError` to `useAlerts` (`:229`).
3. **`IMWI`**: the same, at `:334-361` and `:920`. Only for an image; `heldId` already distinguishes the two at
   `:336`.
4. **`IWMI`**
   - Extract `rowsTakeAuthorsOf` from `:517-535` and use it in `takeAuthorsOfDetailAsset`.
   - Add the check between `:595` and `:596`.
   - Import `useAlerts().showWarningT` (`:107`).
5. **Locales**: two keys, three languages (2.6).
6. **Tests**: section 4.
7. **CHANGELOG** of the library: "Edit image" re-reads the asset whose authors it offers; "Confirm" and the gallery's
   save no longer replace authors the asset was given elsewhere; two new warnings.
8. **Register**: remove the "widget sa nedozvie o autoroch, ktorých asset dostal inde" part of the FE-53 accepted
   limit (`register-zblizeni.md:384-386`), and record 163 as fixed.

## 4. Tests

### 4.1 New tests that fail on today's code

All in `imageWidget/__tests__/consumerProfileImageWidgetLibrary.test.ts`, block "the authors of the DAM in the dialog
of an image", for both widgets (`describe.each` at `:1226-1229`). They reuse the helpers `pickedWithoutAuthors`,
`editImage`, `offered`, `texts`, `readsOf`, `holdReadsOf`, `authorsWritten`, `imagesWritten`, `confirmImage`. The
asset is given authors "elsewhere" with `dam.assets.get('asset-9')!.authors = ['author-3']`.

**A1, "Edit image" after the asset was given authors elsewhere:**
1. Pick asset-9 and confirm without an author. The DAM then gets `author-3`. "Edit image" should show:
   - `offered(widget) === null`
   - `texts() == ['of asset-9', 'Name of author-3']`
   - `readsOf('asset-9')` length 2

   Confirm should then give `authorsWritten() == []` and the image updated with source `Name of author-3`.
   *Fails today: the pick `[]` is offered.*
2. The dialog of a held image is closed with X after picking `author-5`. "Edit image" again shows
   `offered(widget) == []`, and confirm writes nothing into the DAM. *Fails today: `['author-5']` is shown and written.*
3. **Read held:** the dialog shows only its spinner, "Confirm" is disabled, and `authorsWritten()` is empty. On
   release, the form is as in test 1.
4. **Read fails (500):** one `unknownError`; the pick is offered as before. *Fails today: there is no alert.*
5. **Closed while reading; widget unmounted while reading:** nothing applied, nothing said, the held asset unchanged.
   Reopening reads again. Passes or fails today depending on how it is written; it is a regression guard.
6. **Images that are not read:** an image with its own source after a reload, or of another file than the held one.
   `readsOf` is unchanged. Passes today; it is a guard.

**A2, the check before the write:**

7. "Edit image" (A1 finds no authors), pick `author-5`, then the DAM gets `author-3`, then confirm. Expect:
   - no PATCH and no image saved
   - the warning `authorsGivenMeanwhile`
   - the dialog open, `offered === null`, `texts == ['of asset-9', 'Name of author-3']`

   The next confirm saves the image with that source and still sends no PATCH. *Fails today: PATCH `['author-5']`.*
8. The same with `expandMetadata` and the host's `metadataConfirm` (pattern at `:1532-1554`). *Fails today.*
9. The check read fails: one error, no PATCH, no image, "Confirm" free. Once the DAM answers again, the next confirm
   writes `author-5`. *Fails today: the PATCH is sent.*

**G, in `imageWidget/__tests__/consumerProfileImageWidgetMultipleUpload.test.ts`, block "the save of the widget"
(`:1070`):**

10. A row of an asset without authors, `author-5` picked in it, then the DAM gets `author-3`. `saveImages()` should:
    - return `false`
    - send no bulk PATCH and no `bulkUpdateImages`
    - leave the row with `showDamAuthors === false` and source `Name of author-3`
    - show the warning

    The second `saveImages()` returns `true`, saves the images, and sends no PATCH. *Fails today.*
11. Two assets, one given authors elsewhere: nothing is written at the first save. The second save writes the other
    asset's pick. *Fails today.*
12. "Fill empty" authors through the mass operations, then a conflict on one asset: as test 10. *Fails today.*

### 4.2 Existing tests to adjust

- `consumerProfileImageWidgetLibrary.test.ts:1882-1939` (`confirmWaitedAndDialogOpenedAgain` and the two tests on
  it). The reopened dialog now loads until the chained reads answer, so "Confirm" cannot be pressed while it loads.
  Test 1924 must be rewritten: the confirm is pressed after the load. The expectations of 1903 (`texts`, a single
  image save) should still hold *(inference)*.
- **Any test that holds `asset-9` reads and later confirms with picks.** `fakeDam.hold` keeps holding every later
  matching request (`__tests__/support/fakeDam.ts:290-317`), so a new A1 or A2 read would wait for good. I checked
  `:1822`, `:1987`, `:2085`, `:2149`, `:2168`: they do not hang by my reading. `:2283-2340` (names lookup held during
  the confirm) needs a re-check, because A2 now comes before that lookup.
- **Gallery tests in "the save of the widget"** (`consumerProfileImageWidgetMultipleUpload.test.ts:1146-1640`). The
  new GET by id must find the asset in `dam.assets`; otherwise the fake DAM answers 404 (`fakeDam.ts:211`) and the
  save fails. Rows built from assets that exist only in list answers need their asset in the map. Tests that assert
  exact request sequences gain one GET per asset with a pick.

## 5. Risks

- **Latency.** One GET, plus a names lookup when the asset has authors, before "Edit image" shows the form of a held
  image. That is a spinner of roughly 100 to 300 ms *(inference)*. A2 adds one GET to a confirm with picks; G adds
  one per asset with a pick.
- **Hanging tests** (4.2). The fake DAM's `hold` never stops holding.
- **Ordering with FE-54.** A1 chains after the FE-54 read and captures its held asset at the click. The FE-54 rules
  (`DDA:106-157`) are unchanged. *(inference: no new state is shared, only the chain.)*
- **Not atomic.** A2 and G compare and then write with no version on the backend. A real compare-and-set would be a
  BE item, an optional `expectedAuthors` on `metadata-bulk-update`; not proposed now.
- **Names under different ext systems.** A1, A2 and G name authors under the licence's ext system (as FE-54). The
  confirm's existing lookup uses the picker's (finding 161). With today's data they are the same (161 notes: SME 1,
  Denník Šport 13), so nothing new diverges.
- **Gallery saves can stop.** A conflict now stops a gallery save once. The host shows only the widget's warning
  (`galleryActions.ts:161-165`). Acceptable, but visible.
- **Out of scope:** authors *removed* elsewhere from an asset whose image already carries their names. The image's
  source is a CMS snapshot by design (1.4).

## 6. Size

| Part | Hours |
|---|---|
| A1 (composable, two widgets, tests 1-6 for both widgets, adjusting 1882-1939) | 3-4 |
| A2 (composable helper, two widgets, three locale keys, tests 7-9) | 2-3 |
| G (gallery check, extracted helper, locale key, tests 10-12, adjusting gallery tests) | 2-3 |
| **Total A1 + A2 + G** | **7-10 (M, one OP step)** |
| Option B, if wanted | +3-4 |

Review cycles (Codex plus Opus) are not included.

## 7. Decisions for the owner

1. **A1 + A2** for both single-image widgets. Recommended: yes. Read when "Edit image" opens, and check right before
   the write. A2 is the part that prevents the overwrite.
2. **Gallery (G):** on a conflict, the save stops, the rows take the DAM's authors as their source, and a warning
   shows. Recommended. Alternatives: the save goes on with the DAM's authors and a warning, or the gallery stays an
   accepted limit, with its window being the whole editing session.
3. **A source the image already has** is kept when the asset turns out to have authors. Recommended: keep it; only an
   empty source gets the names.
4. **Option B** (also read for images with an empty source after a page reload, and offer the pick again).
   Recommended: separately, not as part of 163. It is a product change and needs the 161-style names lookup.
