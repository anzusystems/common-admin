<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    value: number | string | boolean
    chip?: boolean
    invertColor?: boolean
  }>(),
  {
    chip: false,
    invertColor: false
  }
)

const booleanValue = computed(() => {
  return props.value === true || props.value === 1 || props.value === 'true'
})

const text = computed(() => {
  if (booleanValue.value) {
    return t('common.boolean.true')
  }
  return t('common.boolean.false')
})

const color = computed(() => {
  if (props.invertColor) {
    return booleanValue.value ? 'error' : 'success'
  }
  return booleanValue.value ? 'success' : 'error'
})
</script>

<template>
  <VChip v-if="chip" :color="color" label size="small">{{ text }}</VChip>
  <span v-else>{{ text }}</span>
</template>
