import { createApp } from 'vue'
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { i18n } from '@/plugins/i18n'
import { createPinia } from 'pinia'
import router from '@/router/playground'
import AnzuSystemsCommonAdmin, { type PluginOptions } from '@/AnzuSystemsCommonAdmin'
import { damClient } from '@/playground/mock/coreDamClient'
import '@/styles/main.scss'
import type { LanguageCode } from '@/composables/languageSettings'
import { loadCommonFonts } from '@/plugins/webfontloader'
import { cmsClient } from '@/playground/mock/cmsClient'

export const DEFAULT_LANGUAGE: LanguageCode = 'sk'
export const AVAILABLE_LANGUAGES: Array<LanguageCode> = ['sk', 'en']

loadCommonFonts()

createApp(App)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(vuetify)
  .use<PluginOptions>(AnzuSystemsCommonAdmin, {
    languages: {
      available: ['en', 'sk'],
      default: 'sk',
    },
    coreDam: {
      configs: {
        default: {
          damClient: damClient,
        },
      },
      apiTimeout: 30,
      uploadStatusFallback: false,
      adminDomain: 'http://admin-dam.sme.localhost:8150',
      notification: {
        enabled: true,
        webSocketUrl: 'ws://notification-server.sme.localhost/ws',
      },
    },
    image: {
      configs: {
        default: {
          imageClient: cmsClient,
          previewDomain: 'http://admin-image.smedata.localhost',
          width: 500,
          height: 281,
        },
      },
    },
    collab: {
      enabled: true,
      socketUrl: 'ws://collaboration.sme.localhost',
    },
  })
  .mount('#app')
