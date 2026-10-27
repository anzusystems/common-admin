import type { AxiosInstance } from 'axios'
import type { PluginOptions } from '@/AnzuSystemsCommonAdmin'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { CustomDataFormElementType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { initCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { DamExtSystemConfig } from '@/domains/dam/types/DamConfig'
import type {
  AssetSelectMetadataToImageMapFn,
  UploadMetadataToImageMapFn,
} from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import type { IntegerId } from '@/shared/types/common'
import { isNull, isString } from '@/shared/utils/common'

// The two applications that use the DAM upload, as the library sees them: the `coreDam` and `image`
// options each installs the plugin with, and the DAM configuration store when a file is added.
// The literals mirror `admin-cms/src/main.ts` and `admin-ugc/src/main.ts`. Values those read from the
// environment or translate have stand-ins here. The admin-ugc metadata maps are copied from its source.
// Upload tests run under both.

type ConsumerPluginOptions = Required<Pick<PluginOptions, 'coreDam' | 'image'>>

export interface ConsumerProfile {
  name: 'CMS configuration' | 'UGC configuration'
  endPoints: { asset: string; image: string; roi: string }
  /**
   * The paths of the other application. Nothing may be requested there.
   */
  foreignPrefix: string
  notifications: boolean
  extSystem: IntegerId
  licence: IntegerId
  options: (damClient: () => AxiosInstance) => ConsumerPluginOptions
  /**
   * The DAM configuration as in `useDamConfigStore` when the upload starts. Needs an active pinia.
   */
  seedDamConfig: () => void
}

export const CONSUMER_DAM_ADMIN_DOMAIN = 'https://dam.test'
export const CONSUMER_DAM_SOCKET_URL = 'ws://dam.test/notifications'
const IMAGE_DOMAIN = 'https://image.test'
const IMAGE_DOMAIN_ORIGINAL = 'https://image-original.test'

const noImageClient = () => {
  throw new Error('The image client is not part of the upload.')
}

const stringElement = (property: string, maxValue: number): CustomDataFormElement => ({
  id: `element-${property}`,
  property,
  name: property,
  position: 1,
  attributes: {
    type: CustomDataFormElementType.String,
    minValue: null,
    maxValue,
    minCount: null,
    maxCount: null,
    required: false,
    searchable: false,
    readonly: false,
  },
})

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

const seed = (
  extSystem: IntegerId,
  licence: IntegerId,
  licenceName: string,
  extSystemConfig: DamExtSystemConfig,
  imageElements: CustomDataFormElement[],
  imageChunkConfig: { minSize: number; maxSize: number }
) => {
  const store = useDamConfigStore()
  store.damPrvConfig.settings.imageChunkConfig = imageChunkConfig
  store.initialized.damPrvConfig = true
  store.damConfigLicenceExtSystem.set(licence, { name: licenceName, extSystem })
  store.damConfigAssetCustomFormElements.set(extSystem, {
    [DamAssetType.Image]: imageElements,
    [DamAssetType.Audio]: [],
    [DamAssetType.Video]: [],
    [DamAssetType.Document]: [],
  })
  store.damConfigExtSystem.set(extSystem, extSystemConfig)
}

// admin-cms: everything default. The library loads the configuration from `/adm/v1/...` when a widget mounts.
// Here it is written straight into the store, in the shape those requests return.
export const cmsConfiguration: ConsumerProfile = {
  name: 'CMS configuration',
  endPoints: { asset: '/adm/v1/asset', image: '/adm/v1/image', roi: '/adm/v1/roi' },
  foreignPrefix: '/ugc/v1',
  notifications: true,
  extSystem: 1,
  licence: 100001,
  options: (damClient) => ({
    coreDam: {
      configs: {
        default: {
          damClient: damClient,
        },
      },
      apiTimeout: 30,
      uploadStatusFallback: true,
      adminDomain: CONSUMER_DAM_ADMIN_DOMAIN,
      notification: {
        enabled: true,
        webSocketUrl: CONSUMER_DAM_SOCKET_URL,
      },
    },
    image: {
      configs: {
        default: {
          imageClient: noImageClient,
          previewDomain: IMAGE_DOMAIN,
          previewDomainOriginal: IMAGE_DOMAIN_ORIGINAL,
          width: 500,
          height: 281,
        },
      },
    },
  }),
  seedDamConfig: () =>
    seed(
      1,
      100001,
      'cms',
      {
        image: {
          enabled: true,
          roiWidth: 16,
          roiHeight: 9,
          sizeLimit: 20971520,
          customMetadataPinnedAmount: 2,
          slots: ['default'],
          mimeTypes: IMAGE_MIME_TYPES,
          authors: { enabled: true, required: false },
          keywords: { enabled: true, required: false },
        },
      },
      [stringElement('title', 255), stringElement('description', 2000)],
      { minSize: 1048576, maxSize: 52428800 }
    ),
}

const notAnImageRequest = (): Promise<ImageAware> =>
  Promise.reject(new Error('The image API is not part of the upload.'))

// admin-ugc's two maps from DAM metadata to image texts, copied from
// its `domains/blog/image/composables/customMetadataToImageMap.ts`.
// Texts come from the two custom fields of the bulk save answer, not from the
// rows. A row without its asset or file is left out. No author is looked up.
const customUploadMetadataToImageMap: UploadMetadataToImageMapFn = async (
  queueItems,
  bulkItems,
  _damClient,
  _extSystem,
  licenceId
) => {
  const metaMap = new Map(bulkItems.map((b) => [b.id, b.customData]))

  return queueItems
    .filter((qi) => !isNull(qi.assetId) && !isNull(qi.fileId))
    .map((qi) => {
      const customData = metaMap.get(qi.assetId!)
      const description = isString(customData?.description) ? customData.description.trim() : ''
      const author = isString(customData?.author) ? customData.author.trim() : ''

      return {
        texts: {
          description,
          source: author,
        },
        flags: {
          showSource: true,
          internal: false,
          overrideInternal: false,
        },
        dam: {
          damId: qi.fileId!,
          regionPosition: 0,
          licenceId,
          internal: false,
        },
        authorIds: [],
        assetId: qi.assetId ?? undefined,
      }
    })
}

const customAssetSelectMetadataToImageMap: AssetSelectMetadataToImageMapFn = (assetRes) => ({
  description: isString(assetRes.metadata.customData?.description)
    ? assetRes.metadata.customData.description.trim()
    : '',
  source: isString(assetRes.metadata.customData?.author) ? assetRes.metadata.customData.author.trim() : '',
})

// admin-ugc: its own endpoints, no socket. The application writes the configuration itself
// before it mounts an inner widget: ext system 4, two custom fields, no authors, no keywords.
export const ugcConfiguration: ConsumerProfile = {
  name: 'UGC configuration',
  endPoints: { asset: '/ugc/v1/asset', image: '/ugc/v1/image', roi: '/ugc/v1/roi' },
  foreignPrefix: '/adm/v1',
  notifications: false,
  extSystem: 4,
  licence: 200004,
  options: (damClient) => ({
    coreDam: {
      configs: {
        default: {
          damClient: damClient,
          mainFileSingleUseEnabled: false,
          showSourceEnabled: false,
          showFileInfoEnabled: false,
          sourceValidation: {
            required: false,
          },
          sourceLabel: 'Autor',
          editAssetLabel: 'Upraviť obrázok',
          addFromDamLabel: 'Vybrať z knižnice',
          replaceFromDamLabel: 'Nahradiť z knižnice',
          endPointAsset: '/ugc/v1/asset',
          endPointImage: '/ugc/v1/image',
          endPointRoi: '/ugc/v1/roi',
          customUploadMetadataToImageMap,
          customAssetSelectMetadataToImageMap,
          assetListEnabledFilters: ['text', 'createdAtFrom'],
          simpleAssetSidebar: true,
        },
      },
      apiTimeout: 30,
      uploadStatusFallback: true,
      adminDomain: CONSUMER_DAM_ADMIN_DOMAIN,
      notification: {
        enabled: false,
        webSocketUrl: '',
      },
    },
    image: {
      configs: {
        default: {
          imageClient: noImageClient,
          previewDomain: IMAGE_DOMAIN,
          previewDomainOriginal: IMAGE_DOMAIN_ORIGINAL,
          width: 500,
          height: 281,
          imageApi: {
            fetchImage: notAnImageRequest,
            createImage: notAnImageRequest,
            updateImage: notAnImageRequest,
            deleteImage: () => Promise.resolve(),
            fetchImageListByIds: () => Promise.resolve([]),
            bulkUpdateImages: () => Promise.resolve([]),
          },
        },
      },
    },
  }),
  seedDamConfig: () =>
    seed(
      4,
      200004,
      '',
      {
        image: {
          enabled: true,
          roiWidth: 16,
          roiHeight: 9,
          sizeLimit: 20971520,
          customMetadataPinnedAmount: 2,
          slots: ['default'],
          mimeTypes: IMAGE_MIME_TYPES,
        },
      },
      [stringElement('description', 2000), stringElement('author', 255)],
      { minSize: 1048576, maxSize: 52428800 }
    ),
}

export const consumerProfiles: ConsumerProfile[] = [cmsConfiguration, ugcConfiguration]

/**
 * Reproduces what the plugin does with the application's options at install, and
 * the state set up by the time the first file is added. Needs an active pinia.
 */
export function installConsumerProfile(profile: ConsumerProfile, damClient: () => AxiosInstance) {
  const options = profile.options(damClient)
  initCommonAdminCoreDamOptions(options.coreDam)
  initCommonAdminImageOptions(options.image)
  profile.seedDamConfig()
  // The widget writes this when a file is picked or dropped, and it is needed to ask for author and keyword names.
  useExtSystemIdForCached().cachedExtSystemId.value = profile.extSystem
  return options
}
