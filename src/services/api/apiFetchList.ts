import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { FilterBag } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import { isUndefined } from '@/utils/common'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/services/api/queryBuilder'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/model/error/AnzuApiForbiddenError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import type { ApiInfiniteResponseList, ApiResponseList } from '@/types/ApiResponse'
import { isApiInfiniteResponseList, isApiResponseList } from '@/types/ApiResponse'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
} from '@/model/error/AnzuApiForbiddenOperationError'

const generateListApiQuery = (pagination: Pagination, filterBag: FilterBag): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, querySetFilters } = useApiQueryBuilder()
  querySetLimit(pagination.rowsPerPage)
  querySetOffset(pagination.page, pagination.rowsPerPage)
  querySetOrder(pagination.sortBy, pagination.descending)
  querySetFilters(filterBag)
  return queryBuild()
}

/**
 * @template T Type used for request payload, by default same as Response type
 * @template R Response type override, optional
 */
export const apiFetchList = <T, R = T>(
  client: () => AxiosInstance,
  urlTemplate: string,
  urlParams: UrlParams = {},
  pagination: Pagination,
  filterBag: FilterBag,
  system: string,
  entity: string,
  options: AxiosRequestConfig = {}
): Promise<R> => {
  return new Promise((resolve, reject) => {
    const searchApi = isUndefined(filterBag._elastic) ? '' : '/search'
    client()
      .get(
        replaceUrlParameters(urlTemplate, urlParams) + searchApi + generateListApiQuery(pagination, filterBag),
        options
      )
      .then((res) => {
        if (!isValidHTTPStatus(res.status)) {
          return reject(new AnzuApiResponseCodeError(res.status))
        }
        if (res.data) {
          const resData = res.data as unknown as ApiResponseList<R> | ApiInfiniteResponseList<R>
          if (isApiInfiniteResponseList(resData)) {
            pagination.hasNextPage = res.data.hasNextPage
          } else if (isApiResponseList(resData)) {
            pagination.totalCount = resData.totalCount
          }
          pagination.currentViewCount = res.data.data.length
          return resolve(res.data.data)
        }
        return reject(new AnzuFatalError())
      })
      .catch((err) => {
        if (axiosErrorResponseIsForbidden(err)) {
          return reject(new AnzuApiForbiddenError(err))
        }
        if (axiosErrorResponseHasValidationData(err)) {
          return reject(new AnzuApiValidationError(err, system, entity, err))
        }
        if (axiosErrorResponseHasForbiddenOperationData(err)) {
          return reject(new AnzuApiForbiddenOperationError(err, err))
        }
        return reject(new AnzuFatalError(err))
      })
  })
}
