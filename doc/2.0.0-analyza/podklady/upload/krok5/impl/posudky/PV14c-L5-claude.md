# PV14c-L5 — adversarial review (Claude)

Scope: the PV14c-L5 patch (`krok5-praca/zaplaty/PV14c-L5.diff`, 35 files; `diff -rq` of the snapshot
`snap/PV14c-L5/src` against the tree shows exactly its 33 `src` entries, `src/lib.ts` identical), read against the
brief, plan PV14c (provisional choices 1, 3, 4, 6), the analysis gaps F, U1-U3, G1-G2 and D2 (part 2.8; "83/D2" of the
request read as D2) and Codex's bullet on the user cache (K3). Consumers read: admin-cms, admin-ugc, admin-dam
(`src/main.ts`, their DAM clients, every call of the changed exports). Nothing was run; the logs were read
(`vysledky/PV14c-L5-testy.log`, `-linty.log`; `pracovne/impl-lib-op12/pv5-ohyb-pred.log`, `-pred-u.log`, `-b1.log`,
`-b2.log`, `-po.log`).

Counts: High 0, Medium 0, Low 4. Outside the step: Low 1.

## Findings

### High

None.

### Medium

None.

### Low

**L1. The guide and the changelog still call the user address and `/adm/v1/cms/asset` fixed, partly in the bullet this
step rewrote.**
Where:
- `doc/guide/installation.md:65`: "(authors and keywords at its addresses, users at `/adm/v1/user`)". A name's users now
  go to its `endPointUser` (`src/domains/dam/author/composables/cachedUsers.ts:28-29`).
- `doc/guide/installation.md:67`, the bullet L5 rewrote, names `endPointCmsAsset` as a key and then ends: "An address no
  configuration names, as `/adm/v1/cms/asset/…`, which `AImageMediaWidget` asks about a picked asset, goes by the
  client of the widget's configuration."
- Same bullet: "the distribution and external-provider selects … keep the fixed addresses": they request nothing
  (`user/components/DamDistributionServiceSelect.vue:8-45`, `DamExternalProviderAssetSelect.vue`; their `client` prop is
  unread). "`fetchDamUser…` without an address" reads as if `fetchDamUser`/`updateDamUser` took one
  (`user/api/userApi.ts:33,45` take none), and `ADamUserRemoteAutocomplete` given a `client` (fixed address,
  `DamUserRemoteAutocomplete.vue:41-46`) is not in that list.
- `doc/changelog/2.0.0.md:77` (the PV14c "Changed" entry): "and so does an address no configuration names, as
  `/adm/v1/cms/asset/…`" and "users at `/adm/v1/user`". `:229` and `:231` give the two wait limits as
  `coreDam.apiTimeout`; they are now the configuration's `apiTimeout` first (`imageWidget/utils/waitLimit.ts:21-24`).
- The public prop doc `DamUserRemoteAutocomplete.vue:23` ("Lists the users through this client instead of the
  configured one."): since L5 a given client also means `/adm/v1/user`, not the configuration's `endPointUser`.

Scenario: an application with a second DAM whose user route is `/ugc/v1/user` reads in the guide that the caches ask
users at `/adm/v1/user` and leaves `endPointUser` out; or it passes `:client` and `config-name` to
`ADamUserRemoteAutocomplete` as its prop doc suggests and gets 404s at `/adm/v1/user`.
Fix: guide `:65` "users at its `endPointUser`"; drop the last sentence of `:67` and list there what keeps the fixed
addresses: `ADamAssetLicenceRemoteAutocomplete`, `ADamAssetLicenceGroupRemoteAutocomplete`,
`ADamExtSystemRemoteAutocomplete`, `ADamUserRemoteAutocomplete` given a `client`, `fetchDamUser`, `updateDamUser`,
`fetchDamAssetLicenceListByIds`, `useFetchDamAssetLicenceList`, `fetchDamAssetLicenceGroupListByIds`,
`fetchDamExtSystemListByIds`, and the three functions with an optional address when called without one. The same two
edits in changelog `:77`; `:229`/`:231` "(the `apiTimeout` of the widget's configuration, else `coreDam.apiTimeout`,
…)"; prop doc "…, at `/adm/v1/user`". If this is left to PV14c-L6, say so in the note: lines 62-68 of the guide were
this step's.

