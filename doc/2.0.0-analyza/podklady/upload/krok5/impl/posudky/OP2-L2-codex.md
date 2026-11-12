1. **Medium — FE-26:** [useImageMassOperations.ts:58](/home/volar/projects/anzusystems/common-admin/src/domains/dam/imageWidget/composables/useImageMassOperations.ts:58) treats a source containing only spaces as filled. For a row showing Source with no DAM authors, “fill empty” now leaves those spaces; the previous behavior filled it with author names. [saveImages](/home/volar/projects/anzusystems/common-admin/src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue:503) can then send the visually blank source to the CMS.

**Outside this change**

2. **High — FE-27 remains bypassable in admin-ugc:** Its [fullscreen dropzone](/home/volar/projects/petit/admin-ugc/src/pages/dam/asset/index.vue:64) remains active above the dialog and can add a file during “Save and apply”; the [apply handler](/home/volar/projects/anzusystems/common-admin/src/domains/dam/assetSelect/components/AAssetListInner.vue:215) then clears the queue.
3. **Low:** The disabled [dialog dropzone](/home/volar/projects/anzusystems/common-admin/src/domains/ui/file/components/AFileDropzone.vue:64) still highlights during dragging.
4. **Low:** [Mass author fill](/home/volar/projects/anzusystems/common-admin/src/domains/dam/imageWidget/composables/useImageMassOperations.ts:62) assigns the same author array to multiple rows, so an in-place edit could affect several rows.

No other findings in the reviewed changes, public props/emits/types, tests, or documentation. Tests were not run, and same-file reselection was not verified in a browser.