# DAM, krok 1 (items 2 and 3) and krok 3 - what was done

Written 2026-10-07 in `admin-dam` (`next`, `ba8a66ec`). Nothing was committed; the stash and the two unpushed
commits are as they were. No other repository was touched (this file apart). Paths are relative to `admin-dam/src/`.

```
$ yarn lint:tsc
(no output, exit code 0)

$ yarn test
 Test Files  54 passed (54)
      Tests  736 passed (736)
```

669 tests before, 67 new in 5 new files. On the 16 touched files `oxfmt --check`, `oxlint`, `eslint` and
`stylelint` (the `.vue` ones) are clean. The whole suite was run twice, not once: after the first green run I
rewrote the cases of `distributionListPoll.test.ts` so that they wait for a read instead of a delay (below), and
ran it again. **Not run:** `yarn ci`, `yarn lint`, a build, `generate:dts`, e2e.

None of the 17 characterization files of krok 0, nor `test/support/fakeDam.ts`, was changed; none of them pins
anything these changes alter.

Every new test was checked against the code without its change: the line under test was taken out or bent (a
temporary edit, put back; 21 such edits in all). 17 made a test fail at once; for the 4 that did not, all in the
poll, a test was added (three cases and the listener assertion in `distributionListPoll.test.ts`) and the edit
tried again.

---

## A. Accessible names and Esc (krok 1, DAM item 2)

Changed, attributes only:

| file | what |
|---|---|
| `domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue:387,404` | `aria-label` on refresh (`common.button.refresh`) and cancel (`common.button.cancel`) |
| `domains/coreDam/asset/components/queue/AssetQueueSelectedSidebar.vue:183,199,238,254` | `aria-label` on fill / replace of keywords and of authors (`coreDam.asset.massOperations.fillOneEmpty`, `.replaceOne`) |
| `domains/coreDam/shared/components/customMetadata/AssetCustomMetadataFormMassOperations.vue:73,89` | the same two on every custom field |
| `domains/coreDam/asset/components/footer/AssetFooterUploadButtonStop.vue:47,66` | `aria-label` on the stop button (`system.upload.stop`); `@keydown.esc="onCancel"` on the confirm dialog, as `UploadQueueButtonStop.vue:65` in the library |

No text was added or changed, in either language.

Tests:

- `test/a11y/iconButtonNames.test.ts` (6): the four files are parsed (`vue/compiler-sfc`; `@vue/compiler-dom`, which
  the library's test uses, is not a declared dependency of the app and `declaredDependencies.test.ts` would refuse
  it). All nine icon-only buttons are found; each has an `aria-label`; each label is `t('<key>')` with a key the
  app's real `sk` and `en` messages resolve to a non-empty text (through the app's own `i18n` instance: the
  library's `common.*` messages are precompiled, they cannot be read as strings); each label is the expression its
  own tooltip shows.
- `test/upload/uploadStopConfirm.test.ts` (4): the rendered button has the name; not uploading -> stops at once;
  uploading -> asks, confirm stops; Esc closes the question and stops nothing (Enter does not). Mounted with
  `VDialog` persistent, as the app has it - with Vuetify's default Esc would close the dialog by itself and the
  test would pass without the change.

Decided alone:

