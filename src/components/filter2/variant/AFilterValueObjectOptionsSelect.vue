<script lang="ts" setup>
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import { computed, inject, unref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys.ts'
import { isArray, isDefined, isUndefined } from '@/utils/common.ts'
import { useFilterHelpers } from '@/composables/filter/filterFactory.ts'

const props = withDefaults(
  defineProps<{
    name: string
    items?: ValueObjectOption<string | number>[] | undefined
  }>(),
  {
    items: undefined,
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const submitResetCounter = inject(FilterSubmitResetCounterKey)
const touched = inject(FilterTouchedKey)
const filterSelected = inject(FilterSelectedKey)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)

if (
  isUndefined(submitResetCounter) ||
  isUndefined(touched) ||
  isUndefined(filterSelected) ||
  isUndefined(filterConfig) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.name]) ||
  isUndefined(filterData) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.name])
) {
  throw new Error('Incorrect provide/inject config.')
}

const modelValue = computed({
  get() {
    return filterData[props.name]
  },
  set(newValue) {
    filterData[props.name] = newValue
    touched.value = true
    emit('change')
  },
})

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const itemsComputed = computed(() => {
  if (isDefined(props.items)) return props.items
  const fromConfig = unref(filterConfigCurrent.value?.items)
  if (isDefined(fromConfig)) return fromConfig
  return []
})

const { t } = useI18n()

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
}

const updateSelected = () => {
  if (isArray(modelValue.value) && modelValue.value.length === 0) return
  if (isArray(modelValue.value)) {
    filterSelected.value.set(
      props.name,
      modelValue.value.map((modelItemValue) => {
        const found = itemsComputed.value.find((item) => item.value === modelItemValue)
        if (found) return { title: found.title, value: found.value }
        return { title: modelItemValue as string, value: modelItemValue as string }
      })
    )
    return
  }
  const found = itemsComputed.value.find((item) => item.value === modelValue.value)
  if (found) {
    filterSelected.value.set(props.name, [{ title: found.title as string, value: found.value as string }])
  }
}

watch(submitResetCounter, () => {
  updateSelected()
})
</script>

<template>
  <VAutocomplete
    v-model="modelValue"
    :items="itemsComputed"
    :chips="filterConfigCurrent.multiple"
    :label="label"
    :multiple="filterConfigCurrent.multiple"
    :clearable="!filterConfigCurrent.mandatory"
    data-cy="filter-value"
    hide-details
    @click:clear.stop="clearField"
  />
</template>
