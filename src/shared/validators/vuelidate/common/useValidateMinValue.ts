import { createI18nMessage, minValue } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateMinValue() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(minValue, {
    withArguments: true,
    messagePath: () => 'error.jsValidation.minValue',
  })
}
