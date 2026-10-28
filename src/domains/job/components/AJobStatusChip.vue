<script lang="ts" setup>
import { computed } from 'vue'
import { type JobStatusType, useJobStatus } from '@/domains/job/valueObject/JobStatus'

const props = defineProps<{
  value: JobStatusType
}>()

const { getJobStatusOption } = useJobStatus()
const option = computed(() => getJobStatusOption(props.value))
</script>

<template>
  <VChip
    :color="option?.color"
    close-label="common.button.remove"
    label
    size="small"
  >
    {{ option?.title }}
  </VChip>
</template>
