import { ref } from 'vue'
import type { CommonAdminImageOptions } from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/utils/common'
import type { DocId } from '@/types/common'
import type { AssetSingleUseUsage } from '@/types/coreDam/Asset'
import type { AssetSelectUsageHolder } from '@/types/coreDam/AssetSelect'
import {
  bulkUpdateImages as bulkUpdateImagesApi,
  createImage as createImageApi,
  deleteImage as deleteImageApi,
  fetchImage as fetchImageApi,
  fetchImageListByIds as fetchImageListByIdsApi,
  fetchSingleUseUsage as fetchSingleUseUsageApi,
  updateImage as updateImageApi,
} from '@/components/damImage/uploadQueue/api/imageApiCms'

const imageOptions = ref<CommonAdminImageOptions>(undefined)

const defaultImageApi = {
  fetchImage: fetchImageApi,
  createImage: createImageApi,
  updateImage: updateImageApi,
  deleteImage: deleteImageApi,
  fetchImageListByIds: fetchImageListByIdsApi,
  bulkUpdateImages: bulkUpdateImagesApi,
  fetchSingleUseUsage: fetchSingleUseUsageApi,
}

export function initCommonAdminImageOptions(data: CommonAdminImageOptions) {
  imageOptions.value = data
}

export function useCommonAdminImageOptions(configName: string = 'default') {
  if (
    isUndefined(imageOptions.value) ||
    isUndefined(imageOptions.value.configs) ||
    isUndefined(imageOptions.value.configs[configName])
  ) {
    throw new Error("Composable can't be used without properly configured common admin.")
  }

  return {
    imageClient: imageOptions.value.configs[configName].imageClient,
    previewDomain: imageOptions.value.configs[configName].previewDomain,
    previewDomainOriginal: imageOptions.value.configs[configName].previewDomainOriginal,
    imageWidth: imageOptions.value.configs[configName].width,
    imageHeight: imageOptions.value.configs[configName].height,
    imageApi: imageOptions.value.configs[configName].imageApi ?? defaultImageApi,
  }
}

// The picker asks the CMS about single use photos through the image config; an admin without one asks nobody.
export function useImageSingleUseUsageFetch(configName: string = 'default') {
  const config = imageOptions.value?.configs?.[configName]
  if (isUndefined(config)) return undefined
  const imageApi = config.imageApi ?? defaultImageApi

  return (
    groupIds: DocId[],
    usageHolder: AssetSelectUsageHolder | null,
  ): Promise<Record<DocId, AssetSingleUseUsage>> =>
    imageApi.fetchSingleUseUsage(config.imageClient, groupIds, usageHolder)
}
