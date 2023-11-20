import type { ImageAware } from '@/types/ImageAware'
import type { useImageOptions } from '@/components/image/composables/imageOptions'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import { createImage } from '@/components/image/composables/imageApi'
import type { IntegerId } from '@/types/common'
import { isNull } from '@/utils/common'

export function useImageActions(config: ReturnType<typeof useImageOptions>) {
  const widgetImageToDamImageUrl = (
    image: ImageAware,
    width = config.imageWidth,
    height = config.imageHeight,
    random = true
  ) => {
    return (
      config.imageUrl +
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

export function useImageWriteActions(config: ReturnType<typeof useImageOptions>) {
  const actionDelete = (id: IntegerId | null) => {
    if (isNull(id)) return
    // todo
  }

  return {
    actionDelete,
  }
}
