import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isDefined, isNull, isUndefined } from '@/utils/common'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig, Method } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import type { AxiosClientFn } from '@/labs/api/client'
import { mapApiError, report } from '@/labs/api/apiErrors'
import { type Abortable, createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/labs/api/request'

export type ExecuteRequestParams<B> = {
  urlTemplate?: string
  urlParams?: UrlParams
  body?: B
  /** Stops this one call, leaving the instance's other calls alone. */
  signal?: AbortSignal
}

export type UseApiRequestParams = {
  client: AxiosClientFn
  method: Method
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  /** Anything axios takes except what this helper decides: the method, the url, the body and the signal. */
  options?: Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'signal'>
  /** Each call supersedes the one before it -- the autocomplete shape. */
  cancelPrevious?: boolean
}

export type UseApiRequestReturnType<R, B> = {
  execute: (params?: ExecuteRequestParams<B>) => Promise<R>
  abort: () => void
}

type Interpret<R> = (res: { status: number; data: unknown }, url: string) => R

const createRequest = <R, B>(params: UseApiRequestParams, interpret: Interpret<R>): UseApiRequestReturnType<R, B> => {
  const { client, method, system, entity, urlTemplate, urlParams, options = {}, cancelPrevious = false } = params
  const abortable: Abortable = createAbortable({ cancelPrevious })

  const execute = async (executeParams: ExecuteRequestParams<B> = {}): Promise<R> => {
    const { urlTemplate: templateOverride, urlParams: paramsOverride, body, signal } = executeParams

    const template = isDefined(templateOverride) ? templateOverride : urlTemplate
    const resolvedParams = isDefined(paramsOverride) ? paramsOverride : urlParams
    const url = isUndefined(template)
      ? ''
      : template !== '' && isDefined(resolvedParams)
        ? replaceUrlParameters(template, resolvedParams)
        : template

    try {
      // Inside the try, so a caller that forgot the template gets the same error class as every
      // other failure rather than a bare `Error` nothing in the fleet is written to catch.
      if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

      const res = await abortable.run((abortSignal) => {
        const axiosConfig: AxiosRequestConfig = { method, url }
        // `null` omits the body, as it always has -- a caller that means to send JSON `null` wraps it.
        if (!isNull(body) && !isUndefined(body)) axiosConfig.data = JSON.stringify(body)

        // `options` first, then what this helper owns: a caller cannot reach in and set the method,
        // the url, the body or the signal through it. The type says so too; this is for javascript
        // callers and for anything typed loosely enough to slip past it.
        return client().request({ ...ownedByHelper(options), ...axiosConfig, signal: abortSignal })
      }, signal)

      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      return interpret(res, url)
    } catch (err: unknown) {
      // Built once and handed to both, the way the batch does it: half the work on the failure path,
      // and one place that could go wrong instead of two.
      const context = { system, entity, url: requestedUrl(client, url, options.params) }

      throw report(mapApiError(err, context), context)
    }
  }

  return { execute, abort: abortable.abort }
}

/**
 * A request to an endpoint that always answers with a body.
 *
 * A response without one is the endpoint breaking its own contract, not an empty answer, so it fails
 * like any other error rather than handing back a value the declared type does not admit. An
 * endpoint that answers nothing is `useApiCommand`; one that may answer either is `allowEmpty`.
 *
 * `R` excludes `null`, `undefined` and `void` on purpose: those are ways of saying "no body", and a
 * caller saying that has chosen the wrong helper. It is also what makes the migration visible --
 * every `useApiCommand<…>` in the fleet stops compiling and names itself.
 */
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { allowEmpty?: false }
): UseApiRequestReturnType<R, B>
/**
 * The same, for an endpoint where a body is optional and its absence is a legitimate answer. The
 * caller narrows, which is the point -- use it only where the endpoint really is documented that way.
 */
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { allowEmpty: true }
): UseApiRequestReturnType<R | undefined, B>
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { allowEmpty?: boolean }
): UseApiRequestReturnType<R | undefined, B> {
  const allowEmpty = params.allowEmpty === true

  return createRequest<R | undefined, B>(params, (res, url) => {
    // 204 is decided by status alone, before the body is looked at: it carries none by definition,
    // so anything that arrived with one is not something to hand on. A 202 may legitimately carry a
    // body, which is why it is not in here and falls through to `hasBody` like any other success.
    if (res.status === HTTP_STATUS_NO_CONTENT) {
      if (allowEmpty) return undefined

      throw new AnzuApiResponseCodeError(res.status)
    }

    if (hasBody(res as never)) return res.data as R
    if (allowEmpty) return undefined

    throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + url)
  })
}

/**
 * A request that asks the backend to do something and reads nothing back -- a delete, or a call that
 * only starts work and answers 202. Any successful status resolves; a body, if one arrives, is
 * ignored rather than typed.
 */
export const useApiCommand = <B = never>(params: UseApiRequestParams): UseApiRequestReturnType<void, B> =>
  createRequest<void, B>(params, () => undefined)
