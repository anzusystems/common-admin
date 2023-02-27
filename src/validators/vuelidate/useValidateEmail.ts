import { createI18nMessage, email } from '@vuelidate/validators'

export function useValidateEmail(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(email, {
    messagePath: () => 'validations.email',
  })
}
