import { createI18nMessage, numeric } from '@vuelidate/validators'

export function useValidateNumeric(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(numeric, {
    messagePath: () => 'validations.numeric',
  })
}
