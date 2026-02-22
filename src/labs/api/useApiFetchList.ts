import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { useApiQueryBuilder } from '@/labs/api/useApiQueryBuilder'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/model/error/AnzuApiForbiddenError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import type { ApiInfiniteResponseList, ApiResponseList } from '@/types/ApiResponse'
import { isApiInfiniteResponseList, isApiResponseList } from '@/types/ApiResponse'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
} from '@/model/error/AnzuApiForbiddenOperationError'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import {
  AnzuApiDependencyExistsError,
  axiosErrorResponseHasDependencyExistsData,
} from '@/model/error/AnzuApiDependencyExistsError'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { Ref } from 'vue'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiTimeoutError, axiosErrorIsTimeout } from '@/model/error/AnzuApiTimeoutError'
import { isDefined, isUndefined } from '@/utils/common'
import type { Pagination } from '@/labs/filters/pagination'
import { SortOrder } from '@/composables/system/datatableColumns'
import type { AxiosClientFn } from '@/labs/api/client'

export type UseApiFetchListParams = {
  client: AxiosClientFn
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: AxiosRequestConfig
}

export type FetchListParams = {
  urlTemplateOverride?: string
  urlParamsOverride?: UrlParams
  forceElastic?: boolean
}

export const generateListQuery = (
  pagination: Ref<Pagination>,
  filterData: FilterData<any>,
  filterConfig: FilterConfig<any>
): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, querySetFilters } = useApiQueryBuilder()
  querySetLimit(pagination.value.rowsPerPage)
  querySetOffset(pagination.value.page, pagination.value.rowsPerPage)
  if (pagination.value.sortBy) {
    querySetOrder(pagination.value.sortBy.key, pagination.value.sortBy.order === SortOrder.Desc)
  }
  querySetFilters(filterData, filterConfig)
  return queryBuild()
}

/**
 * @template R Response type override, optional
 * @deprecated Use object params form:
 *   useApiFetchList({ client, system, entity, urlTemplate, urlParams, options })
 */
export function useApiFetchList<R>(
  client: AxiosClientFn,
  system: string,
  entity: string,
  urlTemplate?: string,
  urlParams?: UrlParams,
  options?: AxiosRequestConfig
): UseApiFetchListReturnType<R>

/**
 * @template R Response type override, optional
 */
export function useApiFetchList<R>(params: UseApiFetchListParams): UseApiFetchListReturnType<R>

export function useApiFetchList<R>(
  clientOrParams: AxiosClientFn | UseApiFetchListParams,
  system?: string,
  entity?: string,
  urlTemplate?: string,
  urlParams?: UrlParams,
  options?: AxiosRequestConfig
): UseApiFetchListReturnType<R> {
  let resolvedClient: AxiosClientFn
  let resolvedSystem: string
  let resolvedEntity: string
  let resolvedUrlTemplate: string | undefined
  let resolvedUrlParams: UrlParams | undefined
  let resolvedOptions: AxiosRequestConfig

  if (typeof clientOrParams === 'function') {
    resolvedClient = clientOrParams
    resolvedSystem = system!
    resolvedEntity = entity!
    resolvedUrlTemplate = urlTemplate
    resolvedUrlParams = urlParams
    resolvedOptions = options ?? {}
  } else {
    resolvedClient = clientOrParams.client
    resolvedSystem = clientOrParams.system
    resolvedEntity = clientOrParams.entity
    resolvedUrlTemplate = clientOrParams.urlTemplate
    resolvedUrlParams = clientOrParams.urlParams
    resolvedOptions = clientOrParams.options ?? {}
  }

  let abortController: AbortController | null = null

  const executeFetch = async (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    urlTemplateOverrideOrParams: string | FetchListParams | undefined = undefined,
    urlParamsOverride: UrlParams | undefined = undefined,
    forceElastic = false
  ): Promise<R> => {
    abortController = new AbortController()

    let resolvedUrlTemplateOverride: string | undefined
    let resolvedUrlParamsOverride: UrlParams | undefined
    let resolvedForceElastic: boolean

    if (typeof urlTemplateOverrideOrParams === 'object' && urlTemplateOverrideOrParams !== null) {
      resolvedUrlTemplateOverride = urlTemplateOverrideOrParams.urlTemplateOverride
      resolvedUrlParamsOverride = urlTemplateOverrideOrParams.urlParamsOverride
      resolvedForceElastic = urlTemplateOverrideOrParams.forceElastic ?? false
    } else {
      resolvedUrlTemplateOverride = urlTemplateOverrideOrParams
      resolvedUrlParamsOverride = urlParamsOverride
      resolvedForceElastic = forceElastic
    }

    try {
      const searchApi = filterConfig.general.elastic || resolvedForceElastic ? '/search' : ''
      const params = isDefined(resolvedUrlParamsOverride) ? resolvedUrlParamsOverride : resolvedUrlParams
      const template = isDefined(resolvedUrlTemplateOverride) ? resolvedUrlTemplateOverride : resolvedUrlTemplate
      if (isUndefined(template)) throw new Error('Url template is undefined')
      const url =
        (isUndefined(params) ? template : replaceUrlParameters(template, params)) +
        searchApi +
        generateListQuery(pagination, filterData, filterConfig)

      const res = await resolvedClient().get(url, {
        ...resolvedOptions,
        signal: abortController.signal,
      })

      if (!isValidHTTPStatus(res.status)) {
        throw new AnzuApiResponseCodeError(res.status)
      }

      if (res.data) {
        const resData = res.data as unknown as ApiResponseList<R> | ApiInfiniteResponseList<R>
        if (isApiInfiniteResponseList(resData)) {
          pagination.value = {
            ...pagination.value,
            ...{ hasNextPage: resData.hasNextPage, currentViewCount: res.data.data.length },
          }
        } else if (isApiResponseList(resData)) {
          pagination.value = {
            ...pagination.value,
            ...{ totalCount: resData.totalCount, currentViewCount: res.data.data.length },
          }
        }
        return resData.data
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

interface ExecuteFetchListFn<R> {
  /**
   * @deprecated Use object params form:
   *   executeFetch(pagination, filterData, filterConfig, { urlTemplateOverride, urlParamsOverride, forceElastic })
   */
  (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    urlTemplateOverride?: string | undefined,
    urlParamsOverride?: UrlParams | undefined,
    forceElastic?: boolean
  ): Promise<R>
  (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    params?: FetchListParams
  ): Promise<R>
}

export type UseApiFetchListReturnType<R> = {
  executeFetch: ExecuteFetchListFn<R>
  abortFetch: () => void
}
