import { createI18nMessage, helpers } from '@vuelidate/validators'

export function useValidatePhoneNumber(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(helpers.regex(/^\+4219[0-9]{8}$/), {
    messagePath: () => 'validations.phoneNumber',
  })
}
