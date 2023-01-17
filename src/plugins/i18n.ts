import type { Locale, Path } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
import { commonMessages } from '../locales'

const REQUIRED_LOCALES = ['sk']

export const i18n = createI18n({
  globalInjection: false,
  legacy: false,
  locale: REQUIRED_LOCALES[0],
  fallbackLocale: false,
  missing: (locale: Locale, key: Path) => {
    if (REQUIRED_LOCALES.includes(locale)) {
      console.warn(`Missing ${locale} translation: ${key}`)
    }
  },
  messages: commonMessages,
})
