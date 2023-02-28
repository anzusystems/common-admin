import type { Locale, Path } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
import type en from '@/locales/en'

export type MessageSchema = typeof en

const REQUIRED_LOCALES = ['en', 'sk']

export const i18n = createI18n<[MessageSchema]>({
  globalInjection: false,
  legacy: false,
  locale: REQUIRED_LOCALES[0],
  fallbackLocale: false,
  missing: (locale: Locale, key: Path) => {
    if (REQUIRED_LOCALES.includes(locale)) {
      console.warn(`Missing ${locale} translation: ${key}`)
    }
  },
})
