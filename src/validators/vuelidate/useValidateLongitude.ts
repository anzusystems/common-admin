import { createI18nMessage, helpers } from '@vuelidate/validators'

export function useValidateLongitude(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(
    helpers.regex(/^(\+|-)?(?:180(?:(?:\.0{1,6})?)|(?:[0-9]|[1-9][0-9]|1[0-7][0-9])(?:(?:\.[0-9]{1,6})?))$/),
    {
      messagePath: () => 'validations.longitude',
    }
  )
}
