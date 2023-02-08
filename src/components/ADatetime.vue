<script lang="ts" setup>
import { computed } from 'vue'
import { prettyDateTime } from '@/utils/datetime'
import { DatetimeUTCNullable } from '@/types/common'

const props = withDefaults(
  defineProps<{
    dateTime: DatetimeUTCNullable
    edgeDateValue?: string
  }>(),
  {
    edgeDateValue: 'n/a',
  }
)

const pretty = computed(() => {
  return prettyDateTime(props.dateTime, props.edgeDateValue)
})
</script>

<template>
  {{ pretty }}
</template>
