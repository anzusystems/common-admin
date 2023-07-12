<script lang="ts" setup>
import AImageDropzone from '@/components/image/AImageDropzone.vue'
import type { IntegerIdNullable } from '@/types/common'
import type { ImageWidgetImage } from '@/types/ImageWidgetImage'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    stackId: string
    label?: string | undefined
    image?: ImageWidgetImage | undefined // optional, if available, no need to fetch image data
    uploadPriority?: number
    readonly?: boolean
    lockable?: boolean // todo
    lockedById?: undefined // todo
    dataCy?: string | undefined
    isEmbed?: boolean // todo check
    disableOnClickMenu?: boolean
  }>(),
  {
    label: undefined,
    image: undefined,
    uploadPriority: 0,
    readonly: false,
    lockable: false,
    lockedById: undefined,
    dataCy: undefined,
    isEmbed: false,
    disableOnClickMenu: false,
  }
)
</script>

<template>
  <div class="a-image">
    <AImageDropzone />
  </div>
</template>

<style lang="scss"></style>
