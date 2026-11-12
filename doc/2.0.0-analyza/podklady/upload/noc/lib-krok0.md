# LIB, step 0: characterization tests of the DAM upload (waves 1 to 3)

Written 2026-10-07 against `next` at `49bd815b`. No production file was changed; only test and test-support files
were added, and two existing test files got new `describe` blocks. Nothing was committed.

## Result

`npx vitest run <the 19 files below>`:

```
 Test Files  19 passed (19)
      Tests  261 passed (261)
```

252 of the 261 cases are new; 9 are the cases the two extended files already had. Four consecutive runs with
`--retry=0` were green, about 15 s each. `oxfmt --check`, `oxlint` and `eslint` are clean on the 25 files.
`vue-tsc` was not run (as instructed); the types were checked by reading. Places I would look at first if it
complains are listed at the end.

All 31 test ids asked for are written. Nothing was skipped; what is deliberately left unasserted is in
"Not pinned".

## The approach, and the one thing that made it possible

Report 9 (section 6) left open whether the real `damAssetApi` can run in a LIB test, because `importOriginal`
stalled the browser runner on the import cycle. It can: **the stall comes from mocking a module of the cycle, not
from the cycle**. With no `vi.mock` of any DAM module the real store, the real `api/uploadApi.ts`, the real
`api/damAssetApi.ts`, the real upload service and the real `rusha` all load and run in Chromium.

So every new file except the two extensions has **no `vi.mock` at all**. What is faked is the edge only:

| edge | support file | what it is |
|---|---|---|
| HTTP | `src/domains/dam/__tests__/support/fakeDam.ts` | a recording axios client handed in through the real plugin options (`request`, `get`, `post`, `patch`, …). It answers like a small DAM: start, chunk, finish, `GET asset/{id}`, `GET asset/licence/{l}/ids/{ids}`, `GET asset/asset-file/{id}`, `metadata-bulk-update`. A test changes what the DAM "knows" (`fileBecomes('asset-1', 'processed', …)`), adds rules (`reply`), or holds a request (`hold`). Non-2xx rejects with a real `AxiosError`, an aborted signal with a real `CanceledError`. |
| WebSocket | `support/damSocket.ts` | a stub of the global `WebSocket`; `deliver(eventName, data)` sends a frame as `damNotifications.ts` reads it. |
| timers | `support/longWaits.ts` | patches `window.setTimeout`: waits of 10 s and more are held until the test calls `elapse()`. Lengths are not recorded. An optional window (`passFrom`) lets shorter waits pass at once and records their lengths; only the chunk-retry test uses it. |
| profiles | `support/consumerProfiles.ts` | "CMS configuration" and "UGC configuration": typed literals mirroring the two `main.ts` files, plus the DAM configuration each has in `useDamConfigStore` when a file is added. |
| helpers | `support/uploadQueueRow.ts`, `support/damNames.ts` | a row as plain data (for "nothing changed"); answers and a drain for the author and keyword name lookups. |

Because the fake DAM answers both the single read and the by-ids batch, and the tests count "reads of the asset"
through `dam.assetReads()` (which matches both), **no settlement test depends on the shape of the read**, on a
delay, or on a store function's name. A read happening is "time passes (`waits.elapse()`), then a request under
the configured asset endpoint appears, then the row has changed".

## Test id → file → cases

Paths are under `src/domains/dam/`. "both" = runs under the CMS and the UGC configuration.

### Wave 1: settlement

