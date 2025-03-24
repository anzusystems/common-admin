<script lang="ts" setup>
import AFilterAdvancedButton from '@/components/buttons/filter/AFilterAdvancedButton.vue'
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'
import { inject, provide, ref } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey, FilterSelectedFutureKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys'
import FiltersSelected from '@/components/filter2/FiltersSelected.vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isUndefined } from '@/utils/common'
import { useFilterHelpers } from '@/composables/filter/filterFactory'

withDefaults(
  defineProps<{
    enableTop?: boolean
    hideButtons?: boolean
    formName?: string
  }>(),
  {
    enableTop: false,
    hideButtons: false,
    formName: 'search',
  }
)
const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()

const showDetail = defineModel<boolean>('showDetail', { default: false, required: false })
const touched = defineModel<boolean>('touched', { default: false, required: false })
provide(FilterTouchedKey, touched)

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}

const submitResetCounter = ref(0)
provide(FilterSubmitResetCounterKey, submitResetCounter)
const filterSelected = ref<Map<string, ValueObjectOption<string | number>[]>>(new Map())
provide(FilterSelectedKey, filterSelected)
const filterSelectedFuture = ref<Map<string, ValueObjectOption<string | number>[]>>(new Map())
provide(FilterSelectedFutureKey, filterSelectedFuture)

const submitFilter = () => {
  touched.value = false
  submitResetCounter.value++
  emit('submit')
}

const { clearAll } = useFilterHelpers()

const resetFilter = () => {
  touched.value = false
  clearAll(filterData, filterConfig)
  filterSelected.value.clear()
  filterSelectedFuture.value.clear()
  submitResetCounter.value++
  emit('reset')
}

const toggleFilterDetail = () => {
  showDetail.value = !showDetail.value
}
</script>

<template>
  <VForm
    :name="formName"
    @submit.prevent="submitFilter"
  >
    <VRow
      v-if="enableTop"
      dense
    >
      <VCol class="">
        <slot name="top" />
      </VCol>
    </VRow>
    <VRow
      dense
      class="a-filter-advanced"
      :class="{ 'a-filter-advanced--active': showDetail }"
    >
      <VCol
        class="v-col-filters--show-hide"
        cols="auto"
      >
        <AFilterAdvancedButton
          :button-active="showDetail"
          @advanced-filter="toggleFilterDetail"
        />
      </VCol>
      <VCol class="">
        <VRow align="start">
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <slot name="search" />
          </VCol>
          <VCol
            cols="auto"
            class="flex-grow-1"
          >
            <FiltersSelected />
          </VCol>
        </VRow>
        <div
          v-show="showDetail"
          class="a-filter-advanced__content mt-4"
        >
          <slot name="detail" />
        </div>
      </VCol>
      <VCol
        v-if="!hideButtons"
        class="v-col-filters--buttons text-right"
        cols="auto"
      >
        <slot name="buttons">
          <AFilterSubmitButton :touched="touched" />
          <AFilterResetButton @reset="resetFilter" />
        </slot>
      </VCol>
    </VRow>
  </VForm>
</template>
