import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { Pagination } from '@/types/Pagination'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/services/api/v2/queryBuilder2'
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

export const apiGenerateListQuery2 = (
  pagination: Ref<Pagination>,
  filterData: FilterData<any>,
  filterConfig: FilterConfig<any>
): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, querySetFilters } = useApiQueryBuilder()
  querySetLimit(pagination.value.rowsPerPage)
  querySetOffset(pagination.value.page, pagination.value.rowsPerPage)
  querySetOrder(pagination.value.sortBy, pagination.value.descending)
  querySetFilters(filterData, filterConfig)
  return queryBuild()
}

/**
 * @template R Response type override, optional
 */
export const apiFetchList2 = <R>(
  client: () => AxiosInstance,
  urlTemplate: string,
  urlParams: UrlParams = {},
  pagination: Ref<Pagination>,
  filterData: FilterData<any>,
  filterConfig: FilterConfig<any>,
  system: string,
  entity: string,
  options: AxiosRequestConfig = {}
): Promise<R> => {
  return new Promise((resolve, reject) => {
    const searchApi = filterConfig.general.elastic ? '/search' : ''
    client()
      .get(
        replaceUrlParameters(urlTemplate, urlParams) +
        searchApi +
        apiGenerateListQuery2(pagination, filterData, filterConfig),
        options
      )
      .then((res) => {
        if (!isValidHTTPStatus(res.status)) {
          return reject(new AnzuApiResponseCodeError(res.status))
        }
        if (res.data) {
          const resData = res.data as unknown as ApiResponseList<R> | ApiInfiniteResponseList<R>
          if (isApiInfiniteResponseList(resData)) {
            pagination.value.hasNextPage = res.data.hasNextPage
          } else if (isApiResponseList(resData)) {
            pagination.value.totalCount = resData.totalCount
          }
          pagination.value.currentViewCount = res.data.data.length
          return resolve(res.data.data)
        }
        if (res.status === HTTP_STATUS_NO_CONTENT) {
          return resolve([] as R)
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
        if (axiosErrorResponseHasDependencyExistsData(err)) {
          return reject(new AnzuApiDependencyExistsError(err, system, entity, err))
        }
        if (axiosErrorResponseHasForbiddenOperationData(err)) {
          return reject(new AnzuApiForbiddenOperationError(err, err))
        }
        // todo catch another axios errors, for example timeout
        return reject(new AnzuFatalError(err))
      })
  })
}
