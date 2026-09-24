import type { io } from 'socket.io-client'
import type { App } from 'vue'
import Acl from '@/components/permission/Acl.vue'
import Notification from '@kyvg/vue3-notification'
import type { LanguageCode } from '@/composables/languageSettings'
import { AvailableLanguagesSymbol, DefaultLanguageSymbol } from '@/components/injectionKeys'
import type { AxiosInstance } from 'axios'
import {
  initCommonAdminCollabOptions,
  initCommonAdminCoreDamOptions,
  initCommonAdminImageOptions,
} from '@/plugins/pluginOptions'
import type { IntegerId } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import type {
  UploadMetadataToImageMapFn,
  AssetSelectMetadataToImageMapFn,
} from '@/components/damImage/uploadQueue/composables/metadataToImageMap'

export type PluginOptions = {
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
    app.provide(AvailableLanguagesSymbol, options.languages.available)
    app.provide(DefaultLanguageSymbol, options.languages.default)
    app.component('Acl', Acl)
    app.use(Notification, { componentName: 'Notifications' })
    initCommonAdminImageOptions(options.image)
    initCommonAdminCoreDamOptions(options.coreDam)
    initCommonAdminCollabOptions(options.collab)
  },
}
