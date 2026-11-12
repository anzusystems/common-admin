# Overenie 17: PV14c, full support of named DAM configurations (Claude, 18. 10.)

Task: the owner's decision of 18. 10. ("a configuration other than default can be used; it is not supported everywhere
in the code, it has to be completed"). Inventory of what still ignores a named DAM configuration, use by the three
admins, a design and steps. Read-only: I ran no test, build, lint or app. Library tree
`/home/volar/projects/anzusystems/common-admin`, branch `next`, commit 38a725cf plus the working tree.

Abbreviations: `L/` = `common-admin/src/domains/dam/`, `LQ/` = `L/uploadQueue/`, `LIB` = `common-admin/src/`,
`CMS/` = `admin-cms/src/`, `UGC/` = `admin-ugc/src/`, `DAM/` = `admin-dam/src/`. Line numbers are the current tree.
"Inferred" marks what I did not read in code.

The scenario used throughout: **admin-cms with `default` = the CMS DAM client (`/adm/v1/*`, the CMS user's DAM
session) and `ugc` = a UGC client (`/ugc/v1/*`, a blog user's token, as admin-ugc's `default`, `UGC/main.ts:48-78`)**,
with `<AImageWidget config-name="ugc">` on an article page next to `default` widgets. Where it matters, a second
variant: `ugc` is a different core-dam instance (other ids).

## 0. Summary

- **What PV14a/PV14b already do.** The name is inherited in the component tree (`L/composables/damConfigName.ts:11-16`),
  an upload queue keeps its name (`LQ/store/uploadQueuesStore.ts:50-56,137-146`), and every request a component makes
  goes by the client and addresses of its name: upload, reads, both upload dialogs, asset select and its detail, detail
  save, author/keyword lookup and creation with their ACLs, image mass operations, validations (`impl/PV14b.md:92-97`).
- **What does not.** Everything that holds DAM data for the page: the caches of names and their ext-system id, the DAM
  configuration store (prv/pub config, ext-system configs, licence → ext system, custom forms, chunk sizes), the
  notification socket and its "push alive" state, the user the licence check judges, and two root options
  (`adminDomain`, `apiTimeout`). They are one per page and answer as `default` (or as whoever wrote last).
- **Gaps by area (part 2):** name caches 14, ext-system id of the caches 7, DAM configuration store 8 (about 45 call
  sites), notifications 3, licence-check user 3, root options 2, defaults/plumbing/docs 4: **41**, plus 7 fixed
  addresses that are a boundary rather than a bug. Not a gap: 13 page-wide UI states that hold no per-DAM data (2.9).
