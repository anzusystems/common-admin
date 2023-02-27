import { createI18nMessage, maxValue } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateMaxValue() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(maxValue, {
    withArguments: true,
    messagePath: () => 'validations.js.maxValue',
  })
}
