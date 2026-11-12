# LIB review, round 1 (Opus): step-0 tests + the eleven step-1 patches

Read in full: the 11 production files of `git diff`, the 4 changed and 21 new test files, the 6 support files,
`lib-krok1.md`, and what the claims lean on (store, upload service and API, name caches, file input and dropzone,
both dialogs, the call sites in admin-cms / admin-ugc / admin-dam, the DAM backend in `petit/core-dam/vendor`).
Nothing was run. Paths are under `src/domains/dam/` of common-admin unless they start with `src/` or name another
repository (`admin-cms/`, `admin-ugc/`, `core-dam/` are under `/home/volar/projects/petit/`).

## BUG

None found. I looked for a regression, a leaked timer or listener, a race, a consumer break, a missing key and a
change beyond the eleven items, and each patch holds; the evidence is under "Checked and found sound".

## TEST

**T1. `__tests__/damNameChipsUnresolved.test.ts:27-48, :57-61, :66-90` — the cases depend on the first one, and it on the clock.**
`beforeAll` starts the 1.5 s debounced lookup and does not wait (`:46-47`); only the first case waits for it (`:82`).
The cases from `:92` on mount a chip and expect `#id` or the name at once. Run one of them alone (`-t`, `.only`, the
first case skipped): nine of the 13 fail with an empty chip and a spinner (the four "title of the caller" and "no
id" cases pass). The first case asserts "still asked" (`:77-80`) against real time: once 1.5 s pass between
`beforeAll` and `:78` it fails, and the configured retry fails too, because the caches are module state and settled
by then. Fix: `dam.hold('GET', DAM_NAMES)` in the first case, released after the spinner assertions;
`await damNamesAsked()` before the other describes. Same module state, milder:
`uploadQueue/__tests__/uploadSettlementApply.test.ts:245-274, :282-297` need ids no earlier attempt has asked for.

**T2. `uploadQueue/__tests__/uploadQueueDialogDrop.test.ts:80-94` — the dialog's half of item 3 is not under test.**
`UploadQueueDialog` is an auto-stub and the files are handed over by `dialog.vm.$emit` (`:112, :129, :146, :173`).
A VTU stub copies `props`, not `emits` (`node_modules/@vue/test-utils/dist/vue-test-utils.cjs.js:7998-8003`), so the
10 cases prove that the host listens and no more. Take `:accept` / `:max-sizes` off the dialog's dropzone
(`uploadQueue/components/UploadQueueDialog.vue:321-322`): oversized files reach the queue unchecked. Take its
`@drop` away (`:323`): nothing reaches the host. All 10 stay green both times. No other test covers it
(`__tests__/consumerProfileUploadDialog.test.ts:81-82` stubs both inputs; `AFileDropzone` has no test). Fix: one
case over the real dialog with emitting stubs of `AFileInput` and `AFileDropzone`: both get the same `accept` and
`maxSizes`, and `drop` and `filesInput` both reach the host.

**T3. `uploadQueue/__tests__/uploadServiceApiTimeout.test.ts:77-79` — the `null` case cannot fail for its reason.**
Take `?? undefined` out of `uploadQueue/composables/uploadService.ts:103`: `null / 5` makes every threshold 0
(`uploadQueue/composables/damUploadChunkSize.ts:11-13`), 10 s a chunk is "too long", the size falls to `minSize`
(`:21-23, :41-42`), which is the 1000 the case expects (`MIN = 1000`, 100 B/s: `:19-21, :53` of the test). It also
passes on `HEAD`, as does the `undefined` case. Fix: for these two cases a speed of 1000 B/s: 30 s gives `[3000]`,
thresholds of 0 give `[1000, 1000, 1000]`.

**T4. `uploadQueue/__tests__/uploadQueueDialogDrop.test.ts:195-202` — cannot fail at all.**
It passes on `HEAD` (no listener) and without the guard at `assetSelect/components/AAssetListInner.vue:206`:
`addByFiles` with no file never reaches `createQueue` (`uploadQueue/store/uploadQueuesStore.ts:128-145`), so
`getQueue` is `null` either way. Fix: spy on `addByFiles` and expect no call, or drop the case.

**T5. `uploadQueue/__tests__/uploadQueueDialogSingle.test.ts:236-258` — "(without tabs)" is a state the dialog never draws.**
The sidebar is mounted with `enableRoiTab: true` (`:162`). The dialog turns that on only once the item is uploaded
and re-read (`uploadQueue/components/UploadQueueDialogSingle.vue:69, :297-304`), and `simpleMode` needs it
(`uploadQueue/components/UploadQueueDialogSingleSidebar.vue:58`): a processing item is always drawn with tabs, in
admin-ugc too. Fix: mount the processing cases with `enableRoiTab: false`; the variant fits the metadata wait
(`:182-204`), where the state is real.

## PROPOSAL

1. `api/damAssetApi.ts:31-41`: keep the answer strict. One type for the body, one for the answer with both
   `internal` fields required; `UploadMetadataToImageMapFn` (`src/lib.ts:525`) then does not change for anybody.
2. Pin "one asset twice in one queue: both rows settle" at the store. Item 10 exists for that case, and only the
   keys are asserted (`uploadQueue/__tests__/uploadQueueOperations.test.ts:220-229`); a refactor that indexes rows
   by asset passes.
3. `__tests__/support/consumerProfiles.ts:174-181` is not admin-ugc's map: the real one builds from `bulkItems` and
   drops rows without asset or file (`admin-ugc/src/domains/blog/image/composables/customMetadataToImageMap.ts:11-16`).
4. `uploadQueue/composables/uploadQueueItemRefresh.ts:30-32`: the refresh now offered at once on a row whose chunks
   failed answers "Asset is still uploading or being processed by server", every time. Say the upload did not finish.
5. Let `holdLongWaits` keep the lengths of the waits it holds (`__tests__/support/longWaits.ts:19, :27`) and pin
   the poll's 10 / 40 / 90 / 160 s and its give-up over the real store (see the sample below).

## The characterization tests: six files sampled

`uploadQueueOperations`, `uploadNotificationEvents`, `uploadSettlementApply`, `uploadPollRead`,
`uploadSettlementWithoutSocket`, `uploadQueueClientFailure`. They would catch most broken refactors: real store,
real upload, real bus over a recording client, both consumer configurations, the row asserted field by field, the
reads by endpoint, "asks for nothing" by request count. What they do not see:

- **The poll's rhythm, its four tries and the give-up.** `holdLongWaits` records no lengths, and
  `uploadPollRead` asks a waiting row for two reads (`:176-195`), each "more than before" (`:65-70`). A poll that
  never gives up, or polls every 10 s, passes all 17 files. Only the tracked `uploadStatusFallback.test.ts:92-110`
  pins it, through a module mock of `fetchAsset` and a direct call of `damUploadFinish`: a moved poll loop breaks
  that test for the wrong reason, or it gets rewritten together with the code.
- **One asset twice in one queue** (proposal 2).
- They hold the row object from before the action and read it after: "rows are changed in place" is pinned too.
  That is today's contract (`useUpload` and the poll keep the object), so I count it as intended.

## Checked and found sound

- **1.** No writer of the two keys is left (`api/damAssetApi.ts:209-216, :259-266`; grep of `src`). The backend
  leaves an absent key alone: `core-dam/vendor/anzusystems/serializer-bundle/src/Service/JsonDeserializer.php:87`,
  `…/core-dam-bundle/src/Domain/Asset/AssetMetadataBulkManager.php:89-111`, the only other getter call is guarded
  (`…/Domain/AssetMetadata/AssetMetadataBulkFacade.php:88`), and `getInstance` always answers with both. Consumers:
  admin-cms has no custom map and reads `mainFileInternal` off an asset only (`pasteDamAssetExtension.ts:175`);
  admin-ugc's map reads `id` and `customData`; admin-dam has its own type. Nobody breaks on the optional fields.
- **2.** Row by state (`uploadQueue/components/UploadQueueItemEditable.vue:140-154, :180-209, :307-346`):
  waiting: cancel. Uploading: cancel, after 20 s also refresh + remove. Processing: after 20 s refresh + remove.
  Uploaded without metadata: after 20 s refresh + remove; with metadata: none. Failed with asset: refresh + remove
  at once; without: remove at once. Rows that have not failed behave as on `HEAD` (one new watch branch;
  `showRemove` equals `showRefresh` for them). The timer is cleared in the Failed branch (`:201-202`) and on unmount
  (`:219-222`). A failed row leaves Failed only to Uploaded, which resets both buttons (`:190-193`), or to Stop,
  which unmounts it (store `:244, :286-290, :369`). Remove reads its index at confirm time (`:345`).
- **3.** By reading, a dropped file takes the same path: both inputs of the dialog get the same `accept` and
  `maxSizes` and run `checkFormatsAndSizes` (`UploadQueueDialog.vue:250-256, :317-324`;
  `src/domains/ui/file/components/AFileInput.vue:62-70`, `AFileDropzone.vue:46-50`), then the host's `onFileInput`,
  limit dialog included. `drop` is a declared emit (`UploadQueueDialog.vue:41`), so no native listener falls
  through. `useDropZone` listens on its own element (`@vueuse/core` 15.0.0, `dist/index.js:3021-3024`) and the
  dialog is teleported, so one drop has one handler, also on admin-ugc's page with its own full-screen dropzone
  (`admin-ugc/src/pages/dam/asset/index.vue:63-71`). Both apps start the drag state (`admin-cms/src/App.vue:26`, `admin-ugc/src/App.vue:21`).
- **4.** One timer, cleared on every change of `waitsFor` and on unmount
  (`UploadQueueDialogSingleSidebar.vue:72-82`); the sidebar is keyed by the asset
  (`UploadQueueDialogSingle.vue:458-460`), a re-mount starts a wait of its own. Every answer of the refresh ends
  the wait or leaves the button enabled.
- **5, 6, 7, 8.** As described. 6: petit's DAM config has 18 `custom_metadata_pinned_amount`, all 1 to 3, the bundle
  default is 5: nothing changes there today. 7: both apps pass 30; every test that mocks the options and reaches
  `useUpload` defines `useCommonAdminCoreDamOptionsGlobal`. 8: unpatched, the second report of the new case is
  about -4000.
- **9.** The key is in en, sk and cs (`src/locales/*/common/model.json:21`). A loading chip keeps its spinner; a
  not-found id asked again goes spinner, then name or `#id` (`src/domains/cached/composables/defineCached.ts:107-141`).
  The autocomplete hands `title: ''` for a selected id outside the search result
  (`src/domains/remoteAutocomplete/components/AFormRemoteAutocompleteWithCached.vue:194-211`), so `#id` shows there
  too. A tooltip inside a chip binds to the chip (vuetify 4.2.1 `VChip.js:242`, `VOverlay/useActivator.js:292-297`).
- **10, 11.** The only `:key` on a row is `UploadQueueEditable.vue:126`; nothing in the library or the three apps
  reads the key's format (grep). `indexOf` on the reactive list finds a proxy and a raw row alike (vue 3.5.43,
  `@vue/reactivity/dist/reactivity.cjs.js:969-978`). The one production caller passes the row itself
  (`UploadQueueEditable.vue:45`). The store is not a public export, so the signature change reaches no consumer.
- **Beyond the brief's wording, all named by the author and harmless:** the tooltip / `title` on `#id`, unique keys
  for copy rows too, the conflicts chip following the cache instead of latching.
- **The two changed assertions** (`lib-krok1.md`) follow from items 1 and 2. The counts of new cases in the notes
  match the files (66).

## Could not verify

- That the suite, `vue-tsc`, eslint and oxlint pass: I ran nothing. The 277 files / 2902 tests are the author's.
- The stacking of admin-ugc's full-screen dropzone (`z-index: 9999`) against the open queue dialog. Whichever is
  on top, one element gets the drop and both end in the same `onFileInput`; that is from the DOM tree, not a browser.
- The backend as deployed: I read the vendored core-dam-bundle 1.52.0 and its serializer in `petit/core-dam`.
- T1's race (1.5 s between `beforeAll` and the first assertions) is from the code; I did not see it lose.
