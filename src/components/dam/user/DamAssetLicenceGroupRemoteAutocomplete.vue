<script lang="ts" setup>
import { computed } from 'vue'
import type { IntegerId } from '@/types/common'
import type { AxiosInstance } from 'axios'
import { cloneDeep } from '@/utils/common'
import type { ValueObjectOption } from '@/types/ValueObject'
import AFormRemoteAutocomplete from '@/components/form/AFormRemoteAutocomplete.vue'
import { useAssetLicenceGroupSelectActions } from '@/components/dam/user/assetLicenceGroupActions'
import { useDamAssetLicenceGroupFilter } from '@/components/dam/user/AssetLicenceGroupFilter'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId | null | IntegerId[] | any
    client: () => AxiosInstance
    label?: string | undefined
    required?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    dataCy?: string
    hideDetails?: boolean
    disableInitFetch?: boolean
  }>(),
  {
    label: undefined,
    required: undefined,
    multiple: false,
    clearable: false,
    dataCy: '',
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
const { fetchItems, fetchItemsByIds } = useAssetLicenceGroupSelectActions(props.client)

const innerFilter = useDamAssetLicenceGroupFilter()
</script>

<template>
  <AFormRemoteAutocomplete
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
