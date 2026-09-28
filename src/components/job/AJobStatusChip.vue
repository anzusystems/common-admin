<script lang="ts" setup>
import { computed } from 'vue'
import { type JobStatusType, useJobStatus } from '@/model/valueObject/JobStatus'

const props = defineProps<{
  value: JobStatusType
}>()

const { getJobStatusOption } = useJobStatus()
const option = computed(() => getJobStatusOption(props.value))
</script>

<template>
  <VChip
    :color="option?.color"
    label
    size="small"
  >
    {{ option?.title }}
  </VChip>
</template>