1. **Which key names a button: the one its tooltip uses.** For refresh and cancel that is the library's key. For
   fill / replace and stop the app's tooltip has the app's key, and I used that one, not the library's
   `common.damImage.asset.massOperations.*` / `common.damImage.upload.stop`, although the app resolves them. Reason:
   Slovak is identical in both, but the English differs for fill / replace ("Fill empty" / "Replace in all assets"
   in the app, "Fill empty field" / "Replace everywhere" in the library), so the library key would give a button
   whose name is not what its tooltip says. This is narrower than the brief ("the library's keys where the app can
   resolve them"); switching is one attribute per button, and the test's last case would then have to go. R10
   (English = library wording) arrives with the library components in krok 5, for the tooltip and the name at once.
2. The scan covers only these four files, not the app.

Left alone:

- The library's scanner run over the whole app (a throwaway script, not kept) finds **75** more unnamed icon-only
  buttons or clickable icons in 43 files (footer overlays, list items, toolbars, detail dialogs, …).
- `AssetFooterUploadButtonStop.vue:9,14` still declares `dialogMaxWidth`, which nothing reads (the dialog has a
  fixed `:width="500"`); the library dropped the prop.

---

## B. `#id` for an author or keyword the server does not return (R12, DAM item 3)

Changed:

- `domains/coreDam/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue`
- `domains/coreDam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue`
- `domains/coreDam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue`

In each: a computed `unresolved` (`!loaded && item._unresolved === true`; in the two chips with a `title` prop
also "no title handed in", as `ACachedChip.vue:67`); `displayTitle` answers `'#' + id` for it; the spinner is not
drawn for it; the chip (and the plain-text variant) gets the native `title` `common.model.cachedUnavailable`
("Záznam sa nepodarilo načítať"), the text `ACachedChip` puts in its tooltip. The latch (`watch(item)` copying the
first loaded item) is as it was: the components are to be replaced, so nothing else of C1 / AC1 was touched.

What it means on screen: the cache marks an id unresolved when the server answered without it **and** when the
request failed (`defineCached.ts:208-227`), so both now end in `#id` instead of an endless spinner. A later
`add()` of the same id asks again (unless it was a 403); the chip then spins and shows the name when it comes.
The author chip is also used outside the upload (author detail, licence detail, clean phrases): the same there.

Tests: `test/cached/cachedChipUnresolved.test.ts` (19) - the three real chips over the real caches
(`cachedKeywords.ts`, `cachedAuthors.ts`, the debounced fetch driven by the fake clock) and a fake server; only
`uploadQueuesStore` is replaced (the chips ask it for nothing without a `queueId`), so the file does not depend on
the store that krok 2 rewrites. Per chip: still loading -> spinner, no text; returned -> name, no spinner; not
returned -> `#id`, no spinner, the title; request failed -> `#id`; asked again and found -> spinner, then the
name. For the two chips with more props: `#id` as plain text; a handed-in title wins.

Decided alone:

1. The explaining `title` was added although the brief names only `#id`. The ids are UUIDs, and a chip reading
   `#0193…` says nothing by itself; the key exists in the library, no text was added. A native `title`, not a
   `VTooltip`: the author chip already carries its "reviewed" text that way. Taking it out is one attribute per
   template branch and one assertion (`explained()`).
2. A failed request shows `#id` too (not only "not returned"): that is what the cache's flag means, and what
   `ACachedChip` does.

Left alone: the other two effects of the latch (a chip keeps its first name when its `id` prop changes; it keeps
the name after the cache pruned the entry). The chip of an author conflict keeps its "+" on an unresolved author,
as it had it on a spinning one.

---

## C. Distribution statuses without the push server (krok 3, item 1)

New: `domains/coreDam/asset/composables/distributionListPoll.ts` (145 lines).

- `DISTRIBUTION_LIST_POLL` - the rhythm, the only place with the numbers: `early { until 30 s, every 15 s }`,
  `regular { until 5 min, every 30 s }`, `late { every 60 s }`; `distributionListPollDelay(age)` reads it.
- `DISTRIBUTION_STATUSES_UNDER_WAY` - `waiting`, `distributing`, `remote_processing`.
- `useDistributionListPoll(read)` - for the mounted tab. One timer. The age is counted from the moment a row
  under way appears in the store's list (mount, a read, a notification) or the tab finishes a read of its own.
  After each of its reads the next one is set `delay(age)` later; with quick answers that is 15, 30, 60, 90 … 300,
  360, 420 … s. It reads with the function it is given, replaces the rows through `setList`, shows no loader and
  says nothing about a failure. It returns `duringOwnRead(run)`.

Changed:

- `domains/coreDam/asset/components/detail/components/distribution/AssetDetailSidebarDistribution.vue` - the old
  `getList` body is now `readList`, unchanged; `getList = () => duringOwnRead(readList)`, so mount, paging and the
  three `reloadList` sources (new dialog closed, cancel, manage upsert / delete) all pass through it. The poll's
  request is the same call with the tab's `pagination`, `filterData`, `filterConfig`, plus a signal.
- `domains/coreDam/asset/api/distributionApi.ts` - `fetchAssetDistributionList` takes an optional fifth argument
  `signal` and hands it to the library helper. An aborted call is cancelled on the wire and, in the helper, does
  not write the pagination (`useApiFetchList.ts:106`).

Not changed: `asset/store/distributionListStore.ts` and the listener. The notifications do what they did.

How the requirements are met:

| requirement | how |
|---|---|
| only while mounted and a row is under way | `idle()`: mounted, age set, no own read, no read in flight, document not hidden; a sync watcher on "some row under way" sets and clears the age |
| one request in flight | the next timer is set only in the `finally` of a read; `readNow` refuses while `reading` is set |
| never against the tab's own reads | `duringOwnRead`: clears the timer and aborts the poll's read in flight before the tab's read starts, schedules nothing while it runs (a counter, so nested reads work), starts the rhythm from zero when it ends. An aborted read's late answer is neither applied nor allowed to schedule |
| hidden document | `visibilitychange`: hidden clears the timer; visible reads at once (if the conditions hold), the next read by the age - the hidden time counts |
| stop | all rows final -> the watcher clears the age and the timer (a read in flight is let finish); unmount -> timer cleared, read aborted, listener removed, nothing scheduled afterwards |

Tests: `test/distribution/distributionListPoll.test.ts` (26) - the **real tab** over the real store, the real
`distributionApi` and the library's list helper, a fake server and clock; rows, dialogs and the paginator are
stand-ins. **Numbers are written in two cases only** (the constants; reads at `0, 15, 30, 60 … 300, 360 … 600` s
and still every minute after three hours). Every other case waits "until the list is read once more" or "an
hour", and where a distance matters it is compared with the module's first or last step, so tuning the rhythm
means editing those two cases. The rest: starts for each of the three statuses; same URL as the tab's own read
and the rows on screen replaced; no loader; one read at a time however slow, also when the window returns or
notifications arrive meanwhile; a failed read is silent and the reads go on; never starts when everything is
final or the list is empty; stops when a read finds everything final, and when a notification finishes the last
one; starts, from the first step, when a notification puts one under way; unmount (no timer and no listener
left - *these two assertions were replaced in "Review round 1", point 3* -, read in flight aborted, late answer
not applied, a returning window wakes nothing); hidden (no reads, no
timer, one read at once on return, the next one a last step later - the hidden time counts; an answer that
arrives while hidden is applied); a user read restarts the rhythm from the first step, blocks the poll while it
runs, aborts the poll's read and wins over its late answer, which also starts nothing; the page the user turned
to is the one read; a failed user read with nothing under way starts nothing.

Decided alone:

1. **The delay is counted from the end of the previous read, not on a fixed grid.** With an answer in
   milliseconds the two are the same; with a slow server the reads spread out instead of bunching up, and two
   scheduled reads are never closer than the current step.
2. **A read of the tab's own restarts the rhythm whether it succeeded or failed** (`getList` swallows its error,
   and a failed read after a user action is still "the user just did something").
