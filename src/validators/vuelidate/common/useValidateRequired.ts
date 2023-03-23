import { createI18nMessage, required } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateRequired() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(required, {
    messagePath: () => 'error.jsValidation.required',
  })
}
