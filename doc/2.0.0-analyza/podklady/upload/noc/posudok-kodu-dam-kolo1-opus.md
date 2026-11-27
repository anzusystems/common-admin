# admin-dam, uncommitted changes A-D and the new tests - adversarial review (Opus, round 1)

Read-only, nothing was run. Reviewed at `next` / `ba8a66ec`: the diff of the 10 modified files,
`distributionListPoll.ts`, the 5 test files of A-D, `fakeDam.ts`, 13 of the 17 characterization files in full and
3 in part. Library behaviour is from the installed build (`dist/` = `node_modules/@anzusystems/common-admin/dist`,
sources out of its source maps), Vuetify 4.2.1 and Vue 3.5.43 from `node_modules`, the server from
`core-dam-bundle` 1.52.0. Paths are relative to `admin-dam/src/`; `.../distribution/` stands for
`domains/coreDam/asset/components/detail/components/distribution/`. I read the Codex round-1 review
(`review-dam-r1-codex.txt`) after my own pass, so as not to repeat it.

**1 BUG (low; Codex has it too), 2 TEST (new), 5 PROPOSAL.** Codex BUG 2-5 and TEST 1 I do not confirm as bugs,
see the end. C and D held on every path the brief lists.

## BUG
### B1 (low) - a poll answer older than a notification puts the old status back (= Codex BUG 1, confirmed)
`domains/coreDam/asset/composables/distributionListPoll.ts:79-80` replaces the whole list with what the read
returned; notifications write single rows into the same list meanwhile
(`domains/coreDam/asset/store/distributionListStore.ts:50-71`). The notes: "a read in flight is let finish".
What the earlier report leaves out:
- It is widest for the events that need no request. `dist-1` is `waiting`, the poll's request is out, the row
  becomes `distributing` and the notification sets it at once (store `:57`); the poll's answer, read before the
  change, lands after it and the row steps back until the next read, 15 to 60 s later.
- For `distributed` / `failed` the list answer must be slower than the notification plus its
  `GET distribution/{id}`. Then the row is `distributing` again, its `extId` is gone (no YouTube links,
  `.../distribution/DistributionListItemYoutube.vue:74-91`), `underWay` flips back, the age restarts (`:95`) and
  the read 15 s later repairs it.
- Size: one request's flight time per status change, self-repairing. It is the one place where C changes what
  the untouched WebSocket handling leaves on the screen.
- Fix: count writes to the list (a `sync`, `deep` watcher on `distributionListStore.list` bumping a number); in
  `readNow` take the number before `read()` and skip `setList` if it moved, leaving the `finally` to schedule.
  Case to add: a notification during a held read, release, the row keeps the notification's status.

## TEST
### T1 - cannot fail for the reason in its name
`test/queue/notificationSettlesQueue.test.ts:152-178`, "does not put the row back to processing when it comes
before the answer to the finish request". The file runs with `uploadStatusFallback = true` (`:60`), the server
holds a processed asset (`:162`), and the two assertions come after 30 minutes (`:173-177`). Without the guard
(`domains/coreDam/asset/api/fileApi.ts:197`) the finish answer writes `Processing` over `Uploaded` and arms the
poll (`:198-199`); the poll reads the asset at +10 s, finds it processed and settles the row again: `uploaded`,
no error, green. `dam-krok0.md` 2.4 counts this case as one of the two that carry the guard through the
refactor; only `test/fallback/fallbackReadOutcomes.test.ts:232-250` does. The older
`test/fallback/notificationFallback.test.ts:70-89` pins it properly (`fetchAsset` not called), but at the
`fileApi` seam that krok 2 moves.

Fix: assert before any poll can run, and that none ran. After `store.processUpload(GLOBAL)`:
`await vi.advanceTimersByTimeAsync(0); expect(row.status).toBe('uploaded'); const reads = server.assetReads('asset-1')`,
then `await vi.advanceTimersByTimeAsync(A_LONG_TIME); expect(server.assetReads('asset-1')).toBe(reads)`.

### T2 - "nothing more is sent after a stop" holds whatever the stop does
`test/support/fakeDam.ts:61-73` never looks at `config.signal`: an aborted request does not reject (axios rejects
with `ERR_CANCELED`), it goes on waiting for its handler. In `test/queue/queueOperations.test.ts` every chunk is
answered with a promise that never resolves (`:82-86`), so the upload loops hang to the end of the case, and
these hold with `stopped` never set and the stop handle never called:
- `:126-127` "no further chunk, no finish, and the third file never starts";
- `:222-225` "its upload is not taken up again: no second chunk of its file, no finish";
- `:229-238` "a row that was only waiting ... is then never started" - both places stay taken for the 30 minutes.

