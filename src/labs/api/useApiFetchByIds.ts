import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import axios, { type AxiosRequestConfig } from 'axios'
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
}

export type FetchByIdsParams = {
  urlTemplateOverride?: string
  urlParamsOverride?: UrlParams
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

/**
 * @deprecated Use object params form:
 *   useApiFetchByIds({ client, system, entity, urlTemplate, urlParams, options, isSearchApi, field })
 */
export function useApiFetchByIds<R>(
  client: AxiosClientFn,
  system: string,
  entity: string,
  urlTemplate?: string,
  urlParams?: UrlParams,
  options?: AxiosRequestConfig,
  isSearchApi?: boolean,
  field?: string
): UseApiFetchByIdsReturnType<R>

export function useApiFetchByIds<R>(params: UseApiFetchByIdsParams): UseApiFetchByIdsReturnType<R>

export function useApiFetchByIds<R>(
  clientOrParams: AxiosClientFn | UseApiFetchByIdsParams,
  system?: string,
  entity?: string,
  urlTemplate?: string,
  urlParams?: UrlParams,
  options?: AxiosRequestConfig,
  isSearchApi?: boolean,
  field?: string
): UseApiFetchByIdsReturnType<R> {
  let resolvedClient: AxiosClientFn
  let resolvedSystem: string
  let resolvedEntity: string
  let resolvedUrlTemplate: string | undefined
  let resolvedUrlParams: UrlParams | undefined
  let resolvedOptions: AxiosRequestConfig
  let resolvedIsSearchApi: boolean
  let resolvedField: string

  if (typeof clientOrParams === 'function') {
    resolvedClient = clientOrParams
    resolvedSystem = system!
    resolvedEntity = entity!
    resolvedUrlTemplate = urlTemplate
    resolvedUrlParams = urlParams
    resolvedOptions = options ?? {}
    resolvedIsSearchApi = isSearchApi ?? false
    resolvedField = field ?? 'id'
  } else {
    resolvedClient = clientOrParams.client
    resolvedSystem = clientOrParams.system
    resolvedEntity = clientOrParams.entity
    resolvedUrlTemplate = clientOrParams.urlTemplate
    resolvedUrlParams = clientOrParams.urlParams
    resolvedOptions = clientOrParams.options ?? {}
    resolvedIsSearchApi = clientOrParams.isSearchApi ?? false
    resolvedField = clientOrParams.field ?? 'id'
  }

  let abortController: AbortController | null = null

  const executeFetch = async (
    ids: DocId[] | IntegerId[],
    urlTemplateOverrideOrParams: string | FetchByIdsParams | undefined = undefined,
    urlParamsOverride: UrlParams | undefined = undefined
  ): Promise<R> => {
    abortController = new AbortController()

    let resolvedUrlTemplateOverride: string | undefined
    let resolvedUrlParamsOverride: UrlParams | undefined

    if (typeof urlTemplateOverrideOrParams === 'object' && urlTemplateOverrideOrParams !== null) {
      resolvedUrlTemplateOverride = urlTemplateOverrideOrParams.urlTemplateOverride
      resolvedUrlParamsOverride = urlTemplateOverrideOrParams.urlParamsOverride
    } else {
      resolvedUrlTemplateOverride = urlTemplateOverrideOrParams
      resolvedUrlParamsOverride = urlParamsOverride
    }

    try {
      const params = isDefined(resolvedUrlParamsOverride) ? resolvedUrlParamsOverride : resolvedUrlParams
      const template = isDefined(resolvedUrlTemplateOverride) ? resolvedUrlTemplateOverride : resolvedUrlTemplate
      if (isUndefined(template)) throw new Error('Url template is undefined')
      const url =
        (isUndefined(params) ? template : replaceUrlParameters(template, params)) +
        generateByIdsApiQuery(ids, resolvedIsSearchApi, resolvedField)

      const res = await resolvedClient().get(url, {
        ...resolvedOptions,
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
        throw new AnzuApiValidationError(err, resolvedSystem, resolvedEntity, err)
      }

      if (axiosErrorResponseHasDependencyExistsData(err)) {
        throw new AnzuApiDependencyExistsError(err, resolvedSystem, resolvedEntity, err)
      }

      if (axiosErrorResponseHasForbiddenOperationData(err)) {
        throw new AnzuApiForbiddenOperationError(err, err)
      }

      if (axiosErrorIsTimeout(err)) {
        throw new AnzuApiTimeoutError(err)
      }

      if (axios.isAxiosError(err)) {
        console.error('Axios error: ' + resolvedUrlTemplate, err.cause)
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

interface ExecuteFetchByIdsFn<R> {
  /** @deprecated Use object params form: executeFetch(ids, { urlTemplateOverride, urlParamsOverride }) */
  (ids: DocId[] | IntegerId[], urlTemplateOverride?: string, urlParamsOverride?: UrlParams): Promise<R>
  (ids: DocId[] | IntegerId[], params?: FetchByIdsParams): Promise<R>
}

export type UseApiFetchByIdsReturnType<R> = {
  executeFetch: ExecuteFetchByIdsFn<R>
  abortFetch: () => void
}