| id | file | cases | what is pinned |
|---|---|---|---|
| LS1 | `uploadQueue/__tests__/uploadSettlementWithoutSocket.test.ts` (new) | 3 | UGC: file → start at `/ugc/v1/image/licence/{l}` → `Uploading` → `Processing` → a read under `/ugc/v1/asset/` → `Uploaded` with file id, asset status, preview, custom data, switches, form, no error, counts; no further read once settled; no request outside `/ugc/v1/`; no socket. Variant: `stored` first, `processed` later. Variant: three files, the third starts when the first is sent. |
| LS2 | `uploadQueue/__tests__/uploadPollRead.test.ts` (new) | 30 | per kind of row (uploaded file UGC, uploaded file CMS, copy to licence CMS): `processed`, `duplicate` (origin read at `{asset}/asset-file/{id}`), `failed` (reason, no form); six "not yet" answers (uploading, uploaded, stored, no main file, no file attributes, no answer) leave the row as it was and it is asked again; a duplicate whose original cannot be read fails the row; after any settlement no further read. |
| LS10 | same file | 12 | a waiting row removed, stopped, or stopped with the whole queue is not asked about again; removed while its read is on the way: left as it is. |
| LS3 | `uploadQueue/__tests__/uploadNotificationEvents.test.ts` (new) | 3 | CMS, poll live: a processed event settles the row and no read follows; a failed event likewise; a metadata event while the file is still sent opens the form with the status unchanged, and a read settles the file later. |
| LS4 | same file | 11 | each of the five handled events reaches the row; only the row of that asset changes; rows of one asset in two queues are both settled; `asset_file_uploaded`, `asset_file_deleted`, `asset_deleted` and an unknown name change nothing and ask for nothing. |
| LS6 | same file | 7 | unreadable asset on processed / metadata / failed event: row unchanged; processed for an asset without a main file: unchanged; duplicate event without an origin file or not about an image: unchanged, no request; duplicate with an unreadable original leaves an already uploaded row uploaded. |
| LS8 | same file | 3 | failed event: flips an uploaded row and takes its form; keeps a message the row already had; frees the slot of a file still being sent. |
| LS5 | `uploadQueue/__tests__/uploadSettlementApply.test.ts` (new) | 11 | one full asset through seven entry points (poll on an upload, poll on a copy, copied event, metadata+file events in both orders, refresh on an upload, refresh on a copy): status, asset status, preview, file id, keywords, authors, custom data, both switches, author conflicts, the queue's two suggestion sets, form. File event alone: status, asset status, preview, two switches, nothing else. Metadata event alone: metadata and form, nothing about the file. Name lookups for authors and keywords (CMS, and the UGC oddity below). |
| LS7 | same file | 2 | duplicate with a readable original, on an upload row and on a copy row: `assetId` and `duplicateAssetId` are the original's, `fileId` the origin file, everything of the original, form on. (The unreadable-original cases are in LS2 and LS6.) |
| LS11 | `__tests__/damNotifications.test.ts` (new `describe`) | 6 | off, or on without an address: no `WebSocket` constructed, `damNotificationsInitialized` true; opened once at the configured address; a frame reaches a listener as `{ name, data }`; a frame without data arrives with `data: undefined`; an unknown name is handed on too. |
| A1 | `__tests__/consumerProfileUpload.test.ts` (new) | 4 | both: exactly `POST {image}/licence/{l}`, `POST {image}/file-1/chunk`, `PATCH {image}/file-1/uploaded`; start body; chunk form (`file` with name, type and the real bytes, `chunk` JSON), timeout 420000; **finish checksum equals the SHA-1 of the bytes** (computed with `crypto.subtle`); nothing to the other application's prefix. Plus: the socket exists only under CMS. |
| A2 | same file; `__tests__/consumerProfileUploadDialog.test.ts` (new) | 2 + 4 | both: with no notification a read under `{asset}/` settles the row with its metadata; nothing outside the own prefix; no further read. Rendered (real `UploadQueueDialog` with real rows): "Uploading" + `1/1`, fields disabled, no "save and apply"; then "Uploading completed", field filled from the read and enabled, "save and apply" and "save" enabled. |
| A5 | same two files; `__tests__/consumerProfileNotifications.test.ts` (new) | 2 + 2 + 1 | both: a read finds `duplicate` → origin read under the own prefix, row becomes the original. Rendered: duplicate notice, form of the original open. CMS: the same from the `asset_file_duplicate` frame. |
| A6 | same three files | 2 + 2 + 1 | both: a read finds `failed` → failed row with the reason, no form, queue counts as finished, no further read. Rendered: error overlay with the reason chip, fields disabled, "save and apply" and "save" disabled. CMS: the same from the frame. |
| A7 | same three files | 4 + 2 + 1 | both: finish answers 502 → failed row, no form, no message, queue finished; **not asked about again (today; D5 turns this around)**. Rendered: "Uploading completed", general error text. CMS: a later processed frame makes it uploaded with its metadata. |
| A3 | `__tests__/consumerProfileNotifications.test.ts` | 4 | CMS: connects to the configured address; metadata frame then file frame, and the reverse order, each with the intermediate state asserted, reads under `/adm/v1/asset/`, no read after settlement. UGC: `openConnection()` constructs no socket. |
| A8 | same file | 15 | CMS: nine unhandled names (incl. the four distribution ones, `distribution_authorized`, an unknown one) and `user_updated` change nothing and ask for nothing; the five handled names for an asset of no row change nothing. |
| A9 | `__tests__/consumerProfileOptions.test.ts` (new) + the typed literals in `support/consumerProfiles.ts` | 6 | through the real plugin install: the full resolved `useCommonAdminCoreDamOptions()` of each application, `useCommonAdminCoreDamOptionsGlobal()`, and the image API (library default for CMS, the application's for UGC). The literals are typed against `PluginOptions`, so a renamed or dropped option stops the support file compiling. |

### Wave 2: requests and service

| id | file | cases | what is pinned |
|---|---|---|---|
| LR1 | `__tests__/damImageApiUploadRequests.test.ts` (new) | 24 | endpoints `/ugc/v1/...` handed in: start URL and body, the slot URL for a slot row, non-201 and a failed request reject; chunk URL, form, `Content-Type: undefined`, the row's signal, progress callback, six refused inputs without a request, non-201 rejects; finish URL and body, non-200 rejects; `damUploadStart/Chunk/Finish` refuse audio, video and document rows without a request; `fetchAsset` and `fetchAssetByFileId` URLs. |
| LR2 | `uploadQueue/__tests__/uploadServiceSequence.test.ts` (new) | 2 | 3000 bytes at 1024 a chunk: one start, offsets 0/1024/2048, sizes 1024/1024/952, each chunk a file of the picked name and type, the three chunks together are the picked bytes, finish with the real SHA-1, row `Processing`. Progress reports once a second: 34 %, 68 %, then one last report of 100 % with 0 s remaining; speed positive and finite. |
| LR3 | `uploadQueue/__tests__/uploadServiceRetry.test.ts` (new) | 12 | network error or 500: four tries, pauses `[1000, 3000, 9000]`, no message on the row; goes through on the third try and finishes; 400 on every try: four tries and the `chunkValidationFailed` text; 422 with `size` / `offset` / `mimeType`: one try, the field's text; an unknown field is named, one line a field; stopped while a chunk is on its way, in the pause before a retry, and after the last chunk: no further request, no finish; a start answer without the file id: no chunk request, rejects. |
| LR4 | `uploadQueue/__tests__/damUploadChunkSize.test.ts` (new) | 7 | min size until a speed is measured; unchanged between a fifth and a half of the timeout; grows to a quarter, shrinks to a half; clamped to the configuration; handed from one upload to the next (module state); a custom timeout. |
| LR5 | `__tests__/damAssetApiBulkMetadata.test.ts` (new) | 15 | body per row (`toMatchObject`, without the two `internal` fields); `mainFileSingleUse` sent also as `null` / `false`; the override argument wins; rows without an asset or without an editable form are left out; 23 rows → 10 / 10 / 3, sequential; nothing to send → `[]` with no request; 201, 204, 422, 500 reject; a failing second request stops the third; `updateAssetMetadata` body. |
| LR7 | `__tests__/damImageApiCopyToLicence.test.ts` (new) | 5 | URL and body; 45 → 20 / 20 / 5, answers flattened in order; 50 accepted, 51 refused before any request; one failing request refuses the whole; a 204 answer silently drops that batch (today). |
| LR9 | `uploadQueue/__tests__/uploadQueueClientFailure.test.ts` (new) | 6 | both: start refused, chunk refused on every try, empty file → the row fails without a message, without a form, counts as done, and the next waiting file is sent. |

### Wave 3: queue operations

| id | file | cases | what is pinned |
|---|---|---|---|
| LQ1 | `uploadQueue/__tests__/uploadQueueOperations.test.ts` (new) | 6 | a row per image file (type, title, licence, empty metadata), two sent at a time, counts; added after existing rows; tiff, pdf, an audio type the ext system knows, and an untyped file are left out; an unknown ext system rejects and makes no queue; two queue keys are independent; the counts take uploaded and failed for done. |
| LQ8 | same file | 3 | copy rows: `asset` / `processing` / image, asset id, no file, no title; they do not take an upload slot; an unknown ext system rejects. |
| LQ2 | same file | 2 | stopping a row being sent: its request's signal is aborted, the row is gone, the next file starts, counts follow, the file is never finished; stopping a waiting row: gone, never started. |
| LQ3 | same file | 3 | stop all: every row `Stop`, both requests aborted, queue empty, counts 0, file input key higher; the queue takes new files afterwards; nothing happens for an empty or unknown queue. |
| LQ4 | same file | 5 | removing an uploaded row keeps its status and updates the counts; removing a waiting row makes the queue finished; three out-of-range positions change nothing. |
| LQ6 | same file | 4 | detail save: keywords, authors, custom data, author conflicts of every row of the asset in every queue come from the DAM's answer; other rows untouched; a failed read changes nothing; a row still waiting gets the metadata and stays waiting with its form closed. |
| LQ5 | `imageWidget/__tests__/ImageWidgetMultipleLimitDialog.test.ts` (new) | 6 | 10+5 and 47+3 queued at once with `afterAdd`; 49+3 → dialog, nothing added; confirm adds exactly the first file; cancel adds none and moves the file input key; at 50 the dialog only says so and has no confirm. |
| LQ7 | `uploadQueue/__tests__/uploadQueueMassOperations.test.ts` (new `describe.each`) | 12 | keywords and authors: fill empty and undefined lists, keep existing, replace on request, written into rows of every asset type, the other list untouched, every filled row gets the same array instance. |

## Deviations from the spec files, and why

1. **New files instead of extending `uploadStatusFallback.test.ts`, `uploadQueuesStore.test.ts`,
   `uploadQueueItemRefresh.test.ts`** (spec for LS2, LS3, LS5 to LS8, LS10, LQ6, LQ8, LR9). Those files replace
   `damAssetApi`, `damImageApi`, `uploadApi` or the options by module path, which is exactly what the "fake only
   the edge" rule excludes. Only `damNotifications.test.ts` (LS11) and `uploadQueueMassOperations.test.ts` (LQ7)
   were extended: the first already uses the real options, the second tests a pure composable over a store mock
   and the spec names it.
2. **No direct call of `queueItemFullyProcessed` / `queueItemProcessed` / `queueItemDuplicate` /
   `queueItemFailed`** anywhere. LS5's "three entry points" became seven, all through things that survive: the
   poll, the events, and `useUploadQueueItemRefresh().refreshItem()` (a composable, not a store settle function;
   if it is renamed, two table rows in `uploadSettlementApply.test.ts` change).
3. **LS tests put events on the real notification bus; A tests send frames through the stubbed socket.** LS11
   pins socket → bus, LS4 bus → row, A3 / A8 the whole way. The bus is reset after each case
   (`useDamNotificationsEventBus().reset()`), because every store instance subscribes and never unsubscribes.
4. **LS4 runs with the poll on** (CMS configuration), not "flag off" as the spec row says: there is no profile
   with the flag off, and `uploadStatusFallback: false` is not to be asserted.
5. **Profiles are installed with the real `initCommonAdminCoreDamOptions` / `initCommonAdminImageOptions`**, not
   through `app.use(plugin)`, in every file but A9: the plugin install also replaces the i18n instance, which the
   other files do not want. A9 goes through the plugin.
6. **The CMS DAM configuration is written into `useDamConfigStore` directly**, in the shape the `/adm/v1/…`
   configuration requests give it, not loaded through the fake client. Loading it is C2 (wave 4).
7. **The UGC seeding mirrors report 8, section 3.2**, not the wrapper source: I was told to read only the two
   `main.ts` files in those repos. If a literal there is off, the fix is in `ugcConfiguration.seedDamConfig`.
8. **Stand-ins in the profile literals**: environment values (`adminDomain`, image domains, the socket URL), the
   four translated UGC labels, the two UGC mapper functions and the six UGC image API functions. Everything else
   is the literal of `main.ts`. CMS `notification` is `{ enabled: true, webSocketUrl: <test url> }`, as report 8
   section 7.1 prescribes.
9. **A2, A5, A6, A7 "rendered" are asserted on `UploadQueueDialog`** (the multi-file dialog with its real list and
   real rows), not on a mounted widget. Stubbed there: the row's picture (it would ask the image server), the
   remote autocompletes, the mass-operations sidebar, the file input and the dropzone. Mounting the widgets is
   wave 4.
10. **LQ3: the file input key is asserted to be higher, not "two higher".** The key only keys the input; +1 and
    +2 are indistinguishable to a user. Today it is +2.
11. **LS1 / A2: no "a long wait was armed" assertion.** The tests call `waits.elapse()` and then wait for a read;
    without an armed wait they time out. Nothing asserts that no read happened before it.
12. **LR3's retry pauses are asserted as `[1000, 3000, 9000]`** (the spec allows it: that schedule is not under
    change). After the fourth failure the code sleeps 1 ms more before rejecting; not pinned.

