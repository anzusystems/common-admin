# Review of the step 5 core design (Codex, gpt-6-sol, high, read-only), 2026-10-08

Reviewed: `navrh-jadro.md` as of 17:35. Line numbers are the reviewer's.

## WRONG

- **§4.3, K1 test inventory misses a caller.** `damUploadFinish` is proposed with four arguments, but
  `uploadStatusFallback.test.ts` still calls it with five (`uploadStatusFallback.test.ts:1165`, `:1178`). Those
  calls need updating at K1; they cannot remain green unchanged.
- **§4.3 misses an assertion that would become vacuous.** After that signature change, `uploadQueuesStore.test.ts`
  reads `call[3].file`; argument 3 would be the checksum, not the row. The test could pass while ceasing to check
  which file finished (`uploadQueuesStore.test.ts:475`).
- **B14 is a runtime difference, not just a type difference.** LIB rejects a `FileReader` result that is not an
  `ArrayBuffer`; DAM accepts and passes the result onward (LIB `uploadService.ts:68`, DAM `uploadService.ts:83`).
  The proposed shared reader adopts LIB's check for DAM without listing this difference for an owner decision.
- **A12's "only type" verdict does not cover direct DAM callers.** DAM's request function appends its `string`
  argument to `FormData`, and two current tests call `fileApi.uploadChunk` with `'bytes'` (`imageApi.ts:72`, `:80`,
  `fileApiDispatch.test.ts:24`). Production upload supplies a `File`, but the shim's callable behaviour is broader
  than the row states.
- **C3 is not identical for inherited queue names.** LIB's `Map` has no `toString` queue; DAM's `in` check finds
  the inherited member and returns it (LIB `uploadQueuesStore.ts:192`, DAM `uploadQueuesStore.ts:304`). §2.4
  notices this edge case, but C3 still marks today's getters "same".

## CHANGE

- **§2.4 rule 4 / §3.2 changes alert ordering without recording it.** The proposed `onClientFailure` calls
  `showError` before the core marks the row `Failed`. DAM currently writes `Failed` before showing the alert (DAM
  `uploadQueuesStore.ts:697`, `:702`). Resolve the message first, then mark the row failed before emitting the
  alert.

## GAP

- **§4.1 / Q1 puts wave 4 too late.** The approved plan makes component tests a prerequisite to step 5
  (`upload-plan.md:224`, `:339`), while the proposed order starts step 5 at K0 and defers wave 4 until component
  work. Put wave 4 before K0/K1; then run the K0 baseline tests.
- **B19 / PV5 has no behaviour-preserving interim option.** Pending the owner's decision, the design chooses DAM's
  timer shutdown for both stores and says a LIB test must reverse. LIB currently leaves one final scheduled report
  after success; DAM cancels it on finish (LIB `uploadService.ts:296`, DAM `uploadService.ts:287`, LIB
  `uploadServiceSequence.test.ts:136`). Add a timer-finish option with LIB as the default, or obtain the decision
  before K2.
- **C31 / §2.4 rule 14 does not scope PV7 across all removal paths.** `stopSettledRunsOnRemove` is specified only
  for `removeByIndex`, while core `clearQueue` also stops every live run. LIB's current `stopUpload` aborts only
  rows captured as `Uploading` before clearing (LIB `uploadQueuesStore.ts:478`, DAM `uploadQueuesStore.ts:781`).
  Preserve this path too until PV7 is decided, and test it.
- **§3.2's `onRowTracked` hook needs an explicit raw-identity contract.** DAM stores `toRaw(item)` in `handedOver`
  and slot lookup tests membership using `toRaw(item)` (DAM `uploadQueuesStore.ts:291`, `:188`). Require `toRaw` in
  the hook or pass raw rows from the core.
- **C1 / §2.4 leaves a public queue key unsupported.** `UploadQueueKey` is any string, and LIB's current `Map`
  accepts `__proto__`. The proposed ordinary object does not safely preserve that key. Use a null-prototype record
  or retain a container that accepts every string (`UploadQueue.ts:11`, LIB `uploadQueuesStore.ts:60`, DAM
  `uploadQueuesStore.ts:174`).

## RISK

- **R1 is conditional on browser progress events.** The code supports the risk, but the document cannot establish
  how often a real upload gets only one event per chunk. Keep it as a release check, not a predicted outcome.

## Answers

- **(a) Order:** the build/copy boundaries are sensible, but the order is not safe as written because wave 4
  belongs before K0/K1, not merely before component replacement.
- **(b) Q3:** keep the thin shims for this step. Seven DAM test files address those paths or mock them; retaining
  the paths preserves useful coverage during the move. Fix the identified test signatures and mock setup rather
  than treating "shim retained" as proof they pass.
- **(c) D4/R1:** broadly yes, for CMS and UGC after they receive the new LIB build. Resetting the timestamp for
  each chunk means a chunk with one progress event adds no speed sample. If the entire upload gets no sample, the
  timer reports no percentage. Once an earlier chunk has supplied a sample, later single-event chunks can still
  report updated percentages because `speedStack` persists.

Not run: tests, builds, linters. Browser progress-event cadence and the proposed tests' eventual results remain
unverified.