- **Admins (part 3):** no call they make today needs a new parameter: with only `default`, every proposed default keeps
  its meaning. admin-ugc's wrappers fill the DAM configuration store by hand (`UGC/domains/blog/image/components/
  ImageWidget.vue:86-145`); they keep working against `default`.
- **Design (part 4):** a DAM configuration is a *DAM context*; every per-DAM state is kept per name, created lazily,
  `default` keeping today's ids. Public API grows only by optional parameters, one new export (`useDamConfigStoreOf`)
  and optional options keys. No breaking change for the three admins; the behavioural changes under a named
  configuration are the point of the step (4.9).
- **Steps (part 5):** PV14c-1 caches 6 h, PV14c-2 configuration store 7 h, PV14c-3 notifications 5 h (2.5 h minimal),
  PV14c-4 licence-check user and root options 3 h, PV14c-5 names required and docs 2 h; admin-dam CK 1 h; admin-ugc
  0.5 h optional; admin-cms nothing. **About 24 h.**
- **Owner decisions (part 6):** isolation per name even for one core-dam (D1), notifications of a named configuration
  (D2), the user of the licence check (D3), fixed addresses (D4).

## 1. How the name works today

| What | Where | Behaviour |
|---|---|---|
| Name in the tree | `L/composables/damConfigName.ts:11-16` | explicit prop, else injected `DamConfigNameKey`, else `default`; provided on; read once in setup |
| Options of a name | `L/composables/commonAdminCoreDamOptions.ts:37-88` | client, five addresses, ACLs, switches, texts; throws for a name not in `configs` (`:39-46`, `Object.hasOwn` `:42`) |
| Root options | same file `:107-117`; `LIB/AnzuSystemsCommonAdmin.ts:110-125` | `apiTimeout`, `notification`, `adminDomain`: one per page |
| Image options | `L/imageWidget/composables/commonAdminImageOptions.ts:14-21` | own `image.configs[name]`; a widget under `x` needs both |
| Queue name | `LQ/store/uploadQueuesStore.ts:52-56,137-146` | `configOf(queueKey)`; another name into a queue with rows is refused |
| Settlement reads | `LQ/settlement/uploadSettlementTypes.ts:38-53,70-79` | `UploadReadOptions.queueKey` (PV14a) |

Inject semantics, verified in the installed packages: Vue 3.5.44 `inject` prefers the app context over the component
(`node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js:826-840`), and Pinia 4.1.0 runs a setup store in
`pinia._a.runWithContext` (`node_modules/pinia/dist/pinia.js:1203`). A store's `inject` therefore sees only app-level
provides, but in a test with `createPinia()` not installed in an app it falls back to the component that first called
the store and would inherit that component's name. Library code must hand names to stores and caches explicitly.

## 2. Inventory (task 1)

Column "PV14a/b": whether those steps cover it. "Left as PV14c" means deliberately out (`impl/PV14a.md:113-116`,
`impl/PV14b.md:96-97`, `navrh-jadro.md:815-823`, `navrh-komponenty.md:1057-1060`).

### 2.1 Name caches of authors, keywords, users (N): 14

| # | file:line | Today | Under `ugc` | PV14a/b |
|---|---|---|---|---|
| N1 | `L/author/composables/cachedAuthors.ts:19-28`, `:30-50` | one `defineCached` per page; fetch by `useCommonAdminCoreDamOptions()` (= `default`, `:26`) and `cachedExtSystemId` (`:24,27`) | ids of a `ugc` asset are asked by the CMS client at `/adm/v1/author/ext-system/<last ext system>/search`; `ugc`'s `endPointAuthor` is ignored; a 403 or a missing id leaves the chip `#id`. Two instances: an id the CMS DAM happens to know shows its name (DocId is a string, `LIB/shared/types/common.ts:29`; UUID inferred, so unlikely) | left as PV14c |
| N2 | `L/keyword/composables/cachedKeywords.ts:17-26`, `:28-48` | the same for keywords (`:24`) | the same | left as PV14c |
| N3 | `L/author/composables/cachedUsers.ts:21-30`, `:34-44` | users by `IntegerId`, `default` client (`:25`), `/adm/v1/user` (`L/user/api/userApi.ts:8`) | same core-dam: asked as the CMS user. Two instances: user 5 of the UGC DAM is shown as user 5 of the CMS DAM, silently | left as PV14c |
| N4a | `L/assetDetail/components/AssetMetadata.vue:62,73-81` | conflict chips of the detail fill the page cache (OP11-L1, `impl/OP11-L1.md:97-101`) | detail under `ugc` asks names as `default` | name known (`:41`), unused |
| N4b | `LQ/components/uploadQueueBindings.ts:52-53,64-69` | `prime` of the list binding | rows of a `ugc` queue asked as `default` | name is a parameter (`:46-49`), unused for caches |
| N4c | `L/assetSelect/composables/assetSelectListActions.ts:156-158,181-190` | click in the picker fills authors, keywords and users | picker under `ugc` | name is a parameter (`:35`), unused for caches |
| N4d | `LQ/store/uploadQueuesStore.ts:43-44,114-119,322-329,342-348` | the store's settlement profile and `updateFromDetail` fill the page cache | rows and saved details of `ugc` asked as `default` | `updateFromDetail` gets the name (`:294`), unused for caches |
| N4e | `L/keyword/components/KeywordRemoteAutocompleteWithCached.vue:112,209` | a created keyword goes to the page cache; `:use-cached` is the page cache | a keyword created at `ugc` lands in the `default` cache | lookup and creation by name (PV14b) |
| N4f | `L/author/components/AuthorRemoteAutocompleteWithCached.vue:123,207` | the same for authors | the same | the same |
| N5a | `L/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue:35` (exported `ADamAuthorCachedChip`, `LIB/lib.ts:1557`) | reads the page cache; no `configName` prop (`:13-33`) | the name shown is the `default` cache's | no |
| N5b | `L/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:25` | the same | the same | no |
| N5c | `L/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue:33` | the same | the same | no |
| N5d | `L/assetDetail/components/AssetFileInfoPanel.vue:26,63,78` | users of "created/modified by" from the page cache | wrong user in the two-instance variant | no |
| N6 | `LQ/settlement/uploadSettlementTypes.ts:83-88`; `LQ/settlement/uploadSettle.ts:139-166,322-324,531-533,546-547`; `LQ/settlement/uploadSettlement.ts:144-147` (called at `:388,:544,:585`) | the profile's `caches.add*(ids)` and `fetch*()` carry no queue; `mergeLoadedMetadata` and `loadMetadata` have none to pass | the library store cannot tell which name's cache a row's names belong to | PV14a gave reads a `queueKey`, not caches |

### 2.2 Ext-system id of the caches (X): 7

| # | file:line | Today | Under `ugc` | PV14a/b |
|---|---|---|---|---|
| X1 | `L/composables/extSystemIdForCached.ts:4` (exported, `LIB/lib.ts:1561`) | one `ref` per page, last writer wins | the CMS and UGC widgets overwrite each other's ext system; N1/N2 then ask one DAM's names under the other's ext system | no |
| X2 | writers: `L/imageWidget/components/ImageWidgetInner.vue:445,469,500,719`; `ImageMediaWidgetInner.vue:462,485,516,859`; `ImageWidgetMultipleInner.vue:209,222,232,460`; `AImageWidgetMultiple.vue:75`; `L/assetSelect/composables/assetSelectListActions.ts:168,180` | write the page ref | as X1 | no |
| X3a | `L/imageWidget/composables/useImageMassOperations.ts:34,42`; `ImageMassOperations.vue:71,73-76,160` | the name's client with the page's ext system; "authors enabled" by the page's ext system | gallery under `ugc` asks `ugc` authors under the CMS ext system | client by name (PV14b) |
| X3b | `ImageWidgetMultipleInner.vue:499,553,600,660,879` | authors enabled, author reads, `showMetadataSaveError(e, cachedExtSystemId.value)`, detail's `ext-system` | as X3a | client by name |
| X3c | `ImageWidgetInner.vue:1222`, `ImageMediaWidgetInner.vue:1426` | the asset detail gets `:ext-system="cachedExtSystemId"` | detail of a `ugc` widget opened after a CMS widget wrote: CMS custom form and author/keyword rules | no |
| X3d | `ImageWidgetMultipleItem.vue:45,122`; `ImageDetailDialogMetadata.vue:70,166,260` | author inputs of the image dialog get the page ext system | as X3c | no |
| X3e | `L/imageWidget/composables/imageDialogDamAuthors.ts:35,149` | the page ext system noted for the author read after a detail closes | as X3c | client by name |

### 2.3 DAM configuration store (C): 8 rows, about 45 call sites

