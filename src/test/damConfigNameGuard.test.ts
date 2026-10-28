import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DAM_DEFAULT_STORE, DAM_NAME_ACCESSORS, DAM_NAME_STORE_METHODS } from '@/test/support/damConfigNameAccessors'
import * as damAssetApi from '@/domains/dam/api/damAssetApi'
import * as assetSelectListActions from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import * as podcastFilterAndActions from '@/domains/dam/assetSelect/composables/podcastFilterAndActions'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import * as authorActions from '@/domains/dam/author/composables/authorActions'
import * as cachedAuthors from '@/domains/dam/author/composables/cachedAuthors'
import * as cachedUsers from '@/domains/dam/author/composables/cachedUsers'
import * as damAuthorConfig from '@/domains/dam/author/composables/damAuthorConfig'
import * as commonAdminCoreDamOptions from '@/domains/dam/composables/commonAdminCoreDamOptions'
import * as damNotificationsConnection from '@/domains/dam/composables/damNotificationsConnection'
import * as extSystemIdForCached from '@/domains/dam/composables/extSystemIdForCached'
import * as uploadValidations from '@/domains/dam/composables/uploadValidations'
import * as damConfigState from '@/domains/dam/config/composables/damConfigState'
import * as damConfigStore from '@/domains/dam/config/store/damConfigStore'
import * as damFilterUserAllowedUploadConfigs from '@/domains/dam/config/utils/damFilterUserAllowedUploadConfigs'
import * as commonAdminImageOptions from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import * as useImageMassOperations from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import * as waitLimit from '@/domains/dam/imageWidget/utils/waitLimit'
import * as cachedKeywords from '@/domains/dam/keyword/composables/cachedKeywords'
import * as damKeywordConfig from '@/domains/dam/keyword/composables/damKeywordConfig'
import * as keywordActions from '@/domains/dam/keyword/composables/keywordActions'
import * as uploadQueueBindings from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import * as damUploadChunkSize from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import * as uploadQueueItemRefresh from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import * as uploadPresets from '@/domains/dam/uploadQueue/presets/uploadPresets'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import * as damDistributionServiceType from '@/domains/dam/user/types/DamDistributionServiceType'
import * as damExternalProviderAssetType from '@/domains/dam/user/types/DamExternalProviderAssetType'

// The guard of the DAM configuration name reads the calls of the accessors of `damConfigNameAccessors.ts` (in node:
// `src/test/eslint/damConfigNameGuard.test.ts`). A list that names a function no module has any longer guards
// nothing: every name of it is a function of the DAM domain, and every method a method of its store.

const modules: Record<string, unknown>[] = [
  damAssetApi,
  assetSelectListActions,
  podcastFilterAndActions,
  authorActions,
  cachedAuthors,
  cachedUsers,
  damAuthorConfig,
  commonAdminCoreDamOptions,
  damNotificationsConnection,
  extSystemIdForCached,
  uploadValidations,
  damConfigState,
  damConfigStore,
  damFilterUserAllowedUploadConfigs,
  commonAdminImageOptions,
  useImageMassOperations,
  waitLimit,
  cachedKeywords,
  damKeywordConfig,
  keywordActions,
  uploadQueueBindings,
  damUploadChunkSize,
  uploadQueueItemRefresh,
  uploadPresets,
  damDistributionServiceType,
  damExternalProviderAssetType,
]
const exported = (name: string) => modules.some((module) => typeof module[name] === 'function')

describe('the accessors the guard of the DAM configuration name reads', () => {
  it.each([...Object.keys(DAM_NAME_ACCESSORS), DAM_DEFAULT_STORE])('%s is a function of the DAM domain', (name) => {
    expect(exported(name)).toBe(true)
  })

  it.each(Object.keys(DAM_NAME_STORE_METHODS))('%s is a method of the upload store or of the detail store', (name) => {
    setActivePinia(createPinia())
    const stores = [useUploadQueuesStore(), useAssetDetailStore()] as unknown as Record<string, unknown>[]

    expect(stores.some((store) => typeof store[name] === 'function')).toBe(true)
  })
})
