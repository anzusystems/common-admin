import { createI18nMessage, helpers } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

export function useValidateSlug() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(helpers.regex(/^[a-z\-0-9/]+$/), {
    messagePath: () => 'error.jsValidation.slug',
  })
}
