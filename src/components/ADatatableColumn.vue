<script lang="ts" setup>
import { getValueByPath } from '@/utils/object'
import { computed } from 'vue'
import type { DatatableColumnConfig } from '@/composables/system/datatableColumns'
import { DATETIME_AUTO_FORMAT_COLUMN_NAMES } from '@/composables/system/datatableColumns'
import ABooleanValue from '@/components/ABooleanValue.vue'
import { normalizeForSlotName } from '@/utils/string'
import { friendlyDateTime } from '@/utils/datetime'

const props = withDefaults(
  defineProps<{
    rowData: any
    column: DatatableColumnConfig
  }>(),
  {}
)

const value = computed(() => {
  return getValueByPath(props.rowData, props.column.name)
})

const formattedValue = computed(() => {
  if (props.column.type === 'datetime' || DATETIME_AUTO_FORMAT_COLUMN_NAMES.includes(props.column.name))
    return friendlyDateTime(value.value)
  return value.value
})

const isBoolean = computed(() => typeof value.value === 'boolean')
</script>

<template>
  <td>
    <slot :name="normalizeForSlotName(column.name)" :data="value">
      <ABooleanValue v-if="isBoolean" chip :value="value" />
      <span v-else>{{ formattedValue }}</span>
    </slot>
  </td>
</template>
