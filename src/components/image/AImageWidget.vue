<script lang="ts" setup>
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { IntegerIdNullable } from '@/types/common'
import type { ImageWidgetImage } from '@/types/ImageWidgetImage'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'

/**
 * For accept and maxSizes check docs {@see useFormatAndSizeCheck}
 */
const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    stackId: string
    label?: string | undefined
    image?: ImageWidgetImage | undefined // optional, if available, no need to fetch image data
    readonly?: boolean
    lockable?: boolean // todo
    lockedById?: undefined // todo
    dataCy?: string | undefined
    isEmbed?: boolean // todo check
    disableOnClickMenu?: boolean
    width?: number | undefined
    accept?: string | undefined
    maxSizes?: Record<string, number> | undefined
  }>(),
  {
    label: undefined,
    image: undefined,
    readonly: false,
    lockable: false,
    lockedById: undefined,
    dataCy: undefined,
    isEmbed: false,
    disableOnClickMenu: false,
    width: undefined,
    accept: undefined,
    maxSizes: undefined,
  }
)
</script>

<template>
  <div class="a-image-widget">
    <VImg
      :lazy-src="imagePlaceholderPath"
      :src="imagePlaceholderPath"
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
    <AImageDropzone
      variant="fill"
      transparent
      :accept="accept"
      :max-sizes="maxSizes"
    />
  </div>
</template>

<style lang="scss">
.a-image-widget {
  position: relative;
}
</style>
