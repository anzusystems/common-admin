I inspected the `next` source trees and tests without changing files or running tests. I use the question from FE-45 as the reference behavior: when the detail is closed, `assetDetailStore.panelHoldsUnsavedMetadata` identifies the dirty panel; list clicks and arrows call `askToLeaveUnsaved()` before replacing its asset (`A/components/list/composables/assetListActions.ts:117-134,270-274,356-369,449-475`).

## FE-59 — Detail over an empty list

**Verdict: HOLDS.** After a list request returns zero rows, `AssetListView.vue:116-145` renders “No items found” and does not mount `AssetDetailDialog`. The queue pencil can still set `detail=true` and fetch an asset (`A/components/queue/AssetQueueItemEditable.vue:74-85,227-235`). Confirming “Create empty asset” can likewise put the created asset in the detail store and set `detail=true` (`A/components/AssetCreateButton.vue:62-69,122-128,48-59`). Neither action has a dialog to display until rows appear.

**Steps:** On an empty result list, upload a file and use its queue row’s Edit button once enabled, or open the main options menu and confirm Create empty asset. The detail remains absent; a later list refresh that returns rows mounts it with the stored open state. The detail’s unsaved question is also unmounted (`D/components/AssetDetailDialog.vue:160-169`). The separate panel question *is* mounted outside the row branch (`AssetListView.vue:146-150`), so “no question can be drawn” is too broad; that component is gated off while `detail=true`.

**Fix:** Moving the single `AssetDetailDialog` instance outside the row and loader branches is correct and small. It also makes an already requested detail visible while the list itself is loading. No broken path is evident from the code. **Existing test:** none for an empty list; `detailNotOfList.test.ts` exercises creation and queue details with a populated list.

## FE-60 — List keys under the full queue

**Verdict: HOLDS.** Full upload and mass-edit views disable list keys (`A/composables/assetFooterUpload.ts:49-56`; `A/composables/assetFooterSelected.ts:68-75`). The queue pencil disables them again and opens a queue detail (`A/components/queue/AssetQueueItemEditable.vue:74-85`). Closing that detail unconditionally enables them (`D/components/AssetDetailDialog.vue:52-55`). With `detail=false`, the “detail is not of the list” check no longer blocks arrows (`A/components/list/composables/assetListActions.ts:557-570`); the next-arrow path selects a neighbour and fetches it into the shared detail store (`:449-475`). The panel renders that store (`A/components/list/components/AssetListSidebarMetadata.vue:154-175`).

**Steps:** Select a tile, open the full upload or mass-edit queue, click an editable queue row’s pencil, close its detail, then press Right or Left with focus outside an input. The active tile behind the still-open queue can move and its asset replaces the panel’s asset.

**Fix:** Restoring the pre-open flag handles this sequence, but a snapshot can become stale if the full queue is closed while the detail is open. Safer is to derive the enabled state from whether either full queue is *currently* open. Apply the same rule to the queue-read error path, which also enables keys unconditionally (`AssetQueueItemEditable.vue:86-96`). Keep keys enabled after a queue detail closes when no full queue remains; `detailNotOfList.test.ts:283-291` covers that behavior. **Existing test:** `queueRowActions.test.ts:332-365` covers disabling on open and enabling after a failed read, but not closing over a full queue.

## FE-61 — Stale active index after reload

**Verdict: HOLDS.** First-page fetch calls `setList` (`A/components/list/composables/assetListActions.ts:149-161`). `setList` rebuilds every row with `active:false` without updating `activeItemIndex` (`A/store/assetListStore.ts:48-62`). A click at that remembered index returns before setting its row active (`:92-100`). Arrows choose neighbours from the remembered index (`assetListActions.ts:136-138,449-460`). Refresh, sort, and filter all call the first-page fetch (`AssetListView.vue:88-92,168-175`; `assetListActions.ts:238-260`). Reloading the list alone does not replace the panel’s asset.

