import { pushAlert } from '@/domains/system/composables/alertsQueue'
import { commonT, commonTe } from '@/plugins/i18n'
import { isAnzuFatalError } from '@/shared/error/AnzuFatalError'
import { isAnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { isAnzuApiValidationError, type ValidationError } from '@/shared/error/AnzuApiValidationError'
import { isAnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { isAnzuApiForbiddenOperationError } from '@/shared/error/AnzuApiForbiddenOperationError'
import { isAnzuApiDependencyExistsError } from '@/shared/error/AnzuApiDependencyExistsError'
import { isAnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'
import { isAnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { isAnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AuthUnavailableError } from '@/shared/error/AuthUnavailableError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { isInCauseChain } from '@/shared/error/isInCauseChain'
import { resolveImageSaveErrorMessage } from '@/domains/dam/imageWidget/composables/imageSaveErrors'
import { extractImageSaveErrorInfo } from '@/domains/dam/imageWidget/composables/imageApiCms'
import { useSessionEnd } from '@/domains/auth/composables/sessionEnd'

const DEFAULT_DURATION_SECONDS = 3
// One "sign-in server does not answer" per outage: a page's requests all fail at once.
const AUTH_UNAVAILABLE_QUIET_MS = 30_000
let authUnavailableShownAt = -Infinity
// One for the requests a single action fails at once.
const SESSION_ENDED_NOT_DONE_QUIET_MS = 3000
const SESSION_ENDED_NOT_DONE_DURATION_MS = 6000
let sessionEndedNotDoneShownAt = -Infinity

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

  // Not until closed: it covers the bar that says the same and offers the sign-in.
  const showSessionEndedNotDone = () => {
    const now = Date.now()
    if (now - sessionEndedNotDoneShownAt < SESSION_ENDED_NOT_DONE_QUIET_MS) return
    sessionEndedNotDoneShownAt = now
    pushAlert('error', commonT('common.alert.sessionEndedNotDone'), SESSION_ENDED_NOT_DONE_DURATION_MS)
  }

  const showErrorsDefault = (error: any, duration = -1) => {
    // A cancelled request is not a failure: something newer stopped it, or its view is gone.
    // Returns `true` because callers using `if (!showErrorsDefault(e)) showUnknownError()`
    // would otherwise show "unknown error" on every autocomplete keystroke.
    if (isAnzuApiCancelledError(error)) return true
    // Stopped by the token refresh. Either the session is gone and
    // logout is loading, or the sign-in server did not answer.
    // The latter is reported once, not for every request stopped at the same time.
    if (isInCauseChain(error, (cause) => cause instanceof SessionExpiredError)) {
      // The user kept the page for its unsaved changes: what failed must not pass for done.
      if (useSessionEnd().sessionEnded.value) showSessionEndedNotDone()
      return true
    }
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
    // Any save that writes image rows (an article, a gallery, a person) can be refused by the single use rule.
    // Also a bare axios error: `bulkUpdateImages` rejects with one.
    const imageSaveErrorMessage = resolveImageSaveErrorMessage(extractImageSaveErrorInfo(error), commonT)
    if (imageSaveErrorMessage) {
      showError(imageSaveErrorMessage, duration)
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

  /**
   * `exportData[2].exportType`: the list's label, the index and the label of the item's field. Admins keep that label
   * under the list name without its final "s" (admin-cms: `items` → `item.name`), under the list name itself, or in an
   * entity of its own named after the parent and the list (admin-dam: `podcast` + `exportData` →
   * `podcastExportData.model.exportType`). A name nothing translates is shown bare, as for a field outside a list.
   * Cutting the last letter of any list name turned `exportData` into `exportDat`, and the alert showed the raw key.
   */
  const resolveListErrors = (error: string) => {
    const t = commonT
    const te = commonTe
    // Only called for a field that contains `[`, so the split has a second part.
    const parsedField = error.split('[')
    const firstField = parsedField[0]!.trim()
    const parsedSecond = parsedField[1]!.split(']')
    const indexNumber = parsedSecond[0]
    const secondField: string = parsedSecond[1] ?? ''

    const listText = (te(firstField) ? t(firstField) : firstField.split('.').at(-1)) + '[' + indexNumber + ']'
    if (secondField.length === 0) return listText

    const itemKeys = [firstField + secondField]
    // A body that is a list itself names `model.[0].title`: the item's label is the entity's own, `model.title`.
    if (firstField.endsWith('s') || firstField.endsWith('.')) itemKeys.unshift(firstField.slice(0, -1) + secondField)
    const [owner, list] = firstField.split('.model.')
    if (owner && list && !list.includes('.')) {
      itemKeys.push(owner + list.charAt(0).toUpperCase() + list.slice(1) + '.model' + secondField)
    }
    const itemKey = itemKeys.find((key) => te(key))

    return listText + ': ' + (itemKey ? t(itemKey) : secondField.split('.').at(-1))
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
