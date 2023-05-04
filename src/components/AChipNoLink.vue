<script lang="ts" setup>
import { computed } from 'vue'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    color?: string | undefined
    size?: string
    dataCy?: string | undefined
  }>(),
  {
    color: undefined,
    size: 'small',
    dataCy: undefined,
  }
)

const customColorClass = computed(() => {
  return isUndefined(props.color) ? 'a-chip-no-link--custom-color' : ''
})
</script>

<template>
  <VChip
    :color="color as string"
    :data-cy="dataCy"
    class="a-chip-no-link"
    :class="customColorClass"
    label
    :size="size as string"
  >
    <slot />
  </VChip>
</template>
