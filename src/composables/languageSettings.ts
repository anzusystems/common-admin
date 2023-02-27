import { useStorage } from '@vueuse/core'
import { readonly } from 'vue'
import { useLocale } from 'vuetify'
import { i18n } from '@/plugins/i18n'

// use ISO 639-1 codes
export type LanguageCode = 'en' | 'sk' | 'cs' | 'xx'

export interface Language {
  code: LanguageCode
  title: string
  adminOnly?: boolean
}

export const ALL_LANGUAGES = [
  {
    code: 'en',
    title: 'English',
  },
  {
    code: 'sk',
    title: 'Slovensky',
  },
  {
    code: 'cs',
    title: 'Česky',
  },
  {
    code: 'xx',
    title: 'Translation ID',
    adminOnly: true,
  },
] as Language[]

const storedSettings = useStorage<LanguageCode>('language', 'xx')

export function modifyLanguageSettings(configAvailableLanguages: LanguageCode[], configDefaultLanguage: LanguageCode) {
  const { current } = useLocale()

  const setLanguage = (code: LanguageCode) => {
    if (!i18n || !i18n.global) return false
    if ((configAvailableLanguages.includes(code) || code === 'xx') && i18n.global.availableLocales.includes(code)) {
      current.value = code
      storedSettings.value = code
      // @ts-ignore
      i18n.global.locale.value = code

      return code
    }
    return false
  }

  const initializeLanguage = () => {
    if (!i18n || !i18n.global) return
    if (
      (configAvailableLanguages.includes(storedSettings.value) || storedSettings.value === 'xx') &&
      i18n.global.availableLocales.includes(storedSettings.value)
    ) {
      current.value = storedSettings.value
      // @ts-ignore
      i18n.global.locale.value = storedSettings.value
      return
    }
    storedSettings.value = configDefaultLanguage
    current.value = configDefaultLanguage
    // @ts-ignore
    i18n.global.locale.value = configDefaultLanguage
  }

  return {
    initializeLanguage,
    currentLanguageCode: readonly(storedSettings),
    setLanguage,
    allLanguages: ALL_LANGUAGES,
  }
}

export function useLanguageSettings() {
  return {
    currentLanguageCode: readonly(storedSettings),
  }
}
