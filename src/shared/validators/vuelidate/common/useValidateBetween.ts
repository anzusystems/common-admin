import { between, createI18nMessage } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateBetween() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(between, {
    withArguments: true,
    messagePath: () => 'error.jsValidation.between',
  })
}
