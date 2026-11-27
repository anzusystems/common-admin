import { createI18nMessage, maxValue } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateMaxValue() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(maxValue, {
    withArguments: true,
    messagePath: () => 'error.jsValidation.maxValue',
  })
}