| # | file:line | Today | Under `ugc` | PV14a/b |
|---|---|---|---|---|
| C1 | `L/config/store/damConfigStore.ts:36-76` (exported, `LIB/lib.ts:517,1276`) | one Pinia store `commonAdminDamConfigStore`: pub and prv config, ext-system configs and licence → ext system by `IntegerId`, custom forms by ext system, distribution forms | two instances: licence 100 and ext system 4 of one DAM read as the other's; same core-dam: shared, which works only by accident (C3) | no |
| C2 | `L/config/composables/damConfigState.ts:24-25,62-90` | any client loads into and reads from that one store; `initialized.damPrvConfig` is the page's | whichever name loads first defines the settings of all | client by name in callers (PV14b), store not |
| C3 | `L/imageWidget/components/AImageWidget.vue:81-123` (`:107,:113`), `AImageWidgetMultiple.vue:54-100` (`:78,:86`), `AImageMediaWidget.vue:86-128` (`:107,:115`), `L/assetSelect/components/AssetDistributionServiceNameFilter.vue:27-43` | load the prv config only if nobody has | a `ugc` widget never loads its own prv config: CMS `imageChunkConfig`, `distributionServices`, `colorSet`, settings; on a page where `ugc` mounts first, the CMS widgets get UGC's | no |
| C4 | `damConfigState.ts:264-310,312-331`; callers `ImageWidgetInner.vue:704,713`, `ImageMediaWidgetInner.vue:844,853`, `ImageWidgetMultipleInner.vue:454,496,517`, `imageDialogDamAuthors.ts:34`, `L/assetSelect/components/AAssetSelect.vue:88,242`, `AAssetSelectMedia.vue:88,248`, the three `AImage*Widget` roots (C3) | licence → ext system cached by licence id, loaded with the caller's client into the page store | two instances: a UGC licence id resolves to the CMS DAM's ext system (wrong slots, sizes, mime types, ROI ratio) | client by name, store not |
| C5 | ext-system config read without a name: `L/keyword/composables/keywordActions.ts:14-19`, `L/author/composables/authorActions.ts:14-16`, `KeywordRemoteAutocompleteWithCached.vue:92-96`, `L/author/components/AuthorCreateButton.vue:57-61`, `L/keyword/composables/damKeywordConfig.ts:8`, `L/author/composables/damAuthorConfig.ts:8` (both exported, `LIB/lib.ts:1562-1563`), `AssetMetadata.vue:55-59,88-92`, `LQ/components/UploadQueueItemEditable.vue:216-225`, `LQ/components/AssetQueueSelectedSidebar.vue:126-135`, `ImageWidgetInner.vue:572,653`, `ImageMediaWidgetInner.vue:644,794`, `ImageMassOperations.vue:73`, `L/cropper/components/DamAssetImageRoiSelect.vue:41-46`, `uploadQueuesStore.ts:200-205,233-238` | page store | rules of the other DAM's ext system of the same id; "Ext system must be initialised" when only the other name loaded it | no |
| C6 | custom forms without a name: `L/assetDetail/components/AssetCustomMetadataForm.vue:31-43` (exported), `LQ/components/AssetCustomMetadataFormMassOperations.vue:40-42`, `L/api/damAssetApi.ts:273-276` (`showMetadataSaveError` names fields), `AAssetSelect.vue:86,223-232`, `AAssetSelectMedia.vue:87,229-238`, `AAssetListInner.vue:82` | page store by ext system | the other DAM's form, or none | client by name for loads |
| C7 | prv config readers: `L/assetDetail/components/AssetImageMetaIcons.vue:51-53` (exported), `L/user/types/DamDistributionServiceType.ts:6-7` (exported `useDamDistributionServiceType`), `L/user/types/DamExternalProviderAssetType.ts:6`, used by `L/user/components/DamDistributionServiceSelect.vue:40` and `DamExternalProviderAssetSelect.vue:40` (their `client` prop, `:10`, is not used for the options) | page store | icons and options of the other DAM | no |
| C8 | `LQ/composables/damUploadChunkSize.ts:5,8-9,38-42`; `LQ/composables/uploadService.ts:108` | last chunk size module-wide; min/max from the page prv config; the service does not pass the name its preset has (`LQ/presets/uploadPresets.ts:83-84`) | chunks of a `ugc` upload bounded by CMS settings, starting from the CMS upload's last size | preset by name (PV14a), chunk size not |

### 2.4 Notifications and push state (P): 3

| # | file:line | Today | Under `ugc` | PV14a/b |
|---|---|---|---|---|
| P1 | `L/composables/damNotifications.ts:15-17,19-57,96-114`; options `commonAdminCoreDamOptions.ts:107-117`, `LIB/AnzuSystemsCommonAdmin.ts:121-124` | one socket per page from the root `notification` | a configuration cannot name its own socket nor say it has none | left as PV14c (`navrh-jadro.md:820-821`) |
| P2 | `L/composables/damNotificationsConnection.ts:6,13-24`; `uploadQueuesStore.ts:125`; `LQ/settlement/uploadSettlement.ts:667,681` | one "push alive"; every queue's poller goes `sparse` when the page socket is open | the notification server sends to the SSO users of the JWT cookie (`notification-server/README.md:12,19`), so the blog user's uploads bring no event to the CMS user's socket (inferred from the README). Yet the `ugc` queue polls `sparse`: reads at 10, 30, 60 s, then every 1, 3, 5 min instead of 5, 10, 16, … s (`LQ/settlement/uploadPollSchedule.ts:15-34`). A file done at 12 s settles at 30 s; one done at 6 min settles at 8 min | no |
| P3 | `uploadSettlementTypes.ts:120-123` (exported type) | `connection.isPushAlive()` without a queue | the settlement cannot ask per queue | no |

### 2.5 The user the licence check judges (U): 3

