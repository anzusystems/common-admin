## OP5-D1 findings

1. **Medium — Double-click no longer opens another asset’s detail.** The first click opens the question; after “Leave anyway,” only that click resumes and selects the tile. The new test explicitly accepts this, but it changes the prior double-click action and conflicts with the changelog’s description. [assetListActions.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/list/composables/assetListActions.ts:323), [sidebarUnsaved.test.ts](/home/volar/projects/anzusystems/admin-dam/src/test/list/sidebarUnsaved.test.ts:351)

2. **Medium — A list refresh can make a pending answer act on a stale row.** If a list request replaces the rows while the question is open, “Leave anyway” uses the captured asset ID and index; that index can now highlight a different asset from the one fetched. [assetListActions.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/list/composables/assetListActions.ts:323)

3. **Low — Leaving the list page can strand a pending question.** Unmount disables navigation and abandons reads but does not resolve the waiting promise or clear the store’s question flag. [assetListActions.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/list/composables/assetListActions.ts:501)

## Findings outside the change

4. **Medium — Refreshing the list retains the old active index.** The new rows have no active tile, while later actions still use that index. [assetListStore.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/store/assetListStore.ts:48)

5. **Low — The table edit button does leave the list, confirming decision (b), but first starts a list detail read.** The destination page then resets the stores and reads the asset again. Only this button sends `leavesList`; row clicks and double-clicks remain guarded. [AssetTableRowItem.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/list/components/AssetTableRowItem.vue:154), [assetListActions.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/list/composables/assetListActions.ts:260)

Static review only; no tests were run.