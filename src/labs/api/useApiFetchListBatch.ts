import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isUndefined } from '@/utils/common'
import { isValidHTTPStatus } from '@/utils/response'
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
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

/**
 * @template R Response type override
 */
export const useApiFetchListBatch = <R>(
  client: () => AxiosInstance,
  system: string,
  entity: string,
  options: AxiosRequestConfig = {}
): UseApiFetchListBatchReturnType<R> => {
  let abortController: AbortController | null = null

  const executeFetch = async (
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    urlTemplate: string,
    urlParams: UrlParams | undefined = undefined,
    sortBy = 'id',
    sortDesc = true,
    batchSize = 100,
    forceElastic = false
  ): Promise<R> => {
    abortController = new AbortController()

    try {
      const searchApi = (filterConfig.general.elastic || forceElastic) ? '/search' : ''
      const pagination = usePagination({ key: sortBy, order: sortDesc ? 'desc' : 'asc' })
      pagination.value.rowsPerPage = batchSize
      const url = (isUndefined(urlParams) ? urlTemplate : replaceUrlParameters(urlTemplate, urlParams)) + searchApi
      const results = [] as unknown as R

      // First page request
      const res = await client().get(url + generateListQuery(pagination, filterData, filterConfig), {
        ...options,
        signal: abortController.signal
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
            const nextPageResponse = await client().get(url + generateListQuery(pagination, filterData, filterConfig), {
              ...options,
              signal: abortController.signal
            })
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

          for (let i = 1; i < numPages; i++) { // Start from 1 since we already fetched page 0
            const pageCopy = { ...pagination.value, page: i + 1 }
            const paginationRef = ref(pageCopy)
            promises.push(
              client().get(url + generateListQuery(paginationRef, filterData, filterConfig), {
                ...options,
                signal: abortController.signal
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
        console.error('Axios error: ', err.cause)
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

export type UseApiFetchListBatchReturnType<R> = {
  executeFetch: (
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    urlTemplate: string,
    urlParams?: UrlParams,
    sortBy?: string,
    sortDesc?: boolean,
    batchSize?: number,
    forceElastic?: boolean
  ) => Promise<R>
  abortFetch: () => void
}
