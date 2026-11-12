# 8 — How admin-cms and admin-ugc consume the library's DAM upload

Read-only analysis. Nothing was run (no install, build, test, dev server, git write). Every behaviour statement is read from source; where it is an inference it says so.

Path prefixes used below:

- `LIB:` = `/home/volar/projects/anzusystems/common-admin` (branch `next`, HEAD `49bd815b`, working tree `src/` clean against HEAD)
- `CMS:` = `/home/volar/projects/petit/admin-cms`
- `UGC:` = `/home/volar/projects/petit/admin-ugc`

admin-cms was being edited by another agent while this was read; its `file:line` references are those of the tree at read time.

---

## 0. The short version

**The two profiles, as the library sees them**

| | admin-cms ("standard") | admin-ugc ("special") |
|---|---|---|
| Component layer | outer widgets (`AImageWidget`, `AImageMediaWidget`, `AImageWidgetMultiple`) | inner widgets (`AImageWidgetInner`, `AImageWidgetMultipleInner`, `AAssetListInner`) inside three app wrappers |
| Who fills `useDamConfigStore` | the library, from `/adm/v1/...` | the app, with hard-coded literals (ext system `4`) |
| Access check against the DAM user | yes (`isImageWidgetUploadConfigAllowed`, `filterAllowedImageWidgetSelectConfigs`) | none (`skip-current-user-check`, no DAM user loaded) |
| DAM endpoints | `/adm/v1/asset`, `/adm/v1/image`, `/adm/v1/roi` | `/ugc/v1/asset`, `/ugc/v1/image`, `/ugc/v1/roi` |
| What settles an upload | WebSocket events, with the poll as backup | the poll only: never sooner than 10 s after the finish request |
| Metadata to CMS image | library default (DAM authors -> source, description) | app callbacks (`customData.author` -> source) |
| Image API | library default on `cmsClient` (`/adm/v1/image`) | six app functions (`imageApi`) |
| Queue dialogs | tabs, single-use switch, file info, authors/keywords by ext-system config | no tabs (`simpleAssetSidebar`), no single-use switch, no file info, no authors/keywords |
| Collab locks on the widget | 3 widgets pass `collab` | never |
| Copy to licence | reachable | unreachable (select licence == upload licence) |

**Corrections to "what is already known"**

1. admin-ugc does not merely have the socket off: it never calls `initDamNotifications()` at all (`UGC:src/App.vue:1-23` imports only `useDropzoneGlobalDragState`). With `enabled: false` the library would not open one anyway (`LIB:src/domains/dam/composables/damNotifications.ts:63`).
2. Neither app runs the version its `package.json` pins (section 1).
3. Queue keys are non-unique in admin-ugc too, not only in admin-cms (section 3).
4. `coreDam.apiTimeout` (30 in both apps) is read by nothing in the library (section 4).
5. Also not exported, and relevant: `useCommonAdminCoreDamOptions`, `useExtSystemIdForCached`, `useUploadQueueDialog`, `useAssetDetailStore` (no match in `LIB:src/lib.ts`). admin-ugc therefore cannot set `cachedExtSystemId` on mount the way `AImageWidgetMultiple` does (`LIB:src/domains/dam/imageWidget/components/AImageWidgetMultiple.vue:73`).

**Largest test gaps (detail in sections 5 and 7)**

- No library test runs an upload with either app's real options. 11 of the 14 upload-queue test files replace `useCommonAdminCoreDamOptions` with a stub, typically `{ endPointImage: '/image', endPointAsset: '/asset' }` (e.g. `LIB:src/domains/dam/uploadQueue/__tests__/uploadStatusFallback.test.ts:39-42`); the other three (`massOperationsValidation`, `uploadQueueMassOperations`, `uploadStopAbortsChunk`) do not read the options. So `/ugc/v1/...` vs `/adm/v1/...` URL composition is unpinned.
- The UGC everyday path (file upload settled by the poll alone, with metadata, no event ever) is not tested for a file item; only for a copy-to-licence item (`uploadStatusFallback.test.ts:196-207`).
- The WebSocket frame -> event bus -> store path is not tested end to end: the store tests inject a fake listener (`LIB:src/domains/dam/uploadQueue/__tests__/uploadQueuesStore.test.ts:15-20`), the notification test never sends a frame (`LIB:src/domains/dam/__tests__/damNotifications.test.ts:40-98`).
- Not covered at all: `customUploadMetadataToImageMap`, `customAssetSelectMetadataToImageMap`, `skipCurrentUserCheck`, `assetListEnabledFilters`, `mainFileSingleUseEnabled: false`, `showSourceEnabled: false`, `AAssetListInner` (no test mounts it).
- Neither app has a unit or component test of the upload. admin-ugc has four e2e flows that upload for real and wait on the poll; admin-cms has three.

---

## 1. Library version each app runs

| | admin-cms | admin-ugc |
|---|---|---|
| `package.json` pin | `1.47.0-beta.dev-1790143991` (`CMS:package.json:38`) | `1.47.0-beta.dev-1790143991` (`UGC:package.json:38`) |
| `yarn.lock` | same (`CMS:yarn.lock:8-10`) | same (`UGC:yarn.lock:8-10`) |
| `node_modules/@anzusystems/common-admin/package.json` | `1.47.0-beta.dev-1790167636` (line 38), files dated 2026-10-06 11:08 | `1.47.0-beta.dev-1790167636` (line 38), files dated 2026-10-06 13:32 |
| Library `next` | `1.47.0-beta.dev-1790167636` (`LIB:package.json:38`) | |

Findings:

- The installed package is not the pinned registry build. Its version string equals the library's current `package.json`, and its files were written on 6 October, so it is a locally built `dist` copied over `node_modules` (not a symlink: `ls -la` shows a plain directory). The two apps' `dist` trees are byte-identical (`diff -rq` between them: 0 differences).
- That build is **older than `next`**. It contains `roiUpdateAcl`/`imageRotateAcl` (added by `0ea35fe2`, 5 Oct 21:46) but not `metadataLoaded`/`settleWithMetadata`/`clearError` in `dist/domains/dam/uploadQueue/store/uploadQueuesStore.js`, and has no `uploadQueueItemRefresh.js`. So it corresponds to `next` at about `0ea35fe2`, without the three upload commits `8c51327f`, `9d6f62ca`, `49bd815b` (7 Oct). `diff -rq` of the library's own `dist` (built 7 Oct 11:53) against the installed one lists 58 files, all under `dist/domains/dam/uploadQueue/**`, `dist/domains/dam/api/{uploadApi,damAssetApi}`, `dist/domains/dam/assetDetail/components/AssetCustomMetadataForm*`, `dist/domains/customDataForm/**` and one validator.

Where the installed build behaves differently from `next` (matters for characterization: "today" in the apps is not "today" on `next`):

| Behaviour on `next` | In the build installed in both apps |
|---|---|
| Finish answer leaves an item alone unless it is still `uploading` (`LIB:src/domains/dam/api/uploadApi.ts:79`) | only a stopped item is left alone; an item its notification already settled goes back to `processing` and is polled once more (`git diff 0ea35fe2 HEAD -- src/domains/dam/api/uploadApi.ts`) |
| Metadata loaded once per item, typed values survive later events (`LIB:src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:43,250-266,427`) | absent |
| A failed row is not editable and is revived with metadata when its file turns out processed (`uploadQueuesStore.ts:206-211,282-286`) | absent |
| Refresh button for an uploaded row without metadata, in the row and in the single dialog (`LIB:src/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue:186-195`, `UploadQueueDialogSingleSidebar.vue:59-84`) | absent |
| Bulk save sends only items whose metadata can be edited, via `hasMetadataToSave` (`LIB:src/domains/dam/api/damAssetApi.ts:198-199`) | same condition, inline |

Characterization tests have to be written against `next`; the apps will only match after they are rebuilt against it.

---

## 2. Plugin install options for DAM

### 2.1 admin-cms — `CMS:src/main.ts:35-82`

`coreDam` (`CMS:src/main.ts:57-70`):

| Option | Value | Where |
|---|---|---|
| `configs.default.damClient` | `damClient`: `baseURL = envConfig.dam.apiUrl`, `timeout = envConfig.dam.apiTimeout * 1000`, `withCredentials`, `X-App-Version`, token-refresh request interceptor | `CMS:src/main.ts:60`, `CMS:src/shared/apiClients/damClient.ts:10-24` |
| `endPointAsset`, `endPointImage`, `endPointRoi` | not set -> `/adm/v1/asset`, `/adm/v1/image`, `/adm/v1/roi` | defaults at `LIB:src/domains/dam/composables/commonAdminCoreDamOptions.ts:46-49` |
| `roiUpdateAcl`, `imageRotateAcl` | not set -> `dam_regionOfInterest_update`, `dam_image_update` | `commonAdminCoreDamOptions.ts:21-33` |
| `mainFileSingleUseEnabled`, `showSourceEnabled`, `showFileInfoEnabled` | not set -> `true` each | `commonAdminCoreDamOptions.ts:51-53` |
| `sourceLabel`, `editAssetLabel`, `addFromDamLabel`, `replaceFromDamLabel` | not set -> library i18n | `commonAdminCoreDamOptions.ts:54-63` |
| `descriptionValidation`, `sourceValidation` | not set -> `{required:false,min:0,max:2000}`, `{required:true,min:0,max:255}` | `commonAdminCoreDamOptions.ts:9-14,64-71` |
| `customUploadMetadataToImageMap`, `customAssetSelectMetadataToImageMap` | not set | |
| `assetListEnabledFilters` | not set -> all filters | `commonAdminCoreDamOptions.ts:75` |
| `simpleAssetSidebar` | not set -> `false` | `commonAdminCoreDamOptions.ts:76` |
| `apiTimeout` | `30` (literal, not `envConfig.dam.apiTimeout`) | `CMS:src/main.ts:63` |
| `uploadStatusFallback` | `true` (literal) | `CMS:src/main.ts:64` |
| `adminDomain` | `envConfig.dam.adminUrl` | `CMS:src/main.ts:65` |
| `notification.enabled` | `envConfig.dam.notification.enabled`, from `config.json` key `dam.notification.enabled` | `CMS:src/main.ts:67`, `CMS:src/shared/EnvConfigService.ts:186` (default `false` at `:69`), template `CMS:public/config.json.dist:72` (`${DAM_NOTIFICATION_ENABLED}`), local `CMS:public/config.json:72` (`true`) |
| `notification.webSocketUrl` | `envConfig.dam.notification.webSocketUrl` | `CMS:src/main.ts:68`, `EnvConfigService.ts:187`, template `config.json.dist:73` (`${DAM_NOTIFICATION_WEBSOCKET_URL}`), local `config.json:73` |

`image` (`CMS:src/main.ts:71-81`): `imageClient: cmsClient`, `previewDomain: envConfig.dam.imageUrl`, `previewDomainOriginal: envConfig.dam.imageUrlOriginal`, `width: 500`, `height: 281`, **no `imageApi`** -> the library's CMS image API on `/adm/v1/image` (`LIB:src/domains/dam/imageWidget/composables/commonAdminImageOptions.ts:29-38`, `imageApiCms.ts:8`).

`collab` (`CMS:src/main.ts:41-56`): `enabled`, `socketUrl` from env, `beforeReconnect`, `io`.

Not plugin options, but part of the profile:

