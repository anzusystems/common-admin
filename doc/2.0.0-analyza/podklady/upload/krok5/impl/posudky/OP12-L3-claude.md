# OP12-L3 — review (Claude, adversarial)

Scope: `krok5-praca/zaplaty/OP12-L3.diff` (10 files) against the snapshot `krok5-praca/snap/OP12-L3`; brief `zadania/zadanie-OP12-L3.md`; note `impl/OP12-L3.md`. `diff -rq` of the snapshot's `src` and the tree shows exactly the ten patched files, so this covers OP12-L3 alone. Read-only, no vitest run. Evidence besides reading: the step's own logs (`krok5-praca/vysledky/OP12-L3-testy.log`, `OP12-L3-linty.log`, `OP12-L3-lib-browser.json`) and `node -e` for what V8's `structuredClone` refuses (Chromium uses the same serializer). Housekeeping: by mistake I wrote one scratch list into the git-ignored cache, `node_modules/.cache/posudok-op12-l3-files.txt` (58 test paths). Nothing reads it; it can be deleted.

## Answers to the three checks

### 1. `copyOf` and `respond` — confirmed
- **Every answer goes through the copy.** `respond` builds its one response object at `src/domains/dam/__tests__/support/fakeDam.ts:257` with `copyOf(one.data)`. `one` is whatever `answer()` (`:232-241`) resolved to:
  - `own()`: one asset `:225-228`; by ids `:216-224` (a new array of held assets); by file `:211-215`; the finished upload `:198-206` (the held `mainFile`). The start, chunk and bulk answers are fresh objects anyway.
  - rules: `:233-236`.
  - holds: `release(given)` resolves the hold rule with `given ?? own(request)` (`:315`), which comes back through `answer()` to `:257`.
  - errors: the `AxiosError` carries that same `response` (`:260-266`). "Nothing answered" (`:239-240`) and a cancellation carry no data.

  The response's `config` is `sent` (`:245`): the request's own config and body, never a held object.
- **`structuredClone` cannot throw on what the fake holds today.**
  - Every `dam.assets.set(…)` in the 58 files that use the fake stores a factory result, a spread or a clone.
  - No rule answers with a ref, a store getter or a function (grep of every `data:` in those files). The one answer taken from a store (`consumerProfileImageWidgetLibrary.test.ts:961-984`) reads `shallowRef` values (`damConfigStore.ts:45-53`), which are raw.
  - Date, File and Blob clone. A Vue proxy or a function would not: finding 2.
- **Recorded requests keep what tests read.**
  - The library sends only JSON text or a `FormData` (`useApiRequest.ts:131`, `useApiFetchItems.ts:142`, `damImageApi.ts:42-45,140-174,227-229,292`, `imageApiCms.ts:112`). Only `fakeDam.test.ts` hands the client an object.
  - A string is kept as is; a form is rebuilt entry by entry (`:153-157`). A `File` appended without a filename is that same `File` in the copy, so `chunkOf` (`:358`), `get('file')` and `get('chunk')` read the same name, size and bytes. A `Blob` part reads back from either form as a `File` named "blob" with the same bytes.
  - The form branch is needed: `structuredClone(new FormData())` throws ("Cannot clone object of unsupported type").
  - The green run includes every `chunkOf` user (`uploadSettlementWithoutSocket.test.ts:151`, `uploadQueueOperations.test.ts:428`, `consumerProfileUploadQueueRows.test.ts:128`, `uploadQueueClientFailure.test.ts:109,121`, `consumerProfileUploadDialogActions.test.ts:169`) and `damImageApiUploadRequests.test.ts:89-92` (`toBeInstanceOf(FormData)`, the bytes, the chunk text).

### 2. The nine removed rules — each did only "own()'s asset, as a copy"
Snapshot lines. "Earlier rules" are those registered before the removed one. They were asked after it, so they now see what it used to take.

