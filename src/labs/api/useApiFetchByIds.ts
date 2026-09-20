import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import type { DocId, IntegerId } from '@/types/common'
import { isDefined, isUndefined } from '@/utils/common'
import type { Ref } from 'vue'
import type { AxiosClientFn } from '@/labs/api/client'
import { useApiQueryBuilder } from '@/labs/api/useApiQueryBuilder'
import { mapApiError, report } from '@/labs/api/apiErrors'
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/labs/api/request'
import { readListBody } from '@/labs/api/listBody'

export type UseApiFetchByIdsParams = {
  client: AxiosClientFn
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  /** Anything axios takes except what this helper decides: the method, the url, the body and the signal. */
  options?: Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'signal'>
  isSearchApi?: boolean
  field?: string
  cancelPrevious?: boolean
}

export type FetchByIdsParams = {
  urlTemplate?: string
  urlParams?: UrlParams
  /** Stops this one call, leaving the instance's other calls alone. */
  signal?: AbortSignal
}

/** The `filter_in` query that fetches exactly the ids asked for, in one request. */
const generateByIdsApiQuery = (ids: IntegerId[] | DocId[], isSearchApi: boolean, field = 'id'): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, queryAddFilter, queryAdd } = useApiQueryBuilder()
  const limit = ids.length // todo add batch fetch
  querySetLimit(limit)
  querySetOffset(1, limit)
  querySetOrder(field, false)
  if (isSearchApi) queryAdd(field, ids.join(','))
  else queryAddFilter('in', field, ids.join(','))

  return queryBuild()
}

export const useApiFetchByIds = <T>(params: UseApiFetchByIdsParams): UseApiFetchByIdsReturnType<T> => {
  const {
    client,
    system,
    entity,
    urlTemplate,
    urlParams,
    options = {},
    isSearchApi = false,
    field = 'id',
    cancelPrevious = false,
  } = params
  const abortable = createAbortable({ cancelPrevious })

  const execute = async (ids: DocId[] | IntegerId[], fetchParams: FetchByIdsParams = {}): Promise<T[]> => {
    const { urlTemplate: urlTemplateOverride, urlParams: urlParamsOverride, signal } = fetchParams

    // Assigned inside `run`, once, at the moment there is a url to ask for; undefined until then,
    // which is what a failure before dispatch honestly reports.
    let url: string | undefined
    // The config axios used, kept for the failures this helper raises after reading the response:
    // they carry no config of their own, and rebuilding one describes the request as the client
    // would send it now rather than as it was sent.
    let dispatched: AxiosRequestConfig | undefined

    try {
      const res = await abortable.run((abortSignal) => {
        // Derived inside `run`, the way the list does it: `run` opens the generation and, with
        // `cancelPrevious`, stops the call before this one, so work done ahead of it would let a
        // call that never dispatches leave its predecessor running. Inside the try as well, so a
        // caller that forgot the template gets the same error class as every other failure rather
        // than a bare `Error`.
        const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const baseUrl = isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)
        const requestUrl = baseUrl + generateByIdsApiQuery(ids, isSearchApi, field)
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

      // Nothing matched the ids -- an empty answer, not a broken one.
      if (res.status === HTTP_STATUS_NO_CONTENT) return []

      if (!hasBody(res)) {
        throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + asSent())
      }

      return readListBody<T>(res.data, res.status, asSent()).items
    } catch (err: unknown) {
      // Built once and handed to both, the way the batch does it: half the work on the failure path,
      // and one place that could go wrong instead of two.
      const context = { system, entity, url: requestedUrl(client, url, options, err, dispatched) }

      throw report(mapApiError(err, context), context)
    }
  }

  return { execute, abort: abortable.abort, loading: abortable.loading }
}

export type UseApiFetchByIdsReturnType<T> = {
  execute: (ids: DocId[] | IntegerId[], params?: FetchByIdsParams) => Promise<T[]>
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
