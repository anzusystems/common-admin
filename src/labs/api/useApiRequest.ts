import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { replaceUrlParameters, type UrlParams } from '@/services/api/apiHelper'
import { isDefined, isNull, isUndefined } from '@/utils/common'
import { isValidHTTPStatus } from '@/utils/response'
import axios, { type AxiosRequestConfig, type Method } from 'axios'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/model/error/AnzuApiForbiddenError'
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
}

/**
 * @template R Response type
 * @template T Type used for request payload, by default, same as Response type
 * @deprecated Use object params form:
 *   useApiRequest({ client, method, system, entity, urlTemplate, urlParams, options })
 */
export function useApiRequest<R, T = R>(
  client: AxiosClientFn,
  method: Method,
  system: string,
  entity: string,
  urlTemplate?: string,
  urlParams?: UrlParams,
  options?: AxiosRequestConfig
): UseApiAnyRequestReturnType<R, T>

/**
 * @template R Response type
 * @template T Type used for request payload, by default, same as Response type
 */
export function useApiRequest<R, T = R>(params: UseApiRequestParams): UseApiAnyRequestReturnType<R, T>

export function useApiRequest<R, T = R>(
  clientOrParams: AxiosClientFn | UseApiRequestParams,
  method?: Method,
  system?: string,
  entity?: string,
  urlTemplate?: string,
  urlParams?: UrlParams,
  options?: AxiosRequestConfig
): UseApiAnyRequestReturnType<R, T> {
  let resolvedClient: AxiosClientFn
  let resolvedMethod: Method
  let resolvedSystem: string
  let resolvedEntity: string
  let resolvedUrlTemplate: string | undefined
  let resolvedUrlParams: UrlParams | undefined
  let resolvedOptions: AxiosRequestConfig

  if (typeof clientOrParams === 'function') {
    resolvedClient = clientOrParams
    resolvedMethod = method!
    resolvedSystem = system!
    resolvedEntity = entity!
    resolvedUrlTemplate = urlTemplate
    resolvedUrlParams = urlParams
    resolvedOptions = options ?? {}
  } else {
    resolvedClient = clientOrParams.client
    resolvedMethod = clientOrParams.method
    resolvedSystem = clientOrParams.system
    resolvedEntity = clientOrParams.entity
    resolvedUrlTemplate = clientOrParams.urlTemplate
    resolvedUrlParams = clientOrParams.urlParams
    resolvedOptions = clientOrParams.options ?? {}
  }

  let abortController: AbortController | null = null

  const executeRequest = async (
    urlTemplateOverrideOrParams: string | ExecuteRequestParams<T> | undefined = undefined,
    urlParamsOverride: UrlParams | undefined = undefined,
    object: T | undefined = undefined
  ): Promise<R> => {
    abortController = new AbortController()

    let resolvedUrlTemplateOverride: string | undefined
    let resolvedUrlParamsOverride: UrlParams | undefined
    let resolvedObject: T | undefined

    if (typeof urlTemplateOverrideOrParams === 'object' && urlTemplateOverrideOrParams !== null) {
      resolvedUrlTemplateOverride = urlTemplateOverrideOrParams.urlTemplate
      resolvedUrlParamsOverride = urlTemplateOverrideOrParams.urlParams
      resolvedObject = urlTemplateOverrideOrParams.object
    } else {
      resolvedUrlTemplateOverride = urlTemplateOverrideOrParams
      resolvedUrlParamsOverride = urlParamsOverride
      resolvedObject = object
    }

    try {
      const axiosConfig: AxiosRequestConfig = { method: resolvedMethod }
      const params = isDefined(resolvedUrlParamsOverride) ? resolvedUrlParamsOverride : resolvedUrlParams
      const template = isDefined(resolvedUrlTemplateOverride) ? resolvedUrlTemplateOverride : resolvedUrlTemplate
      if (isUndefined(template)) throw new Error('Url template is undefined')
      axiosConfig.url = template
      if (template !== '' && !isUndefined(params)) {
        axiosConfig.url = replaceUrlParameters(template, params)
      }
      if (!isNull(resolvedObject)) {
        axiosConfig.data = JSON.stringify(resolvedObject)
      }
      const res = await resolvedClient().request({
        ...resolvedOptions,
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
        throw new AnzuApiValidationError(err, resolvedSystem, resolvedEntity, err)
      }

      if (axiosErrorResponseHasDependencyExistsData(err)) {
        throw new AnzuApiDependencyExistsError(err, resolvedSystem, resolvedEntity, err)
      }

      if (axiosErrorResponseHasForbiddenOperationData(err)) {
        throw new AnzuApiForbiddenOperationError(err, err)
      }

      if (axiosErrorIsTimeout(err)) {
        throw new AnzuApiTimeoutError(err)
      }

      if (axios.isAxiosError(err)) {
        console.error('Axios error: ' + resolvedUrlTemplate, err.cause)
        throw new AnzuApiAxiosError(err)
      }

      console.error('AnzuFatalError: ', err)
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

interface ExecuteRequestFn<R, T> {
  /** @deprecated Use object params form: executeRequest({ urlTemplate, urlParams, object }) */
  (urlTemplateOverride?: string, urlParamsOverride?: UrlParams | undefined, object?: T | undefined): Promise<R>
  (params: ExecuteRequestParams<T>): Promise<R>
}

export type UseApiAnyRequestReturnType<R, T = R> = {
  executeRequest: ExecuteRequestFn<R, T>
  abortRequest: () => void
}