What they say is pinned on one route only, a stop during a chunk that then fails
(`test/queue/uploadFailures.test.ts:249-275`). A stop during a start or a chunk that is then answered - the checks
at `domains/coreDam/shared/services/upload/uploadService.ts:242,267,274`, the reason `uploadStopHandles` exists
(`domains/coreDam/asset/store/uploadQueuesStore.ts:57-58`) - is covered only by
`test/upload/uploadStop.test.ts:167,235,251`, which mocks `fileApi` and `axios`: the cases a refactor of the
upload is most likely to drop or rewrite.

Fix: in `dispatch`, reject with `new AxiosError('canceled', 'ERR_CANCELED')` when `config.signal` is or becomes
aborted. Add cases where the chunk handler stops the row (once `stopItemUpload`, once `stopUpload`) and then
answers 201, and one where the start handler does: no further chunk, no finish. In `:229-238` answer the chunk
of `rows[0]` after the removal, so that a place really frees.

Same blind spot, no wrong result: `test/distribution/distributionListPoll.test.ts:426-441, 554-591` only ever see
the aborted read answer late; the path the browser takes (it rejects at once) is not run.

## PROPOSAL
1. `domains/coreDam/asset/composables/distributionListPoll.ts:81-83`: stop or stretch the step after a few failed reads in a row - a tab left open on a list answering 403/404/5xx asks every 15-60 s for good, each failure written to the log (`dist/domains/api/utils/apiErrors.js:27-36`).
2. Abort on unmount what still outlives its component: the tab's own read (`.../distribution/AssetDetailSidebarDistribution.vue:66-76`; its late answer writes the previous asset's rows into the next tab and turns that tab's loader off) and the YouTube re-check (`.../distribution/DistributionNewDialogYoutube.vue:199`).
3. `AssetQueueSelectedSidebar.vue:183,199,238,254`, `AssetCustomMetadataFormMassOperations.vue:73,89`: every field gets the same two names, so a list of buttons reads "Fill empty / Replace in all assets" N times - add the field's label to the name.
4. `test/upload/uploadRequests.test.ts:78,109,129,157`: `.rejects.toBeUndefined()` pins that the type APIs reject with nothing (`domains/coreDam/asset/api/imageApi.ts:59,104,129`); assert the rejection only, or 16 cases go red on the first move to the library's helpers.
5. `test/distribution/distributionListPoll.test.ts:348,371,411,412,440,451`: `vi.getTimerCount()` and "exactly one `visibilitychange` listener" count Vuetify's and the library's as well; the two paths with no case are worth more - document hidden at mount, unmount during the tab's own read.

## Checked and found sound
C (`distributionListPoll.ts`; a bare `:n` is a line of it):
- Timers. Every way into "should be polling" ends in `schedule()` or `readNow()`, every way out clears the timer.
  Walked: mount; the `underWay` watcher in both directions, during a poll read and during an own read; own read
  start and end (nested, failed, after unmount); poll read end (applied, failed, aborted, overtaken by a later
  one); hidden and visible in each of those; unmount. No state keeps rows under way without a timer, none starts
  a second read (`:60`, `reading`), none schedules after unmount (`:60`, `mounted`).
- Unmount during a poll read: aborted (`:140`), answer not applied (`:80`), nothing rescheduled (`:84`). The tab
  does unmount when it should: no `KeepAlive` over views (`layouts/AppLayoutDrawer.vue:86` wraps the action bar
  only), a closed dialog drops its content (`node_modules/vuetify/lib/composables/lazy.js`, no `eager`).
- Asset change: the sidebar is remounted in all three hosts (`AssetDetailDialog.vue:286` key,
  `AssetDetailView.vue:136-144` and `AssetFileDetailView.vue:129-137` loader), so no poll reads for a changed
  prop. Only the tab's own read can cross assets, as before (PROPOSAL 2).
- Manual re-read against a poll read: `duringOwnRead` aborts first (`:108`); the helper cancels on the wire and
  skips the pagination write of an aborted call (`dist/domains/api/composables/useApiFetchList.js:21`,
  `request.js:36`); an abort is not logged. The real paginator emits `change` a tick after the page changed (a
  watcher, not the click); neither a timer nor an answer can run in that tick.
