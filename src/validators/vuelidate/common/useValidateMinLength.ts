import { createI18nMessage, minLength } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateMinLength() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(minLength, {
    withArguments: true,
    messagePath: () => 'error.jsValidation.minLength',
  })
}
