**In-scope findings**

1. **Medium — cross-host race:** [AssetDetailDialog.vue:49](/home/volar/projects/anzusystems/common-admin/src/domains/dam/assetDetail/components/AssetDetailDialog.vue:49), [AAssetListInner.vue:177](/home/volar/projects/anzusystems/common-admin/src/domains/dam/assetSelect/components/AAssetListInner.vue:177). When another host opens detail under a different key, the list’s watcher emits `close(null)`. The list starts a sidebar refresh whose direct `setAsset()` can later replace the newer host’s asset. That refresh also adds a DAM request outside the decided behavior.
2. **Low — documentation order:** [assetDetailStore.ts:59](/home/volar/projects/anzusystems/common-admin/src/domains/dam/assetDetail/store/assetDetailStore.ts:59), [changelog:161](/home/volar/projects/anzusystems/common-admin/doc/changelog/2.0.0.md:161). The changelog says the detail closes *after* the error message; the store closes it before the host reports the error.

**Findings outside OP4-L1**

3. **Medium — older:** [ImageDetailDialogMetadata.vue:142](/home/volar/projects/anzusystems/common-admin/src/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue:142). The single-image author selector disappears after editing the asset because closing detail clears the shared asset. The pre-step code also cleared it on close; OP4-L1 moves the clearing to open.
4. **Medium — older:** [ImageWidgetMultipleInner.vue:613](/home/volar/projects/anzusystems/common-admin/src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue:613). After saving two rows of one file with authors chosen in only one, both rows inherit the first row’s author flags; the other can retain an empty required Source.
5. **Low — older:** [ImageWidgetMultipleInner.vue:439](/home/volar/projects/anzusystems/common-admin/src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue:439). Unmounting a host with detail open leaves its queue key in the page store; an outstanding read can still populate it.

I found no further issue in FE-32, FE-40, FE-41, the changed tests, or the public interface. I did not run tests.