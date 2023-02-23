import { notify } from '@kyvg/vue3-notification'
import type { ApiErrors } from '@/composables/system/error'
import { useI18n } from 'vue-i18n'

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
    const { t } = useI18n()
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
    const { t } = useI18n()
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
    const { t } = useI18n()
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
    const { t } = useI18n()
    showWarning(t(translation), duration)
  }

  const showValidationError = (duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = useI18n()
    notify({
      group: 'alerts',
      text: t('common.alerts.fixValidationErrors'),
      duration: duration * 1000,
      type: 'error',
    })
  }

  const showRecordWas = (variant: RecordWasType, duration = DEFAULT_DURATION_SECONDS) => {
    const { t } = useI18n()
    notify({
      group: 'alerts',
      text: t('common.alerts.recordWas.' + variant),
      duration: duration * 1000,
      type: 'success',
    })
  }

  const showApiError = (errors: ApiErrors[], duration = -1, fieldIsTranslated = false) => {
    const { t } = useI18n()
    let text = t('common.alerts.fixApiValidationErrors') + NEW_LINE_MARK
    for (let i = 0; i < errors.length; i++) {
      text += fieldIsTranslated ? errors[i].field + ': ' : t(errors[i].field) + ': '
      for (let j = 0; j < errors[i].errors.length; j++) {
        text += t('common.alerts.apiValidationErrors.' + errors[i].errors[j]) + NEW_LINE_MARK
      }
    }
    notify({
      group: 'alerts',
      text: text,
      duration: duration * 1000,
      type: 'error',
    })
  }

  const showUnknownError = (duration = -1) => {
    const { t } = useI18n()
    notify({
      group: 'alerts',
      text: t('common.alerts.unknownError'),
      duration: duration * 1000,
      type: 'error',
    })
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
    showApiError,
    showUnknownError,
  }
}
