import type { App, DeepReadonly, Ref, UnwrapRef } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'
import type { AclValue } from '@/types/Permission'
import Acl from '@/components/permission/Acl.vue'
import Notification from '@kyvg/vue3-notification'
import type { LanguageCode } from '@/composables/languageSettings'
import { DamClientSymbol, CmsClientSymbol } from '@/components/injectionKeys'
import type { AxiosInstance } from 'axios'

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
  coreDam?: { client: () => AxiosInstance; defaultLicenceId?: number }
  coreCms?: { client: () => AxiosInstance; }
}

export const CurrentUserSymbol = Symbol('currentUser')
export const CustomAclResolverSymbol = Symbol('customAclResolver')
export const AvailableLanguagesSymbol = Symbol('availableLanguages')
export const DefaultLanguageSymbol = Symbol('defaultLanguage')
export const DefaultLicenceIdSymbol = Symbol('defaultLicenceId')

export default {
  install<T extends AclValue = AclValue>(app: App, options: PluginOptions<T>): void {
    app.provide(CurrentUserSymbol, options.currentUser)
    app.provide<(() => AxiosInstance) | undefined>(DamClientSymbol, options.coreDam?.client)
    app.provide<(() => AxiosInstance) | undefined>(CmsClientSymbol, options.coreCms?.client)
    app.provide(CustomAclResolverSymbol, options.customAclResolver)
    app.provide(AvailableLanguagesSymbol, options.languages.available)
    app.provide(DefaultLanguageSymbol, options.languages.default)
    app.provide(DefaultLicenceIdSymbol, options.coreDam?.defaultLicenceId)
    app.component('Acl', Acl)
    app.use(Notification, { componentName: 'Notifications' })
  },
}
