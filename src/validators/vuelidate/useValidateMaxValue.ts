import { createI18nMessage, maxValue } from '@vuelidate/validators'

export function useValidateMaxValue(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(maxValue, {
    withArguments: true,
    messagePath: () => 'validations.maxValue',
  })
}
