import { ref } from 'vue'
import { createI18n, Locale, Path } from 'vue-i18n'
import { commonMessages } from '@/locales'

const REQUIRED_LOCALES = ['sk', 'en']

interface Config {
  i18nInstance: any
}

export const commonAdminI18n = ref<any>(null)

export const useI18n = () => {
  if (commonAdminI18n.value) {
    return commonAdminI18n.value.global
  }
  console.warn('[Common admin] Do not use useI18n before initialisation.')

  return {
    t: () => {
      return ''
    },
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
