# 4 — Upload service, API layer and entry points: LIB vs DAM

Read-only analysis. Nothing was built, run or tested; every statement about runtime behaviour is from reading the
code. Anything not read on the cited line is marked **inferred**.

State read: common-admin `next` @ `49bd815b`, admin-dam `next` @ `ba8a66ec`.
DAM consumes the library as a published package: `"@anzusystems/common-admin": "1.47.0-beta.dev-1790143991"`
(`admin-dam/package.json:41`); the library source is at `1.47.0-beta.dev-1790167636` (`common-admin/package.json:38`).

## Path aliases

| Alias | File |
|---|---|
| `L:us` | `common-admin/src/domains/dam/uploadQueue/composables/uploadService.ts` |
| `L:ua` | `common-admin/src/domains/dam/api/uploadApi.ts` |
| `L:ia` | `common-admin/src/domains/dam/api/damImageApi.ts` |
| `L:aa` | `common-admin/src/domains/dam/api/damAssetApi.ts` |
| `L:cs` | `common-admin/src/domains/dam/uploadQueue/composables/damUploadChunkSize.ts` |
| `L:st` | `common-admin/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts` |
| `L:fc` | `common-admin/src/domains/ui/file/composables/formatAndSizeCheck.ts` |
| `D:us` | `admin-dam/src/domains/coreDam/shared/services/upload/uploadService.ts` |
| `D:ep` | `admin-dam/src/domains/coreDam/shared/services/upload/externalProviderImportService.ts` |
| `D:fv` | `admin-dam/src/domains/coreDam/shared/services/upload/fileValidation.ts` |
| `D:fa` | `admin-dam/src/domains/coreDam/asset/api/fileApi.ts` |
| `D:ia` | `admin-dam/src/domains/coreDam/asset/api/imageApi.ts` (audio/video/document siblings alongside) |
| `D:aa` | `admin-dam/src/domains/coreDam/asset/api/assetApi.ts` |
| `D:st` | `admin-dam/src/domains/coreDam/asset/store/uploadQueuesStore.ts` |
| `D:au` | `admin-dam/src/domains/coreDam/asset/components/AssetUpload.vue` |
| `D:fu` | `admin-dam/src/domains/coreDam/shared/components/FileUpload.vue` |

## Classes used

- **STRUCTURAL** — other asset types, slots, external providers, several queues, or pure wiring (how the client,
  endpoint, i18n and config reach the code).
- **PRODUCT** — deliberate, user-visible.
- **DRIFT-BUG** — one side has a defect the other fixed or never had.
- **UNKNOWN** — cannot be settled from the two repos; what would settle it is named.
- **EQUIVALENT** — my own extra label: the code differs, the outcome does not (usually two independent fixes of the
  same defect). Listed because a merge has to pick one form.

---

## 0. History that explains the diff

- The library's upload was first committed in `2c202a9b` (2024-01-02, "Release/1.40.0 (#155)") at
  `src/components/damImage/uploadQueue/…`. DAM dropped its local `chunkSizeService.ts`, `UploadQueueItemFactory.ts` and
  `types/coreDam/UploadQueue.ts` in `e91246c6` (2023-12-11, "wip (#153)") in favour of the library's.
- Diffing the library's first `uploadService.ts` against DAM's at `e91246c6`, the only non-wiring differences were
  already: (a) `useDamUploadChunkSize()` without the timeout argument, (b) the `if (!queueItem.fileId) reject()` guard,
  (c) `queueItem.file.size < 1` in the empty-file check. Everything else was the same file.
- After that the two were fixed independently:
  - LIB `f15b1b5d` (2025-11-27) "several dam upload changes / fixes + added logging": ArrayBuffer check, chunk `File`
    type, 400-on-last-attempt message, `stopSpeedCheck`, chunk validation + Sentry, `Content-Type: undefined`.
  - LIB `00ec7494` (2025-12-12) "add 4th retry" (fallback tries 3→4), `0d25344e` (2025-12-12) "add error".
  - LIB `cc23d2fa` (2026-09-01) "fix(damImageApi): send the chunk upload timeout in the request config".
  - LIB `c32bf36a` (2026-09-25) "perf: the upload queue's region editor and rusha load on first use".
  - LIB `aef095d0` (2026-09-28) "feat!: 2.0.0 fixes…": AbortController, `isStopped`, cancel short-circuit, awaited
    fallback, `armNotificationFallback`.
  - LIB `387bddb4` (2026-09-29) and `9d6f62ca` (2026-10-07): finish does not overwrite a settled/stopped status.
  - DAM `0ff4cd9b` (2026-09-01) "Feature/#85974/naxos photo migration (#271)": `resolveUploadErrorMessage`.
  - DAM `b825c77e` (2026-09-05) "fix(upload): stop an upload when it is cancelled, and stop collecting interceptors".
  - DAM `3a242125` (2026-09-06) "fix(dam): refs #86567 upload queue, list and start-up fixes with a test suite".
  - DAM `e577c589` (2026-09-28) "feat!: common-admin 2.0.0 building blocks…": AbortController.
  - DAM `13812f57` (2026-10-07): fallback tries 3→4, fallback also asks for metadata, duplicate carries origin file.

---

## A. `uploadService.ts` side by side

`diff` of the two files gives 30 hunks. Grouped by topic below; every hunk is covered.

### A.1 Identical (no hunk, or type-only)

| Topic | LIB | DAM |
|---|---|---|
| Retry constants `CHUNK_MAX_RETRY = 4`, `SPEED_CHECK_INTERVAL = 1000`, `CHUNK_RETRY_INTERVAL = 1000`, `CHUNK_RETRY_MULTIPLY = 3` | `L:us:20-24` | `D:us:17-21` |
| `sleep` | `L:us:84-86` | `D:us:95-97` |
| `progressCallback` (speed sample = bytes since last event / seconds since last event) | `L:us:106-120` | `D:us:121-135` |
| Speed tick: last 15 samples, `avg = ceil(sum/len)`, `remaining = ceil(size × (100 − progress)/100)`, `estimate = ceil(remaining/avg)`, every 1000 ms | `L:us:201-219` | `D:us:196-216` |
| Progress percent `(i / filesize) × 100`, updated once per finished chunk | `L:us:277` | `D:us:270` |
| SHA: rusha hash, `update(arrayBuffer)` after each chunk that succeeded, `digest('hex')` sent on finish | `L:us:169,282` | `D:us:170,276` |
| One `AbortController` per chunk on the item, `currentChunkIndex = offset` | `L:us:160-161` | `D:us:157-158` |
| A validation response (422 with `error === validation` and `fields`, `common-admin/src/shared/error/AnzuApiValidationError.ts:22-29`) ends the chunk at once, no retry, message from fields | `L:us:181-185` | `D:us:175-179` |
| Field → message mapping (`size`, `offset`, `mimeType`, default) | `L:us:44-59` | `D:us:38-53` |
| After `uploadStart`: `assetId = res.asset`, `fileId = res.id` | `L:us:252-253` | `D:us:239-240` |
| `uploadStop(abortController)` | `L:us:292-294` | `D:us:295-297` |

