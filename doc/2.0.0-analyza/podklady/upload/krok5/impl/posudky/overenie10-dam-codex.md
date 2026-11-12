The verdicts below are based on reading the frozen `src`, the earlier snapshot for claim 207, installed library code, and the backend source. No files were changed and no tests or requests were run. `A/`, `D/`, and `R/` use the path aliases in the question; `B/` means `vendor/anzusystems/core-dam-bundle/src/`.

## Claim 202 — Download links are not ordered

**Verdict: HOLDS.** Open an asset’s Info tab, click Download, then choose another slot while the initial signed-link request is pending. Alternatively, close and quickly reopen the dialog while a request is pending. If the older answer arrives last, the Download button points to the older file although the select shows the newer choice. Either answer can stop the spinner while the other request is still pending. This needs overlapping requests, but no unusually long hang.

**Evidence:** `D/components/AssetDownloadButton.vue:33-50` starts the initial request and another on selection; `:51-57` writes the link and clears loading without a request or dialog check; `:68-70` passes the selected file ID; `:110-129` displays the select and uses the resulting link as the button’s `href`. `D/components/AssetDetailSlotSelect.vue:57-63` emits a changed selection.

**Impact and smallest fix:** A user can download another slot’s file. Give each link request a generation number and accept its link, error, and loading result only while it is the latest request for the current opening. The spinner would then remain until the selected link finishes. **Size: S.**

## Claim 203 — Processing status stays stale

**Verdict: PARTLY.** The central case holds: open the detail or side panel while an existing main file is `uploaded` or `stored` and the asset is undescribed; let processing finish. The processing notification does not update that held file. “Save” remains disabled with the processing message until a fresh whole asset read. The claim’s word *never* is too broad: other paths can replace the held main file.

**Evidence:** `domains/system/composables/appNotificationListeners.ts:30-32` sends the processed event to the upload queue. `A/store/uploadQueuesStore.ts:270-281` only writes a main file into the detail when its current `mainFile` is **null**; it does not update an existing file’s status. `A/store/assetDetailStore.ts:118-130` replaces the asset on a whole read. `A/store/uploadQueuesStore.ts:129-139` defines the processing condition; `D/components/AssetDetailSidebarMetadata.vue:47-48,121-140` and `A/components/list/components/AssetListSidebarMetadata.vue:55-56,181-205` use it to disable Save and show the message. A successful “Make main file” can also replace the file, including its status, through `D/composables/assetDetailFileChange.ts:21-35`.

**Refresh steps:** In the list, select another tile and return, or select the same tile after the five-second reuse window (`A/components/list/composables/assetListActions.ts:35,103-115,344-369`). Reopening a detail within that window can reuse the stale asset. A successful file change triggers a whole read when metadata is untouched (`D/composables/assetDetailFileChange.ts:43-45`); with typed metadata, a route change deliberately keeps the old status (`:33-36`). Reloading the page also reads the asset again (`D/AssetDetailView.vue:93-106`). Refreshing the asset *list* or Slots tab does not itself replace the held detail.

**Impact and smallest fix:** Save can stay blocked after processing has finished; the user must force a whole read. On a processed-file notification or queue read, update the matching held main file’s status and related file attributes while preserving typed metadata and checking file identity. That would clear the message and enable Save as soon as the new status qualifies. **Size: M.**

## Claim 204 — Previous asset’s slots appear on the next asset

**Verdict: HOLDS.** In an asset’s Slots tab, start a slot change, then use the detail arrow to move to a neighbouring asset before the old change and its follow-up list read finish. The old `getList()` runs from the mutation’s `finally`. If its answer lands after the new asset’s slot read, the next asset’s Slots tab continues to show the previous asset’s rows until another refresh. Ordinary request overlap is sufficient; it does not require a many-second hang.

**Evidence:** `D/composables/assetDetailSidebarSlotsActions.ts:27-38` writes every answer to the shared store without checking the current asset, and `:46-117` calls `getList()` after mutations. `A/store/assetSlotsStore.ts:10-13,42-44` holds one shared list. Neighbour navigation replaces the detail (`A/components/list/composables/assetListActions.ts:437-477`); the sidebar is keyed by asset ID (`D/components/AssetDetailDialog.vue:306-321`), and the new Slots tab reads the same shared list (`D/components/slots/AssetDetailSidebarSlots.vue:51-54,86-103`).

