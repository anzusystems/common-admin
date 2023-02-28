import { useErrorHandler } from '@/composables/system/error'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { FilterBag } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import { isUndefined } from '@/utils/common'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/services/api/queryBuilder'

const { isValidationError, handleValidationError } = useErrorHandler()

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
          throw new AnzuApiResponseCodeError()
        }
        pagination.totalCount = res.data.totalCount
        pagination.currentViewCount = res.data.data.length
        if (!isUndefined(res.data.hasNextPage)) pagination.hasNextPage = res.data.hasNextPage
        resolve(res.data.data)
      })
      .catch((err) => {
        if (isValidationError(err)) {
          handleValidationError(err, system, entity)
          reject(new AnzuApiValidationError())
        }
        reject(err)
      })
  })
}
