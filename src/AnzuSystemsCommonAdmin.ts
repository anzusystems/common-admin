import type { App, DeepReadonly, Ref, UnwrapRef } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'
import { AclValue } from '@/types/Permission'
import Acl from '@/components/permission/Acl.vue'

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
}

export const CurrentUserSymbol = Symbol('currentUser')
export const CustomAclResolverSymbol = Symbol('customAclResolver')

export default {
  install<T extends AclValue = AclValue>(app: App, options: PluginOptions<T>): void {
    app.provide(CurrentUserSymbol, options.currentUser)
    app.provide(CustomAclResolverSymbol, options.customAclResolver)
    app.component('Acl', Acl)
  },
}