| # | file:line | Today | Under `ugc` | PV14a/b |
|---|---|---|---|---|
| U1 | `L/config/utils/damFilterUserAllowedUploadConfigs.ts:8-31,33-57` | always `useCurrentUser(SYSTEM_DAM)` | the CMS user's DAM grants judge a widget whose requests go as the blog user: read-only though allowed, or offered though refused | no |
| U2 | `AImageWidget.vue:99`, `AImageWidgetMultiple.vue:76`, `AImageMediaWidget.vue:104` | the roots check with no way to skip | as U1; admin-ugc avoids it by mounting the inner widgets with `skip-current-user-check` (`UGC/domains/blog/image/components/ImageWidget.vue:170`, `ImageWidgetMultiple.vue:146`, `AssetList.vue:148`) | no |
| U3 | `AAssetSelect.vue:104-105`, `AAssetSelectMedia.vue:103-104`, `AAssetListInner.vue:114-115` | skippable by prop; `ImageMediaWidgetInner.vue:1410-1421` passes no skip and has no such prop | as U1 for the media widget's picker | no |

### 2.6 Root options (G): 2

| # | file:line | Today | Under `ugc` |
|---|---|---|---|
| G1 | `L/components/DamAdminAssetLink.vue:23` | `adminDomain` of the page | two instances: "edit in DAM" opens the CMS DAM admin for a UGC asset |
| G2 | `LQ/presets/uploadPresets.ts:85-87` | chunks sized against the root `apiTimeout` "whatever the configuration" | a client with another timeout (admin-ugc's has its own, `UGC/domains/blog/blog/api/clients/damClient.ts:10`) gets chunks sized for the CMS one; minor |

### 2.7 Fixed addresses (F): 7, a boundary

They go by the client of the name (PV14b) but the configuration cannot change them: `L/config/api/damConfigApi.ts:7-9`
(configuration, pub configuration, ext-system configuration), `L/api/damAssetLicenceApi.ts:6`,
`L/config/api/damAssetCustomFormApi.ts:9`, `L/user/api/userApi.ts:8`, `L/assetSelect/api/damPodcastApi.ts:8`,
`L/api/damAssetApi.ts:22` (`/adm/v1/cms/asset/`), and the client-prop components' `L/user/api/extSystemApi.ts:8`,
`assetLicenceApi.ts:8`, `assetLicenceGroupApi.ts:8`. The petit core-dam's UGC routes have only Asset, AssetLicence
(`/asset-licence/blog/{blogId}`), Image and RegionOfInterest controllers (`petit/core-dam/src/Controller/Api/Ugc/V1/`,
`AssetLicenceController.php:21,31`; routes of the vendor bundle not checked). Whether a UGC client may call
`/adm/v1/*` I did not check; admin-ugc does not, and fills the store itself (`UGC/.../ImageWidget.vue:65-145`).

### 2.8 Defaults, plumbing, documents (D): 4

| # | file:line | What |
|---|---|---|
| D1 | `commonAdminCoreDamOptions.ts:37`, `commonAdminImageOptions.ts:14`, `assetSelectListActions.ts:35`, `L/assetSelect/composables/podcastFilterAndActions.ts:38`, `uploadQueuesStore.ts:198,231`, `LQ/composables/uploadQueueItemRefresh.ts:84` | internal composables default the name to `'default'` (none is exported, `LIB/lib.ts` has none of them). Every production caller passes a name except the three caches (`cachedAuthors.ts:26`, `cachedKeywords.ts:24`, `cachedUsers.ts:25`): a forgotten name compiles and silently goes to `default` |
| D2 | `commonAdminImageOptions.ts:14-21` | no `Object.hasOwn`: `constructor` passes as an image configuration (noted in `impl/PV14a.md:184-187`) |
| D3 | exported without `configName`: `ADamAuthorCachedChip`, `ADamAssetCustomMetadataForm`, `ADamUploadQueueItem` (`UploadQueueItemEditable.vue:33`), `ADamUploadQueueMassOperations` (`AssetQueueSelectedSidebar.vue:21`), `ADamAssetImageMetaIcons`, `ADamDistributionServiceSelect`, `ADamExternalProviderAssetSelect`; internal: the keyword and conflict chips, `AssetFileInfoPanel`, `AssetCustomMetadataFormMassOperations` | they hold per-DAM state (N5, C5-C7) and none calls `useDamConfigName()`; inside a named tree they would inherit the name once they do |
| D4 | `LIB/AnzuSystemsCommonAdmin.ts:69-72`, `cachedAuthors.ts:25`, `cachedKeywords.ts:23`, `uploadPresets.ts:85-86`, `doc/changelog/2.0.0.md:72-73`, `doc/guide/installation.md:64`, `navrh-jadro.md:54,815-823,1254-1255,1432,1645`, `navrh-komponenty.md:1057-1060,1099` | state the "one page = one core-dam" rule and the `default` caches |

### 2.9 Page-wide, not per DAM (S): no change

One modal at a time or keyed by UUID/queue, so a second name changes nothing: `L/assetSelect/store/assetSelectStore.ts:20`,
`L/assetDetail/store/assetDetailStore.ts:16` (its own rule, `:37-44`), `L/imageWidget/store/imageStore.ts:5` (one
gallery per page, `ImageWidgetMultipleInner.vue:129` resets it), `imageMediaWidgetStore.ts:19`,
`L/cropper/store/imageRoiStore.ts:6`, `LQ/composables/useUploadQueueDialog.ts:5-11`, `assetSelectListActions.ts:25-33`
(pagination, requests), `L/assetSelect/filter/AssetFilter.ts:82`, `assetSelectFilterSidebar.ts:3-4`,
`assetSelectGridView.ts:11`, the one queue store `uploadQueuesStore.ts:42` (names per queue), the event bus
(`damNotifications.ts:24`), `updateFromDetail` over all queues by asset id (`uploadQueuesStore.ts:305-330`).
`L/imageWidget/utils/imageSaves.ts:24-28` is already keyed by name. A limit that is not about names: two galleries,
two pickers or two details on one page clash today whatever their names.

### 2.10 Two side findings

- **Pinia id clash** (verified): admin-dam's `DAM/domains/coreDam/asset/store/imageRoiStore.ts:7` and the library's
  `L/cropper/store/imageRoiStore.ts:6` are both `defineStore('damImageRoiStore', …)`. Pinia keeps one store per id,
  so the definition used second gets the first one's store (inferred from Pinia's design): admin-dam's extra members
  (`timestampCropper`, `forceReloadCropper`, … per the admin sweep) are missing when the library's was created first.
  Not PV14c; worth its own fix (rename the library's to `commonAdminDamImageRoiStore`).
- `ImageMediaWidgetInner` has no `skipCurrentUserCheck` at all (U3), unlike the two other inner widgets.

## 3. The three admins (task 2)

From a full sweep of the three `src` trees (production code; sampled call sites re-read: `UGC/.../ImageWidget.vue:60-110`,
`CMS/App.vue:16,25`, `DAM/domains/coreDam/asset/composables/currentExtSystem.ts:26,49,54,60,96`).
**Nobody passes `configName` to a library DAM export today**; every mount relies on the inherited `default`.

| Admin | Uses of the affected exports | Needs a new parameter? |
|---|---|---|
| admin-cms | `initDamNotifications()` `CMS/App.vue:16`, `openConnection()` `:25`; `useDamConfigState(damClient)` + `loadDamPrvConfig()` `CMS/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepUserCreate.vue:60,145`; DAM user loaded as system `dam` `CMS/domains/system/composables/appInitialize.ts:68,78`; `useImageStore().reset()` `GalleryEdit.vue:49,52`; client-prop components with `:client="damClient"` (wizard `:291-336`, `SiteGroupManage.vue:125-280`); 30 `AImageWidget`, 2 `AImageMediaWidget`, 1 gallery, 3 `AAssetSelect`, 3 `ADamAdminAssetLink`, none with `config-name`; own `DamMediaPlayback.vue:9,16,29` takes an *image* `configName` | no |
| admin-ugc | wrappers `UGC/domains/blog/image/components/ImageWidget.vue:24,40,86-145,149,165-170`, `ImageWidgetMultiple.vue:17,25,61-131,141-146`, `AssetList.vue:18,22,50-113,140-148`, `ImageWidgetSimple.vue:13,28,57`: prop `configName` default `'default'` passed on, and **writes into `useDamConfigStore()`** (prv `initialized`, chunk config, licence → ext system 4, custom forms, ext-system config); `skip-current-user-check`; notifications off (`UGC/main.ts:74-77`); no `config-name` at any mount of the wrappers | no; optional: write into `useDamConfigStoreOf(props.configName)` so a wrapper given another name fills that name's store |
| admin-dam | caches through wrappers `DAM/domains/coreDam/author/composables/cachedAuthors.ts:6`, `keyword/composables/cachedKeywords.ts:6`; `useDamCachedUsers()` at 12 sites (one passes the function itself, `DamTrackingFields.vue:7`); `useExtSystemIdForCached()` module-level `currentExtSystem.ts:26`; `useDamConfigState(damClient)` 22 sites incl. `appInitialize.ts:65-124`, `router/beforeEachRoute.ts:30-43`; `useDamConfigStore()` 17 sites; `initDamNotifications()`/`useDamNotifications()` `DAM/domains/system/composables/appNotificationListeners.ts:23-24,80`; own upload store `uploadQueuesStore.ts:228-229,339,344` with its own profile caches and `useDamNotificationsConnection()`; `useDamKeyword/AuthorAssetTypeConfig` `AssetMetadata.vue:74,79`; `useDamUpload` + `adminDamUploadPreset` `uploadService.ts:50,53` | no: every call is the `default` meaning; the optional parameters are ignored by its own profile implementations |

Test files touching the names in the three admins (plain grep in the sweep): admin-cms 0 of 82, admin-ugc 0 of 15,
admin-dam 57 of 131 (includes mocks of its own `fetchAsset`). admin-dam's tests mock `useDamConfigStore` as a function
(`DAM/test/cached/cachedExtSystemInit.test.ts:37`, `DAM/test/router/beforeEachRoute.test.ts:15`); that keeps working
because `useDamConfigStore` stays (4.4).

## 4. Design (task 3)

### 4.1 The rule

A DAM configuration is a **DAM context**: its client and addresses (as now) and its own caches of names, ext-system id
of those caches, DAM configuration store, chunk size, notification channel and licence-check user. The library keeps
each of them per name, created on first use; `default` keeps today's ids and objects, so a page with `default` alone
behaves as now. Two names never share a context, even when they point to one core-dam (D1).

How a component resolves its name stays as PV14b made it (`damConfigName.ts:11-16`; `doc/changelog/2.0.0.md:73`,
`doc/guide/installation.md:63`): explicit `configName`, else the nearest ancestor's, else `default`. New:

- **Library code passes the name explicitly** to every per-DAM accessor (cache, store, connection, user check). It
  never relies on inheritance outside a component's setup (1, the Pinia note).
- **Public composables** take an optional `configName`; left out, they take the inherited name when called in a
  component's setup (`hasInjectionContext()` and `inject(DamConfigNameKey)`), else `default`. admin-dam calls them at
  module level or in setups with no provider: `default`, as now.
- **Internal composables** lose their `= 'default'` (D1 of 2.8), so TypeScript finds a call without a name.

### 4.2 Name caches (N1-N6)

- `cachedAuthors.ts`, `cachedKeywords.ts`, `cachedUsers.ts`: `const caches = new Map<string, Cache>()`;
  `cacheOf(name)` makes the `defineCached` on first use with a fetch that reads `useCommonAdminCoreDamOptions(name)`
  and the ext-system ref of `name` at call time. `useDamCachedAuthors(configName?)`,
  `useDamCachedAuthorsForRemoteAutocomplete(configName?)`, the same for keywords and users.
- Fillers and readers pass their name (N4a-N5d). The autocompletes bind the cache: `:use-cached="() =>
  useCachedKeywordsForRemoteAutocomplete(damConfigName)"`; `AFormRemoteAutocompleteWithCached` calls it once in
  setup (`LIB/domains/remoteAutocomplete/components/AFormRemoteAutocompleteWithCached.vue:103`). The chips call
  `useDamConfigName()`; `ADamAuthorCachedChip` also gets an optional `configName`.
- Settlement (N6): `UploadSettlementProfile.caches.addAuthors(ids, queueKey?)`, `addKeywords(ids, queueKey?)`,
  `fetchAuthors(queueKey?)`, `fetchKeywords(queueKey?)`. The core passes the row's queue: `mergeLoadedMetadata(…,
  queueKey)`, `loadMetadata(queueKey, …)`, the duplicate path per row, `fetchCaches` for the queues it touched. The
  library store routes by `configOf(queueKey)`; admin-dam's profile ignores the argument.
- A name's cache asks at its `endPointAuthor`/`endPointKeyword`; the comment `AnzuSystemsCommonAdmin.ts:69-72` and
  the changelog advice "names them in `default` too" (`doc/changelog/2.0.0.md:72`) go.

### 4.3 Ext-system id of the caches (X1-X3e)

`useExtSystemIdForCached(configName?)` returns the ref of the name (a `Map<string, Ref<IntegerId>>`). The writers in
X2 and the readers in X3 pass their name. Within one name it stays last-writer-wins, as today (4.10).

### 4.4 DAM configuration store (C1-C8)

- `damConfigStore.ts`: the setup function is kept; `useDamConfigStore` **stays the `default` store definition** (same
  id `commonAdminDamConfigStore`); new `useDamConfigStoreOf(configName = 'default')` returns `useDamConfigStore()` for
  `default` and a memoized `defineStore('commonAdminDamConfigStore:' + name, setup)` otherwise. Why a new name rather
  than a parameter: a Pinia store definition takes `pinia` as its first argument, so `useDamConfigStore('ugc')` cannot
  mean a name. HMR: `acceptHMRUpdate` for the `default` definition as now.
- `useDamConfigState(client?, configName?)` uses `useDamConfigStoreOf(configName)`. Every library call in C2-C7 passes
  its name (about 45 sites). `useDamKeywordAssetTypeConfig(assetType, extSystem, configName?)`,
  `useDamAuthorAssetTypeConfig(…)`, `useDamDistributionServiceType(configName?)`,
  `useDamExternalProviderAssetType(configName?)`, internal `showMetadataSaveError(error, extSystem, configName)`.
- Chunk size (C8): the internal preset members (`uploadPresets.ts:52-59`) get `configName` (`libraryUploadPreset` its
  name, `adminDamUploadPreset` `default`); `useDamUploadChunkSize(apiTimeout?, configName?)` keeps the last size per
  name.
- Consequence: a widget under a name loads the prv config, its licences, ext-system configs and custom forms with
  that name's client, once per name, and shows its error state when that client cannot read them (2.7). Such an
  application fills `useDamConfigStoreOf(name)` before mounting, as admin-ugc fills `default` today.
- The client-prop components `ADamDistributionServiceSelect`, `ADamExternalProviderAssetSelect` get an optional
  `configName` for the store they read (their `client` prop stays as it is).

### 4.5 Notifications (P1-P3)

- New optional key `CommonAdminCoreDamConfig.notification?: boolean | { enabled?: boolean | string; webSocketUrl?:
  string }`. For `default` unset means the root `notification`, as now. For a named configuration: unset means **none**
  (recommended, D2), `true` the root socket, an object a socket of its own (normalized as
  `normalizeDamNotificationOptions`, `commonAdminCoreDamOptions.ts:98-105`).
- `damNotifications.ts`: sockets in a `Map` keyed by `enabled|webSocketUrl` (the memo key it already has, `:98`), so
  names with one address share one socket. `initDamNotifications()` opens the root socket and every distinct one a
  configuration names, and returns the root handle as now; `destroyDamNotifications()` closes all. All emit into the
  one event bus (asset ids are strings; UUIDs inferred).
- `damNotificationsConnection.ts`: push state per socket; `useDamNotificationsConnection(configName?)` answers for
  the socket of that name (false for none).
- Settlement: `connection.isPushAlive(queueKey?)`; the poller passes its queue (`uploadSettlement.ts:681`); `onChange`
  stays and reschedules every poller. The library store answers by `configOf(queueKey)`.
- Minimal variant (2.5 h): only `notification: false | true` per name, no second socket.

### 4.6 The user of the licence check (U1-U3)

New optional key `currentUser?: string | false` (default `'dam'`, `SYSTEM_DAM`): the `useCurrentUser(system)` that
`filterAllowedImageWidgetSelectConfigs(values, configName)` and `isImageWidgetUploadConfigAllowed(value, configName)`
judge; `false` allows every licence, as `skipCurrentUserCheck`. The props stay and win. The application loads that
user itself, as admin-cms loads `dam` (`CMS/domains/system/composables/appInitialize.ts:68,78`). Alternative (D3):
keep `SYSTEM_DAM` and add `skipCurrentUserCheck` to the three root widgets and to `ImageMediaWidgetInner`.

### 4.7 Root options (G1-G2)

Optional per-name `adminDomain` and `apiTimeout`, falling back to the root ones; read in `DamAdminAssetLink.vue:23` and
`uploadPresets.ts:87`.

### 4.8 Defaults and documents (D1-D4)

Internal composables require the name; `useCommonAdminImageOptions` gets `Object.hasOwn`; the documents in D4 lose
"one page = one core-dam" and say what a named configuration needs (its addresses for names, a readable or prefilled
DAM configuration, its notification and user keys, the same name in `image.configs`).

### 4.9 Compatibility

- **Public API, additive only:** optional `configName` on `useDamCachedAuthors`, `useDamCachedKeywords`,
  `useDamCachedUsers`, `useExtSystemIdForCached`, `useDamConfigState` (second parameter),
  `useDamKeywordAssetTypeConfig`, `useDamAuthorAssetTypeConfig`, `useDamDistributionServiceType`,
  `useDamUploadChunkSize`, `useDamNotificationsConnection`; new export `useDamConfigStoreOf`; optional props
  `configName` on the exported components of D3; optional keys `notification`, `currentUser`, `adminDomain`,
  `apiTimeout` in `CommonAdminCoreDamConfig`; optional `queueKey` on `UploadSettlementProfile.caches.*` and
  `connection.isPushAlive` (an implementation with fewer parameters stays assignable, a caller with fewer arguments
  stays valid).
- **Breaking for the three admins:** none found (part 3).
- **Behaviour under a named configuration (intended; 2.0.0 is not released, branch `next`, inferred from the open
  changelog):** names are asked at the name's client, addresses and ext system; a named configuration loads its own
  DAM configuration (one more set of requests per name) and fails to load where its client cannot read it; it has no
  push unless it says `notification`; its licence check judges `currentUser`. Each goes into the changelog entry
  `doc/changelog/2.0.0.md:73` in place of its "limits" sentence.

### 4.10 Limits that stay documented

1. Fixed addresses (2.7), unless D4 decides otherwise: a client that cannot read them needs a prefilled store.
2. A widget under a name needs the same name in `image.configs` (unchanged, `doc/guide/installation.md:64`).
3. One picker, detail, gallery and ROI editor at a time (2.9), whatever the names.
4. Within one name the ext system of the caches is the last written (two widgets of two ext systems under one name).
5. The name is read once in setup (`damConfigName.ts:6-9`); a queue holds one name (PV14a).
6. One event bus: an admin listener hears every socket.
7. Two names on one core-dam duplicate their loads and caches (D1).

Rejected: one `defineCached` keyed by `(name, id)` (one debounce over several clients; a map of caches is simpler);
keying state by client identity (implicit, and one client may serve two address sets); one Pinia store with maps by
name (breaks admin-ugc's writes `UGC/.../ImageWidget.vue:92-145` and admin-dam's 17 reads).

## 5. Steps (task 4)

Library first, in this order (1 and 2 touch the same widget files; 3 touches the store and settlement types as 1
does). Each test file runs the page with `default` (admin-cms profile) and `own` (another `FakeDam` client and
addresses), as `L/__tests__/damNamedConfigurationComponents.test.ts:54-120` and
`LQ/__tests__/uploadNamedConfiguration.test.ts` do, and every case also pins that the other client got nothing.

| Step | Content | Files | Tests that prove it | Risk | Size |
|---|---|---|---|---|---|
| **PV14c-1** caches | 4.2, 4.3 | `cachedAuthors.ts`, `cachedKeywords.ts`, `cachedUsers.ts`, `extSystemIdForCached.ts`; `uploadSettlementTypes.ts`, `uploadSettle.ts`, `uploadSettlement.ts`, `uploadQueuesStore.ts`, `uploadQueueBindings.ts`; `assetSelectListActions.ts`, `AssetMetadata.vue`, `AssetFileInfoPanel.vue`, three chips, both `*RemoteAutocompleteWithCached.vue`; `useImageMassOperations.ts`, `ImageMassOperations.vue`, `imageDialogDamAuthors.ts`, `ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, `ImageWidgetMultipleInner.vue`, `AImageWidgetMultiple.vue`, `ImageWidgetMultipleItem.vue`, `ImageDetailDialogMetadata.vue` | new `L/__tests__/damNamedConfigurationCaches.test.ts`: a chip and the detail's conflict chips under `own` ask `own` at `/own/v2/author/ext-system/<own ext system>/search`; one author id under both names on one page gives two requests and two names; users of the file panel under `own`; a `default` and an `own` widget on one page each ask with their own ext system whatever wrote last; created keyword lands in `own`'s cache. Upload: names of an `own` row after a poll read, a notification, a duplicate and `updateFromDetail(asset, 'own')` go to `own` (`uploadNamedConfiguration.test.ts` +); settlement cases that `caches.add*`/`fetch*` get the row's `queueKey` (`LQ/settlement/__tests__/uploadSettlement.test.ts`, server fixture records it as `queuesOf` does). Rewrite the comments `damAuthorKeywordEndpoints.test.ts:210-212` and `damNamedConfigurationComponents.test.ts:57-62` | medium: many files; the 1.5 s debounce of the caches (`holdLongWaits` exists for it) | 6 h |
| **PV14c-2** configuration store | 4.4 | `damConfigStore.ts`, `damConfigState.ts`, `LIB/lib.ts`; `damKeywordConfig.ts`, `damAuthorConfig.ts`, `keywordActions.ts`, `authorActions.ts`; `damUploadChunkSize.ts`, `uploadService.ts`, `uploadPresets.ts`, `damAssetApi.ts`; `DamDistributionServiceType.ts`, `DamExternalProviderAssetType.ts`, `DamDistributionServiceSelect.vue`, `DamExternalProviderAssetSelect.vue`; `AImageWidget.vue`, `AImageWidgetMultiple.vue`, `AImageMediaWidget.vue`, `AAssetSelect.vue`, `AAssetSelectMedia.vue`, `AAssetListInner.vue`, `AssetDistributionServiceNameFilter.vue`, `AssetImageMetaIcons.vue`, `AssetCustomMetadataForm.vue`, `AssetCustomMetadataFormMassOperations.vue`, `AssetQueueSelectedSidebar.vue`, `UploadQueueItemEditable.vue`, `KeywordRemoteAutocompleteWithCached.vue`, `AuthorCreateButton.vue`, `DamAssetImageRoiSelect.vue`, the three inner widgets, `ImageMassOperations.vue`, `imageDialogDamAuthors.ts`, `uploadQueuesStore.ts` | new `L/__tests__/damNamedConfigurationStore.test.ts`: ext system 4 in both names with different custom forms and keyword switches: the detail and the queue row under `own` show `own`'s; prv config loaded by `own`'s client although `default` loaded it, and `initialized` per name; licence 100 resolves per name; a prefilled `useDamConfigStoreOf('own')` makes the widget ask nothing; chunk bounds of an `own` upload are `own`'s; `useDamConfigStore()` is `useDamConfigStoreOf('default')` with id `commonAdminDamConfigStore` (`LIB/test/publicExportsDamConsumers.test.ts:85-113` +; `publicExportsAdded.test.ts` lists `useDamConfigStoreOf`) | medium-high: about 45 sites; library tests that `vi.mock` the store module need the new export | 7 h |
| **PV14c-3** notifications | 4.5 | `LIB/AnzuSystemsCommonAdmin.ts`, `commonAdminCoreDamOptions.ts`, `damNotifications.ts`, `damNotificationsConnection.ts`, `uploadSettlementTypes.ts`, `uploadSettlement.ts`, `uploadQueuesStore.ts` | with `L/__tests__/support/damSocket.ts`: root socket open, `own` without `notification` polls `dense` (reads at 5 and 10 s) while `default` polls `sparse`; `own: true` polls `sparse`; `own` with its own address: two sockets, an event of each settles its row, `destroyDamNotifications()` closes both; `initDamNotifications()` returns the root handle as before (existing notification tests unchanged); the poller asks `isPushAlive(queueKey)` | medium: socket lifecycle; admin-cms `CMS/test/appInitialize/notificationTeardown.test.ts` relies on the handle (CK only) | 5 h (2.5 h minimal) |
| **PV14c-4** user and root options | 4.6, 4.7, D2 | `LIB/AnzuSystemsCommonAdmin.ts`, `commonAdminCoreDamOptions.ts`, `damFilterUserAllowedUploadConfigs.ts`, three root widgets, three pickers, `ImageMediaWidgetInner.vue` (if D3 = props), `DamAdminAssetLink.vue`, `uploadPresets.ts`, `commonAdminImageOptions.ts` | two users (`dam` allowed, `ugcDam` not): a widget under `own` with `currentUser: 'ugcDam'` is read-only, the `default` one editable; `currentUser: false` allows; picker filters by the name's user; link uses `own`'s `adminDomain`; chunk sizing uses `own`'s `apiTimeout`; `constructor` refused by the image options (`consumerProfileOptions.test.ts` +) | low | 3 h |
| **PV14c-5** names required, documents | 4.1, 4.8 | the internal composables of D1; their tests; D4 documents | `lint:tsc`; tests that called the internals without a name get one | low (test churn) | 2 h |
| **PV14c-D** admin-dam | CK-DAM with the new library; no code change expected (its profile and mocks keep their shapes) | — (optionally the ROI store id, 2.10) | CK-DAM green | low | 1 h |
| admin-ugc (optional) | the four wrappers write into `useDamConfigStoreOf(props.configName)` | `UGC/domains/blog/image/components/ImageWidget.vue:86`, `ImageWidgetMultiple.vue:61`, `AssetList.vue:50` | wrapper given `own` fills `own`'s store; default unchanged | low | 0.5 h |
| admin-cms | nothing | — | — | — | 0 h |

