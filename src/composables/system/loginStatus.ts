import { readonly, ref } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import { isNull } from '@/utils/common'
import { stringToInt } from '@/utils/string'

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
       * If the server time is ahead of the user’s local time by more than the one-minute grace period,
       * we need to store that time shift so we can refresh the token sooner.
       */
      if (localTimeDiff > 60) {
        localTimeShiftInSeconds.value = localTimeDiff - 60
      }
    }
  }

  const isStatusNotDefined = () => isNull(status.value)
  const isStatusLoginSuccess = () => status.value === LoginState.Success
  const isStatusSsoCommunicationFailure = () => status.value === LoginState.FailureSsoCommunicationFailed
  const isStatusInternalErrorFailure = () => status.value === LoginState.FailureInternalError
  const isStatusUnauthorized = () => status.value === LoginState.FailureUnauthorized

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
