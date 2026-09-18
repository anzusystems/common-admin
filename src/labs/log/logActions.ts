import { ref, type Ref } from 'vue'
import { useAlerts } from '@/composables/system/alerts'
import type { AxiosClientFn } from '@/labs/api/client'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { Pagination } from '@/labs/filters/pagination'
import { useFetchLog, useFetchLogList } from '@/labs/log/logApi'
import type { LogPaths, LogTypeType } from '@/labs/log/logType'
import type { Log } from '@/types/Log'

interface LogActionsParams {
  client: AxiosClientFn
  system: string
  logPaths: LogPaths
  type: LogTypeType
  /**
   * Lets an ancestor own the flag, the way `usePagination` takes an external pagination ref --
   * the card that shows the spinner sits above the table that does the fetching.
   */
  loading?: Ref<boolean>
}

/**
 * Everything here is per instance, unlike the module-level refs the admins used to keep: the
 * views are remounted on every system/type change, and a `finally` belonging to the instance
 * that just went away would otherwise clear the new one's loading flag.
 */
export function useLogListActions(params: LogActionsParams) {
  const { showErrorsDefault } = useAlerts()
  const { execute, abort } = useFetchLogList(params)

  const listItems = ref<Log[]>([])
  const listLoading = params.loading ?? ref(false)
  const datatableHiddenColumns = ref<Array<string>>([])

  // Aborting is not enough on its own: axios rejects a cancelled request with `CanceledError`,
  // which is an axios error rather than a `DOMException` named `AbortError`, so it slips past the
  // helper's swallow and arrives here as a normal failure. Without this token the user would get
  // an error alert for an action they took themselves.
  let generation = 0
  const isCurrent = (token: number) => token === generation

  const fetchList = async (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ) => {
    const token = ++generation
    listLoading.value = true
    // `execute` writes the counts into the ref it is handed, inside the call -- before
    // anything out here could decide to discard them. It gets a copy, and the counts are
    // committed to the real one only if this call is still the current one.
    const scratch = ref<Pagination>({ ...pagination.value })
    try {
      const items = await execute(scratch, filterData, filterConfig)
      if (!isCurrent(token)) return
      listItems.value = items
      // Reading the scratch ref is the whole point -- these are the counts the helper just wrote
      // into it, and this is the one moment they are known to belong to the current request.
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

  /** Invalidates whatever is in flight, then cancels it. Order matters: the token first. */
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
  const { showErrorsDefault } = useAlerts()
  const { execute, abort } = useFetchLog(params)

  const log = ref<Log | null>(null)
  const detailLoading = params.loading ?? ref(false)

  let generation = 0
  const isCurrent = (token: number) => token === generation

  const fetchData = async (id: string) => {
    const token = ++generation
    detailLoading.value = true
    try {
      const res = await execute({ urlParams: { id } })
      if (!isCurrent(token)) return
      log.value = res
    } catch (error) {
      if (!isCurrent(token)) return
      log.value = null
      showErrorsDefault(error)
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
