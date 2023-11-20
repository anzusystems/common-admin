<script lang="ts" setup>
import { ref, toRefs, watch } from 'vue'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import type { ImageAware } from '@/types/ImageAware'
import { cloneDeep } from '@/utils/common'
import { useImageOptions } from '@/components/image/composables/imageOptions'
import { useImageActions } from '@/components/image/composables/imageActions'
import type { IntegerIdNullable } from '@/types/common'
import { useAlerts } from '@/composables/system/alerts'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    image?: ImageAware | undefined // optional, if available, no need to fetch image data
    configName?: string
    label?: string | undefined
    width?: number | undefined
    disableAspectRatio?: boolean
  }>(),
  {
    configName: 'default',
    label: undefined,
    image: undefined,
    width: undefined,
    disableAspectRatio: false,
  }
)

const { showErrorsDefault } = useAlerts()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useImageOptions(props.configName)
const { fetchImageWidgetData } = imageOptions
const { widgetImageToDamImageUrl } = useImageActions(imageOptions)

const resImage = ref<null | ImageAware>(null)

const { image, modelValue } = toRefs(props)

const resolvedSrc = ref('')

watch(
  [image, modelValue],
  async ([newImage, newImageId]) => {
    resImage.value = null
    resolvedSrc.value = imagePlaceholderPath
    if (newImage) {
      resImage.value = cloneDeep(newImage)
      if (resImage.value) {
        resolvedSrc.value = widgetImageToDamImageUrl(resImage.value)
      }
      return
    }
    if (newImageId) {
      try {
        resImage.value = await fetchImageWidgetData(newImageId)
      } catch (error) {
        showErrorsDefault(error)
      }
      if (resImage.value) {
        resolvedSrc.value = widgetImageToDamImageUrl(resImage.value)
      }
      return
    }
    return
  },
  { immediate: true }
)
</script>

<template>
  <h4
    v-if="label"
    class="font-weight-bold text-subtitle-2"
  >
    {{ label }}
  </h4>
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
