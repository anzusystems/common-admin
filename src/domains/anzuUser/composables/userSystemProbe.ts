import { ref, type InjectionKey, type Ref } from 'vue'
import axios from 'axios'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_UNAUTHORIZED } from '@/shared/statusCodes'
import { USER_PROBE_ENTITY } from '@/domains/api/utils/apiErrors'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import { type AnyUserSystemDescriptor, resolveProbeEndpoint } from '@/domains/anzuUser/composables/userSystemDescriptor'
import {
  classifyProbeStatus,
  emptyUserSystemAxes,
  UserSystemAccess,
  UserSystemLoad,
  UserSystemPresence,
  type UserSystemAxes,
} from '@/domains/anzuUser/utils/userSystemState'
import type { AnzuUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'

/**
 * Refreshes a system's session; returns true when the call is worth retrying.
 * A first 401 may be an expired session or no account. Only a refresh and retry tells them apart (decision 16).
 */
export type UserSystemRefreshHook = (system: string) => Promise<boolean>

export { USER_PROBE_ENTITY }

export const UserSystemRefreshHookKey: InjectionKey<UserSystemRefreshHook> = Symbol('UserSystemRefreshHook')

/**
 * The backend status, or null when nothing answered.
 * Read from the axios cause, not the error class. `AnzuApiValidationError`
 * and `AnzuApiDependencyExistsError` are 422s and must be reported as such.
 */
export const probeStatusFromError = (error: unknown): number | null => {
  if (error instanceof AnzuApiResponseCodeError) return error.code
  if (error instanceof AnzuApiForbiddenError) return HTTP_STATUS_FORBIDDEN
  if (error instanceof AnzuApiAxiosError) return error.cause.response?.status ?? null
  const cause = (error as { cause?: unknown } | null)?.cause
  if (axios.isAxiosError(cause)) return cause.response?.status ?? null
  if (axios.isAxiosError(error)) return error.response?.status ?? null

  return null
}

export interface UserSystemProbeResult {
  axes: Ref<UserSystemAxes>
  user: Ref<AnzuUser | null>
  probe: (id: IntegerId) => Promise<void>
  reset: () => void
  cancel: () => void
}

export interface UserSystemProbeParams {
  descriptor: AnyUserSystemDescriptor
  /** Usually injected once per page; passing it explicitly is for tests and one-off panels. */
  refreshHook?: UserSystemRefreshHook | undefined
}

/**
 * Reads through `endpoints[probe].get`, never a hard-coded path (dam gates only `/adm/users/{id}`).
 * A 404 here is expected. A custom app error logger should skip `status === 404 && entity === USER_PROBE_ENTITY`.
 */
export const useUserSystemProbe = (params: UserSystemProbeParams): UserSystemProbeResult => {
  const { descriptor, refreshHook } = params

  const axes = ref<UserSystemAxes>(emptyUserSystemAxes())
  const user = ref<AnzuUser | null>(null)

  let generation = 0
  /**
   * Aborts the in-flight request. The generation token only drops stale answers.
   * Without this, leaving mid-search leaves up to eighteen calls running.
   */
  let abortInFlight: (() => void) | null = null

  const reset = () => {
    axes.value = emptyUserSystemAxes()
    user.value = null
  }

  const cancel = () => {
    generation++
    abortInFlight?.()
    abortInFlight = null
  }

  const probe = async (id: IntegerId) => {
    // A system disabled in config is shown as a state, not called.
    if (!descriptor.isEnabled()) {
      axes.value = {
        load: UserSystemLoad.Loaded,
        presence: UserSystemPresence.Unknown,
        access: UserSystemAccess.ConfigDisabled,
        enabled: 'unknown',
      }
      user.value = null
      return
    }

    const token = ++generation
    axes.value = { ...axes.value, load: UserSystemLoad.Loading }

    const endpoint = resolveProbeEndpoint(descriptor)

    const ask = async () => {
      const { execute, abort } = useApiRequest<AnzuUser, null>({
        client: descriptor.client,
        method: 'GET',
        system: descriptor.system,
        entity: USER_PROBE_ENTITY,
        validationSystem: 'common',
        validationEntity: descriptor.entity,
        urlTemplate: endpoint.get,
      })
      abortInFlight = abort
      try {
        return await execute({ urlParams: { id } })
      } finally {
        abortInFlight = null
      }
    }

    try {
      const found = await ask()
      if (token !== generation) return
      user.value = found
      axes.value = {
        load: UserSystemLoad.Loaded,
        presence: UserSystemPresence.Present,
        access: UserSystemAccess.Ok,
        enabled: found.enabled,
      }
    } catch (error) {
      if (token !== generation) return
      if (error instanceof AnzuApiCancelledError) return

      let status = probeStatusFromError(error)

      // A 401 is only a verdict after this refresh and retry.
      if (status === HTTP_STATUS_UNAUTHORIZED && refreshHook) {
        const refreshed = await refreshHook(descriptor.system).catch(() => false)
        if (token !== generation) return
        if (refreshed) {
          try {
            const found = await ask()
            if (token !== generation) return
            user.value = found
            axes.value = {
              load: UserSystemLoad.Loaded,
              presence: UserSystemPresence.Present,
              access: UserSystemAccess.Ok,
              enabled: found.enabled,
            }
            return
          } catch (retryError) {
            if (token !== generation) return
            status = probeStatusFromError(retryError)
          }
        }
      }

      user.value = null
      axes.value = {
        load: UserSystemLoad.Loaded,
        ...classifyProbeStatus(status),
        enabled: 'unknown',
      }
    }
  }

  return { axes, user, probe, reset, cancel }
}
