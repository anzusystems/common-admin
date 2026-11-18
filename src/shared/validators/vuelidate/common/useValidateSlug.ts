import { createI18nMessage, helpers } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

export function useValidateSlug() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(helpers.regex(/^[a-z\-0-9]+$/), {
    messagePath: () => 'error.jsValidation.slug',
  })
}
