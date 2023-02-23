import type { Locale, Path } from 'vue-i18n'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en.json'
import sk from '@/locales/sk.json'
import xx from '@/locales/xx.json'

export type MessageSchema = typeof en

const REQUIRED_LOCALES = ['en', 'sk']

export const commonMessages = {
  en,
  sk,
  xx,
}

// export const i18n = createI18n<[MessageSchema], 'en' | 'sk'>({
export const i18n = createI18n<[MessageSchema], 'en'>({
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
