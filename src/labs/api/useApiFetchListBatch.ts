import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import { type Ref, ref } from 'vue'
import { isDefined, isUndefined } from '@/utils/common'
import { type Pagination, usePagination } from '@/labs/filters/pagination'
import { SortOrder } from '@/composables/system/datatableColumns'
import type { AxiosClientFn } from '@/labs/api/client'
import { generateListQuery } from '@/labs/api/useApiFetchList'
import { mapApiError, report } from '@/labs/api/apiErrors'
import { createAbortable, hasBody } from '@/labs/api/request'
import { readListBody } from '@/labs/api/listBody'

export type UseApiFetchListBatchParams = {
  client: AxiosClientFn
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: AxiosRequestConfig
  cancelPrevious?: boolean
}

export type FetchListBatchParams = {
  /** Stops this one call, leaving the instance's other calls alone. */
  signal?: AbortSignal
  urlTemplate?: string
  urlParams?: UrlParams
  sortBy?: string
  sortDesc?: boolean
  batchSize?: number
  forceElastic?: boolean
}

export const useApiFetchListBatch = <T>(params: UseApiFetchListBatchParams): UseApiFetchListBatchReturnType<T> => {
  const { client, system, entity, urlTemplate, urlParams, options = {}, cancelPrevious = false } = params
  const abortable = createAbortable({ cancelPrevious })

  const execute = async (
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    fetchParams: FetchListBatchParams = {}
  ): Promise<T[]> => {
    const {
      urlTemplate: urlTemplateOverride,
      urlParams: urlParamsOverride,
      sortBy = 'id',
      sortDesc = true,
      batchSize = 100,
      forceElastic = false,
      signal,
    } = fetchParams

    const searchApi = filterConfig.general.elastic || forceElastic ? '/search' : ''
    const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
    const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
    if (isUndefined(template)) throw new Error('Url template is undefined')
    const url = (isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)) + searchApi

    try {
      return await abortable.run(async (abortSignal) => {
        const { pagination } = usePagination(sortBy, sortDesc ? SortOrder.Desc : SortOrder.Asc, {
          rowsPerPage: batchSize,
        })

        const get = (page: Ref<Pagination>) =>
          client().get(url + generateListQuery(page, filterData, filterConfig), { ...options, signal: abortSignal })

        // Every page is read the same way, the ones after the first included. A 204 has nothing more
        // to give; a 2xx with no body at all has broken its contract, wherever in the sequence it
        // sits -- a server that fails on page three is not "finished".
        const readPage = (res: AxiosResponse) => {
          if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)
          if (res.status === HTTP_STATUS_NO_CONTENT) {
            return { items: [] as T[], totalCount: undefined, hasNextPage: false, empty: true }
          }
          if (!hasBody(res)) {
            throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + url)
          }

          const body = readListBody<T>(res.data, res.status, url)

          return {
            items: body.items,
            totalCount: body.pagination.totalCount,
            hasNextPage: body.pagination.hasNextPage === true,
            empty: false,
          }
        }

        const first = readPage(await get(pagination))
        const results: T[] = [...first.items]
        if (first.empty) return results

        // Infinite lists walk page by page, because only the answer says whether another exists.
        if (isUndefined(first.totalCount)) {
          let hasNextPage = first.hasNextPage
          while (hasNextPage) {
            pagination.value.page++
            const next = readPage(await get(pagination))
            results.push(...next.items)
            if (next.empty) break
            hasNextPage = next.hasNextPage
          }

          return results
        }

        // Counted lists know how many pages there are, so the rest go out together.
        const pageCount = Math.ceil(first.totalCount / pagination.value.rowsPerPage)
        if (pageCount <= 1) return results

        const rest = await Promise.all(
          Array.from({ length: pageCount - 1 }, (_unused, index) => get(ref({ ...pagination.value, page: index + 2 })))
        )
        // A 204 among them contributes nothing and the others are kept -- there is no sequence to
        // stop here, they all went out at once.
        rest.forEach((res) => results.push(...readPage(res).items))

        return results
      }, signal)
    } catch (err: unknown) {
      throw report(mapApiError(err, { system, entity, url }), { system, entity, url })
    }
  }

  return { execute, abort: abortable.abort }
}

export type UseApiFetchListBatchReturnType<T> = {
  execute: (filterData: FilterData<any>, filterConfig: FilterConfig<any>, params?: FetchListBatchParams) => Promise<T[]>
  abort: () => void
}