## Not pinned (on purpose)

- The do-not-pin list of the brief: buttons of a failed row; drop on the open dialog; the two `internal` fields in
  both PATCH bodies; the single-use switch after a detail save (LQ6 does not mention it); LS4's "an event naming
  another file still settles the row" (every event in these tests names the row's own file); A7's refresh button;
  "no read before 10 s".
- Dropped by the plan: A4, LS9, LR8.
- A8's "record how many requests each makes": recorded here, not asserted. Today each of the five handled events
  for an asset of no row makes one request (`GET asset/{id}`; the duplicate one `GET asset/asset-file/{id}`). The
  tests assert only that the row is unchanged and nothing leaves the `/adm/v1/` prefix.
- Row keys (`file_<name>`, `asset_<id>`) and their collisions.
- The final status of a row object after it left the queue while being sent (see finding 6).

## What will go red when the plan is carried out, by design

- `consumerProfileUpload.test.ts` › "whose finish request fails" › "is not asked about again" (both profiles):
  D5 keeps such a row in the poll. The comment above the case says so.
- `consumerProfileOptions.test.ts`: the two `useCommonAdminCoreDamOptionsGlobal()` cases use `toEqual` on the
  whole object, so normalising `notification` or dropping `uploadStatusFallback` from the return value shows.
