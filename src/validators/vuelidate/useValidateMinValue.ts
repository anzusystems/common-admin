import { createI18nMessage, minValue } from '@vuelidate/validators'

export function useValidateMinValue(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(minValue, {
    withArguments: true,
    messagePath: () => 'validations.minValue',
  })
}
