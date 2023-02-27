import { createI18nMessage, maxLength } from '@vuelidate/validators'

export function useValidateMaxLength(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(maxLength, {
    withArguments: true,
    messagePath: () => 'validations.maxLength',
  })
}
