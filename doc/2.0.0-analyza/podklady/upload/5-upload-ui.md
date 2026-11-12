# 5 - Upload queue UI: components, composables, texts, styles (LIB vs DAM)

Read-only analysis. Nothing was changed in either repository, nothing was built or run.
Both repositories are on branch `next` (DAM head `ba8a66ec`, LIB head `49bd815b`).

Path prefixes used below:

| Prefix | Meaning |
|---|---|
| `L/` | `/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/` |
| `LIB/` | `/home/volar/projects/anzusystems/common-admin/` |
| `D/` | `/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/` |
| `DAM/` | `/home/volar/projects/anzusystems/admin-dam/` |

Short names for the two rows: **UQIE** = `L/components/UploadQueueItemEditable.vue`, **AQIE** = `D/queue/AssetQueueItemEditable.vue`.

"inferred" marks a conclusion drawn from code that was read but whose runtime effect was not observed (no browser was used).

---

# PART I - FACTS

## A. Map of both UIs

### A.1 LIB (image only; the queue lives in a full-screen dialog owned by a widget)

Only images are ever queued: `LIB/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:126` (`// only image now`).

```
Entry points (hosts)
├─ ImageWidgetMultipleInner            LIB/src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue
│   ├─ button "Nahrať obrázok" (AFileInput multiple)                     :583-598
│   ├─ AFileDropzone variant=fill (hover-only once images exist)          :696-704
│   ├─ copy-to-licence result                                             :215-235
│   ├─ ImageWidgetMultipleLimitDialog (hard limit 50, "add first N")      :724-727, LIB/.../ImageWidgetMultipleLimitDialog.vue:22,76-83
│   └─ <UploadQueueDialog>                                                :706-717
├─ AAssetListInner (asset select list)  LIB/src/domains/dam/assetSelect/components/AAssetListInner.vue
│   ├─ slot `upload-activator`, default button "Nahrať" (AFileInput)      :252-272
│   └─ <UploadQueueDialog>  (no limit check: addByFiles directly :205-211) :425-435
└─ ImageWidgetInner / ImageMediaWidgetInner (single image)
    ├─ AFileDropzone (drop, with collab field lock)                       ImageWidgetInner.vue:294-325, 877-886
    ├─ AFileInputDialog                                                   ImageWidgetInner.vue:760-776, 818-837
    ├─ copy-to-licence result                                             ImageWidgetInner.vue:327-342
    └─ <UploadQueueDialogSingle>                                          ImageWidgetInner.vue:937-946, ImageMediaWidgetInner.vue:1111-1119

UploadQueueDialog  (L/components/UploadQueueDialog.vue)      full-screen VDialog, one queue (queueKey)
├─ toolbar: title "Nahrávanie" / "Nahrávanie ukončené", spinner + "Nahrávanie n/N",
│           [Uložiť a použiť | Použiť], save icon, "+" add, mass-operations toggle, close/stop   :177-308
├─ UploadQueueEditable                                       scroll list + sliding sidebar          :309-315
│   ├─ UploadQueueItemEditable (xN)                          the row/card
│   │   ├─ AssetImage (progress / waiting / processing / done animation)
│   │   ├─ error overlay (message | AssetFileFailReasonChip | unknown error)
│   │   ├─ buttons: "Upraviť v DAM", copy id, refresh, cancel, remove-from-queue
│   │   ├─ title line, duplicate notice line
│   │   └─ VForm: AssetCustomMetadataForm + keywords + authors + single-use switch
│   └─ AssetQueueSelectedSidebar                              mass operations (general + Image panel)
│       └─ AssetCustomMetadataFormMassOperations
├─ UploadQueueButtonStop                                      close; confirm while uploading
└─ AFileDropzone (fill, transparent, hover-only)              :317-324  (its `drop` event is not handled by any host, see B.6 D10)

UploadQueueDialogSingle (L/components/UploadQueueDialogSingle.vue)   LIB only
├─ toolbar: title, info-sidebar toggle, UploadQueueButtonStop                                     :333-388
├─ left: AssetImage with progress + error overlay; after upload the ROI selector                  :390-456
└─ UploadQueueDialogSingleSidebar                                                                 :457-493
    ├─ tabs "Info" / "Fókus" (ROI tab only after the upload is done)      ...SingleSidebar.vue:93-112
    ├─ slot prepend-sidebar: duplicate notice, "Jednorazová licencia" notice   ...DialogSingle.vue:478-491
    ├─ UploadQueueDialogSingleSidebarMetadata -> teleported actions [Obnoviť] [Uložiť] [Uložiť a použiť]   ...SidebarMetadata.vue:70-100
    │   └─ ...MetadataContent: panel "Metaúdaje" (form + keywords + authors + switch), panel "Info o súbore"
    └─ AssetDetailSidebarROI
```