3. **A failed poll read**: no alert, the list stays, next read at the normal time (the library's request helper
   reports the failure to the app's logger as it does for any request). No back-off, no "give up": the steps
   are already 15 to 60 s. *Superseded: see "Review round 1", point 2.*
4. **An unknown status is not "under way"**: only the three known ones start the reads, so a status added on the
   server later cannot make a tab read for ever.
5. **Returning to the window reads at once with no minimum distance** from the previous read (the upload plan has
   2 s between automatic reads; nothing was asked here). Switching tabs quickly costs one request per return.
6. The poll does not look at the store's `loader`: `DistributionManage` turns it on around a delete, and a poll
   that lands then replaces the rows under the spinner; the tab's reload follows the delete anyway.

Looks wrong, left alone:

- **The store's list is never emptied when the tab closes** (`reset()` / `resetList()` have no caller). Open the
  tab for another asset and let its first read fail: the previous asset's rows are shown. With rows under way the
  poll now replaces them with the right asset's on its next read; with final rows they stay, as today.
- **Two of the tab's own reads can run at once** (reload while the first read is on its way):
  `fetchAssetDistributionList` builds a new helper per call, nothing cancels the older one, the later answer wins.
- **The new-distribution dialogs keep their own list** of what the file already has on the service
  (`existingDistributions`, `DistributionNewDialogYoutube.vue:89`, `…Jw.vue:74`, `…Custom.vue:93`). Neither a
  notification nor the poll reaches it: a distribution just created stays "waiting" in the dialog until it is
  closed. Not new, and not in "the list the tab shows".
- On the last page, when its rows disappear, the paginator disappears with them (it sits in the `v-else` of the
  empty list) and the user is left on an empty page. As today after a delete.

---

## D. YouTube authorisation without the push server (krok 3, item 2)

Changed: `domains/coreDam/asset/components/detail/components/distribution/DistributionNewDialogYoutube.vue`

- `recheckAuthorized` (after `checkAuthorized`): runs only when the store says `waiting_for_login` for the
  service, the document is not hidden and no re-check is in flight. It asks `GET distribution/{service}/authorized`;
  on `authorized: true`, and only if the dialog is still waiting, it sets `success` - from there the existing
  watcher loads the form, exactly as after the notification. Anything else changes nothing; a failed request is
  swallowed and the next return asks again.
- `onMounted` adds it to `window` `focus` and `document` `visibilitychange`; `onUnmounted` removes both.

Tests: `test/distribution/youtubeAuthorizationRecheck.test.ts` (12) - the real dialog over the real store and
requests; what it shows after the sign-in is stand-ins. Waiting: the link is offered; focus -> asked again, signed
in -> `success`, link gone, the file's distributions read and shown; visible -> the same, hidden -> nothing; not
signed in -> still waiting, same link, the link not asked for again; focus and visibility together -> one request;
failed request -> silent, still waiting, next return succeeds; a refusal from a notification that came while the
re-check was on its way is not overwritten. Not waiting: signed in already, first check still on its way, refused
-> no request. Closed: both listeners removed and no request even with the store put back to "waiting"; the
answer to a re-check in flight is not written.

Decided alone:

1. **The re-check asks only "authorized?", it does not re-run the whole `checkAuthorized`.** That function, on a
   "no", also asks for a new login link, and `GET …/auth-url` writes on the server: every call stores one more
   exchange state for 15 minutes (`YoutubeAuthenticator::generateAuthUrl`,
   `YoutubeExchangeCodeStateManager::TOKEN_EXPIRATION` in core-dam-bundle 1.52.0). Running it on every return to
   the window would do that each time and swap the link under the user. The states are keyed by their own value,
   so an older link would still work; this is about not writing, not about breaking a login.
2. The listeners are there for the whole life of the dialog and the handler checks the state, rather than being
   added and removed as the state changes.

Left alone:

- **A refused sign-in is still learnt only from the notification.** The `authorized` endpoint answers yes or no;
  without the server a refusal leaves the dialog waiting with its link.
- **The login link is asked for once and is good for 15 minutes.** A dialog left open longer offers a dead link
  (core-dam answers `INVALID_EXCHANGE_TOKEN_STATE`); reopening the dialog gets a new one. As today.
- **The first check has no `catch`** (`onMounted` -> `checkAuthorized`): if it fails, the dialog stays on the
  spinner with status `idle` and the promise rejects unhandled. The re-check does not run in that state.

---

## New and changed files

```
M domains/coreDam/asset/api/distributionApi.ts
M domains/coreDam/asset/components/detail/components/distribution/AssetDetailSidebarDistribution.vue
M domains/coreDam/asset/components/detail/components/distribution/DistributionNewDialogYoutube.vue
M domains/coreDam/asset/components/footer/AssetFooterUploadButtonStop.vue
M domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue
M domains/coreDam/asset/components/queue/AssetQueueSelectedSidebar.vue
M domains/coreDam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue
M domains/coreDam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue
M domains/coreDam/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue
M domains/coreDam/shared/components/customMetadata/AssetCustomMetadataFormMassOperations.vue
A domains/coreDam/asset/composables/distributionListPoll.ts
A test/a11y/iconButtonNames.test.ts                       6
A test/upload/uploadStopConfirm.test.ts                   4
A test/cached/cachedChipUnresolved.test.ts               19
A test/distribution/distributionListPoll.test.ts         26
A test/distribution/youtubeAuthorizationRecheck.test.ts  12
```

`AssetQueueItemEditable.vue` got two attribute lines in its template; its script, `AssetQueueEditable.vue`, the
upload store, `fileApi.ts`, `shared/services/upload/**` and `appNotificationListeners.ts` were not touched.

For the e2e acceptance run of krok 4: the tab now sends `GET /adm/v1/distribution/asset/{id}` on its own while a
distribution is under way, and the YouTube dialog sends `GET /adm/v1/distribution/{service}/authorized` on every
return to the window while it waits. A spec that counts or strictly orders those requests would notice; none was
run.

---

## Review round 1 (2026-10-07, after the Codex and Opus reviews)

Production change in one file only, `domains/coreDam/asset/composables/distributionListPoll.ts`. The store, the
listener, the tab, the YouTube dialog and the aria-labels are as they were; nothing was done for Codex BUG 2-5.

```
$ npx vitest run src/test/distribution
 Test Files  2 passed (2)
      Tests  51 passed (51)

$ yarn lint:tsc
(no output, exit code 0)
```

`oxfmt --check`, `oxlint`, `eslint` clean on the three files. **The whole suite was not run** (the lead runs it).
`distributionListPoll.test.ts` has 39 cases now (26 before); `youtubeAuthorizationRecheck.test.ts` is unchanged.

### 1. A poll answer older than a notification no longer puts the old status back (Opus B1 = Codex BUG 1)

A `sync`, `deep` watcher on the store's list counts every write to it. `readNow` takes the number before `read()`
and, when it moved while the read was on its way, does not call `setList`; the `finally` schedules the next read
as after any other. A notification about a distribution the list does not show writes nothing, so the answer is
taken.

Cases (`the distribution tab, when a notification changes a row while a read is on its way`):

- `waiting` -> `distributing` by a notification during a held read, the read answers with the older `waiting`:
  the row and the store keep `distributing`; the next read comes and is taken.
- `distributing` -> `distributed` by a notification (its own `GET distribution/{id}`, with `extId`), the held read
  answers `distributing`: status and `extId` stay, and no read follows (nothing is under way).
- a notification about a distribution not in the list: the held read's answer is taken.

Left as it is: the library helper has already written the pagination of the skipped answer (same page, same
query; the count can be one flight old until the next read).

### 2. Reads that keep failing come less and less often (Opus PROPOSAL 1)

`DISTRIBUTION_LIST_POLL.afterFailure = [15, 30, 60, 120, 300] s`, in the same table as the rhythm.
`distributionListPollDelay(age, failures)` answers `max(rhythm by age, afterFailure[failures - 1])`, the last entry
for every failure after the fifth - "no sooner than", so the wait is never shorter than the rhythm itself. With a
server that is down from the first poll the reads are at 15, 30, 60, 120, 240, 540, 840, 1140 s … (every five
minutes from there).

Decided alone:

- **What forgets the failures:** a poll read that succeeded (also one whose rows were skipped under point 1: the
  server answered); a read of the tab's own, whatever its outcome (the user just acted, the rhythm starts from
  its first step as before); a distribution getting under way after nothing was (a new start as well).
