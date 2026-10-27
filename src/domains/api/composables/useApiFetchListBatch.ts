import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/domains/api/utils/apiHelper'
import { isValidHTTPStatus } from '@/domains/api/utils/response'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/shared/statusCodes'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import { type Ref, ref } from 'vue'
import { isDefined, isUndefined } from '@/shared/utils/common'
import { type Pagination, usePagination } from '@/domains/api/composables/pagination'
import { SortOrder } from '@/domains/api/types/SortOrder'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import { generateListQuery } from '@/domains/api/composables/useApiFetchList'
import { mapApiError, report } from '@/domains/api/utils/apiErrors'
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/domains/api/composables/request'
import { readListBody } from '@/domains/api/utils/listBody'

export type UseApiFetchListBatchParams = {
  client: AxiosClientFn
  system: string
  entity: string
  /**
   * i18n scope for field-level validation failures; defaults to `system` / `entity`.
   */
  validationSystem?: string
  validationEntity?: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'signal'>
  cancelPrevious?: boolean
}

export type FetchListBatchParams = {
  /**
   * Stops this one call, leaving the instance's other calls alone.
   */
  signal?: AbortSignal
  urlTemplate?: string
  urlParams?: UrlParams
  sortBy?: string
  sortDesc?: boolean
  batchSize?: number
  forceElastic?: boolean
}

/**
 * Carries the url of the failing page to the catch that reports it.
 * The catch unwraps it before mapping, so callers see the same error classes as from other helpers.
 */
class PageFailure extends Error {
  readonly pageUrl: string
  readonly failure: unknown
  /**
   * The config axios used, set when the page answered but this helper refused
   * the response. Transport failures do not need it, axios keeps its own.
   */
  readonly dispatched?: AxiosRequestConfig

  constructor(pageUrl: string, failure: unknown, dispatched?: AxiosRequestConfig) {
    super('Batch page failed')
    this.name = 'PageFailure'
    this.pageUrl = pageUrl
    this.failure = failure
    this.dispatched = dispatched
  }
}

