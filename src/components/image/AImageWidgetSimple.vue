<script lang="ts" setup>
import { ref, toRefs, watch } from 'vue'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import type { ImageWidgetImage } from '@/types/ImageWidgetImage'
import { cloneDeep } from '@/utils/common'
import { useImageOptions } from '@/components/image/composables/imageOptions'
import { useImageActions } from '@/components/image/composables/imageActions'

const props = withDefaults(
  defineProps<{
    configName?: string
    image?: ImageWidgetImage | null
    imageId?: number | null
    width?: number | undefined
    disableAspectRatio?: boolean
  }>(),
  {
    configName: 'default',
    image: null,
    imageId: null,
    width: undefined,
    disableAspectRatio: false,
  }
)

const imageOptions = useImageOptions(props.configName)
const { fetchImageWidgetData } = imageOptions
const { widgetImageToDamImageUrl } = useImageActions(imageOptions)

const resImage = ref<null | ImageWidgetImage>(null)

const { image, imageId } = toRefs(props)

const resolvedSrc = ref('')

watch(
  [image, imageId],
  async ([newImage, newImageId]) => {
    resImage.value = null
    resolvedSrc.value = imagePlaceholderPath
    if (newImage) {
      resImage.value = cloneDeep(newImage)
      resolvedSrc.value = widgetImageToDamImageUrl(newImage)
      return
    }
    if (newImageId) {
      resImage.value = await fetchImageWidgetData(newImageId)
      resolvedSrc.value = widgetImageToDamImageUrl(resImage.value)
      return
    }
    return
  },
  { immediate: true }
)
</script>

<template>
  <slot
    name="prepend"
    :image="resImage"
  />
  <VImg
    :lazy-src="imagePlaceholderPath"
    :src="resolvedSrc"
    :width="width"
    cover
    max-width="100%"
    class="disable-radius"
  >
    <template #placeholder>
      <div class="d-flex align-center justify-center h-100">
        <VProgressCircular
          indeterminate
          color="grey-lighten-4"
        />
      </div>
    </template>
  </VImg>
  <slot
    name="append"
    :image="resImage"
  />
</template>

<style lang="scss">
.v-img.disable-radius .v-img__img {
  border-radius: 0;
}
</style>
