import { createI18nMessage, minLength } from '@vuelidate/validators'

export function useMinLength(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(minLength, {
    withArguments: true,
    messagePath: () => 'validations.minLength',
  })
}
