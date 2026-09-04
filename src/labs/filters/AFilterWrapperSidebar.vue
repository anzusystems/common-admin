<script lang="ts" setup>
import { inject, provide, ref } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isUndefined } from '@/utils/common'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'

withDefaults(
  defineProps<{
    formName?: string
  }>(),
  {
    formName: 'search',
  },
)
const emit = defineEmits<{
  (e: 'submit'): void
}>()

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}

provide(FilterSubmitResetCounterKey, ref(0))
const filterSelected = ref<Map<string, ValueObjectOption<string | number>[]>>(new Map())
provide(FilterSelectedKey, filterSelected)

const { clearAll, clearAllFilterSelected } = useFilterClearHelpers()

const submitFilter = () => {
  emit('submit')
}

// AFilterWrapperSidebar has no reset button of its own (the consumer renders it, e.g. in the drawer
// footer). Expose the same reset AFilterWrapper does so that button also clears the filter values and
// the selected-filter chips.
const resetFilter = () => {
  clearAll(filterData, filterConfig)
  clearAllFilterSelected(filterData, filterConfig, filterSelected)
}

defineExpose({ resetFilter })
</script>

<template>
  <VForm
    :name="formName"
    @submit.prevent="submitFilter"
    @keyup.enter="submitFilter"
  >
    <slot />
  </VForm>
</template>