- `damImageApiUploadRequests.test.ts` passes `uploadStatusFallback` as the sixth argument of `damUploadFinish`
  (non-image rows): a signature change is a compile error there.
- `uploadNotificationEvents.test.ts` › "the failed notification" › "leaves a message the row already had", and
  "a notification whose asset cannot be read" › `asset_file_failed`: both pin drift bugs (findings 3 and 4).
- `support/longWaits.ts`: `LONG_WAIT_FROM_MS = 10_000`. With a first read at 5 s the threshold has to come down.
  At 5000 the shim will also hold two unrelated timers: the 5 s `maxWait` of the author / keyword caches
  (`defineCached`, cleared by its own 1.5 s debounce) and the 15 s limit on loading `rusha` (cleared when it
  loads). Both are cleared before they matter; `elapse()` firing the cache one early is harmless.
- Waits after a metadata notification use a 5 s timeout (`SOON`), so D8's 2 s delay passes without a change.

## Behaviour found that the plan or the reports do not describe, or describe differently

1. **Mocking is what stalls the runner, not the cycle** (report 9, section 6, open question). See "The approach".
2. **The last progress report comes after the upload ended** (LR2). The speed meter's pending one-second timer
   fires once more after the last chunk and reports 100 % with 0 s remaining. On success the store never calls
   `stopSpeedCheck`; only the failure path does (`uploadQueuesStore.ts:203`).
