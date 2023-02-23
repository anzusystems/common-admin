import type { App, DeepReadonly, Ref, UnwrapRef } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'
import { AclValue } from '@/types/Permission'
import Acl from '@/components/permission/Acl.vue'
import { createI18nInstance } from '@/plugins/translate'
import type { I18n } from 'vue-i18n'
import Notification from '@kyvg/vue3-notification'
import { LanguageCode } from '@/composables/languageSettings'

export type CustomAclResolver<T extends AclValue = AclValue> =
  | undefined
  | {
      can?: (acl: T, subject?: object) => boolean
      canOwner?: (subject: object) => boolean
    }

export type CurrentUserType = DeepReadonly<Ref<UnwrapRef<AnzuUser | undefined>>>

export type PluginOptions<T extends AclValue = AclValue> = {
  currentUser: CurrentUserType
  languages: { available: LanguageCode[]; default: LanguageCode }
  customAclResolver?: CustomAclResolver<T>
  i18n: I18n
}

export const CurrentUserSymbol = Symbol('currentUser')
export const CustomAclResolverSymbol = Symbol('customAclResolver')
export const AvailableLanguagesSymbol = Symbol('availableLanguages')
export const DefaultLanguageSymbol = Symbol('defaultLanguage')

export default {
  install<T extends AclValue = AclValue>(app: App, options: PluginOptions<T>): void {
    createI18nInstance(options.i18n)
    app.provide(CurrentUserSymbol, options.currentUser)
    app.provide(CustomAclResolverSymbol, options.customAclResolver)
    app.provide(AvailableLanguagesSymbol, options.languages.available)
    app.provide(DefaultLanguageSymbol, options.languages.default)
    app.component('Acl', Acl)
    app.use(Notification, { componentName: 'Notifications' })
  },
}