**Steps:** Select tile 2, then refresh, sort, or filter so a new list arrives. No row is highlighted. Click the row now at position 2: its asset is read into the panel, but the row stays unhighlighted. Press an arrow: movement starts from the old position rather than the panel asset’s new position.

**Fix:** Reconcile selection when replacing the list. The proposed lookup by **panel asset** is unsafe: the panel can hold a newly created or queue-row asset while the active tile belongs to another asset (`A/components/list/components/AssetListSidebarMetadata.vue:60-67`; `detailNotOfList.test.ts:332-363`). Preserve the old active tile’s **ID** before `setList`, locate that ID in the new rows, and otherwise clear the active index. This keeps the panel’s existing contents until the user selects something. **Existing test:** `detailNotOfList.test.ts:352-375` covers the stale-position distinction, but does not assert restored highlighting.

## FE-62 — Table edit button

**Verdict: PARTLY.** The duplicate-read path is proved; a visible flash depends on rendering and request timing. The button is a router link (`common-admin/src/domains/ui/buttons/table/components/ATableEditButton.vue:46-59`), while its click also emits `showDetail` (`A/components/list/components/AssetTableRowItem.vue:56-62,154-161`). That handler opens the list detail and starts a GET (`A/components/list/composables/assetListActions.ts:270-290`). Navigation then mounts the standalone page, which resets the stores and starts its own GET (`D/AssetDetailView.vue:74-104,115-130`). The first request may be abandoned as a store update, but it has already been sent.

**Steps:** Switch to table view and plain-click a row’s Edit button. The destination is `/assets/:id`; the list and standalone page each initiate a read. The temporary list loader is set in code, but its appearance on screen is not guaranteed.

**Fix:** For a plain click, let the link navigate without emitting `showDetail`. Preserve the existing modified-click behavior if it is intentional. That removes the extra list read and transient detail state. Making the button open a dialog instead requires removing its link behavior and changes the destination, deep-link interaction, and modified-click behavior. **Existing test:** `sidebarUnsaved.test.ts:829-838` covers the plain click and one list read, but its destination is a stub route (`:91-104`); it does not mount `AssetDetailView` or cover the second read. This fix is also needed before a P3 route guard can reliably protect that click: the current list handler opens the detail and raises its loader before navigation (`assetListActions.ts:275-280`), so `panelHoldsUnsavedMetadata` becomes false (`A/store/assetDetailStore.ts:61-64`).

## P1 — Queue-row pencil discards panel metadata

**Verdict: HOLDS.** The queue button calls `showDetail` directly (`A/components/queue/AssetQueueItemEditable.vue:227-235`). It has no FE-45 check before `showLoader`, `fetchAsset`, and `setAsset` (`:74-85`). `setAsset` clears the touched flag and replaces the asset in the **same** detail store used by the panel (`A/store/assetDetailStore.ts:118-129`; `A/components/list/components/AssetListSidebarMetadata.vue:37-52,169-175`).

**Steps:** Select a list asset, type metadata in the side panel, open the full upload or mass-edit queue, and click another editable row’s pencil. No question appears; the returned queue asset replaces the typed form.

**Fix:** Check `panelHoldsUnsavedMetadata` and await `askToLeaveUnsaved()` **before** changing view or starting the loader. FE-45’s store question function can be reused; its list-specific `readReplacesUnsavedOfPanel` shortcut cannot safely be used for this unconditional queue fetch. This adds a question only when the panel is dirty. **Existing test:** `queueRowActions.test.ts:332-350` covers the queue read without a dirty panel; none covers this loss.

## P2 — Create empty asset discards panel metadata

**Verdict: HOLDS, with the proposed interception point wrong.** Clicking the menu item only opens a creation form (`A/components/AssetCreateButton.vue:37-40,80-86`). **Confirming** sends the POST, then writes its response into the shared detail store (`:62-69,48-59`), where `setAsset` clears and replaces the dirty metadata (`A/store/assetDetailStore.ts:118-129`). No FE-45 check precedes that write.

**Steps:** Select an asset and type in the panel; choose Create empty asset, select a type, and click Create. The new asset’s detail takes over without the question.

