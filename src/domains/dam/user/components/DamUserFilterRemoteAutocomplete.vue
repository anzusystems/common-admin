<script lang="ts" setup>
import { useDamUserSelectAction } from '@/domains/dam/user/composables/damUserSelectActions'
import { useDamUserInnerFilter } from '@/domains/dam/user/filter/DamUserFilter'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    name: string
    configName?: string
  }>(),
  {
    configName: undefined,
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { damClient, endPointUser } = useCommonAdminCoreDamOptions(damConfigName)

const { fetchItems, fetchItemsByIds } = useDamUserSelectAction(damClient, endPointUser)

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
