import { between, createI18nMessage } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateBetween() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(between, {
    withArguments: true,
    messagePath: () => 'error.jsValidation.between',
  })
}
