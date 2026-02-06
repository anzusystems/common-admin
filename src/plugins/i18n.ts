import type { Locale, Path } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
import type en from '@/locales/en'

export type MessageSchema = typeof en

const REQUIRED_LOCALES = ['en', 'sk']

/**
 * Custom Slovak Pluralization Rule.
 *
 * Automatically detects the format of the translation string based on the number
 * of pipe-separated choices (`choicesLength`) and returns the correct index.
 *
 * Case A: 4 choices (Extended format with explicit 0 support)
 * Structure: "0 items | 1 item | 2-4 items | 5+ items"
 * - 0    -> Index 0
 * - 1    -> Index 1
 * - 2-4  -> Index 2
 * - 5+   -> Index 3
 *
 * Case B: 3 choices (Starndard Slovak format)
 * Structure: "1 item | 2-4 items | 5+ items"
 * - 1    -> Index 0
 * - 2-4  -> Index 1
 * - 5+   -> Index 2 (Includes 0)
 *
 * Case C: 2 choices or fewer (Fallback)
 * - 1    -> Index 0
 * - Other-> Index 1
 */
export const slovakPluralizationRule = (choice: number, choicesLength: number) => {
  if (choicesLength === 4) {
    if (choice === 0) return 0
    if (choice === 1) return 1
    if (choice >= 2 && choice <= 4) return 2
    return 3
  }
  if (choicesLength === 3) {
    if (choice === 1) return 0
    if (choice >= 2 && choice <= 4) return 1
    return 2
  }
  return choice === 1 ? 0 : 1
}

export const i18n = createI18n<[MessageSchema]>({
  globalInjection: false,
  locale: REQUIRED_LOCALES[0],
  fallbackLocale: false,
  pluralRules: {
    sk: slovakPluralizationRule,
  },
  missing: (locale: Locale, key: Path) => {
    if (REQUIRED_LOCALES.includes(locale)) {
      console.warn(`Missing ${locale} translation: ${key}`)
    }
  },
})
