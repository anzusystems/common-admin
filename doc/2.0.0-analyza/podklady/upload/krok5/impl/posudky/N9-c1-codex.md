**Patch findings: none.** The selected asset’s provider metadata reaches only the import queue row; the import request still sends only `id` and `externalProvider`. Both changed test assertions would fail against the snapshot’s `metadata: {}` mapping.

[AssetUpload.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/AssetUpload.vue:57) differs from the snapshot only by removal of the TODO comment.

**Outside the patch:** Slot uploads already pass asset type specific MIME and size limits to [FileUpload.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/shared/components/FileUpload.vue:236), which filters files. That qualifies the recorded decision that “anything” may go into a slot; the N9 patch does not change this behavior.

Review was read only; tests were not run.