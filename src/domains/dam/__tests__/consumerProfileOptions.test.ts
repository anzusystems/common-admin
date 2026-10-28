import { describe, expect, it } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createApp } from 'vue'
import AnzuSystemsCommonAdmin from '@/AnzuSystemsCommonAdmin'
import {
  cmsConfiguration,
  CONSUMER_DAM_ADMIN_DOMAIN,
  CONSUMER_DAM_SOCKET_URL,
  ugcConfiguration,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import {
  useCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptionsGlobal,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import * as imageApiCms from '@/domains/dam/imageWidget/composables/imageApiCms'
import { commonT, i18n } from '@/plugins/i18n'

// The plugin options of admin-cms and admin-ugc are typed literals in
// `support/consumerProfiles.ts`. A renamed or dropped option stops that file compiling.
// Here they go through the plugin itself, and the test checks what the library reads back.

const damClient = () => ({}) as AxiosInstance

const install = (profile: typeof cmsConfiguration) => {
  const options = profile.options(damClient)
  createApp({}).use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk'], default: 'sk' }, ...options })
  return options
}

const fixedAddresses = {
  endPointConfiguration: '/adm/v1/configuration',
  endPointPubConfiguration: '/pub/v1/configuration',
  endPointAssetLicence: '/adm/v1/asset-licence',
  endPointAssetCustomForm: '/adm/v1/asset-custom-form',
  endPointUser: '/adm/v1/user',
  endPointPodcast: '/adm/v1/podcast',
  endPointCmsAsset: '/adm/v1/cms/asset',
}

describe('the plugin options of admin-cms', () => {
  it('resolve to the admin endpoints, their grants and every default', () => {
    install(cmsConfiguration)

    expect(useCommonAdminCoreDamOptions('default')).toEqual({
      damClient,
      endPointAsset: '/adm/v1/asset',
      endPointImage: '/adm/v1/image',
      endPointRoi: '/adm/v1/roi',
      endPointAuthor: '/adm/v1/author',
      endPointKeyword: '/adm/v1/keyword',
      ...fixedAddresses,
      currentUser: 'dam',
      adminDomain: CONSUMER_DAM_ADMIN_DOMAIN,
      apiTimeout: 30,
      roiUpdateAcl: 'dam_regionOfInterest_update',
      imageRotateAcl: 'dam_image_update',
      mainFileSingleUseEnabled: true,
      showSourceEnabled: true,
      showFileInfoEnabled: true,
      sourceLabel: commonT('common.damImage.image.model.texts.source'),
      editAssetLabel: commonT('common.damImage.image.button.editAsset'),
      addFromDamLabel: commonT('common.damImage.image.button.addFromDam'),
      replaceFromDamLabel: commonT('common.damImage.image.button.replaceFromDam'),
      descriptionValidation: { required: false, min: 0, max: 2000 },
      sourceValidation: { required: true, min: 0, max: 255 },
      customUploadMetadataToImageMap: undefined,
      customAssetSelectMetadataToImageMap: undefined,
      assetListEnabledFilters: undefined,
      simpleAssetSidebarEnabled: false,
    })
  })

  // `uploadStatusFallback`, which the application still passes, is not read: the upload state is always polled for.
  it('have the notification socket on, at its address', () => {
    install(cmsConfiguration)

    expect(useCommonAdminCoreDamOptionsGlobal()).toEqual({
      apiTimeout: 30,
      adminDomain: CONSUMER_DAM_ADMIN_DOMAIN,
      notification: { enabled: true, webSocketUrl: CONSUMER_DAM_SOCKET_URL },
    })
  })

  it('leave the image API to the library', () => {
    install(cmsConfiguration)

    expect(useCommonAdminImageOptions()).toMatchObject({ imageWidth: 500, imageHeight: 281 })
    expect(useCommonAdminImageOptions().imageApi).toEqual({
      fetchImage: imageApiCms.fetchImage,
      createImage: imageApiCms.createImage,
      updateImage: imageApiCms.updateImage,
      deleteImage: imageApiCms.deleteImage,
      fetchImageListByIds: imageApiCms.fetchImageListByIds,
      bulkUpdateImages: imageApiCms.bulkUpdateImages,
    })
  })
})

describe('the plugin options of admin-ugc', () => {
  it('resolve to its own endpoints, no grants, its labels and its switched-off parts', () => {
    const { coreDam } = install(ugcConfiguration)
    const own = coreDam!.configs.default!

    expect(useCommonAdminCoreDamOptions('default')).toEqual({
      damClient,
      endPointAsset: '/ugc/v1/asset',
      endPointImage: '/ugc/v1/image',
      endPointRoi: '/ugc/v1/roi',
      endPointAuthor: '/adm/v1/author',
      endPointKeyword: '/adm/v1/keyword',
      ...fixedAddresses,
      currentUser: 'dam',
      adminDomain: CONSUMER_DAM_ADMIN_DOMAIN,
      apiTimeout: 30,
      // Not the default endpoints, so the grants of the admin API are not asked for.
      roiUpdateAcl: null,
      imageRotateAcl: null,
      mainFileSingleUseEnabled: false,
      showSourceEnabled: false,
      showFileInfoEnabled: false,
      sourceLabel: 'Autor',
      editAssetLabel: 'Upraviť obrázok',
      addFromDamLabel: 'Vybrať z knižnice',
      replaceFromDamLabel: 'Nahradiť z knižnice',
      descriptionValidation: { required: false, min: 0, max: 2000 },
      sourceValidation: { required: false, min: 0, max: 255 },
      customUploadMetadataToImageMap: own.customUploadMetadataToImageMap,
      customAssetSelectMetadataToImageMap: own.customAssetSelectMetadataToImageMap,
      assetListEnabledFilters: ['text', 'createdAtFrom'],
      simpleAssetSidebarEnabled: true,
    })
    expect(own.customUploadMetadataToImageMap).toBeTypeOf('function')
    expect(own.customAssetSelectMetadataToImageMap).toBeTypeOf('function')
  })

  it('have no notification socket', () => {
    install(ugcConfiguration)

    expect(useCommonAdminCoreDamOptionsGlobal()).toEqual({
      apiTimeout: 30,
      adminDomain: CONSUMER_DAM_ADMIN_DOMAIN,
      notification: { enabled: false, webSocketUrl: '' },
    })
  })

  it('bring the image API of the application', () => {
    const { image } = install(ugcConfiguration)

    expect(useCommonAdminImageOptions()).toMatchObject({ imageWidth: 500, imageHeight: 281 })
    expect(useCommonAdminImageOptions().imageApi).toEqual(image!.configs.default!.imageApi)
  })
})

// A widget, queue or detail uses the DAM configuration it names. An unnamed one is refused.
// Names every object has by itself (`constructor`, `toString`, `__proto__`)
// are refused too. Read as a configuration, they had no client.
describe('a DAM configuration the application has not named', () => {
  it.each(['unknown', 'constructor', 'toString', '__proto__'])('is refused: %s', (name) => {
    install(cmsConfiguration)

    expect(() => useCommonAdminCoreDamOptions(name)).toThrow(
      "Composable can't be used without properly configured common admin."
    )
    expect(useCommonAdminCoreDamOptions('default').endPointAsset).toBe('/adm/v1/asset')
  })
})
