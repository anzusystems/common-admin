import { type Ref, ref } from 'vue'
import { createI18n, Locale, Path, type I18n } from 'vue-i18n'
import { commonMessages } from '@/locales'

const REQUIRED_LOCALES = ['sk', 'en']

interface Config {
  i18nInstance: null | I18n
}

export const commonAdminI18n = ref(null) as Ref<I18n | null>

export const useI18n = () => {
  return {
    t: commonAdminI18n.value && commonAdminI18n.value.global ? commonAdminI18n.value.global.t : (key: string) => key,
  }
}

export const createCommonAdmin = (config: Config = { i18nInstance: null }) => {
  if (config.i18nInstance) {
    commonAdminI18n.value = config.i18nInstance
    return
  }
  commonAdminI18n.value = createI18n({
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
}
