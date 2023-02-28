// eslint-disable-next-line
import type { MessageSchema } from '@/plugins/i18n'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
