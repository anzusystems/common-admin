import { createI18nMessage, helpers } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateSlovakPhoneNumber() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(helpers.regex(/^\+4219[0-9]{8}$/), {
    messagePath: () => 'validations.js.phoneNumber',
  })
}
