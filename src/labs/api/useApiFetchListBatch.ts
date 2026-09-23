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
  /** i18n scope for field-level validation failures; defaults to `system` / `entity`. */
  validationSystem?: string
  validationEntity?: string
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
    readonly failure: unknown,
    /**
     * The config axios used for this page, when the page answered and it was this helper that
     * refused what came back. A page that failed in transport needs none: axios kept its own.
     */
    readonly dispatched?: AxiosRequestConfig
  ) {
    super('Batch page failed')
    this.name = 'PageFailure'
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
        // Derived inside `run`, the way the list does it: `run` opens the generation and, with
        // `cancelPrevious`, stops the call before this one, so a call that throws on a missing
        // template or a malformed filter config would otherwise leave its predecessor running.
        // Inside the try as well, so that failure arrives as the same error class as every other.
        const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

        // A page size below one cannot end the walk: every page is then "not shorter than the one
        // asked for", so the loop has no exit and the helper becomes an unbounded stream of
        // requests. It is the caller's mistake, and it arrives as the same error class as the
        // caller's other mistakes rather than as a backend that never stops answering.
        if (batchSize < 1) throw new AnzuFatalError(undefined, 'batchSize must be at least 1, got ' + batchSize)

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const searchApi = filterConfig.general.elastic || forceElastic ? '/search' : ''
        const baseUrl =
          (isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)) + searchApi
        // One instance for the whole batch: a call is one call, and a factory that answers
        // differently per page would have its pages talking to two backends.
        const instance = client()

        const { pagination } = usePagination(sortBy, sortDesc ? SortOrder.Desc : SortOrder.Asc, {
          rowsPerPage: batchSize,
        })

        // The page's own url travels with its response: a batch that failed on page three has to
        // be able to say which page that was, and the base url cannot.
        const get = async (page: Ref<Pagination>) => {
          const pageUrl = baseUrl + generateListQuery(page, filterData, filterConfig)

          try {
            return { res: await instance.get(pageUrl, { ...ownedByHelper(options), signal: abortSignal }), pageUrl }
          } catch (err: unknown) {
            // Tagged here, where the page is still known. A shared variable cannot do this job: the
            // counted branch dispatches every page before any of them answers, so it would always
            // hold the last one and name the wrong page for the one that actually failed.
            throw new PageFailure(pageUrl, err)
          }
        }

        // The url the report will name for this page, so a message and the context beside it cannot
        // disagree about which request failed when an interceptor rewrote it on the way out.
        const asSent = (res: AxiosResponse, pageUrl: string) =>
          requestedUrl(client, pageUrl, options, undefined, res.config)

        // Every page is read the same way, the ones after the first included: a 2xx with no body at
        // all has broken its contract, wherever in the sequence it sits -- a server that fails on
        // page three is not "finished". The 204 branch is defensive rather than expected: these
        // backends answer an empty list as a 200 with a body, so a list never arrives as a 204, and
        // the branch is here for an endpoint that one day does.

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

        // A first page shorter than the one asked for means the offsets cannot be trusted: every page
        // after it is addressed by arithmetic on a page size, and the server has just shown that the
        // size it uses is not the size requested. Read as the server's real page size -- a capped
        // `limit`, which backends do -- and taken from page one, which has already answered.
        //
        // Before the branch, not inside it: both ways of walking a list address their pages this way,
        // and hardening one of them is how the counted branch was fixed while the infinite one went
        // on losing rows.
        //
        // It is a reading, not a fact. The other reading would be a server that applies `limit` and
        // then drops rows -- permissions, soft deletes -- while counting `totalCount` before that:
        // its window really is the requested size, so stepping by the shorter one overlaps and rows
        // repeat at each boundary. A sweep of the shared path found no such dropping, so the reading
        // taken here is the one these backends support; the trade is deliberate anyway, because
        // repeated rows are visible to whoever reads the list and missing ones are not.
        //
        // What the ambiguity does buy is the caution below: once the arithmetic is in doubt, the
        // pages are walked one at a time rather than fired off together, so a wrong guess costs
        // requests one by one rather than a burst of them, and stops at the first empty page.
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

        // A list that named neither mode has said nothing about further pages, so the first is all
        // there is.
        if (first.mode !== 'counted') return results

        // Two ways the count cannot be divided into a page count. The server may have said so itself
        // -- `bigTable`, which is on by default, makes `totalCount` a look-ahead of `offset + limit + 1`
        // rather than a total, corrected to the real number only on the page that comes back short.
        // Dividing that by the page size answers 2, whatever the list's real length: a batch over
        // 5000 rows would return 200 of them and resolve as though it were finished. Or the page size
        // itself had to be guessed, in which case the count divides by a number the server has
        // already contradicted.
        //
        // Either way the walk is sequential and ends where the data does -- a page shorter than the
        // one asked for is the server saying there is no more, and it is the same signal the
        // repository uses to correct the count in the first place.
        // Already holding as many rows as the count names, so there is nothing to walk to. This is
        // also what makes a short first page unambiguous: the repository corrects `totalCount` to the
        // real total exactly when a page comes back shorter than the limit it applied, so a list that
        // simply ends satisfies this, while a server that capped the limit reports its look-ahead
        // instead and does not.
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

        // Counted lists know how many pages there are, so the rest go out together.
        const pageCount = Math.ceil(first.totalCount / pagination.value.rowsPerPage)
        if (pageCount <= 1) return results

        // Each page is read as it arrives, not after all of them have. Reading them afterwards meant
        // a page that answered with a broken body was not noticed until every sibling had settled --
        // and a sibling that never answers made that never, so the call hung on a failure it was
        // already holding. Rejecting here reaches `run`, which stops the siblings.
        const rest = await Promise.all(
          Array.from({ length: pageCount - 1 }, (_unused, index) =>
            get(ref({ ...pagination.value, page: index + 2 })).then((page) => readPage(page.res, page.pageUrl))
          )
        )
        // A 204 among them contributes nothing and the others are kept -- there is no sequence to
        // stop here, they all went out at once.
        rest.forEach((page) => results.push(...page.items))

        return results
      }, signal)
    } catch (err: unknown) {
      const failed = err instanceof PageFailure ? err : null
      // Only a page can name a url here, and it names its own. The base url is not an answer: it was
      // never requested, and a failure that belongs to no page -- a missing template, a filter config
      // that will not render -- happened before any page existed. Nothing else can fail after a page
      // has gone out, because everything from the dispatch onwards is tagged as a `PageFailure`.
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
   * True while this instance is working, false once it stops.
   *
   * Here that is the whole walk, not one request: a batch reads every page, and the flag stays up
   * across the gaps between them and across the reading of each answer.
   *
   * It is here so a caller does not have to keep its own: the hand-rolled version is a ref cleared in
   * a `finally`, and that `finally` belongs to whichever call ended -- including one that
   * `cancelPrevious` just superseded, which turns the spinner off while the call the user is waiting
   * for is still running. This one never dips between a superseded call and the one that replaced it.
   *
   * Two things to know before replacing a hand-rolled flag with it.
   *
   * It covers what this helper does and nothing the caller does afterwards. A flag that also spans a
   * follow-up cached fetch, a mapping pass or a second endpoint is not the same flag, and swapping it
   * for this one turns the spinner off too early. Keep your own where it means more than "this helper
   * is working".
   *
   * It belongs to the instance, so it is only reachable if you hold the instance. A factory that
   * builds one per call and hands back the promise alone -- `const { execute } = useX()` inside the
   * function that calls it -- cannot expose `loading`, `abort` or `cancelPrevious` at all. Hoist the
   * instance to where the caller lives first.
   */
  loading: Ref<boolean>
}
