<script lang="ts" setup>
import { computed, provide, watch } from 'vue'
import type { IntegerId } from '@/shared/types/common'
import { cloneDeep, isNull } from '@/shared/utils/common'
import AFormRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue'
import { useDamAssetListViewInnerFilter } from '@/domains/dam/user/filter/AssetListViewFilter'
import { useAssetListViewSelectActions } from '@/domains/dam/user/composables/assetListViewActions'
import type { AxiosInstance } from 'axios'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId | null | IntegerId[] | any
    client: () => AxiosInstance
    label?: string | undefined
    required?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    dataCy?: string
    extSystemId?: IntegerId | null
    hideDetails?: boolean
  }>(),
  {
    label: undefined,
    required: undefined,
    multiple: false,
    clearable: false,
    dataCy: '',
    extSystemId: null,
    hideDetails: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerId | null | IntegerId[] | any): void
}>()

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue: IntegerId | null | IntegerId[] | any) {
    emit('update:modelValue', cloneDeep<IntegerId | null | IntegerId[] | any>(newValue))
  },
})

const selected = defineModel<ValueObjectOption<IntegerId>[]>('selected', {
  required: false,
  default: () => [],
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItems, fetchItemsByIds } = useAssetListViewSelectActions(props.client)

const { filterData, filterConfig } = useDamAssetListViewInnerFilter()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
filterData.extSystem = props.extSystemId
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)

watch(
  () => props.extSystemId,
  (newValue, oldValue) => {
    filterData.extSystem = newValue
    // As in the licence input: a loaded entity's first ext system keeps its views, a switch to another drops them.
    if (newValue === oldValue || isNull(oldValue)) return
    modelValueComputed.value = props.multiple ? [] : null
  }
)
</script>

<template>
  <AFormRemoteAutocomplete
    :key="extSystemId + ''"
    v-model="modelValueComputed"
    v-model:selected="selected"
    :required="required"
    :label="label"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    :multiple="multiple"
    :clearable="clearable"
    filter-by-field="name"
    :data-cy="dataCy"
    :hide-details="hideDetails"
    prefetch="hover"
  />
</template>
