import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { replaceUrlParameters, type UrlParams } from '@/domains/api/utils/apiHelper'
import { isDefined, isNull, isUndefined } from '@/shared/utils/common'
import { isValidHTTPStatus } from '@/domains/api/utils/response'
import type { AxiosRequestConfig, Method } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/shared/statusCodes'
import type { Ref } from 'vue'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import { mapApiError, report } from '@/domains/api/utils/apiErrors'
import {
  type Abortable,
  createAbortable,
  hasBody,
  ownedByHelper,
  requestedUrl,
} from '@/domains/api/composables/request'

export type ExecuteRequestParams<B> = {
  urlTemplate?: string
  urlParams?: UrlParams
  body?: B
  /** Stops this one call, leaving the instance's other calls alone. */
  signal?: AbortSignal
  /**
   * `false`: a failure of this call is still thrown but not sent to the api error logger.
   * For pollers that already reported the first failure, so an outage
   * is not logged on every tick. It is set per call, not per instance.
   */
  report?: boolean
}

export type UseApiRequestParams = {
  client: AxiosClientFn
  method: Method
  system: string
  entity: string
  /** i18n scope for field-level validation failures; defaults to `system` / `entity`. */
  validationSystem?: string
  validationEntity?: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'signal'>
  /** Each call cancels the previous one, as for autocomplete. */
  cancelPrevious?: boolean
}

export type UseApiRequestReturnType<R, B> = {
  execute: (params?: ExecuteRequestParams<B>) => Promise<R>
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

// The url only identifies the request in error messages, and may be missing if the helper failed before
// building it. It is a function because building it costs a render that successful reads do not need.
type Interpret<R> = (res: { status: number; data: unknown }, url: () => string | undefined) => R

const createRequest = <R, B>(params: UseApiRequestParams, interpret: Interpret<R>): UseApiRequestReturnType<R, B> => {
  const {
    client,
    method,
    system,
    entity,
    validationSystem,
    validationEntity,
    urlTemplate,
    urlParams,
    options = {},
    cancelPrevious = false,
  } = params
  const abortable: Abortable = createAbortable({ cancelPrevious })

  const execute = async (executeParams: ExecuteRequestParams<B> = {}): Promise<R> => {
    const {
      urlTemplate: templateOverride,
      urlParams: paramsOverride,
      body,
      signal,
      report: reported = true,
    } = executeParams

    const template = isDefined(templateOverride) ? templateOverride : urlTemplate
    const resolvedParams = isDefined(paramsOverride) ? paramsOverride : urlParams
    // Set in `run` once there is a url. `undefined` means the failure happened before
    // dispatch. An empty string is a real url (the client root) and is rendered as such.
    let url: string | undefined
    // The config axios actually sent. Errors raised after reading the response are not axios errors and have
    // no config. Rebuilding one would describe the request as it would be sent now, not as it was sent.
    let dispatched: AxiosRequestConfig | undefined

    try {
      const res = await abortable.run((abortSignal) => {
        // Throw inside `run` and its try. `run` opens the generation and, with `cancelPrevious`,
        // stops the previous call, so a call that throws before sending still supersedes it.
        // It also gives a missing template the same error class as other failures, not a bare `Error`.
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')
        const requestUrl =
          template !== '' && isDefined(resolvedParams) ? replaceUrlParameters(template, resolvedParams) : template

        const axiosConfig: AxiosRequestConfig = { method, url: requestUrl }
        // `null` omits the body. To send JSON `null`, the caller wraps it.
        if (!isNull(body) && !isUndefined(body)) axiosConfig.data = JSON.stringify(body)

        // `options` goes first so a caller cannot override the method, url, body or signal.
        // The type already forbids this. The spread order protects JavaScript and loosely typed callers.
        const config = { ...ownedByHelper(options), ...axiosConfig, signal: abortSignal }
        const instance = client()

        // Set `url` last, when nothing before the call can throw.
        // If serialising the body or the client factory fails, no request happened and the report must not name a url.
        url = requestUrl

        return instance.request(config)
      }, signal)

      dispatched = res.config
      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      // The url the report names, so the message and context agree when an interceptor rewrote the request.
      return interpret(res, () => requestedUrl(client, url, options, undefined, dispatched))
    } catch (err: unknown) {
      // Built once and shared by both, as in the batch.
      const context = {
        system,
        entity,
        validationSystem,
        validationEntity,
        url: requestedUrl(client, url, options, err, dispatched),
      }

      const error = mapApiError(err, context)

      throw reported ? report(error, context) : error
    }
  }

  return { execute, abort: abortable.abort, loading: abortable.loading }
}

/**
 * A request to an endpoint that always answers with a body.
 * A response without a body breaks the contract and fails like any other error.
 * Use `useApiCommand` for endpoints that answer nothing, and `optionalBody` for endpoints that may answer either.
 * `R` excludes `null`, `undefined` and `void` on purpose, so `useApiRequest<void, …>` does not compile.
 */
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { optionalBody?: false }
): UseApiRequestReturnType<R, B>
/**
 * Same as above, for an endpoint where a missing body is a legitimate answer. The caller must narrow.
 * Use it only where the endpoint is documented that way.
 */
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { optionalBody: true }
): UseApiRequestReturnType<R | undefined, B>
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { optionalBody?: boolean }
): UseApiRequestReturnType<R | undefined, B> {
  const optionalBody = params.optionalBody === true

  return createRequest<R | undefined, B>(params, (res, url) => {
    // 204 is decided by status alone, because it carries no body by definition.
    // 202 may carry a body, so it falls through to `hasBody` like any other success.
    if (res.status === HTTP_STATUS_NO_CONTENT) {
      if (optionalBody) return undefined

      throw new AnzuApiResponseCodeError(res.status)
    }

    if (hasBody(res)) return res.data as R
    if (optionalBody) return undefined

    throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + url())
  })
}

/**
 * A request that reads nothing back, such as a delete or a call that starts work and answers 202.
 * Any successful status resolves. A body, if one arrives, is ignored.
 */
export const useApiCommand = <B = never>(params: UseApiRequestParams): UseApiRequestReturnType<void, B> =>
  createRequest<void, B>(params, () => undefined)
