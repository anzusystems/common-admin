<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value?: boolean
    disabled?: boolean
    size?: string
  }>(),
  {
    value: false,
    disabled: false,
    size: 'default',
  }
)
const emit = defineEmits<{
  (e: 'onClick', data: boolean): void
}>()

const onClick = () => {
  emit('onClick', props.value)
}

const icon = computed(() => {
  return props.value ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'
})
</script>

<template>
  <VBtn
    icon
    :disabled="disabled"
    :size="size"
    @click.stop="onClick"
  >
    <VIcon :icon="icon" />
  </VBtn>
</template>
