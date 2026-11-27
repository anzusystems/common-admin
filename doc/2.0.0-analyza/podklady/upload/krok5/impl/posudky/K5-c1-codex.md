### K5 findings

1. **Low — cancelling a row can start the same empty file twice.** [uploadQueuesStore.ts](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:250) delegates to `core.stopItemUpload`. That path calls `processUpload` in both `removeByIndex` and `stopItemUpload` ([uploadQueueCore.ts](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/core/uploadQueueCore.ts:259)). An empty file remains `Waiting` while its hash loads, so both calls can start it. This duplicates hash work and failure writes; the empty file is not sent to the backend.

### Outside the K5 change

2. **Low — empty files could already be started repeatedly during batch addition.** The [pre-step store](/home/volar/projects/anzusystems/krok5-praca/snap/K5/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:247) calls `processUpload` for each added file while an empty file can remain `Waiting`. K5 adds the cancellation path above to this existing issue.

The patch changes no tests. The existing [removal test](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/__tests__/uploadQueuesStore.test.ts:463) does not distinguish `Stop` from the old `Failed` outcome, but is not vacuous. I found no other unregistered user-visible or backend change, signature or `Map` violation, or hook violation. Tests were not run.