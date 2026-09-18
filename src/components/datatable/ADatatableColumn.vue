<script lang="ts" setup>
import { objectGetValueByPath } from '@/utils/object'
import { computed } from 'vue'
import ABooleanValue from '@/components/ABooleanValue.vue'
import { datatableSlotName } from '@/components/datatable/datatable'

const props = withDefaults(
  defineProps<{
    item: any
    column: any
  }>(),
  {}
)

const value = computed(() => {
  return objectGetValueByPath(props.item, props.column.key)
})

const isBoolean = computed(() => typeof value.value === 'boolean')
</script>

<template>
  <td>
    <slot
      :name="datatableSlotName(column.key)"
      :item="item"
    >
      <ABooleanValue
        v-if="isBoolean"
        chip
        :value="value"
      />
      <template v-else>
        {{ value }}
      </template>
    </slot>
  </td>
</template>
