import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import type { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'

export function useImageActions(config: ReturnType<typeof useCommonAdminImageOptions>) {
  const widgetImageToDamImageUrl = (
    image: ImageAware | ImageCreateUpdateAware,
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
