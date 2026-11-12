# OP13-L4 — review (Claude, adversarial)

Scope: `krok5-praca/zaplaty/OP13-L4.diff` (26 files) against the snapshot `krok5-praca/snap/OP13-L4`; brief `zadanie-OP13-L4.md`, `PRAVIDLA.md`; rows B1 of `stare-nalezy.md` (61, 65, 88, 89, 22, 27, 37, second set point 5) and A1 of `stare-nalezy-1.md`; note `impl/OP13-L4.md`. `diff -rq` of the snapshot's `src` and the tree lists exactly the 25 patched files under `src/` (plus the changelog), so this covers OP13-L4 alone. Read-only: I ran no vitest, build or lint; the only file I wrote is this one.

Read whole: the patch; in the tree `uploadSettlement.ts`, `uploadSettle.ts`, `uploadSettlementTypes.ts`, `uploadQueueItemRefresh.ts` (and the snapshot's), `uploadQueueBindings.ts`, `uploadQueuesStore.ts`, `apiErrors.ts` (and the snapshot's `report`), `uploadMeter.ts`, `damUploadChunkSize.ts`, `uploadService.ts`, `uploadQueueCore.ts`, `UploadQueueDialogSingle.vue`. Read in part, where cited: `UploadQueueItemEditable.vue`, `UploadQueueDialogSingleSidebar.vue`, `UploadQueueDialog.vue`, `queuePresets.ts`, `uploadQueueCoreTypes.ts`, `damAssetApi.ts`, `useApiRequest.ts`, `publicExportsAdded.test.ts`; admin-dam `src/domains/coreDam/asset/store/uploadQueuesStore.ts:1-750`, `AssetQueueEditable.vue`, `AssetQueueItemEditable.vue:140-200`, `assetApi.ts`, `assetSlotApi.ts`, its locales and the tests named below.

Logs: `l4-ohyb-pred.log` (52 failed on the snapshot = 29 new + 23 pinned, matching the note; reasons spot-checked: the colour class, `hashes.made` 3, nothing logged), bends b1a to b7 and b1a/b1b over the old 61 cases (each as the note says), `vysledky/OP13-L4-testy.log` and `OP13-L4-lib-browser.json` (5 275 passed, no failure message, no retry), `OP13-L4-linty.log` (green). Every touched source is older than the 00:27:45 test run.

Baseline of the changelog: `beta` (the merge-base of `next`, `23c8fe53`; the admins depend on `1.47.0-beta.dev-…`) has `stillUploadingOrProcessing`, no `refreshFailed` (`git grep`), the old `speedStack` meter, no settlement.

"By reading" below means traced through the cited sources, not run.

Counts: High 0, Medium 1, Low 4.

## Findings

### 1. Medium — "by the row as the read left it" tells a row what a read found before something else settled it (regression of the earlier fix, beyond point 37)

Where: `src/domains/dam/uploadQueue/composables/uploadQueueItemRefresh.ts:34-45,62-67`. The snapshot (`snap/OP13-L4/src/domains/dam/uploadQueue/composables/uploadQueueItemRefresh.ts:44-54`) kept `statusBefore` and stayed silent when the row changed into Failed, Uploaded or Stop during the read, with the reason written out: "'Still uploading or processing' is not said then either: the read found the file as it was before what overtook it." The new rule drops that. Its own comment (`:63-66`) still says "nor one that ended … meanwhile, by this very read or by what overtook it", which the code no longer checks for a row that ended into Uploaded without its form, or into Failed with its refresh.

Scenario A, library (by reading; a narrow race): Refresh on a Processing row (offered after 20 s); the GET is on its way. The `duplicate` notification arrives: `notify` calls `settleKnownDuplicate` outside the read chain (`settlement/uploadSettlement.ts:672-674`); `becomeOriginals` reads the original, that read fails, the row becomes Failed with `refreshMayHelp` true (`settlement/uploadSettle.ts:488-511`). The refresh GET then answers as the asset was before the DAM marked the duplicate (`stored`): `readTargetNow` answers `pending` (`uploadSettlement.ts:611-613`), `refreshMayStillHelp(Failed)` is `refreshMayHelp` = true, and the user reads "Asset sa stále nahráva alebo spracováva serverom" beside a row that shows failed. Before: nothing.

