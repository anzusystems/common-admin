import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { Pagination2 } from '@/types/Pagination'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { useApiQueryBuilder } from '@/services/api/v2/useApiQueryBuilder.ts'
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
import type { FilterConfig, FilterData } from '@/composables/filter/filterFactory'
import type { Ref } from 'vue'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'

export const generateListQuery = (
  pagination: Ref<Pagination2>,
  filterData: FilterData<any>,
  filterConfig: FilterConfig<any>
): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, querySetFilters } = useApiQueryBuilder()
  querySetLimit(pagination.value.rowsPerPage)
  querySetOffset(pagination.value.page, pagination.value.rowsPerPage)
  if (pagination.value.sortBy) {
    querySetOrder(pagination.value.sortBy.key, pagination.value.sortBy.order === 'desc')
  }
  querySetFilters(filterData, filterConfig)
  return queryBuild()
}

/**
 * @template R Response type override, optional
 */
export const useApiFetchList = <R>(
  client: () => AxiosInstance,
  urlTemplate: string,
  urlParams: UrlParams = {},
  system: string,
  entity: string,
  options: AxiosRequestConfig = {}
): UseFetchListReturnType<R> => {
  let abortController: AbortController | null = null

  const executeFetch = async (
    pagination: Ref<Pagination2>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ): Promise<R> => {
    abortController = new AbortController()

    try {
      const searchApi = filterConfig.general.elastic ? '/search' : ''
      const url =
        replaceUrlParameters(urlTemplate, urlParams) +
        searchApi +
        generateListQuery(pagination, filterData, filterConfig)

      const res = await client().get(url, {
        ...options,
        signal: abortController.signal,
      })

      if (!isValidHTTPStatus(res.status)) {
        throw new AnzuApiResponseCodeError(res.status)
      }

      if (res.data) {
        const resData = res.data as unknown as ApiResponseList<R> | ApiInfiniteResponseList<R>
        if (isApiInfiniteResponseList(resData)) {
          pagination.value.hasNextPage = res.data.hasNextPage
        } else if (isApiResponseList(resData)) {
          pagination.value.totalCount = resData.totalCount
        }
        pagination.value.currentViewCount = res.data.data.length
        return res.data.data
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

export type UseFetchListReturnType<R> = {
  executeFetch: (
    pagination: Ref<Pagination2>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ) => Promise<R>
  abortFetch: () => void
}
