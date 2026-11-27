# Review of the fixes in admin-dam (Opus, adversarial round, read-only), 2026-10-08

**BUG 1 · MISMATCH 1 · TEST 2 · PROPOSAL 4**

None of the fixes does a wrong thing to a row, a list, a loader, a timer or the start of the application.
The findings are about what gets written down (M1, B1) and about two cases of the YouTube dialog (T1, T2).
Roots: DAM = `/home/volar/projects/anzusystems/admin-dam`, LIB = `/home/volar/projects/anzusystems/common-admin`.

(Codex, gpt-6-sol, high, same prompt: **no findings**; it judged that the e2e wait can be met under the new
schedule and could not verify anything against a real backend.)

## MISMATCH

**M1 — in admin-dam `{ report }` decides only the console; what Sentry receives of the two polls is decided by
Sentry alone** (read in the installed packages; not run in a browser)
- Where: `DAM/src/main.ts:77` installs `Sentry.httpClientIntegration()` with its defaults, and nothing under `src/`
  calls `setApiErrorLogger`. Sentry 10.75.2: `@sentry/browser/…/integrations/httpclient.js:7-9` (every XHR answered
  500–599, any address), `:62-99`, `:191` (the message is the status code and nothing else). The only brake is the
  default Dedupe, `@sentry/core/…/integrations/dedupe.js:27-58`: an event equal in message and stack to the one
  captured just before it is dropped.
