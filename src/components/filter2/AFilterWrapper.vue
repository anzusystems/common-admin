<script lang="ts" setup>
import AFilterAdvancedButton from '@/components/buttons/filter/AFilterAdvancedButton.vue'
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'
import { provide, ref } from 'vue'
import { FilterSelectedKey, FilterSubmitResetCounterKey } from '@/components/filter2/filterInjectionKeys.ts'
import FiltersSelected from '@/components/filter2/FiltersSelected.vue'
import type { ValueObjectOption } from '@/types/ValueObject.ts'

withDefaults(
  defineProps<{
    enableTop?: boolean
    hideButtons?: boolean
    touched?: boolean
  }>(),
  {
    enableTop: false,
    hideButtons: false,
    touched: true,
  }
)
const emit = defineEmits<{
  (e: 'submitFilter'): void
  (e: 'resetFilter'): void
}>()

const showDetail = defineModel<boolean>('showDetail', { default: false, required: false })

const submitResetCounter = ref(0)
provide(FilterSubmitResetCounterKey, submitResetCounter)
const selectedFilters = ref<Map<string, ValueObjectOption<string | number>[]>>(new Map())
provide(FilterSelectedKey, selectedFilters)

const submitFilter = () => {
  emit('submitFilter')
  submitResetCounter.value++
}

const resetFilter = () => {
  emit('resetFilter')
  submitResetCounter.value++
}

const toggleFilterDetail = () => {
  showDetail.value = !showDetail.value
}
</script>

<template>
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
        class="a-filter-advanced__content"
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
        <AFilterSubmitButton
          :touched="touched"
          @click="submitFilter"
        />
        <AFilterResetButton @reset="resetFilter" />
      </slot>
    </VCol>
  </VRow>
</template>
