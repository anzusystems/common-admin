import { reactive, ref } from 'vue'
// @ts-ignore
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
// @ts-ignore
import { useAlerts } from '@/composables/system/alerts'
// @ts-ignore
import { dateTimeEndOfDay, dateTimeStartOfDay } from '@/utils/datetime'
// @ts-ignore
import type { ValueObjectOption } from '@/types/ValueObject'

export enum LogType {
  App = 'app',
  Audit = 'audit',
  Default = App,
}

const makeFilter = makeFilterHelper('common', 'log')

const filter = reactive({
  system: {
    ...makeFilter({ name: 'system', variant: 'in', mandatory: true, exclude: true }),
  },
  contextAppSystem: {
    ...makeFilter({ name: 'system', mandatory: true, field: 'context.appSystem' }),
  },
  type: {
    ...makeFilter({ name: 'type', variant: 'in', default: LogType.Default, exclude: true }),
  },
  levelName: {
    ...makeFilter({ name: 'levelName', variant: 'in' }),
  },
  id: {
    ...makeFilter({ name: 'id' }),
  },
  contextId: {
    ...makeFilter({ name: 'contextId', field: 'context.contextId' }),
  },
  message: {
    ...makeFilter({ name: 'message', variant: 'startsWith' }),
  },
  appVersion: {
    ...makeFilter({ name: 'appVersion', variant: 'startsWith', field: 'context.appVersion' }),
  },
  userId: {
    ...makeFilter({ name: 'userId', field: 'context.userId' }),
  },
  datetimeFrom: {
    ...makeFilter({
      name: 'datetimeFrom',
      field: 'datetime',
      variant: 'gte',
      default: dateTimeStartOfDay(-1),
      mandatory: true,
    }),
  },
  datetimeTo: {
    ...makeFilter({
      name: 'datetimeTo',
      field: 'datetime',
      variant: 'lte',
      default: dateTimeEndOfDay(),
      mandatory: true,
    }),
  },
})

export function useDemoListFilter() {
  return filter
}

export function useLogType() {
  const logTypeOptions = ref<ValueObjectOption<LogType>[]>([
    {
      value: LogType.App,
      title: LogType.App,
    },
    {
      value: LogType.Audit,
      title: LogType.Audit,
    },
  ])

  const getLogTypeOption = (value: LogType) => {
    return logTypeOptions.value.find((item) => item.value === value)
  }

  return {
    logTypeOptions,
    getLogTypeOption,
  }
}

export enum LogSystem {
  Cms = 'cms',
  CmsAdmin = 'cmsAdmin',
  Default = Cms,
}

export function useLogSystem() {
  const logSystemOptions = ref<ValueObjectOption<LogSystem>[]>([
    {
      value: LogSystem.Cms,
      title: LogSystem.Cms,
    },
    {
      value: LogSystem.CmsAdmin,
      title: LogSystem.CmsAdmin,
    },
  ])

  const getLogSystemOption = (value: LogSystem) => {
    return logSystemOptions.value.find((item) => item.value === value)
  }

  return {
    logSystemOptions,
    getLogSystemOption,
  }
}

export const fetchSiteList = (pagination: Pagination, filterBag: FilterBag) => {
  return Promise.resolve([])
}

const { showErrorsDefault } = useAlerts()
const datatableHiddenColumns = ref<Array<string>>([])
const listLoading = ref(false)

export const useDemoListActions = () => {
  const listItems = ref<any[]>([])

  const fetchList = async (pagination: Pagination, filterBag: FilterBag) => {
    listLoading.value = true
    try {
      listItems.value = await fetchSiteList(pagination, filterBag)
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      listLoading.value = false
    }
  }

  return {
    datatableHiddenColumns,
    listLoading,
    fetchList,
    listItems,
  }
}
