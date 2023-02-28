import { createI18nMessage, requiredIf } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateRequiredIf() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(requiredIf, {
    withArguments: true,
    messagePath: () => 'validations.js.required',
  })
}
