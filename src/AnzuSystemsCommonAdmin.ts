import type { App, DeepReadonly, Ref, UnwrapRef } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'
import type { AclValue } from '@/types/Permission'
import Acl from '@/components/permission/Acl.vue'
import Notification from '@kyvg/vue3-notification'
import type { LanguageCode } from '@/composables/languageSettings'
import {
  AvailableLanguagesSymbol,
  CoreDamOptions,
  CurrentUserSymbol,
  CustomAclResolverSymbol,
  DefaultLanguageSymbol,
  ImageOptions,
} from '@/components/injectionKeys'
import type { AxiosInstance } from 'axios'
import type { ImageAware } from '@/types/ImageAware'
import type { IntegerId } from '@/types/common'

export type PluginOptions<T extends AclValue = AclValue> = {
  currentUser: CurrentUserType
  languages: { available: LanguageCode[]; default: LanguageCode }
  customAclResolver?: CustomAclResolver<T>
  coreDam?: CommonAdminCoreDamOptions
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
  imageClient: () => AxiosInstance
  getImage: (id: IntegerId) => Promise<ImageAware>
  imageUrl: string
  width: number
  height: number
}

export type CommonAdminImageOptions =
  | undefined
  | {
      configs: { [key: string]: CommonAdminImageConfig }
    }

export interface CommonAdminCoreDamConfig {
  damClient: () => AxiosInstance
  defaultLicenceId?: IntegerId
}

export type CommonAdminCoreDamOptions =
  | undefined
  | {
      configs: { [key: string]: CommonAdminCoreDamConfig }
      apiTimeout: number
      uploadStatusFallback: boolean
    }

export default {
  install<T extends AclValue = AclValue>(app: App, options: PluginOptions<T>): void {
    app.provide(CurrentUserSymbol, options.currentUser)
    app.provide(CustomAclResolverSymbol, options.customAclResolver)
    app.provide(AvailableLanguagesSymbol, options.languages.available)
    app.provide(DefaultLanguageSymbol, options.languages.default)
    app.provide(CoreDamOptions, options.coreDam)
    app.provide(ImageOptions, options.image)
    app.component('Acl', Acl)
    app.use(Notification, { componentName: 'Notifications' })
  },
}
