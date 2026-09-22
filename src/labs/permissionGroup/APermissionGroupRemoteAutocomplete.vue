<script lang="ts" setup>
import { provide } from 'vue'
import { SortOrder } from '@/composables/system/datatableColumns'
import type { AxiosClientFn } from '@/labs/api/client'
import AFormRemoteAutocomplete from '@/labs/form/AFormRemoteAutocomplete.vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'
import { usePermissionGroupActions } from '@/labs/permissionGroup/permissionGroupActions'
import { usePermissionGroupInnerFilter } from '@/labs/permissionGroup/permissionGroupFilter'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    client: AxiosClientFn
    system: string
    entity?: string | undefined
    endPoint?: string | undefined
    label?: string | undefined
    required?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    readonly?: boolean
    dataCy?: string
  }>(),
  {
    entity: undefined,
    endPoint: undefined,
    label: undefined,
    required: undefined,
    multiple: false,
    clearable: false,
    readonly: false,
    dataCy: 'permissionGroup-select',
  }
)

const modelValue = defineModel<IntegerId | IntegerId[] | null>({ required: true })

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { fetchPermissionGroupOptions, fetchPermissionGroupOptionsByIds } = usePermissionGroupActions({
  client: props.client,
  system: props.system,
  entity: props.entity,
  endPoint: props.endPoint,
})
/* eslint-enable vue/no-setup-props-reactivity-loss */

// Per instance, never registered: two autocompletes on one page must not type into each other.
const { filterData, filterConfig } = usePermissionGroupInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFormRemoteAutocomplete
    v-model="modelValue"
    :required="required"
    :label="label"
    :readonly="readonly"
    :fetch-items="fetchPermissionGroupOptions"
    :fetch-items-by-ids="fetchPermissionGroupOptionsByIds"
    :multiple="multiple"
    :clearable="clearable && !readonly"
    filter-by-field="title"
    :filter-sort-by="{ key: 'createdAt', order: SortOrder.Desc }"
    prefetch="mounted"
    disable-auto-single-select
    :data-cy="dataCy"
    chips
    closable-chips
    hide-details
  />
</template>