3. **The order of two parallel start requests is not always the order of the rows.** Observed, not traced: in a
   fresh page (the first case of a file, `rusha` not loaded yet) the first start request to arrive was sometimes
   not the first row's; with `rusha` loaded it always was. Harmless in production (each row gets its own answer);
   it made one of my cases fail on its first attempt until the tests stopped assuming `asset-1` is the first row.
   The multi-file cases now tell the files apart by the chunk's file name (`dam.chunkOf`) or by size.
4. **Report 8, section 8.3 confirmed in code**: author and keyword names are always asked at
   `/adm/v1/author/ext-system/{id}/search` and `/adm/v1/keyword/ext-system/{id}/search`, on the configured
   `damClient`, whatever `endPointAsset` is (`author/api/authorApi.ts:9`, `keyword/api/keywordApi.ts:8`). Pinned
   under the UGC configuration (`uploadSettlementApply.test.ts`, last case). Whether a UGC asset ever carries an
   author or keyword id is a backend question.
5. **`updateFromDetail` takes the DAM's answer, not the asset it is handed** (LQ6): it re-reads the asset. On a
   row still waiting for its file it writes the metadata but neither opens the form nor marks the metadata as
   loaded, so the read that settles the row later overwrites it.
6. **A row stopped while being sent ends as `Failed`**, not `Stop`: the aborted chunk rejects, and the catch in
   `queueItemUploadStart` (`uploadQueuesStore.ts:202-214`) marks every row that is not `Uploaded` as failed. The
   row is out of the queue by then, so nobody sees it. Not pinned.
