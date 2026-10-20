<script lang="ts" setup>
import { provide } from 'vue'
import type { AxiosInstance } from 'axios'
import AFormRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue'
import { useDamUserSelectAction } from '@/domains/dam/user/composables/damUserSelectActions'
import { useDamUserInnerFilter } from '@/domains/dam/user/filter/DamUserFilter'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import type { IntegerId } from '@/shared/types/common'
import type { AFormFieldValidation } from '@/shared/types/Validation'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    label?: string | undefined
    required?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    dataCy?: string
    v?: AFormFieldValidation | null
    /** The DAM config of the plugin options whose client lists the users. */
    configName?: string
    /** Lists the users through this client instead of the configured one, at `/adm/v1/user` (not `endPointUser`). */
    client?: (() => AxiosInstance) | undefined
  }>(),
  {
    label: undefined,
    required: undefined,
    multiple: false,
    clearable: false,
    dataCy: '',
    v: null,
    configName: undefined,
    client: undefined,
  }
)
const modelValue = defineModel<IntegerId | IntegerId[] | null>({ required: true })
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

// A client given lists at the fixed address; the configuration's at its `endPointUser`. Read once, as the name.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient, endPointUser } = props.client
  ? { damClient: props.client, endPointUser: undefined }
  : useCommonAdminCoreDamOptions(damConfigName)
const { fetchItems, fetchItemsByIds } = useDamUserSelectAction(damClient, endPointUser)

const { filterData, filterConfig } = useDamUserInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFormRemoteAutocomplete
    v-model="modelValue"
    :label="label"
    :required="required"
    :multiple="multiple"
    :clearable="clearable"
    :data-cy="dataCy"
    :v="v"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="lastName"
    :filter-sort-by="null"
  />
</template>