| removed rule | matched | asset not held | earlier rules |
|---|---|---|---|
| `imageWidgetsDamAuthorsSave.test.ts:74-78` | GET `/adm/v1/asset/asset-9` | 200 with no body (no check) | names `:61`, MEDIA `:63` |
| `damImageWidgetSites.test.ts:352-356` | GET `/adm/v1/asset/a`, if held | falls through, `own()` 404 | MEDIA `:90`, names `:91` |
| `consumerProfileImageWidgetLibrary.test.ts:703-707` (one case) | GET `…/asset-9` | 200 with no body (no check) | names `:128`, list `:129` |
| `damAuthorKeywordEndpoints.test.ts:272-276` | GET `routes.one`, if held | 404 | authors/keywords `:61-66`, `/adm/v1/cms/asset/` `:267-269` |
| `consumerProfileImageWidgetLibrary.test.ts:1109-1119` | GET `routes.byFile` or `routes.one`, if held | 404 | names `:1103`, MEDIA `:1105-1107` |
| `imageWidgetsHeldAssetReadAnew.test.ts:73-77`, `imageWidgetsAuthorsGivenBeforeTheWrite.test.ts:91-95`, `imageWidgetsConfirmOfAnImage.test.ts:101-105`, `imageWidgetsPickDuringACreate.test.ts:73-77` | GET `routes.one`, if held | 404 | names, MEDIA |

- **What the rules took now reaches `own()` and nothing else.** No earlier rule matches `<asset>/<id>` or `<asset>/asset-file/<id>`: MEDIA is `/adm/v1/cms/asset/…`, the names are `/author|keyword/…`, the list is `/licence/<n>/search?`. `own()` does the same lookup (`fakeDam.ts:211-215`, `:225-228`), answers the same 200, and the answer is copied at `:257`.
- **The two without a found check never met an absent asset.** `asset-9` is set before every read: `imageWidgetsDamAuthorsSave.test.ts:64-71`, never deleted, and `consumerProfileImageWidgetLibrary.test.ts:700`. No 404 fall-through was lost or gained.
- **None held, delayed or reordered anything.**
  - Each rule was synchronous.
  - Rules registered later are asked first, as before: case rules, `hold`, and the 500 and 404 rules such as `consumerProfileImageWidgetLibrary.test.ts:1804-1806,2195-2197`.
  - The only change in timing is one `await` hop fewer per request (`fakeDam.ts:233-235`). None of the nine files waits by microtask count (no `await Promise.resolve()` or `nextTick`). They wait with `flushPromises`, `vi.waitFor` and `waits.settle`.

### 3. The new cases, and whether any case got weaker
- **All 8 new cases are red on the snapshot fake** (by reading), each on its own branch:
  - the six `it.each` rows hit `own()` by id (`:225`), by ids (`:216`), by file (`:211`) and the finished upload (`:198`), then a released hold and a rule. Without the copy, the mutated answer is the held asset and `toEqual(before)` fails;
  - `expect(answered).toEqual(held(dam))` keeps a row from passing on a wrong answer;
  - the body case fails without the request copy (`request.data === body`);
  - the form case gives `later.jpg`.
- **No existing case passes for a weaker reason:**
  - no removed rule changed a status, a hold or the order (check 2);
  - the step's run retried nothing. The local config retries once (`vitest.config.mts:117`). Vitest keeps a failed attempt's errors when the retry passes: `node_modules/vitest/dist/chunks/run.BPv-BBRv.js:3974-3982,4005-4010` (the browser runner is the same chunk, `dist/browser.js:2`), reported as `failureMessages` (`cli-api.De07GUeT.js:9336`). All 5 053 cases in `OP12-L3-lib-browser.json` have empty `failureMessages`;
  - the assertions on `dam.assets` are backed by a rule that writes a PATCH into it (`keepAuthorsOf`, `givenAuthorsElsewhere`). The exceptions are `imageWidgetsAuthorsGivenBeforeTheWrite.test.ts:318` and `imageWidgetsHeldAssetReadAnew.test.ts:284`. Their cases open no detail and no list and read the asset by id only, which the snapshot's copy rule already copied. So those two assertions could not fail before either, and their cases rest on `authorsWritten()` being `[]`. They are dead assertions, not weaker ones;
  - the checks that two rows do not share a list (`consumerProfileImageWidgetMultipleUpload.test.ts:909,1484,1926`) still bite: those rows are filled from the queue save, the pick or a single read, so the copy cannot separate them.

