import '@mdi/font/scss/materialdesignicons.scss'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { Intersect } from 'vuetify/directives'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { i18n } from '@/plugins/i18n'
import { useI18n } from 'vue-i18n'
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import { useCommonVuetifyConfig } from '@/model/commonVuetifyConfig'

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
