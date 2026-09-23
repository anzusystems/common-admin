<script lang="ts" setup>
import { provide, ref, useTemplateRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useRouter } from 'vue-router'
import ACard from '@/components/ACard.vue'
import type { AxiosClientFn } from '@/labs/api/client'
import { FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import type { TimeIntervalToolsValue } from '@/labs/filters/filterTimeIntervalTools'
import ALogDatatable from '@/labs/log/ALogDatatable.vue'
import ALogFilter from '@/labs/log/ALogFilter.vue'
import { applyLogTypeVisibility, type LogTimeWindow, useLogFilter } from '@/labs/log/logFilter'
import type { LogPaths, LogTypeType } from '@/labs/log/logType'
import type { Log } from '@/types/Log'

const props = defineProps<{
  /** Which backend to ask. */
  client: AxiosClientFn
  /** Identity used for api naming and error reporting -- `coreDam`, not `dam`, where they differ. */
  system: string
  /** From the route, never component state: it picks the endpoint and has to survive a filter reset. */
  type: LogTypeType
  /** Whole paths per type. Comes from the route-side descriptor, which the guard reads too. */
  logPaths: LogPaths
  /** Where a row goes. The library cannot know an app's typed route names, so the app maps it. */
  detailRoute: (log: Log) => RouteLocationRaw
  /** Where the app/audit dropdown goes. Same reason. */
  typeRoute: (type: LogTypeType) => RouteLocationRaw
  /** Mandatory time bound, as admin-dam has today. Omitted means no bound at all. */
  defaultTimeWindow?: LogTimeWindow | undefined
  /** `allowed` for the interval filter. Omitted means the library's full preset list. */
  allowedTimeIntervals?: TimeIntervalToolsValue[] | undefined
}>()

const router = useRouter()

// Read once: keyed remount, as in the datatable below.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const filter = useLogFilter(props.system, props.defaultTimeWindow)
// Every mount, not only on a type change: the registry returns the config the last visit left,
// so the flags still describe that visit's type. See `applyLogTypeVisibility`.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
applyLogTypeVisibility(filter, props.type)

provide(FilterConfigKey, filter.filterConfig)
provide(FilterDataKey, filter.filterData)

const datatable = useTemplateRef<InstanceType<typeof ALogDatatable>>('datatable')
const listLoading = ref(false)

const onRowClick = (log: Log) => {
  router.push(props.detailRoute(log))
}

const onChangeType = (type: LogTypeType) => {
  if (type === props.type) return
  router.replace(props.typeRoute(type))
}
</script>

<template>
  <ACard :loading="listLoading">
    <VCardText>
      <ALogFilter
        :type="type"
        :allowed-time-intervals="allowedTimeIntervals"
        @submit="datatable?.submitFilter()"
        @reset="datatable?.resetFilter()"
        @change-type="onChangeType"
      />
      <ALogDatatable
        ref="datatable"
        v-model:loading="listLoading"
        :client="client"
        :system="system"
        :type="type"
        :log-paths="logPaths"
        :detail-route="detailRoute"
        @row-click="onRowClick"
      />
    </VCardText>
  </ACard>
</template>