- **A read given up** for the tab's own read or on unmount is not a failure, whether its request is refused or
  answered.
- **Returning to the window still reads at once**, whatever the wait after a failure was; if that read fails, it
  counts as the next failure.

Cases: the function with 0 to 50 failures at two ages; the tab's reads against a server that is down (the times
above); five failures, then an answer -> that read came 300 s after the last failure, its rows are shown, the
next one comes a normal step later; five failures, then a user's read -> the next poll a first step later; five
failures, then a notification finishes and another restarts the distribution -> the next poll a first step later.

### 3. Tests about this poll's own effect (Opus PROPOSAL 5)

- Removed: the five `vi.getTimerCount()` assertions and the count of `visibilitychange` listeners. In their place
  the cases assert requests: none in an hour after unmount, none on a returning window after unmount, none while
  hidden, none after everything is final.
- **Not pinned any more, as a consequence:** that the poll's timer is cleared on unmount and on hiding, and that
  its listener is removed. A timer or listener left behind sends nothing (`idle()` refuses), so no assertion
  about requests can see it; taking those three lines out leaves every case green.
- Added: the document hidden when the tab opens (the tab's own read is sent, nothing on its own for an hour, one
  read at once when the window is shown, then the rhythm); unmount while a user's read is on its way and unmount
  while the opening read is on its way (no request ever after, also on a returning window). Neither says what
  becomes of the tab's own late answer: aborting it is logged for the owner, not done.