Scenario B, admin-dam and any profile with `settleOn: 'event'` (by reading): Refresh on a Processing row; while the GET is on its way the processed notification settles the row at once (`uploadSettle.ts:385-401`): Uploaded, no form, bumped. The GET answers from before: `pending` gives "still uploading or being processed", a 502 gives "Stav položky sa nepodarilo načítať. Skúste to znova." `refreshMayStillHelp(Uploaded, no form)` is true. admin-dam hides the refresh button for 20 s whenever a row turns Uploaded without an error (`admin-dam/src/domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue:159-176`): this is "try again" without the button, which point 37 forbids. Before: nothing (the status changed into Uploaded). admin-dam's binding cannot prevent it: `refreshMayHelp` is asked only for a Failed row.

Library rows cannot reach B (their reads are serialized and their policy is `settleOn: 'read'`, `store/uploadQueuesStore.ts:186`). B is the common one: a user presses Refresh exactly when processing is slow, and that is when the processed notification lands.

Documentation: the note lists only B's `pending` half (`impl/OP13-L4.md:108-109`); changelog `:129` now narrows the earlier promise; no case covers either scenario (`uploadQueueItemRefresh.test.ts:304-364` has a row failed by its notification and a stopped one, both still silent under the new rule).

Fix: keep `const statusBefore = item?.status`; when the status changed during the read, say nothing if it changed into Uploaded or Stop (any key), or into Failed for `pendingT`; otherwise decide as now (`refreshMayStillHelp`). That is the old rule for `pending` and for those transitions, and point 37 for the rest: the press that itself fails a row for want of the original still says `duplicateOriginalUnread`, a row that went Uploading to Processing during the read is still told. All current expectations, in the library and in admin-dam's `queueRefresh.test.ts`, stay as they are (checked by reading). Cases: (A) a held refresh read, a duplicate notification whose original read fails, the read answers `stored`: nothing said; (B) a bound list (as `uploadRefreshCauses.test.ts:230-252`) whose row turns Uploaded without a form while `refresh` is pending, for `pending` and `error`: nothing said; a bend (no guard) per case. Correct the comment `:63-66`, changelog `:129` and the note.

### 2. Low — the new "Fixed" entries describe a "before" that never shipped, repeat the amended entries, and one leaves out reads that count

Where: `doc/changelog/2.0.0.md:242-245` beside `:54`, `:124`, `:125`, `:129`; note `impl/OP13-L4.md:36-37,47-50`.

- "Fixed" is relative to the previous release (`:124`: "where it left the item as it was without a word"). On `beta` there is no `refreshFailed`, no poll, no streak of reports, and another meter. Yet `:243` says the read-failed text is said "as before" and that a failed row "(one the server failed, or one that lost its refresh during the read, was told to try again)"; `:244` "Every press of its refresh said to try again, for good"; `:245` "where nothing of it was reported"; `:242` "the meter had no speed to report the end with". These are states of `next` within this release. `:243` and `:124` now describe the same refresh with two different "before"s.
- "One the server failed … was told to try again" was not reachable from the UI: a failed row offers Refresh only with `refreshMayHelp` (`uploadQueue/components/UploadQueueItemEditable.vue:193`, `UploadQueueDialogSingleSidebar.vue:82-83`), and a Processing row the server failed during the read was silent before (it changed into Failed). The note repeats it (`:47-48`).
- `:244` and the note (`:36-37`) count the misses of an uploaded row without its form from "its refresh, and the reads its notifications ask for". Also from the reads "Save and apply" of the queue dialog makes for every such row (`UploadQueueDialog.vue:157-160` calls `refreshAsset`). By reading: when that read is the third miss, the row fails during the press and is left out of what is handed over (`:187`), with no word at that press.
- `:54` (the migration section, for an app with a queue of its own): "a timeout, a 401 or a 403, which it [the logger] drops" — `report` drops them before the logger (`api/utils/apiErrors.ts:131-135`); the `readers.failureReported` such a profile needs for this is named only in `:245`.

