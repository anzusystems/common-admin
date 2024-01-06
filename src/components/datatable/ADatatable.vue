<script lang="ts" setup generic="TItem = Record<string, unknown>">
import { computed } from 'vue'
import { isEmpty } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { datatableSlotName } from '@/composables/system/datatableColumns'
import ADatatableColumn from '@/components/datatable/ADatatableColumn.vue'

const props = withDefaults(
  defineProps<{
    items: TItem[]
    columns: any
    itemKey?: string
  }>(),
  {
    itemKey: 'id',
  }
)

const emit = defineEmits<{
  (e: 'click:row', data: any): void
}>()

const onRowClick = (event: unknown, item: unknown) => {
  emit('click:row', { event, item })
}

const isNotEmpty = computed(() => {
  return !isEmpty(props.items)
})

const totalColumnsCount = computed(() => {
  return props.columns.length
})

const { t } = useI18n()
</script>

<template>
  <VTable class="a-datatable">
    <thead>
      <tr>
        <th
          v-for="column in columns"
          :key="column.key"
          class="text-left"
        >
          {{ column.title }}
        </th>
      </tr>
    </thead>
    <tbody>
      <template v-if="isNotEmpty">
        <tr
          v-for="item in props.items"
          :key="(item as any)[itemKey]"
          @click="onRowClick($event, item)"
        >
          <ADatatableColumn
            v-for="column in columns"
            :key="column.key"
            :item="item"
            :column="column"
          >
            <template #[datatableSlotName(column.key)]="{ item: slotItem }">
              <slot
                :name="datatableSlotName(column.key)"
                :item="slotItem"
              />
            </template>
          </ADatatableColumn>
        </tr>
      </template>
      <template v-else>
        <tr>
          <td
            :colspan="totalColumnsCount"
            class="text-center text-disabled"
          >
            {{ t('common.system.datatable.noDataText') }}
          </td>
        </tr>
      </template>
    </tbody>
  </VTable>
  <slot name="bottom" />
</template>
