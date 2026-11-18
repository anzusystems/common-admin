<script lang="ts" setup>
import { computed } from 'vue'
import AChipNoLink from '@/domains/ui/components/AChipNoLink.vue'
import { type LogLevelType, useLogLevel } from '@/domains/log/valueObject/LogLevel'

const props = withDefaults(
  defineProps<{
    level: LogLevelType
  }>(),
  {}
)

const { getLogLevelOption } = useLogLevel()
const levelOption = computed(() => {
  return getLogLevelOption(props.level)
})
</script>

<template>
  <AChipNoLink
    v-if="levelOption"
    :color="levelOption.color"
  >
    {{ levelOption.title }}
  </AChipNoLink>
</template>
