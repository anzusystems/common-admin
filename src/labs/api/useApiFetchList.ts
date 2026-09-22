import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/labs/api/useApiQueryBuilder'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { Ref } from 'vue'
import { isDefined, isNull, isUndefined } from '@/utils/common'
import type { Pagination } from '@/labs/filters/pagination'
import { SortOrder } from '@/composables/system/datatableColumns'
import type { AxiosClientFn } from '@/labs/api/client'
import { mapApiError, report } from '@/labs/api/apiErrors'
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/labs/api/request'
import { readListBody } from '@/labs/api/listBody'

export type UseApiFetchListParams = {
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
    const { urlTemplate: urlTemplateOverride, urlParams: urlParamsOverride, forceElastic = false, signal } = fetchParams

    // Assigned inside `run`, once, at the moment there is a url to ask for. It stays undefined until
    // then, and that is what a failure before dispatch reports: the field says which url was
    // requested, and a call that never reached the wire requested none. Neither the client root nor
    // the path it was going to build is an answer to that question.
    let url: string | undefined
    // The config axios used, kept for the failures this helper raises after reading the response:
    // they carry no config of their own, and rebuilding one describes the request as the client
    // would send it now rather than as it was sent.
    let dispatched: AxiosRequestConfig | undefined

    // Handed over by `run`, not read before it: `run` is what opens a new generation, so a value
    // taken beforehand belongs to the previous call and would never match.
    let generation = 0
    let ownSignal: AbortSignal | undefined
    const writePagination = (next: Partial<Pagination>) => {
      // Two ways to stop being the call whose answer counts, and both have to be checked: a newer
      // call opened a generation, or this one was cancelled through a signal of its own. Aborting
      // does not stop a response already on its way, so either can still arrive and write.
      //
      // The generation belongs to the instance, not to this `pagination` ref, so one instance serves
      // one list. Two concurrent calls on a shared instance writing to different refs would leave
      // the older ref unwritten -- correct for the same list shown twice, wrong for two lists.
      if (abortable.generation() !== generation) return
      if (ownSignal?.aborted === true) return
      // The caller's own signal, read directly rather than through the relay `run` set up for it.
      // `run` drops that relay as soon as the response is in hand, and the write happens after --
      // so an abort landing in between leaves `ownSignal` untouched, and the call the caller just
      // stopped would go on to write the pagination. This is the only state the family writes
      // outside `run`, so it is the only place the gap exists.
      if (signal?.aborted === true) return
      pagination.value = { ...pagination.value, ...next }
    }

    try {
      const res = await abortable.run((abortSignal, currentGeneration) => {
        generation = currentGeneration
        ownSignal = abortSignal

        // The whole url is derived here, inside `run`, and that is the point of putting it here:
        // `run` is what opens a new generation and, with `cancelPrevious`, stops the call before
        // this one. Anything done ahead of it belongs to no generation yet, so a missing template or
        // a malformed filter config -- both of which throw while the url is being built -- would
        // leave the previous call current, and its answer, arriving afterwards, would write
        // pagination for a query the caller has already replaced. It also keeps all of it inside the
        // try, so the caller gets the same error class as for every other failure rather than a bare
        // `Error` nothing in the fleet is written to catch.
        const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const searchApi = filterConfig.general.elastic || forceElastic ? '/search' : ''
        const baseUrl =
          (isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)) + searchApi
        const requestUrl = baseUrl + generateListQuery(pagination, filterData, filterConfig)
        const instance = client()

        // Recorded last, when nothing between here and the call can throw any more: a client factory
        // that fails is a request that never happened, and the report says so by naming no url.
        url = requestUrl

        return instance.get(requestUrl, { ...ownedByHelper(options), signal: abortSignal })
      }, signal)

      dispatched = res.config
      // The url the report will name, so a message and the context beside it cannot disagree about
      // which request failed when an interceptor rewrote it on the way out.
      const asSent = () => requestedUrl(client, url, options, undefined, dispatched)
      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      // 204 is an empty list, and the metadata has to say so -- left alone it keeps answering for
      // the previous query.
      if (res.status === HTTP_STATUS_NO_CONTENT) {
        // A 204 says the list is empty; it says nothing about which kind of list it is. So the mode
        // the pagination is already in decides which field gets cleared: a counted list keeps
        // `null`, and an infinite one keeps a boolean and gets `false` -- which is what it means,
        // "there is nothing after this". Writing `null` for both put an infinite list into counted
        // mode, where `ASubjectSelect` reads a next page as available and its autoload fires again
        // on the same 204, and `ADatatablePagination` offers Next and Last on an empty page.
        const stillCounted = isNull(pagination.value.hasNextPage)
        writePagination({ totalCount: 0, hasNextPage: stillCounted ? null : false, currentViewCount: 0 })
        return []
      }

      if (!hasBody(res)) {
        throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + asSent())
      }

      const list = readListBody<T>(res.data, res.status, asSent())
      // Only when the response said something about paging at all: a body that named no mode has
      // said nothing to write, and a count of what just arrived would be the one field left
      // describing a query nobody asked about.
      if (list.mode !== 'unknown') writePagination({ ...list.pagination, currentViewCount: list.items.length })

      return list.items
    } catch (err: unknown) {
      // Built once and handed to both, the way the batch does it: half the work on the failure path,
      // and one place that could go wrong instead of two.
      const context = {
        system,
        entity,
        validationSystem,
        validationEntity,
        url: requestedUrl(client, url, options, err, dispatched),
      }

      throw report(mapApiError(err, context), context)
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
   * True while this instance has a request in flight, false once the last one settles.
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
