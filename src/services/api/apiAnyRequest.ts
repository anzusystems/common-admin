import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isNull } from '@/utils/common'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosInstance, AxiosRequestConfig, Method } from 'axios'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/model/error/AnzuApiForbiddenError'

/**
 * @template T Type used for request payload, by default same as Response type
 * @template R Response type override, optional
 */
export const apiAnyRequest = <T, R = T>(
  client: () => AxiosInstance,
  method: Method,
  urlTemplate = '',
  urlParams: UrlParams = {},
  object: T | null = null,
  system: string,
  entity: string,
  options: AxiosRequestConfig = {}
): Promise<R> => {
  return new Promise((resolve, reject) => {
    const axiosConfig: AxiosRequestConfig = { method: method }
    if (urlTemplate !== '') {
      axiosConfig.url = replaceUrlParameters(urlTemplate, urlParams)
    }
    if (!isNull(object)) {
      axiosConfig.data = JSON.stringify(object)
    }
    client()
      .request({ ...options, ...axiosConfig })
      .then((res) => {
        if (!isValidHTTPStatus(res.status)) {
          return reject(new AnzuApiResponseCodeError(res.status))
        }
        if (res.data) {
          return resolve(res.data)
        }
        return reject(new AnzuFatalError())
      })
      .catch((err) => {
        if(axiosErrorResponseIsForbidden(err)) {
          return reject(new AnzuApiForbiddenError())
        }
        if (axiosErrorResponseHasValidationData(err)) {
          return reject(new AnzuApiValidationError(err, system, entity, err))
        }
        return reject(new AnzuFatalError(err))
      })
  })
}
