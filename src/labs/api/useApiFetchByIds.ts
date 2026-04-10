import {
  AnzuApiResponseCodeError,
  isAnzuApiResponseCodeError,
} from '@/model/error/AnzuApiResponseCodeError'
import {
  AnzuApiValidationError,
  axiosErrorResponseHasValidationData,
} from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import axios, { type AxiosRequestConfig } from 'axios'
import {
  AnzuApiForbiddenError,
  axiosErrorResponseIsForbidden,
} from '@/model/error/AnzuApiForbiddenError'
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
import type { AxiosClientFn } from '@/labs/api/client'
import { useApiQueryBuilder } from '@/labs/api/useApiQueryBuilder'

export type UseApiFetchByIdsParams = {
  client: AxiosClientFn
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: AxiosRequestConfig
  isSearchApi?: boolean
  field?: string
  silentConsoleError?: boolean
}

export type FetchByIdsParams = {
  urlTemplate?: string
  urlParams?: UrlParams
}

/**
 * @template T Type used for request payload, by default same as Response type
 * @template R Response type override, optional
 */
const generateByIdsApiQuery = (
  ids: IntegerId[] | DocId[],
  isSearchApi: boolean,
  field = 'id',
): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, queryAddFilter, queryAdd } =
    useApiQueryBuilder()
  const limit = ids.length // todo add batch fetch
  querySetLimit(limit)
  querySetOffset(1, limit)
  querySetOrder(field, false)
  if (isSearchApi) queryAdd(field, ids.join(','))
  else queryAddFilter('in', field, ids.join(','))

  return queryBuild()
}

export const useApiFetchByIds = <R>(
  params: UseApiFetchByIdsParams,
): UseApiFetchByIdsReturnType<R> => {
  const {
    client,
    system,
    entity,
    urlTemplate,
    urlParams,
    options = {},
    isSearchApi = false,
    field = 'id',
    silentConsoleError = false,
  } = params

  let abortController: AbortController | null = null

  const executeFetch = async (
    ids: DocId[] | IntegerId[],
    fetchParams: FetchByIdsParams = {},
  ): Promise<R> => {
    abortController = new AbortController()

    const { urlTemplate: urlTemplateOverride, urlParams: urlParamsOverride } = fetchParams

    try {
      const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
      const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
      if (isUndefined(template)) throw new Error('Url template is undefined')
      const url =
        (isUndefined(resolvedParams) ? template : replaceUrlParameters(template, resolvedParams)) +
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
        throw new AnzuApiForbiddenError(err, err.config?.url)
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
        if (!silentConsoleError) console.error('Axios error: ' + urlTemplate, ...(err.cause ? [err.cause] : []))
        throw new AnzuApiAxiosError(err)
      }

      if (!silentConsoleError) console.error('AnzuFatalError: ', err)
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
  executeFetch: (ids: DocId[] | IntegerId[], params?: FetchByIdsParams) => Promise<R>
  abortFetch: () => void
}
