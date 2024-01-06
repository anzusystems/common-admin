<script lang="ts" setup>
import { objectGetValueByPath } from '@/utils/object'
import { computed } from 'vue'
import ABooleanValue from '@/components/ABooleanValue.vue'
import { stringNormalizeForSlotName } from '@/utils/string'
import { dateTimeFriendly } from '@/utils/datetime'
import { type DatatableColumnConfig, DATETIME_AUTO_FORMAT_COLUMN_NAMES } from '@/components/datatable/datatable'

const props = withDefaults(
  defineProps<{
    rowData: any
    column: DatatableColumnConfig
  }>(),
  {}
)

const value = computed(() => {
  return objectGetValueByPath(props.rowData, props.column.name)
})

const formattedValue = computed(() => {
  if (props.column.type === 'datetime' || DATETIME_AUTO_FORMAT_COLUMN_NAMES.includes(props.column.name))
    return dateTimeFriendly(value.value)
  return value.value
})

const isBoolean = computed(() => typeof value.value === 'boolean')
</script>

<template>
  <td>
    <slot
      :name="stringNormalizeForSlotName(column.name)"
      :data="value"
    >
      <ABooleanValue
        v-if="isBoolean"
        chip
        :value="value"
      />
      <span v-else>{{ formattedValue }}</span>
    </slot>
  </td>
</template>
