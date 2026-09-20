import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import { isDefined, isUndefined } from '@/utils/common'
import type { Ref } from 'vue'
import type { AxiosClientFn } from '@/labs/api/client'
import { mapApiError, report } from '@/labs/api/apiErrors'
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/labs/api/request'
import { readListBody } from '@/labs/api/listBody'

export type UseApiFetchItemsParams = {
  client: AxiosClientFn
  system: string
  entity: string
  /**
   * The url, query and all: whatever built the query has already run by the time it gets here.
   *
   * `urlParams` are substituted into the PATH only -- `/article/:id/routes?locale=:locale` fills in
   * `:id` and sends `:locale` as it stands. This is the helper written for hand-made queries, so it
   * is the one place someone would reach for a placeholder in the query; put the value in the query
   * when building it, or pass it through `options.params` and let axios serialise it.
   */
  urlTemplate?: string
  urlParams?: UrlParams
  /** Anything axios takes except what this helper decides: the method, the url, the body and the signal. */
  options?: Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'signal'>
  cancelPrevious?: boolean
}

export type FetchItemsParams = {
  urlTemplate?: string
  urlParams?: UrlParams
  /** Stops this one call, leaving the instance's other calls alone. */
  signal?: AbortSignal
}

/**
 * A list read from an endpoint the caller has already written the query for, with no pagination.
 *
 * It exists because the fleet kept doing this through `useApiRequest<ApiResponseList<T[]>>`: build a
 * query by hand -- an order, a limit, a fixed filter -- bake it into the url, and read `.data` off
 * the envelope that comes back. That is a list fetch with the list part missing: nothing checks that
 * `data` is an array, so a malformed answer still hands back `undefined` typed as `T[]`, which is
 * the bug this whole family was built to end.
 *
 * `useApiFetchList` cannot serve them: it asks for a pagination ref, a `filterData` and a
 * `filterConfig`, and these calls have none -- their filters are decided at the call site and are
 * not the user's to change. So this is that helper with the pagination taken out: same core, same
 * error mapping, same list-body check, and it answers with the items rather than the envelope.
 *
 * It writes no metadata. An endpoint whose paging the user drives is `useApiFetchList`; a list read
 * page by page to the end is `useApiFetchListBatch`.
 */
export const useApiFetchItems = <T>(params: UseApiFetchItemsParams): UseApiFetchItemsReturnType<T> => {
  const { client, system, entity, urlTemplate, urlParams, options = {}, cancelPrevious = false } = params
  const abortable = createAbortable({ cancelPrevious })

  const execute = async (fetchParams: FetchItemsParams = {}): Promise<T[]> => {
    const { urlTemplate: urlTemplateOverride, urlParams: urlParamsOverride, signal } = fetchParams

    // Assigned inside `run`, at the moment there is a url to ask for; undefined until then, which is
    // what a failure before dispatch honestly reports.
    let url: string | undefined
    let dispatched: AxiosRequestConfig | undefined

    try {
      const res = await abortable.run((abortSignal) => {
        // Derived inside `run`, the way the rest of the family does it: `run` opens the generation
        // and, with `cancelPrevious`, stops the call before this one.
        const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const requestUrl = isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)
        const instance = client()

        url = requestUrl

        return instance.get(requestUrl, { ...ownedByHelper(options), signal: abortSignal })
      }, signal)

      dispatched = res.config
      // The url the report will name, so a message and the context beside it cannot disagree about
      // which request failed when an interceptor rewrote it on the way out.
      const asSent = () => requestedUrl(client, url, options, undefined, dispatched)
      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      // Nothing matched -- an empty answer, not a broken one.
      if (res.status === HTTP_STATUS_NO_CONTENT) return []

      if (!hasBody(res)) {
        throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + asSent())
      }

      return readListBody<T>(res.data, res.status, asSent()).items
    } catch (err: unknown) {
      const context = { system, entity, url: requestedUrl(client, url, options, err, dispatched) }

      throw report(mapApiError(err, context), context)
    }
  }

  return { execute, abort: abortable.abort, loading: abortable.loading }
}

export type UseApiFetchItemsReturnType<T> = {
  execute: (params?: FetchItemsParams) => Promise<T[]>
  abort: () => void
  /**
   * True while this instance has a request in flight, false once the last one settles.
   *
   * It is here so a caller does not have to keep its own: the hand-rolled version is a ref cleared
   * in a `finally`, and that `finally` belongs to whichever call ended -- including one that
   * `cancelPrevious` just superseded, which turns the spinner off while the call the user is waiting
   * for is still running. This one never dips between a superseded call and the one that replaced it.
   */
  loading: Ref<boolean>
}
