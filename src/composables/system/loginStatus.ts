import { readonly, ref } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import { isNull } from '@/utils/common'

enum LoginState {
  Success = 'success',
  FailureSsoCommunicationFailed = 'failure-sso-communication',
  FailureInternalError = 'failure-internal-error',
  FailureUnauthorized = 'failure-unauthorized',
}

const status = ref<string | null>(null)

export function useLoginStatus(to: RouteLocationNormalized) {
  if (to.query.loginState) {
    status.value = to.query.loginState.toString()
  }

  const isStatusNotDefined = () => isNull(status.value)
  const isStatusLoginSuccess = () => status.value === LoginState.Success
  const isStatusSsoCommunicationFailure = () => status.value === LoginState.FailureSsoCommunicationFailed
  const isStatusInternalErrorFailure = () => status.value === LoginState.FailureInternalError
  const isStatusUnauthorized = () => status.value === LoginState.FailureUnauthorized

  return {
    status: readonly(status),
    isStatusNotDefined,
    isStatusLoginSuccess,
    isStatusSsoCommunicationFailure,
    isStatusInternalErrorFailure,
    isStatusUnauthorized,
  }
}
