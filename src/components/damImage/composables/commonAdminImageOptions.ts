import { ref } from 'vue'
import type { CommonAdminImageOptions } from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/utils/common'

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
    imageWidth: imageOptions.value.configs[configName].width,
    imageHeight: imageOptions.value.configs[configName].height,
  }
}
