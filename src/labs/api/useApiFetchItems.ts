import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import { isDefined, isNull, isUndefined } from '@/utils/common'
import type { Ref } from 'vue'
import type { AxiosClientFn } from '@/labs/api/client'
import { mapApiError, report } from '@/labs/api/apiErrors'
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/labs/api/request'
import { readArrayBody, readListBody } from '@/labs/api/listBody'

/** Which of the two shapes a list arrives in. */
export type ItemsShape = 'envelope' | 'array'

export type UseApiFetchItemsParams = {
  client: AxiosClientFn
  system: string
  entity: string
  /** i18n scope for field-level validation failures; defaults to `system` / `entity`. */
  validationSystem?: string
  validationEntity?: string
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
  /**
   * Default `GET`, which is what 17 of the fleet's list reads and every existing caller here use.
   *
   * The others are here because a list is not only ever the answer to a read: a filter too big for a
   * url goes out as a POST, and a mutation can answer with the list it just changed -- a swap, a
   * shift, an upsert-all. What this helper is about is the answer, not the verb.
   */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  /**
   * Default `'envelope'`, because that is the fleet's norm and the exception is what gets declared.
   *
   * Leaving it out cannot go wrong quietly: the reader refuses the shape that was not declared, so a
   * forgotten `'array'` fails on the first run rather than handing back something that is not a list.
   */
  shape?: ItemsShape
}

export type FetchItemsParams<B = never> = {
  urlTemplate?: string
  urlParams?: UrlParams
  /** `null` omits the body, as everywhere in this family. */
  body?: B
  /** Stops this one call, leaving the instance's other calls alone. */
  signal?: AbortSignal
}

/**
 * A list from an endpoint the caller has already written the query for, with no pagination.
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
 * Read is the usual case, not the only one: a filter too big for a url goes out as a POST, and a
 * mutation can answer with the list it just changed. The helper is about what comes back.
 *
 * Which shape it comes back in is declared, not guessed. `shape` picks the reader and the reader
 * refuses the other shape, the way `optionalBody` makes a caller declare a body instead of leaving
 * the helper to accept whatever turns up. A wrong declaration therefore fails loudly on the first
 * run, which is what makes having a default safe at all.
 *
 * It writes no metadata. An endpoint whose paging the user drives is `useApiFetchList`; a list read
 * page by page to the end is `useApiFetchListBatch`.
 */
export const useApiFetchItems = <T, B = never>(params: UseApiFetchItemsParams): UseApiFetchItemsReturnType<T, B> => {
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
    method = 'GET',
    shape = 'envelope',
  } = params
  const abortable = createAbortable({ cancelPrevious })

  const execute = async (fetchParams: FetchItemsParams<B> = {}): Promise<T[]> => {
    const { urlTemplate: urlTemplateOverride, urlParams: urlParamsOverride, body, signal } = fetchParams

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

        // `null` omits the body, as it always has -- a caller that means to send JSON `null` wraps it.
        const sendsBody = !isNull(body) && !isUndefined(body)

        // Because `method` defaults to GET: a caller who wrote a body and forgot `method: 'POST'`
        // would otherwise send a GET without its filter, and nothing downstream would notice.
        if (method === 'GET' && sendsBody) {
          throw new AnzuFatalError(
            undefined,
            'A GET request does not carry a body -- set method, or pass the value through options.params'
          )
        }

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const requestUrl = isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)

        // `options` first, then what this helper owns: a caller cannot reach in and set the method,
        // the url, the body or the signal through it.
        const config: AxiosRequestConfig = {
          ...ownedByHelper(options),
          method,
          url: requestUrl,
          signal: abortSignal,
        }
        if (sendsBody) config.data = JSON.stringify(body)

        const instance = client()

        // Recorded last, when nothing between here and the call can throw any more. It used to sit
        // safely above the dispatch because nothing here could fail; `JSON.stringify` can -- a
        // circular body would otherwise be reported as a request to a url nobody ever called.
        url = requestUrl

        return instance.request(config)
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

      return shape === 'array'
        ? readArrayBody<T>(res.data, res.status, asSent())
        : readListBody<T>(res.data, res.status, asSent()).items
    } catch (err: unknown) {
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

export type UseApiFetchItemsReturnType<T, B = never> = {
  execute: (params?: FetchItemsParams<B>) => Promise<T[]>
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