**Impact:** The stale rows have working menus. They display the previous asset’s file ID, but their handlers receive the **new** asset ID (`D/components/slots/AssetDetailSidebarSlots.vue:87-100`; `D/components/slots/AssetSlotListItem.vue:95-145`). “Make main file” sends old file/new asset and is refused because ownership must match (`B/Domain/AssetFile/AssetFilePositionFacade.php:64-68`). Reordering is likewise rejected for foreign files (`B/Domain/AssetSlot/AssetSlotFacade.php:96-112`). “Remove file” sends the old file ID alone and can delete that old asset’s file (`D/composables/assetDetailSidebarSlotsActions.ts:46-55`; `B/Controller/Api/Adm/V1/ImageController.php:271-280`). “Duplicate” sends old file/new asset; for a valid target slot with matching type and licence, the backend can **move that file to the new asset** (`B/Domain/AssetFile/AssetFilePositionFacade.php:121-145,182-196`).

**Smallest fix:** Scope each list response and loader completion to the asset and request that started it; discard results after the sidebar changes or unmounts. Stale rows would never become actionable. **Size: M.**

## Claim 205 — `ImagePreview` retains an externally cleared picture

**Verdict: HOLDS for the video sidebar; PARTLY for the podcast forms.** In a video asset’s Image Preview tab, show a slot with a preview, then choose another slot whose preview is null. The card can keep showing the first picture. The selection replaces `videoFile` without remounting `ImagePreview`; its watcher ignores the new null value, and `src` still uses the old `imageFile` (`D/components/AssetDetailSidebarImagePreview.vue:44-53,105-123`; `A/components/ImagePreview.vue:45-67,115-123,164-170`). Choosing a slot does not invoke the save handler (`D/components/AssetDetailSidebarImagePreview.vue:71-95,119-123`), so this is a misleading display, not a wrong save.

In `PodcastEditForm.vue`, a less likely sequence exists: with no saved picture, click Save, select a picture while that request remains pending, then let its response restore the saved null model. The form adopts the whole server response (`domains/coreDam/podcast/composables/podcastActions.ts:114-139`), while both image cards remain mounted (`domains/coreDam/podcast/components/PodcastEditView.vue:90-95`; `PodcastEditForm.vue:200-212`). The card can then show the just-selected picture beside a null model. This needs a save request long enough to complete the picker interaction, so it is timing-dependent. `PodcastEpisodeEditForm.vue:145-149` has no comparable ordinary step: its save does not replace the episode model (`domains/coreDam/podcastEpisode/composables/podcastEpisodeActions.ts:121-136`), and leaving the edit view unmounts the form (`PodcastEpisodeEditView.vue:87-90`).

**Impact and smallest fix:** The picture can be wrong on screen, but Save sends the model value, not the cached picture. Clear `imageFile` when the watched model becomes null, and guard pending image fetches against later model changes. The placeholder would appear immediately when no picture is assigned. **Size: S.**

## Claim 206 — “Make main file” is offered before processing

**Verdict: HOLDS.** In an asset with at least two configured slots, upload a file to a non-main slot; while it is still unprocessed, open that slot’s actions and click “Make main file.” The menu checks slot count, `main`, and permissions, but not processing status (`D/components/slots/AssetSlotListItem.vue:241-250`). It sends the file and asset IDs through `D/composables/assetDetailSidebarSlotsActions.ts:58-73` and `A/api/fileApi.ts:193-224`.

The backend accepts the request when the file belongs to that asset: its controller returns an OK response and the shared position facade sets the main file without a status check (`B/Controller/Api/Adm/V1/ImageController.php:167-178`; `B/Domain/AssetFile/AssetFilePositionFacade.php:64-77`). After success, the detail reads the asset whole if metadata is untouched, or copies the new main-file object if it is touched (`D/components/slots/AssetDetailSidebarSlots.vue:46-49`; `D/composables/assetDetailFileChange.ts:21-45`). The detail therefore shows the unprocessed file as main; an undescribed asset may show “file still being processed” and disable Save (`D/components/AssetDetailSidebarMetadata.vue:47-48,121-140`).

