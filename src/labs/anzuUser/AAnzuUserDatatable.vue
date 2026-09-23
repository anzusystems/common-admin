<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, provide, useSlots, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { AxiosInstance } from 'axios'
import { useDebounceFn } from '@vueuse/core'
import ABooleanValue from '@/components/ABooleanValue.vue'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import ADatetime from '@/components/datetime/ADatetime.vue'
import ATableCopyIdButton from '@/components/buttons/table/ATableCopyIdButton.vue'
import { SORT_BY_ID } from '@/composables/system/datatableColumns'
import type { AxiosClientFn } from '@/labs/api/client'
import ADatatableOrdering from '@/labs/filters/ADatatableOrdering.vue'
import ADatatablePagination from '@/labs/filters/ADatatablePagination.vue'
import { createDatatableColumnsConfig } from '@/labs/filters/datatableColumns'
import { useFilterHelpers, type FilterStoreIdentifier, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import { usePagination } from '@/labs/filters/pagination'
import AAnzuUserFilter from '@/labs/anzuUser/AAnzuUserFilter.vue'
import { useAnzuUserActions } from '@/labs/anzuUser/anzuUserActions'
import { ANZU_USER_ENTITY } from '@/labs/anzuUser/anzuUserApi'
import { anzuUserFilterStorageKey, useAnzuUserListFilter } from '@/labs/anzuUser/anzuUserFilter'
import { usePermissionConfigActions } from '@/labs/permissionConfig/permissionConfigActions'
import { useCachedPermissionGroups } from '@/labs/permissionGroup/cachedPermissionGroups'
import { PERMISSION_GROUP_ENDPOINT } from '@/labs/permissionGroup/permissionGroupApi'
import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerIdNullable } from '@/types/common'

type DatatableItem = AnzuUser

const props = withDefaults(
  defineProps<{
    client: AxiosClientFn
    system: string
    entity?: string | undefined
    endPoint?: string | undefined
    detailRoute: (user: AnzuUser) => RouteLocationRaw
    editRoute: (user: AnzuUser) => RouteLocationRaw
    /** Already-evaluated ACL of the owning system. */
    canUpdate?: boolean
    /** The permission-group endpoint, which is not the user one. */
    permissionGroupEndPoint?: string
    /**
     * Extra columns the app draws through `#systemColumns`, appended after the shared ones.
     *
     * A bare key takes its header from the library's own `common.anzuUser.model.*`, which holds
     * eight keys and none of any system's -- so a system column passes its title already
     * translated, out of the namespace that has it.
     */
    systemColumns?: Array<string | { key: string; title: string }>
    /**
     * Signing in as somebody else, as a switchable feature.
     *
     * A callback rather than a path, because there is more than one mechanism: cms posts to
     * `/adm/users/{id}/impersonate` and gets a JWT with an impersonation claim, blog opens the
     * public site through `window.open`. Only the cms one reaches a shared component -- blog's
     * hangs off its product user, which is a different view -- so one prop is enough for now.
     * Left unset, nothing is drawn.
     */
    impersonate?: ((user: AnzuUser) => void) | undefined
    canImpersonate?: boolean
    /**
     * Filter fields this system adds to the shared three.
     *
     * A parameter and not part of the shared list, because the same filter is not the same query
     * everywhere: cms asks for permission groups with `memberOf`, dam with `custom`, and
     * `allowedSites` exists only in cms. A plain field needs nothing more -- the generic renderer
     * draws it -- while one that wants a remote autocomplete comes in through `#filter.<name>`.
     */
    filterFields?: readonly MakeFilterOption[]
    /**
     * Saved filters, which are stored per user, so both are needed for the button to appear. cms
     * and dam have them on the list this replaces; the other three admins do not.
     */
    filterClient?: (() => AxiosInstance) | undefined
    filterUserId?: IntegerIdNullable | undefined
    /** Where saved bookmarks are filed; see `AAnzuUserFilter`. */
    filterStore?: FilterStoreIdentifier | undefined
  }>(),
  {
    entity: undefined,
    endPoint: undefined,
    permissionGroupEndPoint: PERMISSION_GROUP_ENDPOINT,
    canUpdate: false,
    systemColumns: () => [],
    impersonate: undefined,
    canImpersonate: false,
    filterFields: () => [],
    filterClient: undefined,
    filterUserId: undefined,
    filterStore: undefined,
  }
)

const emit = defineEmits<{
  (e: 'rowClick', user: AnzuUser): void
}>()

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { filterConfig, filterData } = useAnzuUserListFilter(props.system, props.filterFields)
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)

const { fetchAnzuUserList, cancelAnzuUserList, anzuUserList, loadingAnzuUserList, datatableHiddenColumns } =
  useAnzuUserActions({
    client: props.client,
    system: props.system,
    entity: props.entity,
    endPoint: props.endPoint,
  })

// No `entity` here on purpose: this one reads the permission config, which is its own resource.
// `props.entity` names the user.
const { translatePermission } = usePermissionConfigActions({
  client: props.client,
  system: props.system,
})

/**
 * Group titles for the column, resolved against this system's own cache.
 *
 * Drawn here rather than left to a slot: a group is a group in every admin, the library already
 * has the cache -- keyed per system, because id 42 in weather and id 42 in blog are different rows
 * -- and leaving it to the call sites is how the column ends up empty in every one of them. An app
 * that wants its own chip still overrides through the slot.
 */
