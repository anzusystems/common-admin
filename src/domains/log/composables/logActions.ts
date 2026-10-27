import { ref, type Ref } from 'vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { handleRecordLoadError } from '@/domains/system/composables/recordPage'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import type { Pagination } from '@/domains/api/composables/pagination'
import { useFetchLog, useFetchLogList } from '@/domains/log/api/logApi'
import type { LogPaths, LogTypeType } from '@/domains/log/composables/logType'
import type { Log } from '@/domains/log/types/Log'

interface LogActionsParams {
  client: AxiosClientFn
  system: string
  logPaths: LogPaths
  type: LogTypeType
  /**
   * Lets an ancestor own the flag, like `usePagination` takes an external pagination ref.
   * The card that shows the spinner sits above the table that fetches.
   */
  loading?: Ref<boolean>
}

/**
 * Everything here is per instance. The views remount on every system or type change.
 * With module-level refs, a `finally` of the unmounted instance would clear the new instance's loading flag.
 */
export function useLogListActions(params: LogActionsParams) {
  const { showErrorsDefault } = useAlerts()
  const { execute, abort } = useFetchLogList(params)

  const listItems = ref<Log[]>([])
  const listLoading = params.loading ?? ref(false)
  const datatableHiddenColumns = ref<Array<string>>([])

  // Aborting is not enough. axios rejects a cancelled request with
  // `CanceledError`, not a `DOMException` named `AbortError`.
  // So it slips past the helper's swallow and arrives as a normal failure.
  // Without this token the user would get an error alert for their own action.
  let generation = 0
  const isCurrent = (token: number) => token === generation

  const fetchList = async (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ) => {
    const token = ++generation
    listLoading.value = true
    // `execute` writes the counts into the ref it gets during the call, before we can discard them.
    // So it gets a copy. The counts go to the real ref only if this call is still current.
    const scratch = ref<Pagination>({ ...pagination.value })
    try {
      const items = await execute(scratch, filterData, filterConfig)
      if (!isCurrent(token)) return
      listItems.value = items
      // Read the scratch ref here. Only now are its counts known to belong to the current request.
      /* eslint-disable vue/no-ref-object-reactivity-loss */
      pagination.value = {
        ...pagination.value,
        hasNextPage: scratch.value.hasNextPage,
        currentViewCount: scratch.value.currentViewCount,
        totalCount: scratch.value.totalCount,
      }
      /* eslint-enable vue/no-ref-object-reactivity-loss */
    } catch (error) {
      if (!isCurrent(token)) return
      // A failed fetch must not leave the previous type's rows on screen under the new url.
      listItems.value = []
      showErrorsDefault(error)
    } finally {
      if (isCurrent(token)) listLoading.value = false
    }
  }

  /**
   * Invalidates whatever is in flight, then cancels it. Order matters: the token first.
   */
  const cancel = () => {
    generation++
    abort()
  }

  return {
    listItems,
    listLoading,
    datatableHiddenColumns,
    fetchList,
    cancel,
  }
}

export function useLogDetailActions(params: LogActionsParams) {
  const { execute, abort } = useFetchLog(params)

  const log = ref<Log | null>(null)
  const detailLoading = params.loading ?? ref(false)

  let generation = 0
  const isCurrent = (token: number) => token === generation

  /**
   * `true` once loaded, `false` when the page should leave, `undefined` when superseded or stopped.
   */
  const fetchData = async (id: string): Promise<boolean | undefined> => {
    const token = ++generation
    detailLoading.value = true
    try {
      const res = await execute({ urlParams: { id } })
      if (!isCurrent(token)) return undefined
      log.value = res
      return true
    } catch (error) {
      if (!isCurrent(token)) return undefined
      log.value = null
      return handleRecordLoadError(error) ? false : undefined
    } finally {
      if (isCurrent(token)) detailLoading.value = false
    }
  }

  const cancel = () => {
    generation++
    abort()
  }

  return {
    log,
    detailLoading,
    fetchData,
    cancel,
  }
}
