import { createApp } from 'vue'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'
import { i18n } from './plugins/i18n'
import { createPinia } from 'pinia'
import router from './router'
import { createCommonAdmin } from '@/createCommonAdmin'

console.log(i18n)

createCommonAdmin({ i18nInstance: i18n })

createApp(App).use(createPinia()).use(router).use(i18n).use(vuetify).mount('#app')
