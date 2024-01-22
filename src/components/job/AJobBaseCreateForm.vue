<script setup lang="ts">

import { computed } from 'vue'
import type { JobBase } from '@/types/Job'
import { useJobPriority } from '@/components/job/composables/jobPriority'
import ARow from '@/components/ARow.vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'

const props = defineProps<{
  modelValue: JobBase
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', data: JobBase): void
}>()
const job = computed({
  get() {
    return props.modelValue
  },
  set(newValue: JobBase) {
    emit('update:modelValue', newValue)
  },
})
const { priorityLabels, getPriorityColor } = useJobPriority()
const sliderColor = computed(() => {
  return getPriorityColor(job.value.priority)
})
</script>

<template>
  <ARow>
    <AFormDatetimePicker
      v-model="job.scheduledAt"
      label="tScheduledAt"
    />
  </ARow>
  <ARow>
    <VSlider
      v-model="job.priority"
      :ticks="priorityLabels"
      :max="2"
      step="1"
      show-ticks="always"
      tick-size="3"
      :color="sliderColor"
    />
  </ARow>
</template>