**Fix:** Ask at the **Create confirmation**, before the POST. Asking on the menu item would interrupt users who merely inspect or cancel the form. The FE-45 `askToLeaveUnsaved()` function and page-mounted question can be reused after checking `panelHoldsUnsavedMetadata`; its list-position helper is irrelevant. **Existing test:** `detailNotOfList.test.ts:274-281` covers creating with no active tile, not dirty metadata.

## P3 — Leaving the page

**Verdict: PARTLY.** Actual navigation and browser unload are unguarded, but the logo on the asset list links back to the same asset-list route (`domains/system/components/MainWrapper.vue:35-51`), so that click alone supplies no route-leave steps. The options menu has links to other pages (`A/components/toolbar/AssetToolbarOptions.vue:89-103,115-120`); table Edit navigates to `/assets/:id` (`AssetTableRowItem.vue:154-161`); and confirming a licence change calls `window.location.reload()` after updating the user (`AssetToolbarExtSystemLicenceDialog.vue:124-145`). `AssetListView.vue:31-98` registers no leave or unload guard. A browser reload or tab close likewise has no panel-specific unload listener.

**Steps:** With typed, unsaved panel metadata and the detail closed, click Podcasts, Video Shows, Settings, or a table row’s plain Edit link; confirm a different licence; or reload/close the tab. The FE-45 question does not precede these exits. A route change unmounts the panel; it does **not** necessarily overwrite the detail store immediately (`assetListActions.ts:543-549`). The standalone asset page explicitly resets that same store (`D/AssetDetailView.vue:115-130`); reload destroys in-memory state. This distinguishes loss of the visible form from an immediate `setAsset` overwrite.

The two cited edit pages use `useUnsavedChangesGuard`, not a bare `onBeforeRouteLeave` (`PodcastEditView.vue:25-26`; `DistributionCategorySelectEditView.vue:32-33`). In common-admin source, that composable guards router leave and path-changing route updates (`domains/unsavedGuard/composables/useUnsavedChangesGuard.ts:180-195`) **and** registers `beforeunload` for reload/close (`:201-215`). The latter produces a browser-native prompt, not the app’s “Unsaved changes” dialog.

**Fix:** The smallest consistent list-page change is to use the existing `askToLeaveUnsaved()` and `AUnsavedConfirmDialog` for route leave while `panelHoldsUnsavedMetadata` is true, plus a `beforeunload` handler for reload/close. The question function **can** be reused for router navigation; it cannot draw an app dialog during browser unload. First make FE-62’s plain edit click navigation-only, so its pre-navigation loader cannot hide the dirty-panel condition. For licence change, ask **before** `updateCurrentUser`; after “Leave anyway,” allow its intentional reload without a second native prompt. A “Stay” answer must leave both the licence and panel metadata intact. A bare route-leave guard would miss reload and close. **Existing test:** `sidebarUnsaved.test.ts:829-838` currently asserts no question on the table Edit click; none of the cited list tests covers guarded route exit, licence reload, or browser unload.

## Adjacent finding

- **NEW — UNVERIFIED:** A failed queue-row detail read also unconditionally enables list keys (`A/components/queue/AssetQueueItemEditable.vue:86-96`), even if the full queue remains open. This follows the same hidden-list arrow path as FE-60; the cited queue test checks the flag after failure (`queueRowActions.test.ts:352-365`) without a full queue overlay.

| Claim | Verdict | One-line reason |
|---|---|---|
| FE-59 | HOLDS | Empty results unmount the detail despite queue/create actions setting it open. |
| FE-60 | HOLDS | Closing a queue detail enables keys while the full queue can remain open. |
| FE-61 | HOLDS | Replacing rows clears their highlights but retains the old active index. |
| FE-62 | PARTLY | Two reads are initiated; a visible flash is timing-dependent. |
| P1 | HOLDS | Queue Edit fetches into the dirty panel’s store without asking. |
| P2 | HOLDS | Create confirmation replaces that store without asking. |
| P3 | PARTLY | Real exits lack guards; the list-page logo does not leave the route. |