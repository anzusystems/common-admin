import type { io } from 'socket.io-client'
import type { App } from 'vue'
import Acl from '@/domains/auth/components/Acl.vue'
import type { LanguageCode } from '@/domains/system/composables/languageSettings'
import { type CommonAdminI18n, setCommonAdminI18n } from '@/plugins/i18n'
import { AvailableLanguagesSymbol, DefaultLanguageSymbol } from '@/shared/injectionKeys'
import type { AxiosInstance } from 'axios'
import {
  initCommonAdminCollabOptions,
  initCommonAdminCoreDamOptions,
  initCommonAdminImageOptions,
} from '@/plugins/pluginOptions'
import type { IntegerId } from '@/shared/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type {
  UploadMetadataToImageMapFn,
  AssetSelectMetadataToImageMapFn,
} from '@/domains/dam/imageWidget/utils/metadataToImageMap'

export type PluginOptions = {
  /**
   * The admin's vue-i18n instance, in composition mode (`legacy: false`). The library translates
   * through it -- components, validators, alerts -- so its messages have to include the library's
   * (`common`, `error`, `$vuetify` from `messagesSk`/`messagesEn`/`messagesCs`).
   */
  i18n: CommonAdminI18n
  languages: { available: LanguageCode[]; default: LanguageCode }
  coreDam?: CommonAdminCoreDamOptions
  image?: CommonAdminImageOptions
  collab?: CommonAdminCollabOptions
}

export interface CommonAdminImageConfig {
  imageClient: () => AxiosInstance
  previewDomain: string
  previewDomainOriginal: string
  width: number
  height: number
  imageApi?: {
    fetchImage: (client: () => AxiosInstance, id: IntegerId) => Promise<ImageAware>
    createImage: (client: () => AxiosInstance, data: ImageCreateUpdateAware) => Promise<ImageAware>
    updateImage: (client: () => AxiosInstance, id: IntegerId, data: ImageCreateUpdateAware) => Promise<ImageAware>
    deleteImage: (client: () => AxiosInstance, id: IntegerId) => Promise<void>
    fetchImageListByIds: (client: () => AxiosInstance, ids: IntegerId[]) => Promise<ImageAware[]>
    bulkUpdateImages: (client: () => AxiosInstance, items: ImageCreateUpdateAware[]) => Promise<ImageAware[]>
  }
}

export type CommonAdminImageOptions =
  | undefined
  | {
      configs: { [key: string]: CommonAdminImageConfig }
    }

export interface ImageFieldValidationConfig {
  required?: boolean
  min?: number
  max?: number
}

export interface CommonAdminCoreDamConfig {
  damClient: () => AxiosInstance
  endPointAsset?: string
  endPointImage?: string
  endPointRoi?: string
  mainFileSingleUseEnabled?: boolean
  showSourceEnabled?: boolean
  showFileInfoEnabled?: boolean
  sourceLabel?: string
  editAssetLabel?: string
  addFromDamLabel?: string
  replaceFromDamLabel?: string
  descriptionValidation?: ImageFieldValidationConfig
  sourceValidation?: ImageFieldValidationConfig
  customUploadMetadataToImageMap?: UploadMetadataToImageMapFn
  customAssetSelectMetadataToImageMap?: AssetSelectMetadataToImageMapFn
  assetListEnabledFilters?: string[]
  simpleAssetSidebar?: boolean
}

export type CommonAdminCoreDamOptions =
  | undefined
  | {
      configs: { [key: string]: CommonAdminCoreDamConfig }
      apiTimeout: number
      uploadStatusFallback: boolean
      adminDomain: string
      notification: {
        enabled: boolean
        webSocketUrl: string
      }
    }

export type CommonAdminCollabOptions = {
  enabled: boolean
  socketUrl: string
  beforeReconnect: () => Promise<void>
  /**
   * `io` from `socket.io-client`. Passed in, so that only an admin with collaboration depends on the package.
   */
  io: typeof io | undefined
}

export default {
  install(app: App, options: PluginOptions): void {
    setCommonAdminI18n(options.i18n)
    app.provide(AvailableLanguagesSymbol, options.languages.available)
    app.provide(DefaultLanguageSymbol, options.languages.default)
    app.component('Acl', Acl)
    initCommonAdminImageOptions(options.image)
    initCommonAdminCoreDamOptions(options.coreDam)
    initCommonAdminCollabOptions(options.collab)
  },
}
