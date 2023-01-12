import type { Locale, Path } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
import { messages } from '@/locales'

const DO_NOT_LOG_LOCALES = ['en']

export const i18n = createI18n({
  globalInjection: false,
  legacy: false,
  useScope: 'global',
  locale: 'sk',
  fallbackLocale: false,
  missing: (locale: Locale, key: Path) => {
    if (DO_NOT_LOG_LOCALES.includes(locale)) return
    console.warn(`Missing ${locale} translation: ${key}`)
  },
  fallbackWarn: false,
  messages,
})
