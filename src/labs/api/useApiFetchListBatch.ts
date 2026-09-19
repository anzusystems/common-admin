import { AnzuFatalError } from '@/model/error/AnzuFatalError'
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
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/labs/api/request'
import { readListBody } from '@/labs/api/listBody'

export type UseApiFetchListBatchParams = {
  client: AxiosClientFn
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  /** Anything axios takes except what this helper decides: the method, the url, the body and the signal. */
  options?: Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'signal'>
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

/**
 * Carries the url of the page a failure happened on out to the catch that reports it.
 *
 * Nothing outside this file sees it: the catch unwraps it before mapping, so the caller gets the
 * same classes it would get from any other helper.
 */
class PageFailure extends Error {
  constructor(
    readonly pageUrl: string,
    readonly failure: unknown
  ) {
    super('Batch page failed')
    this.name = 'PageFailure'
  }
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
    const templateMissing = isUndefined(template)
    const url =
      (isUndefined(resolvedParams) ? (template ?? '') : replaceUrlParameters(template ?? '', resolvedParams)) +
      searchApi

    try {
      // Inside the try, so a caller that forgot the template gets the same error class as every
      // other failure rather than a bare `Error`.
      if (templateMissing) throw new AnzuFatalError(undefined, 'Url template is undefined')

      return await abortable.run(async (abortSignal) => {
        const { pagination } = usePagination(sortBy, sortDesc ? SortOrder.Desc : SortOrder.Asc, {
          rowsPerPage: batchSize,
        })

        // The page's own url travels with its response: a batch that failed on page three has to
        // be able to say which page that was, and the base url cannot.
        const get = async (page: Ref<Pagination>) => {
          const pageUrl = url + generateListQuery(page, filterData, filterConfig)

          try {
            return { res: await client().get(pageUrl, { ...ownedByHelper(options), signal: abortSignal }), pageUrl }
          } catch (err: unknown) {
            // Tagged here, where the page is still known. A shared variable cannot do this job: the
            // counted branch dispatches every page before any of them answers, so it would always
            // hold the last one and name the wrong page for the one that actually failed.
            throw new PageFailure(pageUrl, err)
          }
        }

        // Every page is read the same way, the ones after the first included. A 204 has nothing more
        // to give; a 2xx with no body at all has broken its contract, wherever in the sequence it
        // sits -- a server that fails on page three is not "finished".
        const readPage = (res: AxiosResponse, pageUrl: string) => {
          if (!isValidHTTPStatus(res.status)) throw new PageFailure(pageUrl, new AnzuApiResponseCodeError(res.status))
          if (res.status === HTTP_STATUS_NO_CONTENT) {
            return { items: [] as T[], mode: 'unknown' as const, totalCount: 0, hasNextPage: false, empty: true }
          }
          if (!hasBody(res)) {
            throw new PageFailure(
              pageUrl,
              new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + pageUrl)
            )
          }

          let body
          try {
            body = readListBody<T>(res.data, res.status, pageUrl)
          } catch (err: unknown) {
            throw new PageFailure(pageUrl, err)
          }

          return {
            items: body.items,
            mode: body.mode,
            totalCount: body.pagination.totalCount ?? 0,
            hasNextPage: body.pagination.hasNextPage === true,
            empty: false,
          }
        }

        const firstPage = await get(pagination)
        const first = readPage(firstPage.res, firstPage.pageUrl)
        const results: T[] = [...first.items]
        if (first.empty) return results

        // Infinite lists walk page by page, because only the answer says whether another exists.
        if (first.mode === 'infinite') {
          let hasNextPage = first.hasNextPage
          while (hasNextPage) {
            pagination.value.page++
            const nextPage = await get(pagination)
            const next = readPage(nextPage.res, nextPage.pageUrl)
            results.push(...next.items)
            if (next.empty) break
            hasNextPage = next.hasNextPage
          }

          return results
        }

        // A list that named neither mode has said nothing about further pages, so the first is all
        // there is.
        if (first.mode !== 'counted') return results

        // Counted lists know how many pages there are, so the rest go out together.
        const pageCount = Math.ceil(first.totalCount / pagination.value.rowsPerPage)
        if (pageCount <= 1) return results

        const rest = await Promise.all(
          Array.from({ length: pageCount - 1 }, (_unused, index) => get(ref({ ...pagination.value, page: index + 2 })))
        )
        // A 204 among them contributes nothing and the others are kept -- there is no sequence to
        // stop here, they all went out at once.
        rest.forEach((page) => results.push(...readPage(page.res, page.pageUrl).items))

        return results
      }, signal)
    } catch (err: unknown) {
      const failed = err instanceof PageFailure ? err : null
      const context = { system, entity, url: requestedUrl(failed?.pageUrl ?? url, options.params) }

      throw report(mapApiError(failed?.failure ?? err, context), context)
    }
  }

  return { execute, abort: abortable.abort }
}

export type UseApiFetchListBatchReturnType<T> = {
  execute: (filterData: FilterData<any>, filterConfig: FilterConfig<any>, params?: FetchListBatchParams) => Promise<T[]>
  abort: () => void
}