7. **The duplicate row forgets its own asset.** `duplicateAssetId` and `assetId` both become the *original's* id
   (`uploadQueuesStore.ts:368`, `:382`); the id of the asset that was just uploaded as a duplicate is no longer on
   the row. The plan's table (3.3) says "prepíše sa `assetId` aj `fileId`" and does not mention that
   `duplicateAssetId` is the same value. Pinned (LS7, LS2, A5).

## Bugs noticed (pinned as they are, not fixed)

1. **A failed-file notification whose asset cannot be read leaves the row `Processing`** (LS6). `queueItemFailed`
   finds the row through the id of the asset it fetches (`uploadQueuesStore.ts:398-401`), although the event
   already names the asset. With the poll off, or after it gave up, the row never fails.
2. **A failed-file notification keeps an older message on the row** (LS8, `uploadQueuesStore.ts:403-405`). The row
   shows the message before the reason (`UploadQueueItemEditable.vue:257-264`), so the reason is not seen.
3. **`copyToLicence` drops a batch answered with a 2xx other than 200** (LR7, `api/damImageApi.ts:290`): the assets of
   that batch are missing from the result and nothing reports it.
4. **A start answer without `id` costs 13 s of nothing** (LR3). `uploadChunk` rejects for the missing file id,
   the retry loop treats it like a failed request: four "tries" with the 1 / 3 / 9 s pauses and no request at all.
5. **New-name suggestions depend on the JSON shape of "no match".** `updateNewNames` counts a name as new only
   when its value is an empty *object* (`uploadQueue/composables/assetSuggestions.ts:8`, `isEmptyObject` excludes arrays), while the
   type says `Record<string, string[]>`. If core-dam sends `[]` for a name nobody matches, the "new author / new
   keyword" hint never appears. Not verified against the backend; only the `{}` case is pinned (LS5).
6. **Mass operations hand every filled row the same array** (LQ7): `item.keywords = value` for each row. Editing
   one row's keywords in place afterwards would edit all of them. The row component emits a new array on change
   (`UploadQueueItemEditable.vue:75`), so it does not show today.