const { addToCachedPermissionGroups, fetchCachedPermissionGroups, getCachedPermissionGroup } =
  useCachedPermissionGroups({
    client: props.client,
    system: props.system,
    endPoint: props.permissionGroupEndPoint,
  })

const { resetFilter, submitFilter, loadStoredFilters } = useFilterHelpers(filterData, filterConfig, {
  storeFiltersLocalStorage: anzuUserFilterStorageKey(props.system),
})

const { pagination } = usePagination(SORT_BY_ID)
provide(DatatablePaginationKey, pagination)

const { columnsVisible, columnsAll, columnsHidden } = createDatatableColumnsConfig(
  [
    { key: 'id' },
    { key: 'email' },
    { key: 'enabled' },
    { key: 'roles' },
    { key: 'permissionGroups' },
    { key: 'permissions' },
    ...props.systemColumns.map((column) => (typeof column === 'string' ? { key: column } : column)),
    { key: 'createdAt' },
    { key: 'modifiedAt' },
  ],
  datatableHiddenColumns,
  'common',
  ANZU_USER_ENTITY,
  { storeColumnsLocalStorage: `table_labs_anzuUser_${props.system}` }
)
/* eslint-enable vue/no-setup-props-reactivity-loss */

const getList = useDebounceFn(async () => {
  await fetchAnzuUserList(pagination, filterData, filterConfig)
})

watch(anzuUserList, (users) => {
  users.forEach((user) => addToCachedPermissionGroups(user.permissionGroups))
  void fetchCachedPermissionGroups()
})

const systemColumnKeys = computed(() =>
  props.systemColumns.map((column) => (typeof column === 'string' ? column : column.key))
)

// `#filter.allowedSites` here becomes `#item.allowedSites` inside the filter, which is the name
// `AFilterWrapper` renders a field's own widget under. The prefix is what keeps a field slot apart
// from this table's own `item.*` columns.
const slots = useSlots()
const FILTER_SLOT_PREFIX = 'filter.'
const filterSlotNames = computed(() =>
  Object.keys(slots)
    .filter((name) => name.startsWith(FILTER_SLOT_PREFIX))
    .map((name) => name.slice(FILTER_SLOT_PREFIX.length))
)

const submitFilterAction = () => submitFilter(pagination, getList)
const resetFilterAction = () => resetFilter(pagination, getList)

const onRowClick = (_event: unknown, { item }: { item: DatatableItem }) => {
  if (item.id) emit('rowClick', item)
}

onMounted(() => {
  loadStoredFilters(pagination, getList)
})

onBeforeUnmount(() => {
  getList.cancel()
  cancelAnzuUserList()
})

defineExpose({
  refresh: getList,
  resetFilter: resetFilterAction,
  submitFilter: submitFilterAction,
})
</script>

<template>
  <div>
    <AAnzuUserFilter
      v-model:datatable-hidden-columns="columnsHidden"
      :client="filterClient"
      :user-id="filterUserId"
      :store="filterStore"
      @submit="submitFilterAction"
      @reset="resetFilterAction"
    >
      <template
        v-for="name in filterSlotNames"
        :key="name"
        #[`item.${name}`]="slotProps"
      >
        <slot
          :name="`${FILTER_SLOT_PREFIX}${name}`"
          v-bind="slotProps ?? {}"
        />
      </template>
    </AAnzuUserFilter>
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
        :items="anzuUserList"
        :items-length="anzuUserList.length"
        :loading="loadingAnzuUserList"
        item-value="id"
        @click:row="onRowClick"
      >
        <template #item.enabled="{ item }: { item: DatatableItem }">
          <ABooleanValue
            chip
            :value="item.enabled"
          />
        </template>
        <template #item.roles="{ item }: { item: DatatableItem }">
          <VChip
            v-for="role in item.roles"
            :key="role"
            class="mr-1 mb-1"
          >
            {{ translatePermission('roles', role) }}
          </VChip>
        </template>
        <template #item.permissionGroups="{ item }: { item: DatatableItem }">
          <slot
            name="permissionGroups"
            :ids="item.permissionGroups"
          >
            <VChip
              v-for="permissionGroupId in item.permissionGroups"
              :key="permissionGroupId"
              class="mr-1 mb-1"
              size="small"
              label
            >
              {{ getCachedPermissionGroup(permissionGroupId)?.title || permissionGroupId }}
            </VChip>
          </slot>
        </template>
        <template #item.permissions="{ item }: { item: DatatableItem }">
          <VChip>{{ Object.keys(item.permissions).length }}</VChip>
        </template>
        <template
          v-for="column in systemColumnKeys"
          :key="column"
          #[`item.${column}`]="{ item }: { item: DatatableItem }"
        >
          <slot
            name="systemColumns"
            :column="column"
            :user="item"
          />
        </template>
        <template #item.createdAt="{ item }: { item: DatatableItem }">
          <ADatetime :date-time="item.createdAt" />
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
          <div
            v-if="item.id"
            class="d-flex justify-end"
          >
            <ATableCopyIdButton :id="item.id" />
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
            <!-- A disabled account cannot sign in, so it cannot be signed in as either. -->
            <VBtn
              v-if="impersonate && canImpersonate"
              :disabled="!item.enabled"
              class="ml-1"
              icon="mdi-account-switch"
              size="x-small"
              variant="text"
              data-cy="user-impersonate"
              @click.stop="impersonate(item)"
            />
            <slot
              name="rowActions"
              :user="item"
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
