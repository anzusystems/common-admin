import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isDefined, isNull, isUndefined } from '@/utils/common'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig, Method } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import type { Ref } from 'vue'
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

// The url is only ever used to say which request the message is about, and a helper that failed
// before it had one still has to be able to say something. Handed over as a function because
// building it costs a render and the successful reading of a response does not need it.
type Interpret<R> = (res: { status: number; data: unknown }, url: () => string | undefined) => R

const createRequest = <R, B>(params: UseApiRequestParams, interpret: Interpret<R>): UseApiRequestReturnType<R, B> => {
  const { client, method, system, entity, urlTemplate, urlParams, options = {}, cancelPrevious = false } = params
  const abortable: Abortable = createAbortable({ cancelPrevious })

  const execute = async (executeParams: ExecuteRequestParams<B> = {}): Promise<R> => {
    const { urlTemplate: templateOverride, urlParams: paramsOverride, body, signal } = executeParams

    const template = isDefined(templateOverride) ? templateOverride : urlTemplate
    const resolvedParams = isDefined(paramsOverride) ? paramsOverride : urlParams
    // Assigned inside `run`, at the moment there is a url to ask for; undefined until then, which is
    // what a failure before dispatch honestly reports. An empty string is a different answer: that
    // is a call whose url really is the client root, and it gets rendered as one.
    let url: string | undefined
    // The config axios used, kept for the failures this helper raises after reading the response:
    // they are not axios errors and carry no config of their own, and rebuilding one describes the
    // request as the client would send it now rather than as it was sent.
    let dispatched: AxiosRequestConfig | undefined

    try {
      const res = await abortable.run((abortSignal) => {
        // Inside `run`, and inside the try with it: `run` opens the generation and, with
        // `cancelPrevious`, stops the call before this one, so a call that throws on its way to the
        // wire still supersedes its predecessor instead of leaving it current. And a caller that
        // forgot the template gets the same error class as every other failure rather than a bare
        // `Error` nothing in the fleet is written to catch.
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')
        const requestUrl =
          template !== '' && isDefined(resolvedParams) ? replaceUrlParameters(template, resolvedParams) : template

        const axiosConfig: AxiosRequestConfig = { method, url: requestUrl }
        // `null` omits the body, as it always has -- a caller that means to send JSON `null` wraps it.
        if (!isNull(body) && !isUndefined(body)) axiosConfig.data = JSON.stringify(body)

        // `options` first, then what this helper owns: a caller cannot reach in and set the method,
        // the url, the body or the signal through it. The type says so too; this is for javascript
        // callers and for anything typed loosely enough to slip past it.
        const config = { ...ownedByHelper(options), ...axiosConfig, signal: abortSignal }
        const instance = client()

        // Recorded last, when nothing between here and the call can throw any more. A body that will
        // not serialise, or a client factory that fails, is a request that never happened, and the
        // report has to be able to say so rather than name a url nobody asked for.
        url = requestUrl

        return instance.request(config)
      }, signal)

      dispatched = res.config
      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      // The url the report will name, so a message and the context beside it cannot disagree about
      // which request failed when an interceptor rewrote it on the way out.
      return interpret(res, () => requestedUrl(client, url, options, undefined, dispatched))
    } catch (err: unknown) {
      // Built once and handed to both, the way the batch does it: half the work on the failure path,
      // and one place that could go wrong instead of two.
      const context = { system, entity, url: requestedUrl(client, url, options, err, dispatched) }

      throw report(mapApiError(err, context), context)
    }
  }

  return { execute, abort: abortable.abort, loading: abortable.loading }
}

/**
 * A request to an endpoint that always answers with a body.
 *
 * A response without one is the endpoint breaking its own contract, not an empty answer, so it fails
 * like any other error rather than handing back a value the declared type does not admit. An
 * endpoint that answers nothing is `useApiCommand`; one that may answer either is `optionalBody`.
 *
 * `R` excludes `null`, `undefined` and `void` on purpose: those are ways of saying "no body", and a
 * caller saying that has chosen the wrong helper. It is also what makes the migration visible --
 * every `useApiRequest<void, …>` in the fleet stops compiling and names itself.
 */
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { optionalBody?: false }
): UseApiRequestReturnType<R, B>
/**
 * The same, for an endpoint where a body is optional and its absence is a legitimate answer. The
 * caller narrows, which is the point -- use it only where the endpoint really is documented that way.
 */
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { optionalBody: true }
): UseApiRequestReturnType<R | undefined, B>
export function useApiRequest<R extends NonNullable<unknown>, B = never>(
  params: UseApiRequestParams & { optionalBody?: boolean }
): UseApiRequestReturnType<R | undefined, B> {
  const optionalBody = params.optionalBody === true

  return createRequest<R | undefined, B>(params, (res, url) => {
    // 204 is decided by status alone, before the body is looked at: it carries none by definition,
    // so anything that arrived with one is not something to hand on. A 202 may legitimately carry a
    // body, which is why it is not in here and falls through to `hasBody` like any other success.
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
 * A request that asks the backend to do something and reads nothing back -- a delete, or a call that
 * only starts work and answers 202. Any successful status resolves; a body, if one arrives, is
 * ignored rather than typed.
 */
export const useApiCommand = <B = never>(params: UseApiRequestParams): UseApiRequestReturnType<void, B> =>
  createRequest<void, B>(params, () => undefined)