- Socket: `initDamNotifications()` in setup (`CMS:src/App.vue:16`), `openConnection()` on mount (`CMS:src/App.vue:25`). `destroyDamNotifications` is not called anywhere in `CMS:src`.
- DAM user: fetched at start-up from `/adm/users/current` into the library's `useCurrentUser('dam')`; a failure is tolerated with an alert (`CMS:src/domains/system/composables/appInitialize.ts:68-86`).
- Ext system: none configured. Per widget the library resolves licence -> ext system from `/adm/v1/asset-licence/:id` (`LIB:src/domains/dam/config/composables/damConfigState.ts:266-277`).
- Licence: per widget, from the site group's DAM settings (`CMS:src/domains/cms/shared/composables/imageWidgetConfigProvider.ts:6-54`; subjects `default`, `author`, `boxItem`, `game`), or from `envConfig.cms.layout.*` / `envConfig.cms.newsletter.*` (`CMS:src/shared/EnvConfigService.ts:155-158`).

### 2.2 admin-ugc — `UGC:src/main.ts:42-98`

`coreDam` (`UGC:src/main.ts:48-78`):

| Option | Value | Line |
|---|---|---|
| `configs.default.damClient` | `damClient`: `baseURL = envConfig.dam.apiUrl`, `timeout = envConfig.dam.apiTimeout * 1000`, `withCredentials`, `X-App-Version`, refresh interceptor (`UGC:src/domains/blog/blog/api/clients/damClient.ts:7-18`) | `:51` |
| `mainFileSingleUseEnabled` | `false` | `:52` |
| `showSourceEnabled` | `false` | `:53` |
| `showFileInfoEnabled` | `false` | `:54` |
| `sourceValidation` | `{ required: false }` (merged over the default: max stays 255) | `:55-57` |
| `sourceLabel` | `t('blog.image.model.texts.author')` | `:58` |
| `editAssetLabel` | `t('blog.image.button.editAsset')` | `:59` |
| `addFromDamLabel` | `t('blog.image.button.addFromDam')` | `:60` |
| `replaceFromDamLabel` | `t('blog.image.button.replaceFromDam')` | `:61` |
| `endPointAsset` | `/ugc/v1/asset` | `:62` |
| `endPointImage` | `/ugc/v1/image` | `:63` |
| `endPointRoi` | `/ugc/v1/roi` | `:64` |
| `customUploadMetadataToImageMap` | app function (`UGC:src/domains/blog/image/composables/customMetadataToImageMap.ts:4-40`) | `:65` |
| `customAssetSelectMetadataToImageMap` | app function (`customMetadataToImageMap.ts:42-47`) | `:66` |
| `assetListEnabledFilters` | `['text', 'createdAtFrom']` | `:67` |
| `simpleAssetSidebar` | `true` | `:68` |
| `roiUpdateAcl`, `imageRotateAcl` | not set -> `null`, `null` (the endpoints are not the defaults) | `LIB commonAdminCoreDamOptions.ts:21-33` |
| `descriptionValidation` | not set -> default | |
| `apiTimeout` | `30` | `:71` |
| `uploadStatusFallback` | `true` | `:72` |
| `adminDomain` | `envConfig.dam.adminUrl` | `:73` |
| `notification` | `{ enabled: false, webSocketUrl: '' }` (literals; `UGC:public/config.json.dist:22-28` has no notification keys) | `:74-77` |

The four labels are translated once, at install, after `initLoadLanguageMessages()` (`UGC:src/main.ts:37-38`): they are plain strings in the options, not reactive.

`image` (`UGC:src/main.ts:79-97`): `imageClient: blogPrvClient` (unused, per the comment at `:82`), `previewDomain`, `previewDomainOriginal`, `width: 500`, `height: 281`, and `imageApi` with six app functions `fetchImage`, `createImage`, `updateImage`, `deleteImage`, `fetchImageListByIds`, `bulkUpdateImages` (`:87-94`; `UGC:src/domains/blog/image/composables/imageWidgetMappings.ts:64-143`).

No `collab` option. No `initDamNotifications`. No DAM current user is loaded (no `SYSTEM_DAM` user fetch in `UGC:src`; `SYSTEM_DAM` is used only as a label for one request, `UGC:src/domains/dam/api/assetLicence.ts:13`).

Ext system and licence:

- `EXT_SYSTEM_ID = 4`, hard-coded three times: `UGC:src/domains/blog/image/components/ImageWidget.vue:65`, `ImageWidgetMultiple.vue:40`, `AssetList.vue:29`.
- Licence: `settingsStore.damLicence`, the `id` returned by `GET /ugc/v1/asset-licence/blog/:blogId` (`UGC:src/domains/dam/api/assetLicence.ts:7-16`, `UGC:src/domains/blog/blog/composables/blogAssetLicence.ts:15-23`). The response also carries `extSystem` (`assetLicence.ts:10`); the app ignores it.
- Every widget gets `:upload-licence="damLicence"` and `:select-licences="[damLicence]"` (section 3.2).

---

## 3. Usage sites

### 3.1 admin-cms

Paths are relative to `CMS:src/domains/cms/` unless they start with `CMS:`. `U(x, s)` = `getCmsSiteGroupDamUploadLicence(x, 'image', s)`, `S(x, s)` = `getCmsSiteGroupDamSelectLicences(x, 'image', s)`.

**Upload-capable widgets** (33 mounts: 30 `AImageWidget` in 22 files, 2 `AImageMediaWidget`, 1 `AImageWidgetMultiple`):

