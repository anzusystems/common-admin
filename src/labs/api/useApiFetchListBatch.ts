import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isDefined, isUndefined } from '@/utils/common'
import { isValidHTTPStatus } from '@/utils/response'
import axios, { type AxiosRequestConfig } from 'axios'
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
import { generateListQuery } from '@/labs/api/useApiFetchList'
import { AnzuApiTimeoutError, axiosErrorIsTimeout } from '@/model/error/AnzuApiTimeoutError'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import { ref } from 'vue'
import { usePagination as usePagination } from '@/labs/filters/pagination'
import { SortOrder } from '@/composables/system/datatableColumns'
import type { AxiosClientFn } from '@/labs/api/client'

export type UseApiFetchListBatchParams = {
  client: AxiosClientFn
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: AxiosRequestConfig
}

export type FetchListBatchParams = {
  urlTemplateOverride?: string
  urlParamsOverride?: UrlParams
  sortBy?: string
  sortDesc?: boolean
  batchSize?: number
  forceElastic?: boolean
}

/**
 * @template R Response type override
 * @deprecated Use object params form:
 *   useApiFetchListBatch({ client, system, entity, urlTemplate, urlParams, options })
 */
export function useApiFetchListBatch<R>(
  client: AxiosClientFn,
  system: string,
  entity: string,
  urlTemplate?: string,
  urlParams?: UrlParams,
  options?: AxiosRequestConfig
): UseApiFetchListBatchReturnType<R>

/**
 * @template R Response type override
 */
export function useApiFetchListBatch<R>(params: UseApiFetchListBatchParams): UseApiFetchListBatchReturnType<R>

export function useApiFetchListBatch<R>(
  clientOrParams: AxiosClientFn | UseApiFetchListBatchParams,
  system?: string,
  entity?: string,
  urlTemplate?: string,
  urlParams?: UrlParams,
  options?: AxiosRequestConfig
): UseApiFetchListBatchReturnType<R> {
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
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    urlTemplateOverrideOrParams: string | FetchListBatchParams | undefined = undefined,
    urlParamsOverride: UrlParams | undefined = undefined,
    sortBy = 'id',
    sortDesc = true,
    batchSize = 100,
    forceElastic = false
  ): Promise<R> => {
    abortController = new AbortController()

    let resolvedUrlTemplateOverride: string | undefined
    let resolvedUrlParamsOverride: UrlParams | undefined
    let resolvedSortBy: string
    let resolvedSortDesc: boolean
    let resolvedBatchSize: number
    let resolvedForceElastic: boolean

    if (typeof urlTemplateOverrideOrParams === 'object' && urlTemplateOverrideOrParams !== null) {
      resolvedUrlTemplateOverride = urlTemplateOverrideOrParams.urlTemplateOverride
      resolvedUrlParamsOverride = urlTemplateOverrideOrParams.urlParamsOverride
      resolvedSortBy = urlTemplateOverrideOrParams.sortBy ?? 'id'
      resolvedSortDesc = urlTemplateOverrideOrParams.sortDesc ?? true
      resolvedBatchSize = urlTemplateOverrideOrParams.batchSize ?? 100
      resolvedForceElastic = urlTemplateOverrideOrParams.forceElastic ?? false
    } else {
      resolvedUrlTemplateOverride = urlTemplateOverrideOrParams
      resolvedUrlParamsOverride = urlParamsOverride
      resolvedSortBy = sortBy
      resolvedSortDesc = sortDesc
      resolvedBatchSize = batchSize
      resolvedForceElastic = forceElastic
    }

    try {
      const searchApi = filterConfig.general.elastic || resolvedForceElastic ? '/search' : ''
      const params = isDefined(resolvedUrlParamsOverride) ? resolvedUrlParamsOverride : resolvedUrlParams
      const template = isDefined(resolvedUrlTemplateOverride) ? resolvedUrlTemplateOverride : resolvedUrlTemplate
      if (isUndefined(template)) throw new Error('Url template is undefined')
      const { pagination } = usePagination(resolvedSortBy, resolvedSortDesc ? SortOrder.Desc : SortOrder.Asc, {
        rowsPerPage: resolvedBatchSize,
      })
      const url = (isUndefined(params) ? template : replaceUrlParameters(template, params)) + searchApi
      const results = [] as unknown as R

      // First page request
      const res = await resolvedClient().get(url + generateListQuery(pagination, filterData, filterConfig), {
        ...resolvedOptions,
        signal: abortController.signal,
      })

      if (!isValidHTTPStatus(res.status)) {
        throw new AnzuApiResponseCodeError(res.status)
      }

      if (res.data) {
        const resData = res.data as unknown as ApiResponseList<R> | ApiInfiniteResponseList<R>
        // @ts-ignore
        results.push(...resData.data)

        if (isApiInfiniteResponseList(resData)) {
          pagination.value.hasNextPage = resData.hasNextPage

          // Handle pagination for infinite lists
          while (pagination.value.hasNextPage) {
            pagination.value.page++
            const nextPageResponse = await resolvedClient().get(
              url + generateListQuery(pagination, filterData, filterConfig),
              {
                ...resolvedOptions,
                signal: abortController.signal,
              }
            )
            const nextPageData = nextPageResponse.data
            // @ts-ignore
            results.push(...nextPageData.data)
            pagination.value.hasNextPage = nextPageData.hasNextPage
          }
        } else if (isApiResponseList(resData)) {
          pagination.value.totalCount = resData.totalCount

          if (pagination.value.totalCount <= pagination.value.rowsPerPage) {
            return results as R
          }

          // Handle pagination for regular lists - fetch all remaining pages in parallel
          const promises: Promise<any>[] = []
          const numPages = Math.ceil(pagination.value.totalCount / pagination.value.rowsPerPage)

          for (let i = 1; i < numPages; i++) {
            // Start from 1 since we already fetched page 0
            const pageCopy = { ...pagination.value, page: i + 1 }
            const paginationRef = ref(pageCopy)
            promises.push(
              resolvedClient().get(url + generateListQuery(paginationRef, filterData, filterConfig), {
                ...resolvedOptions,
                signal: abortController.signal,
              })
            )
          }

          const allResponses = await Promise.all(promises)
          allResponses.forEach((pageResponse) => {
            // @ts-ignore
            results.push(...pageResponse.data.data)
          })
        }

        return results as R
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

interface ExecuteFetchListBatchFn<R> {
  /**
   * @deprecated Use object params form:
   *   executeFetch(filterData, filterConfig,
   *     { urlTemplateOverride, urlParamsOverride, sortBy, sortDesc, batchSize, forceElastic })
   */
  (
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    urlTemplateOverride?: string,
    urlParamsOverride?: UrlParams,
    sortBy?: string,
    sortDesc?: boolean,
    batchSize?: number,
    forceElastic?: boolean
  ): Promise<R>
  (filterData: FilterData<any>, filterConfig: FilterConfig<any>, params?: FetchListBatchParams): Promise<R>
}

export type UseApiFetchListBatchReturnType<R> = {
  executeFetch: ExecuteFetchListBatchFn<R>
  abortFetch: () => void
}
