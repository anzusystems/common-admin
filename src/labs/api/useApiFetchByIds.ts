import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig } from 'axios'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import type { DocId, IntegerId } from '@/types/common'
import { isDefined, isUndefined } from '@/utils/common'
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

/**
 * @template T Type used for request payload, by default same as Response type
 * @template R Response type override, optional
 */
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

    const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
    const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
    const templateMissing = isUndefined(template)
    const baseUrl = isUndefined(resolvedParams)
      ? (template ?? '')
      : replaceUrlParameters(template ?? '', resolvedParams)
    // Built inside the try below: the query builder walks caller-supplied values and can throw.
    let url = baseUrl

    try {
      // Inside the try, so a caller that forgot the template gets the same error class as every
      // other failure rather than a bare `Error`.
      if (templateMissing) throw new AnzuFatalError(undefined, 'Url template is undefined')

      url = baseUrl + generateByIdsApiQuery(ids, isSearchApi, field)

      const res = await abortable.run(
        (abortSignal) => client().get(url, { ...ownedByHelper(options), signal: abortSignal }),
        signal
      )

      if (!isValidHTTPStatus(res.status)) throw new AnzuApiResponseCodeError(res.status)

      // Nothing matched the ids -- an empty answer, not a broken one.
      if (res.status === HTTP_STATUS_NO_CONTENT) return []

      if (!hasBody(res)) {
        throw new AnzuApiResponseCodeError(res.status, undefined, 'Expected a response body, url: ' + url)
      }

      return readListBody<T>(res.data, res.status, url).items
    } catch (err: unknown) {
      // Built once and handed to both, the way the batch does it: half the work on the failure path,
      // and one place that could go wrong instead of two.
      const context = { system, entity, url: requestedUrl(client, url, options.params) }

      throw report(mapApiError(err, context), context)
    }
  }

  return { execute, abort: abortable.abort }
}

export type UseApiFetchByIdsReturnType<T> = {
  execute: (ids: DocId[] | IntegerId[], params?: FetchByIdsParams) => Promise<T[]>
  abort: () => void
}