- Sequence: a DSN is set, a row waits, core-dam answers 5xx. The queue reads at 5, 20, 50, 110, 230 s and then
  every 300 s, one request per licence and per asset with a slot upload, for as long as the row stays. Each read is
  a Sentry event unless the event before it was the very same: anything captured in between (an error of the
  user's own click, a 502 after a 503) lets the next one through. The distributions tab does the same on its
  15…300 s ladder.
- HEAD: the fallback read a row four times and stopped (`HEAD:src/domains/coreDam/asset/api/fileApi.ts:74`), and
  there was no distribution poll. Owner decision 2, as built in DAM, changes `console.error` only.
- Fix, if decision 2 was meant for Sentry: `setApiErrorLogger` handing the reported failures to Sentry, and in
  `Sentry.init` a `beforeSend` that drops `auto.http.client.xhr` events of the reads the three readers (and the
  distribution poll after its first failure) make quietly. If it was not: one sentence in the notes that Dedupe is
  what bounds it.

Added by the orchestrator: admin-cms (`src/main.ts:118`) and admin-ugc (`src/main.ts:126`) install the same
`Sentry.httpClientIntegration()`, so this holds for all three applications.

## BUG

**B1 — a slot upload whose asset is gone is written down three times: "a 404 of the slot list answers `[]`" and
"a 404 once per row" do not meet** (traced; the settlement's side run in a scratch script against the build)
- Where: `DAM/src/domains/coreDam/asset/store/uploadQueuesStore.ts:134-141` turns the 404 into `[]` after
  `asset/api/assetSlotApi.ts:48-52` has let the helper log it. `LIB/…/settlement/uploadSettlement.ts:355` sets a
  row's `reported` only for the `missing` of the single-asset reader; the slot branch counts a miss and nothing
  else, and `:362` ends the streak because the request "answered".
- Sequence: a file is sent into a slot of asset X; X is deleted. Reads at 5, 10 and 16 s, each with `report: true`,
  each 404 logged, each answered `[]`; the row fails at the third, as intended.
- Effect: three "Api error" lines where the rule and `DAM/doc/changelog/3.0.0.md:37` say one (console only:
  Sentry's integration takes 5xx alone). No case sees it.
- Fix (DAM alone, about six lines): `readSlotFiles` remembers an asset whose slot list answered 404 and asks about
  it with `report: false` until a read answers.

## TEST

**T1 — `DAM/src/test/distribution/youtubeAuthorizationRecheck.test.ts:352-371` "no longer listens for the user
coming back": since the abort its request assertion cannot see a listener** (traced, not run)
- Before the fix a listener left behind sent `GET …/authorized` and `:365` counted it. Now that request carries the
  aborted `closed.signal`, and the fake refuses an aborted request before it records it
  (`src/test/support/fakeDam.ts:108`): `asked(AUTHORIZED)` stays 1 whatever the dialog does.
- Left are `:367-368`, `toHaveBeenCalledWith('focus' | 'visibilitychange', expect.any(Function))`: true of any
  function from any caller.
- Fix: count the attempts and compare the listener itself, as `distributionListPoll.test.ts:719-739` does.

**T2 — same file `:373-391`, the run "is answered all the same"** (traced, not run)
- `:388` is `null` because `onUnmounted` calls `resetAuth`; the late "signed in" is dropped with or without
  `!closed.signal.aborted`. Only `:385` can fail, and it fails alike in both runs; the guard is pinned by the next
  case (`:393-415`) alone.
- Fix: drop the second run here, or name it by what it asserts.

## PROPOSAL

1. Library: let `readers.slotFiles` answer `null` for an asset that is gone and latch `reported` as for
   `readers.asset`; DAM's memo of B1 then goes.
2. `src/test/asset/assetReads.test.ts` runs only the quiet twins; give `fetchAssetListByIdsReported` and
   `fetchAssetSlotFiles(id, { report: true })` the same cases, a 204 among them: there it is an empty list, and
   three in a row fail every waiting row by D7.
3. Hand `closed.signal` to the opening `checkAuthorized` too (`DistributionNewDialogYoutube.vue:175`): its late
   answer still writes the shared state after `resetAuth`.
4. One rule for both polls: the distributions poll hands every failed read to the logger, every 300 s at the top
   of its ladder.

## Checked and found sound

- **Distribution poll.** The write counter: a discarded answer still clears `failures` and schedules; a
  notification for an unlisted distribution or with the same status writes nothing. The ladder: 15, 30, 60, 120,
  240, 540, 840 s; reset by a success, a read of the tab, a change of "under way". No timer, read or listener
  survives unmount.
- **Distribution tab.** `closed.abort()` runs before the poll's unmount hook; the three guards; the helper does not
  write the pagination of an aborted call; a cancelled request is not logged. The loader is read by the tab and its
  child only; the sidebar is keyed by the asset. A poll's pagination write starts no read of the tab.
- **YouTube.** Signal, guard and order of the unmount hooks against the next dialog's mount; `recheckingAuthorized`
  is always put back.
- **Config.** `?.` / `??` (`EnvConfigService.ts:44-45`); `main.ts:47-50` hands the value on; the only reader is
  `normalizeDamNotificationOptions`.
- **Store.** `failedByServer`: nothing in `uploadService.ts` or `fileApi.ts` sets `Failed`, so a failed row at the
  `catch` was failed by the settlement. `stopUpload` on an emptied queue: `dropQueue` raises the generation, drops
  the poller and its listeners; a later row gets a new poller. `$dispose` stops the setup scope. `onRowFinal`,
  `refreshQueueItem`, `readAsset` with its latch, the bulk twins (same address).
- **Backend 1.52.0.** The slot list answers every slot, a missing asset is a 404 of the entity resolver,
  `IDS_LIMIT` 50, answers are 200 with a `data` list.
- **E2E.** The wait can be met: with the routed socket open the next read is at most 60 s away, without it 30 s,
  against a budget of 90 s and a test timeout of 10 min; no other spec waits on the old fallback.
- **Build.** `sourcesContent` of 13 source maps in the copied build is identical to the library source.
- **Tests.** Traced and able to fail for the named reason: the seven "written down" cases, the server-failed
  upload, the emptied queue, the disposed store, the slot 404 and 500, the left-out mass-edit row, the two refresh
  cases, the config cases, the six tab cases, the write-counter and ladder cases.

## Could not verify

- Nothing of either repository was run: no vitest, vue-tsc, lint, build or e2e, no browser, no backend.
- M1 in a browser; whether production sets a Sentry DSN; that every axios request has one and the same stack at
  `xhr.open` (what Dedupe compares).
- The 404 of the slot list on a live server; Playwright's routed socket counting as open (the e2e wait holds
  either way).
