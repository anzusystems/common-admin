import type { ImageAware } from '@/types/ImageAware'
import type { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import type { IntegerId } from '@/types/common'
import { isNull } from '@/utils/common'

export function useImageActions(config: ReturnType<typeof useCommonAdminImageOptions>) {
  const widgetImageToDamImageUrl = (
    image: ImageAware,
    width = config.imageWidth,
    height = config.imageHeight,
    random = true
  ) => {
    return (
      config.previewDomain +
      '/image/w' +
      width +
      '-h' +
      height +
      (image.dam.regionPosition > 0 ? '-c' + image.dam.regionPosition : '') +
      '/' +
      image.dam.damId +
      '.jpg' +
      (random ? '?random=' + Date.now() : '')
    )
  }

  return {
    widgetImageToDamImageUrl,
  }
}
