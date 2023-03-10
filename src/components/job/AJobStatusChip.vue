<script lang="ts" setup>
import { computed } from 'vue'
import { JobStatus, useJobStatus } from '@/model/valueObject/JobStatus'

const props = defineProps<{
  value: JobStatus
}>()

const { getJobStatusOption } = useJobStatus()
const option = computed(() => getJobStatusOption(props.value))
</script>

<template>
  <VChip
    :color="option.color"
    label
    size="small"
  >
    {{ option.title }}
  </VChip>
</template>
