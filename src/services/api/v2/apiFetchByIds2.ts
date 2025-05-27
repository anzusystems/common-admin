import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { useApiQueryBuilder } from '@/services/api/queryBuilder'
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

/**
 * @template T Type used for request payload, by default same as Response type
 * @template R Response type override, optional
 */
const generateByIdsApiQuery = (ids: number[] | string[], isSearchApi: boolean, field = 'id'): string => {
  const { querySetLimit, querySetOffset, querySetOrder, queryBuild, queryAddFilter, queryAdd } = useApiQueryBuilder()
  const limit = ids.length
  querySetLimit(limit)
  querySetOffset(1, limit)
  querySetOrder(field, false)
  if (isSearchApi) queryAdd(field, ids.join(','))
  else queryAddFilter('in', field, ids.join(','))

  return queryBuild()
}

export const apiFetchByIds2 = <T, R = T>(
  client: () => AxiosInstance,
  ids: DocId[] | IntegerId[],
  urlTemplate: string,
  urlParams: UrlParams = {},
  system: string,
  entity: string,
  options: AxiosRequestConfig = {},
  isSearchApi = false,
  field = 'id'
): Promise<R> => {
  return new Promise((resolve, reject) => {
    client()
      .get(replaceUrlParameters(urlTemplate, urlParams) + generateByIdsApiQuery(ids, isSearchApi, field), options)
      .then((res) => {
        if (!isValidHTTPStatus(res.status)) {
          return reject(new AnzuApiResponseCodeError(res.status))
        }
        if (res.data?.data) {
          return resolve(res.data.data)
        }
        if (res.status === HTTP_STATUS_NO_CONTENT) {
          return resolve(null as R)
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
