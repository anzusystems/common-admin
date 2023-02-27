import { createI18nMessage, helpers } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateLongitude() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(
    helpers.regex(/^(\+|-)?(?:180(?:(?:\.0{1,6})?)|(?:[0-9]|[1-9][0-9]|1[0-7][0-9])(?:(?:\.[0-9]{1,6})?))$/),
    {
      messagePath: () => 'validations.js.longitude',
    }
  )
}
