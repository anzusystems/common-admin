# DAM, krok 0 - characterization tests of the upload (waves 1 to 3)

Written 2026-10-07 in `admin-dam` (`next`, `ba8a66ec`). Test files only; no production file was touched, nothing
was committed, the stash and the two unpushed commits are as they were.

Result of the one combined run of all new files:

```
npx vitest run src/test/appInitialize/notificationEvents.test.ts src/test/fallback/fallbackReadOutcomes.test.ts \
  src/test/fallback/fallbackSettlesQueue.test.ts src/test/list/massEditSelection.test.ts \
  src/test/queue/externalProviderImportLimit.test.ts src/test/queue/notificationSettlesQueue.test.ts \
  src/test/queue/queueAdd.test.ts src/test/queue/queueOperations.test.ts src/test/queue/queueRefresh.test.ts \
  src/test/queue/slotUploadRow.test.ts src/test/queue/slotUploadWithoutSocket.test.ts \
  src/test/queue/uploadFailures.test.ts src/test/upload/assetUploadLimit.test.ts \
  src/test/upload/fileApiDispatch.test.ts src/test/upload/uploadErrorMessage.test.ts \
  src/test/upload/uploadRequests.test.ts src/test/upload/uploadSequence.test.ts

 Test Files  17 passed (17)
      Tests  230 passed (230)
   Duration  8.22s
```

Run four times in a row with the same result. `oxfmt`, `oxlint` and `eslint` on the 18 new files: clean.
**Not run by me:** `vue-tsc`, the whole suite, `yarn ci`. The types were checked by reading only (TypeScript 6.0.3,
strict) - the places I am least sure of are listed at the end.

Paths below are relative to `admin-dam/src/`.

---

## 1. What was written

All cases drive the **real** store, the real `fileApi` (poll included), the real `uploadService`, the real
`externalProviderImportService` and the real listener module. What is faked:

| edge | how |
|---|---|
| HTTP | `vi.mock('@/shared/apiClients/damClient')` handing out the client of `test/support/fakeDam.ts` |
| time | `vi.useFakeTimers()`; a case advances "far enough for one read" (20 s) or "a long time" (30 min), never to a delay |
| notifications | `initDamNotifications` / `useDamNotifications` replaced through the partial library mock; the test calls the captured listener with `{ name, data }` |
| alerts | `useAlerts` replaced through the partial library mock (spies) |
| DAM-local glue | `currentExtSystem`, `externalProviders`, `cachedAuthors`, `cachedKeywords` by path, as the existing tests do; `auth` by path in the three component / import tests |

Not mocked anywhere in the new files: `uploadQueuesStore`, `fileApi`, `assetApi`, the four type APIs,
`uploadService`, `useUpload`, `useDamUploadChunkSize`, `useDamConfigState` (the real library config store is seeded).

### 1.1 Helper: `test/support/fakeDam.ts` (305 lines)

- `createFakeDam()` - a fake of what `damClient()` returns (`request/get/post/patch/put/delete`). Default answers:
  one asset `GET /adm/v1/asset/{id}` **and** several `GET /adm/v1/asset/licence/{l}/ids/{a,b}` from the same
  fixture map, a file of each type, the start (licence and slot form), chunk, finish and external import of each
  type. `on(method, pattern, handler)` puts a case's own answer over a default (it may throw, or answer with a
  promise to hold a request). Anything unanswered rejects with `fakeDam: nothing answers GET /x`.
- `assetReads(id)` counts reads of an asset **in either shape**, so a case that says "the asset was read" keeps
  passing when the poll moves from single reads to the batch read.
