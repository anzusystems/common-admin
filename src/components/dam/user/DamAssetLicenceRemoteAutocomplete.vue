<script lang="ts" setup>
import { computed, watch } from 'vue'
import type { IntegerId } from '@/types/common'
import { cloneDeep } from '@/utils/common'
import AFormRemoteAutocomplete from '@/components/form/AFormRemoteAutocomplete.vue'
import { useDamAssetLicenceFilter } from '@/components/dam/user/AssetLicenceFilter'
import { useAssetLicenceSelectActions } from '@/components/dam/user/assetLicenceActions'
import type { AxiosInstance } from 'axios'
import type { ValueObjectOption } from '@/types/ValueObject'

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
    disableInitFetch?: boolean
  }>(),
  {
    label: undefined,
    required: undefined,
    multiple: false,
    clearable: false,
    dataCy: '',
    extSystemId: null,
    hideDetails: undefined,
    disableInitFetch: false,
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

const innerFilter = useDamAssetLicenceFilter()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
innerFilter.extSystem.model = props.extSystemId

watch(
  () => props.extSystemId,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    modelValueComputed.value = props.multiple ? [] : null
    innerFilter.extSystem.model = newValue
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
    :inner-filter="innerFilter"
    :multiple="multiple"
    :clearable="clearable"
    filter-by-field="name"
    :data-cy="dataCy"
    :hide-details="hideDetails"
    :disable-init-fetch="disableInitFetch"
  />
</template>
