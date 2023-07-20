import type { App, DeepReadonly, Ref, UnwrapRef } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'
import type { AclValue } from '@/types/Permission'
import Acl from '@/components/permission/Acl.vue'
import Notification from '@kyvg/vue3-notification'
import type { LanguageCode } from '@/composables/languageSettings'
import {
  AvailableLanguagesSymbol,
  CurrentUserSymbol,
  CustomAclResolverSymbol,
  DamClientSymbol,
  DefaultLanguageSymbol,
  DefaultLicenceIdSymbol,
  ImageOptions,
} from '@/components/injectionKeys'
import type { AxiosInstance } from 'axios'
import type { ImageWidgetImage } from '@/types/ImageWidgetImage'
import type { IntegerId } from '@/types/common'

export type PluginOptions<T extends AclValue = AclValue> = {
  currentUser: CurrentUserType
  languages: { available: LanguageCode[]; default: LanguageCode }
  customAclResolver?: CustomAclResolver<T>
  coreDam?: { client: () => AxiosInstance; defaultLicenceId?: IntegerId }
  image?: CommonAdminImageOptions
}

export type CustomAclResolver<T extends AclValue = AclValue> =
  | undefined
  | {
      can?: (acl: T, subject?: object) => boolean
      canOwner?: (subject: object) => boolean
    }

export type CurrentUserType = DeepReadonly<Ref<UnwrapRef<AnzuUser | undefined>>>

export interface CommonAdminImageConfig {
  getImage: (id: IntegerId) => Promise<ImageWidgetImage>
  imageUrl: string
  width: number
  height: number
}

export type CommonAdminImageOptions = undefined | {
  configs: {[key: string]: CommonAdminImageConfig}
}

export default {
  install<T extends AclValue = AclValue>(app: App, options: PluginOptions<T>): void {
    app.provide(CurrentUserSymbol, options.currentUser)
    app.provide<(() => AxiosInstance) | undefined>(DamClientSymbol, options.coreDam?.client)
    app.provide(CustomAclResolverSymbol, options.customAclResolver)
    app.provide(AvailableLanguagesSymbol, options.languages.available)
    app.provide(DefaultLanguageSymbol, options.languages.default)
    app.provide(DefaultLicenceIdSymbol, options.coreDam?.defaultLicenceId)
    app.provide(ImageOptions, options.image)
    app.component('Acl', Acl)
    app.use(Notification, { componentName: 'Notifications' })
  },
}
