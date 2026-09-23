import { createI18nMessage, helpers } from '@vuelidate/validators'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

/**
 * `#RRGGBB`, which is what the backend's `CssColor(HEX_LONG)` accepts.
 *
 * The admins validated this by length alone -- `minLength(7)` and `maxLength(7)` -- which lets
 * `#GGGGGG` through the form and has the server reject it. `helpers.regex` passes an empty value,
 * so a system whose profile does not require a colour still saves without one.
 */
export function useValidateHexColor() {
  const withI18nMessage = createI18nMessage({ t })

  return withI18nMessage(helpers.regex(/^#[0-9a-fA-F]{6}$/), {
    messagePath: () => 'error.jsValidation.hexColor',
  })
}