Fix: fold the behaviour into the entries that brought it (`:54` with the hook, `:124`, `:125`, `:129`) and drop `:242-245`, or keep them without their "before" clauses. Keep `:246` (A1 is a released behaviour: `beta`'s `UploadQueueDialogSingle.vue:346` has the green "done"). Add "Save and apply" to the reads that count, in the changelog and in the note.

### 3. Low — `giveUpOnMissing` lost its doc; the block left above `awaitsMetadata` is stale

Where: `src/domains/dam/uploadQueue/settlement/uploadSettle.ts:656-670`. The new block went in between the JSDoc of `giveUpOnMissing` and the function: `awaitsMetadata` has two JSDoc blocks in a row, `giveUpOnMissing` (`:670`) none. The orphan says "The asset of a tracked row … a row still processing fails, a row the client gave up on is only left alone"; since this step `countMissOfLeft` (`uploadSettlement.ts:177`) calls it for untracked rows, and it fails an uploaded row awaiting its metadata with `messages.assetGone`.
Fix: move the old block onto `giveUpOnMissing` and add the uploaded case.

### 4. Low — `apiErrorIsReported` is a new public export with no line in "Added → Exports" and no pin

Where: `src/lib.ts:604,1405`; changelog `:72` lists `apiErrorStatus`, not it; `src/test/publicExportsAdded.test.ts:19,82-97` pins `apiErrorStatus`, not it. The note tells admin-dam to import it (`impl/OP13-L4.md:99`): an export dropped later would show only there.
Fix: add it to `:72`, and a case: true for a 502 `AnzuApiResponseCodeError`, false for a 401, a 403, a timeout, and for anything while the logger is `null`.

### 5. Low — the note's list for admin-dam is not what its code will do

Where: `impl/OP13-L4.md:94-102`.
- "pri originále `originalUnread`": admin-dam never gets it. Its policies are all `markDuplicate` (`admin-dam/src/domains/coreDam/asset/store/uploadQueuesStore.ts:101-112`); only `becomeOriginals` answers it (`uploadSettle.ts:466-514`).
- The tests to change are named by one example; the 404 case of `queueRefresh.test.ts:492-505` (`it.each([404, 500, 503])`, expects `refreshFailed`) breaks as well.
- "`readers.failureReported: apiErrorIsReported` … stačí to": not for `readSlotFiles` (below).
- "pripnuté testy toho upraviť" (the uploaded row that now fails): no admin-dam test pins it; `assetDeleted` appears only with slot rows and processing rows (`olderFixesQueueReports.test.ts:118,128`, `notificationFallback.test.ts:681,765`, `queueRefresh.test.ts:553,630`, `slotUploadWithoutSocket.test.ts:402`).
Fix: replace it with the list at the end.

## Confirmed (by reading, and from the logs where said)

- 1 (61): the finish assertion comes first and can fail: a's chunk is answered after the removal (`uploadQueuesStore.test.ts:475-479`), and with `stopRow` dropped (b1a) a finishes. "Two at once" pins `['b.jpg', 'c.jpg']` and the row that finished; the old case stays green under b1b, the new one goes red (logs).
- 2 (65): the handle is set before the first await (`uploadQueueCore.ts:194-197`) and deleted on every way out (`:200,206,242,284`); only `processUpload` starts rows. The guard holds no row back for good (a `loadHash` that never answers held it before as well).
- 3 (88): with `sendingOver`, `speed()` ends at the last point, not at the clock (`uploadMeter.ts:74`), so the fallback is used only after the curve restarted; `stop()` clears the timer, so no 100 % after a stop. No UI shows the speed (percent and time left only: `UploadQueueItemEditable.vue:165,293`), and the final 0 feeds no chunk size.
- 4 (89): `changed` compares with the run's own `lastChunkSize`, the size its chunk was read with (`uploadService.ts:133-137,176-181`); parallel runs share only the module value.
- 22: the three texts in sk, en, cs exactly as the brief gives them.
- 27: `onRowFinal` on a row that was final already is harmless (`recalculateQueueCounts` counts by status, `uploadQueueCore.ts:151-158`). A slow DAM is not counted: only a 404 becomes `null` (`uploadQueuesStore.ts:152`). A row failed so comes back if a later read of a notification finds the asset processed (`settleProcessed` revives a failed row, `uploadSettle.ts:336-348`).
- 6: `report` behaves as before; the library's single reader throws what `useApiRequest` reported (`useApiRequest.ts:164-166`), the list reader now too (`uploadQueuesStore.ts:175`); `told` only where `report` was true; `read.told` survives `retryNamed` (`uploadSettlement.ts:489`). A try of a named read after a quiet failure may now report once no streak runs: intended.
- 7: `text-error` is the dialog's error colour (`UploadQueueItemErrorOverlay.vue:24`, `UploadQueueDialogSingle.vue:291`).
- API: no compile break. The profile members are optional; admin-dam passes `UploadRefreshOutcome` through (`uploadQueuesStore.ts:698-702`) and the library maps it with a `Partial<Record>`; no switch over it in admin-dam, admin-cms or admin-ugc (grep); `createUploadQueueItemRefresh` is not exported and `UploadQueueListBinding` already had `refreshMayHelp`; nothing outside the library reads `updateChunkSize`'s answer.
- Tests: 29 new and 23 pinned runs red on the snapshot for the reason they name, 3 green guards, every bend red; no case found that cannot fail.

## Outside the step

- Library: a tracked row given up for a missing asset fails with "Neznáma chyba" (`uploadQueuesStore.ts:207`), after refresh toasts saying "Asset už neexistuje." and beside an uploaded row failed with that very text (the note says so). The owner's call; one line if wanted (`assetMissing: () => commonT('common.damImage.queueItem.assetGone')`).
- admin-dam (older than this step): `readSlotFiles` turns `report` off itself for rows whose 404 was written down (`admin-dam/…/store/uploadQueuesStore.ts:224-227`). A 502 it made quiet reaches the settlement as a mapped `AnzuApiAxiosError` and counts as written (with the default today, and with `apiErrorIsReported`): the streak starts with nothing written down, point 6's defect in its slot reads.

## What admin-dam must do

1. Compile: nothing (optional members; a wider union it only passes on).
2. Tests, once it takes this library:
   - `src/test/queue/queueRefresh.test.ts:492-505`: the 404 case now gets `common.damImage.queueItem.assetGone` (its `readAsset` turns a 404 into `null`, `uploadQueuesStore.ts:118-126`, so the refresh answers `missing`); split it from 500 and 503.
   - `queueRefresh.test.ts:616-636`: `[[REFRESH_FAILED]]` becomes `[[ASSET_GONE]]`.
   - Unaffected by reading: `notificationFallback.test.ts:859-878` (500 stays `error`), `queueRefresh.test.ts:427-447,450-488,535-614` (with `refreshMayHelp: () => false` a failed row stays silent; so do a marked duplicate and a stopped row).
3. Profile (`uploadQueuesStore.ts:246-278`):
   - `messages.assetGone: () => translate('common.damImage.queueItem.assetGone')`. Its i18n carries the library's `common` (`src/locales/sk.ts:38`, `en.ts:38`), so no key of its own. Without it, an uploaded row without its form whose asset is gone fails with `system.uploadErrors.fileMissing` right after toasts saying "Asset už neexistuje.".
   - `readers.failureReported`: `apiErrorIsReported` is right for `readAsset` and `fetchWaitingAssets` (mapped errors through `useApiRequest`; the plain `Error` for a body without a list rightly counts as not written), not for `readSlotFiles` (`:221-237`). Give it a hook that knows its quiet calls, e.g. a `WeakSet` of the errors a call with `report: false` threw: `failureReported: (e) => !quietlyThrown.has(e) && apiErrorIsReported(e)`.
4. What it gets with no change of its own: an uploaded row without its form (settled by its processed event) whose asset is missing from three reads fails with that text instead of staying uploaded with `metadataFailed`; its binding's `refreshMayHelp: () => false` (`AssetQueueEditable.vue:39`) is now asked for failed rows, which then hear nothing after a refresh, as its rows offer none (`AssetQueueItemEditable.vue:179-181`); `originalUnread` never comes.
5. Finding 1 B is its case, and its binding cannot fix it: after the library fix, a case in `queueRefresh.test.ts` (a processed notification while the refresh read is held: nothing said for `pending` and for a 502).
6. Optional: the text case `queueRefresh.test.ts:520-532` could cover the two new keys.

## Verified and inferred

Verified by reading, with the places cited: everything under "Confirmed", the code paths of findings 1 to 5, the texts, the exports and the consumers' uses. Verified from the logs: the red runs on the snapshot (52), the bends, the full check (5 275 green, no retry). Inferred, not run: scenarios A and B of finding 1, the admin-dam test breakages in "What admin-dam must do", the "Save and apply" consequence in finding 2, the slot-read streak in admin-dam.
