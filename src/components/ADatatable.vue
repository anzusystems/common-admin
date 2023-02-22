<script lang="ts" setup>
import { computed, inject } from 'vue'
import type { UseTableColumns } from '@/composables/system/tableColumns'
import ADatatableColumn from '@/components/ADatatableColumn.vue'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { normalizeForSlotName } from '@/utils/string'
import { isEmpty } from '@/utils/common'
import { useI18n } from '@/plugins/translate'

const props = withDefaults(
  defineProps<{
    data: any
    columns: UseTableColumns
    actions?: boolean
  }>(),
  {
    actions: true,
  }
)

const availableColumns = computed(() => {
  return props.columns.availableColumns.value
})

const emit = defineEmits<{
  (e: 'rowClick', data: any): void
}>()

const onRowClick = (data: any) => {
  emit('rowClick', data)
}

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const isNotEmpty = computed(() => {
  return !isEmpty(props.data)
})

const totalColumnsCount = computed(() => {
  let count = props.columns.availableColumns.value.length
  if (props.actions) ++count
  return count
})

const { t } = useI18n()
</script>

<template>
  <VTable class="anzu-data-table">
    <thead>
      <tr>
        <th v-for="column in availableColumns" :key="column.name" class="text-left">
          {{ column.getLabel ? column.getLabel(system, subject) : '' }}
        </th>
        <th v-if="actions" />
      </tr>
    </thead>
    <tbody>
      <template v-if="isNotEmpty">
        <tr v-for="(rowData, index) in props.data" :key="index" @click="onRowClick(rowData)">
          <ADatatableColumn v-for="column in availableColumns" :key="column.name" :row-data="rowData" :column="column">
            <template #[normalizeForSlotName(column.name)]="{ data: slotData }">
              <slot :name="normalizeForSlotName(column.name)" :data="slotData" :row-data="rowData" />
            </template>
          </ADatatableColumn>
          <td v-if="actions">
            <div class="d-flex justify-end">
              <slot name="actions" :data="rowData" />
            </div>
          </td>
        </tr>
      </template>
      <template v-else>
        <tr>
          <td :colspan="totalColumnsCount" class="text-center text-disabled">{{ t('common.datatable.noDataText') }}</td>
        </tr>
      </template>
    </tbody>
  </VTable>
</template>
