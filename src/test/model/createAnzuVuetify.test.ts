import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createAnzuVuetify, useCommonVuetifyConfig } from '@/model/commonVuetifyConfig'

// The Vuetify instance the six admins created in their own `vuetify.ts`. admin-ugc merged its
// `VDataTableServer` defaults over the common ones; that has to keep working the same way.

const i18n = () => createI18n({ legacy: false, locale: 'sk', messages: { sk: { $vuetify: { close: 'Zavrieť' } } } })

describe('createAnzuVuetify', () => {
  it('has the common theme, aliases and defaults', () => {
    const vuetify = createAnzuVuetify({ i18n: i18n() })
    const { commonDefaults } = useCommonVuetifyConfig()
    expect(vuetify.theme.global.name.value).toBe('light')
    expect(vuetify.defaults.value?.VTextField).toEqual(commonDefaults().VTextField)
  })

  it('merges the admin defaults over the common ones per component', () => {
    const vuetify = createAnzuVuetify({
      i18n: i18n(),
      defaults: { VDataTableServer: { mobileBreakpoint: 'md', disableSort: true } },
    })
    expect(vuetify.defaults.value?.VDataTableServer).toEqual({ mobileBreakpoint: 'md', disableSort: true })
    expect(vuetify.defaults.value?.VTextField).toBeDefined()
  })

  it("translates Vuetify's texts through the admin's i18n and registers Intersect", () => {
    const instance = i18n()
    const vuetify = createAnzuVuetify({ i18n: instance })
    const app = createApp({ setup: () => () => null })
    app.use(instance)
    app.use(vuetify)
    expect(app._context.directives.Intersect).toBeDefined()
    expect(vuetify.locale.t('$vuetify.close')).toBe('Zavrieť')
  })
})