## Findings

### 1. Low — two aliasing workarounds outside the nine rules survive as no-ops, and the note misdescribes them
- **Where**:
  - `consumerProfileImageWidgetMultipleUpload.test.ts:1700-1701`, `detailHasItsOwn`, called at `:1708` and `:2204`. Its comment: "What the DAM has of an asset is its own from here on: what is typed into the detail is not, until it is saved". It replaces the held asset with a clone once the detail has opened. The note does not mention it.
  - `imageWidgetMultipleAuthorsGivenMeanwhile.test.ts:471`, the same in `editAssetOf` (`:462-472`). The note keeps it because "falošný DAM ich nenahrádza" (`OP12-L3.md:42-46`).
- **Why they are no-ops now**:
  1. The detail gets its asset from a read by file (`readsByFile()`, `consumerProfileImageWidgetMultipleUpload.test.ts:1787,1811`).
  2. In the snapshot, neither file had a copy rule, so that read returned the held object. `saveInDetail`'s `detail().asset!.authors = authors` (`:1713`; `imageWidgetMultipleAuthorsGivenMeanwhile.test.ts:476`) then wrote into the DAM before any PATCH. The clone was what prevented that.
  3. Since `fakeDam.ts:257` the detail holds a copy, and the clone replaces an object nobody else holds.
- **Scenario**: a reader of `:1700` or of the note concludes that the fake still hands out its objects for reads by file. They then add clones like these to new cases, or keep rules the fake has made redundant.
- **Note sentences that are off, same topic**:
  - `OP12-L3.md:59-61`: "no case stood on the shared answer except those that worked around it with copy rules". These two helpers worked around it too.
  - `:22-23`: "Keď asset nenašlo, nechalo požiadavku na own() (404)". Two of the nine had no found check and would have answered 200 with no body (check 2). That was never exercised, so the equivalence holds; the sentence does not.
  - `:27-28` says the five extra rules came from the OP12-L1 cycles. Three were already committed: `git show HEAD:` `imageWidgetsConfirmOfAnImage.test.ts:100`, `imageWidgetsPickDuringACreate.test.ts:72`, `consumerProfileImageWidgetLibrary.test.ts:1101`.
- **Fix**:
  - Remove `detailHasItsOwn` with its two calls, and the clone at `:471`, then run the two files once. Alternatively, keep them and say in their comments that the fake no longer needs them.
  - Correct the three sentences of the note.

### 2. Low — `structuredClone` makes "answers are plain data" a new, unwritten rule of the fake
- **Where**: `fakeDam.ts:158`.
  - On the answer side it runs inside the `.then` of `:256`.
  - On the request side it runs synchronously at `:244`, before the aborted check at `:249`.
  - `FakeDamAnswer` (`:27-30`), `FakeDamRule` (`:32-35`) and `reply` (`:296`) say nothing about it.
- **Scenario**:
  1. A later case answers with a reactive value, e.g. `dam.reply(() => ({ status: 200, data: someRef.value }))`. A `ref` of an object holds a Vue proxy, and V8 refuses it: "DataCloneError: #<Object> could not be cloned".
  2. `answered` rejects with that DOMException instead of an `AxiosError`. `mapApiError` turns it into an `AnzuFatalError` (`src/domains/api/utils/apiErrors.ts:192`); an HTTP failure would give `AnzuApiAxiosError` (`:190`).
  3. The widget reports a failure the case never set up. A case expecting a failed read passes for the wrong reason. A case expecting the answer fails far from the cause.

  Before the step such an answer worked, since nothing was cloned. No rule does this today (check 1).
- **Fix**: either of
  - say it in the JSDoc of `FakeDamAnswer.data`: plain data only, because it is copied with `structuredClone`, which refuses Vue proxies and functions;
  - or copy as the wire does: `JSON.parse(JSON.stringify(…))` for everything but strings, forms and `undefined`. That copy accepts reactive values, drops `undefined` and functions, turns a `Date` into its text, and splits one object that two entries of an answer point to into two, as two parsed entries are. `structuredClone` keeps such sharing (checked in V8). This variant needs one suite run, because `toStrictEqual` sees dropped `undefined` keys.

