<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { Filter } from '@/types/Filter.ts'
import { isNull, isUndefined } from '@/utils/common.ts'

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    dataCy?: string
    allT?: string
    trueT?: string
    falseT?: string
  }>(),
  {
    dataCy: 'filter-boolean',
    allT: 'common.model.all',
    trueT: 'common.model.boolean.true',
    falseT: 'common.model.boolean.false',
  }
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
    { value: -1, title: t(props.allT) },
    { value: 1, title: t(props.trueT) },
    { value: 0, title: t(props.falseT) },
  ]
})
</script>

<template>
  <VSelect
    v-model="value"
    :data-cy="dataCy"
    :label="label"
    :items="items"
  />
</template>
