// eslint-disable-next-line
import type { MessageSchema } from '@/plugins/i18n'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}

declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    ABtnPrimary: typeof import('vuetify/components')['VBtn']
    ABtnSecondary: typeof import('vuetify/components')['VBtn']
    ABtnTertiary: typeof import('vuetify/components')['VBtn']
    ABtnIcon: typeof import('vuetify/components')['VBtn']
    RouterLink: typeof import('vue-router')['RouterLink']
    RouterView: typeof import('vue-router')['RouterView']
  }
}