- `test/support/fakeDam.ts` was changed by another agent meanwhile: a request whose signal is aborted is now
  refused, as axios does. The cases about a read given up therefore ran only that outcome; the outcome they were
  written for (the answer comes all the same) is now run as well, through this file's own client wrapper, which
  sends a marked request without its signal. `stops the read that is on its way …` and
  `gives up its own read …` run for both, `is not set off by the late answer …` for the second. `fakeDam.ts`
  itself was not edited by me.

Every guard of the composable was taken out again, one at a time (21 temporary edits, put back): 18 make a case
fail; the 3 that do not are the three lines named above.

Follow-up (2026-10-08): the three lines are pinned again, by what the poll's own file registers and nobody else's
(`what the poll of the distribution tab leaves behind`, 3 cases): its listener goes to `removeEventListener` on
unmount, its timer handle to `clearTimeout` on hiding and on unmount; each line taken out fails a case. 42 cases
in the file, 54 in `src/test/distribution`; no production change. Every `vitest` run leaves 25 to 108 MB in `/tmp`.

---

## Owner-approved fixes (2026-10-08): reads given up on close

The two proposals of the round-1 review the owner approved (Opus PROPOSAL 2). Paths relative to `admin-dam/src/`.

```
$ TMPDIR=…/node_modules/.cache/vitest-tmp-dam-b yarn --cwd …/admin-dam vitest run src/test/distribution --retry=0
 Test Files  2 passed (2)
      Tests  63 passed (63)

$ yarn --cwd …/admin-dam lint:tsc
(no output, exit code 0)
```

