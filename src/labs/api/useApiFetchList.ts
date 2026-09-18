import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/labs/api/useApiQueryBuilder'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { Ref } from 'vue'
import { isDefined, isUndefined } from '@/utils/common'
import type { Pagination } from '@/labs/filters/pagination'
import { SortOrder } from '@/composables/system/datatableColumns'
import type { AxiosClientFn } from '@/labs/api/client'
import { mapApiError, report } from '@/labs/api/apiErrors'
import { createAbortable, hasBody } from '@/labs/api/request'
import { readListBody } from '@/labs/api/listBody'

export type UseApiFetchListParams = {
  client: AxiosClientFn
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: AxiosRequestConfig
  cancelPrevious?: boolean
}

export type FetchListParams = {
  urlTemplate?: string
  urlParams?: UrlParams
  forceElastic?: boolean
  /** Stops this one call, leaving the instance's other calls alone. */
  signal?: AbortSignal
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
  const { client, system, entity, urlTemplate, urlParams, options = {}, cancelPrevious = false } = params
  const abortable = createAbortable({ cancelPrevious })

  const execute = async (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    fetchParams: FetchListParams = {}
  ): Promise<T[]> => {
    const { urlTemplate: urlTemplateOverride, urlParams: urlParamsOverride, forceElastic = false, signal } = fetchParams

    const searchApi = filterConfig.general.elastic || forceElastic ? '/search' : ''
    const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
    const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
    if (isUndefined(template)) throw new Error('Url template is undefined')
    const url =
      (isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)) +
      searchApi +
      generateListQuery(pagination, filterData, filterConfig)

    // Handed over by `run`, not read before it: `run` is what opens a new generation, so a value
    // taken beforehand belongs to the previous call and would never match.
    let generation = 0
    const writePagination = (next: Partial<Pagination>) => {
      // A call that is no longer the newest must not write to a pagination object the caller can
      // see, even when its answer arrives first -- aborting does not stop a response already sent.
      if (abortable.generation() !== generation) return
      pagination.value = { ...pagination.value, ...next }
    }

    try {
      const res = await abortable.run((abortSignal, currentGeneration) => {
        generation = currentGeneration

        return client().get(url, { ...options, signal: abortSignal })
      }, signal)

      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      // 204 is an empty list, and the metadata has to say so -- left alone it keeps answering for
      // the previous query.
      if (res.status === HTTP_STATUS_NO_CONTENT) {
        writePagination({ totalCount: 0, hasNextPage: false, currentViewCount: 0 })
        return []
      }

      if (!hasBody(res)) {
        throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + url)
      }

      const list = readListBody<T>(res.data, res.status, url)
      writePagination({ ...list.pagination, currentViewCount: list.items.length })

      return list.items
    } catch (err: unknown) {
      throw report(mapApiError(err, { system, entity, url }), { system, entity, url })
    }
  }

  return { execute, abort: abortable.abort }
}

export type UseApiFetchListReturnType<T> = {
  execute: (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    params?: FetchListParams
  ) => Promise<T[]>
  abort: () => void
}