**Impact and smallest fix:** The main-file change is saved, even though processing is unfinished. Hide or disable this menu action unless the candidate file has an allowed completed status; keep the backend as the final validator if processing status must be an invariant. The option would become available after the slot list reports processing complete. **Size: S** for the UI; **M** with backend enforcement.

## Claim 207 — Old flags saved onto a new main file

**Verdict: HOLDS, including the earlier-snapshot comparison.** Open an asset with two files whose `singleUse`, `overrideInternal`, or `internal` flags differ. Type unsaved metadata in Info, go to Slots, click “Make main file” on the other file, return to Info, and click Save. The current step copies the new `mainFile` object into the held asset but leaves the three switch refs from the original read (`D/composables/assetDetailFileChange.ts:21-31,43-45`; `A/store/assetDetailStore.ts:118-129`). Info reads those refs (`A/components/AssetMetadata.vue:167-210`), and Save sends all three (`D/components/AssetDetailSidebarMetadata.vue:60-88`; `A/api/assetApi.ts:347-370`). Without typed metadata, the whole-read branch resets them from the new file, so that half is fixed.

The backend applies the three submitted values to **the asset’s current main file**, not to asset-level flags or the old file (`B/Domain/Asset/AssetMetadataBulkManager.php:25-38,77-110`). Its internal-rule evaluation may subsequently recompute `internal` when override is off (`:113-117`; `B/Domain/AssetFile/AssetFileInternalRuleEvaluator.php:15-37`). `singleUse` and `overrideInternal` can be overwritten directly.

The earlier snapshot did not emit a main-file-change event from Slots (`earlier D/components/slots/AssetDetailSidebarSlots.vue:23-45,89`). Thus its Info tab kept the old main file and switches after “Make main file,” regardless of typed metadata; Save still targeted the backend’s now-current main file. The claim that this step made nothing worse is supported, though the current code now displays the new file correctly when metadata is typed.

**Impact and smallest fix:** Save can persist unintended flags on the new main file. When copying a changed `mainFile` into a touched form, also set these three refs from that new file while leaving typed metadata intact. This visibly updates the switches at the same time as the file card. **Size: S.**

## Claim 208 — Three leftovers

**Verdict: PARTLY overall.**

- **(a) HOLDS.** `saving` is declared and written but never read (`D/components/AssetDetailSidebarImagePreview.vue:28,75,89`). There are no user steps that reach a defect from that ref alone; it has no visible effect. Remove it. **Cosmetic, S.**
- **(b) HOLDS.** Both `D/AssetDetailView.vue:32-34` and `D/AssetFileDetailView.vue:32-34` declare `mainRouteChanged` and never emit it. Their sidebar events are handled locally at `AssetDetailView.vue:235-236` and `AssetFileDetailView.vue:212-213`. There is no user-visible defect from the unused declarations. Remove them. **Cosmetic, S.**
- **(c) PARTLY.** Click “Make public,” confirm a valid slug, make the route private, then reopen “Make public.” The dialog calls `$touch()` but never `$reset()` (`R/AssetFileRouteMakePublicDialog.vue:47-50,81-108,125-130`), so a surviving instance remains dirty. **A valid generated slug shows no error on reopening**: Vuelidate exposes field errors only when dirty *and invalid* (`node_modules/@vuelidate/core/dist/index.mjs:307-327`). An error appears immediately only if the newly generated slug is invalid and that dialog instance survived the route refresh. Reset validation on opening or after a successful confirm; that would also keep the next invalid opening free of errors until interaction. **Low, S.**

| Claim | Verdict | Severity | One-line reason |
|---|---|---|---|
| 202 | HOLDS | Medium | Overlapping link answers can put the wrong slot’s URL on Download. |
| 203 | PARTLY | Medium | Existing main-file status stays stale, but other paths can replace the held file. |
| 204 | HOLDS | High | A late old list can be acted on in the next asset, including file removal or transfer. |
| 205 | HOLDS | Low | External null leaves a cached picture in the video card; podcast exposure is timing-dependent. |
| 206 | HOLDS | Medium | The UI offers the action and the backend accepts an unprocessed main file. |
| 207 | HOLDS | High | Save sends stale switches, which the backend applies to the new main file. |
| 208 | PARTLY | Low | Two unused declarations hold; a dirty public-route form does not always show errors. |