**L2. Two request paths with a key are pinned by no case: the podcast list and the user inputs.**
Where: `assetSelect/composables/podcastFilterAndActions.ts:40` (`useFetchDamPodcastList(…, endPointPodcast)`, the list
the podcast filter searches); `user/components/DamUserFilterRemoteAutocomplete.vue:25-27` and
`DamUserRemoteAutocomplete.vue:41-46` (`useDamUserSelectAction(damClient, endPointUser)`, and the `client` branch at
the fixed address). The keys case reads podcasts only by ids (`__tests__/damNamedConfigurationKeys.test.ts:157`, through
`podcastFilterAndActions.ts:52`) and users only through the cache (`:152-154`, `fetchDamUserListByIds`);
`useFetchDamUserList` with an address runs in no case. `user/__tests__/DamUserRemoteAutocomplete.test.ts:12-23` mocks
`useDamUserSelectAction(client)` and `useCommonAdminCoreDamOptions` → `{ damClient }`, so it never sees an address;
`damNamedConfigurationComponents.test.ts:478,570` stub the filter.
Scenario (by reading, not run): dropping the last argument at `podcastFilterAndActions.ts:40` or at
`DamUserFilterRemoteAutocomplete.vue:27`, or swapping the two branches at `DamUserRemoteAutocomplete.vue:43-45`, keeps
every case green, and the podcast filter and the "created by" filter of the asset select under a name
(`AssetSelectFilterForm.vue:121,157`) ask the named client at `/adm/v1/…` again. The brief's case list names "a podcast
list"; the note (`impl/PV14c-L5.md:63-65`) calls the user inputs "covered by the users cache and the API", which holds
for the by-ids read only, and does not list the podcast list as uncovered.
Fix: in the keys `it.each` also run `usePodcastSelectActions(LICENCE, name).fetchItems(…)` (a pagination and
`usePodcastInnerFilter()`), expecting a second `GET ${at.endPointPodcast}/licence/${LICENCE}`; mount
`ADamUserRemoteAutocomplete` with `modelValue: 5` under `name` (its model watch asks by ids at once,
`remoteAutocomplete/components/AFormRemoteAutocomplete.vue:432`) and once under `own` with `client: own.client`,
expecting `GET /adm/v1/user` on `own`; the filter under `own` likewise. One bend at `podcastFilterAndActions.ts:40`.
Correct the note's sentence.

**L3. `currentUser` and `apiTimeout` are documented without what they need.**
Where: `src/AnzuSystemsCommonAdmin.ts:95-101` (`currentUser`), `:104-108` (`apiTimeout`); changelog `:61`; guide `:67`.
- The checks read `adminToExtSystems`, `userToExtSystems` and `resolvedAssetLicences` of that system's current user
  (`config/utils/damFilterUserAllowedUploadConfigs.ts:29-30,61-68`): a DAM current user (`DamCurrentUserDto`,
  `types/DamCurrentUser.ts:21-35`). Scenario: an admin names a system whose user it already loads into the same auth
  store but which is not DAM's (admin-cms loads `cms`, `auth`, `contentHub`, `ai`,
  `admin-cms/src/domains/system/composables/appInitialize.ts:152-155`): a `TypeError` (`[...undefined]` at `:29`,
  `undefined.includes` at `:62`). The root widget's `onMounted` rejects with `status` left at `'loading'`, a spinner
  without end (`imageWidget/components/AImageWidget.vue:92-124`, the same in the two other roots); the picker's open
  throws and the dialog does not open (`assetSelect/components/AAssetSelect.vue:104-109`).
- `apiTimeout`, "The time, in seconds, a request of this configuration may take": the library applies it to no
  request; it sizes chunks (aimed at a quarter of it, cut at half, `uploadQueue/composables/damUploadChunkSize.ts:18-20`)
  and the wait limits. Scenario: `apiTimeout: 120` on a configuration whose `damClient` times out at 30 s: its chunks
  are aimed at 30 s and the client aborts them.

Fix: JSDoc, changelog and guide: "a system whose current user is a DAM user (`DamCurrentUserDto`, as DAM's
`/adm/v1/users/current` gives it), which the application loads"; "the timeout of its `damClient`, which the library
does not set". Optionally `?? []` on the three arrays in the two utilities.

