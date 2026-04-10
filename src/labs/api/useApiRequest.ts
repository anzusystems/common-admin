import {
  AnzuApiResponseCodeError,
  isAnzuApiResponseCodeError,
} from '@/model/error/AnzuApiResponseCodeError'
import {
  AnzuApiValidationError,
  axiosErrorResponseHasValidationData,
} from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isDefined, isNull, isUndefined } from '@/utils/common'
import { isValidHTTPStatus } from '@/utils/response'
import axios, { type AxiosRequestConfig, type Method } from 'axios'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import {
  AnzuApiForbiddenError,
  axiosErrorResponseIsForbidden,
} from '@/model/error/AnzuApiForbiddenError'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
} from '@/model/error/AnzuApiForbiddenOperationError'
import { HTTP_STATUS_NO_CONTENT } from '@/composables/statusCodes'
import {
  AnzuApiDependencyExistsError,
  axiosErrorResponseHasDependencyExistsData,
} from '@/model/error/AnzuApiDependencyExistsError'
import { AnzuApiTimeoutError, axiosErrorIsTimeout } from '@/model/error/AnzuApiTimeoutError'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import type { AxiosClientFn } from '@/labs/api/client'

export type ExecuteRequestParams<T> = {
  urlTemplate?: string
  urlParams?: UrlParams
  object?: T
}

export type UseApiRequestParams = {
  client: AxiosClientFn
  method: Method
  system: string
  entity: string
  urlTemplate?: string
  urlParams?: UrlParams
  options?: AxiosRequestConfig
  silentConsoleError?: boolean
}

export const useApiRequest = <R, T = R>(
  params: UseApiRequestParams,
): UseApiAnyRequestReturnType<R, T> => {
  const { client, method, system, entity, urlTemplate, urlParams, options = {}, silentConsoleError = false } = params

  let abortController: AbortController | null = null

  const executeRequest = async (executeParams: ExecuteRequestParams<T> = {}): Promise<R> => {
    abortController = new AbortController()

    const urlTemplateOverride = executeParams.urlTemplate
    const urlParamsOverride = executeParams.urlParams
    const object = executeParams.object

    try {
      const axiosConfig: AxiosRequestConfig = { method }
      const resolvedParams = isDefined(urlParamsOverride) ? urlParamsOverride : urlParams
      const template = isDefined(urlTemplateOverride) ? urlTemplateOverride : urlTemplate
      if (isUndefined(template)) throw new Error('Url template is undefined')
      axiosConfig.url = template
      if (template !== '' && !isUndefined(resolvedParams)) {
        axiosConfig.url = replaceUrlParameters(template, resolvedParams)
      }
      if (!isNull(object)) {
        axiosConfig.data = JSON.stringify(object)
      }
      const res = await client().request({
        ...options,
        ...axiosConfig,
        signal: abortController.signal,
      })

      if (!isValidHTTPStatus(res.status)) {
        throw new AnzuApiResponseCodeError(res.status)
      }

      if (res.data) {
        return res.data as R
      }

      if (res.status === HTTP_STATUS_NO_CONTENT) {
        return undefined as R
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
        if (!silentConsoleError) console.error('Axios error: ' + urlTemplate, ...(err.cause ? [err.cause] : []))
        throw new AnzuApiAxiosError(err)
      }

      if (!silentConsoleError) console.error('AnzuFatalError: ', err)
      throw new AnzuFatalError(err)
    } finally {
      abortController = null
    }
  }

  const abortRequest = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  return {
    executeRequest,
    abortRequest,
  }
}

export type UseApiAnyRequestReturnType<R, T = R> = {
  executeRequest: (params?: ExecuteRequestParams<T>) => Promise<R>
  abortRequest: () => void
}
