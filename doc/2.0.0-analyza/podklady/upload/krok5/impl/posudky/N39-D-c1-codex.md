**Patch: no finding.** The four overlay buttons and both detail panels use the revised save path. The installed helper forwards `validateStatus`, sends the same JSON body, and reports failures with the specified 401/403/422 exclusions. The `validateStatus` test workaround does not appear to conceal the 201/204 behavior.

1. **Low — 401 test gap:** [bulkMetadata.test.ts](/home/volar/projects/anzusystems/admin-dam/src/test/asset/bulkMetadata.test.ts:178) checks only that a synthetic 401 is absent from the API error log. The fake client bypasses [damClient’s response interceptor](/home/volar/projects/anzusystems/admin-dam/src/shared/apiClients/damClient.ts:28), so this test cannot verify logout or what the user sees during it.

2. **Low — partial-save test limitation:** [bulkMetadata.test.ts](/home/volar/projects/anzusystems/admin-dam/src/test/asset/bulkMetadata.test.ts:137) checks which batches were *sent*. Its `saved()` helper reads the request log, which includes the failed second request; it does not establish which batch the backend committed.

**Outside this change**

3. **Medium — pre-existing dirty-state issue:** [AssetListSidebarMetadata.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/list/components/AssetListSidebarMetadata.vue:72) clears the metadata-touched flag before the save resolves. On failure, the right-panel Save button loses its edited-state styling although the edits remain. This line is unchanged by N39-D.

Review only; no tests were run.
