<script lang="ts" setup>
import { usePollSelectStore } from '@/playground/subjectSelectView/pollSelectStore'
import AFilterString from '@/components/filter/AFilterString.vue'

withDefaults(
  defineProps<{
    touched: boolean
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'submitFilter'): void
  (e: 'update:touched', data: boolean): void
}>()

const { filter } = usePollSelectStore()

const submitFilter = () => {
  emit('update:touched', false)
  emit('submitFilter')
}

const onAnyFilterUpdate = () => {
  emit('update:touched', true)
}
</script>

<template>
  <VRow>
    <VCol :cols="12">
      <AFilterString
        v-model="filter.title"
        @update:model-value="onAnyFilterUpdate"
        @keydown.enter="submitFilter"
      />
    </VCol>
  </VRow>
</template>
