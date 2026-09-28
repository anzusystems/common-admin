import { useStorage } from '@vueuse/core'
import { readonly } from 'vue'
// import { useLocale } from 'vuetify'
import { commonI18n } from '@/plugins/i18n'

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

const storedSettings = useStorage<LanguageCode | 'default'>('language', 'default')

export function modifyLanguageSettings(
  configAvailableLanguages: LanguageCode[],
  configDefaultLanguage: LanguageCode,
  i18nInstance?: any
) {
  const i18n = i18nInstance || commonI18n()
  // const { current } = useLocale()

  function addMessages(language: LanguageCode, messages: any) {
    if (!i18n || !i18n.global) return
    // @ts-ignore
    i18n.global.setLocaleMessage(language, messages)
    // The language chosen before its messages arrived (see setLanguage) switches now.
    // @ts-ignore
    if (storedSettings.value === language) i18n.global.locale.value = language
  }

  const setLanguage = (code: LanguageCode) => {
    if (!i18n || !i18n.global) return false
    if (configAvailableLanguages.includes(code) || code === 'xx') {
      // current.value = code
      storedSettings.value = code
      // Only a language whose messages are loaded: the admins load one language at a time and reload
      // after a switch, and in between the page would show raw keys. addMessages switches it later.
      // Not `availableLocales`: it also lists the instance's starting locale, messages or not.
      // @ts-ignore
      if (code === 'xx' || Object.keys(i18n.global.getLocaleMessage(code) ?? {}).length > 0) {
        // @ts-ignore
        i18n.global.locale.value = code
      }

      return code
    }
    return false
  }

  const initializeLanguage = () => {
    if (!i18n || !i18n.global) return
    if (storedSettings.value === 'default') {
      // No explicit user preference in localStorage — use app default
      storedSettings.value = configDefaultLanguage
      // @ts-ignore
      i18n.global.locale.value = configDefaultLanguage
      return
    }
    if (configAvailableLanguages.includes(storedSettings.value) || storedSettings.value === 'xx') {
      // current.value = storedSettings.value
      // @ts-ignore
      i18n.global.locale.value = storedSettings.value
      return
    }
    storedSettings.value = configDefaultLanguage
    // current.value = configDefaultLanguage
    // @ts-ignore
    i18n.global.locale.value = configDefaultLanguage
  }

  const applyUserLocale = (locale: string | null) => {
    if (!locale) return false
    const code = locale as LanguageCode
    if (storedSettings.value !== 'default' && code === storedSettings.value) return false
    return setLanguage(code)
  }

  return {
    addMessages,
    applyUserLocale,
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
