// The accessors of a state of a DAM, each kept per DAM configuration name, and the position of the name among the
// arguments of each (from 1). The guard `src/test/eslint/damConfigNameGuard.test.ts` reads every call of them in the
// DAM domain; `src/test/damConfigNameGuard.test.ts` keeps the list to functions that exist.

/** Composables and functions, by their export. */
export const DAM_NAME_ACCESSORS: Record<string, number> = {
  useCommonAdminCoreDamOptions: 1,
  damEndPointsOf: 1,
  useDamConfigState: 2,
  useDamConfigStoreOf: 1,
  useDamCachedAuthors: 1,
  useDamCachedKeywords: 1,
  useDamCachedUsers: 1,
  useDamCachedAuthorsForRemoteAutocomplete: 1,
  useCachedKeywordsForRemoteAutocomplete: 1,
  useExtSystemIdForCached: 1,
  useDamNotificationsConnection: 1,
  useDamUploadChunkSize: 2,
  useDamKeywordAssetTypeConfig: 3,
  useDamAuthorAssetTypeConfig: 3,
  useDamDistributionServiceType: 1,
  useDamExternalProviderAssetType: 1,
  useCommonAdminImageOptions: 1,
  useAssetSelectActions: 1,
  usePodcastSelectActions: 2,
  useAuthorSelectActions: 2,
  useKeywordSelectActions: 2,
  useImageMassOperations: 1,
  useImageValidation: 3,
  useUploadQueueItemRefresh: 1,
  useLibraryUploadQueueListBinding: 2,
  libraryUploadPreset: 1,
  withinWaitLimit: 3,
  filterAllowedImageWidgetSelectConfigs: 2,
  isImageWidgetUploadConfigAllowed: 2,
  showMetadataSaveError: 3,
}

/**
 * Methods of the library's upload store (`useUploadQueuesStore`) and of the asset detail store
 * (`useAssetDetailStore`). The settle functions take whose rows they are for (`UploadQueueRowsOf`): a name or
 * `{ queueKey }`.
 */
export const DAM_NAME_STORE_METHODS: Record<string, number> = {
  addByFiles: 5,
  addByCopyToLicence: 5,
  noteRowsOfAsset: 2,
  updateFromDetail: 2,
  queueItemProcessed: 2,
  queueItemFullyProcessed: 2,
  queueItemDuplicate: 4,
  queueItemFailed: 3,
  refreshAsset: 2,
  setSaving: 3,
  savingOf: 2,
}

/**
 * `useDamConfigStore` takes no name, only a Pinia: it is the store of `default`. In the DAM domain it is called only
 * inside `useDamConfigStoreOf`, which is the rule itself.
 */
export const DAM_DEFAULT_STORE = 'useDamConfigStore'
