import { useErrorHandler } from '@/composables/system/error'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isNull } from '@/utils/common'
import { isValidHTTPStatus } from '@/utils/response'
import type { AxiosInstance, AxiosRequestConfig, Method } from 'axios'

const { isValidationError, handleValidationError } = useErrorHandler()

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
          throw new AnzuApiResponseCodeError()
        }
        if (res.data.data) {
          resolve(res.data.data)
        } else if (res.data) {
          resolve(res.data)
        }
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
