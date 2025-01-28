<script setup lang="ts">
import { computed } from 'vue'
import { useJobPriority } from '@/components/job/composables/jobPriority'
import AChipNoLink from '@/components/AChipNoLink.vue'

const props = defineProps<{
  priority: number
}>()
const { getPriorityLabel, getPriorityColor } = useJobPriority()
const priorityColor = computed(() => {
  return getPriorityColor(props.priority)
})
const priorityLabel = computed(() => {
  return getPriorityLabel(props.priority)
})
</script>

<template>
  <AChipNoLink :color="priorityColor">
    {{ priorityLabel }}
  </AChipNoLink>
</template>
