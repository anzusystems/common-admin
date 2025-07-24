<script lang="ts" setup>
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'
import { computed, inject, nextTick, provide, ref } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isUndefined } from '@/utils/common'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'
import { datatableSlotName } from '@/components/datatable/datatable'
import FilterDetailItem from '@/labs/filters/FilterDetailItem.vue'

withDefaults(
  defineProps<{
    hideButtons?: boolean
    formName?: string
  }>(),
  {
    hideButtons: false,
    formName: 'search',
  }
)
const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}
const submitResetCounter = ref(0)
provide(FilterSubmitResetCounterKey, submitResetCounter)
const filterSelected = ref<Map<string, ValueObjectOption<string | number>[]>>(new Map())
provide(FilterSelectedKey, filterSelected)

const submitFilter = () => {
  submitResetCounter.value++
  nextTick(() => {
    emit('submit')
  })
}

const { clearAll } = useFilterClearHelpers()

const resetFilter = () => {
  clearAll(filterData, filterConfig)
  filterSelected.value.clear()
  nextTick(() => {
    submitResetCounter.value++
    emit('reset')
  })
}

const touched = computed(() => {
  return filterConfig.touched
})

defineExpose({
  submit: submitFilter,
  reset: resetFilter,
})
</script>

<template>
  <VForm
    class="px-2 pt-4 d-flex flex-column h-100"
    :name="formName"
    @submit.prevent="submitFilter"
  >
    <div class="subject-select-filter__content">
      <slot name="detail">
        <VRow
          v-for="field in filterConfig.fields"
          :key="field.name"
        >
          <VCol :class="{ 'd-none': field.render.skip }">
            <slot
              :name="datatableSlotName(field.name)"
              :item-config="field"
            >
              <FilterDetailItem :name="field.name" />
            </slot>
          </VCol>
        </VRow>
      </slot>
    </div>
    <div class="subject-select-filter__actions">
      <VRow dense>
        <VCol
          v-if="!hideButtons"
          class="text-center w-100"
          cols="auto"
        >
          <slot name="buttons">
            <AFilterSubmitButton :touched="touched" />
            <AFilterResetButton @reset="resetFilter" />
          </slot>
        </VCol>
      </VRow>
    </div>
  </VForm>
</template>
