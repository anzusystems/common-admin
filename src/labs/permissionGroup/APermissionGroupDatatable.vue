<script lang="ts" setup>
import { onBeforeUnmount, onMounted, provide } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import ADatetime from '@/components/datetime/ADatetime.vue'
import ATableCopyIdButton from '@/components/buttons/table/ATableCopyIdButton.vue'
import type { AxiosClientFn } from '@/labs/api/client'
import ADatatableOrdering from '@/labs/filters/ADatatableOrdering.vue'
import ADatatablePagination from '@/labs/filters/ADatatablePagination.vue'
import { createDatatableColumnsConfig } from '@/labs/filters/datatableColumns'
import { useFilterHelpers } from '@/labs/filters/filterFactory'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import { usePagination } from '@/labs/filters/pagination'
import APermissionGroupFilter from '@/labs/permissionGroup/APermissionGroupFilter.vue'
import { usePermissionGroupActions } from '@/labs/permissionGroup/permissionGroupActions'
import { PERMISSION_GROUP_ENTITY } from '@/labs/permissionGroup/permissionGroupApi'
import {
  permissionGroupFilterStorageKey,
  usePermissionGroupListFilter,
} from '@/labs/permissionGroup/permissionGroupFilter'
import { SORT_BY_ID } from '@/composables/system/datatableColumns'
import type { PermissionGroup } from '@/types/PermissionGroup'

type DatatableItem = PermissionGroup

const props = withDefaults(
  defineProps<{
    client: AxiosClientFn
    /** Backend identity: keys the filter store and the cache, and reaches every api call. */
    system: string
    entity?: string | undefined
    endPoint?: string | undefined
    /** Where a row and the detail button go. The library cannot know an app's typed route names. */
    detailRoute: (permissionGroup: PermissionGroup) => RouteLocationRaw
    editRoute: (permissionGroup: PermissionGroup) => RouteLocationRaw
    /** Already-evaluated ACL. A boolean, not an `AclValue`: see 5.1 of the plan. */
    canUpdate?: boolean
  }>(),
  {
    entity: undefined,
    endPoint: undefined,
    canUpdate: false,
  }
)

const emit = defineEmits<{
  (e: 'rowClick', permissionGroup: PermissionGroup): void
}>()

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { filterConfig, filterData } = usePermissionGroupListFilter(props.system)
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)

const {
  fetchPermissionGroupList,
  cancelPermissionGroupList,
  permissionGroupList,
  loadingPermissionGroupList,
  datatableHiddenColumns,
} = usePermissionGroupActions({
  client: props.client,
  system: props.system,
  entity: props.entity,
  endPoint: props.endPoint,
})

const { resetFilter, submitFilter, loadStoredFilters } = useFilterHelpers(filterData, filterConfig, {
  storeFiltersLocalStorage: permissionGroupFilterStorageKey(props.system),
})

const { pagination } = usePagination(SORT_BY_ID)
provide(DatatablePaginationKey, pagination)

const { columnsVisible, columnsAll, columnsHidden } = createDatatableColumnsConfig(
  [
    { key: 'id' },
    { key: 'title' },
    { key: 'description' },
    { key: 'permissions' },
    { key: 'createdAt' },
    { key: 'modifiedAt' },
  ],
  datatableHiddenColumns,
  'common',
  PERMISSION_GROUP_ENTITY,
  { storeColumnsLocalStorage: `table_labs_permissionGroup_${props.system}` }
)
/* eslint-enable vue/no-setup-props-reactivity-loss */

const getList = useDebounceFn(async () => {
  await fetchPermissionGroupList(pagination, filterData, filterConfig)
})

// Named here rather than called inline in the template: `pagination` is a ref, and the template
// would hand these its unwrapped value.
const submitFilterAction = () => submitFilter(pagination, getList)
const resetFilterAction = () => resetFilter(pagination, getList)

const onRowClick = (_event: unknown, { item }: { item: DatatableItem }) => {
  if (item.id) emit('rowClick', item)
}

onMounted(() => {
  loadStoredFilters(pagination, getList)
})

onBeforeUnmount(() => {
  // Order matters: a pending debounce would otherwise fire after the abort and start a request
  // nothing is left to receive.
  getList.cancel()
  cancelPermissionGroupList()
})

defineExpose({
  refresh: getList,
  resetFilter: resetFilterAction,
  submitFilter: submitFilterAction,
})
</script>

<template>
  <div>
    <APermissionGroupFilter
      @submit="submitFilterAction"
      @reset="resetFilterAction"
    />
    <div>
      <div class="d-flex align-center">
        <VSpacer />
        <ADatatableOrdering
          variant="id"
          @sort-by-change="submitFilterAction"
        />
        <ADatatableConfigButton
          v-model:columns-hidden="columnsHidden"
          :columns-all="columnsAll"
        />
      </div>
      <VDataTableServer
        class="a-datatable"
        :headers="columnsVisible"
        :items="permissionGroupList"
        :items-length="permissionGroupList.length"
        :loading="loadingPermissionGroupList"
        item-value="id"
        @click:row="onRowClick"
      >
        <template #item.permissions="{ item }: { item: DatatableItem }">
          <VChip>{{ Object.keys(item.permissions).length }}</VChip>
        </template>
        <template #item.createdAt="{ item }: { item: DatatableItem }">
          <ADatetime :date-time="item.createdAt" />
          <!-- The user chip is per app: its cache, its route, its own `_system`. An app without
               one leaves the slot empty, and then there is no line break either. -->
          <template v-if="$slots.createdBy">
            <br />
            <slot
              :id="item.createdBy"
              name="createdBy"
            />
          </template>
        </template>
        <template #item.modifiedAt="{ item }: { item: DatatableItem }">
          <ADatetime :date-time="item.modifiedAt" />
          <template v-if="$slots.modifiedBy">
            <br />
            <slot
              :id="item.modifiedBy"
              name="modifiedBy"
            />
          </template>
        </template>
        <template #item.actions="{ item }: { item: DatatableItem }">
          <div class="d-flex justify-end">
            <ATableCopyIdButton :id="item.id" />
            <!--
              `:to` rather than a click handler, so middle-click and open-in-new-tab work on a list
              people open several rows from.
            -->
            <VBtn
              :to="detailRoute(item)"
              class="ml-1"
              icon="mdi-information-outline"
              size="x-small"
              variant="text"
            />
            <VBtn
              v-if="canUpdate"
              :to="editRoute(item)"
              class="ml-1"
              icon="mdi-pencil"
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
  </div>
</template>
