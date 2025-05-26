import { notify } from '@kyvg/vue3-notification'
import { i18n } from '@/plugins/i18n'
import { isAnzuFatalError } from '@/model/error/AnzuFatalError'
import { isAnzuApiForbiddenError } from '@/model/error/AnzuApiForbiddenError'
import { isAnzuApiValidationError, type ValidationError } from '@/model/error/AnzuApiValidationError'
import { isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { isAnzuApiForbiddenOperationError } from '@/model/error/AnzuApiForbiddenOperationError'

const DEFAULT_DURATION_SECONDS = 3

export const NEW_LINE_MARK = '\n'

export type RecordWasType = 'created' | 'deleted' | 'updated' | 'published' | 'unpublished' | 'enabled' | 'disabled'

export function useAlerts() {
  const showSuccess = (message: string, duration = DEFAULT_DURATION_SECONDS) => {
    notify({
      group: 'alerts',
      text: message,
      duration: duration * 1000,
      type: 'success',
    })
  }

  const showSuccessT = (translation: string, duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = i18n.global
    showSuccess(t(translation), duration)
  }

  const showError = (message: string, duration = DEFAULT_DURATION_SECONDS) => {
    notify({
      group: 'alerts',
      text: message,
      duration: duration * 1000,
      type: 'error',
    })
  }

  const showErrorT = (translation: string, duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = i18n.global
    showError(t(translation), duration)
  }

  const showInfo = (message: string, duration = DEFAULT_DURATION_SECONDS) => {
    notify({
      group: 'alerts',
      text: message,
      duration: duration * 1000,
      type: 'info',
    })
  }

  const showInfoT = (translation: string, duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = i18n.global
    showInfo(t(translation), duration)
  }

  const showWarning = (message: string, duration = DEFAULT_DURATION_SECONDS) => {
    notify({
      group: 'alerts',
      text: message,
      duration: duration * 1000,
      type: 'warning',
    })
  }

  const showWarningT = (translation: string, duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = i18n.global
    showWarning(t(translation), duration)
  }

  const showValidationError = (duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = i18n.global
    notify({
      group: 'alerts',
      text: t('common.alert.fixValidationErrors'),
      duration: duration * 1000,
      type: 'error',
    })
  }

  const showRecordWas = (variant: RecordWasType, duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = i18n.global
    notify({
      group: 'alerts',
      text: t('common.alert.recordWas.' + variant),
      duration: duration * 1000,
      type: 'success',
    })
  }

  const showApiValidationError = (errors: ValidationError[], duration = -1, fieldIsTranslated = false) => {
    const { t, te } = i18n.global
    const texts = [t('common.alert.fixApiValidationErrors')]

    for (let i = 0; i < errors.length; i++) {
      let fieldText = ''
      if (fieldIsTranslated) {
        fieldText += errors[i].field
      } else if (te(errors[i].field)) {
        fieldText += t(errors[i].field)
      } else if (errors[i].field.includes('[')) {
        fieldText += resolveListErrors(errors[i].field)
      }
      const errorsTexts = new Set<string>()
      for (let j = 0; j < errors[i].errors.length; j++) {
        if (te('error.apiValidation.' + errors[i].errors[j])) {
          errorsTexts.add(t('error.apiValidation.' + errors[i].errors[j]))
          continue
        }
        errorsTexts.add(t('error.apiValidation.noTranslation'))
      }
      if (fieldText.length > 0) {
        texts.push(fieldText + ': ' + Array.from(errorsTexts).join(', '))
      }
    }
    notify({
      group: 'alerts',
      text: texts.join(NEW_LINE_MARK),
      duration: duration * 1000,
      type: 'error',
    })
  }

  const showApiForbiddenOperationError = (detail: string, duration = -1) => {
    const { t, te } = i18n.global
    let text = t('error.apiForbiddenOperation.noTranslation')
    if (te('error.apiForbiddenOperation.' + detail)) {
      text = t('error.apiForbiddenOperation.' + detail)
    }
    notify({
      group: 'alerts',
      text: text,
      duration: duration * 1000,
      type: 'error',
    })
  }

  const showUnknownError = (duration = -1) => {
    const { t } = i18n.global
    notify({
      group: 'alerts',
      text: t('common.alert.unknownError'),
      duration: duration * 1000,
      type: 'error',
    })
  }

  const showForbiddenError = (duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = i18n.global
    notify({
      group: 'alerts',
      text: t('common.alert.forbiddenError'),
      duration: duration * 1000,
      type: 'error',
    })
  }

  const showErrorsDefault = (error: any) => {
    if (isAnzuApiForbiddenError(error)) {
      showForbiddenError()
      return true
    }
    if (isAnzuApiValidationError(error)) {
      showApiValidationError(error.fields)
      return true
    }
    if (isAnzuApiForbiddenOperationError(error)) {
      showApiForbiddenOperationError(error.detail)
      return true
    }
    if (isAnzuFatalError(error)) {
      showUnknownError()
      return true
    }
    if (isAnzuApiResponseCodeError(error)) {
      showUnknownError()
      return true
    }
    return false
  }

  const resolveListErrors = (error: string) => {
    const { t } = i18n.global
    const parsedField = error.split('[')
    const firstField = parsedField[0].trim()
    const parsedSecond = parsedField[1].split(']')
    const indexNumber = parsedSecond[0]
    const secondField = parsedSecond[1]

    return t(firstField) + '[' + indexNumber + ']: ' + t(firstField.slice(0, -1) . secondField)
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