### 3. Low — held objects still reach library code outside `respond`
- **Where**:
  - The admin-ugc stand-ins of the image API, `src/domains/dam/__tests__/support/consumerImageApi.ts:102-133`:
    - `fetchImage` returns `images.get(id)!` (`:105-109`);
    - `createImage`, `updateImage` and `bulkUpdateImages` return what `store` keeps (`:34-38`, `:110-119`, `:128-131`);
    - `fetchImageListByIds` returns the held images (`:124-127`).

    admin-cms goes through `server = createFakeDam(…)` (`:53`), so since this step it gets copies.
  - `fakeDam.ts:334-347`: `fileBecomes` returns the held asset (`:345-346`). That is by design: tests change the DAM through it (`uploadPollRead.test.ts:154-167`). But `uploadQueueOperations.test.ts:412-415,615-617,639-644,694-696,710-712,824-826` hands that object to library code, `store.updateFromDetail(detail)`, as the detail's asset.
- **Scenario**: the same `describe.each(consumerProfiles)` case now runs under two aliasing regimes.
  - Under admin-cms, what the widget does to a fetched or saved image stays out of the backend.
  - Under admin-ugc, it changes `imageApi.images`, and a later `fetchImage` returns the change.

  So a ugc twin can pass on an in-memory mutation that its cms twin catches. The `fileBecomes` path is harmless today: `updateFromDetail` only reads `asset.id` on success (`uploadQueuesStore.ts:305-310`) and copies in its catch (`:338-340`).
- **Fix**:
  - Have the stand-ins return `structuredClone(…)` of what `images` holds. Everything there is plain: `plain(…)` output, parsed JSON or the test's own literals.
  - Hand `structuredClone(detail)` to `updateFromDetail`, or say in the `fileBecomes` JSDoc that it returns the DAM's own object.

### 4. Low — outside the step, pre-existing: rows of two queues share one answer's `customData` after a detail save
- **Where**:
  - `src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:311-316`. The success path gives every row of the asset, in every queue, the same `assetRes.keywords`, `assetRes.authors` and `assetRes.metadata.customData`.
  - The rest of the code gives each row its own copies: the catch path, which says why (`:332-340`), the settlement (`uploadSettle.ts:146-157`) and the fills (`uploadQueueFill.ts:9-10`, "Z24").
  - `fillCustomDataValue` writes into `item.customData` in place (`uploadQueueFill.ts:24`), for the rows of one queue (`uploadQueueMassOperations.ts:14`, `uploadQueueBindings.ts:89-98`). Both rows hold the same raw object.
- **Scenario** (by reading, not run):
  1. A page has two queues, each with a row of asset A. `uploadQueueOperations.test.ts:598-610` builds exactly this.
  2. The detail of A is saved from a row, and `updateFromDetail` reads A.
  3. In the dialog of queue 1, the user presses "replace" (or "fill empty") on a custom field (`AssetQueueSelectedSidebar.vue:50-55`).
  4. The row of queue 2 shows that value too. If queue 1 is then left unsaved, queue 2's next save still sends it for A.

  This holds unless a form edit has already given a row a new object (`ACustomDataForm.vue:60-64`). The test of per-row copies covers only the failure path (`uploadQueueOperations.test.ts:777-803`, `failAssetReads()` at `:781`).
- **Fix**: none in this step, since it is production code. For the register: give each row copies in the success path too (`[...]`, `cloneDeep`), and pin it with a `.not.toBe` between the rows built by `copiesInTwoQueues`.

## Verdict
No High or Medium findings.
- The fake now copies every answer and every recorded body in one place. That place covers every path of `own()`, the rules and the holds.
- The nine removed rules did the same thing: same lookups, same statuses, no holds, no ordering that matters. Removing them changes nothing a case proves.
- The 8 new cases are red without the change, branch by branch. The step's run is green with no retried case.

Before closing: remove or relabel the two dead workarounds and correct the note (finding 1). Findings 2 and 3 are cheap hardening of the test support. Finding 4 is for the register.
