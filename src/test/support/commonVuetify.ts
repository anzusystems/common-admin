import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { afterAll, beforeAll } from 'vitest'
import en from '@/locales/en'
import { useCommonVuetifyConfig } from '@/model/commonVuetifyConfig'

/**
 * `setup.ts` builds Vuetify without the library's aliases and defaults, so `ABtnPrimary` and its
 * siblings render as unknown elements there. A suite that needs them as real buttons calls this
 * at the top: it swaps the global plugins for a Vuetify built the way the admins build it, and
 * puts the original ones back after the file.
 */
export const useCommonVuetifyPlugins = () => {
  let saved: typeof config.global.plugins
  beforeAll(() => {
    saved = config.global.plugins
    const { commonAliases, commonDefaults, commonTheme } = useCommonVuetifyConfig()
    const vuetify = createVuetify({
      components,
      directives,
      aliases: commonAliases(),
      defaults: commonDefaults(),
      theme: commonTheme(),
    })
    const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } })
    config.global.plugins = [vuetify, i18n, createPinia()]
  })
  afterAll(() => {
    config.global.plugins = saved
  })
}