Type-only hunks: `uploadCallback: any` vs a typed callback (`L:us:88` / `D:us:99-102`); `speedStack: any[]` vs
`number[]` (`L:us:94` / `D:us:107`); timer id `null` vs `undefined` (`L:us:98` / `D:us:111`); the guard
`!isUndefined(uploadCallback)` inside the tick (`D:us:203-205`) against an unguarded call (`L:us:208`) — the tick only
starts when the callback exists on both sides (`L:us:263` / `D:us:256`).

### A.2 Hunk by hunk

| # | Topic | LIB | DAM | Kind | Class |
|---|---|---|---|---|---|
| 1 | Imports and wiring | internal paths, `commonT`, client + endpoints from `useCommonAdminCoreDamOptions()` (`L:us:1-18,31-32,89`) | everything from `@anzusystems/common-admin`, `i18n.global`, `envConfig`, `fileApi` (`D:us:1-16`) | cosmetic | STRUCTURAL (wiring) |
| 2 | Finish call | passes `damClient, endPointAsset, endPointImage, item, sha, uploadStatusFallback` (`L:us:30-34`) | `uploadFinish(item, sha)`; the flag is read inside `fileApi` (`D:us:26-28`, `D:fa:199`) | cosmetic | STRUCTURAL (wiring) |
| 3 | Message keys | `common.damImage.uploadErrors.*` (`L:us:40-60`) | `system.uploadErrors.*` (`D:us:34-54`) | behavioural: the wording differs, e.g. en "Invalid size" (`common-admin/src/locales/en/common/damImage.json:208`) vs "Incorrect size" (`admin-dam/src/locales/en/system.json:99`) | PRODUCT (text) |
| 4 | Guard in `handleValidationErrorMessage` | `!error \|\| !error.response…` (`L:us:38`) | `!isAxiosError(error) \|\| …` (`D:us:32`) | cosmetic | EQUIVALENT |
| 5 | Failure message for the row | none; only the chunk paths write `error.message` (`L:us:176,183`); the store sets `hasError`/`Failed` and leaves the message as it is (`L:st:206-211`) | exported `resolveUploadErrorMessage` (forbidden operation → `error.apiForbiddenOperation.<detail>`, validation → fields, else unknown) (`D:us:57-77`); the store writes it on every failure and shows one alert per distinct reason (`D:st:467-482`) | behavioural, visible | PRODUCT. Added by DAM `0ff4cd9b` "Feature/#85974/naxos photo migration (#271)". In LIB a refused start or finish leaves a failed row with an empty message; the row prints the message only when it has one (`common-admin/src/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue:257-261`). |
| 6 | `readFile` result | typed `ArrayBuffer`, rejects when the result is not one (`L:us:63-75`) | cast `as string` (`D:us:79-86`) although it calls `readAsArrayBuffer` (`D:us:91`) | type-only at runtime: `readAsArrayBuffer` yields an ArrayBuffer | DRIFT-BUG (types): LIB is right, from `f15b1b5d`. DAM's wrong type propagates as `buffer: string` (`D:fa:246`, `D:ia:72`) and a `@ts-ignore` (`D:us:139`). |
| 7 | Hash creation | lazy: `import('rusha')` under a 15 s `withTimeout`, on `uploadInit` (`L:us:25,235-242`); type-only import (`L:us:17`) | static `import rusha from 'rusha'`, hash created when `useUpload` is called (`D:us:11,114`) | behavioural: a new failure mode (chunk does not load → the item fails before any request), no difference on the happy path | PRODUCT-by-intent on the LIB side (perf): `c32bf36a` "perf: the upload queue's region editor and rusha load on first use". |
| 8 | Status taken before the first await | `if (file && size > 0) status = Uploading` (`L:us:230-232`) | not needed: `uploadInit` has no await before `status = Uploading` (`D:us:226-235`) | consequence of #7 | STRUCTURAL to #7 |
| 9 | Chunk-size thresholds | `useDamUploadChunkSize()` → default 30 (`L:us:100`, `L:cs:7`) | `useDamUploadChunkSize(envConfig.dam.apiTimeout)` (`D:us:115`) | behavioural: thresholds are `timeout/5`, `/4`, `/2` (`L:cs:11-13`) | UNKNOWN. LIB never passed it (same in the first copy `2c202a9b`). The plugin option `coreDam.apiTimeout` exists (`common-admin/src/AnzuSystemsCommonAdmin.ts:95`, returned at `…/commonAdminCoreDamOptions.ts:86`) and nothing in `src/` reads it (grep). Settled by: whether the CMS admins are meant to adapt chunks to their own timeout or to the fixed 30 s. |
| 10 | `fileId` guard before a chunk | `if (!queueItem.fileId) reject()` (`L:us:124-127`) | passes `queueItem.fileId` under `@ts-ignore` (`D:us:139-140`); a null id would post to `/adm/v1/<type>/null/chunk` (**inferred** from `D:ia:79`) | defensive | DRIFT-BUG (minor): LIB is right. Reachable only if the start response carries no id. |
| 11 | Chunk `File` type | `new File([data], name, { type: file.type })` (`L:us:154-156,189-191`) | `new File([data], name)` (`D:us:155,186`) | on the wire: the multipart part's own content type (**inferred**: browsers send `application/octet-stream` for an untyped File) | UNKNOWN. LIB `f15b1b5d`. Settled by: whether core-dam's chunk action reads the part's mime type. |
| 12 | Stop: how it is detected | reads `queueItem.status === Stop` (`L:us:27-28`), checked after the hash loads (`:241`), before the loop (`:271`), after each chunk is read (`:159`), in the retry catch (`:173`), after the loop (`:281`) | a closure flag set by the returned `stop()` (`D:us:113,282-286`), checked before and after reading each chunk (`:151,154`), after the retry sleep (`:189`), in the start response (`:241-246`), at the loop top (`:267`), after the loop (`:274`) | same outcome | EQUIVALENT (parallel fixes: LIB `c32bf36a` + `aef095d0`; DAM `b825c77e` + `3a242125`). The store contract differs: DAM keeps a `WeakMap` of `stop` handles (`D:st:58,452,353,409,427`); LIB only sets the status and aborts the controller (`L:st:493-494,508-511,559-567`). |
| 13 | A cancelled chunk in the retry catch | `if (axios.isCancel(error) \|\| isStopped(queueItem)) return Promise.reject(error)` (`L:us:173`) | no such branch; the catch goes on to `sleep(sleepTime)` and only then sees `stopped` (`D:us:181-189`) | latency: after a stop DAM's upload promise settles 1–9 s later; nothing visible, the store returns on `Stop` (`D:st:460-463`) and has already refilled the slot (`D:st:359`) | EQUIVALENT; LIB's form is the direct one. |
| 14 | Progress baseline per attempt | not reset; `lastLoaded` returns to 0 only when an attempt reaches `loaded === total` (`L:us:116`) | `lastLoaded = 0; lastTimestamp = 0` at the start of every attempt (`D:us:164-167`) | behavioural | **DRIFT-BUG in LIB; DAM is right.** DAM `3a242125`, comment: "Axios starts `loaded` from zero on each attempt, so the previous baseline makes the retry's first sample hugely negative - which collapses the adaptive chunk size." In LIB a chunk that failed mid-flight leaves `lastLoaded > 0`, so the retry's first sample is `loaded − lastLoaded < 0` (`L:us:115`); a negative average drives `updateChunkSize` to the minimum (`L:cs:20,27-31,41-43`) and makes the remaining time negative (`L:us:208`). Side effect of DAM's form, **inferred**: it also runs on attempt 1 of every chunk, so the first progress event of each chunk only sets the timestamp (`D:us:124-128`) and the gap between two chunks no longer counts as upload time. |
| 15 | HTTP 400 on the last attempt | `error.message = commonT('common.damImage.uploadErrors.chunkValidationFailed')`, rejects with the axios error (`L:us:174-178`) | no branch; ends as "max tries exceeded" (`D:us:193`), the store writes `unknownError` (`D:us:76`, `D:st:467,474`) | visible text | PRODUCT/UNKNOWN. LIB `f15b1b5d`; DAM has no such key (`admin-dam/src/locales/en/system.json:96-106`). |
| 16 | After the last failed attempt | still re-reads the chunk if the size changed and sleeps 1 ms (`sleepTime = 1` trick, `L:us:187-195`) | `if (attempt >= CHUNK_MAX_RETRY) break` first (`D:us:181-182`), plain `sleepTime *= 3` (`D:us:190`) | none: both make 4 attempts with waits of 1 s, 3 s, 9 s | EQUIVALENT (DAM `3a242125` is tidier). |
| 17 | Who stops the speed tick | the service returns `stopSpeedCheck` (`L:us:221-227,288`); the store calls it in its catch (`L:st:203`); success sets `endTimestamp` before finish (`L:us:280`) | `try { … } finally { stopSpeedCheck() }` inside `upload()` (`D:us:264-279`), also in `stop()` (`D:us:284`) | none | EQUIVALENT (LIB `f15b1b5d`, DAM `b825c77e`). DAM's does not depend on the caller. |
| 18 | Empty file | rejects `!file \|\| file.size < 1` with `Error('Empty file')` before any request (`L:us:244-247`) | rejects only a missing file (`D:us:228-233`); a 0-byte file is started with `size: 0` (`D:ia:49-52`), and if the server accepts, the loop is skipped and finish is sent (`D:us:260-276`) | behavioural | UNKNOWN. The size check is in LIB since the first copy `2c202a9b`. Settled by: what core-dam answers to `size: 0` and which message the product wants. In LIB the row fails with an empty message. |
| 19 | Stop while the start request runs | checked when `upload()` begins (`L:us:270-271`) | checked in the start response (`D:us:241-246`) | none | EQUIVALENT |
| 20 | Returned API | `{ uploadInit, upload, stopSpeedCheck }` (`L:us:285-289`) | `{ uploadInit, upload, stop }` (`D:us:288-292`) | contract with the store | follows #12/#17 |
| 21 | Rejection values | `new Error('Upload stopped')` or the axios error (`L:us:159,173,241,271,281`) | the string `'upload stopped'` (`D:us:24,151,…`) | none; neither store inspects it for a stop | cosmetic |

