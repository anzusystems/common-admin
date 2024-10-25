<script lang="ts" setup>
import AFilterAdvancedButton from '@/components/buttons/filter/AFilterAdvancedButton.vue'
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'

withDefaults(
  defineProps<{
    enableAdvanced?: boolean
    enableTop?: boolean
    hideButtons?: boolean
    touched?: boolean
  }>(),
  {
    enableAdvanced: false,
    enableTop: false,
    hideButtons: false,
    touched: true,
  }
)
const emit = defineEmits<{
  (e: 'resetFilter'): void
}>()

const advanced = defineModel<boolean>('advanced', { default: false, required: false })

const resetFilter = () => {
  emit('resetFilter')
}

const toggleAdvancedFilter = () => {
  advanced.value = !advanced.value
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
    :class="{ 'a-filter-advanced--active': advanced }"
  >
    <VCol
      v-if="enableAdvanced"
      class="v-col-filters--show-hide"
      cols="auto"
    >
      <AFilterAdvancedButton
        :button-active="advanced"
        @advanced-filter="toggleAdvancedFilter"
      />
    </VCol>
    <VCol class="">
      <slot name="default" />
      <div
        v-show="advanced"
        class="a-filter-advanced__content"
      >
        <slot name="advanced" />
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
</template>
