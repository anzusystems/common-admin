import { createApp } from 'vue'
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { i18n } from '@/plugins/i18n'
import { createPinia } from 'pinia'
import router from '@/router'
import AnzuSystemsCommonAdmin from '@/AnzuSystemsCommonAdmin'
import { damClient } from '@/services/api/clients/coreDamClient'
import '@/styles/main.scss'
import { currentUser } from '@/views/system/currentUser'
import type { LanguageCode } from '@/composables/languageSettings'
import { loadCommonFonts } from '@/plugins/webfontloader'

export type CustomAclValue = 'anzu_entity_create' | 'anzu_entity_view'

export const DEFAULT_LANGUAGE: LanguageCode = 'sk'
export const AVAILABLE_LANGUAGES: Array<LanguageCode> = ['sk', 'en']

loadCommonFonts()

createApp(App)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(vuetify)
  .use(AnzuSystemsCommonAdmin, {
    currentUser,
    languages: {
      available: ['en', 'sk'],
      default: 'sk',
    },
    coreDam: {
      client: damClient,
      defaultLicenceId: 100001,
    },
  })
  .mount('#app')