### A.3 What happens on each HTTP failure

| Step | LIB | DAM |
|---|---|---|
| Start fails (any status) | `uploadInit` rejects (`L:us:256-258`) → store: `hasError`, `Failed`, `canEditMetadata = false`, message untouched (`L:st:202-211`) | rejects (`D:us:249-251`) → store: message from `resolveUploadErrorMessage`, `Failed`, one alert per reason (`D:st:467-482`) |
| Start answers 2xx other than 201 | `reject()` with nothing (`L:ia:45-50`) | same (`D:ia:55-60`) |
| Chunk: network error, timeout (420 s), 5xx, 4xx without validation data, non-201 | retried, 4 attempts, waits 1/3/9 s, then `'Unable to upload chunk, max tries exceeded'` (`L:us:165-198`) | same schedule (`D:us:162-193`) |
| Chunk: 422 with `fields` | fails at once with the field message (`L:us:181-185`) | same (`D:us:175-179`); the store then overwrites the message with the same text (`D:st:474`) |
| Chunk: 400 on the 4th attempt | `chunkValidationFailed` message (`L:us:175-178`) | `unknownError` via the store |
| Chunk cancelled | rejects at once (`L:us:173`) | rejects after the sleep (`D:us:188-189`) |
| Finish fails | rejects → store as for a failed start; a row the notification has already made `Uploaded` stays so (`L:st:206`) | same rule (`D:st:466`) |
| Finish succeeds | `Processing` only if still `Uploading`, then the fallback (`L:ua:79-85`) | same (`D:fa:196-200`) |

### A.4 Concurrency

- Limit of 2 uploads at once, **per queue**: `QUEUE_MAX_PARALLEL_UPLOADS = 2` (`L:st:33`, `D:st:55`). Both count the items
  with status `Uploading` in that queue and start `2 − count` waiting ones (`L:st:177-189`, `D:st:387-401`).
  DAM has three queue ids (`admin-dam/src/domains/coreDam/shared/services/upload/uploadQueueIds.ts:1-3`), LIB one queue
  per widget `queueKey`, so the real ceiling is 2 × the number of active queues on both sides.
- The next item starts: after each add (`L:st:140`, `D:st:185`), when `upload()` resolves, i.e. after the finish answer
  (`L:st:201`, `D:st:457`), on a failure (`L:st:213`, `D:st:484`), and from the notification handlers
  (`L:st:267,299,387,407`; `D:st:533,580,682`). DAM also refills the slot when an item is removed (`D:st:359`); LIB does
  it in `stopItemUpload` (`L:st:513`).
- An item leaves the count when its status leaves `Uploading`; the finish answer does that (`L:ua:83`, `D:fa:198`).
- DAM only: an `ExternalProviderAsset` item takes the same slot but runs `externalProviderImport` instead of `useUpload`
  (`D:st:440-446`).

---

## B. API layer

### B.1 Start / chunk / finish requests

DAM's four per-type files carry the same upload code: a diff of the `uploadStart … externalProviderUpload` section of
`imageApi.ts` against `audioApi.ts`, `videoApi.ts`, `documentApi.ts` shows no difference except `END_POINT`
(`D:ia:23`, `audioApi.ts:22`, `videoApi.ts:29`, `documentApi.ts:22`). `uploadFailed` exists for image only
(`D:ia:139-157`) and has no caller (grep).

