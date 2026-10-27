import { readonly, ref } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import { isNull } from '@/shared/utils/common'
import { stringToInt } from '@/shared/utils/string'

export const LoginState = {
  Success: 'success',
  FailureSsoCommunicationFailed: 'failure-sso-communication',
  FailureInternalError: 'failure-internal-error',
  FailureUnauthorized: 'failure-unauthorized',
} as const
export type JobStatusType = (typeof LoginState)[keyof typeof LoginState]

const status = ref<string | null>(null)
const serverTimestamp = ref<number | null>(null)
export const localTimeShiftInSeconds = ref<number>(0)

export function useLoginStatus(to: RouteLocationNormalized) {
  if (to.query.loginState) {
    status.value = to.query.loginState.toString()
    serverTimestamp.value = stringToInt(to.query.timestamp)
    const localTime = Math.floor(Date.now() / 1000)
    if (serverTimestamp.value) {
      const localTimeDiff = serverTimestamp.value - localTime
      /**
       * Stores how far the server time is ahead beyond the one-minute grace period, so the token refreshes sooner.
       * Measured anew on each login: a shift kept from an earlier login makes a valid JWT look expired.
       */
      localTimeShiftInSeconds.value = Math.max(0, localTimeDiff - 60)
    }
  } else {
    status.value = null
    serverTimestamp.value = null
  }

  // This navigation's verdict: the start-up reads it after its awaits, when another navigation may have
  // passed the guard and reset `status`.
  const current = status.value
  const isStatusNotDefined = () => isNull(current)
  const isStatusLoginSuccess = () => current === LoginState.Success
  const isStatusSsoCommunicationFailure = () => current === LoginState.FailureSsoCommunicationFailed
  const isStatusInternalErrorFailure = () => current === LoginState.FailureInternalError
  const isStatusUnauthorized = () => current === LoginState.FailureUnauthorized

  return {
    status: readonly(status),
    serverTimestamp: readonly(serverTimestamp),
    isStatusNotDefined,
    isStatusLoginSuccess,
    isStatusSsoCommunicationFailure,
    isStatusInternalErrorFailure,
    isStatusUnauthorized,
  }
}
