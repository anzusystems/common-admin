<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys.ts'
import { isString, isUndefined } from '@/utils/common.ts'
import { useI18n } from 'vue-i18n'
import { useFilterHelpers } from '@/composables/filter/filterFactory.ts'

const props = withDefaults(
  defineProps<{
    nameFrom: string
    nameUntil: string
    placeholder?: string | undefined
    dataCy?: string
  }>(),
  {
    placeholder: undefined,
    dataCy: 'filter-time-interval',
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
  isUndefined(filterConfig.fields[props.nameFrom]) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.nameUntil]) ||
  isUndefined(filterData) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.nameFrom]) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.nameUntil])
) {
  throw new Error('Incorrect provide/inject config.')
}

const model = ref(null)

const modelValue = computed({
  get() {
    return filterData[props.nameFrom]
  },
  set(newValue) {
    filterData[props.nameFrom] = newValue
    touched.value = true
    emit('change')
  },
})

const filterConfigCurrent = computed(() => filterConfig.fields[props.nameFrom])

const { t } = useI18n()

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterHelpers()

const clearField = () => {
  clearOne(props.nameFrom, filterData, filterConfig)
  filterSelected.value.delete(props.nameFrom)
}

const updateSelected = () => {
  if (!isString(modelValue.value) || (isString(modelValue.value) && modelValue.value.length === 0)) return
  filterSelected.value.set(props.nameFrom, [{ title: modelValue.value, value: modelValue.value }])
}

watch(submitResetCounter, () => {
  updateSelected()
})
</script>

<template>
  <VSelect
    v-model="model"
    item-title="title"
    item-value="value"
    :label="label"
    clearable
    no-filter
    :data-cy="dataCy"
    :items="[
      { title: 'From', value: 'from' },
      { title: 'Until', value: 'until' },
    ]"
  />
</template>
