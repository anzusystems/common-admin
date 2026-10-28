import { createI18nMessage, url } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateUrl() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(url, {
    messagePath: () => 'error.jsValidation.url',
  })
}
