import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import axios, { type AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/services/api/queryBuilder'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/model/error/AnzuApiForbiddenError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
} from '@/model/error/AnzuApiForbiddenOperationError'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import {
  AnzuApiDependencyExistsError,
  axiosErrorResponseHasDependencyExistsData,
} from '@/model/error/AnzuApiDependencyExistsError'
import type { DocId, IntegerId } from '@/types/common'
import { AnzuApiTimeoutError, axiosErrorIsTimeout } from '@/model/error/AnzuApiTimeoutError'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { isDefined, isUndefined } from '@/utils/common'
import type { AxiosClientFn } from '@/labs/api/client.ts'

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

export const useApiFetchByIds = <R>(
  client: AxiosClientFn,
  system: string,
  entity: string,
  urlTemplate: string | undefined = undefined,
  urlParams: UrlParams | undefined = undefined,
  options: AxiosRequestConfig = {},
  isSearchApi = false,
  field = 'id'
): UseApiFetchByIdsReturnType<R> => {
  let abortController: AbortController | null = null

  const executeFetch = async (
    ids: DocId[] | IntegerId[],
    urlTemplateOverride: string | undefined = undefined,
    urlParamsOverride: UrlParams | undefined = undefined
  ): Promise<R> => {
    abortController = new AbortController()

    try {
      const params = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
      const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
      if (isUndefined(template)) throw new Error('Url template is undefined')
      const url =
        (isUndefined(params) ? template : replaceUrlParameters(template, params)) +
        generateByIdsApiQuery(ids, isSearchApi, field)

      const res = await client().get(url, {
        ...options,
        signal: abortController.signal,
      })

      if (!isValidHTTPStatus(res.status)) {
        throw new AnzuApiResponseCodeError(res.status)
      }

      if (res.data?.data) {
        return res.data.data as R
      }

      if (res.status === HTTP_STATUS_NO_CONTENT) {
        return [] as R
      }

      throw new AnzuFatalError()
    } catch (err: any) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return [] as R
      }

      if (isAnzuApiResponseCodeError(err)) {
        throw err
      }

      if (axiosErrorResponseIsForbidden(err)) {
        throw new AnzuApiForbiddenError(err)
      }

      if (axiosErrorResponseHasValidationData(err)) {
        throw new AnzuApiValidationError(err, system, entity, err)
      }

      if (axiosErrorResponseHasDependencyExistsData(err)) {
        throw new AnzuApiDependencyExistsError(err, system, entity, err)
      }

      if (axiosErrorResponseHasForbiddenOperationData(err)) {
        throw new AnzuApiForbiddenOperationError(err, err)
      }

      if (axiosErrorIsTimeout(err)) {
        throw new AnzuApiTimeoutError(err)
      }

      if (axios.isAxiosError(err)) {
        console.error('Axios error: ' + urlTemplate, err.cause)
        throw new AnzuApiAxiosError(err)
      }

      console.error('AnzuFatalError: ', err)
      throw new AnzuFatalError(err)
    } finally {
      abortController = null
    }
  }

  const abortFetch = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  return {
    executeFetch,
    abortFetch,
  }
}

export type UseApiFetchByIdsReturnType<R> = {
  executeFetch: (
    ids: DocId[] | IntegerId[],
    urlTemplateOverride?: string,
    urlParamsOverride?: UrlParams | undefined
  ) => Promise<R>
  abortFetch: () => void
}
