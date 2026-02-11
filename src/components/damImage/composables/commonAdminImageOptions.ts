import { ref } from 'vue'
import type { CommonAdminImageOptions } from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/utils/common'
import {
  bulkUpdateImages as bulkUpdateImagesApi,
  createImage as createImageApi,
  deleteImage as deleteImageApi,
  fetchImage as fetchImageApi,
  fetchImageListByIds as fetchImageListByIdsApi,
  updateImage as updateImageApi,
} from '@/components/damImage/uploadQueue/api/imageApiCms'

const imageOptions = ref<CommonAdminImageOptions>(undefined)

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
    imageApi: imageOptions.value.configs[configName].imageApi ? imageOptions.value.configs[configName].imageApi : {
      fetchImage: fetchImageApi,
      createImage: createImageApi,
      updateImage: updateImageApi,
      deleteImage: deleteImageApi,
      fetchImageListByIds: fetchImageListByIdsApi,
      bulkUpdateImages: bulkUpdateImagesApi,
    },
  }
}
