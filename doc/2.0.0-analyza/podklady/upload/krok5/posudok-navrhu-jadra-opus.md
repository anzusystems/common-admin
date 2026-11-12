# Review of the step 5 core design (Opus, read-only), 2026-10-08

Reviewed: `navrh-jadro.md`. Read-only, nothing run. Both trees were still changing while reading (17:30-17:56); line
numbers are as of 17:56. LIB = `common-admin/src/domains/dam`, DAM = `admin-dam/src`.

**Overall:** all 129 verdicts recounted (they match 0.1); every "same" row but C19 and all 11 owner rows read
against both sides; **no row misdescribes today's code**. Nearly every `path:line` the design cites is exact. The
problems are in the test bookkeeping of section 4 and in two claims of sections 0/6.

## WRONG

**W1. Sections 4.3 (K1 rows), 2.2 and the K1 guard list in 4.1: the bookkeeping for dropping `_endPointAsset`
(O15) is wrong in three ways.**
- a. Overlooked file. `LIB/uploadQueue/__tests__/uploadStatusFallback.test.ts:15` imports `damUploadFinish` and
  calls it with five positional arguments at `:1268` and `:1281`. It is not in 4.3 and not in the K1 guard list,
  so K1 "ends green" with this file broken.
- b. Silent hollowing. `LIB/uploadQueue/__tests__/uploadQueuesStore.test.ts:475` asserts
  `damUploadFinish.mock.calls.some((call) => call[3].file?.name === 'a.jpg')` is false. 4.3 names only `:27-47`.
  After the shift `call[3]` is the sha string, `.file` is undefined, and the assertion passes whatever was
  finished. This is exactly the case O15 warned of.
- c. "Four tests change only the argument order of finish" (2.2). Three of the four never read the finish
  arguments (`uploadQueueStartsEachFileOnce.test.ts:29`, `uploadStopBetweenChunks.test.ts:20`,
  `uploadStopWhileHashLoads.test.ts:16`). Only `uploadQueuesStore.test.ts:39,46,475` does.

**W2. Section 4.2 lists as new, or as "not pinned today", three tests that exist.**
- A10: `LIB/__tests__/damImageApiUploadRequests.test.ts:111-121`, six cases.
- K2 "every chunk carries the file type": `LIB/uploadQueue/__tests__/uploadServiceSequence.test.ts:76-82`.
- K6 "a settled row without a run removed": `DAM/test/queue/queueOperations.test.ts:533-548`.

**W3. Section 4.4, row `upload/uploadStop.test.ts`.**
- It has ten cases, not eleven.
- `:150` `expect(speeds.at(-1)).toBe(3_000)` pins the PV4 overcount: events at 1 000 and 3 000 bytes one second
  apart give 3 000, and 2 000 with the fix. The PV4 row of 4.4 names only `uploadSequence.test.ts:164,173`.

## CHANGE

**C1. PV5 interim**, against design lines 43, 99 and 1016 ("interim is always today's behaviour of each side").
Line 966 makes the interim "DAM shape for both", and 4.3 flips a pinned library test in K2. The library today
always writes the last report, 100 % and 0 s (`LIB/uploadQueue/composables/uploadService.ts:296`, pinned by
`uploadServiceSequence.test.ts:137-144`). No user sees it (percent and time are drawn only while uploading:
`LIB/assetDetail/components/AssetImage.vue:172-190`), but it is a convergence without a logged decision, in the
direction opposite to the design's own recommendation, so that test would flip twice. An interim option, as PV6
and PV7 have, avoids both.

**C2. Rule 8 of 2.4 ("`stopUpload` as today in DAM"), C37 "same".** The library's `stopUpload` aborts only rows
that were `Uploading` (`LIB/uploadQueue/store/uploadQueuesStore.ts:478-488`). A row a notification settled or
failed while its file is still being sent only gets `Stop`, and its run ends at the next chunk boundary. The DAM
shape calls every row's `stop()` (`DAM/…/uploadQueuesStore.ts:621-625`), so the chunk on the wire is aborted. Same
theme as PV7, but the interim option `stopSettledRunsOnRemove` covers `removeByIndex` only, and section 6 does not
list it. Minor.

No other unlisted change found: request shapes, order, row writes, alerts and counts hold on both sides under the
options as specified.

## GAP

**G1. D4 has no option, and the log says it keeps one.** `UseUploadOptions` in 2.3 has no such field, K2 does D4,
and 4.3 flips `uploadServiceRetry.test.ts:270-293` unconditionally. Either add the field (default: the library's,
DAM: per attempt) or correct the log.