**L4. A configuration name the application has not got passes `useDamConfigState(client, name)` and now also silently
takes the default addresses.**
Where: `composables/commonAdminCoreDamOptions.ts:47-65` (the defaults "without that configuration" also once the
options are set); `config/composables/damConfigState.ts:32-37` (no name check; since L1 a store is made for any name,
`config/store/damConfigStore.ts:104-117`). Since L2 the public caches refuse such a name once the options are set
(`composables/damConfigName.ts:32-40`, `author/composables/cachedUsers.ts:46-49`). Inside the library nothing is hidden:
every `useDamConfigState(client, …)` call comes after `useCommonAdminCoreDamOptions(sameName)` refused an unknown name
in the same setup (`AImageWidget.vue:81,88`, `AImageWidgetMultiple.vue:55,62`, `AImageMediaWidget.vue:86,93`,
`assetSelectListActions.ts:48` for both selects, `imageDialogDamAuthors.ts:56-57`).
Scenario: an application fills its named store itself with `useDamConfigState(ugcClient, 'ugcc').loadDamPrvConfig()`
(typo for `ugc`, whose `endPointConfiguration` is `/ugc/v1/configuration`): the UGC client is asked at
`/adm/v1/configuration`, the failure is logged as a configuration error and the promise rejects `false`
(`damConfigState.ts:38-40,87-90`), and a store `ugcc` is made; `useDamCachedUsers('ugcc')` would have thrown at once.
Changelog `:61` and the JSDoc `damConfigState.ts:26-31` name only "the plugin not configured yet" as the case of the
defaults.
Fix: `checkDamConfigName(name)` at the top of `useDamConfigState`, before `useDamConfigStoreOf(name)` (a no-op before
the options are set and for `default`, so admin-dam's start and every `useDamConfigState(damClient)` keep their
no-throw), with one case; or document the silent fallback in the changelog and the guide.

## Checked and correct

