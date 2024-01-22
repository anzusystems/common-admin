<script setup lang="ts">
import { computed } from 'vue'
import type { JobBase } from '@/types/Job'
import { useJobPriority } from '@/components/job/composables/jobPriority'
import ARow from '@/components/ARow.vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import { useI18n } from 'vue-i18n'

const modelValue = defineModel<JobBase>({ required: true })
const { priorityLabels, getPriorityColor } = useJobPriority()
const sliderColor = computed(() => {
  return getPriorityColor(modelValue.value.priority)
})
const { t } = useI18n()
</script>

<template>
  <ARow>
    <AFormDatetimePicker
      v-model="modelValue.scheduledAt"
      :label="t('common.job.model.scheduledAt')"
    />
  </ARow>
  <ARow>
    <VSlider
      v-model="modelValue.priority"
      :ticks="priorityLabels"
      :max="2"
      step="1"
      show-ticks="always"
      tick-size="3"
      :color="sliderColor"
    />
  </ARow>
</template>
