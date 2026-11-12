- **Manual merges:** No findings; the three merged files retain both sides’ changes.
- **Copied files versus LIB core:** No findings; the VZIAT/NOVY files match `lib-u`, and no copied file replaced a pre-I1 LIB change.
- **Exports:** No duplicate names or import cycle found in [lib.ts](/home/volar/projects/anzusystems/common-admin/src/lib.ts:1549).
- **Other:** A hosted queue passed to [UploadQueueEditable.vue](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/components/UploadQueueEditable.vue:171) without a `sidebar` slot gets the default sidebar. Its operations use the LIB store at [AssetQueueSelectedSidebar.vue](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue:44), so bulk edits can target the wrong queue.

Tests were not run, as requested.