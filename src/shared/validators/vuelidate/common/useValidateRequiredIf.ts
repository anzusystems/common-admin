import { createI18nMessage, requiredIf } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateRequiredIf() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(requiredIf, {
    withArguments: true,
    messagePath: () => 'error.jsValidation.required',
  })
}
