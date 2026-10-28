import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/domains/api/utils/apiHelper'
import { isValidHTTPStatus } from '@/domains/api/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/domains/api/composables/useApiQueryBuilder'
import { HTTP_STATUS_NO_CONTENT } from '@/shared/statusCodes'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import type { Ref } from 'vue'
import { isDefined, isNull, isUndefined } from '@/shared/utils/common'
import type { Pagination } from '@/domains/api/composables/pagination'
import { SortOrder } from '@/domains/api/types/SortOrder'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import { mapApiError, report } from '@/domains/api/utils/apiErrors'
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/domains/api/composables/request'
import { readListBody } from '@/domains/api/utils/listBody'

export type UseApiFetchListParams = {
  client: AxiosClientFn
  system: string
  entity: string
  /** i18n scope for field-level validation failures; defaults to `system` / `entity`. */
  validationSystem?: string
  validationEntity?: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'signal'>
  cancelPrevious?: boolean
}

export type FetchListParams = {
  urlTemplate?: string
  urlParams?: UrlParams
  forceElastic?: boolean
  /** Stops this one call, leaving the instance's other calls alone. */
  signal?: AbortSignal
  /**
   * `false`: a failure of this call is still thrown but not sent to the api error logger.
   * For a caller that polls a list and has already reported its first failure. It is set per call, not per instance.
   */
  report?: boolean
}

export const generateListQuery = (
  pagination: Ref<Pagination>,
  filterData: FilterData<any>,
  filterConfig: FilterConfig<any>
): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, querySetFilters } = useApiQueryBuilder()
  querySetLimit(pagination.value.rowsPerPage)
  querySetOffset(pagination.value.page, pagination.value.rowsPerPage)
  if (pagination.value.sortBy) {
    querySetOrder(pagination.value.sortBy.key, pagination.value.sortBy.order === SortOrder.Desc)
  }
  querySetFilters(filterData, filterConfig)
  return queryBuild()
}

export const useApiFetchList = <T>(params: UseApiFetchListParams): UseApiFetchListReturnType<T> => {
  const {
    client,
    system,
    entity,
    validationSystem,
    validationEntity,
    urlTemplate,
    urlParams,
    options = {},
    cancelPrevious = false,
  } = params
  const abortable = createAbortable({ cancelPrevious })

  const execute = async (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    fetchParams: FetchListParams = {}
  ): Promise<T[]> => {
    const {
      urlTemplate: urlTemplateOverride,
      urlParams: urlParamsOverride,
      forceElastic = false,
      signal,
      report: reported = true,
    } = fetchParams

    // Assigned inside `run` once a url exists. It stays undefined before
    // that, because a call that never reached the wire requested no url.
    let url: string | undefined
    // The config axios used, kept for failures raised after reading the response. Those carry
    // no config, and a rebuild would describe the request as the client would send it now.
    let dispatched: AxiosRequestConfig | undefined

    // Set by `run`, not read before it. `run` opens the new
    // generation, so an earlier value belongs to the previous call.
    let generation = 0
    let ownSignal: AbortSignal | undefined
    const writePagination = (next: Partial<Pagination>) => {
      // Check both a newer generation and this call's own abort. Aborting does not stop a response already arriving.
      // The generation belongs to the instance, so one instance must serve one list.
      // Concurrent calls writing to different refs would leave the older ref unwritten.
      if (abortable.generation() !== generation) return
      if (ownSignal?.aborted === true) return
      // Read the caller's signal directly, not the relay. `run` drops the relay once the response arrives
      // and this write happens after, so an abort in between would otherwise still write pagination.
      if (signal?.aborted === true) return
      pagination.value = { ...pagination.value, ...next }
    }

    try {
      const res = await abortable.run((abortSignal, currentGeneration) => {
        generation = currentGeneration
        ownSignal = abortSignal

        // The url is derived inside `run`, which opens the generation and, with
        // `cancelPrevious`, stops the previous call. If building it threw before `run`,
        // the previous call would stay current and write pagination for a replaced query.
        // Inside the try so these failures raise the same error class as others.
        const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const searchApi = filterConfig.general.elastic || forceElastic ? '/search' : ''
        const baseUrl =
          (isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)) + searchApi
        const requestUrl = baseUrl + generateListQuery(pagination, filterData, filterConfig)
        const instance = client()

        // Recorded last, when nothing before the call can throw. A failing
        // client factory means no request happened, so no url is reported.
        url = requestUrl

        return instance.get(requestUrl, { ...ownedByHelper(options), signal: abortSignal })
      }, signal)

      dispatched = res.config
      // The url the report names, so the message and context agree when an interceptor rewrote the request.
      const asSent = () => requestedUrl(client, url, options, undefined, dispatched)
      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      // 204 is an empty list. The metadata must be reset, or it keeps describing the previous query.
      if (res.status === HTTP_STATUS_NO_CONTENT) {
        // The current pagination mode decides what to clear. A counted list
        // keeps `hasNextPage` as `null`, an infinite one gets `false`.
        // Writing `null` for both switched infinite lists to counted mode. `ASubjectSelect` then autoloaded
        // the same 204 again, and `ADatatablePagination` offered Next and Last on an empty page.
        const stillCounted = isNull(pagination.value.hasNextPage)
        writePagination({ totalCount: 0, hasNextPage: stillCounted ? null : false, currentViewCount: 0 })
        return []
      }

      if (!hasBody(res)) {
        throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + asSent())
      }

      const list = readListBody<T>(res.data, res.status, asSent())
      // Only write when the response named a paging mode. Otherwise a lone
      // `currentViewCount` would be stale metadata for an earlier query.
      if (list.mode !== 'unknown') writePagination({ ...list.pagination, currentViewCount: list.items.length })

      return list.items
    } catch (err: unknown) {
      // Built once and shared by both, as in the batch.
      const context = {
        system,
        entity,
        validationSystem,
        validationEntity,
        url: requestedUrl(client, url, options, err, dispatched),
      }

      const error = mapApiError(err, context)

      throw reported ? report(error, context) : error
    }
  }

  return { execute, abort: abortable.abort, loading: abortable.loading }
}

export type UseApiFetchListReturnType<T> = {
  execute: (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    params?: FetchListParams
  ) => Promise<T[]>
  abort: () => void
  /**
   * True while this instance has a request in flight. Unlike a caller-cleared
   * `finally` flag, it does not dip when `cancelPrevious` supersedes a call.
   * It covers only this helper's work. Keep your own flag if it also spans follow-up fetches or mapping.
   * It belongs to the instance. A factory that builds one per call cannot
   * expose `loading`, `abort` or `cancelPrevious`, so hoist the instance first.
   */
  loading: Ref<boolean>
}
