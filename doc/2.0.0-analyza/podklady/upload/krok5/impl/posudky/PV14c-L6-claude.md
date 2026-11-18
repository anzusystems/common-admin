# PV14c-L6: adversarial review (Claude)

Scope: step PV14c-L6 in `/home/volar/projects/anzusystems/common-admin` (patch `krok5-praca/zaplaty/PV14c-L6.diff`,
86 files), and the merged changelog entry and the installation guide for all of PV14c. Paths are relative to the
repository root unless absolute. Nothing heavy was run: read-only greps, `git show 1.49.0:…`, a Python parse of the two
tsbuildinfo files, and a Node script that runs the guard's own `callsWithoutName` (copied verbatim from the test) on
planted strings and on two real files. No vitest, build or vue-tsc.

## Answers to the six questions

1. **Reachability: no break found.** None of the 24 accessors whose name is now required, nor `useUploadQueuesStore` /
   `useAssetDetailStore`, is exported from `src/lib.ts` (none was at tag 1.49.0 either); `RowsNote` and
   `UploadQueueRowsOf` live in the non-exported store module; L6 changed no exported type. `./testing` holds no DAM code
   and `exports` closes deep paths (`package.json:14-36`). admin-dam, admin-ugc and admin-cms call only same-named local
   functions (admin-dam `src/domains/coreDam/asset/api/assetApi.ts:370` `showMetadataSaveError`, its own store's
   `addByFiles`; admin-cms `src/domains/cms/author/composables/authorSelectActions.ts:10`) and public composables that
   keep their optional name (`useDamConfigStoreOf(props.configName)` in admin-ugc, `useDamConfigState(damClient)`,
   `useDamCachedUsers()`, `useCommonAdminImageOptions()`); admin-dam's `useDamUpload` always passes
   `adminDamUploadPreset` (admin-dam `src/domains/coreDam/shared/services/upload/uploadService.ts:48-58`).
2. **Guard**: M1, L6.
3. **Remaining `'default'`s**: the note's list matches my grep exactly (24 occurrences in 15 files). By design: `configOf`
   (PV14a), the sockets, `adminDamUploadPreset`, `damNotifications.ts` (3), the caches made with the module,
   `damConfigName.ts`, `useDamConfigStoreOf`, `useDamNotificationsConnection`, `AAssetListInner` `variant`. Leftovers of
   an internal default: `RowsNote` and `libraryQueuePreset` (L3). By design but documented wrongly:
   `useCommonAdminImageOptions` and `useUpload` without a preset (M5).
4. **Documents**: M3, M4, M5, L1, L5. Of the provisional owner choices, 1-5 are written down; 6 (no
   `skipCurrentUserCheck` on the media widget) is not (L1).
5. **`lint:tsc`**: it does type-check the tests, but not after a change confined to library sources (M6). That explains
   the 08:02 observation; the final L6 state was checked.
6. Outside the step: last section.

## High

None.

## Medium

### M1. The guard counts arguments; it does not check that a name is given

Where: `src/test/damConfigNameGuard.test.ts:116-121` (count only), `:20` (`useDamConfigStore: 1`), `:57-68` (allow-list
by file).

For the 24 accessors whose name is now required, `lint:tsc` already rejects a missing or `undefined` name. What only the
guard can watch are the 13 public ones (12 with an optional name, plus `useDamConfigStore`, which takes none), and there
it accepts any argument. Run with the guard's own functions: `useDamConfigStoreOf(props.configName)`,
`useDamCachedAuthors(undefined)` and `useDamConfigStore(getActivePinia())` are all reported as named.
`useDamConfigStore`'s only parameter is a Pinia (`src/domains/dam/config/store/damConfigStore.ts:79,105`), so position 1
is satisfied by anything. Allow-list entry 1 (`:58-62`, `damConfigStore.ts`) is vacuous: the only call in that file is
`useDamConfigStore(pinia)` (`damConfigStore.ts:105`), already counted as named; with an empty allow-list the guard finds
nothing there (only `uploadQueuesStore.ts:221` needs entry 2). Entry 2 allows every nameless
`useDamNotificationsConnection()` in the upload store, not just the one at `:221`.

Failure: a library component without its own prop, under a named ancestor, calls `useDamConfigStoreOf(props.configName)`
(or `useDamNotificationsConnection(props.configName)`, `useCommonAdminImageOptions(props.configName)`): the prop is
`undefined`, the default parameter makes it `default`'s store, socket state or image client. TypeScript and the guard
are green. The same for an inheriting accessor called after an `await` with an optional variable.