7. **The author / keyword caches ask through whatever client is configured when their debounce fires**
   (`cachedAuthors.ts:23-27`). In an application there is one client, so this is only a test hazard; it is why
   `support/damNames.ts` has `damNamesAsked()`.

## Decisions taken without asking (the conservative choice each time)

- **LR1 pins `GET {endPoint}/{id}` for `fetchAsset` itself.** The rule "never assert single read vs batch" is
  about how the queue reads; `fetchAsset` is a public export that admin-cms calls directly, and its URL is its
  contract. If that reading is wrong, delete `describe('the read of an asset')` there (3 cases).
- **A7's "not asked about again" is pinned** although D5 will change it: it is today's behaviour, it is not on the
  do-not-pin list, and a deliberate red test is the point. It is one separate case, easy to turn around.
- **LS6 / LS8 drift bugs are pinned** (report 9 section 4 leaves it to the lead): same reasoning.
- **`installConsumerProfile` sets `cachedExtSystemId`** to the profile's ext system, as the widget does when a
  file is picked (`ImageWidgetInner.vue:313`). Without it the name lookups go to `ext-system/0`.
- **No temporary edit of production code to prove a test can fail.** Liveness was checked the other way: several
  assertions failed while being written for real reasons (the 100 % report, the hidden textarea twin, the order
  of start requests) before they were corrected to what the code does.
- **`vue-tsc` not run.** Places to look first if it reports something in these files:
  `support/damSocket.ts` (the stub class `implements FakeSocket`), the `as unknown as DamNotification` casts in
  three files, `wrapper.vm as unknown as { check … }` in the limit-dialog test, and the tuple inference of the
  inline `it.each` tables.

## How to run

```
npx vitest run \
  src/domains/dam/__tests__/consumerProfileUpload.test.ts \
  src/domains/dam/__tests__/consumerProfileNotifications.test.ts \
  src/domains/dam/__tests__/consumerProfileOptions.test.ts \
  src/domains/dam/__tests__/consumerProfileUploadDialog.test.ts \
  src/domains/dam/__tests__/damImageApiUploadRequests.test.ts \
  src/domains/dam/__tests__/damAssetApiBulkMetadata.test.ts \
  src/domains/dam/__tests__/damImageApiCopyToLicence.test.ts \
  src/domains/dam/__tests__/damNotifications.test.ts \
  src/domains/dam/imageWidget/__tests__/ImageWidgetMultipleLimitDialog.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadSettlementWithoutSocket.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadPollRead.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadNotificationEvents.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadSettlementApply.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadServiceSequence.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadServiceRetry.test.ts \
  src/domains/dam/uploadQueue/__tests__/damUploadChunkSize.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadQueueOperations.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadQueueClientFailure.test.ts \
  src/domains/dam/uploadQueue/__tests__/uploadQueueMassOperations.test.ts
```

Four cases take about 1.6 s each: they wait for the 1.5 s debounce of the author / keyword caches. Everything
else is well under half a second a case.

## Review round 1

After the review by Codex and Opus (`scratchpad/review-lib-r1-codex.txt`, `review-lib-r1-opus.md`). Test and
test-support files only; no production file, no git write. The step-1 patches were in the tree by then.

### What was repaired

1. **Codex TEST 2: "once a second" was not asserted** (`uploadQueue/__tests__/uploadServiceSequence.test.ts`).
   The shim released any wait of a second or more. `support/longWaits.ts` now keeps what each held wait was asked
   to last and gives it out as `lengths()`. The case checks before every tick that the meter's wait is the only
   one held and that it is `[1000]`, that the meter asks for a second again after a report, and that after the
   last chunk it asks for none. An interval of 20 s now fails at the first tick. No other test reads `lengths()`;
   the header of the shim says the poll's rhythm stays unread.
