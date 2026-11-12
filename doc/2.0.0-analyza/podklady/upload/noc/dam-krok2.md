# DAM, step 2: the upload store on the settlement (D1 to D5 of `navrh-krok2.md`)

Written 2026-10-08 in `admin-dam` (`next`, `ba8a66ec`, uncommitted working tree) against the library build copied
into `node_modules/@anzusystems/common-admin` at 10:30. Nothing was committed; the stash and the two unpushed
commits are as they were. Nothing under `node_modules`, in the library's `src`, in `admin-cms` or in `admin-ugc`
was edited. Paths are relative to `admin-dam/src/` unless they start with `public/` or `e2e/`.

## Result

```
yarn lint:tsc          exit 0
yarn lint:oxlint       exit 0
yarn lint:eslint       exit 0
yarn lint:stylelint    exit 0
yarn format:check      All matched files use the correct format (885 files)
yarn test --retry=0    Test Files 56 passed (56) · Tests 811 passed (811)      four runs: 28 s, 28 s, 69 s, 62 s
```

Before the first edit the same suite gave 54 files / 758 tests, green. `yarn ci`, a build and e2e were not run.

The upload queue settles its rows through `createUploadSettlement(profile)` only: one poll per queue, the
notifications as the fast path where the service is configured, the refresh button in both. The per-row fallback
of `fileApi.ts` is gone, and `fileApi.ts` no longer imports the store.

Where the 53 new cases are: `asset/assetReads.test.ts` 14 (new file), `init/envConfig.test.ts` 9 (new file),
`fallback/notificationFallback.test.ts` 22 → 36, `queue/slotUploadWithoutSocket.test.ts` 7 → 20,
`queue/notificationSettlesQueue.test.ts` 33 → 36, `queue/slotUploadRow.test.ts` 14 → 15,
`fallback/fallbackSettlesQueue.test.ts` 11 → 10.

## What was built

### D1 — configuration without the switch

| File | Change |
|---|---|
| `shared/types/EnvConfig.ts` | `uploadStatusFallback?` optional and `@deprecated`; `notification.enabled: boolean \| string` |
| `shared/EnvConfigService.ts` | no default for `uploadStatusFallback`, and it is no longer copied from the deployed config |
| `main.ts` | `uploadStatusFallback` is no longer passed to the plugin |
| `public/config.json.dist` | the `uploadStatusFallback` line is gone |

`notification.enabled` is handed to the plugin as the file has it; the library alone decides that only `true` and
`"true"` with a non-empty address switch the service on.

### D2 — the store

`domains/coreDam/asset/store/uploadQueuesStore.ts`:

- the profile of design 6.1: `roleOf` by `item.type`, `policyFor` by the table of 2.1, `matches` through the
  unchanged `notificationMatches` (the metadata purpose by the asset alone), the four readers, the caches, the
  three texts, `metadataGate`, the four hooks, `connection: useDamNotificationsConnection()`;
- `readers.asset` answers `null` for a 404 (`apiErrorStatus`), rethrows anything else;
- `queueItemProcessed`, `queueItemFailed`, `queueItemMetadataProcessed`, `queueItemDuplicate` are wrappers
  (`notify` processed, `settleKnownFailed`, `notify` metadata, `settleKnownDuplicate`); their bodies, the store's
  `metadataLoaded` and every `clearTimeout(item.notificationFallbackTimer)` are gone;
- tracking: an upload after `await upload()` when it is `Processing`; an import after `await importInit()` when it
  is `Processing`; in the `catch`, the `Failed` row whose finish request went out (`{ clientFailed: true }`);
- `removeByIndex` and `stopItemUpload` call `untrack`; `clearQueue` (so `stopUpload`) and `reset` call `dropQueue`
  before the queue object is replaced;
- new store function `refreshQueueItem(item): Promise<UploadRefreshOutcome>`;
- `metadataFailures` stays, for the mass-edit rows their batch load left out only.

`domains/coreDam/shared/services/upload/uploadService.ts`: `useUpload()` also returns `finishAttempted()`, set
right before the finish request.
`domains/coreDam/asset/api/assetApi.ts`: `FETCH_BY_IDS_MAX_LIMIT` 25 → 50; `fetchAssetListByIds` rejects when an
answer carries no list in `data.data`.

### D3 — slots through the list of the slots

`domains/coreDam/asset/api/assetSlotApi.ts`: `fetchAssetSlotFiles(assetId)` reads
`GET /adm/v1/asset-slot/asset/{asset}` and answers the file of every slot; an answer whose `data` is no list
throws. The slot role has `reader: 'slots'`, `metadata: 'none'`.

Checked in core-dam-bundle by reading: the endpoint answers every slot of the asset at once with the file in its
detail view, so with `fileAttributes` and `originAssetFile` (`AssetSlotController::list`,
`AssetSlotFacade::decorateAssetSlots`, `AssetSlotAdmListDecorator`); the slot is made in the transaction of the
start request (`AbstractAssetFileFacade::addAssetFileToAsset`), so the file is in the list before the row is first
asked about; a duplicate keeps its slot (`storeAndProcess` only changes the status).

### D4 — the fallback out, the import, the button

- `domains/coreDam/asset/api/fileApi.ts`: `calculateFallbackTime`, `isSettled`, `notificationFallbackCallback`,
  `armNotificationFallback`, both constants and the imports of the store, `fetchAsset`, `i18n` and `envConfig` are
  gone. `startProcessing` is `Uploading → Processing` and nothing else.
- `domains/coreDam/shared/services/upload/externalProviderImportService.ts`: no `armNotificationFallback`; the
  store tracks the row.
- `domains/coreDam/asset/components/queue/AssetQueueEditable.vue`: `refreshItem` finds the clicked row, awaits
  `store.refreshQueueItem(row)` and warns on `'pending'`. It no longer reads the asset by itself.

### D5 — the detail

`hooks.onAssetRead` gives an open detail of the read asset its `mainFile` when it has none, for every read.

### Texts

`system.uploadErrors.processingTooLong`, `processingTooLongSlot`, `metadataFailed` and `unknownError` are in both
locale files (`locales/en/system.json`, `locales/sk/system.json`). Nothing was added or changed.

### Test support

- `test/support/immediateScheduler.ts`: the equivalent of the library's; used by `slotNotifications.test.ts`.
- `test/support/recordingScheduler.ts`: keeps the timers of the page and counts the settlement's own that still
  wait. Used where "no timer is left" has to be told apart from every other timer of the application.
- `test/support/fakeDam.ts`: the slot list (`GET /adm/v1/asset-slot/asset/{asset}`, `slotFile()`, `slotsBy()`,
  `slotReads()`); the server now knows the asset an upload or import it started has made (a draft whose file is
  still uploading), unless the case has described that asset itself; `uploadStarted()` for a case that answers a
  start request by itself. The bulk read was there already.
- No manual scheduler was written. The suite is happy-dom, `vi.useFakeTimers()` moves the default scheduler of
  the settlement (it calls the global functions at the time of the call), and every neighbouring case already
  works that way.

## The checks of design 8.2

After D2:

| Check | Outcome |
|---|---|
| the whole `queue/slotNotifications.test.ts`, with `:147-169`, `:700-723`, `:745-760`, `:779-796` | green, 38 cases; the four named cases unchanged |
| the store loads without the plugin configured | every store test but `fallback/notificationFallback.test.ts` loads the store with no plugin installed at all |
| a mass-edit row is never in a request of a tick | pinned: `fallback/notificationFallback.test.ts` › "loads the assets picked for mass edit, and never asks about them again" (an upload waits in the same queue for an hour; each picked asset was read once, by its batch load) |
| `appInitialize/appNotificationListeners.test.ts` passes unchanged | yes; the file and `appNotificationListeners.ts` were not touched |

After D3:

| Check | Outcome |
|---|---|
| a missing file is counted only in a list that was read | pinned: `queue/slotUploadWithoutSocket.test.ts` › "fails … once its file was missing from three lists that were read" and "is not given up on while the list (cannot be read / is answered by something that is no list / is answered by nothing at all)" |
| two slots of one asset settle separately | pinned: same file, "are asked about in one read of the slots of the asset, and settled each by its own file", "do not settle each other", and "takes its state from its own file, not from the main file of the asset" |
| a duplicate slot file is found in the list | pinned: same file, "is marked a duplicate of the file its own file names" |
| `refreshList` goes out after a settling from a read as well | pinned: `queue/slotUploadRow.test.ts` › "asks for the slot list once when a read of the poll settles the upload" |

The points of the brief:

