import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/domains/api/utils/apiHelper'
import { isValidHTTPStatus } from '@/domains/api/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/shared/statusCodes'
import { isDefined, isNull, isUndefined } from '@/shared/utils/common'
import type { Ref } from 'vue'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import { mapApiError, report } from '@/domains/api/utils/apiErrors'
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/domains/api/composables/request'
import { readArrayBody, readListBody } from '@/domains/api/utils/listBody'

/**
 * Which of the two shapes a list arrives in.
 */
export type ItemsShape = 'envelope' | 'array'

export type UseApiFetchItemsParams = {
  client: AxiosClientFn
  system: string
  entity: string
  /**
   * i18n scope for field-level validation failures; defaults to `system` / `entity`.
   */
  validationSystem?: string
  validationEntity?: string
  /**
   * The full url including the query, already built by the caller.
   * `urlParams` are substituted into the path only. A placeholder in the query
   * is sent as is. Put the value in the query or pass it via `options.params`.
   */
  urlTemplate?: string
  urlParams?: UrlParams
  options?: Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'signal'>
  cancelPrevious?: boolean
  /**
   * Defaults to `GET`.
   * Other verbs exist because a filter too big for a url goes out
   * as a POST, and a mutation can answer with the changed list.
   */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  /**
   * Defaults to `'envelope'`, the fleet norm.
   * The reader refuses an undeclared shape, so a forgotten `'array'` fails on the first run.
   */
  shape?: ItemsShape
}

export type FetchItemsParams<B = never> = {
  urlTemplate?: string
  urlParams?: UrlParams
  /**
   * `null` omits the body, as everywhere in this family.
   */
  body?: B
  /**
   * Stops this one call, leaving the instance's other calls alone.
   */
  signal?: AbortSignal
}

/**
 * Fetches a list from an endpoint whose query the caller already built, without pagination.
 * Replaces `useApiRequest<ApiResponseList<T[]>>` reads, which never checked that `data`
 * is an array. `useApiFetchList` needs pagination and filter config these calls lack.
 * `shape` is declared, and the reader refuses the other shape, so a wrong declaration fails loudly.
 * Writes no metadata. Use `useApiFetchList` for user-driven paging and `useApiFetchListBatch` to read all pages.
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

    // Assigned inside `run` once a url exists. It stays undefined
    // before that, so a failure before dispatch reports no url.
    let url: string | undefined
    let dispatched: AxiosRequestConfig | undefined

    try {
      const res = await abortable.run((abortSignal) => {
        // Derived inside `run` because `run` opens the generation and, with `cancelPrevious`, stops the previous call.
        const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

        // `null` omits the body. To send JSON `null`, the caller wraps it.
        const sendsBody = !isNull(body) && !isUndefined(body)

        // `method` defaults to GET, so a body without `method: 'POST'` would silently send a GET without its filter.
        if (method === 'GET' && sendsBody) {
          throw new AnzuFatalError(
            undefined,
            'A GET request does not carry a body -- set method, or pass the value through options.params'
          )
        }

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const requestUrl = isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)

        // `options` first, then the helper-owned keys, so a caller cannot override method, url, body or signal.
        const config: AxiosRequestConfig = {
          ...ownedByHelper(options),
          method,
          url: requestUrl,
          signal: abortSignal,
        }
        if (sendsBody) config.data = JSON.stringify(body)

        const instance = client()

        // Recorded last, after anything that can throw. `JSON.stringify` fails on a circular
        // body, which would otherwise be reported as a request to a url never called.
        url = requestUrl

        return instance.request(config)
      }, signal)

      dispatched = res.config
      // The url the report names, so the message and context agree when an interceptor rewrote the request.
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
   * True while this instance has a request in flight. Unlike a caller-cleared
   * `finally` flag, it does not dip when `cancelPrevious` supersedes a call.
   * It covers only this helper's work. Keep your own flag if it also spans follow-up fetches or mapping.
   * It belongs to the instance. A factory that builds one per call cannot
   * expose `loading`, `abort` or `cancelPrevious`, so hoist the instance first.
   */
  loading: Ref<boolean>
}