2. **Opus PROPOSAL 2: one asset twice in one queue** (`uploadQueue/__tests__/uploadQueueOperations.test.ts`, new
   `describe('one asset in two rows of a queue')`, 7 cases). **Today both rows settle, on every path**:
   - the copied notification settles both, each with file, metadata and form, counts 2 of 2;
   - with no notification a read settles both, and neither is asked about again;
   - the failed notification fails both, with the reason;
   - the duplicate notification makes both the original;
   - one of the two stopped: the other waits on and is settled by a read; the stopped one stays `Stop` with no
     file (rows are told apart by identity, not by asset);
   - what the user typed into one row is not overwritten by the settlement and does not reach the other;
   - two uploaded files that are duplicates of one original: both rows become it, and a save in its detail
     reaches both. This is how one asset gets into a queue twice without copy-to-licence, in admin-ugc too.

   A store that keeps one row per asset id goes red in all seven.
   Not pinned, only seen: after one read settles two rows, both hold the *same* `customData`, `keywords` and
   `authors` objects (`item.customData = asset.metadata.customData` for each row). The row's form writes new
   values, so it does not show; the mass operation `replaceEmptyCustomDataValue` writes in place and would hit
   both, which changes nothing there because it goes over every row anyway.
3. **Opus PROPOSAL 3: the UGC metadata map was not admin-ugc's** (`__tests__/support/consumerProfiles.ts`). The
   two maps are now copied from `admin-ugc/src/domains/blog/image/composables/customMetadataToImageMap.ts`: built
   from what the bulk save answered, rows without asset or file dropped, values trimmed, no author lookup. No
   existing expectation changed: the only case that touched the stand-in is A9, which compares identity.
   Because nothing exercised it, one case was added for both profiles in
   `__tests__/consumerProfileUploadDialog.test.ts`: **"save and apply" saves the row at
   `{asset}/metadata-bulk-update` and hands over an image built from the answer by the application's map** (UGC:
   `source` is the trimmed `author` field; CMS: the library's map, `source` empty with no DAM author; description
   trimmed in both; `damId`, licence, position 1, `showDamAuthors`; no request outside the own prefix). That is
   the core of B4 / LC6 from wave 4, taken early so the mirrored map is load-bearing.

Also repaired, from Opus T1 ("milder", my file): the two name-lookup cases of
`uploadQueue/__tests__/uploadSettlementApply.test.ts` used fixed ids, so a second attempt of the case found the
names cached and could not pass. They take fresh ids on every attempt now (`neverAsked`).

Not done, as told: Opus PROPOSAL 5 (pinning the old poll delays and give-up).

### Result

My 19 files, `--retry=0`: `Test Files 19 passed (19) / Tests 283 passed (283)` (261 before; +13 are the cases
step 1 added to three of these files (8 + 3 + 2, see `lib-krok1.md`), +7 one asset twice, +2 save and apply).
With the three other files that import `consumerProfiles`: 21 of 22 files pass. The one that does not is
`uploadQueue/__tests__/uploadQueueDialogDrop.test.ts`, which another agent was editing at the time (last written
00:01): its case "are queued all when dropped, however long the queue gets" fails on its own too (3 instead of
52), and it is the only type error `yarn lint:tsc` reports (`:65`, TS2322). Nothing of mine is involved; I did
not touch it.

`yarn lint:tsc`: no error in any of my 25 files (this is the first time they were type-checked).
`oxfmt --check`, `oxlint`, `eslint`: clean on the 25 files.

### Found on the way: `/tmp` was full

During this round every browser run began to die with "Page crashed", "Browser connection was closed" or "Cannot
connect to the iframe". `/tmp` (tmpfs, 7.9 G) was at 100 %: 320 directories `/tmp/<nanoid>/client/…`, which
vitest creates per run (`join(tmpdir(), nanoid())`) and which stay behind, 40 to 108 MB each, 124 of them from
this night. I deleted none of them. My runs used `TMPDIR=<repo>/node_modules/.cache/lib-tests-tmp` (home disk);
that directory is removed again. The lead was told at once. Any whole-suite run needs either the stale
directories cleared or the same `TMPDIR` prefix.