**G2. Section 5.2 omits two logged findings assigned to step 5 that sit in parts 2-3.**
- Finding 21: a row failed by its notification while still sending keeps uploading and stops counting, so three
  files go at a limit of two. True on both sides. Pinned by `LIB/…/uploadNotificationEvents.test.ts:461-482` and
  `DAM/test/queue/queueOperations.test.ts:231-238`. C20 says "2 per queue, same" with no caveat.
- Finding 23: an upload under a named configuration runs on `default`. 2.3 hard-wires `default` into the default
  `requests` without raising the question.

**G3. Rule 14 of 2.4: the two temporary options have no test on the library side.** No library test asserts
today's C24 (stopped mid-send ends `Failed`) or C31 (a settled row's live run survives its removal). Name two K0
tests, or decide PV6 and PV7 before K4 so the options never exist.

**G4. B24 leaves open what a stop rejects with.** The document's default shape is DAM's, a bare string
(`DAM/…/uploadService.ts:24`). The library pins an `Error`
(`LIB/uploadQueue/__tests__/uploadStopWhileHashLoads.test.ts:51,62`). State "library shape" or list the file.

**G5. Section 4.1: the library is built and copied into DAM after K2 on targeted tests only.** `yarn build` is
`vite build` with no type check, and tests have their own project. W1a would travel unseen. Run the whole
`src/domains/dam` suite and both `vue-tsc` projects before the first copy.

**G6. Sections 4.3 and 4.4 do not know the wave-4 files that landed after 17:25.** They use the real stores over a
fake client, so "whole LT/DT" covers them, but none is classified.

**G7. Plan step 5.1 says the rest of `api/uploadApi.ts` goes; the design grows that file to about 215 lines and
empties `damImageApi.ts` instead.** Reasonable, but 2.7 flags only the DAM shims as a deviation.

## RISK

- R-1. Tests that assert right after `advanceTimersByTimeAsync(0)` (`DAM/test/upload/uploadSequence.test.ts:84-85`,
  `DAM/test/queue/queueOperations.test.ts:619-625`) depend on the number of microtask hops. The shared `uploadInit`
  and the import run's extra `await run.upload()` add some.
- R-2. The library's `readFile` rejects a result that is not `instanceof ArrayBuffer`; DAM's happy-dom stub answers
  `blob.arrayBuffer()` (`DAM/test/support/fakeDam.ts:359-366`). Same realm assumed, not verified.
- R-3. DAM inlines the library (`admin-dam/vitest.config.mts:56`), so `vi.mock('axios')` in `uploadStop.test.ts`
  does reach it. The design's argument holds only while the library calls `axios.isAxiosError` and `axios.isCancel`
  on the default export (true today).
- R-4. D4 moves the PV4 overcount from once per upload to once per chunk in the library, so speed reads higher and
  chunks grow (`LIB/uploadQueue/composables/damUploadChunkSize.ts:20-32`). Decide PV4 with D4, not after.
- R-5. A reactive object also swallows the key `hasOwnProperty`; a `Map` does not. Nobody uses it, but C1 is "same"
  only for ordinary keys.

## Answers

**(a) Order.** The structure is sound: library first, exports only added, a build and copy before each DAM step,
DAM's store last, and between steps the old stores run against the new service. Three changes: add
`uploadStatusFallback` to K1 and run full library checks before the first copy (G5); split K2 into option plumbing
with no test flips, and D4 as its own sub-step once R1 is confirmed (G1); take the K0 baseline only when the trees
stop moving. **Wave 4 belongs in K0**: the plan says "before step 5" twice, and parts 2-3 change exactly what those
components show (progress, stop and remove, the reactivity of the container). Hard gates: the library's wave 4
before K2, DAM's before K3.

**(b) Keep the shims.** The DAM options and `resolveUploadErrorMessage` must live in DAM anyway, so removing the
shims means moving about 115 lines and retargeting seven test files in the same step that swaps the code under
them; the tests would stop being an independent witness. `uploadStop.test.ts` is the clearest case. Remove later as
K7b, as a test-only step.

**(c) R1 is right in mechanism**, with four refinements:
1. Single-chunk uploads cannot change; only files larger than the current chunk size are affected.
2. The symptom in the library is a circle stuck at "0%", not a circle without a number
   (`LIB/assetDetail/components/AssetImage.vue:98-102`).
3. It needs every chunk to produce one axios event: a chunk gone within one browser progress tick. Inferred from
   the spec, not measured.
4. The likelier visible effect is numeric (R-4), and the proposed manual check must use a multi-chunk file or it
   shows nothing.

## Not verified

Nothing was run, so whether the DAM tests survive K3 and K6 is from reading. XHR's event count for fast chunks,
older axios versions, the backend, real `imageChunkConfig` sizes. The trees changed during the review.
