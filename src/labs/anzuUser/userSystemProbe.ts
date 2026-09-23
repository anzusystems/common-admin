import { ref, type InjectionKey, type Ref } from 'vue'
import axios from 'axios'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/model/error/AnzuApiCancelledError'
import { AnzuApiForbiddenError } from '@/model/error/AnzuApiForbiddenError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_UNAUTHORIZED } from '@/composables/statusCodes'
import { useApiRequest } from '@/labs/api/useApiRequest'
import { type AnyUserSystemDescriptor, resolveProbeEndpoint } from '@/labs/anzuUser/userSystemDescriptor'
import {
  classifyProbeStatus,
  emptyUserSystemAxes,
  UserSystemAccess,
  UserSystemLoad,
  UserSystemPresence,
  type UserSystemAxes,
} from '@/labs/anzuUser/userSystemState'
import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'

/**
 * How an app refreshes a session for one system, and retries.
 *
 * The library cannot do this itself: a first 401 is ambiguous -- expired session or no account --
 * and the only way to tell them apart is to refresh and ask again. Every admin has its own
 * mechanism (`refreshSession.ts` in inhouse, an interceptor in cms, `requestRefreshToken.ts` in
 * blog) and none of them lives in `common-admin`. Without this hook a panel would show an expired
 * token as "no account here", which is exactly the confusion decision 16 forbids.
 *
 * Returns true when the refresh succeeded and the call is worth repeating.
 */
export type UserSystemRefreshHook = (system: string) => Promise<boolean>

/**
 * What the probe calls itself in the error context.
 *
 * A 404 here is an answer, not a failure -- it is how a system says "no account of yours". It still
 * reaches the api error logger like any other, so an app filters on this together with the status
 * rather than on the url, which would also silence a real detail read of the same path. The
 * validation scope stays the user's, so a field error would still name a real label.
 */
export const USER_PROBE_ENTITY = 'anzuUserProbe'

export const UserSystemRefreshHookKey: InjectionKey<UserSystemRefreshHook> = Symbol('UserSystemRefreshHook')

/**
 * The status the backend answered with, or null when nothing ever answered.
 *
 * Read off the axios failure the mapped error kept as its cause, not off the class. Going by class
 * alone misses exactly the answers that exist *because* the backend replied with a body: a
 * validation failure is `AnzuApiValidationError`, a dependency conflict is
 * `AnzuApiDependencyExistsError`, and both are 422s that have to be reported as such. Reported as
 * "the system did not answer" they would send the operator looking for an outage instead of at the
 * account whose stored data no longer validates -- which, with legacy rows, is the failure that
 * happens most.
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
 * One system's answer about one user.
 *
 * Reads through `endpoints[probe].get`, never a hard-coded path: in dam the choice is visible to
 * the operator, because `/adm/v1/anzu-user/{id}` has no gating there while `/adm/users/{id}` sits
 * behind `DAM_USER_READ` -- only the second can ever render "you have no access".
 *
 * Note for the app: a probe answering 404 is an expected result here, not a failure, but it still
 * reaches the api error logger. Filter on `status === 404 && entity === USER_PROBE_ENTITY`, or
 * every absent account writes a line into the log.
 */
export const useUserSystemProbe = (params: UserSystemProbeParams): UserSystemProbeResult => {
  const { descriptor, refreshHook } = params

  const axes = ref<UserSystemAxes>(emptyUserSystemAxes())
  const user = ref<AnzuUser | null>(null)

  let generation = 0
  /**
   * The helper's abort handle for the request that is in flight.
   *
   * The generation token alone already stops a stale answer from being written; this is what stops
   * the request itself. Leaving a page mid-search would otherwise leave up to eighteen calls
   * running against backends nobody is waiting for any more.
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
    // A system switched off in configuration is a state to show, not a call to make.
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

      // The one retry the classification depends on. Only after it has happened is a 401 a verdict
      // rather than a question.
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
