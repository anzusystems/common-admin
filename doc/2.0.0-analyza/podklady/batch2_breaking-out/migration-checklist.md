# 2.0.0 migration checklist per admin (draft)

Order in every admin, after bumping `@anzusystems/common-admin` to 2.0.0:
1. `node codemod.mjs --transforms b4,b5,b5dam,b6,b7 --admins <x> --write` (B4, B5, B6, B7)
2. `node b10-codemod-i18n.mjs` (B10 steps 1-4), then `node b9-acl-import-codemod.mjs` (B9 imports). Each re-parses its input, so they run one after another on the same tree.
3. `yarn format && yarn lint --fix`. Of the 530 codemod sites, the output is already oxfmt-clean except in dam `src/plugins/vuetify.ts`, which B10 rewrites anyway.
4. Manual items below
5. `yarn ci` (vue-tsc, oxlint, eslint, tests), then the smoke tests listed per admin.

Numbers are sites/files from the dry runs: `codemod-dryrun/sites.txt`, `b10-codemod-dryrun.txt`, `b9-acl-import-codemod.summary.json`, `b8-sites.txt`, `b2-sites.txt`.

## admin-cms (~4 h)
- [ ] codemod: B4 25 files, B5 scope keys 2 files (`KeywordRemoteAutocomplete.vue`, `SiteGroupAutocomplete.vue`; switching them to `useSystemEntityScope()` is optional), A-prefix 6 files, B6 161 listeners in 105 files, B7 4 files (`ArticleFilter.ts`, linkedList stores and factory)
- [ ] B10 codemod: 20 files. By hand: `src/test/listEditorUnsaved.test.ts` passes `i18n`. Optionally delete `locales/{sk,en}/common/permissionEditor.json`, which duplicates the library's.
- [ ] B9: `Acl` import in 7 files (codemod); remove `'Acl'` from `vue/no-undef-components` `ignorePatterns`; in `src/plugins.d.ts` drop the `Acl` line and the `AclValue`/`can` augmentation, and add `interface AclRegistry { acl: AclValue }`
- [ ] B1 by hand: `LinkedListManage.vue` (see `b1-cms-migration.diff`). Smoke test: add a root row, add after a row, add a child, edit, save; after the save no row stays marked unsaved.
- [ ] B2: delete `useImageStore().reset()` in `GalleryEdit.vue:51`
- [ ] B8c: `ArticleIntentionRecommenderFields.vue:27,47` (its `v` is `Record<string, unknown>`)
- [ ] B8h: `prompt-versions/{new.vue:96,[id]/index.vue:77,[id]/edit.vue:116}` `as const`, plus 3 `navigateBack` calls in `src/test/routeHistory.test.ts`
- [ ] optional: drop 4 `fetchCachedUsers as any` (B3), 6 `anzuUser as unknown as Ref<User>` (B8d), 11 select-strategy `as any` (B8f)
- [ ] smoke: an alert and a validation message in sk and en, a `ACreateDialog` flow, a `ASubjectSelect` dialog (paging, confirm), article collab (reconnect banner)

## admin-blog (~1 h)
- [ ] codemod: B4 1 file, B6 11 in 11 files
- [ ] B10 codemod 7 files, test `listEditorUnsaved.test.ts` by hand
- [ ] B9: `plugins.d.ts` (the `AclValue` import from `@/shared/types/Permission` does not resolve today, TS2305) and `ignorePatterns`. No `<Acl>` in templates.
- [ ] B8h: 3 test calls
- [ ] smoke: login, a create dialog, an alert

## admin-forum (~1.5 h)
- [ ] codemod: B4 1, B5 scope keys 1 file (`ViolationSelect.vue`), B6 6 in 6 files
- [ ] B10 codemod 8 files, 1 test. forum already has the cs plural rule; `commonPluralRules` matches it.
- [ ] B9: `Acl` import in 51 files (codemod), `plugins.d.ts` (TS2305 as in blog), `ignorePatterns`
- [ ] B8h: 3 test calls
- [ ] smoke: pages gated by `<Acl>` with a limited user (a missed import shows gated content)

## admin-inhouse (~1 h)
- [ ] codemod: B4 1, B6 46 in 24 files (mostly `ACreateDialog` `@open`/`@success`)
- [ ] B10 codemod 12 files, 1 test
- [ ] B9: `plugins.d.ts`, `ignorePatterns`. No `<Acl>` in templates.
- [ ] B8c: nothing; the 3 wrappers typed `BaseValidation | null` fit `AFormFieldValidation | null`
- [ ] B8h: 3 test calls

## admin-ugc (~3-4 h, B2)
- [ ] codemod: B4 2, B6 25 in 14 files, A-prefix `ImageMassOperations` 2 files
- [ ] B2 by hand (see `b2-ugc-migration.diff`): move the three store-writing blocks into `coreDam.configs[name].staticConfig` in the plugin options; `ImageWidget.vue`/`ImageWidgetMultiple.vue` shrink to wrappers around `AImageWidget`/`AImageWidgetMultiple` for the sidebar slot; `AssetList.vue` becomes `AAssetList`; delete the 3 `useImageStore().reset()` calls (`GalleryEdit.vue:39`, `EmbedGalleryEditForm.vue:42,46`)
- [ ] B10 codemod 5 files, 2 tests (`listEditorUnsaved`, `relatedArticlesReorder`)
- [ ] B9: `plugins.d.ts`, `ignorePatterns`
- [ ] optional: 2 select-strategy casts (B8f)
- [ ] smoke: upload an image in an article, pick an existing image, change a gallery (add, reorder, metadata), open two articles one after another (A4)

## admin-dam (~3 h)
- [ ] codemod: B4 54 files, A-prefix 17 files (64 sites), B6 67 in 44 files
- [ ] B2: 17 files reading `useDamConfigStore` switch to `useDamConfig()` (13 `storeToRefs` sites map 1:1; 4 direct reads get `.value`); 2 test mocks by hand
- [ ] B8a: upload queue on `AbortController`, 11 lines in 6 files (`asset/api/{image,audio,video,document}Api.ts`, `shared/services/upload/uploadService.ts`, `asset/store/uploadQueuesStore.ts`) and 1 test mock; `axios.CancelToken.source()` becomes `new AbortController()`, `cancelToken: x.token` becomes `signal: x.signal`, `.cancel()` becomes `.abort()`
- [ ] B10 codemod 7 files, 1 test
- [ ] B9: `Acl` import in 57 files (codemod), `plugins.d.ts`, `ignorePatterns`
- [ ] optional: 2 `anzuUser` casts (B8d)
- [ ] smoke: upload several files and stop one mid-upload (cancel path), asset detail distribution dialogs, licence and ext system selects, permission-gated pages with a limited user
