<script lang="ts" setup>
import { computed } from 'vue'
import { dateTimePretty } from '@/shared/utils/datetime'
import type { DatetimeUTCNullable } from '@/shared/types/common'

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
  return dateTimePretty(props.dateTime, props.edgeDateValue)
})
</script>

<template>
  {{ pretty }}
</template>
