import type { I18n, Locale, Path } from 'vue-i18n'
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

export const i18n = createI18n<[MessageSchema], string, false>({
  globalInjection: false,
  legacy: false,
  locale: REQUIRED_LOCALES[0],
  fallbackLocale: false,
  pluralRules: {
    sk: slovakPluralizationRule,
    // Czech shares the Slovak plural categories (one / 2-4 / other), and without
    // a rule the default would pick zero|one|other: "1 nepotvrzené změny".
    cs: slovakPluralizationRule,
  },
  missing: (locale: Locale, key: Path) => {
    if (REQUIRED_LOCALES.includes(locale) && !key.startsWith('system.subject.')) {
      console.warn(`Missing ${locale} translation: ${key}`)
    }
  },
})

/** The admin's instance as the plugin takes it: composition mode (`legacy: false`), any message schema. */
// oxlint-disable-next-line typescript/no-explicit-any -- the admin's own message schema
export type CommonAdminI18n = I18n<any, any, any, string, false>

let installed: CommonAdminI18n | undefined

/** Takes the admin's instance (the plugin's `i18n` option); the library translates through it from then on. */
export const setCommonAdminI18n = (instance: CommonAdminI18n): void => {
  installed = instance
}

/**
 * The instance the library translates through: the admin's own, once the plugin has it. Before that --
 * the library's tests and playground -- the library's instance above.
 *
 * Read when a text is translated, not when a module loads: a validator or an alert module imported
 * before the plugin is installed would otherwise keep the wrong instance for good.
 */
export const commonI18n = (): CommonAdminI18n => installed ?? (i18n as unknown as CommonAdminI18n)

type Translate = (key: string, ...args: unknown[]) => string

/** `t` of `commonI18n()`, resolved on every call. */
export const commonT: Translate = (key, ...args) => (commonI18n().global.t as unknown as Translate)(key, ...args)

/** `te` of `commonI18n()`, resolved on every call. */
export const commonTe = (key: string, locale?: string): boolean =>
  (commonI18n().global.te as (key: string, locale?: string) => boolean)(key, locale)
