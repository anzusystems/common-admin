// Styles
import '@mdi/font/scss/materialdesignicons.scss'
import 'vuetify/styles'
// Vuetify
import { createVuetify } from 'vuetify'
import { Intersect } from 'vuetify/directives'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { i18n } from './i18n'
import { useI18n } from 'vue-i18n'

export const vuetify = createVuetify({
  locale: {
    adapter: createVueI18nAdapter({ i18n, useI18n }),
  },
  directives: { Intersect },
  theme: {
    defaultTheme: 'light',
    variations: {
      colors: [],
      lighten: 0,
      darken: 0,
    },
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#F1F4F6',
          surface: '#ffffff',
          // 'on-surface': '#0D0D0D',
          primary: '#3f6ad8',
          secondary: '#444054',
          success: '#3ac47d',
          'on-success': '#fff',
          warning: '#f7b924',
          error: '#d92550',
          info: '#78c3fb',
          'primary-darken-1': '#3700B3',
          'secondary-darken-1': '#018786',
        },
        variables: {},
      },
      dark: {
        dark: true,
        colors: {
          background: '#1A1A1A',
          surface: '#363636',
          primary: '#3f6ad8',
          secondary: '#444054',
          success: '#3ac47d',
          warning: '#f7b924',
          error: '#d92550',
          info: '#78c3fb',
          'primary-darken-1': '#3700B3',
          'secondary-darken-1': '#03DAC5',
        },
        variables: {},
      },
    },
  },
  defaults: {
    global: {},
    VBtn: {},
    VTextField: {
      variant: 'outlined',
      density: 'compact',
      color: 'primary',
    },
    VSelect: {
      variant: 'outlined',
      density: 'compact',
      color: 'primary',
    },
  },
})
