import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/domains/api/utils/apiHelper'
import { isValidHTTPStatus } from '@/domains/api/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/shared/statusCodes'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isDefined, isUndefined } from '@/shared/utils/common'
import type { Ref } from 'vue'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import { useApiQueryBuilder } from '@/domains/api/composables/useApiQueryBuilder'
import { mapApiError, report } from '@/domains/api/utils/apiErrors'
import { createAbortable, hasBody, ownedByHelper, requestedUrl } from '@/domains/api/composables/request'
import { readListBody } from '@/domains/api/utils/listBody'

export type UseApiFetchByIdsParams = {
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
  isSearchApi?: boolean
  field?: string
  cancelPrevious?: boolean
}

export type FetchByIdsParams = {
  urlTemplate?: string
  urlParams?: UrlParams
  /**
   * Stops this one call, leaving the instance's other calls alone.
   */
  signal?: AbortSignal
}

/**
 * Ids per request. A cache drains all queued ids at once, and a thousand ids in
 * a query string exceed the default 8 KB proxy request line limit, giving a 414.
 */
export const FETCH_BY_IDS_BATCH_SIZE = 100

const generateByIdsApiQuery = (ids: IntegerId[] | DocId[], isSearchApi: boolean, field = 'id'): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, queryAddFilter, queryAdd } = useApiQueryBuilder()
  const limit = ids.length
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
    validationSystem,
    validationEntity,
    urlTemplate,
    urlParams,
    options = {},
    isSearchApi = false,
    field = 'id',
    cancelPrevious = false,
  } = params
  const abortable = createAbortable({ cancelPrevious })

  const executeBatch = async (ids: DocId[] | IntegerId[], fetchParams: FetchByIdsParams): Promise<T[]> => {
    const { urlTemplate: urlTemplateOverride, urlParams: urlParamsOverride, signal } = fetchParams

    // Assigned inside `run` once a url exists. It stays undefined
    // before that, so a failure before dispatch reports no url.
    let url: string | undefined
    // The config axios used, kept for failures raised after reading the response. Those carry
    // no config, and a rebuild would describe the request as the client would send it now.
    let dispatched: AxiosRequestConfig | undefined

    try {
      const res = await abortable.run((abortSignal) => {
        // Derived inside `run` because `run` opens the generation and, with `cancelPrevious`, stops the
        // previous call. Work done before it could leave the predecessor running if this call never dispatches.
        // Inside the try so a missing template raises the same error class as other failures.
        const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
        if (isUndefined(template)) throw new AnzuFatalError(undefined, 'Url template is undefined')

        const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
        const baseUrl = isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)
        const requestUrl = baseUrl + generateByIdsApiQuery(ids, isSearchApi, field)
        const instance = client()

        // Recorded last, when nothing before the call can throw. A failing
        // client factory means no request happened, so no url is reported.
        url = requestUrl

        return instance.get(requestUrl, { ...ownedByHelper(options), signal: abortSignal })
      }, signal)

      dispatched = res.config
      // The url the report names, so the message and context agree when an interceptor rewrote the request.
      const asSent = () => requestedUrl(client, url, options, undefined, dispatched)
      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      // Nothing matched the ids -- an empty answer, not a broken one.
      if (res.status === HTTP_STATUS_NO_CONTENT) return []

      if (!hasBody(res)) {
        throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + asSent())
      }

      return readListBody<T>(res.data, res.status, asSent()).items
    } catch (err: unknown) {
      // Built once and shared by both, as in the batch.
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

  // Batches run sequentially. In parallel, `cancelPrevious` would make each
  // batch stop the one before it. A failed batch fails the whole call.
  const execute = async (ids: DocId[] | IntegerId[], fetchParams: FetchByIdsParams = {}): Promise<T[]> => {
    if (ids.length <= FETCH_BY_IDS_BATCH_SIZE) return executeBatch(ids, fetchParams)
    const items: T[] = []
    for (let start = 0; start < ids.length; start += FETCH_BY_IDS_BATCH_SIZE) {
      const batch = ids.slice(start, start + FETCH_BY_IDS_BATCH_SIZE) as DocId[] | IntegerId[]
      items.push(...(await executeBatch(batch, fetchParams)))
    }
    return items
  }

  return { execute, abort: abortable.abort, loading: abortable.loading }
}

export type UseApiFetchByIdsReturnType<T> = {
  execute: (ids: DocId[] | IntegerId[], params?: FetchByIdsParams) => Promise<T[]>
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
