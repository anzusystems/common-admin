import { useStorage } from '@vueuse/core'
import { readonly } from 'vue'
import { I18n } from 'vue-i18n'
import { useLocale } from 'vuetify'
import { i18n as i18nCommon } from '@/plugins/i18n'

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

export function modifyLanguageSettings(
  i18n: I18n | undefined | any,
  configAvailableLanguages: LanguageCode[],
  configDefaultLanguage: LanguageCode
) {
  const { current } = useLocale()
  const setLanguage = (code: LanguageCode) => {
    if (!i18n || !i18n.global) return
    if (configAvailableLanguages.includes(code) && i18n.global.availableLocales.includes(code)) {
      current.value = code
      storedSettings.value = code
      // @ts-ignore
      i18nCommon.global.locale.value = code
    }
  }

  const initializeLanguage = () => {
    if (!i18n || !i18n.global) return
    if (
      configAvailableLanguages.includes(storedSettings.value) &&
      i18n.global.availableLocales.includes(storedSettings.value)
    ) {
      current.value = storedSettings.value
      // @ts-ignore
      i18nCommon.global.locale.value = storedSettings.value
      return
    }
    storedSettings.value = configDefaultLanguage
    current.value = configDefaultLanguage
    // @ts-ignore
    i18nCommon.global.locale.value = configDefaultLanguage
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
