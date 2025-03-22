import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import type { FilterBag } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import { isDefined } from '@/utils/common'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/services/api/queryBuilder'
import { usePagination } from '@/composables/system/pagination'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/model/error/AnzuApiForbiddenError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
} from '@/model/error/AnzuApiForbiddenOperationError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { isValidHTTPStatus } from '@/utils/response'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import {
  type ApiInfiniteResponseList,
  type ApiResponseList,
  isApiInfiniteResponseList,
  isApiResponseList,
} from '@/types/ApiResponse'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import {
  AnzuApiDependencyExistsError,
  axiosErrorResponseHasDependencyExistsData,
} from '@/model/error/AnzuApiDependencyExistsError'

const generateListApiQuery = (pagination: Pagination, filterBag: FilterBag | undefined = undefined): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, querySetFilters } = useApiQueryBuilder()
  querySetLimit(pagination.rowsPerPage)
  querySetOffset(pagination.page, pagination.rowsPerPage)
  querySetOrder(pagination.sortBy, pagination.descending)
  if (isDefined(filterBag)) querySetFilters(filterBag)
  return queryBuild()
}

const generateListApiQueryWithoutPagination = (
  rowsPerPage: number,
  page: number,
  orderField: string,
  orderDesc: boolean,
  filterBag: FilterBag | undefined = undefined
): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, querySetFilters } = useApiQueryBuilder()
  querySetLimit(rowsPerPage)
  querySetOffset(page, rowsPerPage)
  querySetOrder(orderField, orderDesc)
  if (isDefined(filterBag)) querySetFilters(filterBag)
  return queryBuild()
}
// todo: alpha version
/**
 * Used to fetch all items from list api.
 *
 * @template R Response type override, optional
 */
export const apiFetchListBatch = async <R>(
  client: () => AxiosInstance,
  urlTemplate: string,
  urlParams: UrlParams = {},
  sortBy = 'id',
  sortDesc = true,
  filterBag: FilterBag | undefined = undefined,
  batchSize = 100,
  system: string,
  entity: string,
  forceElastic = false,
  options: AxiosRequestConfig = {}
): Promise<R> => {
  const searchApi = isDefined(filterBag?._elastic) || forceElastic ? '/search' : ''
  const pagination = usePagination(sortBy)
  pagination.rowsPerPage = batchSize
  pagination.sortBy = sortBy
  pagination.descending = sortDesc
  const urlPart = replaceUrlParameters(urlTemplate, urlParams) + searchApi
  const results = [] as unknown as R

  try {
    const res = await client().get(urlPart + generateListApiQuery(pagination, filterBag), options)
    if (!isValidHTTPStatus(res.status)) {
      return Promise.reject(new AnzuApiResponseCodeError(res.status))
    }
    if (res.data) {
      const resData = res.data as unknown as ApiResponseList<R> | ApiInfiniteResponseList<R>
      // @ts-ignore
      results.push(...resData.data)
      if (isApiInfiniteResponseList(resData)) {
        pagination.hasNextPage = res.data.hasNextPage
        if (pagination.hasNextPage) {
          while (pagination.hasNextPage) {
            pagination.page++
            const nextPageResponse = await client().get(urlPart + generateListApiQuery(pagination, filterBag), options)
            const nextPageData = nextPageResponse.data
            // @ts-ignore
            results.push(...nextPageData.data)
            pagination.hasNextPage = nextPageData.hasNextPage
          }
        }
      } else if (isApiResponseList(resData)) {
        pagination.totalCount = resData.totalCount
        if (pagination.totalCount <= pagination.rowsPerPage) {
          return Promise.resolve(results as R)
        }
        const promises: Promise<any>[] = []
        const numPages = Math.ceil(pagination.totalCount / pagination.rowsPerPage)
        for (let i = 0; i < numPages; i++) {
          promises.push(
            client().get(
              urlPart +
                generateListApiQueryWithoutPagination(
                  pagination.rowsPerPage,
                  i,
                  pagination.sortBy,
                  pagination.descending,
                  filterBag
                ),
              options
            )
          )
        }
        const allResponses = await Promise.all(promises)
        allResponses.forEach((pageResponse) => {
          // @ts-ignore
          results.push(...pageResponse.data.data)
        })
      }
      pagination.currentViewCount = res.data.data.length
      return Promise.resolve(results as R)
    }
    if (res.status === HTTP_STATUS_NO_CONTENT) {
      return Promise.resolve([] as R)
    }

    return results
  } catch (err: any) {
    if (axiosErrorResponseIsForbidden(err)) {
      return Promise.reject(new AnzuApiForbiddenError(err))
    }
    if (axiosErrorResponseHasValidationData(err)) {
      return Promise.reject(new AnzuApiValidationError(err, system, entity, err))
    }
    if (axiosErrorResponseHasDependencyExistsData(err)) {
      return Promise.reject(new AnzuApiDependencyExistsError(err, system, entity, err))
    }
    if (axiosErrorResponseHasForbiddenOperationData(err)) {
      return Promise.reject(new AnzuApiForbiddenOperationError(err, err))
    }
    return Promise.reject(new AnzuFatalError(err))
  }
}
