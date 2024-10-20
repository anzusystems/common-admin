<script lang="ts" setup>
import type { Filter } from '@/types/Filter'
import { useDamUserSelectAction } from '@/components/dam/user/damUserSelectActions'
import { useDamUserFilter } from '@/components/dam/user/DamUserFilter'
import AFilterRemoteAutocomplete from '@/components/filter/AFilterRemoteAutocomplete.vue'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

const props = withDefaults(
  defineProps<{
    configName?: string
  }>(),
  {
    configName: 'default'
  }
)

const modelValue = defineModel<Filter>({ required: true })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)

const { fetchItems, fetchItemsByIds } = useDamUserSelectAction(damClient)

const innerFilter = useDamUserFilter()
</script>

<template>
  <AFilterRemoteAutocomplete
    v-model="modelValue"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    :inner-filter="innerFilter"
    filter-by-field="lastName"
  />
</template>
