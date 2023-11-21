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
  DefaultLanguageSymbol,
} from '@/components/injectionKeys'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import { initCommonAdminImageOptions } from '@/components/image/composables/commonAdminImageOptions'
import { initCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

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
  previewDomain: string
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
      notification: {
        enabled: boolean
        webSocketUrl: string
      }
    }

export default {
  install<T extends AclValue = AclValue>(app: App, options: PluginOptions<T>): void {
    app.provide(CurrentUserSymbol, options.currentUser)
    app.provide(CustomAclResolverSymbol, options.customAclResolver)
    app.provide(AvailableLanguagesSymbol, options.languages.available)
    app.provide(DefaultLanguageSymbol, options.languages.default)
    app.component('Acl', Acl)
    app.use(Notification, { componentName: 'Notifications' })
    initCommonAdminImageOptions(options.image)
    initCommonAdminCoreDamOptions(options.coreDam)
  },
}
