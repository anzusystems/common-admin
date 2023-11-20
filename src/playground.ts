import { createApp } from 'vue'
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { i18n } from '@/plugins/i18n'
import { createPinia } from 'pinia'
import router from '@/router'
import AnzuSystemsCommonAdmin from '@/AnzuSystemsCommonAdmin'
import { damClient } from '@/playground/assetSelectView/coreDamClient'
import '@/styles/main.scss'
import { currentUser } from '@/playground/system/currentUser'
import type { LanguageCode } from '@/composables/languageSettings'
import { loadCommonFonts } from '@/plugins/webfontloader'
import { playgroundFetchImageCms } from '@/playground/imageView/api'
import { cmsClient } from '@/playground/imageView/cmsClient'

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
      configs: {
        default: {
          damClient: damClient,
          defaultLicenceId: 100001,
        },
      },
      apiTimeout: 30,
      uploadStatusFallback: false,
    },
    image: {
      configs: {
        default: {
          imageClient: cmsClient,
          getImage: playgroundFetchImageCms,
          imageUrl: 'http://admin-image.smedata.localhost',
          width: 500,
          height: 281,
        },
      },
    },
  })
  .mount('#app')
