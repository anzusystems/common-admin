import { createI18nMessage, numeric } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateNumeric() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(numeric, {
    messagePath: () => 'error.jsValidation.numeric',
  })
}