LIB state holders that are module-level singletons: `uploadQueueDialog` (which queue's dialog is open) and `uploadQueueSidebar` (mass operations open, default `false`), `L/composables/useUploadQueueDialog.ts:4-5`.

### A.2 DAM (all asset types; three fixed queues; the queue lives in the app shell)

Queue ids: `global`, `slots`, `edit` - `DAM/src/domains/coreDam/shared/services/upload/uploadQueueIds.ts:1-3`.

```
Entry points  (AssetUpload.vue wraps FileUpload.vue; ACL-gated by `canUpload`  D/AssetUpload.vue:117-132,139)
├─ full-window dropzone, shown only while files are dragged over the window
│     DAM/src/domains/system/components/MainWrapper.vue:171 ; FileUpload.vue:337-347 ; folders are traversed (FileUpload.vue:145-172)
├─ toolbar button "upload" (pill, mdi-upload)      D/list/AssetListView.vue:149-152, ExternalProviderAssetListView.vue:142-145
├─ "+" icon inside the full view                   D/footer/AssetFooterUploadOverlayFull.vue:195-198  (+ a second full-window dropzone :252)
├─ "+" in an empty slot of the asset detail        D/detail/components/slots/AssetSlotListItem.vue:197-207   (queue `slots`)
├─ import from an external provider                externalProviderAssetImport.ts:35-37, 72  (queue `global`)
└─ selecting tiles in a list                       queue `edit` (mass edit / external-provider selection)
   + over-limit dialog ("add first N", limit from beta features)   D/AssetUpload.vue:53-58, 149-187

App shell (MainWrapper.vue, used only by AssetListView and ExternalProviderAssetListView)
├─ bottom VAppBar                                                                 MainWrapper.vue:144-163
│   ├─ AssetFooterUploadSlotsOverlay   small floating panel, queue `slots`: title, n/N, hide/show, stop, "Vyčistiť"
│   │    └─ AssetQueueUploadList -> AssetQueueItemList (one-line row)
│   ├─ AssetFooterUploadOverlay        small floating panel, queue `global`: title, n/N, hide/show, "Pridať popis" (-> full)
│   │    └─ AssetQueueUploadList -> AssetQueueItemList
│   └─ slot custom-footer
│        ├─ AssetFooterSelected                    strip "Vybrané súbory: N", [Upraviť] clear, hide/show   (queue `edit`)
│        │    └─ AssetQueueSelectedSimple -> AssetQueueSelectedItemSimple (thumbnail tiles)
│        └─ ExternalProviderAssetFooterSelected    same strip with [Nahrať do ADAM (N)] [Viac detailov]
└─ full-screen VDialog (customDialog)                                             MainWrapper.vue:134-143
     ├─ AssetFooterUploadOverlayFull   queue `global`                              D/list/AssetListView.vue:207
     │    ├─ toolbar: title, spinner + n/N, [Uložiť a ukončiť], save icon, "+", mass-operations toggle, minimise, close/stop
     │    └─ AssetQueueEditable -> AssetQueueItemEditable (xN) + AssetQueueSelectedSidebar
     ├─ AssetFooterSelectedFull        queue `edit` (mass edit of existing assets) D/list/AssetListView.vue:206
     │    └─ AssetQueueEditable (disable-done-animation) -> same row + same sidebar
     └─ ExternalProviderAssetFooterSelectedFull -> ExternalProviderAssetQueueReadonly -> ExternalProviderAssetQueueItemReadonly

Asset detail, slots tab: AssetSlotListItem renders AssetQueueItemList inline for the slot being uploaded   AssetSlotListItem.vue:141-156
```

View state per panel (`hidden | minimal | compact | full`): `DAM/src/domains/coreDam/asset/composables/assetFooterUpload.ts:6-11`, `assetFooterUploadSlots.ts:5-9` (no `full`), `assetFooterSelected.ts` (heights 32/160 px, `:6-9`), `externalProviderAssetFooterSelected.ts`. Going `full` sets `customDialog = true` and disables the list's keyboard navigation (`assetFooterUpload.ts:53-57`).

### A.3 What exists on one side only

| LIB only | Where |
|---|---|
| Single-file dialog with ROI/focus tab, file info panel, teleported actions | `L/components/UploadQueueDialogSingle*.vue` |
| "Save **and apply**" - hands the uploaded images back to the widget | `L/components/UploadQueueDialog.vue:114-147` |
| Copy-to-licence items entering the queue | `ImageWidgetMultipleInner.vue:215-235` |
| Keyboard scrolling of the list (arrows, PgUp/PgDn, Home/End on `document`) | `L/components/UploadQueueEditable.vue:57-109` |
| Remove-from-queue button (no API call) | UQIE:330-336 |
| Per-queue dialog keyed by `queueKey`, several queues side by side | `useUploadQueueDialog.ts`, `UploadQueueDialog.vue:27` |
| `configName` (several DAM configurations), `mainFileSingleUseEnabled` option | `UploadQueueEditable.vue:19,33` |

| DAM only | Where |
|---|---|
| Floating compact/minimal panel with one-line rows | `D/footer/AssetFooterUploadOverlay.vue`, `D/queue/AssetQueueItemList.vue` |
| Minimise from the full view and come back | `AssetFooterUploadOverlayFull.vue:221-238`, `AssetFooterUploadOverlay.vue:138-148` |
| Slot upload panel and inline slot row | `D/footer/AssetFooterUploadSlotsOverlay.vue`, `AssetSlotListItem.vue:141-156` |
| Mass edit of existing assets through the same row and sidebar | `D/footer/AssetFooterSelected.vue`, `AssetFooterSelectedFull.vue` |
| External-provider selection strip, read-only queue, import | `ExternalProviderAssetFooterSelected*.vue`, `ExternalProviderAssetQueue*Readonly.vue` |
| Video / audio / document (panels in mass operations, icons in the image box) | `D/queue/AssetQueueSelectedSidebar.vue:285-329` |
| Deleting the asset from the row (API) | AQIE:167-177, 416-422 |
| Duplicate overlay with a link to the original | AQIE:304-328 |
| ACL on upload, save, delete, author/keyword creation | `AssetUpload.vue:117-132`, `AssetFooterUploadOverlayFull.vue:164`, AQIE:418 |
| Folder drop (directory traversal) | `DAM/src/domains/coreDam/shared/components/FileUpload.vue:145-214` |

---

## B. Pairs

### B.1 Row: `UploadQueueItemEditable` (LIB, 436 lines) vs `AssetQueueItemEditable` (DAM, 510 lines)

The LIB file was created on 2024-01-02 (`2c202a9b Release/1.40.0 (#155)`). The DAM file was last reworked by `3a242125 fix(dam): refs #86567 upload queue, list and start-up fixes with a test suite` (2026-09-06) and `13812f57` (2026-10-07); the LIB one by `8c51327f`, `9d6f62ca`, `49bd815b` (all 2026-10-07).

**Identical on both sides** (verified by `diff` of the two templates): the grid (`xxl=2 xl=3 md=4 sm=6 cols=12`, UQIE:216-222 / AQIE:279-285); the `AssetImage` call and all its props (UQIE:226-240 / AQIE:289-303); the error overlay structure - alert icon, "Chyba", then message, else fail-reason chip, else unknown-error text (UQIE:241-271 / AQIE:329-359); the title line "Názov originálu: <name> (<size>)" (UQIE:341-350 / AQIE:427-436); order of the right-hand buttons (copy id, refresh, cancel, delete); the four `v-model`s (`customData`, `keywords`, `authors`, `mainFileSingleUse`) and their setters (UQIE:61-95 / AQIE:62-96); the validation-scope switch and the `:key` trick that drops a non-editable row out of validation (UQIE:101-103, 362, 366 / AQIE:103-105, 440, 443); 20 s before refresh is offered (`L/composables/uploadQueueItemRefresh.ts:11` / AQIE:132). Clicking the card itself does nothing on either side - only the buttons act. Neither side shows upload speed (`progress.speed` is read by no component). Progress = circular percentage + "Nahrávanie" + short remaining time inside `AssetImage`, the same on both.

**Differences**

| # | What the user sees / what differs | LIB | DAM | Class |
|---|---|---|---|---|
| R1 | A duplicate | Warning-coloured line under the title: "Hlavný súbor je duplikát." (UQIE:351-358). Form stays **editable**, filled with the original's metadata - the LIB store swaps the item to the original asset and sets `canEditMetadata = true` (`LIB/.../store/uploadQueuesStore.ts:364-386`) | Semi-transparent overlay over the image: warning icon, "Duplikát", button "Zobraziť originál" opening the original in a new tab (AQIE:304-328, `D/AssetLink.vue`). Form **disabled** (AQIE:437); store sets `canEditMetadata = false // todo check with product` (`DAM/.../store/uploadQueuesStore.ts:677`) | PRODUCT (a duplicate is a usable result for a widget; in DAM it is a dead end) |
| R2 | Edit button | "Upraviť v DAM" / "Edit in Media Library" (`common.damImage.image.button.editAsset`); always rendered, disabled without metadata; emits `showDetail` (UQIE:280-287, 152-155) which the dialog turns into the library's asset detail dialog (`UploadQueueDialog.vue:152-164`) | "Upraviť" / "Edit more" (`coreDam.asset.queueItem.edit`); **hidden for a duplicate** (AQIE:369); opens DAM's own detail through two stores with a request counter and a guarded error path (AQIE:142-166) | PRODUCT (label, hidden for duplicate) + STRUCTURAL (which detail opens) |
| R3 | Trash button | Rendered **only together with refresh** (`v-if="showRefresh"`, UQIE:330-336). Confirm text "Odstrániť z fronty nahrávania?". Only removes the row from the queue (`UploadQueueEditable.vue:48-50`); no API call | **Always rendered**, behind `ACL.DAM_ASSET_DELETE`, disabled unless the row has metadata or is a duplicate (AQIE:416-422). Confirm text is the default "Odstrániť?" with "Zmazať". **Deletes the asset** (`deleteAsset`), then removes the row by asset id, then alert "deleted" (AQIE:167-177) | PRODUCT. History: at copy time the LIB had DAM's delete commented out; `f8b1ee30 added refresh button to upload` (2024-11-11) replaced it by the remove-from-queue button |
| R4 | Cancel (x) button - for which statuses | `Loading, Waiting, Uploading` (UQIE:140-147) | the same plus `Processing` and `Failed` (AQIE:203-215), added by `3a242125` with the comments "with no notification and no fallback it stays here until refresh or cancel" and "delete is no answer there - a refused import never created an asset" | `Failed`: DRIFT-BUG, see R6. `Processing`: UNKNOWN - the LIB has a status fallback and offers Refresh + Remove after 20 s, so the gap is the first 20 s only; settle by asking whether a LIB row in "Spracováva sa" should be cancellable at once |
| R5 | Refresh button: when it appears | (a) 20 s after entering `Uploading`/`Processing`; (b) 20 s after `Uploaded` while there is still no metadata (UQIE:176-199); hidden again when metadata arrives (UQIE:201-207) | (a) the same, but re-checked against the status at the time the timer fires; (b) the same, except never for a duplicate; (c) **immediately** on an `Uploaded` row that carries an error; (d) explicitly hidden on `Failed`/`Stop` (AQIE:220-270) | (c) STRUCTURAL - depends on store states DAM has (`system.uploadErrors.metadataFailed`). (b)-duplicate: no visible difference, LIB duplicates have metadata. (a)/(d): DRIFT-BUG, R6 |
| R6 | A **failed** row | The `Uploading`/`Processing` timer is neither cleared nor re-checked when the row fails: the callback tests the captured `newValue`, which is always true (UQIE:181-185), and the `Failed` status matches no branch. So 20 s after the upload began, a failed row gets **Refresh and Remove-from-queue**. There is no Cancel (R4). A row that fails without ever having been `Uploading` gets no button at all (inferred) | Timer cleared on every status change, status re-read when it fires ("The status when the timer fires, not when it was set", AQIE:227-228). A failed row shows **Cancel**, a disabled trash, no refresh (AQIE:253-255) | DRIFT-BUG on the LIB side (DAM fixed it in `3a242125`). **Warning:** in the LIB this defect is the only thing that gives a failed row a way out; porting DAM's timer alone would leave LIB failed rows with no button. The fix has to come with R4-`Failed` or an own rule for Remove |
| R7 | Keywords / authors while the form is disabled | Shown as a **label with chips** (read-only list), the "new author" button hidden: `LIB/src/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue:164-187`, `.../author/components/AuthorRemoteAutocompleteWithCached.vue:152-175, 251` (introduced by `4da99073 asset select sidebar info`, 2024-12-03, for another screen) | Shown as **disabled inputs**; keyword gets `:disabled` (`DAM/src/domains/coreDam/keyword/components/KeywordRemoteAutocompleteWithCached.vue:167`), the author input is disabled through the surrounding `VForm` (inferred), the "new author" button is disabled, not hidden (`.../author/components/AuthorRemoteAutocompleteWithCached.vue:223-234`) | UNKNOWN - a side effect of a LIB change made for the select sidebar; settle by a product look at a waiting row on both sides |
| R8 | Creating a keyword / author from the row (Enter, comma, "+ name" entry, "+" button) | Always available | Only with `ACL.DAM_KEYWORD_CREATE` / `ACL.DAM_AUTHOR_CREATE` (DAM keyword component :131-143, author component :127-140, 225) | STRUCTURAL (DAM has its ACL; the other admins have none for DAM entities) |
| R9 | "Jednorazová licencia" switch | Only if `mainFileSingleUseEnabled` (UQIE:39, 418-429; option read in `UploadQueueEditable.vue:33`) | Always (AQIE:493-503). Both use the same LIB key `common.damImage.asset.model.mainFileSingleUse` | STRUCTURAL (per-admin option; prop already exists, default `true`) |
| R10 | How many custom fields are pinned above keywords/authors when the config gives none or 0 | `customMetadataPinnedAmount \|\| 2` (`LIB/src/domains/dam/assetDetail/components/AssetCustomMetadataForm.vue:50`, from `e5cc06f4`) | `?? 0` (`DAM/src/domains/coreDam/shared/components/customMetadata/AssetCustomMetadataForm.vue:45`, from `0a338ce1 vuetify 4 upgrade`) | UNKNOWN - both sides invented a fallback for the same originally unguarded read; identical whenever the config sends a positive number. Settle by checking what core-dam sends and whether 0 is a legal setting |
| R11 | Accessible names on the icon buttons | `aria-label` on refresh and cancel (UQIE:299, 316) | none (AQIE:385-415) | DRIFT-BUG on the DAM side; LIB added them in `aef095d0` (2026-09-28) and guards them with `LIB/src/test/a11y/iconButtonNames.test.ts` |
| R12 | Which ext system the form and the autocompletes use | prop `extSystem` (UQIE:32, 364, 382, 408) | the app-wide current ext system, read inside each nested component (`.../customMetadata/AssetCustomMetadataForm.vue:28-30`) | STRUCTURAL |
| R13 | Validation scope symbol | `anzu:common:asset-metadata-validation-scope` (`LIB/src/domains/dam/composables/uploadValidations.ts:11`) | `anzu:asset-metadata-validation-scope` (`DAM/src/domains/coreDam/shared/validationScopes.ts:1`) | STRUCTURAL, not visible |
| R14 | Leftover | empty `<div v-if="item.isDuplicate" />` (UQIE:290) | - | no effect |

Props, emits, slots:

| | LIB (UQIE:28-57) | DAM (AQIE:33-58) |
|---|---|---|
| props | `index, queueKey, extSystem, customData, keywords, authors, item, refreshDisabled, mainFileSingleUse, mainFileSingleUseEnabled?, disableDoneAnimation?` | `index, queueId, customData, keywords, authors, item, refreshDisabled, mainFileSingleUse, disableDoneAnimation?` |
| emits | 4x `update:*`, `cancelItem {index,item,queueKey}`, `removeItem(index)`, `showDetail(assetId)`, `refreshItem {index,assetId}` | 4x `update:*`, `cancelItem {index,item,queueId}`, `removeItem(assetId)`, `refreshItem {index,assetId}` |
| slots | none | none |
| side effects inside the row | none (pure: props in, events out) | calls the API (`deleteAsset`, `fetchAsset`), two stores, alerts, page-navigation guard (AQIE:19-24, 107-112, 142-177) |

What is disabled when (summary of the above):

| Row state | LIB | DAM |
|---|---|---|
| waiting / uploading / processing, no metadata yet | edit disabled; custom fields disabled, keywords/authors as chips; cancel (not while processing); after 20 s refresh + remove | edit disabled; all inputs disabled; cancel; trash shown but disabled; after 20 s refresh |
| uploaded, metadata present | everything enabled; no trash at all | everything enabled; trash enabled (deletes the asset) |
| uploaded, metadata missing | after 20 s refresh + remove | after 20 s refresh; trash disabled |
| duplicate | notice line; form enabled; edit enabled | overlay + link; edit hidden; form disabled; trash enabled |
| failed | error overlay; form disabled; refresh + remove appear by R6 | error overlay; form disabled; cancel; trash disabled |

### B.2 List container: `UploadQueueEditable` (LIB, 156) vs `AssetQueueEditable` (DAM, 117)

| # | Difference | LIB | DAM | Class |
|---|---|---|---|---|
| C1 | Mass-operations sidebar rendered when | `list.length > 0` (`L/components/UploadQueueEditable.vue:147`) | `list.length > 1` (`D/queue/AssetQueueEditable.vue:111`), from `b8294a50 ... hide mass edit tab when uploading single asset` (2023-06-19) | PRODUCT. The LIB changed `> 1` to `> 0` on purpose in a one-line commit before its first release (`fb48599a wip`, 2023-12-03). Note for DAM: with one item and the toggle on, the list still keeps a 400 px empty right margin (`LIB/src/styles/dam/components/asset-queue-editable.scss:35-37`) - current behaviour (inferred) |
| C2 | Keyboard | `keydown` on `document`: arrows scroll 100 px, PgUp/PgDn a page, Home/End to the ends, always with `preventDefault()` and without looking at the event target (`UploadQueueEditable.vue:57-90, 102`), from `2c814dab upload queue scroll` (2025-06-05) | none; DAM instead switches the asset list's own keyboard navigation off while the full view is open (`assetFooterUpload.ts:53-57`) | PRODUCT (LIB feature). Sub-question UNKNOWN: the handler also swallows Arrow/Home/End while the caret is in a text field of a row (inferred) - settle by trying Home/ArrowUp in a multi-line field of the CMS dialog |
| C3 | Right margin of the scroll area | `mr-md-4` + `outline: none` (`UploadQueueEditable.vue:120-121`), same commit as C2 | none (`AssetQueueEditable.vue:89`) | PRODUCT (cosmetic, 16 px from md up) |
| C4 | Refresh handler | composable `useUploadQueueItemRefresh`: decides by `mainFile.fileAttributes.status === Processed`, calls `queueItemFullyProcessed`; a duplicate is always reported as an image (`L/composables/uploadQueueItemRefresh.ts:24-32`) | inline: decides by `asset.attributes.assetStatus === WithFile`, calls `queueItemProcessed` and, while the row has no metadata, `queueItemMetadataProcessed`; passes the real asset type (`AssetQueueEditable.vue:29-53`) | STRUCTURAL (store API and asset types; the store agents' area). Same on both: one flag disables every row's refresh while one runs, errors are swallowed, the "still uploading or processing" warning uses the same LIB key (`AssetQueueEditable.vue:46`) |
| C5 | Remove / cancel plumbing | `removeByIndex(queueKey, index)`, `stopItemUpload(queueKey, item, index)` (`:44-50`) | `removeByAssetId(queueId, assetId)` (the delete is awaited, the index can shift), `stopItemUpload(queueId, item)` (`:59-65`) | STRUCTURAL (follows R3) |
| C6 | `showDetail` | re-emitted to the dialog (`:28-30, 141`) | not present; the row opens the detail itself | STRUCTURAL |
| C7 | Props | `queueKey, extSystem, massOperations, configName?, disableDoneAnimation?` (`:14-26`) | `queueId, massOperations, disableDoneAnimation?` (`:13-22`) | STRUCTURAL |
| C8 | `disableDoneAnimation` in practice | never passed by `UploadQueueDialog` (`:309-315`), so the "Hotovo" fade always plays | passed for mass edit of existing assets (`AssetFooterSelectedFull.vue:198`) | STRUCTURAL |

Identical: root classes `asset-queue-editable` / `--sidebar-active`, `__left`, `__sidebar border-s`, the `VRow` classes, priming of the keyword/author caches on mount.

### B.3 Mass-operations sidebar: the two `AssetQueueSelectedSidebar` (LIB 314, DAM 359)

| # | Difference | LIB | DAM | Class |
|---|---|---|---|---|
| S1 | Asset-type panels | Image only (`L/components/AssetQueueSelectedSidebar.vue:269-284`) | Image, Video, Audio, Document, each shown only if the queue holds that type (`D/queue/AssetQueueSelectedSidebar.vue:270-329`) | STRUCTURAL. For an image-only queue the output is the same |
| S2 | Where the write happens | composable in the component layer (`L/composables/uploadQueueMassOperations.ts`) | store actions (`DAM/.../store/uploadQueuesStore.ts:751-802`) | STRUCTURAL |
| S3 | Keywords/authors are written into | every item (`uploadQueueMassOperations.ts:26-44`) | only items whose asset type has the feature enabled (`uploadQueuesStore.ts:770-802`) | STRUCTURAL - no difference for an image-only queue, because the input itself is offered only when the type has the feature (LIB `:114-124`) |
| S4 | Ext system | prop (`:17`) | current ext system (`:120-121`) | STRUCTURAL |
| S5 | `aria-label` on the fill/replace icon buttons | yes (`:177, 193, 233, 249`) | no | DRIFT-BUG on the DAM side (as R11) |
| S6 | English texts | see D.2 | | text drift |

Identical: tab title, description, "Hlavné" panel, 286 px inputs, icons (`mdi-file-arrow-left-right-outline`, `mdi-file-replace-outline`), the three bottom buttons, which panels open on mount, the custom-value "empty" rule (`uploadQueueMassOperations.ts:19` = `uploadQueuesStore.ts:762-763`), `validation-scope="false"` on every input. Neither side skips rows that cannot be edited when filling.

**Open by default?** Held by the host, not the sidebar: LIB `false`, shared by all dialogs for the session (`useUploadQueueDialog.ts:5`); DAM upload `!mobile` on every opening (`AssetFooterUploadOverlayFull.vue:44`); DAM mass edit `true` (`AssetFooterSelectedFull.vue:45`). PRODUCT, already outside the paired component.

### B.4 Mass-operations form: the two `AssetCustomMetadataFormMassOperations` (107 / 105)

Template identical apart from the two `aria-label`s (`L/components/AssetCustomMetadataFormMassOperations.vue:73, 89`) and the i18n keys. Script: LIB takes `extSystem` and `modelValue` as props (`:13-14`), DAM uses `defineModel` and the current ext system (`DAM/src/domains/coreDam/shared/components/customMetadata/AssetCustomMetadataFormMassOperations.vue:22, 40-42`). Class: STRUCTURAL (ext system) + DRIFT-BUG (aria, DAM side).

### B.5 Stop / close button: `UploadQueueButtonStop` (91) vs `AssetFooterUploadButtonStop` (90)

| # | Difference | LIB | DAM | Class |
|---|---|---|---|---|
| B1 | `aria-label` on the icon button | yes (`L/components/UploadQueueButtonStop.vue:46`) | no (`D/footer/AssetFooterUploadButtonStop.vue:46-52`) | DRIFT-BUG, DAM side |
| B2 | Esc in the confirm dialog | cancels it (`:65`); dialogs are persistent by default in both apps (`LIB/src/plugins/commonVuetifyConfig.ts:109-113`) | does nothing (inferred) | DRIFT-BUG, DAM side (LIB added it in `aef095d0`); it is a small behaviour change for DAM |
| B3 | Confirm question, English | "Do you want to stop the upload?" | "Are you sure you want to stop the upload?" | text drift; Slovak identical |
| B4 | Unused prop | - | `dialogMaxWidth` declared, never used (`:9, 14`) | no effect |

Everything else is the same: no confirm when nothing is uploading, same `data-cy` values (`button-stop` default, `delete-panel`, `button-cancel`, `button-confirm`), same widths.

### B.6 Shell: `UploadQueueDialog` (LIB, 328) vs `AssetFooterUploadOverlayFull` (DAM, 254)

Not requested as a pair, but it is where most visible differences sit.

| # | Difference | LIB (`L/components/UploadQueueDialog.vue`) | DAM (`D/footer/AssetFooterUploadOverlayFull.vue`) | Class |
|---|---|---|---|---|
| D1 | Who owns the full-screen dialog | the component itself (`:168-173`) | the app shell (`MainWrapper.vue:134-143`); the component is plain content | STRUCTURAL |
| D2 | Primary button | "Uložiť a použiť", on md and smaller "Použiť" (`:220-230`); disabled while nothing is uploaded (`nothingToApply`, `:76`); saves, maps to images, emits `apply`; no "updated" alert (`:114-147`) | "Uložiť a ukončiť" (`:165-175`); disabled while nothing can be saved; saves, alerts, clears the queue, reloads the list (`:94-113`) | PRODUCT |
| D3 | ACL on the two save buttons | none | `<Acl :permission="ACL.DAM_ASSET_UPDATE">` (`:164`) | STRUCTURAL |
| D4 | Minimise button | none | chevron-down, back to the floating panel (`:221-238`) | STRUCTURAL |
| D5 | Close | stops the queue and clears `uploadQueueDialog` (`:88-91`) | stops the queue and hides the footer view (`:58-61`) | STRUCTURAL |
| D6 | After "save" | alert only (`:93-112`) | alert + asset list reload (`:85`) | STRUCTURAL |
| D7 | "+" add | `AFileInput` with a 34 px button, medium-emphasis icon, emits `filesInput` to the host (`:250-277`) | `AssetUpload variant="icon"`, 36 px, own ACL and limit dialog (`:195-198`) | STRUCTURAL; tiny visual drift (34 vs 36 px, icon tone) |
| D8 | Icon tone of save and mass-operations buttons | `text-medium-emphasis` (`:236, 289`) | default (`:180, 209`) | cosmetic drift, UNKNOWN which is intended |
| D9 | Toolbar | `overflow-x: auto`, right group `pr-3` (`:182, 214`) | neither (`:122, 158`) | cosmetic drift |
| D10 | Dropping files onto the open view | an `AFileDropzone` appears and accepts the drop, the dialog emits `drop` (`:317-324`), but **no host listens** - `ImageWidgetMultipleInner.vue:706-717` and `AAssetListInner.vue:425-435` bind only `apply` and `files-input` (a `rg "@drop"` over `LIB/src/domains/dam` finds no listener on `UploadQueueDialog`). The files are silently discarded (inferred) | a second full-window dropzone that adds to the queue itself (`:252`) | DRIFT-BUG on the LIB side; DAM is right |
| D11 | Validation | `useVuelidate({ $stopPropagation: true })` (`:81`) - the dialog sits inside another form | `useVuelidate()` (`:72`) | STRUCTURAL |
| D12 | Titles, English | "Uploading" / "Uploading completed" | "Upload" / "Upload done" | text drift; Slovak identical |

Same on both: root classes `asset-footer__upload asset-footer--full asset-footer__upload--full`, 64 px toolbar, green bold title when done, spinner with "Nahrávanie n/N", save icon with tooltip "Uložiť a pokračovať", mass-operations icon `mdi-tag-text-outline`, `data-cy="button-close"` on the stop button, `nothingToSave` rule for the save icon.

### B.7 Building blocks under the row (each exists twice)

| Block | LIB | DAM | Difference | Class |
|---|---|---|---|---|
| `AssetImage` | `LIB/src/domains/dam/assetDetail/components/AssetImage.vue` (325) | `D/AssetImage.vue` (316) | i18n keys; placeholder file `.svg` vs `.jpg` - the SVG redraws the same picture (`e1479025 perf: the image placeholder is a 1 KB SVG instead of a 58 KB JPEG`; compared by eye) | none visible |
| `AssetImageMetaIcons` | `.../assetDetail/components/AssetImageMetaIcons.vue` | `D/AssetImageMetaIcons.vue` | DAM has an extra TTS icon (`:13`) | STRUCTURAL; not used by the queue row (no `show-meta-icons`) but used by DAM lists |
| `AssetFileFailReasonChip` + its options | `.../assetDetail/components/AssetFileFailReasonChip.vue`, `.../composables/assetFileFailReason.ts` | `D/AssetFileFailReasonChip.vue`, `.../valueObject/AssetFileFailReason.ts` | i18n keys only; one English string differs (D.2) | text drift |
| `AssetCustomMetadataForm` | `.../assetDetail/components/AssetCustomMetadataForm.vue` (71) | `.../shared/components/customMetadata/AssetCustomMetadataForm.vue` (67) | R10, R12, LIB has `readonly` | see R10 |
| Keyword / author autocomplete | `LIB/src/domains/dam/{keyword,author}/components/*RemoteAutocompleteWithCached.vue` | `DAM/src/domains/coreDam/{keyword,author}/components/*RemoteAutocompleteWithCached.vue` | R7, R8, R12; **separate caches** (each side has its own `defineCached` instance, `.../composables/cachedAuthors.ts`) | see R7, R8 |
| File picker / dropzone | `AFileInput`, `AFileDropzone` (`LIB/src/domains/ui/file/components/`) | `FileUpload.vue` | different component design; DAM traverses dropped folders, LIB uses `useDropZone`; different dropzone texts and colours (DAM's are fixed light colours, `FileUpload.vue:363-371`) | STRUCTURAL |
| Format/size check | `LIB/src/domains/ui/file/composables/formatAndSizeCheck.ts` | `.../shared/services/upload/fileValidation.ts` | same rules; LIB also trims and lower-cases the accept keys (`:22`) | minor drift |
| Over-limit dialog | `ImageWidgetMultipleLimitDialog.vue` (constant 50) | inside `D/AssetUpload.vue:149-187` (limit from beta features) | same layout and wording | STRUCTURAL |

---

## C. What DAM's upload components already take from the library

**Imported from `@anzusystems/common-admin`:**

| DAM file | Takes from the library |
|---|---|
| `D/queue/AssetQueueItemEditable.vue:2-14` | `AActionDeleteButton, ASystemEntityScope, ATableCopyIdButton, AssetFileFailReason, DamAssetStatusDefault, UploadQueueItemStatus, isNull, prettyBytes, useAlerts, usePageNavigation`; types `AssetCustomData, DocId, UploadQueueItem, UploadQueueItemStatusType` |
| `D/queue/AssetQueueEditable.vue:2-3` | `AssetFileProcessStatus, DamAssetStatus, useAlerts`; types `DocId, UploadQueueItem` |
| `D/queue/AssetQueueSelectedSidebar.vue:2-3` | `ASystemEntityScope, DamAssetType, useDamConfigState`; types |
| `D/queue/AssetQueueItemList.vue:2-3` | `AssetFileFailReason, UploadQueueItemStatus, useRemainingTime`; types |
| `D/footer/AssetFooterUploadButtonStop.vue:2` | `ADialogToolbar, eventClickBlur` |
| `D/footer/AssetFooterUploadOverlay*.vue` | `useAlerts, useTheme`, global `ABtnPrimary`, `Acl` |
| `D/AssetUpload.vue:2-9` | `ADialogToolbar, DamAssetType, isUndefined, useDamAcceptTypeAndSizeHelper, useDamConfigState` |
| `.../shared/components/FileUpload.vue:2` | `arrayFlatten, arrayFromArgs, isArray, isUndefined, useAlerts` |
| `.../shared/services/upload/fileValidation.ts:1` | `damFileTypeFix, isUndefined` |
| `D/AssetImage.vue:2-3` | `DamAssetStatus, DamAssetType, isUndefined, useRemainingTime`; types |
| `.../customMetadata/AssetCustomMetadataForm*.vue` | `ACustomDataForm, ACustomDataFormElement, useDamConfigState` |
| the two autocompletes | `AFormRemoteAutocompleteWithCached, FilterInnerConfigKey, FilterInnerDataKey, useValidate, useDamKeywordFactory, defineCached` |
| DAM store (other agents' area) | `useUploadQueueItemFactory, useAssetSuggestions` (`DAM/.../store/uploadQueuesStore.ts:13-15`) |

**Library texts already used by DAM's upload UI:** `common.damImage.asset.model.mainFileSingleUse` (AQIE:500), `common.damImage.queueItem.stillUploadingOrProcessing` (`AssetQueueEditable.vue:46`), `common.damImage.author.filterMinChars` and `.conflicts` (DAM author component :169, 241), `common.button.refresh|cancel`, `common.system.modal.hide|show|confirmDelete`.

**Library CSS already used by DAM:** every `dam-upload-queue*`, `asset-queue-editable*`, `asset-footer*`, `sidebar-info*`, `asset-image*` class comes from the library stylesheet (`DAM/src/main.ts:12`); DAM defines none of them (D.3).

**Local duplicates** (DAM file - LIB counterpart):

| DAM | LIB | Lines DAM |
|---|---|---|
| `D/queue/AssetQueueItemEditable.vue` | `L/components/UploadQueueItemEditable.vue` | 510 |
| `D/queue/AssetQueueSelectedSidebar.vue` | `L/components/AssetQueueSelectedSidebar.vue` | 359 |
| `D/queue/AssetQueueEditable.vue` | `L/components/UploadQueueEditable.vue` + `L/composables/uploadQueueItemRefresh.ts` | 117 |
| `D/footer/AssetFooterUploadButtonStop.vue` | `L/components/UploadQueueButtonStop.vue` | 90 |
| `.../customMetadata/AssetCustomMetadataFormMassOperations.vue` | `L/components/AssetCustomMetadataFormMassOperations.vue` | 105 |
| `.../customMetadata/AssetCustomMetadataForm.vue` | `LIB/.../assetDetail/components/AssetCustomMetadataForm.vue` | 67 |
| `D/AssetImage.vue` (+ `AssetImageMetaIcons.vue`) | `LIB/.../assetDetail/components/AssetImage.vue` | 316 |
| `D/AssetFileFailReasonChip.vue`, `.../valueObject/AssetFileFailReason.ts` | `LIB/.../assetDetail/components/AssetFileFailReasonChip.vue`, `.../composables/assetFileFailReason.ts` | 25 + |
| DAM keyword/author autocompletes, chips, caches, type-config composables | LIB equivalents under `LIB/src/domains/dam/{keyword,author}/` | 262 + 237 + |
| store mass-operation actions (`uploadQueuesStore.ts:751-802`) | `L/composables/uploadQueueMassOperations.ts` | ~50 |
| limit dialog in `D/AssetUpload.vue:149-187` | `ImageWidgetMultipleLimitDialog.vue` | ~40 |
| `.../shared/services/upload/fileValidation.ts` | `LIB/src/domains/ui/file/composables/formatAndSizeCheck.ts` | 59 |
| `AssetMetadataValidationScopeSymbol` | `ADamAssetMetadataValidationScopeSymbol` | - |

**Not exported by the library today** (so DAM could not import them even if they matched): every component and composable under `L/` except `useAssetSuggestions` and the item factory; `AssetImage`, `AssetCustomMetadataForm`, the two autocompletes, `AFileDropzone`, the upload store. The public entry exports only `AFileInput`, the `UploadQueue*` types, `AssetFileFailReason`, `useRemainingTime`, `useDamAcceptTypeAndSizeHelper`, `useUploadQueueItemFactory`, `useAssetSuggestions`, `useDropzoneGlobalDragState` (`LIB/src/lib.ts:812, 849, 862-869, 973, 996-1001, 1068`).

---

## D. Texts and styles

### D.1 Where the strings live

| Side | File | Keys |
|---|---|---|
| LIB | `LIB/src/locales/{sk,en,cs}/common/damImage.json` | `common.damImage.queueItem.*`, `.upload.*`, `.upload.limits.*`, `.uploadErrors.*`, `.asset.massOperations.*`, `.asset.model.*`, `.asset.assetType.*`, `.asset.assetFileFailReason.*`, `.asset.detail.*`, `.image.button.*` |
| DAM | `DAM/src/locales/{sk,en}/coreDam/asset.json` | `coreDam.asset.queueItem.*`, `.upload.*`, `.selected.*`, `.massOperations.*`, `.model.*`, `.assetType.*`, `.assetFileFailReason.*`, `.externalProvider.*`, `.slots.*` |
| DAM | `DAM/src/locales/{sk,en}/system.json` | `system.upload.*` (`:9-28`), `system.uploadErrors.*` (`:96-105`) |

The library ships Czech as well; DAM has Slovak and English only. A library guard test requires every literal key used in library source to exist in the library's en, sk and cs messages; only `system.subject.*` is exempt (`LIB/src/test/i18nLiteralKeys.test.ts:20, 56`).

### D.2 Pairs of keys for the same text

Line numbers: LIB `sk/common/damImage.json`, DAM `sk/coreDam/asset.json` or `sk/system.json`. "=" means identical.

| Text | LIB key (line) | DAM key (line) | Slovak | English |
|---|---|---|---|---|
| row: error title | `queueItem.error` (52) | `coreDam.asset.queueItem.error` (246) | = "Chyba" | = |
| row: original name | `queueItem.displayTitle` (51) | `...queueItem.displayTitle` (245) | = "Názov originálu" | "Original Name" / "Original name" |
| row: copy id | `queueItem.copyAssetId` (53) | `...queueItem.copyAssetId` (247) | = "Kopírovať asset ID" | "Copy asset ID" / "Copy Asset ID" |
| row: unknown error | `uploadErrors.unknownError` (206) | `system.uploadErrors.unknownError` (97) | = | "...Please try again later or contact the administrator." / "...Try again later or contact an administrator." |
| row: edit | `image.button.editAsset` (17) "Upraviť v DAM" | `...queueItem.edit` (242) "Upraviť" | **different (R2)** | "Edit in Media Library" / "Edit more" |
| row: duplicate | `asset.detail.info.status.duplicate` (86) "Hlavný súbor je duplikát." | `...queueItem.duplicate` (243) "Duplikát", `.viewOriginal` (244) | **different (R1)** | |
| row: remove confirm | `queueItem.removeFromQueue` (55) | default `common.system.modal.confirmDelete` | **different (R3)** | |
| keywords / authors | `asset.model.keywords|authors` (61, 60) | `coreDam.asset.model.keywords|authors` (6, 5) | = | = |
| single use | `asset.model.mainFileSingleUse` (62) | the same LIB key | = | = |
| image box: waiting, processing, uploading, done | `upload.waiting|processing|uploading|done` (147-150) | `system.upload.*` (15-18) | = | = |
| fail reasons (6) | `asset.assetFileFailReason.*` (138-143) | `coreDam.asset.assetFileFailReason.*` (85-90) | = | `invalidMimeType`: "Invalid file type" / "Invalid mime type" |
| stop tooltip/button | `upload.stop` (151) | `system.upload.stop` (13) | = "Zatvoriť" | = "Close" |
| stop question | `upload.stopConfirmQuestion` (158) | `system.upload.stopConfirmQuestion` (14) | = | differs (B3) |
| add | `upload.add` (152) | `system.upload.add` (10) | = "Pridať do nahrávania" | = |
| title / done | `upload.title|titleDone` (156, 157) | `coreDam.asset.upload.title|titleDone` (196, 197) | = | differs (D12) |
| uploading n/N | `upload.uploading` (149) | `coreDam.asset.upload.uploading` (201) | = | = |
| save and continue | `upload.save` (153) | `coreDam.asset.upload.save` (199) | = | = |
| primary | `upload.saveAndApply` (154), `.apply` (155) | `coreDam.asset.upload.saveAndClose` (200) | **different (D2)** | |
| mass operations (8 keys) | `asset.massOperations.*` (118-125) | `coreDam.asset.massOperations.*` (226-233) | all 8 = | `title`, `replaceAll` =; `description`, `fillOneEmpty`, `fillAllEmpty`, `replaceOne`, `clearForm`, `general` differ |
| asset type names | `asset.assetType.*` (65-68) | `coreDam.asset.assetType.*` (74-77) | = | = |
| limits (7 keys) | `upload.limits.*` (160-166) | `system.upload.limits.*` (20-26) | 6 =; `onlyAllowedAtOnce` differs by a full stop | 4 of 7 differ in wording |
| wrong format/size warning | `common.system.upload.incorrectFormatSize` | `system.upload.incorrectFormatSize` (12) | = | not compared |
| refresh / cancel tooltips, hide / show | `common.button.*`, `common.system.modal.*` | the same LIB keys | = | = |

Summary: **every Slovak string that means the same thing is already identical** (one full stop aside). The English sets have drifted in about 15 strings. DAM keys with no LIB counterpart: everything for the floating panels, slots, selection strip, external provider (`coreDam.asset.upload.edit|clear|newAssetsUploadOverlayTitle|slotsUploadOverlayTitle`, `.selected.*`, `.externalProvider.*`, `system.upload.dragAndDrop`, `system.uploadErrors.metadataFailed|metadataUnavailable|processingTooLongSlot`). Dead in DAM: `coreDam.asset.upload.stopOverlay.*` (`asset.json:203-206`, used by no component).

### D.3 Styles

| Classes | Defined in | Used by |
|---|---|---|
| `dam-upload-queue`, `--simple`, `--list`, `--editable`, `__item`, `__item-card`, `__item-status(--permanent)`, `__item-remove`, `__overlay`; keyframes `animate-upload-done`; `asset-image*` | `LIB/src/styles/dam/components/dam-upload-queue.scss` | both. `--simple` and `--list` (and the hover swap of status icon and cancel button, `:96-108`) are used **only by DAM** (`AssetQueueSelectedSimple.vue:16`, `AssetQueueUploadList.vue:30`, `AssetSlotListItem.vue:146`) |
| `asset-queue-editable`, `__left`, `__sidebar`, `--sidebar-active` | `LIB/src/styles/dam/components/asset-queue-editable.scss` | both |
| `asset-footer`, `__selected`, `--hidden|minimal|compact|full` | `LIB/src/styles/dam/components/asset-footer.scss` | both; `__selected`, `--hidden|minimal|compact` only by DAM |
| `sidebar-info*` | `LIB/src/styles/dam/components/sidebar-info.scss` | both |
| `.v-dialog--fullscreen.overlay--sidebar`, `.v-expansion-panels--compact` | `LIB/src/styles/overrides/vuetify-overrides.scss:47, 58` | both |
| `asset-upload-overlay*` | `DAM/src/styles/components/upload-overlay.scss` | DAM only |
| `dam-upload-dropzone*` | `<style>` of `DAM/.../shared/components/FileUpload.vue:362-378` | DAM only |
| `a-file-dropzone*` | `<style>` of `LIB/src/domains/ui/file/components/AFileDropzone.vue:92-200` | LIB only |

So the CSS of the paired components is **one source already** - there is nothing to reconcile, and DAM overrides none of the queue classes (`rg` over `DAM/src` `.scss` and `.vue` for selectors with these names finds only `.asset-image__meta-icons*` in `D/AssetImageMetaIcons.vue:106, 112`, the local copy of the same block in the library's `AssetImageMetaIcons.vue:95, 101`). The "done" animation is the same rule on both sides: a white 50 % veil with a check icon and "Hotovo" fading out over 2 s (`dam-upload-queue.scss:43-46, 128-137`).

Classes used in templates but defined nowhere: `dam-upload-queue__overlay--error|--warning` (modifiers, both sides - harmless), `dam-upload-queue__duplicate-overlay` (`D/queue/AssetQueueSelectedItemSimple.vue:62`; the SCSS only knows `__overlay`, so the duplicate label of the selection strip is not laid over the thumbnail - inferred), `dam-upload-icon`, `dam-upload-button` (`FileUpload.vue:280, 321`).

---

## F. Risks (concrete)

1. **Two pinia stores, two detail stores, two caches.** LIB components import the LIB store directly (`UploadQueueEditable.vue:3`, `AssetQueueSelectedSidebar.vue:4`, `uploadQueueMassOperations.ts:2`, `uploadQueueItemRefresh.ts:6`, `UploadQueueDialog.vue:5`): id `commonUploadQueuesStore` vs DAM's `damUploadQueuesStore` (`LIB/.../store/uploadQueuesStore.ts:36`, `DAM/.../store/uploadQueuesStore.ts:72`); likewise `commonAssetDetailStore` vs `damAssetDetailStore`, and separate keyword/author caches. A library component dropped into DAM unchanged would render an empty queue and resolve chips from an empty cache. Only the row is free of store imports.
2. **Remove vs delete on the same button slot (R3).** Mixing them up either deletes DAM assets from a CMS widget or stops DAM from deleting. DAM's e2e pins its side: `DAM/e2e/pages/assets/assetBulkEditPage.ts:245-248` clicks `[data-cy="button-delete"]` in the row, expects the dialog text "Odstrániť?", the button "Zmazať" and the delete alert.
3. **The LIB failed-row way out rests on a defect (R6).** See the warning there.
4. **Selectors DAM's e2e depends on:** `.dam-upload-queue__item` (count of rows; also matches the one-line rows), `.asset-queue-editable`, `.asset-queue-editable__sidebar`, `.asset-footer__selected` (`assetBulkEditPage.ts:25, 30, 111-112, 205-245`); `[data-cy="table-copy"]` in a row (`:231`); `[data-cy="custom-field-<name>"] textarea` (`:38`); `[data-cy="add-author"]` (`:169`); role-button names "Upraviť", "Hromadné operácie", "Vyčistiť", "Uložiť a ukončiť" and the icon `.mdi-content-save` (`:110, 118, 200, 215, 221`); `[data-cy="upload-overlay-title"]`, `[data-cy="button-add-description"]`, `.v-overlay--active [data-cy="button-close"]`, `.dam-upload-dropzone--fullscreen`, `input[type="file"]` first (`DAM/e2e/pages/shared/upload.ts:99, 124, 134, 139-140`); `.asset-upload-overlay .dam-upload-queue--list [data-cy="icon-duplicate"]` (`DAM/e2e/pages/licence/licenceDuplicatePage.ts:17`); `.dam-upload-queue__item .mdi-alert:not([data-cy="icon-duplicate"])` (`DAM/e2e/tests/errors/errorPaths.spec.ts:221`). `upload.ts:90-93` also relies on DAM reading drops through `webkitGetAsEntry()`.
5. **Row text change breaks a role selector:** "Upraviť" (DAM) vs "Upraviť v DAM" (LIB) - `assetBulkEditPage.ts:110` matches the strip's button by name; the row's edit button carries the same word.
6. **Document-level key handler (C2)** would run in DAM next to the asset list's own keyboard navigation and would be new behaviour there.
7. **Library guard tests a moved DAM component must pass:** literal i18n keys must exist in the library's three languages (`LIB/src/test/i18nLiteralKeys.test.ts`), icon-only buttons need an accessible name (`LIB/src/test/a11y/iconButtonNames.test.ts`), public exports are pinned (`publicExportsAdded.test.ts`, `publicExportsRemoved.test.ts`). `coreDam.*` / `system.upload.*` keys cannot live in library source.
8. **English wording** changes for DAM wherever it starts using a library key (about 15 strings, D.2); Slovak does not. DAM's `xx` language shows keys instead of texts for administrators (`DAM/src/test/languageMessagesTranslationIds.test.ts:7-8`), so renamed keys are visible there.
9. **Teleport** exists only in the LIB single-file dialog (`AssetDetailSidebarActionsWrapper.vue` teleports the buttons into a class-named target per `queueKey`); none of the paired components teleport. Both full views are Vuetify dialogs, i.e. rendered in the overlay container - a host dropzone under the dialog does not receive drops made on the dialog (this is why D10 loses files).
10. **Module-level singletons in the LIB:** `uploadQueueDialog` / `uploadQueueSidebar` (`useUploadQueueDialog.ts:4-5`) - one open dialog and one sidebar flag for the whole app.
11. **Unit tests bound to today's components:** LIB `L/__tests__/queueRowValidation.test.ts`, `uploadQueueRowRefresh.test.ts`, `uploadQueueDialogSave.test.ts`, `massOperationsValidation.test.ts`, `uploadQueueDialogSingle.test.ts`; DAM `DAM/src/test/queue/queueRowValidation.test.ts`, `massOperationsSidebar.test.ts`, `saveNothing.test.ts`.
12. **Shared CSS is already shared:** a change to `dam-upload-queue.scss` or `asset-queue-editable.scss` for one side changes the other today; the `--list` hover rule and `--simple` sizes serve DAM-only components.

### Side findings (outside the pairs, not verified at runtime)

- `ExternalProviderAssetListView.vue:183` prints the raw view state (`{{ externalProviderFooterViewSelected }}`) into the dialog slot - looks like a debugging leftover.
- A single-image widget passes every dropped file to the queue (`ImageWidgetInner.vue:314`) while the single dialog shows only the first item (`UploadQueueDialogSingle.vue:78-80`).
- DAM's over-limit dialog confirms with `addByFiles` even for a slot upload (`D/AssetUpload.vue:94-101`).
- `UploadQueueDialogSingle` declares `fileInputKey`, `accept`, `maxSizes` and uses none in its template (`:42-44`); `ImageWidgetMultipleInner.vue:714` passes `multiple` to `UploadQueueDialog`, which has no such prop.
- DAM's floating panel for the global queue has no close button; the only ways to end it are through the full view (`AssetFooterUploadOverlay.vue:89-125`).

---

# PART II - PROPOSALS (my own, not facts)

## E. Least mechanism per PRODUCT / STRUCTURAL difference

| Diff | Least mechanism | Worth it? |
|---|---|---|
| R1 duplicate presentation | two scoped slots on the row: `image-overlay` (DAM fills it) and `notice` (LIB fills it); the error overlay stays shared | yes |
| R2 edit button | one scoped slot `edit` (`{ item }`), each side renders its own 6-line button; DAM's detail-opening code moves to a small DAM composable | yes - cheaper than label + visibility + event props |
| R3 trash | one scoped slot `remove` exposing `{ item, index, showRefresh }`; no shared default | yes; a shared default would be the wrong one for one side |
| R4/R6 cancel statuses, failed row | prop `cancelStatuses` (default the DAM list). Decide R6 first: what a failed LIB row offers | needs the owner's decision |
| R5 refresh rule | one composable for "should refresh be offered", DAM's version; rule (c) and the duplicate exemption are no-ops for LIB data | yes, after R6 |
| R7 disabled look | stays inside the autocompletes; not a row concern | - |
| R8 ACL on create | the autocompletes take `canCreate` (boolean prop, default true); DAM passes its ACL result | yes, small |
| R9 single-use switch | existing prop `mainFileSingleUseEnabled` | free |
| R10 pinned fallback | settle the UNKNOWN first; if both must stay, a prop on the form | small |
| R12 ext system | DAM passes its current ext system as the prop | free |
| C1 sidebar threshold | prop `sidebarMinItems` (LIB 1, DAM 2) | yes |
| C2 keyboard scroll, C3 margin | prop `keyboardScroll` (default off) and a class/attr on the scroll box, or leave the scroll box to the host | yes, but see below |
| C4-C6 refresh / remove / detail | events handled by the host (`refresh-item`, `cancel-item`, `remove-item` already are events of the row) | free once the store is one |
| S1 type panels | take DAM's four panels; they already render by "type present in the queue" | free |
| S2/S3 writes | one implementation with DAM's per-type rule | free |
| D1-D7 shell | **keep local.** The two shells share a toolbar skeleton and nothing else: different primary action, ACL, minimise, close, add, dropzone, list reload | not worth sharing |

## Order I would take (cheapest and safest first)

1. **Leaf blocks with no product difference:** stop button (B.5), mass-operations form (B.4), `AssetFileFailReasonChip`, the validation-scope symbol. Each needs only the library version exported and, for texts, a decision on the ~3 English strings. Gains DAM the `aria-label`s and Esc.
2. **Mass-operations sidebar (B.3):** the largest clean win (359 lines, no product difference, Slovak texts identical). Blocked only by the store being one (risk 1) and by the autocompletes (R7, R8).
3. **`AssetImage`:** shareable as is for the queue; DAM keeps its own only if the TTS meta icon cannot become data.
4. **Row (B.1):** feasible with 4 slots and 2 props, but only after the form, the autocompletes and the refresh rule are one. Before that a "shared row" would have to inject keywords and authors through slots too and would be an empty frame.
5. **List container (B.2):** after the row. Its own logic is small; if the row ends up needing four forwarded slots, a container with a single `#item` slot is simpler than slot forwarding - at which point it is 30 lines of layout and sharing it is optional.
6. **Shells, floating panels, slot panel, selection strip, external-provider queue, single-file dialog:** stay where they are.

## Decisions the owner has to make before any of this

- **R6:** what a failed row offers in the other admins (today: Refresh + Remove after 20 s, by accident).
- **D10:** whether the multi dialog should accept drops (today it shows the dropzone and discards the files).
- **R7:** chips or disabled inputs while a row waits.
- **R10:** the pinned-fields fallback (2 or 0).
- **English texts:** whose wording wins for the ~15 drifted strings, or whether DAM keeps its own through props.
- **R11/S5/B1/B2:** whether DAM may take the accessible names and Esc as a "bug patch" (invisible, and one small keyboard change).