| Request | LIB | DAM | Difference | Class |
|---|---|---|---|---|
| Start | `imageUploadStart(client, endPoint, item)`: `POST {endPoint}/licence/{licenceId}` or, for a `SlotFile` item with slot and asset, `{endPoint}/asset/{assetId}/slot-name/{slotName}`; body `{ mimeType: damFileTypeFix(file), size }`; expects 201 (`L:ia:30-57`) | `uploadStart(item)`: the same two URLs, body and status (`D:ia:40-67`) | client and endpoint are parameters in LIB, constants in DAM. The slot URL branch is in LIB too, but LIB never creates a `SlotFile` item (`L:st:96-103,127-134`). | STRUCTURAL (wiring) |
| Chunk | `imageUploadChunk(client, endPoint, item, id, buffer, size, offset, cb)`: `POST {endPoint}/{id}/chunk`, FormData `file` + `chunk = {offset,size}`, timeout 420 s, `signal`, expects 201 (`L:ia:59-211`) | `uploadChunk(item, id, buffer, size, offset, cb)`: the same request (`D:ia:69-112`) | see next three rows | |
| Chunk header | `'Content-Type': undefined` (`L:ia:172-174`) | `'Content-Type': 'multipart/form-data'` (`D:ia:94-96`) | none on the wire with the installed axios 1.20.0: for a FormData body in a browser it clears the content type and lets the browser set the boundary (`node_modules/axios/lib/helpers/resolveConfig.js:65-73`). Either override is needed: DAM's client defaults to `application/json` (`admin-dam/src/shared/apiClients/damClient.ts:16`), under which axios would serialise the FormData as JSON (`node_modules/axios/lib/defaults/index.js:47-57`). | EQUIVALENT |
| Chunk pre-checks | rejects a non-Blob or empty buffer, a non-positive-integer size, a negative or non-integer offset, each with a Sentry message (`L:ia:70-135`); `JSON.stringify` in a try (`L:ia:141-166`) | none | defensive; the rejections fall into the retry loop like any other error | LIB only, `f15b1b5d`. Not user-visible. |
| Chunk 400 telemetry | Sentry `dam_upload_chunk_400` with the response (`L:ia:188-207`) | none | ops-visible only | LIB only, `f15b1b5d` |
| Chunk timeout | per request `timeout: 420 * 1000` (`L:ia:13,175`), `cc23d2fa` | the same (`D:ia:24,91-92`), `b825c77e` | none | identical |
| Finish | `PATCH {endPoint}/{fileId}/uploaded` `{ checksum }`, expects 200 (`L:ia:213-241`) | the same (`D:ia:114-137`) | none | identical |

### B.2 Dispatch wrappers

| | LIB `uploadApi.ts` | DAM `fileApi.ts` | Class |
|---|---|---|---|
| Start/chunk/finish | image only; any other type `reject()` with no error (`L:ua:24-27,48-51,71-74`) | `switch (item.assetType)` over image/audio/video/document; default rejects with `Error("fileApi: unsupported asset type …")` (`D:fa:77-112,202-241,243-294`) | STRUCTURAL (asset types) |
| After finish | inline (`L:ua:76-86`) | `startProcessing(item)` (`D:fa:196-200`) | EQUIVALENT: both write `Processing` only over `Uploading` (LIB `387bddb4`/`9d6f62ca`, DAM `3a242125`) |
| External provider import | — | `externalProviderUpload(item)` → `POST /adm/v1/<type>/licence/{licenceId}/external-provider` `{ id, externalProvider }`, 201 (`D:fa:296-334`, `D:ia:159-183`) | STRUCTURAL |
| Slot and file operations | — | `unsetAssetSlot`, `deleteFile`, `makeMainFile`, `existingFileToSlot`, `fileDownloadLink`, `makePublicFile`, `makePrivateFile` (`D:fa:336-579`) | STRUCTURAL; not part of the upload path |
| Copy to licence | `copyToLicence(client, endPoint, items)`: `PATCH {endPoint}/copy-to-licence` in batches of 20, max 50 (`L:ia:263-298`) | — | STRUCTURAL (LIB only) |

### B.3 Status-polling fallback

Common: `10 s × try²` (`L:ua:15,98-100`, `D:fa:73,114-116`), 4 tries (`L:ua:16`, `D:fa:74`), `notificationFallbackTry`
starts at 1 (`common-admin/src/domains/dam/uploadQueue/factory/UploadQueueItemFactory.ts:56`). Computed schedule:
polls at 10, 50, 140 and 300 s after arming, gives up with a message at 550 s (the same figure is in the comment at
`L:st:482`). Each poll is `fetchAsset(assetId)` and reads `asset.mainFile.fileAttributes.status`. Until `00ec7494`
(LIB, 2025-12-12) and `13812f57` (DAM, 2026-10-07) both had 3 tries.

