import { createI18nMessage, helpers } from '@vuelidate/validators'

export function useValidateSlug(i18nTranslate: any) {
  const withI18nMessage = createI18nMessage({ t: i18nTranslate })

  return withI18nMessage(helpers.regex(/^[a-z\-0-9/]+$/), {
    messagePath: () => 'validations.slug',
  })
}
