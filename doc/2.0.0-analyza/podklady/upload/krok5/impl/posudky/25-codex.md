Change: bez nálezu. The dialog’s `Failed` condition matches the queue row’s default rule; other states keep the existing timer behavior. [Dialog](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebar.vue:79), [row](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue:192).

Tests: bez nálezu. The flipped assertion is now at line 348; the former lines 401–412 remain unchanged at 430–442 and reject a manually failed item because `refreshMayHelp` is false. The new retry case checks a second origin read. [Tests](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/__tests__/uploadQueueDialogSingle.test.ts:327). Tests were not run for this review.

Register: bez nálezu. It names admin-cms and admin-ugc as affected and says admin-dam does not use this dialog. [Register](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-komponenty.md:1569).

Outside the change: bez nálezu.