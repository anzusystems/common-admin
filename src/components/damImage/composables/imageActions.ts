import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import type { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import type { DocId } from '@/types/common'

export function useImageActions(config: ReturnType<typeof useCommonAdminImageOptions>) {
  const widgetImageToDamImageUrl = (
    image: ImageAware | ImageCreateUpdateAware,
    width = config.imageWidth,
    height = config.imageHeight,
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
      '.jpg'
    )
  }

  const widgetImageToDamImageOriginalUrl = (image: ImageAware | ImageCreateUpdateAware) => {
    return (
      config.previewDomain + '/image/original/' + image.dam.damId + '.jpg'
    )
  }

  const damImageIdToDamImageUrl = (
    imageId: DocId,
    width = config.imageWidth,
    height = config.imageHeight
  ) => {
    return (
      config.previewDomain +
      '/image/w' +
      width +
      '-h' +
      height +
      '/' +
      imageId +
      '.jpg'
    )
  }

  const damImageIdToDamImageOriginalUrl = (imageId: DocId) => {
    return config.previewDomain + '/image/original/' + imageId + '.jpg'
  }

  return {
    widgetImageToDamImageUrl,
    widgetImageToDamImageOriginalUrl,
    damImageIdToDamImageUrl,
    damImageIdToDamImageOriginalUrl,
  }
}
