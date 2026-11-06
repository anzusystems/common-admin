import { createI18nMessage, helpers } from '@vuelidate/validators'
import { commonT } from '@/plugins/i18n'

const t = commonT

/**
 * `#RRGGBB`, which the backend's `CssColor(HEX_LONG)` accepts.
 * A length-only check lets `#GGGGGG` through and the server rejects it.
 * `helpers.regex` passes an empty value, so a system that does not require a colour still saves without one.
 */
export function useValidateHexColor() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(helpers.regex(/^#[0-9a-fA-F]{6}$/), {
    messagePath: () => 'error.jsValidation.hexColor',
  })
}
