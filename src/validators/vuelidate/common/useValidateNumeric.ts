import { createI18nMessage, numeric } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateNumeric() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(numeric, {
    messagePath: () => 'error.jsValidation.numeric',
  })
}
