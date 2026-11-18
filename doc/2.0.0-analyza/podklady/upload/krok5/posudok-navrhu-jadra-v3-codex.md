## BREAKS RULE

- **Z1 / B10:** The row considers cancellation together with `Stop`, but they are distinct paths. DAM’s current catch block retries a canceled chunk when the row is *not* `Stop`; the proposed common path rejects immediately. That changes the number of requests for a direct service caller, which O17 forbids. [DAM uploadService.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/shared/services/upload/uploadService.ts:175), [design §2.3](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:629).

- **Z2 / B13:** The row expressly says DAM currently sends four chunk requests with a missing `fileId`, while the proposed code sends none. Direct-call-only visibility does not exempt request changes. [DAM uploadService.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/shared/services/upload/uploadService.ts:139), [design §6.2](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:1516).

- **Z7 / B8–B9:** A DAM caller that sets `item.status = Stop` without calling `stop()` can currently send the next chunk. The added status checks prevent that request. The Z7 row names the caller but omits the request change. [DAM uploadService.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/shared/services/upload/uploadService.ts:152), [design §6.2](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:1521).

- **Z9 / C22:** With a raw row passed to `queueItemUploadStart` and its reactive counterpart removed, normalizing the stop-handle key makes `stop()` reachable where it is not today. That can abort the chunk and change subsequent requests, even though the observer is a direct store caller. [DAM uploadQueuesStore.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/store/uploadQueuesStore.ts:562), [DAM uploadService.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/shared/services/upload/uploadService.ts:293), [design §6.2](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:1523).

- **Z11 / C7:** Moving both counters into one library module can change the generated `row.key` after DAM resets its store module while the library module persists. `key` is row state, so the row’s own admitted difference fails O17; tests asserting only uniqueness do not make it invariant. [DAM uploadQueuesStore.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/store/uploadQueuesStore.ts:77), [queueAdd.test.ts](/home/volar/projects/anzusystems/admin-dam/src/test/queue/queueAdd.test.ts:28), [design §6.2](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:1525).

## WRONG

- **Check 2:** No additional findings. The specified `chunkResize`, `stopRuns`, failure-write order, `onRunDone`, default image-only requests, and ninth chunk-options argument agree with the inspected current paths, subject to the Z1 and Z9 rule breaks above.
- **Check 3:** No findings. The K1a changes leave existing signatures and module locations usable; the K1b call and mock search matches the six listed edits in three test files.

## GAP

- **K0 / C25, `stopRuns`:** K0 does not pin DAM’s `Uploaded`-while-run-fails branch. A test checking only that the row remains `Uploaded` would pass for both values; pin that DAM returns without recounting or starting another row, against LIB’s recount-and-process branch. [DAM uploadQueuesStore.ts](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/store/uploadQueuesStore.ts:687), [LIB uploadQueuesStore.ts](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:334), [design §4.2](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:1235).

**Checked:** Z1–Z11, the named options and request wrappers, K1 imports/mocks, and K0 cases against both source trees and the specified tests. **Could not verify:** whether the proposed implementation finishes green or whether the proposed Sentry mock reaches the library; no files were changed and no tests, builds, linters, git writes, or network calls were run.
