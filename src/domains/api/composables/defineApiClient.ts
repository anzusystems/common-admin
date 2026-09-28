import axios, {
  type AxiosInstance,
  type AxiosInterceptorManager,
  type AxiosRequestConfig,
  type AxiosResponse,
  type CreateAxiosDefaults,
  type InternalAxiosRequestConfig,
} from 'axios'
import { isNull } from '@/shared/utils/common'

// axios's own handler types, which it does not export.
type RequestUse = Parameters<AxiosInterceptorManager<InternalAxiosRequestConfig>['use']>
type ResponseUse = Parameters<AxiosInterceptorManager<AxiosResponse>['use']>

export interface ApiClientRequestInterceptor {
  onFulfilled?: RequestUse[0]
  onRejected?: RequestUse[1]
  options?: RequestUse[2]
}

export interface ApiClientResponseInterceptor {
  onFulfilled?: ResponseUse[0]
  onRejected?: ResponseUse[1]
}

export interface ApiClientSetup {
  /** The instance's defaults; nothing is added to them. */
  config: CreateAxiosDefaults
  request?: ApiClientRequestInterceptor[]
  response?: ApiClientResponseInterceptor[]
}

/**
 * An admin's axios client: created on the first call, the same instance on every later one, with its
 * interceptors registered once -- the factories the admins wrote by hand each carried the guard, and
 * one that registered outside it stacked a copy of every interceptor per call.
 *
 * `setup` runs on that first call, not when the module loads, as the guards did: an admin's env config
 * is empty until it has loaded, and a client's interceptors come from modules in an import cycle with
 * it (the refresh interceptor calls the auth api, which goes through the client), so at load time they
 * may not be initialized yet.
 */
export function defineApiClient(setup: () => ApiClientSetup): () => AxiosInstance {
  let instance: AxiosInstance | null = null
  return () => {
    if (isNull(instance)) {
      const { config, request = [], response = [] } = setup()
      const created = axios.create(config)
      for (const { onFulfilled, onRejected, options } of request) {
        created.interceptors.request.use(onFulfilled, onRejected, options)
      }
      for (const { onFulfilled, onRejected } of response) {
        created.interceptors.response.use(onFulfilled, onRejected)
      }
      instance = created
    }
    return instance
  }
}

/** A `runWhen` that leaves out requests to urls starting with one of `prefixes` (the auth endpoints). */
export const skipUrlPrefixes =
  (...prefixes: string[]) =>
  (config: AxiosRequestConfig): boolean =>
    !prefixes.some((prefix) => config.url?.startsWith(prefix) ?? false)
