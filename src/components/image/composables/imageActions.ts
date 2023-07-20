import type { ImageWidgetImage } from '@/types/ImageWidgetImage'
import type { useImageOptions } from '@/components/image/composables/imageOptions'

export function useImageActions(config: ReturnType<typeof useImageOptions>) {
  const widgetImageToDamImageUrl = (
    image: ImageWidgetImage,
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

  // const imageAspectRatioComputed = computed(() => {
  //   if (props.disableAspectRatio) {
  //     return undefined
  //   }
  //   return DAM_IMAGE_ASPECT_RATIO
  // })

  return {
    widgetImageToDamImageUrl,
  }
}
