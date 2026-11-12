# Second review of the step 5 core design, version 2 (Opus, read-only), 2026-10-08

The stores, core and options hold the rule, but K1 does not end green as written and four smaller things need
fixing first. Read-only, nothing run. Shorthand as in the design (`L-us`, `D-st`, `LT/`, `DT/` …).

(Codex's second review is in the session scratchpad as `review-krok5-design-v2-codex.txt`; its stricter reading —
"observable changes in all six converged places" — is answered by the bar logged in `upload-postup.md`, O17.)

**Fix before implementation:** K1 is red as written (ORDER 1); two options have no pin that can fail (OPTION 1-2);
B10 and B23 each change something section 6 does not name (CONVERGED); two owner steps are scheduled before DAM
runs the shared code (ORDER 2-3).

## 1. UNFIXED
- Every WRONG / CHANGE / GAP item of both v1 reviews is taken up, and none is resolved against the production code.
- Still incomplete: v1 Opus W1 (K1 test bookkeeping). The row that replaced W1c is wrong for two of its three
  files: see ORDER 1.
- Logged finding 41 ("replace all" with nothing picked empties keywords and authors; LIB twin 34) lives in the
  three functions of 2.5 and is not in 5.2. Both sides behave alike and v2 keeps it; it is only unlisted.
- Stale: 5.1 S2 and 4.4 say DAM wave 4 lacks its bend proof. `dam-vlna4.md` section 4 now has it.

## 2. CONVERGED
- **B10 (changes DAM).** No request, row write or alert changes: the store ignores the failure of a `Stop` row
  (`D-st:681-684`) and has refilled the place already (`D-st:568`). Two things do change:
  - The rejection of a run stopped with a chunk on the wire. Today: `'upload stopped'` after the 1-9 s pause
    (`D-us:186-191`). After: the cancel error, at once. Existing tests assert only `rejects.toBeDefined()`
    (`DT/upload/uploadStop.test.ts:179,246,263`).
  - The `updateChunkSize` call after the cancelled attempt (`D-us:186`) goes: see B23.
- **B13.** Nothing. `fileId` is set or the start fails (`D-us:243-249`).
- **B20 (changes LIB).** Nothing through the store: `L-st:328` runs before any timer can. `useUpload` is not
  exported from `src/lib.ts`. See RISK 1.
- **B23 (changes LIB).** Attempts, pauses and the rejection value stay. **The reason given is contradicted by the
  code:** the next upload does not recalculate at once. It starts from the size the module holds
  (`damUploadChunkSize.ts:9`), a new row has no speed, and without a speed nothing is recalculated (`:16-18`). So
  dropping the call at `L-us:197` (and `D-us:186` under B10) can change the size and number of the first chunk
  requests of the next file. Either list it in section 6 as accepted, or keep the one `updateChunkSize` call at
  both places and drop only the re-read and the 1 ms.
- **C5.** Nothing. The unguarded calls run on an existing queue; no test asserts the throw.
- **C23.** Nothing. Every final state write is followed by a count already.

Converged without being named (nothing observable today): the rejection texts of B4 and B6 differ and nobody reads
them; an import row enters the core's `try`/`catch` and gets a registered, empty `stop`; a register keyed by
`toRaw` finds what today's misses (five cases hand `queueItemUploadStart` a raw row,
`DT/queue/slotNotifications.test.ts:688,707,731,756,807`). Nit, 7.6: a row in the pause, stopped by `stopUpload`,
does not send another attempt today.

## 3. OPTION
All 22 rows of 2.8: the LIB default and the DAM value are today's code. The misses are in the pins:
1. **`guard`: the Sentry half is pinned nowhere.** LIB reports `dam_upload_chunk_validation` and
   `dam_upload_chunk_400` (`L-ia:77,100,121,193`). No test names either. Add one LIB K0 test for both events.
2. **B22: the K0 test named for it cannot fail.** "Four 400s: `unknownError`, one alert" holds whichever way
   `messages` is set, because the DAM store overwrites the row's text (`D-st:691,698`). Pin the service instead.
3. **`stopRejection`: the K0 row does not say at which stop.** Name the points and leave the on-the-wire one out,
   or give B10 an option.
4. `guard: false` and `contentType` are first run in DAM's values at K3; the K2 list in 4.2 has neither. Two cases
   in K1.

Interactions: none found that gives a side, under its own set of values, a behaviour neither has.

## 4. ORDER
1. **K1 does not end green as written.** 4.3 lists `LT/uploadStopBetweenChunks.test.ts` and
   `uploadStopWhileHashLoads.test.ts` as "no change". Their rows have no `assetType` and pass today only because
   the image-only rule sits in the module they replace (`L-ua:17-20`). K1 moves the rule into the real service, so
   `uploadInit()` rejects: four of five cases red. Add `assetType: DamAssetType.Image` to both rows and list the
   edit, or leave the rule in `uploadApi.ts`.
2. **K2-D4 is "after K2" but lists DAM tests** that run DAM's own service until K3. Write "after K3 and a copy".
3. **PV7 is "after K5" but lists a DAM assertion** that can turn only once DAM's store is on the core (K6).
4. K0, K2, K3, K4, K5, K6 and both copies: nothing found, with the gates as written.

## 5. RISK
1. After K5 only the service stops the meter of a failed upload, and no LIB test fails an upload that has a
   callback. A missed cleanup in K2 leaves a timer per failed file, unseen. Add a K2 case.
2. The chunk-size effect of B10 and B23 is invisible to every test that fixes min = max, which is every DAM upload
   test read.
3. K0 is a snapshot of test trees that still move.

## Not verified
Nothing was run, so that the K3 and K6 suites pass is from reading. admin-cms and admin-ugc were not opened.