1. The points against the brief and the gaps.
   - F: the seven keys default to today's addresses (`api/damEndPoints.ts:4-10`) and are read where a configuration
     is known: `damConfigState.ts:36,49,79,112,151-154,229,290,333` (at request time, by the state's own name),
     `cachedUsers.ts:28-29`, `DamUserFilterRemoteAutocomplete.vue:25-27`, `DamUserRemoteAutocomplete.vue:43-46`,
     `podcastFilterAndActions.ts:39-40,52`, `ImageMediaWidgetInner.vue:747,901`. Every library call
     `useDamConfigState(client, …)` passes the name its client came from (grep, 13 sites). Every other fixed
     `/adm/v1` or `/pub/v1` address in `src`: client-only and documented (choice 1): `user/api/assetLicenceApi.ts:8`,
     `assetLicenceGroupApi.ts:8`, `extSystemApi.ts:8`, `userApi.ts:33,45`; not DAM's: `imageWidget/composables/
     imageApiCms.ts:8` (the CMS image API, replaced per name by `image.configs[name].imageApi`),
     `auth/composables/defineAuth.ts:130` (a default the caller overrides), `anzuUser/api/anzuUserApi.ts:8`,
     `filters/bookmarks/api/userAdminConfigApi.ts:7`, `permission/config/api/permissionConfigApi.ts:6`,
     `permission/group/api/permissionGroupApi.ts:8`, `job/api/jobApi.ts:7`, `log/composables/logType.ts:27-28` (the
     application's own backends), `playground/*` (not in `lib.ts`); and the defaults of the five older keys
     (`commonAdminCoreDamOptions.ts:28-31,82`). No literal `client().get('/…')` in `src/domains`. Codex's K3 (the
     user cache needs its route) is closed by `endPointUser`.
   - U1: `damFilterUserAllowedUploadConfigs.ts:10-11,18-22,49-53`. U2: `AImageWidget.vue:99`,
     `AImageWidgetMultiple.vue:76`, `AImageMediaWidget.vue:104`. U3: `AAssetSelect.vue:107-108`,
     `AAssetSelectMedia.vue:106-107`, `AAssetListInner.vue:117-118`; the skip is checked before the call, so it wins;
     `ImageMediaWidgetInner` gets no prop (choice 6) and its pickers inherit its name. No other reader of a current
     user in `src/domains` (grep `SYSTEM_DAM`, `useCurrentUser(`); the grants (`roiUpdateAcl`, …) were per name already.
   - G1: `DamAdminAssetLink.vue:21-24`, inside a widget's dialog by inheritance (`ImageDetailDialogMetadata.vue:311`).
     G2: `uploadPresets.ts:85,104`, reached with the queue's name (`presets/queuePresets.ts:56`); `waitLimit.ts:16-24`
     and its six callers (`ImageWidgetInner.vue:337,390`, `ImageMediaWidgetInner.vue:357,412`,
     `ImageWidgetMultipleInner.vue:164`, `imageDialogDamAuthors.ts:197`) with the name their saves are keyed by and the
     same `requests` as before. No other reader of the root `adminDomain` or `apiTimeout` (grep) but the
     notifications' `useCommonAdminCoreDamOptionsGlobal`.
   - D2: `imageWidget/composables/commonAdminImageOptions.ts:19`; nothing else indexes `image.configs` by a name.
   - `endPointPubConfiguration` follows the leader's provisional choice 3 against the brief ("not in this step");
     recorded in the note (`impl/PV14c-L5.md:41`).
2. `default` unchanged for the three admins.
   - None sets a new key or `currentUser`; `apiTimeout` and `adminDomain` are at the root in all three: admin-cms
     `src/main.ts:57-70` (`default: { damClient }`), admin-ugc `src/main.ts:48-78` (its `default` sets only
     `endPointAsset/Image/Roi` of the address keys), admin-dam `src/main.ts:39-49` with
     `src/plugins/commonAdminCoreDam.ts:9-13`.
   - Template by template, snapshot against tree, the URLs are equal: `/pub/v1/configuration`, `/adm/v1/configuration`,
     `/adm/v1/configuration/ext-system/:extSystem`, `/adm/v1/asset-licence/:id`, both custom-form templates with their
     query, `/adm/v1/user`, `/adm/v1/podcast/licence/:licenceId`, `/adm/v1/cms/asset/:id` (was
     `'/adm/v1/cms/asset/' + ':id'`).
   - `currentUser` resolves `?? 'dam'` (`commonAdminCoreDamOptions.ts:88`, `damFilterUserAllowedUploadConfigs.ts:10-11`):
     `defineAuth('dam')` and `useCurrentUser('dam')` as before. `adminDomain` and `apiTimeout`: `configuration ?? root`
     (`commonAdminCoreDamOptions.ts:89-92`, `waitLimit.ts:22-23`), the root for all three; a `null` still reaches the
     composable's 30 (`uploadService.ts:108`).
   - The two utilities now read the options and throw where the options do; their six callers read the same options
     in setup first, and admin-ugc reaches none of them (inner widgets and `AAssetListInner` with
     `skip-current-user-check`: `ImageWidget.vue:170`, `ImageWidgetMultiple.vue:146`, `AssetList.vue:148`).
   - `damEndPointsOf` without options: the defaults, no throw (admin-dam `router/beforeEachRoute.ts:30,43`; case
     `damNamedConfigurationKeys.test.ts:175`). A name not configured: L4.
3. Public API. `src/lib.ts` is the snapshot's. The three exported functions take one trailing optional parameter:
   `fetchDamUserListByIds` (`userApi.ts:13`), `useFetchDamUserList` (`:25`), `fetchAssetAsCmsMedia`
   (`damAssetApi.ts:75-79`); every consumer call has the old arity and none hands them on as a callback (admin-dam
   `domains/coreDam/user/composables/userActions.ts:37,160,172`; admin-cms
   `…/anzutap/nodes/embedAudio/composables/embedAudioDialogActions.ts:85`,
   `…/embedVideo/composables/embedVideoDialogActions.ts:88`,
   `domains/cms/article/composables/useArticleAudioNarrationMedia.ts:22`). The internal APIs and utilities likewise
   (trailing, optional). The new keys are optional. `useCommonAdminImageOptions('constructor')` throwing is the Fixed
   entry.
4. Tests. On the snapshot 13 red: 7 of the keys file (`pv5-ohyb-pred.log`) and 6 of the final currentUser file
   (`pv5-ohyb-pred-u.log`; the first run had `open` in the `it.each`, green on the snapshot, since replaced by the "no
   user loaded" case), each for the right reason: `own`'s first request 404 at the default address
   (`Unknown Error: false`), `GET /adm/v1/cms/asset/picked` by `own`'s client, the root admin domain,
   `[1000,1000,1000]` for `[3000]`, `[30000]` for `[120000]`, no throw for `constructor`/`toString`, user `x` judged as
   `dam`. After the change each key of the keys case is pinned by the exact `asked()` list (`:159-168`) and `own`'s 404
   for any other path (`support/fakeDam.ts:246,321`). Bends b1 → 1 red, b2 → 6 red. Full check 388 files, 5419 tests
   green, without retries; lints green. The note's counts match the logs (its coverage sentence: L2).
   Uncovered callers: `AAssetSelect`/`AAssetSelectMedia` pass the one name constant of the component (`:63` in both)
   that all their other reads use; the six wait-limit callers pass theirs to a function that is pinned (`:281-288`).
   Low risk; a case for the selects is cheap (mount under `own`, ready, open, expect the `unallowedLicence` alert) but
   not needed now. The uncovered paths that matter are those of L2.

## Outside the step

**O1 (Low). admin-cms and admin-ugc give the library a literal `apiTimeout: 30` while their DAM clients time out at
the env value.** admin-cms `src/main.ts:63` and admin-ugc `src/main.ts:72` against
`admin-cms/src/shared/apiClients/damClient.ts:13` and `admin-ugc/src/domains/blog/blog/api/clients/damClient.ts:10`
(`envConfig.dam.apiTimeout * 1000`). Both templates say 30 (`admin-cms/public/config.json.dist:66`,
`admin-ugc/public/config.json.dist:24`), so nothing differs today; a deployment that changes the value gets chunk
sizes and wait limits for 30 s against another client timeout. Fix in the admins: `apiTimeout:
envConfig.dam.apiTimeout`, as admin-dam does (`admin-dam/src/main.ts:43`).