- `assetDetail()`, `assetFile()` fixtures; `queueRow()` - a fully typed `UploadQueueItem` with the factory's
  defaults; `seedQueue()`; `seedDamConfig()` (chunk size and an ext system into the library's `useDamConfigStore`);
  `stubFileReader()`; `httpError()`, `validationError()`, `forbiddenOperationError()` (real `AxiosError`s).

### 1.2 Test id -> file -> cases

| id | file | cases | what is pinned |
|---|---|---|---|
| **DS1** | `test/queue/queueRefresh.test.ts` | 13 | `AssetQueueEditable` mounted over the real store, row replaced by a button. `with_file` -> row `Uploaded` + metadata + form; typed values kept; the "too long" text taken back; an `Uploaded` row without metadata gets it; reaches the mass-edit row of the asset, never its slot row; `with_file` wins over a duplicate main file (C18); duplicate (read by the asset's own type, C19); failed with reason; "still on its way" warning x3; the shared disable flag while a read is held; a failed read changes and says nothing |
| **DS2** | `test/fallback/fallbackReadOutcomes.test.ts` | 13 | one poll read by file status, through the whole upload: `failed` (reason, no message, no more reads); `duplicate` x4 asset types (origin file read at `/adm/v1/<type>/…`, link, file id, switch, preview) + unreadable origin; not finished yet x5 (`uploading`, `uploaded`, `stored`, no main file, another main file) -> unchanged, a later read settles; never finished -> `processingTooLong` on a row still `Processing`; stopped while the finish request is on the wire -> never read |
| **DS3** | `test/fallback/fallbackSettlesQueue.test.ts` | 11 | poll + store together: an upload settled by the read with every field it gets; no reads once settled; the waiting upload takes the place; asset unreadable after the settling read -> `Uploaded`, form off; a failed read is followed by another; an external import settled under both values of `uploadStatusFallback`; `removeByAssetId` / `stopItemUpload` / `stopUpload` / `clearQueue` on an armed row -> no read at all |
| **DS4** | `test/appInitialize/notificationEvents.test.ts` | 10 | the events that are not uploads, real listener over the real distribution store and auth: distributing / remote processing -> status in the list, no request; distributed / failed -> the record re-read and replaced; unreadable -> unchanged; unknown id; `distribution_authorized` true / false and over "waiting for login"; `user_updated` -> `GET /adm/users/current` |
| **DS4** (uploads), **DS5**, **DS6**, **DS7**, **DS8** | `test/queue/notificationSettlesQueue.test.ts` | 33 | real listener + real store. Processed: settles, form off until metadata, error and fail reason reset, preview and switch only for the main file (slot row), does not go back to `Processing` when it beats the finish answer, ends the poll, failed mass-edit row -> error cleared but still `Failed`. Failed: reason over the old message, flips an `Uploaded` row, wins over an earlier unreadable metadata, frees the place. Duplicate x4 types, stays read-only after a later metadata event, never a mass-edit row without a file id. Metadata: fields, conflicts, new names, status untouched; switch stays the user's; second attempt after an unreadable first; DS7 x4 (open detail of an empty asset). One asset in two queues x4. Two queues, two uploads each. Ignored events x5 + another asset |
| **DC3** | `test/queue/slotUploadRow.test.ts` | 14 | `AssetSlotListItem` over the real store: upload drawn in place of the file for waiting / uploading / processing / **failed**; other slot or asset not drawn; newest upload wins; `refreshList` once when the row turns `Uploaded`, when it is cancelled (x3 statuses), when the queue is stopped or cleared; not on status steps nor on failure |
| new: slot without the socket | `test/queue/slotUploadWithoutSocket.test.ts` | 7 | see section 3.1 |
| **DR1** | `test/upload/uploadRequests.test.ts` | 38 | x4 types: start URL + body, slot start URL, non-201 rejects; chunk URL, form parts, `timeout: 420000`, `signal`, multipart header, progress callback, non-201 rejects; finish URL + body, row -> `Processing`, non-200 rejects and leaves `Uploading`; external import URL + body, non-201 rejects. Plus: mime type from the extension (`.mov`, `.icc`), a slot row without slot or asset starts as an ordinary upload |
| **DR2** | `test/upload/fileApiDispatch.test.ts` | 24 | start / chunk / finish / import x4 types go to `/adm/v1/<type>/` only; an unknown type rejects with `fileApi: unsupported asset type '…'` and no request; a server error comes back as it was |
| **DR3** | `test/upload/uploadSequence.test.ts` | 7 | through the store: 2500 bytes at 1024 -> start, chunks 0 / 1024 / 2048 of 1024 / 1024 / 452, finish with the **sha1 of the real bytes**; chunk named after the file, one abort signal per chunk; percent, speed and remaining time on the row; 100 % while the finish is on the wire; no progress without progress events; a 0-byte file = start + finish with the sha1 of nothing; a row without a file fails with no request |
| **DR4** | `test/upload/uploadErrorMessage.test.ts` | 9 | `resolveUploadErrorMessage`: known forbidden operation -> its text, unknown -> `noTranslation`; validation fields joined by a new line; no field -> unknown error; five other shapes -> unknown error |
| **DR5** (+ client failures) | `test/queue/uploadFailures.test.ts` | 8 | refused start -> message on row + one alert; three files, one reason -> one alert, a fourth with another reason -> a second; the reason is said again after the failed rows left the queue; 422 chunk -> one attempt, field message; 500 chunk -> four attempts then unknown error; a later attempt succeeds; failed finish -> `Failed`, form off; failure of a stopped upload -> nothing changed, nothing said, chunk aborted |
| **DQ1** | `test/queue/queueAdd.test.ts` | 12 | `addByFiles` (type by mime, licence, title, two at a time, unique keys, unknown format left out, no queue made for nothing, throws without ext system, two queues); `addByFilesAsSlotUpload` (fields, any format taken); `addByAssets` (fields from the list item, then the batch read); `addByExternalProviderAsset` (selection vs import) |
| **DQ2**, **DQ3**, **DQ5** | `test/queue/queueOperations.test.ts` | 16 | `stopUpload` (rows `Stop`, chunks aborted, emptied, key +2, nothing more sent, empty / unknown queue, other queues untouched); `clearQueue` (emptied, key +1, statuses untouched, creates a missing queue, drops collected names, **does not abort**); `stopItemUpload` (abort, removal, next row starts, waiting row never started); `removeByAssetId` (same teardown, settled row, unknown asset); `updateAssetMetadata` (four fields, every queue, no request); import in the queue (one request, holds a place, hands it on; refused as not unique; refused otherwise) |
| **DQ4** | `test/upload/assetUploadLimit.test.ts` | 5 | `AssetUpload` over the real store with the real `VDialog`: 45 + 5 added at once; 48 + 5 -> dialog, confirm adds the first two; cancel adds none and bumps the input key; 50 + 1 -> no confirm button; a slot instance adds a slot row |
| **DQ4** | `test/queue/externalProviderImportLimit.test.ts` | 5 | `importFromDetail` (adds and imports, closes the detail; refused at 50 with a warning; nothing open); `importFromSelected` (48 + 2 moved and imported, selection cleared; 49 + 2 refused, selection kept) |
| **DQ6** | `test/list/massEditSelection.test.ts` | 5 | `toggleSelected` on / off, refused at 50 with a warning, still removable at 50; `selectMultiple` replaces the selection with the range |

Total: 17 test files, 230 cases, 1 helper.

---

## 2. Deviations from the spec (report 9, section 3) and why

1. **No store mock and no assertion on store function names** (DS1, DS4 as the task ordered; I applied the same
   to DS5-DS8, DR5, DQ2, DQ3, DQ5, DC3). Every case seeds or creates a real row and asserts row state, requests
   and alerts.
2. **New files instead of new `describe` blocks in existing files** for DS4 (`appNotificationListeners.test.ts`
   mocks the store by path), DS5-DS8, DR5, DQ2, DQ3, DQ5 (`slotNotifications.test.ts` replaces `useUpload` with a
   stand-in, so a stop handle, an abort or an alert cannot be observed there, and its cases call the settle
   functions by name), DR3 (`uploadStop.test.ts` mocks `fileApi` and forces `isAxiosError` to false), DQ6
   (`detailRequests.test.ts` builds a fresh `vi.fn()` on every `useUploadQueuesStore()` call, unobservable without
   editing the existing mock). No existing test file was edited.
3. **DS5-DS8 are driven by notifications through the real listener, not by calling `queueItemProcessed` & co.**
   In every such case the fake server holds what the event says (a duplicate event comes with an asset whose main
   file *is* a duplicate, and so on). The case therefore reads the same whether the row is written from the event
   (today) or from the asset read the event triggers (after krok 2). Each event is followed by 5 s of fake time,
   to leave room for the planned 2 s delay / merge of reads (D8).
4. **DS2 "arming refuses a row that is not `Processing`"** is not tested by calling `armNotificationFallback`
   (it disappears). The same guard is pinned through its two real routes: an upload stopped while its finish
   request is on the wire (`fallbackReadOutcomes`) and a processed notification that beats the finish answer
   (`notificationSettlesQueue`).
5. **DS3 "metadata read fails -> no further read"**: only the end state is pinned (`Uploaded`, form off, no
   metadata). "No further read" is left out because R7 ("warning only after repeated failure") implies re-reads.
   The warning itself is asserted nowhere.
6. **DS8 "failed drops the metadata warning"** is pinned by its consequence, not by the warning: unreadable
   metadata, then a failed event, then a readable metadata event -> the row stays `Failed` without a form and
   with the fail reason. (If the warning were still registered, the row would be treated as "failed for want of
   metadata" and given its form.)
7. **DC3**: the real store instead of "store by path with a reactive `getQueueItemForSlotItem`", and the real
   `AssetQueueItemList`, so the cancel button of the slot row is part of the test.
8. **DR1 / DR2** go through `fileApi` (the surface `uploadService` uses), not through the four type modules one
   by one; DR2 proves "that type and no other" by the URL of the single request, not by spies on four modules.
9. **DR3**: asserted on the row and the requests (through `store.processUpload`), not on `useUpload`'s return
   values. The checksum is compared with a sha1 computed by `node:crypto` over the same bytes - report 9
   section 6 asked whether real bytes can be read under happy-dom: `FileReader` cannot (never fires `onload`),
   `Blob.arrayBuffer()` can, so `stubFileReader()` answers with the real bytes.
10. **Read shape**: the poll cases assert `assetReads('asset-1')`, which counts single and batch reads alike. Two
    places do assert a URL of a read on purpose: the origin file of a duplicate (`/adm/v1/<type>/file-origin`,
    this is the per-type dispatch) and the mass-edit batch (`/adm/v1/asset/licence/7/ids/asset-a,asset-b`: one
    request for the selection, under the current licence - two ids, not the batch size).
11. **Row keys**: only uniqueness is pinned, not the format `file_<name>_<n>` / `asset_<id>`.
12. **Limit warnings** (`showWarning('Max upload limit is 50 …')`, hard-coded English): only "shown once".

---

## 3. Findings

### 3.1 The slot upload without the socket (the new test)

Pinned in `slotUploadWithoutSocket.test.ts`, all through the real upload (`POST …/asset/asset-1/slot-name/extra`):

- The poll **does** run for a slot row and reads the asset. The asset speaks only of its main file.
- Slot file **is not** the main file (the usual case - an extra slot of an asset that already has a file): the row
  is never settled. Not by `processed`, not by `failed`, not by `duplicate` of the main file. It stays
  `Processing`, counted as unfinished, and after the poll gives up it carries
  `system.uploadErrors.processingTooLongSlot`. The only thing left is Cancel, which removes the row, ends the
  reads and sends **no** request - the file stays in its slot on the server. `AssetSlotListItem` then emits
  `refreshList` (pinned in `slotUploadRow.test.ts`), so the slot list is re-read and shows what the server has.
  There is no refresh button on a slot row, and the queue's refresh passes slot rows by (pinned in
  `queueRefresh.test.ts`).
- Slot file **is** the main file (first file of an asset created empty): the read settles the row as it would an
  upload (`Uploaded`, asset status, preview, switch), with no metadata and no form. A failed file fails the row
  with its reason.
- In that second case the **open asset detail does not get its `mainFile`** from the poll - today only the
  metadata notification writes it (`uploadQueuesStore.ts:649-656`). Pinned as it is; plan krok 2, DAM item 8
  flips it on purpose, so `slotUploadWithoutSocket › does not give the open detail of the asset its main file`
  and `notificationSettlesQueue › leaves the detail alone when the queue holds no slot upload of the asset` are
  expected to be rewritten there.

### 3.2 Behaviour that differs from, or adds to, the plan and the reports

1. **Three asset reads per settled row.** A row the poll finds processed costs three `GET /adm/v1/asset/{id}`:
   the poll's own, the decoration in `queueItemProcessed`, and `queueItemMetadataProcessed` (measured once with a
   throwaway copy of a test; not asserted). The refresh button costs the same three. The load estimate in plan 3.2
   ("600 naraz v desiatej sekunde") reads as one per row.
2. **The poll stops for good after it gives up** (text at +550 s, no further timer). Not pinned (plan rule 7
   keeps reading). `fallbackReadOutcomes › says so on the row…` asserts only the text and that the row is still
   `Processing`, after 30 minutes of fake time - valid for 550 s today and for the planned 20 minutes.
3. **A failed slot upload stays drawn over its slot** until it is cancelled, and `refreshList` is not emitted on
   failure. Report 9 (DC3) describes only "`Uploaded` or leaves the queue".
4. **The alert de-duplication is against the rows that are `Failed` in that queue right now**
   (`uploadQueuesStore.ts:469-471`): the same reason is said again once the failed rows have been removed
   (stop-all). Report 9 says "one alert per distinct message" without that limit.
5. **`clearQueue` on a queue with an upload on the wire aborts nothing**: the queue is replaced, the row object
   lives on, the upload continues. Report 3 says "does not stop anything"; the consequence for a running upload is
   not spelled out there. Today only the mass-edit queue is cleared this way.
6. **An external import copied from the selection loses the provider's metadata**
   (`externalProviderAssetImport.ts:57-69` builds the DTO with `metadata: {}`), while an import from the detail
   keeps it. Not in any report.
7. **`uploadFinish` hands the row over to processing even when called directly** - i.e. `fileApi.uploadFinish` is
   where `Uploading -> Processing` happens, not the service or the store. `uploadRequests.test.ts` pins the row
   status after the finish request for that reason; when krok 2 moves the hand-over, those two assertions move too.
8. **A queue row survives being dropped**: after `stopUpload` / `clearQueue` / removal the row object the test
   holds keeps its last status (`stop`, or untouched for `clearQueue`). Useful for the generation check in plan
   3.3: today nothing but the status and the cleared timer stops a late answer from writing to a dropped row.

### 3.3 Bugs noticed (pinned unless said otherwise, none fixed)

1. **Speed sample counts the bytes sent before the first progress event.** `uploadService.ts:122-135`: the first
   event of an attempt sets the time baseline and returns without recording `lastLoaded`, so the first sample is
   `loaded / dt`, not `delta / dt` (501 instead of 500 in `uploadSequence › says how far the file is…`). Small,
   but D4 makes DAM's measuring the target for the library.
2. **A mass-edit row failed by a file event, then processed, is left `Failed` with no error at all** (status
   untouched because the batch owns it, error and reason cleared). A red row with nothing to explain it. r3 F.14;
   pinned in `notificationSettlesQueue › clears the error of a mass-edit row whose file had failed…`.
3. **Refresh asks the asset status before the file status** (`AssetQueueEditable.vue:33-41`): an asset that is
   `with_file` and whose main file is `duplicate` is settled as processed, with a form, and never linked to the
   original. Whether the backend can produce that combination is unknown (r3 C18). Pinned.
4. **A slot row that lacks its slot name or its asset id is started as an ordinary upload** under the licence
   (`imageApi.ts:42-45` and siblings) - it silently creates a new asset. Not reachable through
   `addByFilesAsSlotUpload`, which always sets both. Pinned in `uploadRequests`.
5. **A slot upload takes any file format** (`addByFilesAsSlotUpload` has no mime check, "todo add check by type").
   Pinned in `queueAdd`.
6. **A read that fails behind the refresh button is silent**: no alert, nothing on the row
   (`AssetQueueEditable.vue:48-50`, empty `catch`). Pinned in `queueRefresh`.
7. **A refused duplicate import is `Failed` + `isDuplicate` with `hasError: false`** and has no ids. Pinned in
   `queueOperations` (the existing `externalProviderImport.test.ts` pins the service half).
8. **Not pinned, as report 9 asked:** a slot upload over the limit of fifty confirms through `addByFiles` and so
   adds ordinary upload rows (`AssetUpload.vue:94-101`).
9. **Not pinned:** a failed finish request leaves the row `Failed` and unpolled although the server may well
   finish the file (D5 changes it). `uploadFailures › a finish request that fails` asserts the row state only.

---

## 4. Cases that are expected to go red in the refactor, on purpose

So that nobody "fixes" them back:

| case | why |
|---|---|
| `fallbackSettlesQueue › ends uploaded with its form off when the asset can be read no more after the read that settled it` | rests on today's three reads; with one read applying everything there is no "settled but metadata missing" from a single good answer (C15) |
| `slotUploadWithoutSocket › a slot upload whose file is not the main file…` (4 cases) | D3: the slot will be read through the slot list and settled |
| `slotUploadWithoutSocket › does not give the open detail…`, `notificationSettlesQueue › leaves the detail alone when the queue holds no slot upload…` | krok 2, DAM item 8 |
| `notificationSettlesQueue › a notification that the file is processed › settles the upload row … the form staying off until its metadata` | if the read after a processed event applies the metadata too, the form opens here; R4 says "as today", so this one should stay green - if it goes red, that is a decision, not an accident |
| `uploadRequests › finishes the upload…` / `rejects a finish…` (the row status in them) | the hand-over to `Processing` leaves `fileApi` |
| every `expect(showError / showWarningT / showUnknownError)` | see 5.2 |
| `uploadSequence › says how far the file is…` (speed 501) | if the first-sample bug is fixed with D4 |

---

## 5. Decisions taken alone, and the conservative choice

1. **Fake the client, not the API modules.** Plan krok 0 says "falošný HTTP klient"; the task allowed either.
   The client is the only seam that survives both krok 2 (the library's poller will be handed `damClient`) and
   krok 5 (the type APIs disappear).
2. **Alerts through the partial mock of `useAlerts`.** It is the convention of this repo, but it intercepts only
   calls made from DAM code. Once settling moves into the library, alerts raised there bypass it and those
   assertions must be re-pointed. The clean edge would be the library's alert queue, but `useAlertsQueue` is not
   exported from `lib.ts`. If it is exported in krok 2, the spies can be replaced by reading the queue.
3. **Notifications through `useDamNotifications`, not through a fake `WebSocket`.** Cheaper, and DAM's listener
   module stays. It does not exercise the option normalisation of plan 3.1.
4. **`uploadStatusFallback`**: upload cases run with it `true`. The only case that also runs with `false` is the
   external import, which asserts that the read happens in both - the opposite of "honoured when false".
5. **Not pinned because scheduled to change:** exact delays and the give-up time; the batch size; the metadata
   warning (presence or timing); "no read after a failed metadata read"; the failed-then-finished row without its
   form (I removed one assertion of mine that touched it on a mass-edit row); the two `internal` fields (no
   metadata payload is asserted in these waves at all - `bulkMetadata.test.ts` already has it).
6. **`visualViewport`**: happy-dom has none and Vuetify's `VDialog` needs it; `assetUploadLimit.test.ts` stubs the
   global with an `EventTarget` rather than replacing the dialog. First test in this repo that opens a `VDialog`.
7. **Shared scratch directory**: another agent of the session overwrote a scratch file of mine with the same
   name; nothing in either repository was affected (my commands then matched no file). I moved to a
   sub-directory of my own.

---

## 6. Skipped

- **DS9** (e2e), **DR6** (dropped), **wave 4** (DC1, DC2, DC4, DC5) - as ordered.
- **DR3, one item:** "the chunk size composable is given `envConfig.dam.apiTimeout`" - not observable without
  mocking the composable, which every other test of the service already does; the composable itself is LR4.
- **DS2, one item as worded:** the direct call of `armNotificationFallback` (see 2.4).
- Nothing was skipped for fighting back; no case took more than a few minutes to get green.

---

## 7. Type spots to look at first if `vue-tsc` complains

Checked by reading, not by the compiler:

- `test/support/fakeDam.ts`: the two `as` casts in `httpError` (`InternalAxiosRequestConfig`, `AxiosResponse`);
  `seedDamConfig`'s structural parameter (`Map<number, unknown>` receiving the store's
  `Map<number, DamExtSystemConfig>`); `seedQueue` receiving the pinia store as `{ queues: Record<string, UploadQueue> }`.
- `test/upload/uploadSequence.test.ts`: `Uint8Array<ArrayBuffer>` (needs TS >= 5.7; the repo has 6.0.3) and the
  `node:crypto` import.
- `it.each` tables with mixed tuples: `uploadErrorMessage.test.ts` (errors of four shapes),
  `notificationEvents.test.ts` (`[boolean, string]`).
- `notificationEvents.test.ts`: `useCurrentUser('dam')` without a type argument, `store.list[0].extId`.
- Component mounts pass root props untyped (`createApp(Component, {...})`), as the existing tests do.

---

## 8. Review round 1 (2026-10-08)

Fixes for the three points of `review-dam-r1-opus.md` (T1, T2, PROPOSAL 4). Test files only. After them: my 17
files hold **236 cases** (was 230; `queueOperations.test.ts` 16 -> 22), all passing; the 20 files that import
`fakeDam` (mine plus `cached/cachedChipUnresolved`, `distribution/distributionListPoll`,
`distribution/youtubeAuthorizationRecheck`) pass together, 309 cases, twice; `yarn lint:tsc` exit 0; `oxfmt`,
`oxlint`, `eslint` clean on the four files touched.

### 8.1 What changed

| point | file | change |
|---|---|---|
| **T1** | `test/queue/notificationSettlesQueue.test.ts`, "does not put the row back to processing…" | The status is now asserted right after the finish request has answered (`advanceTimersByTimeAsync(0)`), before any poll can run. Then 5 s for whatever the notification itself sets off, the asset reads are counted, and after 30 minutes the count must be the same - no poll was armed. Before, the two assertions came after 30 minutes, by which time the poll had settled the row again |
| **T2** | `test/support/fakeDam.ts` | The fake honours `config.signal` as axios does: a request whose signal is aborted already is refused **unsent** (not recorded in `requests`), one aborted on the wire rejects at once with axios's `CanceledError` (`AxiosError`, code `ERR_CANCELED`), and whatever the handler answers afterwards reaches nobody. Two additions for the new cases: an answer may carry `arrived()` - called as the answer reaches the client, when an abort can no longer touch the request; `stubFileReader(onRead)` - told of every chunk as its read begins |
| **T2** | `test/queue/queueOperations.test.ts` | `uploadsUnderWay()` can now let the held chunks be answered (`answerChunks()`). Used in: stop-all (the server answers the two aborted chunks, still nothing more is sent); stop-one (the other two files go through to `Processing`, the stopped file gets no second chunk and no finish); "a row that was only waiting … is never started" (both places really free - the two uploads finish - and the removed row is still not started). New `describe('a stop that comes in the middle of an upload')`, 6 cases: stop through `stopItemUpload` inside the chunk handler, which then answers 201; the same through `stopUpload`; stop just as the answer to a chunk arrives; just as the answer to the **last** chunk arrives (no finish); stop while the start request is on the wire; stop while the next chunk is read off the disk |
| **PROPOSAL 4** | `test/upload/uploadRequests.test.ts` | the four `.rejects.toBeUndefined()` (x4 types = 16 cases) assert only that the request is refused, not with what |

### 8.2 Checked by mutation

The changed and new cases were run against throwaway copies of the three modules of the upload cycle
(`fileApi`, `uploadService`, the store), placed under `test/support/` for the run, wired in with `vi.mock` in a
throwaway copy of the test file, and deleted afterwards. No production file was edited.

| mutant | goes red |
|---|---|
| `startProcessing` without its guard (`fileApi.ts:197`) | T1, with `expected 'processing' to be 'uploaded'` |
| `stop()` aborts but never sets `stopped` (`uploadService.ts:283`) | 5 of the 6 new cases (stop-all in a chunk, both "answer arrives", start, read). Green, as meant: the `stopItemUpload`-in-a-chunk case and the three older stop cases - they are about the abort |
| `stop()` does nothing and the store aborts nothing (`uploadQueuesStore.ts:414-416, 429-431`) | all 6 new cases, and the older stop-all, stop-one and remove-by-asset cases |

### 8.3 What the stricter fake revealed

1. **No file relied on the blind spot.** Every test that uses `fakeDam` passed unchanged with the stricter
   fake, the three files of the other agent included. (One run in between showed
   `distributionListPoll.test.ts › the rhythm…` red: its constant was being edited at that moment, nothing to do
   with the fake; green in the final runs.)
2. **A second blind spot, in my first version of the fix.** A handler runs up to its first `await` before the
   fake attaches its abort listener, so an abort done *inside* the handler was missed and the 201 was delivered
   after all. The mutation run showed it (the abort-path case went red for "flag never set", which it should
   not). The fake now also looks at `signal.aborted` when it attaches.
3. **Behaviour not in the notes above: a stop during a chunk does not end the upload at once.** The cancelled
   chunk goes into the retry path, sleeps the first back-off (1 s) and only then sees `stopped`
   (`uploadService.ts:173-190`). Nothing visible comes of it - the row is already out of the queue and its place
   taken - but for that second the stopped upload's promise is still pending.
4. **Why the abort alone is enough for a chunk on the wire, today:** the `AbortController` is made once per
   chunk, before the retry loop (`uploadService.ts:158`), so every retry of an aborted chunk carries the aborted
   signal and axios refuses it unsent. With "flag never set" the upload therefore still sends nothing more for
   that chunk; it just walks through all three back-offs (13 s) first. A refactor that makes a controller per
   *attempt* would lose this; then only the check after the back-off (`uploadService.ts:189`) stands between a
   stop and three more requests for that chunk. The case that goes red for it is the `stopItemUpload`-in-a-chunk
   one.
5. **The start request cannot be aborted** (no signal, `imageApi.ts:46-52` and siblings): a stop during it
   always leaves the new asset on the server, with nothing taking it back. Known from the code comment
   (`uploadService.ts:241`), now pinned (`sends no chunk and no finish when it comes while the start request is
   on the wire`: the row has the ids, no `DELETE` is sent).

Section 2.4 above said the "row not `Processing`" guard is carried by two cases; before this round only one of
them could fail for it. Now both do.
