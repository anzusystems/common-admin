// eslint-disable-next-line
import type { DefineLocaleMessage } from 'vue-i18n'
import type { MessageSchema } from '@/plugins/i18n'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
