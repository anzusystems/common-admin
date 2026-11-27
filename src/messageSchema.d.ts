import type { MessageSchema } from '@/plugins/i18n'

// The library's own keys, for its type-check only: a `.d.ts` source is not published, so this does not
// clash with the `DefineLocaleMessage` an admin declares for its keys.
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
