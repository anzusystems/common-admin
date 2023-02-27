import { createI18nMessage, helpers } from '@vuelidate/validators'

export function useValidateLatitude(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(helpers.regex(/^(\+|-)?(?:90(?:(?:\.0{1,6})?)|(?:[0-9]|[1-8][0-9])(?:(?:\.[0-9]{1,6})?))$/), {
    messagePath: () => 'validations.latitude',
  })
}
