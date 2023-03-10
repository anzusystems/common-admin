<script lang="ts" setup>
import { ref } from 'vue'
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'
import AFilterAdvancedButton from '@/components/buttons/filter/AFilterAdvancedButton.vue'

withDefaults(
  defineProps<{
    enableAdvanced?: boolean
    enableTop?: boolean
    hideButtons?: boolean
  }>(),
  {
    enableAdvanced: false,
    enableTop: false,
    hideButtons: false,
  }
)
const emit = defineEmits<{
  (e: 'resetFilter'): void
}>()

const resetFilter = () => {
  emit('resetFilter')
}

const advancedFilter = ref(false)

const toggleAdvancedFilter = () => {
  advancedFilter.value = !advancedFilter.value
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
  <VRow dense>
    <VCol
      v-if="enableAdvanced"
      class="v-col-filters--show-hide"
      cols="auto"
    >
      <AFilterAdvancedButton
        :button-active="advancedFilter"
        @advanced-filter="toggleAdvancedFilter"
      />
    </VCol>
    <VCol class="">
      <slot name="default" />
      <VExpandTransition v-if="enableAdvanced">
        <div v-show="advancedFilter">
          <slot name="advanced" />
        </div>
      </VExpandTransition>
    </VCol>
    <VCol
      v-if="!hideButtons"
      class="v-col-filters--buttons text-right"
      cols="auto"
    >
      <slot name="buttons">
        <AFilterSubmitButton />
        <AFilterResetButton @reset="resetFilter" />
      </slot>
    </VCol>
  </VRow>
</template>
