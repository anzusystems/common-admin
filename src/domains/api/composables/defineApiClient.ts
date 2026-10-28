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
 * Returns a lazily created singleton axios client whose interceptors are registered once.
 * Registering outside the guard stacks a copy of every interceptor per call.
 * `setup` runs on the first call, not at module load. Env config is empty until loaded, and interceptors come from
 * modules in an import cycle with the client (refresh calls the auth api), so they may not be initialized at load time.
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