`oxfmt --check`, `oxlint`, `eslint` clean on the five touched files, `stylelint` on the two `.vue`. The whole suite
was not run.

### 1. The distributions tab gives up its own list read when it closes (bug older than this work)

`domains/coreDam/asset/components/detail/components/distribution/AssetDetailSidebarDistribution.vue`: one
`AbortController` for the life of the tab, aborted in `onBeforeUnmount`; `readList` hands its signal to
`fetchAssetDistributionList` and, once it is aborted, neither writes the list, nor shows the error, nor turns the
loader off. `distributionListPoll.ts` is unchanged.

Cases (`the distribution tab closed while its own read is on its way, and the tab of the next asset`, 6: three
scenarios, each with the given-up request refused at once and answered all the same), two tabs over one store as
in the app:

- opening read held, tab closed, tab of `asset-2` opened with its own read held, the first one ends -> the request
  was aborted, the next tab still shows its loader and an empty list, no alert; its own answer then shows its rows;
- the same with the next tab already showing its list -> the list stays that asset's, and the tab reads nothing
  again (no foreign row under way was put into it);
- the same for a read the user asked for (reload) instead of the opening one.

Decided alone: after a close in the middle of a read the store's `loader` stays `true` until the next tab's read
ends - on purpose, the closed tab must not touch a loader the next tab already owns, and nothing but the tab reads
that flag. A read of the tab's own is given up only by closing the tab, not by a newer read of the same tab (two of
them can still overlap, as before).

### 2. The YouTube dialog gives up a running re-check when it closes

`…/distribution/DistributionNewDialogYoutube.vue`: one `AbortController` for the life of the dialog, aborted in
`onUnmounted`; the re-check hands its signal to `distributionIsAuthorized` (which takes an optional `signal` now,
`domains/coreDam/asset/api/distributionApi.ts`) and does not record an answer that comes after the abort.

Cases (`the YouTube dialog once it is closed`, 4 in place of 1; again both outcomes of the given-up request):

