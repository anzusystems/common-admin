import { createI18nMessage, url } from '@vuelidate/validators'

export function useValidateUrl(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(url, {
    messagePath: () => 'validations.url',
  })
}