| # | File:line | Component | Model | `queue-key` | Licences | Other props / slots / events / refs |
|---|---|---|---|---|---|---|
| 1 | `article/components/ArticleEditForm.vue:148` | `AImageMediaWidget` | `v-model:image="article.leadImage"`, `v-model:media="article.media"` | `articleLeadImage` | `U/S(article.siteGroup,'default')` | `label`; `collab=createCollabFieldConfig(COLLAB_FIELD_NAME_LEAD_IMAGE_MEDIA, collabRoom, cachedUsers)`; `collab-status`; `width=300 height=200 dam-width=300 dam-height=200`; slots `#append` (`ArticleMediaTexts`), `#preview` (`DamMediaPlayback`) |
| 2 | `articleTemplate/components/ArticleTemplateManage.vue:102` | `AImageMediaWidget` | `articleTemplate.leadImage`, `.media` | `articleTemplateLeadImage` | default | `label`; 300/200/300/200 |
| 3 | `article/components/widgets/variant/ArticleWidgetSupplementaryMedia.vue:42` | `AImageWidget` | `article.listingImage` | `articleListingImage` | default | `label`; `collab=createCollabFieldConfig('listingImage', …)`; `collab-status` |
| 4 | same file `:59` | `AImageWidget` | `article.socialImage` | `articleSocialImage` | default | `label`; `collab` (`'socialImage'`); `collab-status` |
| 5 | `articleTemplate/components/widgets/variant/ArticleTemplateWidgetSupplementaryMedia.vue:29` | `AImageWidget` | `articleTemplate.listingImage` | `articleTemplateListingImage` | default | `label` |
| 6 | same file `:39` | `AImageWidget` | `articleTemplate.socialImage` | `articleTemplateSocialImage` | default | `label` |
| 7 | `author/components/AuthorManage.vue:193` | `AImageWidget` | `author.image` | `authorImage` | `'author'` | `label` |
| 8 | `contentItemKind/components/forms/ContentItemKindArticleListForm.vue:397` | `AImageWidget` | `contentItem.image` | **`image`** | default | `label`; `width=300` |
| 9 | `distributionManagement/components/BoxItemForm.vue:346` | `AImageWidget` | `editPayload.image` | `boxItemImage` | `'boxItem'` | `label` (internal box item branch, `:256`) |
| 10 | same file `:439` | `AImageWidget` | `editPayload.image` | `boxItemImage` | `'boxItem'` | `label` (external branch, `:359`; mutually exclusive with #9) |
| 11-13 | `game/components/GameForm.vue:267`, `:277`, `:287` | `AImageWidget` | `game.iconImage`, `.horizontalBannerImage`, `.verticalBannerImage` | `gameIconImage`, `gameHorizontalBannerImage`, `gameVerticalBannerImage` | `'game'` | `label`; `width=300` |
| 14 | `layoutTemplate/components/LayoutTemplateManage.vue:159` | `AImageWidget` | `layoutTemplate.image` | `layoutTemplateImage` | `envConfig.cms.layout.damUploadLicence` / `.damSelectLicences` | `label` |
| 15 | `minuteFeed/components/MinuteFeedManage.vue:114` | `AImageWidget` | `minuteFeed.image` | `minuteFeedImage` | default | `label` |
| 16 | `newsletterPromo/components/NewsletterPromoManage.vue:64` | `AImageWidget` | `newsletterPromo.image` | **`image`** | `envConfig.cms.newsletter.*` | `label` |
| 17 | `notification/components/NotificationManage.vue:265` | `AImageWidget` | `notification.image` | **`image`** | default | `label` |
| 18 | `organization/components/OrganizationManage.vue:117` | `AImageWidget` | `organization.image` | **`image`** | default | `label` |
| 19 | `page/components/PageEdit.vue:165` | `AImageWidget` | `page.image` | `pageImage` | default | `label`; `width=300` |
| 20 | same file `:338` | `AImageWidget` | `page.seoImage` | `pageSeoImage` | default | `label`; `width=300` |
| 21 | `person/components/PersonManage.vue:258` | `AImageWidget` | `person.image` | **`image`** | default | `label` |
| 22 | `promoLock/components/PromoLockManage.vue:111` | `AImageWidget` | `promoLock.image` | `promoLockImage` | default | `label`; `required`; `:key="promoLock.siteGroup"` |
| 23 | `quiz/components/QuizManageQuestionAnswers.vue:100` | `AImageWidget` | `raw.image` | `'quizQuestionAnswerImage' + raw.id` | default | `label`; `width=150` |
| 24 | `quiz/components/QuizManageQuestions.vue:191` | `AImageWidget` | `raw.image` | `'quizQuestionImage' + raw.id` | default | `label`; `width=150` |
| 25 | same file `:225` | `AImageWidget` | `raw.explanationImage` | `'quizQuestionExplanationImage' + raw.id` | default | `label`; `width=150` |
| 26 | `relatedItem/components/RelatedItemKindLinkForm.vue:74` | `AImageWidget` | `modelValue.image` | `relatedItemImage` | default | `label`; `width=200` |
| 27 | `rubric/components/RubricManage.vue:335` | `AImageWidget` | `rubric.seoImage` | `rubricSeoImage` | default | `label`; `width=300` |
| 28 | `shared/components/anzutap/nodes/embedImage/components/EmbedImageDialog.vue:116` | `AImageWidget` | `currentEmbed.image` | `articleEmbedImage` | default | **`expand-options`**, **`expand-metadata`**; `ref="widgetComponent"` -> `metadataConfirm()` (`:79`); `@after-metadata-save-success="onConfirm"` |
| 29 | `shared/components/anzutap/nodes/embedRelated/components/EmbedRelatedDialogItemKindLinkForm.vue:74` | `AImageWidget` | `itemComputed.image` | `articleEmbedRelatedImage` | default | `label` |
| 30 | `site/components/SiteManage.vue:545` | `AImageWidget` | `site.seoImage` | `siteSeoImage` | default | `label`; `width=300` |
| 31 | same file `:556` | `AImageWidget` | `site.imageBeforeAuthorImage` | `siteImageBeforeAuthorImage` | default | `label`; `width=300` |
| 32 | `wizard/components/userAuthorWizard/UserAuthorWizardStepAuthorProperties.vue:101` | `AImageWidget` | `author.image` | `cmsUserAuthorWizardAuthorImage` | `'author'` | `label` |
| 33 | `gallery/components/GalleryEdit.vue:107` | `AImageWidgetMultiple` | `gallery.images` | `cmsGallery` | default | `ref="component"` -> `saveImages()` (`:31-37`); `useImageStore().reset()` on unmount (`:49-53`) |

Queue keys:

- `image` is used by five different forms (#8, #16, #17, #18, #21). By static reading they are on different pages; #8 renders in a dialog on the page editor, whose own widgets use `pageImage` and `pageSeoImage`.
- `boxItemImage` twice in one file, in mutually exclusive branches.
- Quiz rows get `nextListEditorTempId()` as their id when new (`quiz/factory/QuizFactory.ts:39,54,67`), so their keys are unique per row.

Props never passed anywhere in admin-cms: `config-name`, `readonly`, `data-cy`, `max-width`, `call-delete-api-on-remove`, `disable-on-click-menu`, `image`/`initial-image`.

**Other DAM exports:**

| File:line | Export | Values |
|---|---|---|
| `gallery/components/GalleryEdit.vue:121` | `AImageMassOperations` | no props |
| `shared/components/anzutap/nodes/embedImageInline/components/EmbedImageInlineDialog.vue:74` | `AImagePublicInput` | `v-model="currentEmbed.image"`, `select-licences=S(siteGroup,'default')`, `ref` -> `submit()` (`…/embedImageInline/composables/EmbedImageInlineDialogActions.ts:48`). No upload; picks an existing file by id or URL |
| `article/components/widgets/variant/ArticleWidgetAudio.vue:237` | `AAssetSelect` | `select-licences=[defaultAssetLicenceId]`, `asset-type=Audio`, `min-count=1 max-count=1`, `return-type="asset"`, `@confirm`, slot `#activator` |
| `shared/components/anzutap/nodes/embedAudio/components/EmbedAudioDialog.vue:86` | `AAssetSelect` | `ref`, `v-model:ready`, `select-licences` (audio), 1/1, `asset-type=Audio`, `in-podcast`, `return-type="asset"`, `@confirm`, slot `#activator` |
| `shared/components/anzutap/nodes/embedVideo/components/EmbedVideoDialog.vue:86` | `AAssetSelect` | as above with video, without `in-podcast` |
| `CMS:src/App.vue:16,25` | `initDamNotifications` | `openConnection()` on mount |
| `CMS:src/App.vue:14,26` | `useDropzoneGlobalDragState` | `initGlobalDragState()` |
| `wizard/components/userAuthorWizard/UserAuthorWizardStepUserCreate.vue:60,145` | `useDamConfigState(damClient)` | `loadDamPrvConfig()` |
| `gallery/components/GalleryCopyDialog.vue:73` | `fetchAssetAndCheckForSingleUseByFileIds` | `(damClient, '/adm/v1/asset', groupedIds)` (endpoint as a literal) |
| `CMS:src/domains/dam/api/assetApi.ts:6-10` | `fetchAsset`, `fetchAssetByFileId` | `(damClient, '/adm/v1/asset', id)`; used by `…/anzutap/extensions/pasteDamAssetExtension.ts:133` and `CMS:src/domains/dam/services/distributionService.ts:22` |
| `article/composables/useArticleAudioNarrationMedia.ts:22`, `…/embedVideo/composables/embedVideoDialogActions.ts:88`, `…/embedAudio/composables/embedAudioDialogActions.ts:85` | `fetchAssetAsCmsMedia` | `(damClient, asset.id)` |
| `article/components/ArticleMediaTexts.vue:20,29` | `isImageCreateUpdateAware`, `isMediaAware` | on the `#append` slot value of #1 |
| `…/embedAudio/components/EmbedAudioDialog.vue:58`, `EmbedAudioNodeView.vue:23`, `…/embedVideo/components/EmbedVideoDialog.vue:58`, `EmbedVideoNodeView.vue:23`, `…/embedGallery/components/EmbedGalleryNodeView.vue:34`, `…/embedExternal/components/EmbedExternalNodeView.vue:32`, `…/anzutap/components/AnzutapRenderer.vue:74`, `CMS:src/domains/dam/components/damMediaPlayback/DamMediaPlaybackInner.vue:47` | `useImageActions(useCommonAdminImageOptions())` | URL builders only |
| `…/embedAudio/components/EmbedAudioDialog.vue:146`, `…/embedVideo/components/EmbedVideoDialog.vue:145`, `article/components/widgets/variant/ArticleWidgetAudio.vue:223` | `ADamAdminAssetLink` | `:asset-id` |
| `siteGroup/components/SiteGroupManage.vue:125,134,143,152,160,169,177,186,194,203,280` | `ADamAssetLicenceRemoteAutocomplete` | `v-model`, `:client="damClient"`, `label`, `clearable`, some `multiple` |
| `wizard/components/userAuthorWizard/UserAuthorWizardStepUserCreate.vue:291,302,312,327,336` | `ADamUserRemoteAutocomplete`, `ADamAssetLicenceGroupRemoteAutocomplete`, `ADamAssetLicenceRemoteAutocomplete`, `ADamExternalProviderAssetSelect`, `ADamDistributionServiceSelect` | `:client="damClient"` |

Read-only widgets (no upload, no queue), 27 mounts of `AImageWidgetSimple`, 1 `AMediaWidgetSimple`, 1 `AImageWidgetMultipleSimple`: `article/components/ArticleDetail.vue:112,132`; `article/components/widgets/variant/ArticleWidgetSupplementaryMedia.vue:37,54`; `distributionManagement/components/BoxItemForm.vue:279`; `…/variants/BoxBufferItem.vue:128,136`; `…/variants/BoxTimelineItem.vue:140,148` (these four with `use-html-img :width="500" :height="281"`); `gallery/components/GalleryDetail.vue:37` (`AImageWidgetMultipleSimple`, `show-source show-description`); `layoutTemplate/components/LayoutTemplateDetail.vue:87`; `minuteFeed/components/MinuteFeedDetail.vue:65`; `newsletterPromo/components/NewsletterPromoDetail.vue:56`; `notification/components/NotificationDetail.vue:120`, `NotificationManage.vue:260`; `organization/components/OrganizationDetail.vue:62`; `page/components/PageDetail.vue:76,170`, `PageEdit.vue:577` (`:dam-width="500" :dam-height="0" disable-aspect-ratio`); `person/components/PersonDetail.vue:118`; `promoLock/components/PromoLockDetail.vue:50`; `relatedItem/components/RelatedItemKindArticleForm.vue:50`; `rubric/components/RubricDetail.vue:68`; `shared/components/anzutap/nodes/embedRelated/components/EmbedRelatedDialogItemKindArticleForm.vue:57`, `EmbedRelatedNodeView.vue:55,65`; `site/components/SiteDetail.vue:184,194`; `wizard/components/userAuthorWizard/UserAuthorWizardStepSummary.vue:171`.

Author/keyword exports (`ADamAuthorFilterRemoteAutocomplete`, `ADamKeywordFilterRemoteAutocomplete`, `useDamAuthorFactory`, `useDamKeywordFactory`, `DamAuthorType`, `useDamCachedUsers`): **no usage in admin-cms**. The app reaches the author and keyword autocompletes only inside the library's queue and detail dialogs.

### 3.2 admin-ugc

**The three wrappers** (the only places a library upload component is mounted):

| Wrapper | Library component | What it passes | Slots / expose |
|---|---|---|---|
| `UGC:src/domains/blog/image/components/ImageWidget.vue:165-187` | `AImageWidgetInner`, behind `v-if="status === 'ready'"` | `v-bind="props"` = `queueKey`, `uploadLicence`, `selectLicences`, `image`, `configName` (`'default'`), `label`, `readonly`, `required`, `dataCy`, `expandOptions`, `expandMetadata`, `disableOnClickMenu`, `width`, `maxWidth`, `height`, `callDeleteApiOnRemove`, `damWidth`, `damHeight` (`:18-56`); `v-model`; **`skip-current-user-check`** (`:170`); `@after-metadata-save-success` re-emitted (`:171`). Never `collab` / `collabStatus` | `#append` passed through (`:173-178`); `#asset-select-sidebar-prepend` filled with a `VImg` of `mainFile.links.image_list.url` (`:179-186`); exposes `metadataConfirm` (`:153-159`) |
| `UGC:src/domains/blog/image/components/ImageWidgetMultiple.vue:141-156` | `AImageWidgetMultipleInner`, behind the same `v-if` | `v-bind="props"` = `queueKey`, `uploadLicence`, `selectLicences`, `configName`, `label`, `readonly`, `dataCy`, `width`, `callDeleteApiOnRemove` (`:12-36`); `v-model`; **`skip-current-user-check`** (`:146`) | `#asset-select-sidebar-prepend` (`:148-155`); exposes `saveImages` (`:126-135`) |
| `UGC:src/domains/blog/image/components/AssetList.vue:140-174` | `AAssetListInner` | `v-model:sort`, `asset-type`, `queue-key`, `select-configs` (built locally, `:115-118`), `config-name`, **`variant="inline"`**, **`skip-current-user-check`** (`:148`) | passes through `#upload-activator`, `#filter`, `#sidebar-prepend` (`:150-173`) |

Before it renders the inner component, each wrapper (in `onMounted`) does what the outer library widget would have done through the DAM API:

| Step | `ImageWidget.vue` | `ImageWidgetMultiple.vue` | `AssetList.vue` |
|---|---|---|---|
| `provide(ImageWidgetUploadConfigKey, uploadConfig)` | `:149` | `:131` | `:55` |
| Upload config value `{ licence, extSystem: 4, licenceName: '', extSystemConfig }` | `:68-84`, set at `:91` | `:43-59`, `:66` | `:32-48`; only when `uploadLicence` is given (`:120-125`) |
| `extSystemConfig.image` = `{ enabled: true, roiWidth: 16, roiHeight: 9, defaultSlotName: 'default', sizeLimit: 20971520, customMetadataPinnedAmount: 2, slots: ['default'], mimeTypes: jpeg, png, webp, gif, avif }`; no `authors`, no `keywords`, no audio/video/document | `:72-83` | `:47-58` | `:36-47` |
| `damPrvConfig.settings.imageChunkConfig = { minSize: 1048576, maxSize: 52428800 }` and `initialized.damPrvConfig = true`, once | `:93-99` | `:68-74` | `:58-64` |
| `damConfigLicenceExtSystem.set(licence, { name: '', extSystem: 4 })` | `:101-104` | `:76-79` | `:66-71` (every select licence) |
| `damConfigAssetCustomFormElements.set(4, { image: [description (string, max 2000, not required), author (string, max 255, not required)], audio: [], video: [], document: [] })` | `:106-144` | `:81-119` | `:73-111` |
| `damConfigExtSystem.set(4, extSystemConfig)` | `:145` | `:120` | `:113` |

The wrappers' `status` can only become `'ready'`; the `'error'` and `'uploadNotAllowed'` template branches (`ImageWidget.vue:188-199`, `ImageWidgetMultiple.vue:157-168`) are never reached.

**Where the wrappers are mounted:**

| File:line | Wrapper | Model | `queue-key` | Licences | Other |
|---|---|---|---|---|---|
| `UGC:src/domains/blog/article/components/ArticleEdit.vue:132` | `ImageWidget` | `article.leadImage` | `article` | `damLicence` / `[damLicence]` | `label`; slot `#append` showing `texts.description` and `texts.source` (`:140-148`) |
| `UGC:src/domains/anzutap/nodes/embedImage/components/EmbedImageDialog.vue:121` | `ImageWidget` | `currentEmbed.image` | `RESOURCE_BLOG.EMBED_IMAGE` = `articleEmbedImage` (`UGC:src/shared/resourceBlog.ts:11`) | same | **`expand-options`**, **`expand-metadata`**; `ref` -> `metadataConfirm()` (`:76`); `@after-metadata-save-success="onSave"` |
| `UGC:src/domains/blog/request/components/RegisterStepsPhoto.vue:60` | `ImageWidget` | `registration.blogImage` | `articleEmbedImage` (same constant) | same | `label` |
| `UGC:src/domains/image/components/ImageChangeDialog.vue:254` | `ImageWidget` | `newImage` | `blog-image-change` | same | `label` |
| `UGC:src/domains/blog/gallery/components/GalleryEdit.vue:83` | `ImageWidgetMultiple` | `gallery.images` | `blogGallery` | same | `ref="component"` -> `saveImages()` (`:16-21`); `AImageMassOperations` at `:100`; `useImageStore().reset()` (`:36-39`) |
| `UGC:src/domains/anzutap/nodes/embedGallery/components/EmbedGalleryEditForm.vue:91` | `ImageWidgetMultiple` | `gallery.images` | `blogGallery` | same | `ref="imageWidgetRef"` -> `saveImages()` (`:17-21`); `AImageMassOperations` at `:108`; `useImageStore().reset()` (`:39-46`) |
| `UGC:src/pages/dam/asset/index.vue:29` | `AssetList` | (sort default) | `damAssetList` | `select-licences="[damLicence]"`, `upload-licence="damLicence"` | `asset-type=Image`; slot `#sidebar-prepend` (`:36-43`); slot `#upload-activator="{ onFileInput, uploadAccept, uploadSizes }"` with two `AFileInput`: a button (`:47-61`) and a full-screen hover dropzone (`use-dropzone hover-only dropzone-variant="fullscreen"`, `:64-72`) |
| `UGC:src/domains/blog/blog/components/BlogManage.vue:142`, `UGC:src/domains/image/components/ImageChangeDialog.vue:155,240,249` | `ImageWidgetSimple` -> `AImageWidgetSimple` (`UGC:src/domains/blog/image/components/ImageWidgetSimple.vue:54-70`) | `:model-value` | none | none | read-only |

All wrappers are behind `v-if="damLicence"`.

Queue keys shared by two mount sites: `articleEmbedImage` (embed dialog and registration step), `blogGallery` (gallery page and gallery embed form).

**Functions and keys:** `useDamConfigStore` (three wrappers), `ImageWidgetUploadConfigKey` (three wrappers), `useImageStore` (`GalleryEdit.vue:36`, `EmbedGalleryEditForm.vue:39`), `useDropzoneGlobalDragState` (`UGC:src/App.vue:13,21`), `assetFileIsImageFile`, `DamAssetType`, `AFileInput`, and the types `UploadQueueKey`, `DamConfigLicenceExtSystemReturnType`, `ImageAware`, `ImageCreateUpdateAware`, `UploadMetadataToImageMapFn`, `AssetSelectMetadataToImageMapFn`.

Not used in admin-ugc: any outer widget, `AImageMediaWidget`, `AAssetSelect` directly, `AImagePublicInput`, `initDamNotifications`, `useDamConfigState`, any `ADam*` component, any author/keyword export.

---

## 4. What each value changes inside the library

Library paths are relative to `LIB:src/domains/dam/`.

### 4.1 Global options

| Value | Branch | Effect |
|---|---|---|
| `uploadStatusFallback` (`true` in both) | `api/uploadApi.ts:84` (after the finish request, for an item still `uploading`); `uploadQueue/store/uploadQueuesStore.ts:111-113` (after a copy to the licence) | arms `armNotificationFallback` (`uploadApi.ts:91-96`): a timer of `10 s * try²` (`:98-100`, `try` starts at 1, `uploadQueue/factory/UploadQueueItemFactory.ts:56`). Each firing fetches the asset (`:113`) and settles by `mainFile.fileAttributes.status`: `processed` -> `queueItemFullyProcessed`, `duplicate` -> `queueItemDuplicate`, `failed` -> `queueItemFailed` (`:118-127`); otherwise re-arms while the item is `processing` (`:129-131`). After 4 fetches (at 10, 50, 140, 300 s) the fifth timer (550 s) sets `error.hasError` and `uploadErrors.processingTooLong` and stops (`:105-109`); **the status stays `processing`**. The `false` branch is exercised by neither app |
| `notification.enabled`, `notification.webSocketUrl` | `composables/damNotifications.ts:21` (`enabled = enabled && url.length > 0`), `:63` (`openConnection` returns without opening), `:45` (frames ignored), `:37` (no "not connected" warning); `:90` (singleton keyed by `enabled|url`) | CMS: one socket, 5 reconnect tries 5 s apart, then a warning toast after 3 s (`:33-42`). Each frame `{ eventName, data: <JSON string> }` is emitted on the event bus as `{ name, data }` (`:44-49`). UGC: nothing, and `initDamNotifications` is never called |
| (event bus) | `uploadQueue/store/uploadQueuesStore.ts:48-67` is the library's only listener (`addDamNotificationListener` has no other caller in `LIB:src`) | handles `asset_file_processed`, `asset_file_failed`, `asset_file_duplicate`, `asset_metadata_processed`, `asset_file_copied`; every other event name is ignored |
| `adminDomain` | `components/DamAdminAssetLink.vue:20-25` | link `adminDomain + '/asset/' + assetId`. CMS mounts the link itself; in the library it is also in `imageWidget/components/ImageDetailDialogMetadata.vue:299` (media, CMS only) |
| `apiTimeout` | returned by `composables/commonAdminCoreDamOptions.ts:86`, destructured by nobody | **no effect.** `uploadQueue/composables/uploadService.ts:100` calls `useDamUploadChunkSize()` without it, so chunk sizing uses the default `30` (`uploadQueue/composables/damUploadChunkSize.ts:7`) |

### 4.2 Per-config options (`configs.default`)

The store and the upload service read the config named `default` regardless of a widget's `config-name`: `uploadQueuesStore.ts:47`, `uploadService.ts:31,89`, `uploadQueue/components/UploadQueueDialog.vue:83`, `assetSelect/components/AAssetSelect.vue:80`, `assetSelect/components/AAssetListInner.vue:75`. Both apps only have `default`.

| Value | CMS | UGC | Branch | Effect |
|---|---|---|---|---|
| `damClient` | cms dam client | ugc dam client | `commonAdminCoreDamOptions.ts:45` | every DAM request |
| `endPointImage` | `/adm/v1/image` | `/ugc/v1/image` | `commonAdminCoreDamOptions.ts:46`; `api/damImageApi.ts:32,34,138,220,245`; `cropper/components/DamAssetImageRoiSelect.vue:67`; `assetDetail/components/AssetDetailSidebarROI.vue:53,61`; `assetDetail/components/AssetFileRotate.vue:34` | upload start `POST {ep}/licence/{licenceId}`, chunk `POST {ep}/{fileId}/chunk`, finish `PATCH {ep}/{fileId}/uploaded`, image file fetch, ROI list, rotate |
| `endPointAsset` | `/adm/v1/asset` | `/ugc/v1/asset` | `commonAdminCoreDamOptions.ts:48`; `api/damAssetApi.ts:59,83,134,191`; `api/damImageApi.ts:275`; `api/damfetchAssetListByFileIdsMultipleLicences.ts:54-57`; `assetSelect/composables/assetSelectListActions.ts:63,83,115` | asset detail (poll, events, refresh, dialogs), by file id (duplicate origin), list and search by licence, `metadata-bulk-update`, `copy-to-licence` |
| `endPointRoi` | `/adm/v1/roi` | `/ugc/v1/roi` | `commonAdminCoreDamOptions.ts:49`; `api/damImageRoiApi.ts:16,28` | ROI fetch and save |
| `roiUpdateAcl` | `dam_regionOfInterest_update` | `null` | `commonAdminCoreDamOptions.ts:21-26`; `uploadQueue/components/UploadQueueDialogSingle.vue:215,398`; `assetDetail/components/AssetDetailDialog.vue:45` | CMS: ROI editor read-only without the grant. UGC: always editable |
| `imageRotateAcl` | `dam_image_update` | `null` | `commonAdminCoreDamOptions.ts:28-33`; `assetDetail/components/AssetDetailSidebarROI.vue:45` | same for rotation |
| `mainFileSingleUseEnabled` | `true` | `false` | `uploadQueue/components/UploadQueueDialogSingleSidebarMetadataContent.vue:158`; `UploadQueueEditable.vue:33,131` -> `UploadQueueItemEditable.vue:419`; `assetDetail/components/AssetMetadata.vue:167` | UGC: no "single use" switch. The value is still sent: single dialog sends `item.mainFileSingleUse ?? false` (`UploadQueueDialogSingle.vue:239,255,265-270`); multi dialog sends the item's value, possibly `null` (`api/damAssetApi.ts:214`) |
| `showSourceEnabled` | `true` | `false` | `imageWidget/components/ImageDetailDialogMetadata.vue:180,270`; `ImageWidgetMultipleItem.vue:143` | UGC: no "show source" switch in the image metadata form. New images still get `flags.showSource: true` |
| `showFileInfoEnabled` | `true` | `false` | `UploadQueueDialogSingleSidebarMetadataContent.vue:175`; `assetDetail/components/AssetMetadata.vue:190`; `assetSelect/composables/assetSelectListActions.ts:120-127` | UGC: no "file" panel, and the DAM users of an asset (`createdBy`/`modifiedBy`) are not fetched |
| `sourceValidation` | `{required:true,min:0,max:255}` | `{required:false,min:0,max:255}` | `commonAdminCoreDamOptions.ts:68-71`; `composables/uploadValidations.ts:50-51`; `imageWidget/components/ImageMassOperations.vue:62-68`; `AImagePublicInput.vue:70-71` | CMS: image source required, unless DAM authors are shown for it (`ImageDetailDialogMetadata.vue:71-73`, `ImageWidgetMultipleItem.vue:47-50`). UGC: never required |
| `descriptionValidation` | default | default | `uploadValidations.ts:50` | same in both |
| `sourceLabel` | "source" (i18n) | "author" (app text) | `ImageWidgetInner.vue:898`; `ImageWidgetMultipleInner.vue:663`; `ImageMassOperations.vue:194`; `AImagePublicInput.vue:247` | label of the source field |
| `editAssetLabel` | i18n | app text | `ImageWidgetInner.vue:899`; `ImageWidgetMultipleInner.vue:664`; `AssetMetadata.vue:92`; `DamAdminAssetLink.vue:38` | button text |
| `addFromDamLabel`, `replaceFromDamLabel` | i18n | app text | `ImageWidgetInner.vue:757-758,814-815`; `ImageWidgetMultipleInner.vue:603`; `ImageMediaWidgetInner.vue:909-910,973-974` | menu and button text. admin-ugc's e2e clicks the app text "Vybrať z knižnice" (`UGC:e2e/pages/article/article.ts:97`), admin-cms's the library text "Pridať z DAM" (`CMS:e2e/pages/shared/upload.ts:51`) |
| `customUploadMetadataToImageMap` | none | app fn | `UploadQueueDialogSingle.vue:275-283`; `UploadQueueDialog.vue:127-129` | on "save and apply". UGC: `source = customData.author`, `description = customData.description`, `authorIds: []`, `dam.internal: false`, no request (`UGC customMetadataToImageMap.ts:11-39`). CMS: `mapUploadMetadataToImages` (`imageWidget/utils/metadataToImageMap.ts:28-98`): fetches author names from `/adm/v1/author/ext-system/{ext}/search` (`author/api/authorApi.ts:9-18`) when the saved assets have authors, `source` = names joined, `dam.internal` from the save response |
| `customAssetSelectMetadataToImageMap` | none | app fn | `ImageWidgetInner.vue:446-449`; `ImageWidgetMultipleInner.vue:249-257,292-315` | on confirming a pick from the library. UGC: no author lookup, `showDamAuthors: false`. CMS: author names fetched (`ImageWidgetInner.vue:454-460`), or, with no authors and `image.authors.enabled` in the ext-system config, the DAM author field is shown in the metadata dialog (`:461-467`) |
| `assetListEnabledFilters` | all | `['text','createdAtFrom']` | `assetSelect/components/AssetSelectFilterForm.vue:40-44` (via `AssetSelectFilter.vue:26,94,111`, `AAssetListInner.vue:302`) | UGC hides `assetAndMainFileIds`, `keywordIds`, `authorIds`, `createdByIds`, `described`, `visible`, `generatedBySystem`, `distributedInServices`, `podcastIds` (`AssetSelectFilterForm.vue:88-152`) |
| `simpleAssetSidebar` | `false` | `true` | `UploadQueueDialogSingle.vue:216,392`; `UploadQueueDialogSingleSidebar.vue:57,94,116-138`; `assetDetail/components/AssetDetailDialog.vue:75`; `AssetDetailDialogSidebar.vue:47` | UGC, once an image upload is done: no tabs, ROI editor in the left pane, metadata and ROI stacked. CMS: Info / ROI tabs |
| `image.imageApi` | none | six fns | `imageWidget/composables/commonAdminImageOptions.ts:29-38` | `ImageWidgetInner.vue:375,564-565,588`; `ImageWidgetMultipleInner.vue:139,461,515`. CMS: `/adm/v1/image` on `cmsClient` (`imageWidget/composables/imageApiCms.ts:8-112`). UGC: blog API, saved three at a time (`UGC imageWidgetMappings.ts:104-132`) |

### 4.3 Props

| Prop (who passes it) | Branch | Effect |
|---|---|---|
| `queueKey` (all) | `uploadQueuesStore.ts:40,150-160` (queues by key); `uploadQueue/composables/useUploadQueueDialog.ts:4` (one module-level `uploadQueueDialog` ref for the whole app); `ImageWidgetInner.vue:938`, `ImageWidgetMultipleInner.vue:707`, `AAssetListInner.vue:426` (`v-if="uploadQueueDialog === queueKey"`); `ImageWidgetInner.vue:932` (`assetDialog === queueKey`) | the queue and its dialog belong to a key, not to a widget instance. No widget clears the queue or the dialog ref on unmount: the only `onBeforeUnmount` in `ImageWidgetInner.vue` (`:250-257`) cancels lock waits; `uploadQueueDialog` is reset only by the dialogs' close and apply paths (`UploadQueueDialog.vue:90`, `UploadQueueDialogSingle.vue:221`, `ImageWidgetMultipleInner.vue:414`, `AAssetListInner.vue:214`). Read from the code, not run: a queue left open when its widget unmounts would be shown by the next widget mounted with the same key |
| `uploadLicence` | CMS: `AImageWidget.vue:92` (licence -> ext system config); `:97` (access); both: `ImageWidgetInner.vue:912` -> `AAssetSelect.vue:137-142,157-164` | the upload request uses the injected config's licence, not the prop (`ImageWidgetInner.vue:314,348`). The prop only drives copy-to-licence: offered when the selected licence differs from it. UGC: select == upload, never offered |
| `selectLicences` | CMS: `AImageWidget.vue:111`; both: `AAssetSelect.vue:228` | licences offered in the picker. UGC: answered from the store the wrapper seeded, so no request |
| `skipCurrentUserCheck` (UGC only) | `AAssetSelect.vue:101-107`; `AAssetListInner.vue:114-120`; forwarded by `ImageWidgetInner.vue:916`, `ImageWidgetMultipleInner.vue:613`. `AImageMediaWidget`'s picker has the prop (`AAssetSelectMedia.vue:39,99`) but the widget never passes it | skips `filterAllowedImageWidgetSelectConfigs`. Without it and without a DAM user the picker shows `assetSelect.error.unallowedLicence` and does not open |
| `expandOptions` (#28, UGC embed dialog) | `ImageWidgetInner.vue:741-781`; `:625-629` | buttons instead of the "..." menu; a click on the dropzone opens the file dialog directly |
| `expandMetadata` (same two) | `ImageWidgetInner.vue:367-369,385-387,495-497,615-617`; `:900` | the metadata form is inline; the host confirms through the exposed `metadataConfirm()` and listens for `afterMetadataSaveSuccess` (`:572`) |
| `collab`, `collabStatus` (CMS #1, #3, #4) | `ImageWidgetInner.vue:119-152,259-262,294-325`; same in `ImageMediaWidgetInner.vue` | a drop waits (up to 50 x 100 ms) for the field lock before `addByFiles`. Without `collab`, or with collab off in the plugin, `waitForFieldLockIsReallyAcquired` resolves at once |
| `required` (CMS #22) | `ImageWidgetInner.vue:727-730,777-780` | mark only |
| `width`, `height`, `damWidth`, `damHeight`, `label` | `ImageWidgetInner.vue:362-366,716-719,856-858` | display and preview URL |
| `variant="inline"` (UGC `AssetList`) | `AAssetListInner.vue:275` | CSS class only |
| `callDeleteApiOnRemove` | `ImageWidgetInner.vue:585-596`; `ImageWidgetMultipleInner.vue:513-521` | never set to `true` by either app |

### 4.4 What the provided upload config and the seeded store change

| Input | Branch | Effect |
|---|---|---|
| `provide(ImageWidgetUploadConfigKey, …)` | `ImageWidgetInner.vue:183-190`, `ImageWidgetMultipleInner.vue:89-96`, `ImageWidgetMultipleLimitDialog.vue:29-36` throw without it; `AAssetListInner.vue:189-190` reads it as optional | CMS: provided by the outer widget after it loaded the config (`AImageWidget.vue:88-124`). UGC: by the wrapper. In `AAssetListInner` the upload slot and the queue dialog exist only when it is provided (`:252-258,425-435`) |
| `extSystemConfig.image.mimeTypes`, `.sizeLimit` | `config/composables/acceptTypeAndSizeHelper.ts:9-35`; `uploadQueue/utils/mimeTypeHelper.ts:4-15`; `uploadQueuesStore.ts:125-126` | accept list and size limits of the file inputs and dropzones; a file whose type the config does not list as image is silently not queued |
| `extSystemConfig.image.authors`, `.keywords` | `author/composables/damAuthorConfig.ts:15-21`; `keyword/composables/damKeywordConfig.ts:16-22`; `ImageWidgetMultipleInner.vue:426-428,448-454`; `imageWidget/components/ImageMassOperations.vue:58-60` | UGC (absent): no author or keyword field anywhere, and the gallery save never updates DAM authors. CMS: whatever `/adm/v1/configuration/ext-system/:id` returns |
| `damConfigExtSystem.get(ext)` | `uploadQueuesStore.ts:91-94,120-123`; `damAuthorConfig.ts:11-13`; `damKeywordConfig.ts:12-14`; `assetDetail/components/AssetCustomMetadataForm.vue:43-46` | throws "Ext system must be initialised" if missing: the UGC seeding is load-bearing |
| `damConfigAssetCustomFormElements.get(ext)` | `AssetCustomMetadataForm.vue:33-35` (throws); `AAssetSelect.vue:205-223`, `AAssetListInner.vue:219-237` (load only when missing) | UGC: two fixed fields, no `/adm/v1/asset-custom-form/...` request |
| `damConfigLicenceExtSystem.get(licence)` | `config/composables/damConfigState.ts:266-282,306-308` | UGC: no `/adm/v1/asset-licence/:id` request |
| `damPrvConfig.settings.imageChunkConfig` | `uploadQueue/composables/damUploadChunkSize.ts:9,37-46` | first chunk = `minSize`, adapted to the measured speed within `[minSize, maxSize]`. UGC: 1 MiB / 50 MiB from the wrapper. CMS: from `/adm/v1/configuration` (`damConfigState.ts:62-93`) |
| DAM user in the auth store | `config/utils/damFilterUserAllowedUploadConfigs.ts:8-31,33-57`; `AImageWidget.vue:97-106`, `AImageWidgetMultiple.vue:74-83`, `AImageMediaWidget.vue:102-111` | CMS only: an upload config the user may not use renders the widget read-only (`AImageWidget.vue:144`). UGC never reaches this code |

---

## 5. Behaviour differences, admin-ugc against admin-cms

"Covered" = an existing library test executes that branch with that value. Test paths are relative to `LIB:src/domains/dam/` unless given in full.

| # | What differs | CMS | UGC | Where the library branches | Existing library test |
|---|---|---|---|---|---|
| 1 | Config bootstrap | outer widget loads licence, ext system, prv config and custom form from `/adm/v1/...` | wrapper seeds the store, mounts the inner widget | `imageWidget/components/AImageWidget.vue:90-122` against `ImageWidgetInner.vue:183-190` | outer: `config/__tests__/damWidgetUploadAccess.test.ts:69-106`, `imageWidget/__tests__/damWidgetConfigLoadFailure.test.ts:68-69`, both with `useDamConfigState` mocked. Inner with an injected config: `imageWidget/__tests__/ImageWidgetInnerExpandMetadata.test.ts:39-45`, `ImageWidgetMultipleInner.test.ts:45-48`. **A host-seeded store with no `/adm/v1` request: not covered** |
| 2 | Access check | by DAM user | skipped | `assetSelect/components/AAssetSelect.vue:101`; `AAssetListInner.vue:114`; `config/utils/damFilterUserAllowedUploadConfigs.ts:33` | check: `damWidgetUploadAccess.test.ts:40-66`. **`skipCurrentUserCheck: true`: not covered** |
| 3 | DAM endpoints | `/adm/v1/*` | `/ugc/v1/*` | `composables/commonAdminCoreDamOptions.ts:46-49` | default value: `LIB:src/plugins/__tests__/pluginOptions.test.ts:72`. Custom values reach only ACL resolution: `cropper/__tests__/roiUpdateAcl.test.ts:19,36`. **URLs of start, chunk, finish, poll, bulk update with a configured endpoint: not covered** (the option composable is mocked in every upload test; chunk timeout only at `__tests__/damImageApiChunkTimeout.test.ts:23-39`) |
| 4 | ROI / rotate grant | required | none | `commonAdminCoreDamOptions.ts:21-33` | resolution: `roiUpdateAcl.test.ts:25-29,41-43`. **Use by `UploadQueueDialogSingle.vue:215` and `AssetDetailDialog.vue:45`: not covered** |
| 5 | What settles an upload | events: `asset_file_processed` sets the status (`uploadQueuesStore.ts:270-311`), `asset_metadata_processed` loads the metadata and enables the form (`:417-450`), in either order. The poll is armed as well and cancelled by the file event (`:287`) | only the poll: status, file, metadata and form in one step through `queueItemFullyProcessed` -> `settleWithMetadata` (`:313-330,230-268`) | `api/uploadApi.ts:84`; `composables/damNotifications.ts:63` | events, with an injected listener: `uploadQueue/__tests__/uploadQueuesStore.test.ts:135-409`. Poll settling a **copy** item: `uploadQueue/__tests__/uploadStatusFallback.test.ts:196-207`. **Poll settling a file upload end to end: not covered. Frame parsing and bus: not covered. `enabled: false` opening nothing: not covered** (`__tests__/damNotifications.test.ts:9` has the parameter, no test passes `false`) |
| 6 | Time to "done" | as soon as the events arrive | quantised: 10, 50, 140 or 300 s after the finish answer; gives up at 550 s | `uploadApi.ts:98-109` | schedule: `uploadStatusFallback.test.ts:91-111`. **That the row stays `processing` and the queue never counts as finished after the give-up: not asserted** |
| 7 | Duplicate found | event `asset_file_duplicate` | poll sees `fileAttributes.status === 'duplicate'` | `uploadQueuesStore.ts:57-59` against `uploadApi.ts:122-123`; both `queueItemDuplicate` (`:332-394`) | event: `uploadStatusFallback.test.ts:258-279,298-312`. Refresh button: `uploadQueue/__tests__/uploadQueueItemRefresh.test.ts:112-126`. **Through the poll: not covered** |
| 8 | Server-side failure | event `asset_file_failed` with `failReason` | poll sees `failed` | `uploadQueuesStore.ts:54-56` against `uploadApi.ts:124-126` | **neither path is covered**: no test sends `asset_file_failed`, none lets the poll find `failed`. `queueItemFailed` runs only through the refresh button (`uploadQueue/__tests__/uploadQueueItemRefresh.test.ts:115`) |
| 9 | Finish request fails although the server finished | a later `asset_file_processed` revives the row with its metadata (`uploadQueuesStore.ts:282-286`) | the row stays failed: the poll is armed only in the finish `.then` (`uploadApi.ts:75-88`) and a failed row has no refresh button (`UploadQueueItemEditable.vue:176-199`) | same | revival: `uploadQueuesStore.test.ts:229-275`. **The UGC outcome: not covered** |
| 10 | Socket lifecycle | singleton, 5 reconnects, warning | none | `damNotifications.ts:28-43,88-106` | singleton: `__tests__/damNotifications.test.ts:40-98`. **Reconnect failure warning: not covered** |
| 11 | Upload metadata -> image | default mapper, author names from DAM | app mapper | `UploadQueueDialogSingle.vue:275-283`; `UploadQueueDialog.vue:127-129` | default branch runs in `uploadQueue/__tests__/uploadQueueDialogSave.test.ts:81-87` (asserts asset ids only). **Custom mapper: not covered. Mapped texts and `showDamAuthors`: not asserted** |
| 12 | Picked asset -> image | default, author lookup, DAM-author field | app mapper | `ImageWidgetInner.vue:446`; `ImageWidgetMultipleInner.vue:249,292` | **not covered** (no test matches `customAssetSelectMetadataToImageMap`) |
| 13 | Single dialog layout | tabs | no tabs | `UploadQueueDialogSingleSidebar.vue:57`; `UploadQueueDialogSingle.vue:216` | both, for the refresh button: `uploadQueue/__tests__/uploadQueueDialogSingle.test.ts:182-205` |
| 14 | Single-use switch | shown | hidden, value still sent | `UploadQueueDialogSingleSidebarMetadataContent.vue:158`; `UploadQueueItemEditable.vue:419` | `true`: `uploadQueueDialogSingle.test.ts:50,235-253,303-322`. **`false`: not covered** |
| 15 | File info panel, DAM users | shown, fetched | hidden, not fetched | `UploadQueueDialogSingleSidebarMetadataContent.vue:175`; `assetSelect/composables/assetSelectListActions.ts:120-127` | list actions run with `false` (`assetSelect/__tests__/assetSelectListActions.test.ts:35`): the UGC value. **`true` there, and the panel either way: not covered** |
| 16 | "Show source" switch | shown | hidden | `ImageDetailDialogMetadata.vue:180,270`; `ImageWidgetMultipleItem.vue:143` | `true` only, by mock (`ImageWidgetMultipleInner.test.ts:27`). **`false`: not covered** |
| 17 | Source required | yes | no | `composables/uploadValidations.ts:50-51` | mass-operations form with `required: false` (`imageWidget/__tests__/ImageMassOperations.test.ts:27-28`). **`useImageValidation`: not covered** |
| 18 | Labels | library | app | `commonAdminCoreDamOptions.ts:54-63` | **not covered** |
| 19 | Authors / keywords in rows and dialogs | by ext-system config | never | `author/composables/damAuthorConfig.ts:15-17`; `keyword/composables/damKeywordConfig.ts:16-18` | enabled: `uploadQueueDialogSingle.test.ts:63-69,255-268`. **Absent keys (UGC): not covered** |
| 20 | Asset list filters | all | two | `assetSelect/components/AssetSelectFilterForm.vue:40-44` | **not covered** |
| 21 | Image API | library CMS API | app functions | `imageWidget/composables/commonAdminImageOptions.ts:29-38` | custom `imageApi`, by mock: `ImageWidgetMultipleInner.test.ts:17-23`, `imageWidget/__tests__/ImageWidgetCollab.test.ts:56`. Default fallback: not covered in the widget tests |
| 22 | Collab lock before upload | 3 widgets | never | `ImageWidgetInner.vue:259-262` | with collab: `ImageWidgetCollab.test.ts:171-730`, `ImageMediaWidgetCollab.test.ts:173-763`. Without: implicitly by the other widget tests |
| 23 | Copy to licence | reachable | unreachable | `AAssetSelect.vue:157-164`; `ImageWidgetInner.vue:327-342`; `ImageWidgetMultipleInner.vue:215-235` | `imageWidget/__tests__/ImageWidgetMultipleCopyToLicence.test.ts:88-109`, `ImageWidgetCollab.test.ts:221-243`, `uploadStatusFallback.test.ts:195-255`. CMS only |
| 24 | Asset list page with upload | not used | `AAssetListInner` + multi dialog; apply stops the queue and reloads the list (`AAssetListInner.vue:213-217`) | `AAssetListInner.vue:189-217,252-272,425-435` | **not covered** (no test mounts `AAssetListInner`) |
| 25 | Media (audio/video) in the image widget | `AImageMediaWidget` (#1, #2) | not used | `ImageMediaWidgetInner.vue` | `imageWidget/__tests__/ImageMediaWidgetInner.test.ts:36-69`, `ImageMediaWidgetCollab.test.ts`, `damWidgetUploadAccess.test.ts:96-106` |
| 26 | Chunk size bounds | DAM config | 1 MiB / 50 MiB literal | `uploadQueue/composables/damUploadChunkSize.ts:9,37-46` | **not covered** (mocked at `uploadQueuesStore.test.ts:72-74`) |
| 27 | `cachedExtSystemId` for a gallery | set on mount (`AImageWidgetMultiple.vue:73`) | set only on the first upload, drop, copy or asset click (`ImageWidgetMultipleInner.vue:201,210,220`; `assetSelectListActions.ts:117`); until then `0` | `ImageWidgetMultipleInner.vue:426-428` | **not covered** |
| 28 | Multi dialog marks new images `showDamAuthors: true` when the mapper returns no author ids (`UploadQueueDialog.vue:136-137`) | then shows the DAM author field if the ext system enables authors | always marked, inert (`authorEnabled` false) | `ImageWidgetMultipleItem.vue:47-50`; `ImageWidgetMultipleInner.vue:448-454` | **not covered** |

Same in both, so not differences but worth a test because the refactor touches them: two uploads at a time (`uploadQueuesStore.ts:33,177-189`; covered `uploadQueuesStore.test.ts:429-450`); each file started once (`uploadQueueStartsEachFileOnce.test.ts:59-75`); stop and remove (`uploadStopAbortsChunk.test.ts`, `uploadStopBetweenChunks.test.ts`, `uploadStopWhileHashLoads.test.ts`, `uploadStatusFallback.test.ts:116-133`); chunk retries, 4 attempts (`uploadService.ts:21,163-198`; **not covered**); chunk request timeout 420 s (`damImageApi.ts:13,175`; covered `damImageApiChunkTimeout.test.ts:32-39`).

---

## 6. Tests inside the two apps that touch this

Neither app has a unit or component test that mounts a library image widget or drives an upload.

### 6.1 admin-cms — unit (`CMS:src/test/**`, 80 files)

| File | What it asserts | Relevance |
|---|---|---|
| `CMS:src/test/articleCollabFieldKeys.test.ts:40-48,80-82` | collab data for `leadImageMedia` sets `article.leadImage` and `article.media`; the key is a collab control field | the collab value shape of `AImageMediaWidget` (#1) |
| `CMS:src/test/appInitialize/notificationTeardown.test.ts` | start-up guard; `damClient` and the DAM user fetch are mocked (`:56,41-46`) | only that a failed DAM user load is tolerated |
| `CMS:src/test/userSystemDescriptors.test.ts:14-71` | DAM as one of three user systems | not upload |
| `CMS:src/test/whiteboard/anzutapRendererContent.test.ts:10`, `CMS:src/test/i18n/languageSwitch*.test.ts` | install the plugin with `coreDam: { configs: { default: { damClient } } }` | plugin install shape only |

### 6.2 admin-cms — e2e (Playwright, `CMS:e2e`)

Real uploads (three flows):

| Helper | Used by | Asserts |
|---|---|---|
| `CMS:e2e/pages/notifications/notificationPage.ts:140-150` | `CMS:e2e/tests/notifications/notification.spec.ts:69` | menu "Nahrať", `setInputFiles`, **fixed 5 s wait**, click "Uložiť a použiť", fill the author. No assertion on upload state |
| `CMS:e2e/pages/contentLibrary/pollQuizPage.ts:561-572` | `CMS:e2e/tests/contentLibrary/quizzes/quiz.spec.ts:38` | "Nahrať obrázok", `setInputFiles`, expects the overlay text **"Nahrávanie ukončené" within 30 s**, "Uložiť a použiť", fills source, "Potvrdiť" |
| `CMS:e2e/pages/system/layoutTemplatePage.ts:309-320` | `CMS:e2e/tests/system/layoutTemplates/layoutTemplate.spec.ts:201` | upload, "Uložiť a použiť" visible within 60 s, metadata dialog with a required source, returns the asset id from the preview URL |

Asset picking without upload: `selectAssetFromDam` (`CMS:e2e/pages/shared/upload.ts:42-75`: "..." menu, "Pridať z DAM", first tile, "Potvrdiť", then up to three follow-up dialogs). Used by `articlePage.ts:557`, `authors/authorPage.ts:135`, `person/personPage.ts:92`, `system/rubricPage.ts:44`, `system/promoLockPage.ts:42`, `newsletters/newsletterPage.ts:156`, `notifications/notificationPage.ts:63`, `contentLibrary/pollQuizPage.ts:559,664`, `tests/articles/articleLifecycle.spec.ts:64`, `tests/page/pageEditAdvancedSettings.spec.ts:166`. More pickers in `tests/articles/editor/editorMedia.spec.ts:134,194,231,286`, `tests/articles/articleNonExistingEmbeds.spec.ts:61-63`, `pages/article/articleDistributionPage.ts:244-254`, `pages/contentLibrary/usedImagesPage.ts:32-105`.

Timing: the 5 s and 30 s waits fit an upload settled by events. With the poll alone the form enables no sooner than 10 s after the finish answer. Whether the 5 s flow would still pass on Playwright's auto-wait for an enabled button was not run.

### 6.3 admin-ugc — unit (`UGC:src/test/**`, 15 files)

| File | What it asserts | Relevance |
|---|---|---|
| `UGC:src/test/activeBlog.test.ts:67-100` | switching the blog loads its licence; the previous `damLicence` is dropped before the new one loads | the `v-if="damLicence"` gate of every wrapper |

### 6.4 admin-ugc — e2e (Playwright, `UGC:e2e`)

| Spec | Flow | Asserts |
|---|---|---|
| `UGC:e2e/tests/registration/01_full_registration.spec.ts:76-79` -> `UGC:e2e/pages/registration/step3.ts:4-28` | `ImageWidget`, key `articleEmbedImage`: dropzone click, "Nahrať obrázok", file dialog, `setInputFiles`, `waitForUploadDone`, "Uložiť a použiť", "Potvrdiť" | single dialog reaches "Nahrávanie ukončené"; save-and-apply opens the metadata dialog |
| same spec `:152` -> `UGC:e2e/pages/registration/step4.ts:16-41` | article lead image, key `article`, same steps | same |
| `UGC:e2e/tests/article/02_editor.spec.ts:407-434` | embed image dialog (`expand-options`, `expand-metadata`): button "Nahrať obrázok", file dialog, upload, "Uložiť a použiť", "Potvrdiť" twice | an image embed appears in the editor |
| `UGC:e2e/tests/gallery/01_galleryCreate.spec.ts:41-68` | `ImageWidgetMultiple`: `setInputFiles` of 3 photos on the multi input, full-screen dialog, `waitForUploadDone`, "Uložiť a použiť", dialog closes, page save | 3 images in `.asset-list-tiles` after the save |
| `UGC:e2e/tests/gallery/02_galleryRemoveAllImages.spec.ts:30-75` | same upload, reload, remove all, save, reload | 3 after reload, 0 after removal and reload |
| `UGC:e2e/pages/article/article.ts:89-123` (several article specs) | "..." menu, "Vybrať z knižnice", first tile, "Potvrdiť", metadata dialog "Potvrdiť" | the picker opens with tiles (so without a DAM user), the metadata dialog follows |

`waitForUploadDone` (`UGC:e2e/pages/shared/upload.ts:16-38`) looks every 10 s, for up to 8 minutes, for "Nahrávanie ukončené", and fails early on the text "Processing is taking too long". That waiting scheme is built on the poll. Two observations:

- The early-failure text is the English one (`LIB:src/locales/en/common/damImage.json:212`), while the success text is the Slovak one (`LIB:src/locales/sk/common/damImage.json:157`). The Slovak give-up text (`…/sk/common/damImage.json:212`) never matches, so on a Slovak UI a give-up ends as an 8-minute timeout.
- 8 minutes (480 s) is shorter than the library's give-up at 550 s.

No e2e in either app covers: stop or close during upload, a duplicate, a failed file, the refresh button, the ROI editor in the upload dialog, the asset list page upload (`UGC:src/pages/dam/asset/index.vue`), copy to licence.

---

## 7. Proposed characterization tests

### 7.1 Shape

The refactor rewrites the poll, the notification handling, the store and the queue dialog and row components. A test that mocks those modules is rewritten or deleted together with them. So the tests below hold on to what stays:

- the public entry points both apps use: `AImageWidget`, `AImageWidgetInner`, `AImageWidgetMultiple`, `AImageWidgetMultipleInner`, `AAssetListInner`, `AAssetSelect`, `AImageMediaWidget`, `initDamNotifications`, `useDamConfigStore`, `ImageWidgetUploadConfigKey`, and the plugin options;
- the boundaries: requests on the `damClient` passed in the options, frames on the WebSocket, timers, the rendered text, emitted events.

One support module, for example `LIB:src/domains/dam/__tests__/support/consumerProfiles.ts`, exporting two profiles used with `describe.each`:

| | "CMS configuration" | "UGC configuration" |
|---|---|---|
| Options through the real `initCommonAdminCoreDamOptions` / `initCommonAdminImageOptions` | the literals of `CMS:src/main.ts:57-81`, notification on with a test URL | the literals of `UGC:src/main.ts:48-97`, with stand-ins for the two mapper functions and the six `imageApi` functions |
| `damClient` | a recording fake: `() => ({ request, get, post, patch, put })`, answers scripted per URL (`useApiRequest` calls `client().request(config)`, `LIB:src/domains/api/composables/useApiRequest.ts:122-129`; the upload calls use `post` and `patch`, `LIB:src/domains/dam/api/damImageApi.ts:36-37,170-171,221-222`) | same |
| Config store | answered through the fake client: `/adm/v1/asset-licence/:id`, `/adm/v1/configuration/ext-system/:id`, `/adm/v1/configuration`, `/adm/v1/asset-custom-form/...` | seeded as `UGC:src/domains/blog/image/components/ImageWidget.vue:91-145` does |
| DAM user | in the auth store, as `damWidgetUploadAccess.test.ts:33-36` | none |
| Mounted as | outer widget | inner widget in a host that provides the upload config and passes `skip-current-user-check` |
| Socket | `initDamNotifications().openConnection()` on a stubbed `WebSocket` | never initialised |

Mocks common to all: `rusha` (as `uploadQueuesStore.test.ts:13`), the global `WebSocket` (as `damNotifications.test.ts:18-31`, extended so the test can call the `onmessage` VueUse assigns), and the long-timer shim of `uploadStatusFallback.test.ts:70-83` (fake timers stall the browser runner per the comment at `:68-69`).

Because most existing files replace `useCommonAdminCoreDamOptions` at file level, a profile test cannot live in the same file. "Extends" below names the closest existing file; "sibling" means a new file beside it.

### 7.2 The tests, most likely to break first

Risk A: code the refactor rewrites, with no test today at this level.

| # | Name | Asserts (today's behaviour on `next`) | Mock | Extends |
|---|---|---|---|---|
| A1 | a picked file is uploaded through the profile's endpoints | both: in order `POST {image}/licence/{uploadLicence}` with `{ mimeType, size }`; `POST {image}/{fileId}/chunk` as multipart with `file` and `chunk = {"offset":0,"size":n}`, request timeout 420000; `PATCH {image}/{fileId}/uploaded` with `{ checksum }`. `{image}` = `/adm/v1/image` (CMS), `/ugc/v1/image` (UGC). No request to the other prefix | fake client, rusha | `uploadQueue/__tests__/uploadStopWhileHashLoads.test.ts:67` (sibling) |
| A2 | UGC: an upload nobody announces is settled by the poll, metadata included | UGC: after the finish answer no asset request before the 10 000 ms timer; then `GET /ugc/v1/asset/{assetId}` returning `fileAttributes.status: 'processed'`; then the dialog title is `damImage.upload.titleDone`, the form is enabled with `customData` from the asset, save-and-apply enabled. `WebSocket` never constructed. CMS: the same poll settles it when no frame comes | fake client, timer shim, WebSocket stub | `uploadStatusFallback.test.ts:196-207` (sibling) |
| A3 | CMS: two frames settle an upload, in either order | CMS: frame `{"eventName":"asset_metadata_processed","data":"{\"asset\":\"A\"}"}` -> one `GET /adm/v1/asset/A`, form enabled while the image still shows processing. Frame `asset_file_processed` -> one more GET, title done, the armed 10 s timer never fires a request. Same with the order reversed. UGC half: `openConnection()` with UGC options constructs no `WebSocket` | WebSocket stub with `onmessage`, fake client, timer shim | `__tests__/damNotifications.test.ts` (same file is possible: it uses the real options) |
| A4 | the poll runs at 10, 40, 90, 160 s and gives up with the next timer | both: timers `[10000, 40000, 90000, 160000, 250000]`, 4 asset fetches, then the row shows `uploadErrors.processingTooLong`; **the row is still `processing`, the title stays `upload.title`, the multi dialog's save-and-apply is not rendered** (`UploadQueueDialog.vue:221`, `isFinished`) | fake client, timer shim | `uploadStatusFallback.test.ts:91-111` (add the status and dialog assertions) |
| A5 | UGC: the poll finds a duplicate | UGC: asset with `status: 'duplicate'` and `originAssetFile: F` -> `GET /ugc/v1/asset/asset-file/F`; row uploaded, duplicate notice shown, `fileId = F`, asset id replaced by the original's, metadata of the original, form enabled. CMS: the same result from the frame `asset_file_duplicate` with `{ asset, originAssetFile, assetType: 'image' }` | fake client, timer shim, WebSocket stub | `uploadStatusFallback.test.ts:258-279` |
| A6 | UGC: the poll finds a failed file | UGC: `status: 'failed'`, `failReason` -> row failed, reason chip shown, form disabled, queue counts as finished. CMS: the same from `asset_file_failed` | same | `uploadQueue/__tests__/uploadQueueItemRefresh.test.ts:112-126` |
| A7 | a finish request that fails | both: row failed, form disabled, no poll armed (no asset request after the timers). CMS: a later `asset_file_processed` makes it uploaded with its metadata. UGC: it stays failed and shows no refresh button | fake client rejecting the PATCH, WebSocket stub, timer shim | `uploadQueuesStore.test.ts:229-275` (sibling) |
| A8 | CMS: frames the queue does not act on | `asset_file_uploaded`, `asset_file_deleted`, `asset_deleted`, `distribution_*`, `user_updated`, and a frame for an asset in no queue: no state change. Record how many requests each makes (the five handled events fetch the asset before looking for the item, `uploadQueuesStore.ts:272,398,420,454`) | WebSocket stub, fake client | `damNotifications.test.ts` |
| A9 | both apps' install options still type-check and resolve | a typed literal of each app's `coreDam` and `image` assigned to `PluginOptions`, checked by vue-tsc; at run time `useCommonAdminCoreDamOptions()` equals: CMS `{ endPointAsset:'/adm/v1/asset', endPointImage:'/adm/v1/image', endPointRoi:'/adm/v1/roi', roiUpdateAcl:'dam_regionOfInterest_update', imageRotateAcl:'dam_image_update', mainFileSingleUseEnabled:true, showSourceEnabled:true, showFileInfoEnabled:true, sourceValidation:{required:true,min:0,max:255}, simpleAssetSidebarEnabled:false, assetListEnabledFilters:undefined, … }`, UGC the section 2.2 values; `useCommonAdminCoreDamOptionsGlobal()` gives `uploadStatusFallback: true` and the notification pair. The cheapest guard against a renamed or dropped option, and `uploadStatusFallback` / `notification` are exactly what the refactor reworks | none | `LIB:src/plugins/__tests__/pluginOptions.test.ts:35-41,63-75`; `cropper/__tests__/roiUpdateAcl.test.ts` |

Risk B: queue dialog and row components (rewritten).

| # | Name | Asserts | Mock | Extends |
|---|---|---|---|---|
| B1 | single dialog: "save and apply" sends the metadata and hands the widget an image | both: `PATCH {asset}/metadata-bulk-update` with `[{ id, keywords, authors, described: true, customData, mainFileSingleUse, mainFileInternal: false, mainFileOverrideInternal: false }]`. UGC: mapper called with `(items, response, damClient, 4, licence)`, no `/adm/v1/author` request, metadata dialog opens with `description = customData.description`, `source = customData.author`, `showSource: true`, `dam.damId = fileId`, `dam.licenceId = licence`. CMS: with authors in the response `GET /adm/v1/author/ext-system/{ext}/search…`, `source` = names joined by ", ", `dam.internal` from `mainFileInternal`. Both: the queue is emptied and the dialog closed afterwards | fake client | `uploadQueueDialogSingle.test.ts:303-322` (sibling) |
| B2 | single dialog: what a finished upload shows | UGC: no tabs, ROI editor in the left pane, no single-use switch, no file panel, no keyword or author field, exactly the two custom fields. CMS: Info and ROI tabs, switch, file panel, keyword and author fields when the ext-system config enables them | fake client, ROI component stubbed | `uploadQueueDialogSingle.test.ts:182-205` |
| B3 | single dialog: the ROI editor is editable without a grant for UGC and by `dam_regionOfInterest_update` for CMS | prop `readonly` of the ROI component per profile and per the DAM user's grants | fake client, ROI component stubbed | `cropper/__tests__/roiUpdateAcl.test.ts` |
| B4 | multi dialog: what "save" and "save and apply" send and hand over | both: the PATCH contains only rows with editable metadata, `mainFileSingleUse` is the row's value. Apply hands over only uploaded rows, each with `position` after the widget's last, `damAuthors` and `showDamAuthors` from the mapper's `authorIds`. UGC: `showDamAuthors: true` and no author field in the widget rows. CMS with authors enabled: the DAM author field in the rows | fake client | `uploadQueue/__tests__/uploadQueueDialogSave.test.ts:81-87` (sibling) |
| B5 | UGC: a row has no single-use switch and no author or keyword field | UGC config: none of the three rendered. CMS: all three, when enabled | seeded store | `uploadQueue/__tests__/queueRowValidation.test.ts:53-56` |
| B6 | the refresh of a row asks the profile's endpoint | both: 20 s after a row turned uploaded without metadata the button appears; a click does `GET {asset}/{id}` and settles the row | fake client, timer shim | `uploadQueue/__tests__/uploadQueueRowRefresh.test.ts:110-139`; `uploadQueueItemRefresh.test.ts:95-110` |
| B7 | closing the dialog during an upload | both: the chunk request is aborted, no finish request, no poll, the queue is empty, the file input key grows, the dialog ref is `null` | fake client | `uploadQueue/__tests__/uploadStopBetweenChunks.test.ts:52-65` |

Risk C: widgets and options the refactor keeps. Lower risk; they pin the two apps' contract.

| # | Name | Asserts | Mock | Extends |
|---|---|---|---|---|
| C1 | UGC: an inner widget on a seeded store asks DAM for no configuration | mounting `AImageWidgetInner` the UGC way and opening the picker: no request under `/adm/v1/`; the picker opens with no DAM user and lists from `/ugc/v1/asset/licence/{licence}…`. Without `skip-current-user-check` the same mount shows `assetSelect.error.unallowedLicence` and does not open | fake client | `config/__tests__/damWidgetUploadAccess.test.ts:69-80` (sibling) |
| C2 | CMS: the outer widget loads its configuration from `/adm/v1` and offers the upload only to an allowed user | requests: asset-licence, ext-system configuration, configuration, asset-custom-form; allowed user -> dropzone and menu; user without the licence or ext system -> read-only; no user -> read-only; licence that does not load -> simple image plus `damImage.error.loadingConfig` | fake client | `damWidgetUploadAccess.test.ts:69-94` (today with `useDamConfigState` mocked) |
| C3 | a file is queued under the widget's key with the upload config's licence | both: selecting a file through the menu opens the single dialog and the first request is `POST {image}/licence/{uploadLicence}`. A second widget with another key shows no dialog | fake client | `imageWidget/__tests__/ImageWidgetInnerExpandMetadata.test.ts` |
| C4 | `expand-options` + `expand-metadata` (both apps' embed dialog) | three buttons, no "..." menu; after save-and-apply the metadata form is inline; `metadataConfirm()` saves through `imageApi.createImage` (UGC: the app function; CMS: `POST /adm/v1/image` on the image client) and emits `afterMetadataSaveSuccess` once. With a model value already set, the new image keeps that id and `updateImage` is called instead (`ImageWidgetInner.vue:610-612,563-565`) | fake clients | `ImageWidgetInnerExpandMetadata.test.ts:61-84` |
| C5 | picking an asset from the library | UGC: `GET /ugc/v1/asset/{id}`, mapper called, no author request, metadata dialog with the mapped texts, `dam.licenceId` = the asset's licence. CMS: authors fetched and joined; with none and authors enabled, the DAM author field is shown and the source is not required | fake client | `imageWidget/__tests__/ImageWidgetCollab.test.ts:316-326` (sibling) |
| C6 | UGC: the asset list page uploads through the slot | `AAssetListInner` with a provided upload config renders the `upload-activator` slot with `uploadAccept` = the five mime types joined by commas and `uploadSizes` = 20971520 each; `onFileInput` opens the multi dialog; apply empties the queue, closes the dialog and reloads the list. Without a provided config: no slot, no dialog. Filters rendered: `text` and `createdAtFrom` only | fake client | none exists; nearest `assetSelect/__tests__/assetSelectListActions.test.ts` |
| C7 | a file type the ext system does not list is not queued | UGC literal config: `image/tiff` leaves the queue empty; record what the single dialog then shows (reading the code: the loader, since `uploadQueueDialog` is set regardless, `ImageWidgetInner.vue:348-349`, `UploadQueueDialogSingle.vue:323-326`) | none | `uploadQueuesStore.test.ts:85-98` (sibling: that file mocks `getAssetTypeByMimeType`) |
| C8 | gallery: load, apply, save | UGC: `fetchImageListByIds` (app fn), then `GET /ugc/v1/asset/licence/{l}/search?assetAndMainFileIds=…` and `…/ids/…`; `saveImages()` calls `bulkUpdateImages` with positions, makes no `metadata-bulk-update` request for authors, emits the ids. CMS with authors enabled and `showDamAuthors`: `PATCH /adm/v1/asset/metadata-bulk-update` before the image save | fake clients | `imageWidget/__tests__/ImageWidgetMultipleInner.test.ts:68-104` |
| C9 | a queue outlives the widget that started it (CMS key `image`, UGC keys `articleEmbedImage`, `blogGallery`) | unmounting a widget with its dialog open leaves the queue and the dialog ref; a widget mounted afterwards with the same key shows that dialog and that item. To be pinned or deliberately changed: section 4.3 reads it from the code, it was not run | fake client | `ImageWidgetCollab.test.ts:94-110` (uses the shared ref) |
| C10 | the exports both apps import are still exported | from `lib`: `AImageWidget`, `AImageWidgetInner`, `AImageWidgetMultiple`, `AImageWidgetMultipleInner`, `AImageWidgetSimple`, `AImageWidgetMultipleSimple`, `AImageMediaWidget`, `AMediaWidgetSimple`, `AImageMassOperations`, `AImagePublicInput`, `AAssetSelect`, `AAssetListInner`, `AFileInput`, `ADamAdminAssetLink`, `useDamConfigStore`, `useDamConfigState`, `useImageStore`, `useImageActions`, `useCommonAdminImageOptions`, `initDamNotifications`, `useDropzoneGlobalDragState`, `ImageWidgetUploadConfigKey`, `isImageCreateUpdateAware`, `isMediaAware`, `fetchAsset`, `fetchAssetByFileId`, `fetchAssetAsCmsMedia`, `fetchAssetAndCheckForSingleUseByFileIds`, `DamAssetType`, `assetFileIsImageFile`; and the shape the UGC wrappers write to: `useDamConfigStore()` has `initialized.damPrvConfig`, `damPrvConfig.settings.imageChunkConfig`, and the maps `damConfigLicenceExtSystem`, `damConfigAssetCustomFormElements`, `damConfigExtSystem` | none | `LIB:src/test/publicExportsAdded.test.ts:44-73` |

Why C10 names the store shape: admin-ugc writes to those five members directly (`UGC ImageWidget.vue:93-145`). The refactor "rewrites the store"; if that reaches `useDamConfigStore` or its member names, all three UGC wrappers break at run time with no type error on the library side.

---

## 8. What could not be verified from code

1. **Deployed configuration.** Only templates (`CMS:public/config.json.dist:71-74`, `.cf.dist`) and one local `config.json` were readable. Whether `DAM_NOTIFICATION_ENABLED` is on in each admin-cms environment is unknown.
2. **The `/ugc/v1` backend.** The frontend composes `/ugc/v1/asset/:id`, `/ugc/v1/asset/asset-file/:id`, `/ugc/v1/asset/licence/:id` (+ `/search`, `/ids/…`), `/ugc/v1/asset/metadata-bulk-update`, `/ugc/v1/image/licence/:id`, `/ugc/v1/image/:id/chunk`, `/ugc/v1/image/:id/uploaded`, `/ugc/v1/image/:id/rotate/:angle`, `/ugc/v1/roi/:id`. Whether each exists, and whether `/ugc/v1/asset/:id` returns `mainFile.fileAttributes.status`, `originAssetFile`, `authors`, `keywords` and `metadata.*Suggestions` as the admin endpoint does, was not checked. The poll depends on `fileAttributes.status`.
3. **Requests the UGC profile may still send to `/adm/v1`.** The author and keyword caches fetch from `/adm/v1/author|keyword/ext-system/{id}/search` (`LIB:src/domains/dam/author/composables/cachedAuthors.ts:23-27`, `author/api/authorApi.ts:9-18`, `keyword/api/keywordApi.ts:8-17`) whenever a settled asset carries author or keyword ids (`uploadQueuesStore.ts:260-262,324-325`). Whether a UGC asset ever does, and what the backend answers a blogger, is unknown.
4. **Ext system 4.** That `4` is the ext system of the licence `/ugc/v1/asset-licence/blog/:blogId` returns, and that the literal limits (20 MB, five mime types, 1 MiB / 50 MiB chunks, two custom fields with those ids) match the server, cannot be seen from the frontend.
5. **The exact commit of the installed build.** Inferred from file dates and from which symbols the `dist` contains (section 1); a `dist` carries no commit id.
6. **The frame format.** `{ eventName, data: <JSON string> }` is read from the client parser (`damNotifications.ts:44-49`); the server side was not read here.
7. **Timing.** Nothing was executed. The 10/50/140/300/550 s figures come from the constants (`uploadApi.ts:15-16,98-100`) and from the existing test's recorded timers (`uploadStatusFallback.test.ts:107`).
8. **Same key mounted twice at once.** By static reading no two admin-cms widgets with the same key share a page, and the two admin-ugc pairs are on different pages or dialogs. Not checked at run time. The queue-outlives-its-widget behaviour (C9) is read from the code only.
9. **Whether the apps' e2e suites pass**, and whether admin-cms's 5 s wait survives a poll-only upload. `.results` folders exist in both `e2e` directories; they were not interpreted.
10. **admin-dam**, the third profile, was out of scope and not read. `uploadStatusFallback: false` and several branches untouched by these two apps (slot files, non-image types, external provider assets) presumably belong to it.
