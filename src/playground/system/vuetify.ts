import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { i18n } from '@/plugins/i18n'
import { createAnzuVuetify } from '@/model/commonVuetifyConfig'

export const vuetify = createAnzuVuetify({ i18n })