- The poll's write of `pagination` does not make the paginator emit (it watches `page` and `rowsPerPage` by
  value). `filterData` is the tab's own (`domains/coreDam/asset/filter/DistributionFilter.ts:28`): the YouTube
  dialog's filter cannot reach the poll's request.
- `DistributionManage` binds an `AListEditor` to the same list: with `disable-unsaved`, no `validate` and no
  section label a replaced row is neither marked nor guarded; an open delete question keeps its target by key.
- Hidden at mount, a failed read, the three statuses (the server's `NOT_FINISHED_MAP`), the rhythm: as described.

D (`.../distribution/DistributionNewDialogYoutube.vue:187-208, 282-293`): one request at a time, none unless the
store says `waiting_for_login`, none while hidden; `focus` is heard on `window` only; both listeners go on
unmount; an answer after close finds no auth entry and writes nothing; a notification that came first is kept.
The endpoint only looks for a stored token (`YoutubeAuthenticator.php:39-42`); `auth-url` is never asked again.

A: keys exist in `sk` and `en` (`locales/*/system.json:13`, `locales/*/coreDam/asset.json:228,230`, the library's
`common.button.*`), each label is its tooltip's text. Esc reaches `onCancel` through `VOverlay`'s `keydown` emit
with focus inside or outside the dialog (`vuetify/lib/components/VOverlay/VOverlay.js:279-295`); the layer below
does not take the same key (`composables/stack.js`). `persistent` is the app's default
(`dist/plugins/commonVuetifyConfig.js:56-60`), so the Esc test does not pass on Vuetify's own behaviour.

B: `_unresolved` is set for "not returned" and for a failed request, and cleared by the next `add()` unless it was
a 403 (installed `defineCached`, source lines 107-142, 208-228). In the autocompletes a selected id reaches the
chip with `title = ''` (`AFormRemoteAutocompleteWithCached`, source lines 194-211), so `#id` shows there too.

Tests: in the A-D files every case I traced fails without its line (the in-flight flag, the second
`isWaitingForLogin`, the listener removal, `!current.signal.aborted`, `reading === current`, `persistent`). In the
characterization files, T1 and T2 apart, the cases assert rows and requests, not function names, and would go red
on a broken settle rule, a lost place in the queue, a wrong chunk or checksum, a repeated alert.

Earlier review, not confirmed as bugs:
- Codex BUG 2 (an old re-check sets `success` in a reopened dialog): the answer is about the server, not about
  the dialog, so it is true for the new one as well - unless a YouTube logout falls between the two answers, and
  the logout button is not offered while the dialog waits (`DistributionNewDialogYoutube.vue:483`). The surviving
  request: PROPOSAL 2.
- Codex BUG 3 (no read at once on return while a poll read is pending): "one request in flight" winning, pinned
  on purpose (`test/distribution/distributionListPoll.test.ts:303-323`). The pending request was sent while the
  window was visible (hidden clears the timer, `distributionListPoll.ts:123`): its answer is one flight old at most.
- Codex BUG 4 (rows of the previous asset start the poll when the first read fails): true and in the notes, but
  the effect is a repair - the poll reads the current asset's list and replaces the foreign rows 15 s later,
  where today they stay. What is left of it is PROPOSAL 1.
- Codex BUG 5 (two checks for one return): needs the answer to arrive between the `visibilitychange` and the
  `focus` of one return; one request per return is what was decided.
- Codex TEST 1 (chunks not proven sequential): true of `test/upload/uploadSequence.test.ts:79` alone, but pinned
  in `test/queue/queueOperations.test.ts:51-52, 87-91`: files of two chunks, held, one chunk each on the wire.

## Not verified
- Nothing was executed: the 736 green tests, `vue-tsc`, the linters and the 21 mutation checks are the author's.
- How often B1's window opens in practice; the order of `focus` and `visibilitychange` in real browsers.
- `externalProviderImportLimit.test.ts` (not opened); `queueAdd`, `assetUploadLimit`, `massEditSelection` (in part).
- The comment "core-dam looks at a distribution once in 30 to 90 s" (`distributionListPoll.ts:17`); the library as
  it will be released - I read today's installed build, not its source tree, which is in flux.
