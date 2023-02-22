import type { App, DeepReadonly, Ref, UnwrapRef } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'
import { AclValue } from '@/types/Permission'
import Acl from '@/components/permission/Acl.vue'
import { createI18nInstance } from '@/plugins/translate'
import type { I18n } from 'vue-i18n'

export type CustomAclResolver<T extends AclValue = AclValue> =
  | undefined
  | {
      can?: (acl: T, subject?: object) => boolean
      canOwner?: (subject: object) => boolean
    }
export type CurrentUserType = DeepReadonly<Ref<UnwrapRef<AnzuUser | undefined>>>
export type PluginOptions<T extends AclValue = AclValue> = {
  currentUser: CurrentUserType
  customAclResolver?: CustomAclResolver<T>
  i18n: I18n
}

export const CurrentUserSymbol = Symbol('currentUser')
export const CustomAclResolverSymbol = Symbol('customAclResolver')

export default {
  install<T extends AclValue = AclValue>(app: App, options: PluginOptions<T>): void {
    createI18nInstance(options.i18n)
    app.provide(CurrentUserSymbol, options.currentUser)
    app.provide(CustomAclResolverSymbol, options.customAclResolver)
    app.component('Acl', Acl)
  },
}
