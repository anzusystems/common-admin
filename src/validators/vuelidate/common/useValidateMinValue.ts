import { createI18nMessage, minValue } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateMinValue() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(minValue, {
    withArguments: true,
    messagePath: () => 'error.jsValidation.minValue',
  })
}