Fix: (a) flag a name argument that is `undefined`, `props.configName` (any `props.…`), or an optional chain without a
string literal: the domain's idiom is `useDamConfigName(props.configName)` or a `string` parameter; (b) treat every
`useDamConfigStore(` call in the domain as forbidden except inside `useDamConfigStoreOf` and drop allow-list entry 1;
(c) key entry 2 by the exact call (`useDamNotificationsConnection().onChange`) or a count of 1.

### M2. The store's settle functions keep an optional scope that means "every DAM"

Where: `src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:373-403` (`targetOf`, `queueItemProcessed`,
`queueItemFullyProcessed`, `queueItemDuplicate`, `queueItemFailed`, `refreshAsset`, each `of?: UploadQueueRowsOf`); none
is in `ACCESSORS`.

Left out, `targetOf` names no configuration, `concerns` (`src/domains/dam/uploadQueue/settlement/uploadSettle.ts:217-224`)
then takes the rows of every queue of every configuration, and a refresh reads with the client of the first concerned
row's queue (`uploadSettlement.ts:679-684`). The brief's point 1 covers "the internal helpers added in L1-L5 that have a
default"; this default (L3) is wider than `default`. Every production caller passes it today
(`ImageWidgetInner.vue:551`, `ImageMediaWidgetInner.vue:569`, `ImageWidgetMultipleInner.vue:300`,
`UploadQueueDialog.vue:161`, `uploadQueueBindings.ts:61`, `uploadQueueItemRefresh.ts:124`).

Failure: a new internal call `uploadQueuesStore.queueItemFailed(assetId, reason)` or `refreshAsset(assetId)` compiles,
passes the guard, and writes one DAM's answer into the rows of `default` and of `own` that share the asset id: the K2
bug L3 closed, back in silence.

Fix: make `of: UploadQueueRowsOf` required (tests pass `'default'` or `{ queueKey }`), or add the five to `ACCESSORS`
(positions 2, 2, 4, 3, 2). `queueItemProcessed`, `queueItemFullyProcessed` and `queueItemFailed` have no production
caller at all; removing them is the other way.

### M3. The merged entry misstates what a configuration held before 2.0.0

Where: `doc/changelog/2.0.0.md:74`, `:75`.

- `:74` "`coreDam.configs` keyed by name used to name a client and five addresses": at 1.49.0 `CommonAdminCoreDamConfig`
  had `damClient` and three addresses, `endPointAsset`, `endPointImage`, `endPointRoi`
  (`git show 1.49.0:src/AnzuSystemsCommonAdmin.ts`, lines 62-80). `endPointAuthor` and `endPointKeyword` are 2.0.0 keys;
  the merged-away entry "DAM author and keyword endpoints in the configuration" (snapshot `:76`) was the only place that
  said so, and the Added entry now implies they existed.
- `:75` "and, as before, its grants and switches (`keywordCreateAcl`, `authorCreateAcl`, `copyToLicenceEnabled`, …)":
  all three are new in 2.0.0 (absent at 1.49.0; Added at `:82`).
- `:74` "two configurations of two DAMs on one page do not share any of it": the licence check of every configuration
  goes by the current user of the system `dam` unless the application names another `currentUser`
  (`src/domains/dam/composables/commonAdminCoreDamOptions.ts:89`); two DAMs left at that default share one user.

Failure: a reader migrating from 1.49 cannot tell which keys are new and takes the author and keyword addresses for old
ones; one who trusts "share none of it" leaves `own`'s licences judged by `dam`'s user.