- re-check held, dialog closed, the answer "signed in" arrives -> the request was aborted, nothing is in the store,
  no alert;
- the same, with a dialog for the same service opened before the answer -> that dialog asks for itself, is told
  "not signed in" and stays waiting with its link; without the fix the old answer signed it in.

Left alone: the dialog's **first** check (`checkAuthorized` on mount) is not given up on close - not asked, and
older than this work; its late answer still writes the shared sign-in state. *Done in the review round below.*

### Checks of the tests

Eight temporary edits of the two components, put back: the signal not handed over, each of the three guards of
`readList` removed, the abort on unmount removed, and the same three for the dialog. Each fails a case; with the
abort on unmount removed (the code as it was) all 6 tab cases and all 4 dialog cases are red.

Test support: `youtubeAuthorizationRecheck.test.ts` now wraps the client the way `distributionListPoll.test.ts`
does (records each request's signal, can send one without it) - `useApiRequest` goes through `client.request`, so
both `get` and `request` are wrapped; both `mountTab` and `mountDialog` take the store of a previous mount.

Changelog: one line under Fixed in `admin-dam/doc/changelog/3.0.0.md` ("A distributions tab that is closed gives
up the read of its list").

### Review round over the fixes (2026-10-08): the YouTube dialog

```
$ TMPDIR=…/node_modules/.cache/vitest-tmp-dam-b yarn --cwd …/admin-dam vitest run src/test/distribution --retry=0
 Test Files  2 passed (2)
      Tests  67 passed (67)

$ yarn --cwd …/admin-dam lint:tsc
(no output, exit code 0)
```

`oxfmt --check`, `oxlint`, `eslint` clean on the three touched files, `stylelint` on the `.vue`. The whole suite
was not run. `distributionListPoll.test.ts` and the tab are untouched.

1. **Opus T1, "no longer listens for the user coming back".** The case now keeps the two functions the dialog's
   own file registers (`focus` on the window, `visibilitychange` on the document; told apart by the file that
   called `addEventListener`) and asserts those same references reach `removeEventListener` on unmount. "Nothing
   is asked" counts the requests as the app sent them (`questions()`, from the client wrapper), not what the fake
   server recorded: a request with an aborted signal is refused there before it is counted.
2. **Opus T2.** `gives up the question that was on its way, and says nothing` is one case now (the request is
   aborted, no alert); the run "answered all the same" and the `toBeNull()` that held with or without the guard
   are gone. The guard stays pinned by `does not let that question … sign in a dialog opened after it`.
3. **The opening check is given up on close as well** (Opus proposal 3, the owner's item).
   `DistributionNewDialogYoutube.vue`: `checkAuthorized` hands the dialog's signal to both of its requests
   (`distributionIsAuthorized`, and `getYoutubeAuthUrl`, which takes an optional `signal` now,
   `domains/coreDam/asset/api/distributionYoutubeApi.ts`), writes nothing once the dialog is closed, and does not
   let the rejection of a request it gave up out of the hook. A check that fails while the dialog is open gets out
   as before (to Vue's error handler; that it has no handling of its own is still left alone).
   Cases (`the YouTube dialog closed while the check of its opening is on its way`, 5): "signed in?" held, dialog
   closed, next dialog told "not signed in" and waiting, the old answer says "signed in" -> the next dialog stays
   waiting with its link; the login-link request held, dialog closed, next dialog signed in and showing the
   file's distributions, the old link arrives -> it stays signed in (the old answer put it back to "waiting");
   both for a refused and for an answered request, each also asserting the abort and that nothing reached the
   app's error handler; and a check that fails in an open dialog still reaches it.

Twelve temporary edits of the dialog, put back, each fails a case: the two signals, the two late-answer guards
and the two halves of the catch of the opening check; either listener left on, another function taken off; the
abort on unmount (7 cases red); the re-check's signal and its guard.

Test support: the wrapper strips the signal of the next request *to a given address* (the login link is the
second request of the check), `holdNext(address, …)` holds any request, `mountDialog` sets `app.config.errorHandler`.

Changelog: the line under Fixed now names what the dialog cancels (the check of its opening, both requests, and a
pending re-check).

