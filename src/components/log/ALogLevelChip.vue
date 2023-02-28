<script lang="ts" setup>
import { computed } from 'vue'
import { type LogLevel, useLogLevel } from '@/model/valueObject/LogLevel'

const props = withDefaults(
  defineProps<{
    level: LogLevel
  }>(),
  {}
)

const { getLogLevelOption } = useLogLevel()
const levelOption = computed(() => {
  return getLogLevelOption(props.level)
})
</script>

<template>
  <VChip v-if="levelOption" :color="levelOption.color" label size="small">
    {{ levelOption.title }}
  </VChip>
</template>