| Point | Outcome |
|---|---|
| upload and import rows have their `fileId` before they are tracked | asserted at the moment the row begins to wait in `fallback/notificationFallback.test.ts` (upload, slot, import) and already in `fallbackReadOutcomes` / `fallbackSettlesQueue`. With `queueItem.fileId = res.id` taken out of the import service six cases go red |
| a mass-edit row its batch load left out, whose file then failed, is not reopened by a metadata notification | pinned: `queue/notificationSettlesQueue.test.ts` › "a mass-edit row its batch load left out" › "is not given them once its file has failed"; red without the line in `onRowFinal` |
| `readers.asset` answers `null` for a 404 | pinned: `fallback/notificationFallback.test.ts` › "fails a row with the text of an unknown error once the server did not know its asset three times"; a 500 in the next case only warns |
| `readers.assets` rejects without a list, batches by 50 | pinned: `asset/assetReads.test.ts` (50 in one request, 101 in 50 + 50 + 1, four shapes of "no list") and through the poll in "takes an answer … that carries no list for a read that failed" |
| `fetchAssetSlotFiles` rejects on an unexpected shape | pinned: `asset/assetReads.test.ts`, three shapes and a refused request |
| works with the service not configured at all | pinned: `fallback/notificationFallback.test.ts`, the plugin installed and `initAppNotificationListeners()` called as at the start, five configs (no block, `false`, `"false"`, on without an address, an empty block): no socket is made, an upload is read at 5 s and not at 4 999 ms; then a slot upload, an import and the mass edit |
| the service on | pinned: same file, `true` and `"true"`: one socket to the address; first read at 10 s while it is open, at 5 s while it is not, sooner once it is lost; the notifications settle the row and the poll asks nothing after |
| R6 | `queue/slotNotifications.test.ts` › "gets its form at once, with the metadata it never had…" and "gets its form back as the user left it…"; without the service: `fallback/notificationFallback.test.ts` › "an upload whose finish request fails" |
| R7 | by the poll: "warns on a row whose read failed three times, and takes the warning back…"; by a notification's read: `slotNotifications` › "keeps the warning…, said once the read has failed three times"; never on a slot row: the three "is not given up on while the list…" cases |
| O10 | `queue/queueRefresh.test.ts` › "settles the row as a duplicate when the asset has its file and that file is a duplicate" |
| O16 | "brings an asset picked for mass edit up to date without settling it" (unchanged) and the new "keeps the text about its metadata when a notification says its file is processed" |
| `untrack` only for a row that leaves, `dropQueue` before the queue is replaced | pinned: `fallback/notificationFallback.test.ts` › "a row that leaves its queue…" (11 cases: no timer of the settlement is left after remove, stop-one, stop-all, clear, reset, also when a notification's read was still to come; a row that stays keeps the timer of its queue) |

Each production line named above was taken out or bent once, alone, with the tests run against it, and put back
(29 temporary edits). 27 turn at least one case red; four of those only after a case was written for them:

- `untrack` in `removeByIndex`, and `dropQueue` in `clearQueue`: a row that is gone from its queue is skipped by
  the settlement by itself, so no request ever showed the difference. What the calls take away is the timer of
  the queue and the waiting read of a notification, and `recordingScheduler` is how the new cases see those.
- the list check of `fetchAssetListByIds`: three shapes of "no list" were refused by accident (a spread of
  something that is not iterable throws). A text in place of the list was taken for a list of characters, and is
  the case that pins the check.
- the missing-metadata text kept by `onProcessedSeen` (the second mass-edit exception of O16): no case had it.

The two that turn nothing red:

- `refreshQueueItem` passing `fileId: null` in place of the file of the row: see "Looked wrong", point 2.
- the mass-edit role with `reader: 'asset'` in place of `'none'`: nothing ever tracks a mass-edit row, so the
  policy is a second lock on a door the store does not open.

## Deviations from the design

1. **`hooks.onRowFinal` forgets the "metadata missing" mark of a row that is `Failed`** (design 6.1 has only the
   two calls). As told: today `queueItemFailed` drops the row from `metadataFailures`.
2. **`fallback/notificationFallback.test.ts` was rewritten whole, not removed** (9.3: "the whole file goes").
   Nothing may be deleted in this work, and the file with its old imports no longer type-checks. It now holds the
   poll as the application wires it, and keeps its name as the library's `uploadStatusFallback.test.ts` kept its.
3. **`reset()` drops every queue from the settlement** before it empties the store. The design does not name
   `reset`; without it a tracked queue left its timer behind.
4. **`refreshQueueItem` answers `'error'` for a row without an asset**, without a request. Such a row (an asset
   of an external provider that was only selected) cannot be read; the button of the row does not fire for it
   anyway.
5. **`refreshItem` in `AssetQueueEditable.vue` falls back to the first row of that asset** when the row at the
   index it was given is another one by then (the design: the row at the index, checked by its asset).
6. **`hooks.onProcessedSeen` writes the three fields of `item.error`** as the old code did, where the design
   assigns a new object. Same outcome.
7. **`envConfig.uploadStatusFallback = true` stays in the `load()` of three step-0 files** (the design allows
   it: the field is optional and unread). It went from `fallbackSettlesQueue.test.ts` with the parameter of its
   `load()`.
8. **The fake server knows the assets it has started.** Design 9.4 expected the fake to answer the new reads by
   default; it answered 404, which D7 turns into a failed row after the third read.

## Existing tests changed, and why

In the lists of design 9.3 / 9.4:

| File | Case | Change | Why |
|---|---|---|---|
| `queue/slotNotifications.test.ts` | mock of `useUpload` | `finishAttempted: () => false` | 9.3: the `catch` of the upload calls it |
| same | `load()` | `immediateScheduler()` into `uploadSettlementRuntime.scheduler` | 9.3: the waits before a notification's read |
| same | "keeps the warning of an upload whose metadata could not be read" | rewritten: three reads fail (each brought by a notification), no text after the second, `metadataFailed` after the third, kept through the processed notification | 9.3, R7 |
| same | "stays without its form when it had no metadata before the failure, until that is loaded" | turned around: "gets its form at once, with the metadata it never had…" | 9.3, R6 |
| `queue/lazyMetadata.test.ts` | mock of `useUpload` | `finishAttempted: () => false` | 9.3 |
| `queue/externalProviderImport.test.ts` | mock of `fileApi`, two cases | `armNotificationFallback` out of the mock and of both assertions; first title now "…and hands the item over to processing" | 9.3 |
| `fallback/notificationFallback.test.ts` | whole file | rewritten | 9.3, deviation 2 |
| `fallback/fallbackSettlesQueue.test.ts` | "ends uploaded with its form off when the asset can be read no more…" | rewritten: "has all it needs from the one read that finds the file processed…" (form on, metadata there, exactly one read) | 9.4 |
| same | "is settled by a read of its asset (uploadStatusFallback %s)" ×2 | one case; `load()` lost its parameter | 9.4 |
| `queue/slotUploadWithoutSocket.test.ts` | whole file, 7 cases | rewritten, 20 cases | 9.4, D3 |
| same / `queue/notificationSettlesQueue.test.ts` | "does not give the open detail…" / "leaves the detail alone when the queue holds no slot upload of the asset" | turned around | 9.4, plan step 2 item 8 |
| `queue/queueRefresh.test.ts` | "settles the row as processed when the asset has its file and that file is a duplicate" | turned around: a duplicate, linked to its original | 9.4, O10 |

Not in either list:

| File | Case | Change | Why |
|---|---|---|---|
| `test/support/fakeDam.ts` | — | the fake knows the assets its start and import requests made | deviation 8. Without it seven cases of `queueOperations` and `uploadFailures` went red: their other rows reached `Processing`, were asked about, and failed by D7 on a server that did not know the asset it had just made. With it they pass untouched |
| `queue/queueOperations.test.ts` | "sends no chunk and no finish when it comes while the start request is on the wire" | one line: the case's own start handler tells the fake of the asset it makes (`server.uploadStarted`) | the same reason; this case answers the start request itself, so the fake's default never runs |
| `queue/notificationSettlesQueue.test.ts` | "starts the upload that waited for the place of the failed one" | the two seeded rows have ids of their own (`asset-8`, `asset-9`) | the fake numbers the upload it starts `asset-1` / `file-1`, the ids of the seeded row whose asset the case had set to "file failed". The first read now comes at 5 s (R15), inside the 5 s the case waits, found that failed file and failed the new row. Under the old fallback (first read at 10 s) the collision was never reached |

Added to existing files: `notificationSettlesQueue.test.ts` › "a mass-edit row its batch load left out" (3
cases); `slotUploadRow.test.ts` › "asks for the slot list once when a read of the poll settles the upload" (its
`afterEach` now also puts real timers and globals back).

No case was changed to pass for a reason outside these two tables.

## Behaviour that differs from before, beyond the list at the end of design 11

All follow from decisions already taken; listed so that nobody meets them unprepared.

1. The first read comes 5 s after the file was sent (10 s while the socket is open), not 10 s; the text "takes
   too long" comes at 20 minutes, not at 550 s, and the reads go on after it (R1, R15, D1, D2).
2. A slot upload settles without the service (D3). Before, it stayed `Processing` for good unless its file was
   the main one.
3. A row whose finish request failed is asked about for as long as it stays, and comes back when the server has
   finished the file (D5, R6).
4. A row whose asset the server does not know three times in a row fails with the unknown-error text (D7).
5. The first load of the metadata fills only what is empty on the row (D6).
6. A read that follows a processed notification and shows another final state of the main file writes that
   state (design 3.1): a file processed and then failed ends failed. Before, the row stayed uploaded.
7. Every settled row costs one read of its asset, where it cost three (finding 3.2.1 of `dam-krok0.md`).
8. With two or more rows waiting in one queue the poll asks by `GET asset/licence/{licence}/ids/{ids}`.

## Looked wrong, left alone

1. **Library: a row loses its failure text.** A row that carried the read warning (R7) during its upload and is
   then failed by the client with the finish request sent is `Failed` with `{ hasError: false, message: '' }`
   after the next poll read. `syncNotice` in `settlement/uploadSettle.ts` still believes the text on the row is
   its own (`notice.shown`) and takes it away. Reproduced with a temporary case (removed): after 60 s `uploading`
   with `metadataFailed`; finish answers 500: `failed` with `unknownError`; 20 s later: `failed`, no error. The
   library store has the same `catch`. Reported to the lead; the store cannot reach the notices.
2. **The refresh of a row whose file is not the main file of its asset writes nothing**, and says nothing unless
   the main file is not final yet (then the "still uploading" warning). Before, an asset that "has its file"
   settled the row whatever its file. Where the button can be offered: only in `AssetQueueEditable` (the upload
   overlay and the mass-edit panel); slot rows are drawn by `AssetQueueItemList` and have no refresh button. For
   the rows that can show it:
   - an upload or import row holds the file its own start request made, which is the main file of the asset it
     made, unless the main file of that asset was changed elsewhere meanwhile;
   - a mass-edit row holds the main file of the moment it was picked, and shows the button only when it is
     `Uploaded` with an error or without its form, which its batch load never leaves it in;
   - a duplicate holds the file of the original, and is not offered the button at all.
   So it is not reachable in an ordinary flow. No test pins which file the refresh passes on.
3. **A config without the `notification` block still stops the start**: `setEnvConfig` reads
   `data.notification.enabled` and throws. Today's behaviour, and the template keeps the block. If "not configured
   at all" is to include a missing block, it is two `?.` in `shared/EnvConfigService.ts`.
4. **Every failed read of one asset is reported through the API error logger** (`fetchAsset` goes through
   `useApiRequest`): once per read on the ladder 15, 30, 60, 120, then every 300 s for as long as the row stays;
   a 404 three times before D7 fails the row. admin-dam sets no logger of its own, so this is `console.error`.
   The bulk read and the slot list use the client directly and report nothing. The same note is in `lib-krok2b.md`.
5. **A mass-edit row that failed for want of its metadata and then gets it stays `Failed`**, with its form on and
   its error gone. Today's behaviour, now also asserted in the new case that pins the gate.
6. **`removeByExternalProviderAssetId` takes its row out with a bare splice.** Its only caller removes from the
   mass-edit queue, whose rows are never tracked; a row spliced out is skipped by the settlement anyway.
7. **Stale mentions of the fallback outside what I may write or should touch:**
   `domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue:209` (a comment; the file carries another
   agent's changes); `.env:8` (`UPLOAD_STATUS_FALLBACK=true`, no longer read by the template);
   `e2e/tests/upload/uploadNotificationFallback.spec.ts` (its header names `notificationFallbackCallback`, and
   its one test is marked `test.fail()` for "the fallback is never armed": with the poll always running it should
   now pass, which Playwright reports as a failure until the mark is taken off). The changelog of admin-dam says
   nothing of this step, the dropped key of `config.json.dist` included.
8. **About the tests, not the product:** in a test file that replaces part of the library
   (`vi.mock('@anzusystems/common-admin', async (importOriginal) => …)`) the library is one instance for the whole
   file; `vi.resetModules()` does not give a new one. The plugin options, the notification socket, the event bus
   and `uploadSettlementRuntime` of one case are then those of the next. Measured in
   `fallback/notificationFallback.test.ts`: with such a mock only the first of eight "service on" cases got a
   socket. That file therefore replaces nothing of the library. The fourteen test files under `test/queue`,
   `test/fallback` and `test/upload` that do replace a part of it are not affected by it today: they install no
   plugin, open no socket, and leave `uploadSettlementRuntime` as it is.

## Not verified

1. Nothing ran in a browser or against a backend; no e2e, no `yarn build`, no `yarn ci` (its checks were run one
   by one).
2. **The bulk read and the slot list against a real server.** The slot list was read in the backend code (above);
   the bulk read only in `lib-krok2b.md` and `upload-postup.md`. One manual upload of two files at once, and one
   upload into a slot of an asset that already has a file, with the service switched off, before anything is
   released.
3. The hidden tab. The poll does not read while the document is hidden and reads at once on the return; that is
   the library's and is exercised only by its own tests.
4. A deployed `config.json` with `"enabled": "false"` in quotes has the service off from this step on (it was on
   by accident). Pinned for the plugin options (`"false"` → no socket); what the deployments carry was not looked
   at. The plan's rule stands: not deployed without step 3.
5. The sparse rhythm beyond its first read, and the rhythm after the second minute, are asserted here only as
   "less often" and "still asked after three hours"; the table is pinned in the library.
6. The types of the new test files were checked by `vue-tsc` (exit 0), the behaviour of `AssetQueueEditable`
   only through `queue/queueRefresh.test.ts`, where the row is a stand-in with a button.

## To delete

Nothing has to be deleted for the suite to be green.

- `test/fallback/notificationFallback.test.ts`: not to delete, to rename. Its content is the poll of the upload
  queue; `test/queue/uploadQueuePoll.test.ts` would say so.
- `node_modules/.cache/vitest-tmp-dam-c/` was left on disk on purpose.

## How the work was done, where it matters for trust

- The 29 temporary edits of production files and the one temporary test case were each put back from a copy kept
  outside the repository; the last full run and every lint ran on the restored tree.
- Two shell commands of mine began with `cd /`, against the rule of this work. Neither raised a prompt and
  neither changed anything; every later command used absolute paths only.

---

## Follow-ups (2026-10-08, on the library build copied at 11:20)

Five items from the lead after the report above. Same rules; no `cd`, no `rm`, nothing under `node_modules`.

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 830 passed (830)   two runs, 27 s and 29 s
e2e: yarn lint:tsc / format:check / lint:oxlint               exit 0 (static checks only; no e2e test was run)
```

On the new build, before any edit of this round, the suite was 56 files / 811 tests, green.

### 1. The stale notice, as a permanent case

`test/fallback/notificationFallback.test.ts` › "an upload that fails after its row was warned that its data could
not be loaded" › "keeps the text of its failure at the reads that follow". The service on, the finish request
held, the asset answering 500, one `asset_metadata_processed`: after a minute the row is `uploading` with
`metadataFailed` (three reads); the finish answers 500 and the row is `failed` with `unknownError`; ten minutes
of failing reads later, and again after a read that answers with the file not finished, it is still `failed`
with that text. Green on the new build. On the build of 10:30 the same steps ended with
`{ hasError: false, message: '' }` (the temporary case of the first round).

### 2. A `config.json` without the `notification` block

- `shared/types/EnvConfig.ts`: new `DeployedEnvConfig`, the file as a deployment has it: `EnvConfig` with the
  `notification` block optional and each of its two values optional. `EnvConfig` itself, what the application
  holds, keeps the block.
- `shared/EnvConfigService.ts`: `setEnvConfig(data: DeployedEnvConfig)` reads
  `data.notification?.enabled ?? false` and `data.notification?.webSocketUrl ?? ''`. A block that is there
  is copied as before.

Pinned twice:

- `test/init/envConfig.test.ts` (9 → 14 cases): no block → the start runs, the service is
  `{ enabled: false, webSocketUrl: '' }`; four blocks that say only part.
- `test/init/startNotificationService.test.ts` (new, 11 cases): **`main.ts` itself runs**, with the config a
  faked `fetch` answers; the root component, the router, Vuetify, Sentry and the stylesheet are stand-ins,
  nothing of the library is replaced. Then the listeners are added as at the start and one file is uploaded.
  - seven configs without the service (no block, an empty block, `false`, `"false"`, an address without
    `enabled`, `enabled` without an address, an empty address): the application starts, no socket is made, the
    server is first asked 5 s after the file was sent, and that read settles the row;
  - `true` and `"true"` with an address: one socket to that address; with it open the first read comes at 10 s;
  - a config that still carries `uploadStatusFallback` (`true` and `false`): starts, 5 s.

  This is also the one place that pins what `main.ts` hands the plugin.

Six temporary edits (the two `?.`, one `?? ''`, `main.ts` without the block, `main.ts` with `enabled: true`,
and the two of item 5) each turn cases red; all restored.

### 3. The e2e spec (`e2e/tests/upload/uploadNotificationFallback.spec.ts`) — not run

The `test.fail()` mark stood for one thing only, DAM-B11: "the fallback is never armed, so the overlay hangs for
good". The poll is always on now, so the mark, its bug annotation and the `@bug` tag are gone, and the two
comments say what happens now. `KNOWN-BUGS.md`, which the old comment pointed to, is not in the repository.

Its waits against the new rhythm:

| Wait | Budget | Against the rhythm |
|---|---|---|
| `uploadFile` → the create response | 60 s | untouched by this step |
| `waitForAssetProcessed` | 90 s, asks the API itself | untouched |
| `waitForUpload` (the overlay says "Nahrávanie ukončené") | 90 s | the spec keeps a silent socket open (`routeWebSocket`), so the queue reads at 10, 30 and 60 s of the row's wait and every minute after. The asset is processed when this wait begins and the row is younger than about 90 s, so the next read is at most 60 s away. Without a socket the reads are denser (at most 30 s apart in that span) |

So it can pass as written. The suite name still says "notification fallback". e2e's `lint:tsc`, `format:check`
and `lint:oxlint` pass on the edited spec.

### 4. `UPLOAD_STATUS_FALLBACK`, the stale comment, the changelog

- **Who read the variable:** inside the repository only `public/config.json.dist` (line removed in D1); `.env`
  defined it. Nothing in `bin/`, `docker/`, `scripts/`, `.github/`, `e2e/`, the vite config or `package.json`
  names it. `.env:8` is removed. `.env.docker.dist` never had it.
- **Outside the repository, left alone:** the template is filled by `env-config`, a command of the docker image
  `anzusystems/node:4.2.0-node24-nginx-browsers` (`bin/dev`, `bin/build`), which only substitutes what the
  template names. `public/config.json` on this machine (git-ignored, written by that command) still holds
  `"uploadStatusFallback": true` from its last run; the key is read past. The petit deploy repository's
  `config.json.cf.dist` still carries the key (plan step 4).
- `domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue:209`: the comment no longer speaks of a
  fallback.
- `doc/changelog/3.0.0.md`:
  - *Changed*: "The upload queue asks the server itself; the notification service only brings the news sooner"
    (the rhythm, the bulk read, slots, import and mass edit without the service, D5, the three texts, O10, D6,
    the detail, one read per row) and "Distribution statuses and the YouTube sign-in no longer depend on the
    notification service" (step 3);
  - *Fixed*: "The icon buttons of the upload queue have names, and Esc closes the stop question" and "An author
    or keyword chip no longer spins for good…" (step 1);
  - *Deployment*: `UPLOAD_STATUS_FALLBACK` / `uploadStatusFallback` no longer read; the `notification` block
    optional and on only for `true` / `"true"` with an address, with a "check before deploying" for the text
    `"false"`;
  - **three older lines under *Fixed → Upload queue* were reworded**, because they described the per-row
    fallback as it no longer is ("gives up at 550 s", "a slot upload usually needs its notification", "the
    library's fallback follows its configuration", "another offers refresh for its metadata"). What they said of
    behaviour that still holds is kept. If the lead wants the old wording back, it is three lines.

### 5. Which file the refresh asks about

`test/queue/queueRefresh.test.ts` › "the refresh of one of two rows of an asset" (2 cases): two rows of one
asset, the first holding the main file, the second another file.

- pressed on the first: it is settled with its form, the second is left `processing` and untouched;
- pressed on the second: neither row changes, nothing is said.

With `fileId: null` in `refreshQueueItem` both go red; with the component taking the first row of the asset in
place of the clicked one the second goes red. The second case also pins the behaviour of "Looked wrong",
point 2.

### What in the notes above no longer holds

- "Result": 57 files / 830 tests now; `test/init/startNotificationService.test.ts` is new (11 cases),
  `envConfig.test.ts` has 14, `notificationFallback.test.ts` 37, `queueRefresh.test.ts` 15.
- "Looked wrong", point 1: fixed in the library and pinned here (item 1).
- "Looked wrong", point 2: still so, and now pinned (item 5); the temporary edit of `refreshQueueItem` is among
  those that turn a case red.
- "Looked wrong", point 3: the start tolerates the missing block (item 2).
- "Looked wrong", point 7: the comment, `.env` and the e2e spec are done, the changelog has its entries.
- "Deviations", point 7 and "Existing tests changed" stand as written; this round changed no existing case, it
  only added.

### Still open after this round

1. e2e was not run; the spec without its fail mark is unproven until the owner runs it.
2. The petit deploy template still carries `uploadStatusFallback` and, where it does, `"enabled"` in quotes
   (plan step 4).
3. The bulk read and the slot list against a real server (as above).
4. Failed single-asset reads go through the API error logger for as long as a row waits (as above).

---

## Review round 1 of the wiring (2026-10-08, Codex + Opus), items 1 to 5

On the library build of 11:20. Item 6 waits for the next build.

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 835 passed (835)   two runs, 29 s and 30 s
```

830 before this round; five new cases, no case removed.

### What was done

| # | Item | The change | The case that goes red without it |
|---|---|---|---|
| 1 | Opus B1 | `uploadQueuesStore.ts`: the profile's `slotFiles` is `readSlotFiles`, which answers `[]` for a 404 of the slot list and rethrows anything else. `assetSlotApi.ts` is as it was | `queue/slotUploadWithoutSocket.test.ts` › "fails with the text of an unknown error once the server did not know its asset three times" (three reads, then `failed`, then no read). The other way round, every refused read answered as `[]`: "is not given up on while the list is refused by a server in trouble" (new, a 500) |
| 2 | Codex 1 | the `catch` of the upload notes `failedByServer` (the row was `Failed` before the `catch` touched it) and tracks only `finishAttempted() && !failedByServer`. Nothing else in the `catch` changed | `fallback/notificationFallback.test.ts` › "an upload the server fails while its finish request is still on its way": no timer of the settlement, no read in a minute, the reason of the server still on the row. With `failedByServer` always true the three D5 cases go red |
| 3 | Opus proposal 1 | `stopUpload` on a queue that is there and empty calls `settlement.dropQueue`; the store registers `onScopeDispose(() => settlement.dispose())` at setup, guarded by `getCurrentScope()` as in the library | same file › "leaves a queue that, emptied row by row and then stopped, gives up its listener for the tab" and "an upload queue store that is disposed of" (no timer, no tab listener, a notification and a lost socket wake nothing) |

`test/support/fakeDam.ts` got `assetDeleted(assetId)`: the fake forgets the asset and its slots and answers 404
for both. Six temporary edits of the three changes each turn a case red; all restored.

### Item 4: cases that asserted what is true of every row

Each now fails the read three times first (`metadataUnreadable()`, a helper in the file: three notifications, each
bringing one failed try) and asserts the text where it belongs before the step under test.

| File | Case | Now |
|---|---|---|
| `queue/slotNotifications.test.ts` | "says nothing to a row that already has its metadata" | a second row of the asset without its metadata gets the text; the row that has its metadata does not |
| same | "takes the warning back once the metadata does arrive" | the text is asserted before the metadata arrives, and gone after |
| same | "does not make a duplicate editable when its event comes after the duplicate one" | a row beside the duplicate gets the text, the duplicate none; then the metadata arrives and only the other row gets its form |
| same | "does not make a failed upload editable again when its event comes after the failure" | the same shape: the row beside it is told, the failed row keeps its reason |
| same | "does not come back to an upload that failed after its metadata could not be read" | not on the list, the same weakness: the row carries the text, the failure of the upload replaces it, the metadata that comes after changes nothing |
| `queue/notificationSettlesQueue.test.ts` | "is what is wrong with the row from then on, not the metadata that could not be read before it" | a minute passes after the metadata notification: three reads, the text on the row, then the failed notification replaces it |
| same (T2) | "ends the asking about a row that waited for it" | the file is `stored` on the fake until the processed notification: the metadata notification gives the row its form and leaves it `processing`, and it is the processed one that settles it |

### Item 5: answers of a mock that outlived their case

`queue/slotNotifications.test.ts`: `beforeEach` resets `fetchAsset` and `fetchImageFile` and gives them their
first answers back (the asset with its main file; no original file). Until now `mockRejectedValue` at `:275`
answered the next case too, `mockResolvedValue` at `:288` (an asset with no main file) every case to `:372`, and
the one at `:372` (no main file, metadata) every case after it.

With the reset one case went red, "starts whatever was waiting for the slot it freed": two uploads were started.
The read that follows the notification now finds the main file and completes the row, which asks the queue for
the next upload a second time, and the stand-in for `useUpload` never marked a started row as uploading, so the
same row was "waiting" twice. The real `uploadInit` sets `Uploading` before anything else. The stand-in does the
same now, and the case also asserts the one read, the completed row and the started one.

One more case changed for the same reason: "leaves a queued upload alone until it has a file of its own" asserted
that the waiting row is still `waiting`, which held only because the stand-in never moved it. It is started for
the place the settled upload freed, as in the application; the case asserts `uploading`, that is, not settled.

### Item 6: prepared, not in the tree

The case (service on; metadata notification; its read held open; processed notification; then the answer) is
written and was tried against the current build with the file restored afterwards: red, the row ends
`['uploaded', false]` where `['uploaded', true]` with the metadata is expected. It goes into
`fallback/notificationFallback.test.ts` once the build with the library fix is copied.

### Not done, as told

Codex 2 (the outcome of Refresh follows the main file: O10), Opus proposals 3, 4 and 5.

### Item 6, on the final library build (copied 12:16)

`fallback/notificationFallback.test.ts` › "a metadata read that is answered after the processed notification has
settled its row" › "gives the row its metadata and its form all the same". The real profile, the service on: the
metadata notification, its read held open on the fake, the processed notification (the row is `uploaded`, no
form), then the answer. The row is `uploaded` with its form, the keywords and the custom data of the server, no
error; two reads in all, none in the hour after. Red on the build of 11:20 (`['uploaded', false]`), green on
this one. No production file of admin-dam changed for it.

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 836 passed (836)   two runs, 29 s each
```

This is the final tree of the step: 54 files / 758 tests before the wiring, 57 / 836 now.
`fallback/notificationFallback.test.ts` has 41 cases.

### Left on disk on purpose

`admin-dam/node_modules/.cache/vitest-tmp-dam-c/` (the temp directory of every vitest run of this work).

---

## Owner decision 2: failed reads of the poll are written down once per streak (2026-10-08, library build of 13:39)

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 852 passed (852)   two runs, 20 s each
```

836 at my last run; seven cases are new here, the other nine are `dam-b`'s in `test/distribution`
(`distributionListPoll` 48, `youtubeAuthorizationRecheck` 15).

### How each read reported until now

| Read | Made by | Reported |
|---|---|---|
| one asset, `fetchAsset` | `useApiRequest` | every failure, a 404 included |
| several assets, `fetchAssetListByIds` | the client itself | nothing |
| the slots of an asset, `fetchAssetSlotFiles` | the client itself | nothing |

admin-dam installs no logger, so "reported" is `console.error` through the library's default.

### What changed

The settlement hands each reader `UploadReadOptions { report }`; the three readers of the profile honour it.

| Reader | `report` true | `report` false | no options |
|---|---|---|---|
| `readAsset` | `fetchAsset(id)`, as ever | `fetchAsset(id, { report: false })`: thrown as ever, not handed to the logger | as `true` |
| `readAssets` | `fetchAssetListByIdsReported`: the same requests through `useApiFetchItems`, which reports what fails | `fetchAssetListByIds`, untouched | as `false` |
| `readSlotFiles` | `fetchAssetSlotFiles(id, { report: true })`: the same request through `useApiFetchItems` | the client itself, as before | as `false` |

- `asset/api/assetApi.ts`: `fetchAsset(id, options?)` passes `report` on to `execute`; new
  `fetchAssetListByIdsReported(ids, licenceId)`, in groups of fifty, with the address written whole (a url
  parameter would be encoded, its commas with it, and the request would no longer be the one it was).
  `fetchAssetListByIds` is untouched: the mass edit uses it and reports nothing, as before.
- `asset/api/assetSlotApi.ts`: `fetchAssetSlotFiles(id, options?)`.
- `asset/store/uploadQueuesStore.ts`: the three readers, and one `isNotFound` for both shapes of a 404 (the api
  helpers' error and the client's own), since a reported slot read now fails with the first and an unreported one
  with the second. The 404 answers (`null`, `[]`), the list check and the groups of fifty are as they were.

Why two ways to make one request, and not a report "by hand" as in the library's store: the library's `report` and
`mapApiError` are not exported, and there is no way to reach the logger an application has set other than through
a helper. A reported read is therefore an ordinary helper read, which also reports an answer without its list; an
unreported one is the code that was there.

### Tests

`fallback/notificationFallback.test.ts` › "what is written down of the reads that fail" (7 cases, 41 → 48 in the
file), through the real hook `setApiErrorLogger`, each asserting the address and the status of what was logged:

| Case | Logged |
|---|---|
| one row, four failed reads in two minutes; then reads that answer; then failing again | 1, still 1, then 2 |
| two rows of one licence, three failed reads | 1: `/adm/v1/asset/licence/1/ids/asset-1,asset-2`, 503 |
| a slot row, three failed reads of the slots | 1: `/adm/v1/asset-slot/asset/asset-9`, 500 |
| an asset the server does not know, three reads, the row fails | 1: 404 |
| a metadata notification whose read fails three times (service on) | 1 |
| the poll fails twice, then the refresh twice, then the poll again | 1, then 3, still 3 |
| two uploads and a slot upload whose reads all answer | 0 |

Eight temporary edits, each restored: the single read always reporting, never reporting, and `fetchAsset`
dropping the flag (four cases red each); the bulk read never and always reporting; the slot read never and always
reporting (one case each); `isNotFound` without the helpers' shape (three cases, the deleted asset of a slot
among them).

### Changelog

One sub-bullet under the poll entry of `doc/changelog/3.0.0.md` (*Changed*).

### Worth knowing

- A tick that begins a streak lets every one of its requests report: one per licence and one per asset with a
  slot upload. So an outage with uploads and slot uploads waiting in one queue is written down once per such
  request, not once in all.
- A reported list read that is answered 204 is an empty list (the helper's rule); the unreported one refuses it.
  The backend answers 200 with a list.
- Not done, as told: the library's `hooks.onUntracked` and "Refresh only while the server may still finish";
  admin-dam offers no refresh on a failed row.

### Sentry, beside the logger (added after the review of the fixes)

In admin-dam `Sentry.httpClientIntegration()` (`src/main.ts:77`) captures every XHR answered 5xx on its own, so
`{ report }` decides only what the api error logger gets, which here is the console; what bounds repeated
identical events in Sentry is its default Dedupe. The Sentry setup was not changed.

---

## Review of the fixes (2026-10-08, library build of 14:18): two items

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 889 passed (889)   two runs, 20 s and 19 s
```

852 before; 33 cases are new here (`asset/assetReads.test.ts` 14 → 45, `fallback/notificationFallback.test.ts`
48 → 50), the other four are `dam-b`'s.

### 1. Opus B1: the deleted asset of a slot upload was written down three times

`readSlotFiles` now lives in the store and remembers the assets whose list of slots answered 404
(`slotAssetsGone`): such an asset is asked about with `report: false` until a read of its slots answers. The
settlement tells the reader `report: true` at each of the three reads, because the reader turns the 404 into an
answer (`[]`) and the settlement latches "written down" only for an asset its own single read found missing.

`fallback/notificationFallback.test.ts`: "writes down the deleted asset of a slot upload once, across the three
reads that fail its row" (one entry, 404, the row fails at the third read) and "writes it down again when the
slots were read in between and the asset is gone once more" (404, 404, an answer, then 404 three times: two
entries, six reads). Without the memory both go red; with a memory that never forgets, the second.

### 2. Opus proposal 2: the reported twins, and one answer for "no list"

**One request path each, not two.** In the round before, a reported read went through `useApiFetchItems` and an
unreported one through the client itself, and the two disagreed on an answer without a list: the helper reads a
204 as an empty list. Both of the poll's list reads now go through `useApiRequest` whichever way they are called,
with `report` handed on to `execute` and the list checked by the reader:

- `asset/api/assetApi.ts`: `fetchWaitingAssets(ids, licenceId, { report })` replaces
  `fetchAssetListByIdsReported`. The same addresses and the same groups of fifty as `fetchAssetListByIds`, which
  is untouched and is now the mass edit's alone.
- `asset/api/assetSlotApi.ts`: `fetchAssetSlotFiles(id, { report })`, one body.
- the store: `readAssets` and `readSlotFiles` pass `report: options?.report === true`; the 404 of the slot list is
  recognised by `apiErrorStatus` alone (`isNotFound` and its raw-client half are gone, so the review's wish to
  have that half reached by a case no longer applies).

What is refused, both ways: no body, a 204, a body without `data`, an object or a text in its place, a 404 or a
500 of the slot list, one refused request among several. Never an empty list.

What is written down when `report` is true: a request that fails, and an answer with no body at all (the helper
refuses that one itself). **Not written down by anyone:** a 200 whose body is there and carries no list; the
reader refuses it and has no way to the logger (`report` and `mapApiError` are not exported). The row still says
"metadata could not be loaded" after three such reads.

`asset/assetReads.test.ts` (rewritten, 45 cases): the mass edit's read as before, with a 204 added; then the
poll's two reads, every case run with a failure written down and with it kept quiet (`describe.each`): the
address and the groups of fifty, an asset the licence does not hold, the five answers without a list (each also
asserting whether it was written down), a refused request among several, a 404 and a 500 of the slot list. The
logger is the real hook, `setApiErrorLogger`.

Six temporary edits, each restored and each turning cases red: no memory of a gone asset, a memory that never
forgets, the bulk read without its list check, each of the two reads dropping `report`, the store not saying
`report: false`.

### What in "Owner decision 2" above no longer holds

- The table of the readers: `readAssets` and `readSlotFiles` are one path each now, as described here.
- "Why two ways to make one request": there is one way.
- "Worth knowing", second point (a reported list read answered 204 is an empty list): refused now.
- `fetchAssetListByIdsReported` no longer exists.

### Not done, as told

Opus M1 (a Sentry filter) and proposal 4 (the distributions poll reporting once per streak).

---

## Last item: the memory of a gone slot asset outlived its row (2026-10-08, final library build of 14:54)

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 891 passed (891)   two runs, 28 s and 24 s
```

889 before; two new cases. This is the final tree of the step: 54 files / 758 tests before the wiring.

**The finding (Opus, low).** `slotAssetsGone`, the set of asset ids whose slot list had answered 404, was forgotten
only by a slots read that answered. A gateway answering 404 three times failed the row and left the asset
remembered; a new upload into that slot during a 502 outage was then told to be quiet by the store although the
settlement let its first read report, and nothing of that outage reached the logger.

**The fix: the memory is by the row.** `asset/store/uploadQueuesStore.ts`: `goneAssetWrittenDown`, a `WeakSet` of
the slot rows for which a 404 of their asset's slot list was written down, in place of the set of ids. A read of
the slots of an asset is kept quiet only when every slot row of that asset in the queues is in it. Nothing has to
be forgotten when a row fails, is removed, or its queue is cleared or reset: the memory goes with the row, and
the next upload into the slot is another row. A read that answers clears it for the rows of the asset, as before.

Two things beyond the finding:

- A row is put into the set only when its 404 was let through to the logger. A 404 that arrives while the
  outage of another row keeps every request quiet is written down by the next read that is let, once.
- No filter on stopped rows. A stopped row is taken out of its queue in the same tick, so the filter could not be
  reached; a temporary edit that dropped it turned no case red, and it was removed.

**Tests**, `fallback/notificationFallback.test.ts` (50 → 52 cases), under "what is written down of the reads that
fail":

- "writes down what fails for the next upload into the slot of an asset that was gone for the one before": 404
  three times, the row fails, one entry; a second upload into the slot while the list answers 502: a second
  entry, 502, and one only across its three reads. Red with the memory by asset.
- "writes down the gone asset of a slot upload at the first read that is let, not before and once": the slots of
  another asset in the same queue answer 500 (written down); a second upload whose asset is gone is first read
  inside that outage, quietly; its 404 is written down at its next read and not again; the row fails at the third.

Four temporary edits, each restored, each turning a case red: one remembered row speaking for every row of the
asset; never forgetting on a read that answers; never remembering; remembering although nothing was written down.

### What in the section before no longer holds

"Review of the fixes", item 1: the store no longer has `slotAssetsGone`; the two cases named there still pass,
on the memory by row.

### Left on disk on purpose

`admin-dam/node_modules/.cache/vitest-tmp-dam-c/`.

---

## Owner decision: a finish request the server refused is final (2026-10-08, library build of 14:54)

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 904 passed (904)   two runs, 33 s and 21 s
```

891 before; thirteen new cases. No new library build was needed.

**Rule.** A finish request the server answered with a refusal (HTTP 4xx) is final: the server will not finish that
file. Such a row is failed and is not asked about. A finish request that got no answer (the network, a timeout) or
the answer of a server in trouble (5xx) is as before: the row is tracked `{ clientFailed: true }` (D5).

**What the upload `catch` is handed.** The finish request of all four types (`imageApi`, `audioApi`, `videoApi`,
`documentApi`, `uploadFinish`) goes to the client itself, `damClient().patch(…)`, and hands on what the client
rejects with: the client's own `AxiosError`, which the response interceptor passes through unchanged. So
`apiErrorStatus(e)` answers `undefined` for it; that function reads only the two error classes of the api
helpers. A condition written with it alone never holds: checked by a temporary edit, with which every one of the
eight refusal cases is red.

**The change.** `asset/store/uploadQueuesStore.ts`: `isRefusal(error)`, the status of the answer read off the
client's error (`isAxiosError(error) ? error.response?.status`) and, for a request made through the helpers, off
`apiErrorStatus`; true for 400 to 499. The track condition of the `catch` is
`finishAttempted() && !failedByServer && !isRefusal(e)`. The message, the alert, the status, the form, the counts
and `processUpload` are untouched. Slot uploads go through the same `catch`.

**Tests**, `fallback/notificationFallback.test.ts` (52 → 65 cases):

- "an upload whose finish request the server answers with a refusal": 400, 403, 404, 409, 422 and 499 each end
  `failed` with the text of the upload error, no timer of the settlement, no read in the minute after although the
  server would say the file is processed; one case with a validation body, whose field is what the row says; one
  for a file sent into a slot (no read of the slots).
- "an upload whose finish request gets no answer, or the answer of a server in trouble": a network error, a
  timeout, 500, 502 and 504 each leave one timer and come back `uploaded` with their form at the next read. The
  three older D5 cases are unchanged and green.

Four temporary edits, each restored and each turning cases red: no refusal condition (eight cases); 5xx counted
as a refusal (six, the three older D5 cases among them); the status read off the helpers' errors only (eight); no
answer counted as a refusal (two).

**Changelog.** Two sentences added to the sub-bullet of the poll entry that speaks of a failed finish request.

**Worth knowing.**
- Every 4xx is a refusal under the rule: 401 (the session ended while the file was being sent), 408 and 429 as
  well. Such a row is failed and not asked about; the file is on the server unfinished.
- A finish request answered with a 2xx other than 200 is rejected by the type APIs with no error at all
  (`reject()`); it is no refusal and is tracked, as before.
- The same holds for whoever writes the condition in the library's store: if its finish request goes to the client
  itself, `apiErrorStatus` alone will not see the status.

---

## Last check: the memory of a gone slot asset covers only rows that are asked about (2026-10-08, library build of 15:17)

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 906 passed (906)   two runs, 41 s and 44 s
```

904 before; two new cases. This is the final tree: 54 files / 758 tests before the wiring.

**The finding (Opus, low).** `slotRowsOf` answered every slot row of the asset in the queues, whatever its status,
and `readSlotFiles` both tested and wrote the memory for all of them, a row that still waited or was still being
sent included. So a row could be remembered for a 404 that was read before the poll ever asked about it (and the
first failure of its own reads was then kept quiet), and a row not yet asked about could make an answer that was
written down already look new (and it was written down again).

**The fix.** `asset/store/uploadQueuesStore.ts`: the store notes the rows it hands to the settlement
(`handedOver`, filled by a local `track()` that the three places which called `settlement.track` now call), and
`slotRowsOf` answers only those. A row is remembered, and looked at, only for a read made on its behalf.

**Tests**, `fallback/notificationFallback.test.ts` (65 → 67 cases), both red without the fix:

- "writes down what fails for a slot upload that was still being sent when the asset was gone for another": row A
  is sent, row W of the same asset has its chunk held; 404 three times, one entry, A fails, W still `uploading`;
  then W is sent and the list answers 502: a second entry, 502.
- "writes down the gone asset of a slot upload once although another file goes into a slot of it meanwhile": A's
  first 404 is written down; a second file starts into another slot and is still being sent; A's second and third
  reads write nothing more down, A fails.

Two temporary edits, each restored: every slot row counting again (these two cases red), and no row ever noted as
handed over (all six cases about a gone slot asset red).

No `rm`, no `cd`, no git writes in any round after the first; the stash and both unpushed commits of admin-dam are
as they were. `admin-dam/node_modules/.cache/vitest-tmp-dam-c/` is left on disk.

---

## Three older findings fixed, by the owner's approval (2026-10-08, library build of 15:17)

Findings 4, 7 and 5 of `dam-krok0.md` section 3.3 (there: 6, 8 and 3.2.5), which the step-0 tests pinned as they
were.

```
yarn lint:tsc / lint:oxlint / lint:eslint / lint:stylelint    exit 0
yarn format:check                                             clean (886 files)
yarn test --retry=0                                           Test Files 57 passed (57) · Tests 916 passed (916)   two runs, 37 s and 39 s
```

906 before; ten new cases, two existing cases turned around.

### 1. A refresh that could not find out says so

`asset/components/queue/AssetQueueEditable.vue`: on the outcome `'error'` (the read failed, the asset is gone, or
the row has no asset) `refreshItem` shows a warning. `'pending'` and `'settled'` are as they were.

The text: `stillUploadingOrProcessing` is the library's key (`common.damImage.queueItem.…`), admin-dam has no copy
of it, so there is no place "beside it" in admin-dam's files. The new key is the application's own,
`coreDam.asset.queueItem.refreshFailed`, in `locales/en/coreDam/asset.json` ("The item's state could not be
loaded. Try again.") and `locales/sk/coreDam/asset.json` ("Stav položky sa nepodarilo načítať. Skúste to znova.").
admin-dam has those two languages.

`queue/queueRefresh.test.ts` (15 → 20): the turned-around case, "can be pressed again after a read that failed,
which changes nothing in the row and says so"; new: a 404, a 500 and a 503 each say so and leave the row; a row
without an asset says so without a request; the text in both languages, the English one letter for letter.

### 2. Files taken through the limit dialog go where they were picked for

`asset/components/AssetUpload.vue`: `addToQueue(files)` is the one place that decides between a slot upload and an
ordinary one; `assetUpload` and `onDialogConfirm` both call it. `onDialogConfirm` called `addByFiles` whatever the
entry was for.

`upload/assetUploadLimit.test.ts` (5 → 7): a slot entry over a queue of 48, five files picked, the dialog
confirmed: two rows, each `slotFile` of `asset-9`, slot `bonus`, type `audio`, and both start requests go to
`/adm/v1/audio/asset/asset-9/slot-name/bonus`; and the same entry cancelled sends nothing.

### 3. Clearing a queue stops the uploads it holds

**The callers of `clearQueue`, and what each expects.** Every caller outside the store clears
`QUEUE_ID_MASS_EDIT`, the selection:

| Caller | Expects |
|---|---|
| `onClearConfirm` in `AssetFooterSelected.vue`, `AssetFooterSelectedFull.vue`, `ExternalProviderAssetFooterSelected.vue`, `ExternalProviderAssetFooterSelectedFull.vue` | the selection emptied, its panel hidden |
| `selectMultiple` in `assetListActions.ts` and `externalProviderAssetListActions.ts` | the old selection gone before the range is added |
| `listMounted` in the same two files | no selection left over from the last visit of the list |
| `importFromSelected` in `externalProviderAssetImport.ts` | the selection emptied after its rows were added to the upload queue as imports; the imports run in `QUEUE_ID_UPLOAD_GLOBAL`, which is not the queue cleared |
| `stopUpload` in the store | the queue replaced after every row was stopped |

The selection holds mass-edit rows (`Loading`, `Uploaded`, `Failed`) and rows picked at an external provider
(`Uploaded`, nothing sent). None of them is an upload under way, and no caller relies on one surviving.

**The change.** `asset/store/uploadQueuesStore.ts`, `clearQueue`: a row that is still under way (`Waiting`,
`Uploading`, `Processing`) is stopped as `stopUpload` stops it: `Stop`, the stop handle of its upload called, its
chunk aborted. The settlement is told by the `dropQueue` that was there already. A settled row is left as it is,
so for the selection nothing changes.

`queue/queueOperations.test.ts` (22 → 24): the turned-around case, "stops the uploads it holds: their chunks are
aborted, and nothing more is sent" (was "does not abort an upload that is on the wire"); new: an upload whose
start request is on the wire (no chunk follows the answer), and an import on the wire (not handed over, not
read) with the other queue left running. `fallback/notificationFallback.test.ts` (67 → 68): a row the server
still works on is `stop` after `clearQueue`, as after `stopUpload`.

Left alone: `reset()` empties every queue without stopping anything, and has no caller.

### Checked, and left as it is: a start answer without an identifier

It is not the library's defect. The library refuses to send a chunk without a file id and then sleeps through its
three retries, 13 s with no request. admin-dam has no such guard and sends: the row gets `assetId` and `fileId`
`undefined`, and the chunk goes to `/adm/v1/image/undefined/chunk`. Observed with a temporary case (removed) on the
fake server, which takes any id: `POST …/image/undefined/chunk`, `PATCH …/image/undefined/uploaded`, the row
`processing`, then the poll asking `GET /adm/v1/asset/:id`. A real server would refuse the chunk; a refusal that
is not a validation answer is tried four times over the same 13 s and the row fails with the unknown-error text.
So the wait is the same and the cause is the same (the start answer is not checked), but here requests go out
with `undefined` in the address. The same remedy would fit: refuse a start answer without `id` and `asset` in
`uploadInit`. Not done: the brief said to leave it if it differs.

### Six temporary edits, each restored and each turning cases red

No warning on `'error'` (five cases); the dialog adding ordinary uploads (one); clearing that stops nothing
(four); clearing that stops only what is being sent (two); clearing that marks the rows and stops no request
(two); clearing that stops settled rows too (one, the unchanged step-0 case of the selection).

### Existing cases turned around

- `queue/queueRefresh.test.ts` › "can be pressed again after a read that failed, which changes nothing and says
  nothing" → "…changes nothing in the row and says so".
- `queue/queueOperations.test.ts` › "does not abort an upload that is on the wire" → "stops the uploads it
  holds: their chunks are aborted, and nothing more is sent".

Finding 7 had no pinning case (`dam-krok0.md` 3.3.8: "not pinned, as report 9 asked").

### Changelog

Three sub-bullets under *Fixed → Upload queue* of `doc/changelog/3.0.0.md`.

### Waiting for

The library build in which `enabled` is read without regard to case; then
`test/init/startNotificationService.test.ts` and the deployment entry of the changelog.

## A start answer without its identifiers is a refused start (the lead's go-ahead)

`shared/services/upload/uploadService.ts`, `uploadInit`: an answer that lacks `id` or `asset` rejects before
anything of it is written to the row, with the same condition the library has (`!res?.id || !res?.asset`).
The store's `catch` then does what it does for a start the server refused without a reason: `failed`,
`system.uploadErrors.unknownError` on the row and in one alert, counts recalculated, `processUpload` gives the
place away. `finishAttempted()` is false, so the row is not handed to the settlement. A slot row keeps the
`assetId` it was added with (it is the asset the slot belongs to); an ordinary row keeps `null`.

An answer with no body at all ended the same way before the change (`res.asset` threw inside `.then`, which the
`.catch` behind it turned into a rejection), so `?.` changes only which error object is thrown; that case passes
with or without the guard and is there for the record.

### The external import has the same hole, milder, and is unchanged

`externalProviderImportService.ts`, `importInit`, writes `res.asset` and `res.id` unchecked and moves the row to
`processing`; the store hands it to the settlement. Observed with a temporary case (removed, file restored from
its backup) on the fake server:

- answer `{}` or `{ id }`: the row is `processing` with `assetId` `undefined`; the poll reads
  `GET /adm/v1/asset/:id` (the address with its placeholder unfilled) at 5, 10 and 16 s, and the third answer
  without the asset fails the row with `system.uploadErrors.unknownError`. No alert. Four requests in all.
- answer `{ asset }` without `id`: the same on the fake, which does not know that asset, with the read going to
  `…/asset/asset-1`. Against a real server the asset would be there and the row would have no file id to be
  matched by; what the row does then was not looked at.

No chunk goes out (an import sends none), and the place in the queue is free as soon as the start answers, so
what is left is 16 s of a row that looks alive and three reads of a wrong address.

### Tests

`queue/uploadFailures.test.ts`, 8 → 19 cases, new block "an upload whose start is answered without its file or
its asset":

- five answers (no `id`, no `asset`, both `null`, `{}`, no body): `failed` at once with the row error of a
  refused start, `canEditMetadata` false, `assetId`/`fileId` still `null`, one alert, counts `[1, 1]`, the start
  as the only request, and still the only one after 30 minutes (no chunk, no finish, no read by the poll);
- the four file types, each with an answer `{}`: one request, the start to its own address, after the time
  every retry would have taken;
- a slot upload answered `{ id }` without `asset`: `failed`, the row keeps `asset-9`, one request;
- three waiting files, the first answered `{}`: `failed, processing, processing`, one alert.

Five temporary edits of the guard, each restored: no guard (10 red: every case but "no body"), `id` only (2
red), `asset` only (1 red), the row written before the check (6 red), no `?.` (none red, see above).

No step-0 case pinned the old behaviour, so none was turned around.

### Checks

`lint:tsc`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` exit 0; `format:check` clean (886 files);
`yarn test --retry=0` 57 files / 927 tests, twice (916 + 11). Library build in `node_modules` unchanged
(15:18). Stash and the two unpushed commits as they were. Nothing to delete.

### Changelog

One sub-bullet under *Fixed → Upload queue* of `doc/changelog/3.0.0.md`.

### Still waiting for

The library build in which `enabled` is read without regard to case.

## The same guard for the import from an external provider (the lead's go-ahead)

This replaces "is unchanged" of the section above. `externalProviderImportService.ts`, `importInit`: an answer
that lacks `id` or `asset` throws inside `.then`, before anything is written to the row, and so ends in the
`.catch` behind it, where a refused import ends today: `failed`, `error.hasError` (no message, as today), the
unknown-error alert, the promise resolved. The row is not `processing`, so the store does not hand it to the
settlement, recalculates the counts and gives the place away. The duplicate branch (`error_field_not_unique`)
and a proper answer are untouched: a plain `Error` carries no validation data.

An answer with no body ended there before too (`res.asset` threw), as with the upload start; its case passes
with or without the guard.

### Tests

`queue/queueOperations.test.ts`, 24 → 29 cases, in "an import from an external provider in the queue":

- four answers (`{}`, `{ id }`, `{ asset }`, no body): `failed` at once, not a duplicate, the row error of a
  refused import, `assetId`/`fileId` still `null`, one alert, counts `[1, 1]`, the import as the only request,
  and still the only one, with still one alert, after 30 minutes;
- three waiting imports, the first answered `{}`: `failed, processing, processing`, one alert.

Four temporary edits of the guard, each restored: no guard (4 red: every case but "no body"), `id` only (1),
`asset` only (1), the row written before the check (5).

### Changelog

The sub-bullet of the upload start now says the import too. It gives no number of seconds for the old
behaviour: the 16 s and the three reads were seen on the fake server, which answers 404 for the address with
its placeholder unfilled; a real server answering otherwise would put the reads on the error ladder instead.

### Checks

`lint:tsc`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` exit 0; `format:check` clean (886 files);
`yarn test --retry=0` 57 files / 932 tests, twice (927 + 5). Library build in `node_modules` unchanged
(15:18). Stash and the two unpushed commits as they were. Nothing to delete.

### Still waiting for

The library build in which `enabled` is read without regard to case; possibly one more item (the provider's
metadata on rows imported from the selection), on the owner's answer.

## The switch of the notification service read without regard to case (library build of 16:36)

No code of admin-dam changed: `EnvConfigService.ts` and `main.ts` hand the value on as the file has it, and the
library's `normalizeDamNotificationOptions` says what it means — on for `true`, or for a text that is `true`
once trimmed and lower-cased, with a non-empty address.

### Tests

- `init/startNotificationService.test.ts`, 11 → 16 cases: the service on, one socket to the address and the
  first read at ten seconds, now for `true`, `"true"`, `"True"` and `" TRUE "`; off, no socket and the first
  read at five seconds, now also for `"False"`, `"1"` and `"yes"`.
- `init/envConfig.test.ts`, 14 → 15: `" TRUE "` is handed on untrimmed, as the other values are.

The new "on" cases need the build of 16:36; on the one before, `"True"` and `" TRUE "` were off. Three
temporary edits of `main.ts`, each restored: passing the switch on only as a boolean (3 red: the three texts
that are on), passing on only `true` and `"true"` (2 red: `"True"`, `" TRUE "`), taking any text but `"false"`
for on (3 red: `"False"`, `"1"`, `"yes"`).

### Changelog

The deployment entry about the `notification` block of `doc/changelog/3.0.0.md` says what switches the service
on now, and names `"1"`, `"yes"` and an empty text beside `"false"` among what leaves it off.

### Checks, on the final tree

`lint:tsc`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` exit 0; `format:check` clean (886 files);
`yarn test --retry=0` 57 files / 938 tests, twice (932 + 6). Stash and the two unpushed commits as they were.
Nothing to delete. e2e not run.

Not used by admin-dam: the optional `endPointAuthor` / `endPointKeyword` of the DAM configuration.

## Review cycle 1 of the third set

The fix list of the lead after Codex and Opus read the last batch (failed refresh, limit dialog, `clearQueue`,
the two start-answer guards, the switch of the service). Seven items, all done.

### 1. A refresh that itself fails the row no longer says "try again" (Opus B1, T1)

`AssetQueueEditable.vue`, `refreshItem`: the status of the row is noted before the await, and the warning for
`'error'` is shown only while the row still has it. `'error'` is also what a read answers that found the asset
gone, and for a row the queue asks about that miss is counted: the third one fails the row, whoever asked.

`queue/queueRefresh.test.ts`, 20 → 22: a row sent through `processUpload`, its asset deleted, the poll missing
it at 5 and 10 s, then the refresh — third read, row `failed`, no warning; and the twin with the refresh as the
first miss — row unchanged, the warning shown. Red without the status check: the first of the two.

### 2. The library's text (Opus proposal 1)

The warning is `common.damImage.queueItem.refreshFailed`, which the installed build has in en, sk and cs with
the wording the owner asked for. admin-dam's `coreDam.asset.queueItem.refreshFailed` is gone from both locale
files, which are again as in `HEAD`. The case "has its text in both languages of the application" now reads the
key out of the application's composed messages (`@/locales/en`, `@/locales/sk`) through a vue-i18n instance —
the library ships its messages compiled, so the JSON cannot be compared directly. With the old key six cases
are red.

### 3. The answer of an import whose row was stopped meanwhile (Codex)

`externalProviderImportService.ts`, `.then`: a row that is `stop` resolves at once and takes nothing of the
answer. Before, a late answer without its ids went through the new guard into `.catch`, which made the
discarded row `failed` and showed the unknown-error alert; a proper late answer wrote its ids into the
discarded row. `.catch` is not touched: a request that fails after a stop still fails the row and alerts, as
before this work (the lead's item 19).

`queue/queueOperations.test.ts`: four cases, `clearQueue` and `stopUpload` each with an answer `{}` and with a
proper one — the row stays `stop` with `null` ids and no error, no alert, one request. Five red without the
check (these and the on-the-wire case below).

### 4. `clearQueue` stops every upload that still has its stop handle (Opus proposal 2)

`uploadQueuesStore.ts`: a row is passed over only when it is not under way by its status and has no stop
handle. A `failed` notification can settle a row whose file is still being sent; `clearQueue` left that upload
going. Pinned in `queueOperations.test.ts` with two files being sent, the first failed by a notification, then
the queue cleared: every chunk on the wire aborted, all rows `stop`, no request after. Red with the status
alone; with the handle alone five other cases are red (waiting rows, imports, rows the server works on have no
handle).

### 5. `EnvConfig.ts`

The comment of `notification.enabled` says what the build does: on for `true`, or for the text `true` in
whatever case and with spaces around it; only with a non-empty address.

### 6. Changelog, two entries reworded as paths closed (Opus B3)

- the refresh of a row with no asset: no row offers the button without an asset
  (`AssetQueueItemEditable.vue`, `refresh` emits only with `assetId`);
- the limit dialog on an upload into a slot: the one such upload (`AssetSlotListItem.vue`) is single-file, so
  the dialog opens only with the queue at its limit, where the confirm is not rendered.

Also added there: that nothing is said when the refresh is the read that fails the row, and that clearing
stops a file still being sent whatever its row says.

### 7. Three assertions that held without their fix (Opus T2)

- `queueOperations.test.ts`, the import on the wire when its queue is cleared: renamed to "discards an import
  that is on the wire, whose answer it does not take, and leaves the other queues running"; it now asserts that
  the ids stay `null` (red without item 3), and the comment on `assetReads` says that it held before too.
  Checked: with `clearQueue` stopping nothing and the two row assertions taken out, the case passes.
- `queueOperations.test.ts`, the import answered without its ids among three: renamed to "fails only the
  import answered without its ids, and the imports that wait go on". An import is one request, so its place was
  free either way.
- `uploadFailures.test.ts`, "gives its place in the queue to the upload that waits": chose to make the held
  place visible. `support/fakeDam.ts` answers 404 to a chunk and to a finish addressed to `undefined`, and the
  case answers the first two starts without ids. With the guard: `failed, failed, processing` at once. Without
  it: `uploading, uploading, waiting`. (With one bad answer among three the third file took the place of the
  second, guard or not.) No other test relied on the fake taking `undefined`.

### NEW, seen on the way, not fixed

- A row a `failed` notification settles while its file is still being sent: the upload goes on to its end —
  further chunks and the finish request for a file the server has already failed — and, the row no longer
  counting as uploading, its place is given away at once, so three files are being sent with a limit of two
  (the new case of item 4 shows it before the clear: `failed, uploading, uploading`, three chunks on the wire).
- The library's own `useUploadQueueItemRefresh` has item 1's defect in the installed build: it warns
  `refreshFailed` for every `'error'`, whatever became of the row. An outcome of its own for "this read failed
  the row" would let neither side compare statuses.

### Checks

`lint:tsc`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` exit 0; `format:check` clean (886 files);
`yarn test --retry=0` 57 files / 945 tests, twice (938 + 7: `queueRefresh` 20 → 22, `queueOperations` 29 → 34).
Library build in `node_modules` 16:36. Stash and the two unpushed commits as they were. Nothing to delete.
e2e not run.

## Against the library build of 17:24: the refresh answers `'settled'` for the miss that gives the row up

Whole checks green on that build with no change. No admin-dam case pinned `'error'` on the third missing
refresh, so none was turned around: the one case that asserts the outcome
(`fallback/notificationFallback.test.ts`, "writes down every read the refresh button asked for…") is about
reads that fail with 500, which still answer `'error'`.

The status check of `AssetQueueEditable.vue` stays. On this build the third-miss case of
`queue/queueRefresh.test.ts` passes without it (the library's outcome covers it), so nothing pinned the check
any more. Added one case that does, 22 → 23: a `failed` notification settles the row while the refresh's read
is on the wire, and that read then fails with 500 — outcome `'error'`, row `failed`, no "try again". Red
without the check. The comment at the check says this now, and the block is named "the refresh of a row that
is failed by the time it answers".

Where the check and the library's outcome can still differ, read off `readTargetNow`:

- a failed read (`'error'`) of a row something else settled meanwhile: a `failed` or duplicate notification, or
  the user stopping the row. The check hides the warning; pinned above for the notification.
- a miss that gives the clicked row up while another row of the same asset and file is still tracked or marked
  (`'error'` by the library, for the other row's sake). The check hides the warning for the clicked row, which
  has just failed. Not reachable from admin-dam's screens as far as I can see: no two tracked rows share an
  asset and a file, and a mass-edit row is neither tracked nor marked. Not pinned, and not decided by me
  whether a warning is due there.

A refresh's own failed read writes nothing into the row (it counts no failure). **Corrected in review cycle 2:**
that does not mean the check never hid the warning for a read that merely failed. The row can change for a
reason that settles nothing while the read is on the wire — a file being sent turns `processing` when its
finish request is answered — and the check as it stood here (any change of status) then said nothing, though
the read had failed and nothing was known of the row. I looked only at changes that end a row and missed that
one. See "Review cycle 2 of the third set" below.

### Checks

`lint:tsc`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` exit 0; `format:check` clean (886 files);
`yarn test --retry=0` 57 files / 946 tests, twice (945 + 1). Stash and the two unpushed commits as they were.
Nothing to delete. e2e not run.

## Review cycle 2 of the third set

One finding, found by both reviewers, and one test gap. Items 2 to 4 of cycle 1 passed clean.

### The status check hid a warning that was due

`AssetQueueEditable.vue`: the check of cycle 1 took any change of the row's status for "the row says what
became of it". A row offered refresh while its file is still being sent (after twenty seconds) turns
`processing` when the finish request is answered; if the refresh's read then fails, the outcome is `'error'`,
the status has changed, and nothing was said — though nothing had settled the row and the read did fail.

The rule now, as the lead gave it: on `'error'` the warning is shown unless the row came to an end during the
refresh — its status changed, and is now `Failed`, `Uploaded` or `Stop`. `Uploading` to `Processing` is not an
ending.

### Tests

`queue/queueRefresh.test.ts`, 23 → 26:

- the press on a row still being sent: chunk held, read held, the chunk and the finish answered (row
  `processing`), the read fails with 500 — the warning is shown, the row unchanged;
- beside the kept case of the `failed` notification, the other two endings while the read is failing: a
  duplicate notification (`uploaded`) and the user stopping the row (`stop`) — no warning. These wait on the
  button of a second row, the first being gone or changed.

Seven temporary edits of the check, each restored and each with red cases: any change of status as an ending
(the new press case); always warn (the three endings); an ending whatever the status was before ("says so for
a row that has no asset", an `uploaded` row); each of the three states taken out (its own case); `Processing`
added as an ending (the new press case).

The sentence of the previous section, "the check never hides the warning for a read that merely failed", is
corrected in place.

### Checks

My tree, with the nine files `dam-w4` has added since left out of the run: `yarn vitest run` over 57 files /
949 tests, twice (946 + 3). `lint:oxlint`, `lint:eslint`, `lint:stylelint` exit 0 over the whole tree.

Over the whole tree, which `dam-w4` is writing into at the same time (none of these files are mine, none
touched): `lint:tsc` exit 1 with one error, `src/test/queue/overlaySave.test.ts(141,16)` TS2339 `happyDOM`;
`format:check` names eight files, all `dam-w4`'s new tests; `yarn test` 67 files / 1147 tests at the last run
with two red cases in `src/test/queue/queueRowKeywordsAuthors.test.ts` (an earlier run had one red in
`queueRowActions.test.ts`, the one between them was all green at 64 files / 1117).

Library build 17:24. Stash and the two unpushed commits as they were. Nothing to delete. e2e not run.

### NEW, not fixed

Nothing new in the product from this round.

## Review cycle 3 of the third set

The rule of cycle 2 passed. One finding (Codex) and one changelog line (Opus).

### The pressed row is told by itself

`AssetQueueItemEditable.vue` sends the row with its refresh event (`item`, beside `index` and `assetId`, which
stay in the payload); `AssetQueueEditable.vue` takes that row, and asks nothing when it is no longer in the
list. Before, the handler took the row at the sent position if it had the sent asset, else the first row of
that asset: with a row before it just removed and the rendered positions not yet caught up, two rows of one
asset were mistaken for each other — the refresh read the other row's file, and the warning rule looked at the
other row's status. `index` is no longer read by the list.

`queue/queueRefresh.test.ts`, 26 → 29, block "the refresh pressed while the list moves under it"; the stand-in
row of that file sends the row as the real one does:

- three rows, the last two of one asset with a file each; the first is removed and, before anything is drawn
  again, the refresh of the second or of the third is pressed — the asset is read once and only the pressed
  row is settled. By position the second was taken for the third; by asset the third for the second;
- a row that has left the queue by the time its button is pressed: no request, no warning, the buttons free.

Temporary edits, each restored: position and asset as before (all three red); no check that the row is still
in the list (the third red); the real row not sending itself — none of mine red, since my file draws a
stand-in row, but five cases of `dam-w4`'s `queue/queueRowActions.test.ts`, which presses the real button of
the real row in the real list. So that half is pinned there. With the fix in place that file is green as it
is (17 cases): no case of `dam-w4` pinned the payload.

### Changelog

The refresh sub-bullet of `doc/changelog/3.0.0.md` names every silent case now: the read that fails the row
itself, and a notification or a stop that ends the row while the read is failing; that sending → processing
is not an ending; and that the refresh asks about the row it was pressed on.

### Checks, whole tree (with `dam-w4`'s files, which are clean now)

`lint:tsc`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` exit 0; `format:check` clean (897 files);
`yarn test --retry=0` 67 files / 1153 tests, twice. Library build 17:24. Stash and the two unpushed commits as
they were. Nothing to delete. e2e not run.

### NEW, not fixed

- The delete button of a row has a milder form of what the refresh had: after the asset is deleted on the
  server the row sends its asset id (`removeItem`), and `removeByAssetId` takes out the first row of the queue
  that holds that asset. Of two rows of one asset, Delete on the second takes the first out of the list and
  leaves the pressed one, a row of an asset that no longer exists. Read off the code, not run. Cancel is not
  affected (`stopItemUpload` goes by the row itself).