Fix: "a client and three addresses (`endPointAsset`, `endPointImage`, `endPointRoi`)"; say that `endPointAuthor` …
`endPointCmsAsset` are new keys; drop "as before" there; qualify the intro ("…share none of it; each names its own
`currentUser` where its user is not `dam`'s").

### M4. Facts of the four merged entries that the new entry lost

Where: `doc/changelog/2.0.0.md:74-81` against the snapshot `krok5-praca/snap/PV14c-L6/mimo-src/doc/changelog/2.0.0.md:61,
62,76,77`.

1. The library's own upload store reads in a lane per configuration, so a slow DAM no longer holds back the reads of
   another (a pressed refresh among them) and failures are reported as a streak per DAM. The old notifications entry
   (`:62`) said it of every profile with `configOf`, which the library store has
   (`src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:204,227`); the new text says it only of "an application with
   a queue of its own" (`:81`). It is behaviour the editor sees (an alert per failing DAM).
2. The loaders of `useDamConfigState` (settings, ext system, licence, custom forms, `loadDamPubConfig`) read the
   configured addresses and, before the plugin is configured, the defaults without a throw
   (`commonAdminCoreDamOptions.ts:47-65`, `damConfigName.ts:38`); `loadDamPubConfig` is no longer named.
3. `ADamUserRemoteAutocomplete` and `ADamUserFilterRemoteAutocomplete` without a `client` list at the configuration's
   `endPointUser` (`src/domains/dam/user/components/DamUserRemoteAutocomplete.vue:41-46`,
   `DamUserFilterRemoteAutocomplete.vue:25-27`); only the `client` case (fixed address) is left (`:80`).
4. Where `endPointPodcast` is read (the podcasts of the asset select), and that under a name the chips, the inputs, the
   file panel and the image dialogs show the names its DAM gives (old `:77`).

Failure: an integrator reading the changelog does not learn that the user field follows `endPointUser`, nor that two
DAMs no longer share one read lane and failure streak in the library's own widgets.

Fix: put 1 into "Upload queues" (`:77`), 2-4 into "What a configuration holds" (`:75`).

### M5. The guide says every public composable inherits the name

Where: `doc/guide/installation.md:64`: "A public composable left without a name takes that of the nearest ancestor …
else `default` (`useDamConfigStoreOf()` and `useDamNotificationsConnection()` are `default`'s whatever calls them)."

Three more public entry points are `default`'s whatever calls them: `useCommonAdminImageOptions(configName = 'default')`
(`src/domains/dam/imageWidget/composables/commonAdminImageOptions.ts:14`, exported `src/lib.ts:905`, so since 1.x;
admin-cms calls it without a name, e.g. `src/domains/cms/shared/components/anzutap/components/AnzutapRenderer.vue:73`),
`useDamUpload` without a preset (`src/domains/dam/uploadQueue/composables/uploadService.ts:97-99`,
`libraryUploadPreset('default')`), and `addDamNotificationListener(callback)` without options
(`src/domains/dam/composables/damNotifications.ts:196-209`). The changelog (`:76`) lists the inheriting composables one
by one and is right; the guide generalises.

Failure: an application's component under `own` calls `useCommonAdminImageOptions()` for its image client, as the guide
says it may, and talks to `default`'s image service.

Fix: list the nine inheriting composables as the changelog does, and name the `default`-only ones:
`useDamConfigStoreOf()`, `useDamNotificationsConnection()`, `useCommonAdminImageOptions()`, `useDamUpload()` without a
preset, `addDamNotificationListener` without options.

### M6. `lint:tsc` does not re-check the tests after a change confined to library sources

Where: `package.json:57-58`; `tsconfig.json:3-13` (references `tsconfig.test.json`); `tsconfig.test.json:3-9`;
TypeScript 6.0.3 `node_modules/typescript/lib/_tsc.js:131561-131594`, `:131672-131683`.

The project does type-check its tests: `lint:tsc` builds the solution, which references the test project, and
`lint:tsc:test` builds that project alone. In `--build` mode, though, a project is up to date while no root file and no
tsconfig is newer than its tsbuildinfo, and the test project's roots are only the tests: of the 2444 files in
`node_modules/.cache/tsc/tsconfig.test.tsbuildinfo`, the 410 roots are 409 test files and `src/vite-env.d.ts`; the 652
library files it checks are not roots. A change of library signatures with no test touched leaves it "up to date", and
both commands print nothing. That is the 08:02 observation (`krok5-praca/pracovne/impl-lib-op12/l6-tsc-test.log` empty,
`l6-tsc-1.log` only the app's two errors). The final L6 state is not affected: the tests were edited before the check,
the test build info was rewritten at 08:17:30 by `CK_CAST=linty`, and it holds no `errors`, `checkPending` or
`semanticDiagnosticsPerFile`, i.e. every file checked, none with a diagnostic. CI is spared by an accident: a fresh
checkout makes `tsconfig*.json` newer than the restored build info (`_tsc.js:131672`), so the project is rebuilt there
(read from the code, not run).

Failure: a fix cycle that changes a library signature and touches no test passes `lint:tsc` locally while tests no
longer type-check; vitest erases types and may stay green.

Fix: in `krok5-praca/nastroje/ck-lib.sh` after `lint:tsc` run `vue-tsc -p tsconfig.test.json --noEmit` (no build mode:
the same incremental build info, but every file's version is compared, root or not), or
`vue-tsc --build --force tsconfig.test.json`; or make `lint:tsc:test` the former.

## Low

- **L1. `skipCurrentUserCheck`; owner choice 6 not written.** `doc/changelog/2.0.0.md:75` "…and the
  `skipCurrentUserCheck` of a component still wins". Only the pickers have it: `AAssetSelect`, `AAssetListInner`,
  `AAssetSelectMedia`, and `AImageWidgetInner` / `AImageWidgetMultipleInner`, which hand it to their picker
  (`ImageWidgetInner.vue:98,1307`). `AImageWidget`, `AImageWidgetMultiple` and `AImageMediaWidget` do not declare it, and
  the upload check is theirs (`AImageWidget.vue:99`); `ImageMediaWidgetInner` renders its picker without it (`:1517`).
  The provisional choice "no `skipCurrentUserCheck` on the media widget" is in neither document. Failure:
  `<AImageMediaWidget skip-current-user-check>` falls through as an attribute and does nothing. Fix: "…the
  `skipCurrentUserCheck` of an asset select, or of `AImageWidgetInner` / `AImageWidgetMultipleInner` for their picker,
  still wins; `AImageMediaWidget` has none: `currentUser: false`."
- **L2. Stale comment.** `src/domains/dam/api/damAssetApi.ts:294-295` "(`default` when none is named)" on the now
  required `configName`. Fix: drop the parenthesis.
- **L3. Dead internal defaults the note calls by design.** `RowsNote.configName?` and its `?? 'default'`
  (`uploadQueuesStore.ts:63-64,453`): the note says "poznámka zvonka", but a `RowsNote` is made only by
  `noteRowsOfAsset`, which always sets the name (`:428-436`; the only use outside is `forgetRowsNote`,
  `AssetDetailSidebarMetadata.vue:86`). `libraryQueuePreset({ configOf? })` with `?? 'default'`
  (`uploadQueue/presets/queuePresets.ts:41-56`): internal, its one production caller passes `configOf`
  (`uploadQueuesStore.ts:227`); only `uploadQueueCore.test.ts:128,376,819` omit it. Fix: make both required (tests
  pass `() => 'default'`), as the step did for the other internal helpers.
- **L4. Test titles that no longer say what the case does.**
  `src/domains/dam/uploadQueue/__tests__/uploadNamedConfiguration.test.ts:261` "is under the default configuration when
  none is named" and `:392` "…when the detail names none…" now pass `'default'`. Fix: retitle, or drop the first (the
  cases above it pin the same).
- **L5. Guide: when names throw.** `doc/guide/installation.md:64` "Once the plugin is installed, a name not in
  `coreDam.configs` throws: … in `useDamConfigState(client, name)` and in the caches of names": `checkDamConfigName`
  returns early while `coreDam` is not set (`src/domains/dam/composables/damConfigName.ts:38`), so a plugin installed
  without `coreDam` throws nothing there. The changelog says it right (`:76`, "Once the plugin has set `coreDam`").
  Fix: copy that wording.
- **L6. Guard: other misses, the parser test and the bend.** Run with the guard's functions: a renamed destructuring
  (`const { savingOf: s } = store; s(id)`), a generic call `withinWaitLimit<T>(…)` and an optional call
  `addByFiles?.(…)` are not seen (the last two are required-name accessors, so `lint:tsc` covers them); a spread
  `useDamConfigState(...[client, name])` is flagged although named. Its scope is `src/domains/dam` only (today nothing
  else calls the accessors but the playground). The parser test (`:136-156`) has no method call, `.vue` template or
  nested-call case, though the real calls are mostly `store.x(…)` and `useX(useDamConfigName(…))`. Bend b1 planted
  `useCommonAdminCoreDamOptions()`, which `lint:tsc` rejects as well, so no bend shows what only the guard catches. Fix:
  plant a method call, a template call and `useDamConfigStoreOf()` in the parser test, and bend with a nameless
  optional-name accessor in a component.

## Outside the step

- `krok5-praca/nastroje/ck-lib.sh:26-28` runs the library's browser tests with `VITEST_MAX_WORKERS=${CK_WORKERS:-6}`,
  while the user's global rule caps vitest at 2 workers. The comment says a browser worker takes less than an admin-dam
  one; I did not measure. Worth a conscious confirmation.
- `useCommonAdminImageOptions` is the one DAM-side public composable that does not inherit the name (`= 'default'` since
  1.x, `git show 1.49.0:src/components/damImage/composables/commonAdminImageOptions.ts:19`). Whether it should inherit
  like the others is an owner question; M5 fixes only the guide.
