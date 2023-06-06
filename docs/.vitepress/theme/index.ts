// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import Theme from 'vitepress/theme'
import './style.css'
import { createVuetify } from 'vuetify'
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
// @ts-ignore
import { i18n } from '@/plugins/i18nDocs'
import { useI18n } from 'vue-i18n'
import { Intersect } from 'vuetify/directives'
// @ts-ignore
import { useCommonVuetifyConfig } from '@/model/commonVuetifyConfig'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import '../../../src/styles/main.scss'
// @ts-ignore
import DocsExample from '../DocsExample.vue'


const { commonTheme, commonAliases, commonDefaults } = useCommonVuetifyConfig()
export const vuetify = createVuetify({
  aliases: commonAliases(),
  components: {
    VDataTableServer,
  },
  locale: {
    // @ts-ignore
    adapter: createVueI18nAdapter({ i18n, useI18n }),
  },
  directives: { Intersect },
  theme: commonTheme(),
  defaults: commonDefaults(),
})

export default {
  ...Theme,
  Layout: () => {
    return h(Theme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },
  // @ts-ignore
  enhanceApp({ app, router, siteData }) {
    // ...
    app.use(i18n)
    app.use(vuetify)
    app.component('DocsExample', DocsExample)
  }
}
