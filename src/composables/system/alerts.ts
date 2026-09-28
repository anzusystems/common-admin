import { pushAlert } from '@/composables/system/alertsQueue'
import { commonT, commonTe } from '@/plugins/i18n'
import { isAnzuFatalError } from '@/model/error/AnzuFatalError'
import { isAnzuApiForbiddenError } from '@/model/error/AnzuApiForbiddenError'
import { isAnzuApiValidationError, type ValidationError } from '@/model/error/AnzuApiValidationError'
import { isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { isAnzuApiForbiddenOperationError } from '@/model/error/AnzuApiForbiddenOperationError'
import { isAnzuApiDependencyExistsError } from '@/model/error/AnzuApiDependencyExistsError'
import { isAnzuApiTimeoutError } from '@/model/error/AnzuApiTimeoutError'
import { isAnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { isAnzuApiCancelledError } from '@/model/error/AnzuApiCancelledError'
import { AuthUnavailableError } from '@/model/error/AuthUnavailableError'
import { SessionExpiredError } from '@/model/error/SessionExpiredError'
import { isInCauseChain } from '@/model/error/isInCauseChain'

const DEFAULT_DURATION_SECONDS = 3
// One "sign-in server does not answer" per outage: a page's requests all fail at once.
const AUTH_UNAVAILABLE_QUIET_MS = 30_000
let authUnavailableShownAt = -Infinity

export const NEW_LINE_MARK = '\n'

export type RecordWasType = 'created' | 'deleted' | 'updated' | 'published' | 'unpublished' | 'enabled' | 'disabled'

export function useAlerts() {
  const showSuccess = (message: string, duration = DEFAULT_DURATION_SECONDS) => {
    pushAlert('success', message, duration * 1000)
  }

  const showSuccessT = (translation: string, duration = DEFAULT_DURATION_SECONDS) => {
    const t = commonT
    showSuccess(t(translation), duration)
  }

  const showError = (message: string, duration = DEFAULT_DURATION_SECONDS) => {
    pushAlert('error', message, duration * 1000)
  }

  const showErrorT = (translation: string, duration = DEFAULT_DURATION_SECONDS) => {
    const t = commonT
    showError(t(translation), duration)
  }

  const showInfo = (message: string, duration = DEFAULT_DURATION_SECONDS) => {
    pushAlert('info', message, duration * 1000)
  }

  const showInfoT = (translation: string, duration = DEFAULT_DURATION_SECONDS) => {
    const t = commonT
    showInfo(t(translation), duration)
  }

  const showWarning = (message: string, duration = DEFAULT_DURATION_SECONDS) => {
    pushAlert('warning', message, duration * 1000)
  }

  const showWarningT = (translation: string, duration = DEFAULT_DURATION_SECONDS) => {
    const t = commonT
    showWarning(t(translation), duration)
  }

  const showValidationError = (duration = DEFAULT_DURATION_SECONDS) => {
    const t = commonT
    pushAlert('error', t('common.alert.fixValidationErrors'), duration * 1000)
  }

  const showRecordWas = (variant: RecordWasType, duration = DEFAULT_DURATION_SECONDS) => {
    const t = commonT
    pushAlert('success', t('common.alert.recordWas.' + variant), duration * 1000)
  }

  const showApiValidationError = (errors: ValidationError[], duration = -1, fieldIsTranslated = false) => {
    const t = commonT
    const te = commonTe
    const texts = [t('common.alert.fixApiValidationErrors')]

    for (const error of errors) {
      let fieldText = ''
      if (fieldIsTranslated) {
        fieldText += error.field
      } else if (te(error.field)) {
        fieldText += t(error.field)
      } else if (error.field.includes('[')) {
        fieldText += resolveListErrors(error.field)
      } else {
        fieldText += error.field.split('.').at(-1)
      }
      const errorsTexts = new Set<string>()
      for (const code of error.errors) {
        if (te('error.apiValidation.' + code)) {
          errorsTexts.add(t('error.apiValidation.' + code))
          continue
        }
        errorsTexts.add(t('error.apiValidation.noTranslation'))
      }
      if (fieldText.length > 0) {
        texts.push(fieldText + ': ' + Array.from(errorsTexts).join(', '))
      }
    }
    pushAlert('error', texts.join(NEW_LINE_MARK), duration * 1000)
  }

  const showApiForbiddenOperationError = (detail: string, duration = -1) => {
    const t = commonT
    const te = commonTe
    let text = t('error.apiForbiddenOperation.noTranslation')
    if (te('error.apiForbiddenOperation.' + detail)) {
      text = t('error.apiForbiddenOperation.' + detail)
    }
    pushAlert('error', text, duration * 1000)
  }

  const showUnknownError = (duration = -1) => {
    const t = commonT
    pushAlert('error', t('common.alert.unknownError'), duration * 1000)
  }

  const showForbiddenError = (duration = DEFAULT_DURATION_SECONDS) => {
    const t = commonT
    pushAlert('error', t('common.alert.forbiddenError'), duration * 1000)
  }

  const showAuthUnavailable = (duration = -1) => {
    const now = Date.now()
    if (now - authUnavailableShownAt < AUTH_UNAVAILABLE_QUIET_MS) return
    authUnavailableShownAt = now
    pushAlert('error', commonT('common.alert.authUnavailable'), duration * 1000)
  }

  const showErrorsDefault = (error: any, duration = -1) => {
    // A stopped request is not a failure to report: something newer asked for it to stop, or the
    // view it belonged to is gone. It returns `true` -- handled, nothing to show -- because the
    // callers that fall back on `if (!showErrorsDefault(e)) showUnknownError()` would otherwise toast
    // "unknown error" every time a user typed one more character into an autocomplete.
    if (isAnzuApiCancelledError(error)) return true
    // Stopped by the token refresh: the session is gone and the logout is already loading, or the
    // sign-in server did not answer -- said once, not for every request it stopped at the same time.
    if (isInCauseChain(error, (cause) => cause instanceof SessionExpiredError)) return true
    if (isInCauseChain(error, (cause) => cause instanceof AuthUnavailableError)) {
      showAuthUnavailable(duration)
      return true
    }
    if (isAnzuApiForbiddenError(error)) {
      showForbiddenError(duration)
      return true
    }
    if (isAnzuApiValidationError(error)) {
      showApiValidationError(error.fields, duration)
      return true
    }
    if (isAnzuApiDependencyExistsError(error)) {
      showErrorT('error.apiDependencyExists.message', duration)
      return true
    }
    if (isAnzuApiForbiddenOperationError(error)) {
      showApiForbiddenOperationError(error.detail, duration)
      return true
    }
    if (isAnzuApiTimeoutError(error)) {
      showErrorT('error.apiTimedOut.message', duration)
      return true
    }
    if (isAnzuApiAxiosError(error)) {
      showUnknownError(duration)
      return true
    }
    if (isAnzuFatalError(error)) {
      showUnknownError(duration)
      return true
    }
    if (isAnzuApiResponseCodeError(error)) {
      showUnknownError(duration)
      return true
    }
    return false
  }

  const resolveListErrors = (error: string) => {
    const t = commonT
    // Only called for a field that contains `[`, so the split has a second part.
    const parsedField = error.split('[')
    const firstField = parsedField[0]!.trim()
    const parsedSecond = parsedField[1]!.split(']')
    const indexNumber = parsedSecond[0]
    const secondField: string = parsedSecond[1] ?? ''

    return t(firstField) + '[' + indexNumber + ']: ' + t(firstField.slice(0, -1) + secondField)
  }

  return {
    showSuccess,
    showSuccessT,
    showError,
    showErrorT,
    showInfo,
    showInfoT,
    showWarning,
    showWarningT,
    showValidationError,
    showRecordWas,
    showApiValidationError,
    showApiForbiddenOperationError,
    showUnknownError,
    showForbiddenError,
    showErrorsDefault,
  }
}
