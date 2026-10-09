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

// The two applications that use the DAM upload of this library, as the library sees them: the `coreDam` and
// `image` options each installs the plugin with, and what is in the DAM configuration store by the time a file
// is added. The literals mirror `admin-cms/src/main.ts` and `admin-ugc/src/main.ts`; what those read from their
// environment or translate has a stand-in here; admin-ugc's two metadata maps are copied from its source. A test of
// the upload runs under both.

type ConsumerPluginOptions = Required<Pick<PluginOptions, 'coreDam' | 'image'>>

export interface ConsumerProfile {
  name: 'CMS configuration' | 'UGC configuration'
  /** The paths the application's DAM requests go to. */
  endPoints: { asset: string; image: string; roi: string }
  /** The paths of the other application: nothing of this one may be asked there. */
  foreignPrefix: string
  /** Whether the application opens the notification socket. */
  notifications: boolean
  extSystem: IntegerId
  licence: IntegerId
  options: (damClient: () => AxiosInstance) => ConsumerPluginOptions
  /** The DAM configuration as it is in `useDamConfigStore` when the upload starts. Needs an active pinia. */
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

// admin-cms: everything by default. The library loads the configuration from `/adm/v1/...` when a widget mounts;
// here it is written straight into the store, in the shape those requests give it.
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

// admin-ugc's two maps from DAM metadata to the texts of an image, as they are in its
// `domains/blog/image/composables/customMetadataToImageMap.ts`: the texts come from the two custom fields of what
// the bulk save answered (not from the rows), a row without its asset or its file is left out, and no author is
// looked up.
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

// admin-ugc: its own endpoints, no socket, and a configuration the application writes itself (ext system 4, two
// custom fields, no authors and no keywords) before it mounts an inner widget.
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
 * What the plugin does with the application's options at install, and what the application, the library and the
 * widget have set up by the time the first file is added. Needs an active pinia.
 */
export function installConsumerProfile(profile: ConsumerProfile, damClient: () => AxiosInstance) {
  const options = profile.options(damClient)
  initCommonAdminCoreDamOptions(options.coreDam)
  initCommonAdminImageOptions(options.image)
  profile.seedDamConfig()
  // The widget writes it when a file is picked or dropped: the names of authors and keywords are asked for by it.
  useExtSystemIdForCached().cachedExtSystemId.value = profile.extSystem
  return options
}
