<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import type { ImageAware } from '@/types/ImageAware'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[]
    images?: ImageAware[]
    configName?: string
    label?: string | undefined
    width?: number | undefined
    disableAspectRatio?: boolean
    aspectRatio?: number | string
    showDescription?: boolean
    showSource?: boolean
  }>(),
  {
    images: () => [],
    configName: 'default',
    label: undefined,
    image: undefined,
    width: undefined,
    disableAspectRatio: false,
    aspectRatio: 1.777, // 16/9
    showDescription: false,
    showSource: false,
  }
)
</script>

<template>
  <div />
</template>