Total: library 23 h (20.5 h with the minimal notifications), admin-dam 1 h, admin-ugc 0.5 h optional. Paced as PV14a
(4.5 h) and PV14b (5.5 h), reviews and CK waiting not included.

## 6. Decisions for the owner

- **D1. Isolation per name.** Every name its own caches, store, socket state and user, also when two names point to
  one core-dam (recommended; costs duplicate loads, and a named client that cannot read `/adm/v1/configuration`
  needs its store prefilled). Alternative: a `sameDamAs` key that shares the store and caches with another name
  (not planned; it brings back "names asked by another client").
- **D2. Notifications of a named configuration.** Unset = none, dense polling (recommended: correct when its user is
  not the page's, a few more reads when it is), or unset = the root socket (today's behaviour, sparse polling without
  events when the user differs). And: full per-name sockets (5 h) or the switch only (2.5 h).
- **D3. The licence-check user.** A `currentUser` key per name (recommended), or `SYSTEM_DAM` for all with
  `skipCurrentUserCheck` added to the three root widgets and `ImageMediaWidgetInner`.
- **D4. Fixed addresses** (2.7). Documented limit plus prefill (recommended; the UGC route set has none of them), or
  new address keys per name (about 3 h more).
- Confirm the new export name `useDamConfigStoreOf` (4.4) and that admin-ugc's optional change is wanted.

## 7. What I did not verify

- Nothing was run; the scenario is read from code. Whether a UGC client may call `/adm/v1/*`, whether the UGC user
  has an SSO cookie the CMS page's socket would carry, and the vendor bundle's UGC routes: not checked.
- DAM ids being UUIDs is inferred from `DocId = string`; integer ids (`IntegerId`, `LIB/shared/types/common.ts:19`)
  are where two instances collide.
- The Pinia id clash consequence (2.10) is inferred from Pinia's one-store-per-id design, not reproduced.
- The admin call sites come from a full sweep by a sub-agent; I re-read the sampled ones named in part 3.
- Sizes follow the pace of PV14a/PV14b and exclude review cycles.
