import { inject } from 'vue'
import type { CommonAdminImageOptions } from '@/AnzuSystemsCommonAdmin'
import { ImageOptions } from '@/components/injectionKeys'
import { isUndefined } from '@/utils/common'

export function useImageOptions(configName: string = 'default') {
  const imageOptions = inject<CommonAdminImageOptions | undefined>(ImageOptions, undefined)

  if (isUndefined(imageOptions) || isUndefined(imageOptions.configs) || isUndefined(imageOptions.configs[configName])) {
    throw new Error("Component can't be used without properly configured common admin.")
  }

  return {
    fetchImageWidgetData: (id: number) => imageOptions.configs[configName].getImage(id),
    imageUrl: imageOptions.configs[configName].imageUrl,
    imageWidth: imageOptions.configs[configName].width,
    imageHeight: imageOptions.configs[configName].height,
  }
}
