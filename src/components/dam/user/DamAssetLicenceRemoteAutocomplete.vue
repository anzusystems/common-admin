<script lang="ts" setup>
import { computed, provide, watch } from 'vue'
import type { IntegerId } from '@/types/common'
import { cloneDeep } from '@/utils/common'
import AFormRemoteAutocomplete from '@/labs/form/AFormRemoteAutocomplete.vue'
import { useDamAssetLicenceInnerFilter } from '@/components/dam/user/AssetLicenceFilter'
import { useAssetLicenceSelectActions } from '@/components/dam/user/assetLicenceActions'
import type { AxiosInstance } from 'axios'
import type { ValueObjectOption } from '@/types/ValueObject'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'

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

const selected = defineModel<ValueObjectOption<IntegerId>[]>('selected', { required: false, default: () => [] })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItems, fetchItemsByIds } = useAssetLicenceSelectActions(props.client)

const { filterData, filterConfig } = useDamAssetLicenceInnerFilter()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
filterData.extSystem = props.extSystemId
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)

watch(
  () => props.extSystemId,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    modelValueComputed.value = props.multiple ? [] : null
    filterData.extSystem = newValue
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
