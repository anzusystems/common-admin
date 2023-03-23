import { createI18nMessage, email } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateEmail() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(email, {
    messagePath: () => 'error.jsValidation.email',
  })
}
