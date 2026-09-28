import { createI18nMessage, email } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateEmail() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(email, {
    messagePath: () => 'error.jsValidation.email',
  })
}
