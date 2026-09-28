import { createI18nMessage, maxLength } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateMaxLength() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(maxLength, {
    withArguments: true,
    messagePath: () => 'error.jsValidation.maxLength',
  })
}
