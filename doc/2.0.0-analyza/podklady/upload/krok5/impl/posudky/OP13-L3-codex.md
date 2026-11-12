I agree with **M1**. Re-asking a missing chip can evict another visible name and cascade (`defineCached.ts:133-134,173-200`; `useCachedItem.ts:13-18`). Pinning visible IDs is sound if it is reference-counted, updated when IDs change, released on unmount, and respected by every prune path. Prune after release; allow the cache to exceed 1,000 while more than 1,000 IDs are pinned. A pinned shown name cannot be dropped, so replace the missing-name watcher with registration and an initial add/fetch when needed. The current eviction test must change (`damNameChipsDroppedFromCache.test.ts:53-66`).

**M2:** I agree, especially with the direct contradictions at `2.0.0.md:163,188`. The wording at `:136,179-180,183` also needs qualification for the new cases.

**L1–L3:** I agree with the races and fixes (`uploadQueuesStore.ts:358-401`; `AssetDetailSidebarMetadata.vue:65-77`; `UploadQueueDialogSingle.vue:194-205`). L2 does leave the brief’s pre-read save window uncovered.

**L4:** Plausible, but still a browser-dependent hypothesis; `assetSelectListActions.ts:175-188` equates a changed scroll offset with user scrolling. **L5:** Agreed; filter processing rows by licence (`uploadQueuesStore.ts:350-357`; `types/UploadQueue.ts:70`; `types/Asset.ts:78`).

**L6:** The first wording point is valid (`useCachedItem.ts:13-18`); “while a list is on its way” at `2.0.0.md:237` already includes a further page, so I would not flag that phrase.

I found no additional breaking public API change: `useCachedItem`’s new argument is optional (`useCachedItem.ts:8-11`), and the conflict button retains its selector and click behavior (`AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:79-84`). The file-input assertion at `AFileInputOnlyOneFileKey.test.ts:43-45` can pass with an untranslated key, though its locale checks at `:49-53` cover that gap.