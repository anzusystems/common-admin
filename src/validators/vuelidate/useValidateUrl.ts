import { createI18nMessage, url } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateUrl() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(url, {
    messagePath: () => 'validations.js.url',
  })
}
