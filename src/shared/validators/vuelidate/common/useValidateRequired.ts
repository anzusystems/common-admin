import { createI18nMessage, required } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateRequired() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(required, {
    messagePath: () => 'error.jsValidation.required',
  })
}
