<script lang="ts" setup>
import { inject, onMounted, onBeforeUnmount, provide, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import ACopyText from '@/domains/ui/components/ACopyText.vue'
import ADatatableConfigButton from '@/domains/filters/datatable/components/ADatatableConfigButton.vue'
import ADatetime from '@/domains/ui/datetime/components/ADatetime.vue'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import ADatatablePagination from '@/domains/filters/datatable/components/ADatatablePagination.vue'
import { createDatatableColumnsConfig } from '@/domains/filters/datatable/composables/createDatatableColumnsConfig'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import { useFilterHelpers } from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'
import { SORT_BY_ID } from '@/domains/filters/datatable/utils/datatableColumns'
import { useLogListActions } from '@/domains/log/composables/logActions'
import { LOG_ENTITY } from '@/domains/log/api/logApi'
import { LogType, type LogPaths, type LogTypeType } from '@/domains/log/composables/logType'
import type { Log } from '@/domains/log/types/Log'
import { isNull, isUndefined } from '@/shared/utils/common'
import { isDevelopment } from '@/shared/utils/development'

type DatatableItem = Log

const props = defineProps<{
  client: AxiosClientFn
  system: string
  type: LogTypeType
  logPaths: LogPaths
  /** Same mapper the view uses. Needed here so the actions cell stays a real link. */
  detailRoute: (log: Log) => RouteLocationRaw
}>()

const emit = defineEmits<{
  (e: 'rowClick', log: Log): void
}>()

// The spinner belongs to the card above this table, so the flag is owned there.
const loading = defineModel<boolean>('loading', { default: false })

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('[ALogDatatable] Incorrect provide/inject config.')
}

// Read once on purpose. Every one of these is fixed for the lifetime of this instance: the page
// remounts the whole view through a `:key` when the system or the type changes, precisely because
// `useApiFetchList` closes over its client and url, and reacting here could not undo that.
/* eslint-disable vue/no-setup-props-reactivity-loss */
const { t } = useI18n()
const { fetchList, listItems, datatableHiddenColumns, cancel } = useLogListActions({
  client: props.client,
  system: props.system,
  logPaths: props.logPaths,
  type: props.type,
  loading,
})

// Neither the url hash nor local storage: the filter is kept per view in memory by the registry
// in `logFilter`, and nothing about a log listing is worth persisting across a reload.
const { resetFilter, submitFilter, loadStoredFilters } = useFilterHelpers(filterData, filterConfig, {
  storeFiltersLocalStorage: false,
  populateUrlParams: false,
})

const { pagination } = usePagination(SORT_BY_ID)
provide(DatatablePaginationKey, pagination)

// Keyed by type, not by system: the sets differ between app and audit, and a column hidden in
// audit must not disappear from the app table.
const { columnsVisible, columnsAll, columnsHidden } = createDatatableColumnsConfig(
  [
    { key: 'id' },
    { key: 'datetime' },
    { key: 'levelName' },
    { key: 'message' },
    { key: 'context.appVersion' },
    { key: 'context.contextId' },
    ...(props.type === LogType.Audit
      ? [{ key: 'context.resourceName' }, { key: 'context.resourceIds' }]
      : [{ key: 'context.httpStatus' }]),
    { key: 'context.userId' },
    { key: 'context.ip' },
  ],
  datatableHiddenColumns,
  'common',
  LOG_ENTITY,
  { storeColumnsLocalStorage: `table_common_log_${props.type}` }
)
/* eslint-enable vue/no-setup-props-reactivity-loss */

const getList = useDebounceFn(async () => {
  await fetchList(pagination, filterData, filterConfig)
})

const onRowClick = (_event: unknown, { item }: { item: DatatableItem }) => {
  if (item.id) emit('rowClick', item)
}

onMounted(() => {
  // Reads nothing back -- both persistences are off -- but it is what restores the page a user
  // was on when they close a detail, which `AActionCloseButtonHistory` flags for the next list.
  loadStoredFilters(pagination, getList)
})

// Everything above reads its props once, which is only correct while the page remounts this view
// through a `:key`. Nothing would otherwise report a page that forgot: the table would keep
// querying the old endpoint with the old columns under a new url, quietly.
if (isDevelopment()) {
  watch(
    () => [props.system, props.type],
    () => {
      console.error(
        '[ALogDatatable] `system` or `type` changed in place. This view must be remounted -- ' +
          'give it :key="`${system}/${type}`". The endpoint and columns are bound at mount.'
      )
    }
  )
}

onBeforeUnmount(() => {
  // Both, and in this order. `cancel()` only invalidates what is already in flight; a debounce
  // still pending would fire after unmount, bump the generation past that invalidation and start
  // a request the token would then consider current.
  getList.cancel()
  cancel()
})

defineExpose({
  refresh: getList,
  resetFilter: () => resetFilter(pagination, getList),
  submitFilter: () => submitFilter(pagination, getList),
})
</script>

<template>
  <div>
    <div class="d-flex align-center">
      <VSpacer />
      <ADatatableConfigButton
        v-model:columns-hidden="columnsHidden"
        :columns-all="columnsAll"
      />
    </div>
    <VDataTableServer
      class="a-datatable"
      :headers="columnsVisible"
      :items="listItems"
      :items-length="listItems.length"
      item-value="id"
      @click:row="onRowClick"
    >
      <template #item.datetime="{ item }: { item: DatatableItem }">
        <ADatetime :date-time="item.datetime" />
      </template>
      <template #item.message="{ item }: { item: DatatableItem }">
        <div class="a-line-clamp-2">
          {{ item.message }}
        </div>
      </template>
      <template #item.context.resourceIds="{ item }: { item: DatatableItem }">
        {{ item.context.resourceIds.join(', ') }}
      </template>
      <template #item.context.contextId="{ item }: { item: DatatableItem }">
        <ACopyText :value="item.context.contextId" />
      </template>
      <template #item.context.userId="{ item }: { item: DatatableItem }">
        <ACopyText
          v-if="!isNull(item.context.userId)"
          :value="item.context.userId"
        />
      </template>
      <template #item.actions="{ item }: { item: DatatableItem }">
        <div class="d-flex justify-end">
          <!--
            `:to`, not a click handler: an anchor is what makes middle-click and open-in-new-tab
            work on a list people open several entries from, and it is what the smoke spec scrapes
            to find a row id.
          -->
          <VBtn
            :to="detailRoute(item)"
            class="ml-1"
            icon="mdi-information-outline"
            :aria-label="t('common.button.detail')"
            size="x-small"
            variant="text"
          />
        </div>
      </template>
      <template #bottom>
        <ADatatablePagination @change="getList" />
      </template>
    </VDataTableServer>
  </div>
</template>
