import type { io } from 'socket.io-client'
import type { App } from 'vue'
import Acl from '@/domains/auth/components/Acl.vue'
import AChipNoLink from '@/domains/ui/components/AChipNoLink.vue'
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
import type { AclValue } from '@/domains/auth/types/Permission'
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
  /**
   * Where the authors of DAM are listed, looked up by id and created; `/adm/v1/author` by default. Read from the
   * configuration a component runs under, and by the cache of author names of that configuration.
   */
  endPointAuthor?: string
  /** The same for the keywords of DAM; `/adm/v1/keyword` by default. */
  endPointKeyword?: string
  /**
   * Where the settings of DAM are read, and the configuration of an ext system (`/ext-system/:extSystem` after it);
   * `/adm/v1/configuration` by default. Read by the loaders of the DAM configuration of this configuration.
   */
  endPointConfiguration?: string
  /** Where the public configuration of DAM is read (`loadDamPubConfig`); `/pub/v1/configuration` by default. */
  endPointPubConfiguration?: string
  /** Where a licence is read by its id, for its ext system; `/adm/v1/asset-licence` by default. */
  endPointAssetLicence?: string
  /** Where the custom forms of an ext system and of a distribution service are read; `/adm/v1/asset-custom-form`. */
  endPointAssetCustomForm?: string
  /**
   * Where the users of DAM are listed and looked up by id: the cache of users of this configuration, and the user
   * inputs and filters under it that are given no client of their own; `/adm/v1/user` by default.
   */
  endPointUser?: string
  /** Where the podcasts of a licence are listed (`/licence/:licenceId` after it); `/adm/v1/podcast` by default. */
  endPointPodcast?: string
  /** Where the image and media widget reads a picked asset as a medium of the CMS; `/adm/v1/cms/asset` by default. */
  endPointCmsAsset?: string
  /**
   * The system whose current user decides which licences the image widgets and asset selects under this
   * configuration may upload into and pick from: `dam` by default. That user is to be a user of DAM, as DAM gives
   * its current user (`DamCurrentUserDto`); the application loads it itself, as it loads the one of `dam`. A user of
   * another system allows no licence, and the error is written to the console. `false` allows every licence, as the
   * `skipCurrentUserCheck` of a component does, and that prop still wins.
   */
  currentUser?: string | false
  /** The DAM admin an asset of this configuration links to; the root `adminDomain` where left out. */
  adminDomain?: string
  /**
   * The time, in seconds, a request of this configuration may take, as its `damClient` times out (the library sets
   * no timeout on the client): the size of the chunks of its uploads and the wait limit of its widgets go by it. The
   * root `apiTimeout` where left out.
   */
  apiTimeout?: number
  /**
   * The grant a region of interest's save needs, checked before the editor is offered. By default
   * `dam_regionOfInterest_update` for the default `/adm/v1/roi`, and none for another endpoint (the UGC one checks no
   * grant); `null` checks none.
   */
  roiUpdateAcl?: AclValue | null
  /** The grant an image's rotation needs, as `roiUpdateAcl`: `dam_image_update` for the default `/adm/v1/image`. */
  imageRotateAcl?: AclValue | null
  /** The grant creating a keyword needs, checked before it is offered (Enter, comma, "+ name"). None by default. */
  keywordCreateAcl?: AclValue | null
  /** The same for an author, also the "+" button. */
  authorCreateAcl?: AclValue | null
  mainFileSingleUseEnabled?: boolean
  /**
   * The copy of a picked asset into the licence a widget uploads into: the asset picker offers it and the widgets send
   * it. On unless `false`; an application whose licence of the upload is the only one it picks from has no use for it
   * and is to turn it off, as admin-ugc is.
   */
  copyToLicenceEnabled?: boolean
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
  /**
   * The notification service of this configuration, read as the root `notification` of `coreDam` is. Left out,
   * `default` has the root one and another configuration none: its uploads are then polled for at the rhythm of a
   * page without the service. Configurations that name one service share its socket: an event of it concerns the rows
   * of each, a read it asks for is made for each by its own client, and a failure or a duplicate it tells of is
   * written into the rows of each.
   */
  notification?: {
    enabled?: boolean | string
    webSocketUrl?: string
  }
}

export type CommonAdminCoreDamOptions =
  | undefined
  | {
      configs: { [key: string]: CommonAdminCoreDamConfig }
      apiTimeout: number
      /** @deprecated The state of an upload is always polled for; the value is not read. */
      uploadStatusFallback?: boolean
      adminDomain: string
      /**
       * The notification service is used only with an address and `enabled` either `true` or the text "true", in
       * any letter case and with whitespace around it ignored ("True", " TRUE "). Any other value is off.
       */
      notification?: {
        enabled?: boolean | string
        webSocketUrl?: string
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
    if (!options.i18n) {
      console.warn(
        '[common-admin] installed without `i18n`: the library translates through an instance without messages, ' +
          "so its texts render as keys. Pass the admin's instance: app.use(AnzuSystemsCommonAdmin, { i18n, … })."
      )
    }
    setCommonAdminI18n(options.i18n)
    app.provide(AvailableLanguagesSymbol, options.languages.available)
    app.provide(DefaultLanguageSymbol, options.languages.default)
    app.component('Acl', Acl)
    // The component, not a Vuetify alias of `VChip`: used without an import it still looks like the library's chip.
    app.component('AChipNoLink', AChipNoLink)
    initCommonAdminImageOptions(options.image)
    initCommonAdminCoreDamOptions(options.coreDam)
    initCommonAdminCollabOptions(options.collab)
  },
}
