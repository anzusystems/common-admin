import { createI18nMessage, between } from '@vuelidate/validators'

export function useValidateBetween(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(between, {
    withArguments: true,
    messagePath: () => 'validations.between',
  })
}