export const useApiFetchListBatch = <T>(params: UseApiFetchListBatchParams): UseApiFetchListBatchReturnType<T> => {
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

    try {
      return await abortable.run(async (abortSignal) => {
        // Derived inside `run` because `run` opens the generation and, with `cancelPrevious`,
        // stops the previous call. A throw before it would leave the predecessor running.
        // Inside the try so the failure raises the same error class as others.
        const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

        // A page size below one never ends the walk and causes unbounded requests. Fail it as a caller error.
        if (batchSize < 1) throw new AnzuFatalError(undefined, 'batchSize must be at least 1, got ' + batchSize)

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const searchApi = filterConfig.general.elastic || forceElastic ? '/search' : ''
        const baseUrl =
          (isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)) + searchApi
        // One instance for the whole batch, so a factory that answers
        // differently per call cannot split pages across backends.
        const instance = client()

        const { pagination } = usePagination(sortBy, sortDesc ? SortOrder.Desc : SortOrder.Asc, {
          rowsPerPage: batchSize,
        })

        // Each page carries its own url so a failure can name the page. The base url cannot.
        const get = async (page: Ref<Pagination>) => {
          const pageUrl = baseUrl + generateListQuery(page, filterData, filterConfig)

          try {
            return { res: await instance.get(pageUrl, { ...ownedByHelper(options), signal: abortSignal }), pageUrl }
          } catch (err: unknown) {
            // Tagged here while the page is known. The counted branch dispatches all
            // pages before any answers, so a shared variable would name the wrong page.
            throw new PageFailure(pageUrl, err)
          }
        }

        // The url the report names for this page, so the message and
        // context agree when an interceptor rewrote the request.
        const asSent = (res: AxiosResponse, pageUrl: string) =>
          requestedUrl(client, pageUrl, options, undefined, res.config)

        // Every page is checked the same way. A 2xx with no body breaks the contract on any page.
        // The 204 branch is defensive. These backends return empty lists as 200 with a body.

        const readPage = (res: AxiosResponse, pageUrl: string) => {
          if (!isValidHTTPStatus(res.status)) {
            throw new PageFailure(pageUrl, new AnzuApiResponseCodeError(res.status), res.config)
          }
          if (res.status === HTTP_STATUS_NO_CONTENT) {
            return {
              items: [] as T[],
              mode: 'unknown' as const,
              totalCount: 0,
              hasNextPage: false,
              countIsBound: false,
              empty: true,
            }
          }
          if (!hasBody(res)) {
            throw new PageFailure(
              pageUrl,
              new AnzuApiResponseCodeError(
                res.status,
                undefined,
                'Expected a response body, url: ' + asSent(res, pageUrl)
              ),
              res.config
            )
          }

          let body
          try {
            body = readListBody<T>(res.data, res.status, asSent(res, pageUrl))
          } catch (err: unknown) {
            throw new PageFailure(pageUrl, err, res.config)
          }

          return {
            items: body.items,
            mode: body.mode,
            totalCount: body.pagination.totalCount ?? 0,
            hasNextPage: body.pagination.hasNextPage === true,
            countIsBound: body.countIsBound,
            empty: false,
          }
        }

        const firstPage = await get(pagination)
        const first = readPage(firstPage.res, firstPage.pageUrl)
        const results: T[] = [...first.items]
        if (first.empty) return results

        // A short first page is read as the server's real page size (a capped `limit`), so later
        // offsets use it. Done before the branch so both counted and infinite walks use it.
        // If the server instead dropped rows after applying `limit`, this would repeat rows at boundaries.
        // No such dropping was found, and repeated rows are visible while missing ones are not.
        // When capped, pages are walked one at a time, so a wrong guess
        // costs single requests and stops at the first empty page.
        const capped = first.items.length > 0 && first.items.length < pagination.value.rowsPerPage
        if (capped) pagination.value.rowsPerPage = first.items.length

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

        // A list that named neither mode said nothing about further pages, so the first page is all there is.
        if (first.mode !== 'counted') return results

        // Two cases where `totalCount` cannot be divided into a page count. `bigTable` (on by default) makes
        // `totalCount` a look-ahead of `offset + limit + 1`, not a total. Dividing it gives 2 pages, so a
        // 5000-row batch would stop at 200. Or the page size was guessed and the server already contradicted it.
        // In both cases walk pages sequentially until a page is shorter than requested. That is the end-of-data signal.
        // Stop early when the rows already reach `totalCount`. The repository corrects
        // `totalCount` to the real total only when a page comes back shorter than its
        // limit. A capped server reports the look-ahead instead and does not match.
        if (results.length >= first.totalCount) return results

        if (capped || first.countIsBound) {
          for (;;) {
            pagination.value.page++
            const nextPage = await get(pagination)
            const next = readPage(nextPage.res, nextPage.pageUrl)
            results.push(...next.items)
            if (next.items.length < pagination.value.rowsPerPage) break
          }

          return results
        }

        // The count is known, so the remaining pages are requested in parallel.
        const pageCount = Math.ceil(first.totalCount / pagination.value.rowsPerPage)
        if (pageCount <= 1) return results

        // Read each page as it arrives, not after all settle. Otherwise a broken
        // body goes unnoticed while a sibling hangs, and the call never ends.
        // Rejecting here reaches `run`, which aborts the siblings.
        const rest = await Promise.all(
          Array.from({ length: pageCount - 1 }, (_unused, index) =>
            get(ref({ ...pagination.value, page: index + 2 })).then((page) => readPage(page.res, page.pageUrl))
          )
        )
        // A 204 page adds nothing. The other pages are kept, since all were sent at once.
        rest.forEach((page) => results.push(...page.items))

        return results
      }, signal)
    } catch (err: unknown) {
      const failed = err instanceof PageFailure ? err : null
      // Only a page reports a url, and it reports its own. The base url is never
      // requested. A failure before dispatch (missing template, unrenderable filter
      // config) belongs to no page. Every failure after dispatch is a `PageFailure`.
      const context = {
        system,
        entity,
        validationSystem,
        validationEntity,
        url: requestedUrl(client, failed?.pageUrl, options, failed?.failure ?? err, failed?.dispatched),
      }

      throw report(mapApiError(failed?.failure ?? err, context), context)
    }
  }

  return { execute, abort: abortable.abort, loading: abortable.loading }
}

export type UseApiFetchListBatchReturnType<T> = {
  execute: (filterData: FilterData<any>, filterConfig: FilterConfig<any>, params?: FetchListBatchParams) => Promise<T[]>
  abort: () => void
  /**
   * True while this instance is working. For a batch it covers the whole walk, including gaps between pages.
   * Unlike a hand-rolled ref cleared in `finally`, it does not drop when `cancelPrevious` supersedes a call.
   * It covers only this helper. Keep your own flag if it also spans follow-up work such as a cached fetch or mapping.
   * It is only reachable if you hold the instance. A factory that creates
   * one per call cannot expose `loading`, `abort` or `cancelPrevious`.
   */
  loading: Ref<boolean>
}
