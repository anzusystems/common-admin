import { createI18nMessage, maxLength } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateMaxLength() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(maxLength, {
    withArguments: true,
    messagePath: () => 'validations.js.maxLength',
  })
}
