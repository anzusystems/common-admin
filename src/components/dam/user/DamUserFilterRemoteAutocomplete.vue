<script lang="ts" setup>
import { useDamUserSelectAction } from '@/components/dam/user/damUserSelectActions'
import { useDamUserInnerFilter } from '@/components/dam/user/DamUserFilter'
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'

const props = withDefaults(
  defineProps<{
    name: string
    configName?: string
  }>(),
  {
    configName: 'default',
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)

const { fetchItems, fetchItemsByIds } = useDamUserSelectAction(damClient)

const { filterData, filterConfig } = useDamUserInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFilterRemoteAutocomplete
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="lastName"
    :filter-sort-by="null"
    @change="emit('change')"
  />
</template>
