import { required, createI18nMessage } from '@vuelidate/validators'

export function useRequired(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(required, {
    messagePath: () => 'validations.required',
  })
}
