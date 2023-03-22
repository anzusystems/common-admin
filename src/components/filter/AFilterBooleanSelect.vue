<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { Filter } from '@/types/Filter'
import { isNull, isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    modelValue: Filter
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
}>()

const value = computed({
  get() {
    if (isUndefined(props.modelValue.model) || isNull(props.modelValue.model)) return -1
    return props.modelValue.model ? 1 : 0
  },
  set(newValue) {
    let returnValue: null | boolean = null
    if (newValue === 1) returnValue = true
    if (newValue === 0) returnValue = false
    emit('update:modelValue', { ...props.modelValue, ...{ model: returnValue } })
  },
})

const { t } = useI18n()

const label = computed(() => {
  return props.modelValue.titleT ? t(props.modelValue.titleT) : undefined
})

const items = computed(() => {
  return [
    { value: -1, title: t('common.model.notSelected') },
    { value: 1, title: t('common.model.boolean.true') },
    { value: 0, title: t('common.model.boolean.false') },
  ]
})
</script>

<template>
  <VSelect
    v-model="value"
    :label="label"
    :items="items"
  />
</template>