| Point | LIB | DAM | Class |
|---|---|---|---|
| Armed after finish | if `uploadStatusFallback` (plugin option) (`L:ua:84`, `L:us:32`) | if `envConfig.uploadStatusFallback` (`D:fa:199`); DAM passes the same value into the plugin (`admin-dam/src/main.ts:46`) | STRUCTURAL (wiring) |
| Armed elsewhere | for a copy-to-licence item, behind the flag (`L:st:109-113`) | for an external-provider import, **not** behind the flag (`D:ep:15-18`, reason at `D:fa:182-184`) | STRUCTURAL; the unconditional arming is deliberate |
| `armNotificationFallback` | no status guard (`L:ua:91-96`) | returns unless `Processing` (`D:fa:185-191`) | EQUIVALENT (LIB's two callers arm a `Processing` item) |
| Entry check | returns only on `Uploaded` (`L:ua:104`) | returns on `Uploaded`, `Stop`, `Failed` (`D:fa:119-122,126`) | EQUIVALENT in practice: LIB clears the timer on those paths (`L:st:350,402,472,486`) and re-checks after the fetch (`L:ua:129`). DAM `3a242125`. |
| Give-up message | `common.damImage.uploadErrors.processingTooLong` (`L:ua:105-108`) | `processingTooLongSlot` for a slot item, else `processingTooLong` (`D:fa:127-138`) | STRUCTURAL (slots) + PRODUCT (text) |
| A failed poll | swallowed, polling goes on (`L:ua:111-116`) | logged, polling goes on (`D:fa:141-147`) | EQUIVALENT |
| Whose file | acts on the asset's main file as it is (`L:ua:118`) | only when `mainFile.id === item.fileId` or the item has no file id (`D:fa:148-150`) | STRUCTURAL (slots) |
| Processed | `await queueItemFullyProcessed(asset.id)` (`L:ua:120-121`) | `queueItemProcessed(asset.id, item.fileId)` and, for a non-slot row without metadata, `queueItemMetadataProcessed(asset.id)`; then `return` (`D:fa:152-159`) | STRUCTURAL (different store API; the file id is for slots) |
| Duplicate | `await queueItemDuplicate(asset.id, originAssetFile, assetType)` (`L:ua:122-123`) | the same plus `item.fileId` (`D:fa:160-168`) | STRUCTURAL (slots) |
| Failed | `await queueItemFailed(asset.id, failReason)` (`L:ua:124-125`) | the same plus `item.fileId` (`D:fa:169-171`) | STRUCTURAL (slots) |
| Next poll | only while `Processing` (`L:ua:129-131`); the store calls are awaited so an unsettled item is polled again | unless settled (`D:fa:175-179`); after a recognised status it returns without re-polling | EQUIVALENT given each store: DAM's `queueItemProcessed` settles before it fetches (`D:st:511-536`) |

Both API modules import the store they report to (`L:ua:12,119`; `D:fa:70,151`) while the store imports them back
(`L:st:14`; `D:st:47-52` via the two services): an import cycle on each side.

### B.4 `damAssetApi.ts` against `assetApi.ts` (the parts upload uses)

| Function | LIB | DAM | Class |
|---|---|---|---|
| `fetchAsset` | `GET {endPoint}/:id` (`L:aa:53-63`) | `GET /adm/v1/asset/:id` (`D:aa:125-137`) | STRUCTURAL (wiring) |
| `fetchAssetByFileId` | `GET {endPoint}/asset-file/:id` (`L:aa:77-87`) | the same (`D:aa:139-151`) | STRUCTURAL (wiring) |
| `fetchAssetListByIds` | resolves `[]` for no ids (`L:aa:154-155`) | rejects for no ids (`D:aa:102-103`) | behavioural at the API; DAM's caller always has ids (`D:st:245,310`) |
| `hasMetadataToSave` | (`L:aa:198-199`) | (`D:aa:168-169`) | identical |
| `bulkUpdateAssetsMetadata` payload | always sends `mainFileSingleUse` (with an optional override), `mainFileInternal: false`, `mainFileOverrideInternal: false` (`L:aa:201-222`) | sends `mainFileSingleUse` only when not null and never the two internal flags (`D:aa:171-189`), reason at `D:aa:48-51` | **behavioural**: LIB's queue save writes both internal flags to false; DAM's leaves them alone. UNKNOWN whether LIB's is intended. Settled by the owner / core-dam's `AssetMetadataBulkManager`. |
| `bulkUpdateAssetsMetadata` result | resolves `[]` when nothing qualifies, else the flattened response items (`L:aa:95-118`) | rejects when nothing qualifies, resolves the raw responses (`D:aa:207-228`) | behavioural at the API; pinned in DAM by `src/test/queue/saveNothing.test.ts` |
| `updateAssetMetadata` | `(client, endPoint, asset, extSystem, mainFileSingleUse)`, internal flags false (`L:aa:252-294`) | `(asset, mainFileSingleUse, mainFileOverrideInternal, mainFileInternal, ttsAudio)` (`D:aa:259-302`) | PRODUCT (DAM edits the internal flags and `ttsAudio`) |
| `handleMetadataValidationError` | ext system is a parameter (`L:aa:226-250`) | current ext system (`D:aa:232-257`) | STRUCTURAL (wiring) |
| `fetchImageFile` | `optionalBody`, `?? null` (`L:ia:17-28`) | plain (`D:ia:26-38`) | cosmetic; used by DAM's duplicate handler for all four types (`D:st:691-703`) |

---

## C. Chunk size, validations, mime detection, allowed configs

| Piece | LIB | DAM | Imported or duplicated |
|---|---|---|---|
| Adaptive chunk size | `useDamUploadChunkSize(apiTimeout = 30)` (`L:cs:7-52`); bounds from `damPrvConfig.settings.imageChunkConfig` for every asset type (`L:cs:9,38-42`); the last size is a module-level ref shared by all uploads (`L:cs:5,23,29`) | calls the library's with `envConfig.dam.apiTimeout` (`D:us:7,115`) | **Imported.** Only the argument differs (A.2 #9). |
| `item.chunkSize` (10485760) | `QUEUE_CHUNK_SIZE` (`L:st:34`) | `CHUNK_SIZE` (`D:st:70`) | Duplicated constant. Read only by LIB's Sentry extras (`L:ia:80,103,124,153,196`); the chunk loop never uses it. `chunkTotalCount` is never written (factory `:41`). |
| Mime → asset type | `getAssetTypeByMimeType` (`common-admin/src/domains/dam/uploadQueue/utils/mimeTypeHelper.ts:4-15`) | uses the library's (`D:st:9,170`) | **Imported.** LIB then drops everything but images (`L:st:126`); DAM keeps all (`D:st:171`) — STRUCTURAL. |
| Mime fix for `.mov`/`.icc` | `damFileTypeFix` (`common-admin/src/domains/ui/file/utils/fileType.ts:1-15`) | uses the library's (`D:ia:6,50`, `D:st:8`, `D:fv:1`) | **Imported.** |
| Accept list and size limits | `useDamAcceptTypeAndSizeHelper` (`common-admin/src/domains/dam/config/composables/acceptTypeAndSizeHelper.ts:5-41`) | uses the library's with the slot's type or all four (`D:au:6,110`) | **Imported.** |
| Format and size check of picked files | `useFormatAndSizeCheck` → `checkFormats`, `checkSizes` (`L:fc:52-99`), keys trimmed and lower-cased (`L:fc:22,83`) | `checkFormats`, `checkSizes` (`D:fv:5-59`); accept keys not normalised (`D:fu:222-227`) | **Duplicated.** Same rules, both inclusive at the limit (`L:fc:85-93`, `D:fv:38-53`); they differ only for keys with capitals or spaces, which the config-built accept list does not produce (**inferred**). Not exported by the library (`lib.ts` has no `useFormatAndSizeCheck`). |
| Warning text | `common.system.upload.incorrectFormatSize` (`L:fc:46`) | `system.upload.incorrectFormatSize` (`D:fu:247`) | Duplicated key |
| Vuelidate scopes | `Symbol.for('anzu:common:asset-metadata-validation-scope')` etc. (`common-admin/src/domains/dam/composables/uploadValidations.ts:11-17`) | `Symbol.for('anzu:asset-metadata-validation-scope')` etc. (`admin-dam/src/domains/coreDam/shared/validationScopes.ts:1-4`) | **Duplicated with different keys**: the two form families do not share a scope. LIB's file also holds the CMS image-field rules (`uploadValidations.ts:19-63`), which DAM has no use for. |
| Who may upload | `isImageWidgetUploadConfigAllowed`, `filterAllowedImageWidgetSelectConfigs`: super admin, or member of the ext system, or holder of the licence (`common-admin/src/domains/dam/config/utils/damFilterUserAllowedUploadConfigs.ts:8-57`) | `canUpload` from ACL grants per asset type (`D:au:117-132`); no use of the library's two functions (grep) | Not a duplicate: two models. PRODUCT/STRUCTURAL. |
| Upload count limit | 50, only in the multiple widget (`common-admin/src/domains/dam/imageWidget/components/ImageWidgetMultipleLimitDialog.vue:22,76-83`); the single widgets and `AAssetListInner` have none | `maxUploadItems` 50 (`admin-dam/src/shared/utils/BetaTestFeaturesService.ts:4`), dialog in `D:au:53-58,94-101`; warnings for imports (`…/externalProviderAssetImport.ts:29-32,47-55`) | **Duplicated dialog** (same flow, different text keys). |
| Suggestions helper | `useAssetSuggestions` (`common-admin/src/domains/dam/uploadQueue/composables/assetSuggestions.ts:5-30`) | uses the library's (`D:st:13,309,588`) | **Imported.** |

---

## D. Entry points

### D.1 LIB — every caller of `addByFiles` / `addByCopyToLicence` outside tests

Store signatures: `addByFiles(queueKey, extSystem, assetLicence, files)` (`L:st:117`),
`addByCopyToLicence(queueKey, extSystem, assetLicence, assets)` (`L:st:83-88`). Items: key `'file_' + file.name`
(`L:st:128`) or `'asset_' + assetId` (`L:st:97`), type `File`/`Asset`, asset type always image (`L:st:100,126`).

| # | Entry | Chain | Arguments |
|---|---|---|---|
| L1 | Drop on the single image widget | `AFileDropzone @drop` (`…/imageWidget/components/ImageWidgetInner.vue:877-885`) → `onDrop` (`:294-325`): refuses when read-only or locked, waits for the collab field lock → `addByFiles` (`:314`) → opens the queue dialog (`:315`) | `props.queueKey`, `config.extSystem`, `config.licence` from the injected `ImageWidgetUploadConfigKey` (`:183-190,302`) |
| L2 | File picker of the single image widget | `AFileInputDialog @files-input` (`ImageWidgetInner.vue:760-766,818-823`) → `onFileInput` (`:344-350`) → `addByFiles` (`:348`) | same |
| L3 | Copy to licence from the asset picker | `AAssetSelect` confirm → `pickAsset` → `copyToLicence(damClient, endPointAsset, [{ asset, targetAssetLicence }])` (`ImageWidgetInner.vue:430-435`) → `onCopyToLicence` (`:327-342`) → `addByCopyToLicence(queueKey, extSystem, licence, [targetAsset])` (`:333,335`); for `exists` also `queueItemDuplicate(targetAsset, targetMainFile, Image)` (`:336`) | same |
| L4–L6 | The media widget: drop, picker, copy | `ImageMediaWidgetInner.vue` `onDrop` (`:304-333`, add at `:323`), `onFileInput` (`:352-358`, add at `:356`), `onCopyToLicence` (`:335-350`, adds at `:341,343`) | same |
| L7 | The multiple widget: drop and picker | `ImageWidgetMultipleInner.vue` `onDrop` (`:206-213`), `onFileInput` (`:197-204`) → `ImageWidgetMultipleLimitDialog.check(files)` → `checkForLimit` (`…LimitDialog.vue:76-83`) → `onDialogConfirm` → `addByFiles(queueKey, extSystem, licence, files.slice(0, 50 − total))` (`:52-63`) | same; no collab lock wait here |
| L8 | The multiple widget: copy | `onCopyToLicence` (`ImageWidgetMultipleInner.vue:215-235`), one `addByCopyToLicence` per answer (`:224,226`) | same |
| L9 | Upload button of the asset list | `AFileInput @files-input` (`…/assetSelect/components/AAssetListInner.vue:259-271`) → `onFileInput` (`:205-211`) → `addByFiles` (`:209`); offered only when the upload config is injected (`:189-190`) | `props.queueKey`, injected config |
| L10 | "Add more" inside the open queue dialog | `AFileInput` in `…/uploadQueue/components/UploadQueueDialog.vue:250-255` re-emits `filesInput` to its host, which runs the host's `onFileInput`: the multiple widget (`ImageWidgetMultipleInner.vue:706-717` → L7) and the asset list (`AAssetListInner.vue:425-434` → L9) | the host's |

Picked and dropped files pass `useFormatAndSizeCheck` inside `AFileInput`
(`common-admin/src/domains/ui/file/components/AFileInput.vue:57-70`) and `AFileDropzone` (`AFileDropzone.vue:41-50`);
the widgets hand both the accept list and the size limits (`ImageWidgetInner.vue:764-765,881-882`,
`ImageWidgetMultipleInner.vue:700-701`). No paste and no by-URL entry exists in `src/` (grep for paste / clipboard /
byUrl handlers found none).

### D.2 DAM — every caller of the store's `add*` actions outside tests

Store signatures: `addByFiles(queueId, files)` (`D:st:161`), `addByFilesAsSlotUpload(queueId, files, assetId, slotName,
assetType)` (`D:st:189-195`), `addByAssets(queueId, assets)` (`D:st:218`), `addByExternalProviderAsset(queueId, assets,
importAsset = false)` (`D:st:266-270`). The licence and ext system are read inside the store from
`useCurrentAssetLicence()` / `useCurrentExtSystem()` (`D:st:163-165,196,219,271`). File keys are unique:
`uniqueQueueItemKey('file_' + name)` (`D:st:67-69,173,199`).

| # | Entry | Chain | Arguments |
|---|---|---|---|
| D1 | Full-window dropzone | `<AssetUpload />` in `admin-dam/src/domains/system/components/MainWrapper.vue:171` and in `…/footer/AssetFooterUploadOverlayFull.vue:252` → `FileUpload @files-input` (`D:au:138-148`) → `assetUpload` (`D:au:53-70`) → `addByFiles` (`D:au:65`) | queue `'global'` (default prop, `D:au:38`), all enabled types |
| D2 | "Upload" button in the list toolbars | `<AssetUpload variant="button">` (`…/list/AssetListView.vue:149-152`, `…/externalProvider/components/ExternalProviderAssetListView.vue:142-145`) → same chain | queue `'global'` |
| D3 | "Add" icon in the full upload overlay | `<AssetUpload variant="icon">` (`AssetFooterUploadOverlayFull.vue:195-198`) → same chain | queue `'global'` |
| D4 | Over-the-limit dialog | `onDialogConfirm` → `addByFiles(queueId, first N files)` (`D:au:94-101`) | the instance's queue |
| D5 | Slot upload | `<AssetUpload variant="slot-upload" type="slots" :queue-id="QUEUE_ID_UPLOAD_SLOTS" :asset-id :slot-name :multiple="false" :asset-type>` shown only for a slot without a file (`…/detail/components/slots/AssetSlotListItem.vue:197-207`) → `addByFilesAsSlotUpload` (`D:au:59-63`) → start URL `/adm/v1/<type>/asset/{assetId}/slot-name/{slotName}` (`D:ia:43-45`) | queue `'slots'`, asset id, slot name, asset type |
| D6 | External provider import, one asset | `importFromDetail` (`…/externalProvider/composables/externalProviderAssetImport.ts:25-40`) → `addByExternalProviderAsset('global', [asset], true)` → `Waiting` item → `externalProviderImport(item).importInit()` (`D:st:440-446`, `D:ep:6-40`) | queue `'global'`, provider from `activeExternalProvider` (`D:st:272,285`) |
| D7 | External provider import, selection | `importFromSelected` (`externalProviderAssetImport.ts:42-74`) → the same add, then `clearQueue('edit')` | queue `'global'` |
| D8 | Mass-edit selection (no upload) | `toggleSelected` / `selectMultiple` → `addByAssets('edit', …)` (`…/list/composables/assetListActions.ts:351,383`): `Asset` items in `Loading`, metadata fetched in one batch (`D:st:245-248,308-331`) | queue `'edit'` |
| D9 | External provider selection (no upload) | `addByExternalProviderAsset('edit', …)` without import → status `Uploaded` (`…/externalProviderAssetListActions.ts:255,289`, `D:st:277`) | queue `'edit'` |

There is no "replace file" upload: a slot offers upload only while empty (`AssetSlotListItem.vue:198`); the other slot
actions (make main, copy to another slot, switch, unset, delete) are single API calls that bypass the queue
(`…/detail/composables/assetDetailSidebarSlotsActions.ts:41-104`). The slot overlay
(`…/footer/AssetFooterUploadSlotsOverlay.vue`) only displays and stops the `'slots'` queue (`:29-45,170`).

DAM's picker is its own `FileUpload.vue`: four variants (`D:fu:14`), a hidden input, and on a drop it walks dropped
folders with `webkitGetAsEntry` (`D:fu:145-172,189-206`). LIB's dropzone uses `useDropZone` (`AFileDropzone.vue:52`)
and has no folder walk.

### D.3 One side only

- **LIB only**: copy to licence (L3, L6, L8); the collab-lock wait before a drop (L1, L4); the per-widget queue dialog
  opened on add.
- **DAM only**: slot upload (D5); external provider import (D6, D7); the two selection queues (D8, D9); dropping a
  folder; the full-window dropzone; non-image types.

---

## E. What DAM's upload code takes from the library, and what it duplicates

### E.1 Imported from `@anzusystems/common-admin`

- Types: `UploadQueue`, `UploadQueueItem`, `UploadQueueItemStatusType`, `DamUploadStartResponse`, `DamAssetTypeType`,
  `DocId`, `AssetDetailItemDto`, `AssetFileFailReasonType`, `AnzuApiValidationResponseData` (`D:st:17-29`, `D:fa:8-16`,
  `D:us:9`). The item type already carries the DAM-only fields `slotName`, `externalProviderAssetId`,
  `externalProviderName`, `externalProviderMetadata` and all four item types
  (`common-admin/src/domains/dam/types/UploadQueue.ts:25-30,56-58,83`).
- Enums/values: `UploadQueueItemStatus`, `UploadQueueItemType`, `DamAssetType`, `DamAssetStatus`,
  `AssetFileProcessStatus`, `AssetFileFailReason`, `AssetFileLinkType`, `NEW_LINE_MARK`, `HTTP_STATUS_*`.
- Functions: `useUploadQueueItemFactory`, `useDamUploadChunkSize`, `getAssetTypeByMimeType`, `damFileTypeFix`,
  `useDamAcceptTypeAndSizeHelper`, `useAssetSuggestions`, `useDamConfigState`, `useDamConfigStore`,
  `axiosErrorResponseHasValidationData`, `axiosErrorResponseHasForbiddenOperationData`, `useAlerts`, `useApiRequest`,
  `useApiCommand`, `useApiFetchList`, `initDamNotifications`, `useDamNotifications`, `DamNotificationName`
  (`D:st:1-16`, `D:us:1-8`, `D:ia:1-9`, `D:au:2-8`,
  `admin-dam/src/domains/system/composables/appNotificationListeners.ts:1-6`).
- Components: `ADialogToolbar` (`D:au:3`). None of the library's upload components.

### E.2 Duplicated locally

| Symbol | DAM | LIB | Exported by the library today |
|---|---|---|---|
| `useUpload`, `uploadStop`, `readFile`, `sleep`, the retry constants, `handleValidationErrorMessage` | `D:us:17-21,30-55,79-97,99-297` | `L:us:20-24,36-86,88-294` | no |
| Type dispatch `uploadStart` / `uploadChunk` / `uploadFinish` | `D:fa:77-112,243-294,202-241` | `damUploadStart` / `damUploadChunk` / `damUploadFinish` `L:ua:18-89` | no |
| Per-type start / chunk / finish (×4) | `D:ia:40-137` and the three siblings | `imageUploadStart` / `imageUploadChunk` / `imageUploadFinish` `L:ia:30-241` | no |
| Fallback: constants, `calculateFallbackTime`, `notificationFallbackCallback`, `armNotificationFallback` | `D:fa:73-74,114-191` | `L:ua:15-16,91-132` | no |
| `fetchAsset`, `fetchAssetByFileId` | `D:aa:125-151` | `L:aa:53-87` | yes (`lib.ts:516,518`) but with `(client, endPoint, …)` |
| `fetchAssetListByIds`, `bulkUpdateAssetsMetadata`, `hasMetadataToSave`, `updateAssetMetadata`, `handleMetadataValidationError`, `AssetMetadataBulkItem` | `D:aa:42-56,81-123,167-302` | `L:aa:31-40,121-294` | no |
| `fetchImageFile`, `rotateImage` | `D:ia:26-38,279-297` | `L:ia:17-28,243-261` | no |
| `checkFormats`, `checkSizes` | `D:fv:5-59` | `L:fc:52-99` | no |
| File picker + dropzone | `D:fu` | `AFileInput.vue`, `AFileDropzone.vue`, `AFileInputDialog.vue` | `AFileInput` only (`lib.ts:67,812`) |
| Window drag watcher | `admin-dam/src/domains/coreDam/asset/composables/windowFilesDragWatcher.ts:1-59` | `common-admin/src/domains/ui/file/composables/dropzone.ts:1-69` | yes, `useDropzoneGlobalDragState` (`lib.ts:869`); DAM's installs itself on first use (`:44-49`), the library's needs an explicit init (`:50-54`) |
| Over-the-limit dialog | `D:au:46-101,149-187` | `ImageWidgetMultipleLimitDialog.vue` | no |
| Validation scope symbols | `…/shared/validationScopes.ts:1-3` | `uploadValidations.ts:11-17` | no (not in `lib.ts`) |
| `QUEUE_MAX_PARALLEL_UPLOADS`, the 10485760 chunk constant | `D:st:55,70` | `L:st:33-34` | no |
| The store, item refresh, the queue components | other agents | | |

---

## F. Extension points a shared layer would need (each tied to a difference above)

| # | Extension point | Required by |
|---|---|---|
| F1 | Endpoint per asset type (a map or resolver), and the set of types the consumer supports | LIB has one configurable image endpoint (`AnzuSystemsCommonAdmin.ts:66`, default at `commonAdminCoreDamOptions.ts:19,46`) and rejects other types (`L:ua:24,48,71`); DAM has four fixed ones (B.1, B.2) |
| F2 | The axios client as a parameter or from config | `L:ia:31,60,214` take `client`; `D:ia:20` imports `damClient`. Note LIB's service and store always read the `default` config (`L:us:31,89`, `L:st:47`), whatever `configName` the widget has. |
| F3 | Timeout for the chunk-size thresholds | A.2 #9 |
| F4 | Fallback switch and an unconditional arm | B.3 "armed" rows |
| F5 | Fallback outcome callbacks (`processed`, `duplicate`, `failed`, each with the item and the fetched asset) in place of a direct store import | B.3: different store methods, the extra `fileId`, the "whose file" test (`D:fa:148-150`), the extra metadata request (`D:fa:154-158`); also removes the import cycle |
| F6 | Message resolver: chunk field messages, the 400 message, the fallback give-up text by item type, the store's failure message | A.2 #3, #5, #15; B.3 give-up row |
| F7 | A failure hook or returned error for the store (DAM turns the rejection into a row message and an alert) | A.2 #5 |
| F8 | Empty-file policy | A.2 #18 |
| F9 | Chunk part type on/off, until the backend question is answered | A.2 #11 |
| F10 | Telemetry hook for the chunk pre-checks and the 400 | B.1 chunk rows (LIB sends Sentry events; DAM sends none) |
| F11 | One stop contract (a `stop()` handle and/or the item status) | A.2 #12, #17, #20 |
| F12 | A starter per item type (file upload vs provider import) | `D:st:440-446`, `D:ep` |
| F13 | Add actions that take licence and ext system explicitly, with DAM passing its current ones | `L:st:117` vs `D:st:161-165` |
| F14 | Allowed asset types at add time | `L:st:126` vs `D:st:171` |
| F15 | Slot arguments on add | `D:st:189-216`; the request layer already has the URL branch on both sides |

### Shareable as it is

- Already shared: the item types, the factory, `useDamUploadChunkSize`, `getAssetTypeByMimeType`, `damFileTypeFix`,
  `useDamAcceptTypeAndSizeHelper`, `useAssetSuggestions`.
- The three request functions: LIB's take `(client, endPoint, …)` and DAM's four copies differ only in the endpoint.
- The chunk loop's pure parts: constants, `sleep`, `readFile`, `progressCallback`, the speed tick, the retry schedule,
  the hashing calls, `uploadStop`.
- `calculateFallbackTime` and the two fallback constants (identical numbers).
- `hasMetadataToSave` (identical).
- `checkFormats` / `checkSizes` (same rules; LIB's normalises keys).
- The drag-state watcher (same logic; init differs).

---

## G. Risks

1. **Speed sampling changes for healthy uploads if DAM's baseline fix is ported verbatim.** `D:us:164-167` resets on
   attempt 1 as well, so the first progress event of every chunk yields no sample (`D:us:124-128`). In LIB that event
   yields one today. Displayed speed, remaining time and the adaptive chunk size in the CMS admins would shift. (Inferred
   from the code; not measured.)
2. **Chunk size in the CMS admins changes if the timeout becomes configurable by default.** LIB is fixed at 30 s
   (`L:us:100`); the admins already pass an `apiTimeout` into the plugin that is ignored today.
3. **Texts.** Two key namespaces with different wording (A.2 #3), DAM-only keys (`metadataFailed`,
   `metadataUnavailable`, `processingTooLongSlot`, `error.apiForbiddenOperation.*`) and a LIB-only one
   (`chunkValidationFailed`). Taking either side's keys changes visible text on the other.
4. **Lazy rusha reaches DAM.** A shared service brings the 15 s load timeout and a failure before the first request
   (`L:us:235-239`). `rusha` is a devDependency of the library and not in its externals
   (`common-admin/package.json:117`, `vite.config.lib.mts:107-123`), so it ships inside the library build (**inferred**);
   DAM also lists it itself (`admin-dam/package.json:65`).
5. **Wire change for DAM if the chunk `File` type is unified** (A.2 #11): every chunk of all four types would carry
   the file's mime type on its multipart part. Unverified against core-dam.
6. **Empty files** (A.2 #18): unifying on LIB's rule removes DAM's server round-trip and its server-worded message;
   unifying on DAM's creates assets for empty files in the CMS admins.
7. **Sentry volume.** DAM would start emitting `dam_upload_chunk_validation` and `dam_upload_chunk_400` events
   (`L:ia:74,97,118,190`).
8. **Bulk save payload** (B.4): LIB's writes `mainFileInternal: false` and `mainFileOverrideInternal: false` on every
   save. If DAM ever called LIB's `bulkUpdateAssetsMetadata`, internal flags set in DAM would be reset by a queue save.
   And DAM rejects an empty save where LIB resolves.
9. **Fallback armed without the flag** for provider imports (`D:ep:15-18`): a shared `arm` that always checks the flag
   would leave an import with no notification stuck in `Processing`.
10. **Slots and the fallback.** LIB's fallback and store match by asset id only (`L:ua:118-125`, `L:st:277,362,401`);
    DAM passes the file id so two slot uploads of one asset do not settle each other
    (`appNotificationListeners.ts:29-42`, `D:fa:148-171`). A shared fallback without the file id breaks slots.
11. **Tests are bound to module paths.** DAM mocks `@/domains/coreDam/asset/api/fileApi` and
    `…/upload/uploadService` (`admin-dam/src/test/upload/uploadStop.test.ts:11`,
    `src/test/queue/externalProviderImport.test.ts:8`, `slotNotifications.test.ts:27`, `lazyMetadata.test.ts:25`); LIB
    mocks `@/domains/dam/api/uploadApi`, `damImageApi`, `rusha`
    (`common-admin/src/domains/dam/uploadQueue/__tests__/uploadStopBetweenChunks.test.ts:7,21`, others). Once the code
    lives in the package, DAM cannot mock those internals by path and needs injection seams.
12. **Release coupling.** DAM pins an exact library build and is already one behind (header). Every change to the
    shared layer needs a publish and a bump before DAM sees it.
13. **Item keys.** LIB keys a file item by name (`L:st:128`), DAM by name + sequence (`D:st:67-69`) because "a duplicate
    `:key` lets Vue's keyed diff patch the wrong tile". A shared add action has to keep DAM's.
14. **The default-config read** (`L:us:31,89`): a shared service that keeps it sends every upload to the `default`
    client and endpoints. Fine for DAM (one config, `admin-dam/src/main.ts:40-44`), worth knowing for a CMS with two.

---

## Proposals (mine — not facts)

These are suggestions for the lead to weigh; none is derived from an owner decision.

1. **Move the request layer first; it is the cheapest win.** One `uploadStart/Chunk/Finish(client, endPoint, …)` trio
   in the library (LIB's, with its pre-checks) plus an endpoint map replaces DAM's 12 copies and both dispatch files.
   Keep `'Content-Type': undefined`. No behaviour changes except Sentry events (risk 7) — gate them behind a hook (F10)
   if DAM should stay silent.
2. **One `useUpload` built from LIB's file, taking an options object**: `{ client, endPointFor(assetType),
   finish(item, sha), chunkSizeTimeout, messages, rejectEmptyFile, typedChunks }`. LIB's widgets pass today's values
   (30, reject empty, typed chunks), DAM passes its own (env timeout, accept empty, untyped) — so nothing changes on day
   one, and each UNKNOWN can be closed later by flipping a default.
3. **Port DAM's baseline reset into the shared loop as a bug fix, but only for retries** (`attempt > 1`), which fixes
   the negative sample without touching healthy sampling on either side (avoids risk 1). DAM's current always-reset
   form would then need its own flag, or the owner accepts the small change in DAM.
4. **Keep both stop forms in the shared service**: return `stop()` and also honour `item.status === Stop`, with LIB's
   cancel short-circuit and DAM's `finally`. Every checkpoint of either side stays covered; the stores keep their
   current calls.
5. **Fallback as a pure scheduler with callbacks** (F5): `armFallback(item, { fetchAsset, onProcessed, onDuplicate,
   onFailed, onGiveUp, isOurFile, enabled })`. Each store supplies its handlers; the cycle disappears; `enabled: true`
   covers the provider import.
6. **Do not share the API of `bulkUpdateAssetsMetadata` yet.** The payloads differ in a way that writes data (B.4). Ask
   the owner first whether LIB's `false` flags are intended.
7. **Leave the pickers apart for now.** `FileUpload.vue` (folder walk, four variants, window dropzone) and
   `AFileInput`/`AFileDropzone` are different products; share only `checkFormats`/`checkSizes` by exporting
   `useFormatAndSizeCheck`.
8. **Questions for the owner / backend before any unification**: chunk part mime type (A.2 #11); `size: 0` on start
   (#18); should CMS chunk thresholds follow `apiTimeout` (#9); should LIB rows show the failure reason DAM shows (#5)
   and should DAM show LIB's 400 message (#15); are the internal flags in LIB's bulk save intended (B.4).
