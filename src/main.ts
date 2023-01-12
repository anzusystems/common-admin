import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './plugins/i18n'
import { vuetify } from '@/plugins/vuetify'

import App from './App.vue'
import router from './router'

const app = createApp(App)
  .use(i18n)
  .use(createPinia())
  .use(vuetify)
  .use(router)

app.mount('#app')
