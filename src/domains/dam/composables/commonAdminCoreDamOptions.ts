import type { CommonAdminCoreDamConfig, ImageFieldValidationConfig } from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/domains/auth/types/Permission'
import { coreDamOptions as commonAdminCoreDamOptions } from '@/plugins/pluginOptions'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'
import {
  DAM_END_POINT_ASSET_CUSTOM_FORM,
  DAM_END_POINT_ASSET_LICENCE,
  DAM_END_POINT_CMS_ASSET,
  DAM_END_POINT_CONFIGURATION,
  DAM_END_POINT_PODCAST,
  DAM_END_POINT_PUB_CONFIGURATION,
  DAM_END_POINT_USER,
} from '@/domains/dam/api/damEndPoints'
import { isString, isUndefined } from '@/shared/utils/common'
import { commonT } from '@/plugins/i18n'

const t = commonT

const defaultDescriptionValidation: ImageFieldValidationConfig = {
  required: false,
  min: 0,
  max: 2000,
}
const defaultSourceValidation: ImageFieldValidationConfig = { required: true, min: 0, max: 255 }

export { initCommonAdminCoreDamOptions } from '@/plugins/pluginOptions'

const DEFAULT_END_POINT_ROI = '/adm/v1/roi'
const DEFAULT_END_POINT_IMAGE = '/adm/v1/image'
const DEFAULT_END_POINT_AUTHOR = '/adm/v1/author'
const DEFAULT_END_POINT_KEYWORD = '/adm/v1/keyword'

const resolveRoiUpdateAcl = (config: CommonAdminCoreDamConfig): AclValue | null => {
  if (!isUndefined(config.roiUpdateAcl)) return config.roiUpdateAcl
  const endPointRoi = config.endPointRoi || DEFAULT_END_POINT_ROI

  return endPointRoi === DEFAULT_END_POINT_ROI ? 'dam_regionOfInterest_update' : null
}

const resolveImageRotateAcl = (config: CommonAdminCoreDamConfig): AclValue | null => {
  if (!isUndefined(config.imageRotateAcl)) return config.imageRotateAcl
  const endPointImage = config.endPointImage || DEFAULT_END_POINT_IMAGE

  return endPointImage === DEFAULT_END_POINT_IMAGE ? 'dam_image_update' : null
}

/**
 * Keyed endpoints of configuration `configName`, each falling back to its default.
 * Never throws: without a configured plugin or that configuration, all are defaults.
 * Apps call the config loaders at startup (admin-dam's `useDamConfigState(damClient)`).
 */
export function damEndPointsOf(configName: string) {
  const configs = commonAdminCoreDamOptions.value?.configs
  const config = configs && Object.hasOwn(configs, configName) ? configs[configName] : undefined

  return {
    endPointConfiguration: config?.endPointConfiguration || DAM_END_POINT_CONFIGURATION,
    endPointPubConfiguration: config?.endPointPubConfiguration || DAM_END_POINT_PUB_CONFIGURATION,
    endPointAssetLicence: config?.endPointAssetLicence || DAM_END_POINT_ASSET_LICENCE,
    endPointAssetCustomForm: config?.endPointAssetCustomForm || DAM_END_POINT_ASSET_CUSTOM_FORM,
    endPointUser: config?.endPointUser || DAM_END_POINT_USER,
    endPointPodcast: config?.endPointPodcast || DAM_END_POINT_PODCAST,
    endPointCmsAsset: config?.endPointCmsAsset || DAM_END_POINT_CMS_ASSET,
  }
}

/**
 * Options of DAM configuration `configName`. Internal. The name is required so a call cannot fall back to `default`.
 */
export function useCommonAdminCoreDamOptions(configName: string) {
  if (
    isUndefined(commonAdminCoreDamOptions.value) ||
    isUndefined(commonAdminCoreDamOptions.value.configs) ||
    // Own keys only. Inherited names like `constructor` are not configurations.
    !Object.hasOwn(commonAdminCoreDamOptions.value.configs, configName) ||
    isUndefined(commonAdminCoreDamOptions.value.configs[configName])
  ) {
    throw new Error("Composable can't be used without properly configured common admin.")
  }

  return {
    damClient: commonAdminCoreDamOptions.value.configs[configName].damClient,
    endPointImage: commonAdminCoreDamOptions.value.configs[configName].endPointImage || DEFAULT_END_POINT_IMAGE,
    imageRotateAcl: resolveImageRotateAcl(commonAdminCoreDamOptions.value.configs[configName]),
    endPointAsset: commonAdminCoreDamOptions.value.configs[configName].endPointAsset || '/adm/v1/asset',
    endPointRoi: commonAdminCoreDamOptions.value.configs[configName].endPointRoi || DEFAULT_END_POINT_ROI,
    endPointAuthor: commonAdminCoreDamOptions.value.configs[configName].endPointAuthor || DEFAULT_END_POINT_AUTHOR,
    endPointKeyword: commonAdminCoreDamOptions.value.configs[configName].endPointKeyword || DEFAULT_END_POINT_KEYWORD,
    ...damEndPointsOf(configName),
    // The system whose user decides the licences. `false` means every licence.
    currentUser: commonAdminCoreDamOptions.value.configs[configName].currentUser ?? SYSTEM_DAM,
    adminDomain:
      commonAdminCoreDamOptions.value.configs[configName].adminDomain ?? commonAdminCoreDamOptions.value.adminDomain,
    apiTimeout:
      commonAdminCoreDamOptions.value.configs[configName].apiTimeout ?? commonAdminCoreDamOptions.value.apiTimeout,
    roiUpdateAcl: resolveRoiUpdateAcl(commonAdminCoreDamOptions.value.configs[configName]),
    keywordCreateAcl: commonAdminCoreDamOptions.value.configs[configName].keywordCreateAcl,
    authorCreateAcl: commonAdminCoreDamOptions.value.configs[configName].authorCreateAcl,
    mainFileSingleUseEnabled: commonAdminCoreDamOptions.value.configs[configName].mainFileSingleUseEnabled ?? true,
    // Passed as configured. Readers treat it as on unless `false`.
    copyToLicenceEnabled: commonAdminCoreDamOptions.value.configs[configName].copyToLicenceEnabled,
    showSourceEnabled: commonAdminCoreDamOptions.value.configs[configName].showSourceEnabled ?? true,
    showFileInfoEnabled: commonAdminCoreDamOptions.value.configs[configName].showFileInfoEnabled ?? true,
    sourceLabel:
      commonAdminCoreDamOptions.value.configs[configName].sourceLabel || t('common.damImage.image.model.texts.source'),
    editAssetLabel:
      commonAdminCoreDamOptions.value.configs[configName].editAssetLabel || t('common.damImage.image.button.editAsset'),
    addFromDamLabel:
      commonAdminCoreDamOptions.value.configs[configName].addFromDamLabel ||
      t('common.damImage.image.button.addFromDam'),
    replaceFromDamLabel:
      commonAdminCoreDamOptions.value.configs[configName].replaceFromDamLabel ||
      t('common.damImage.image.button.replaceFromDam'),
    descriptionValidation: {
      ...defaultDescriptionValidation,
      ...commonAdminCoreDamOptions.value.configs[configName].descriptionValidation,
    },
    sourceValidation: {
      ...defaultSourceValidation,
      ...commonAdminCoreDamOptions.value.configs[configName].sourceValidation,
    },
    customUploadMetadataToImageMap: commonAdminCoreDamOptions.value.configs[configName].customUploadMetadataToImageMap,
    customAssetSelectMetadataToImageMap:
      commonAdminCoreDamOptions.value.configs[configName].customAssetSelectMetadataToImageMap,
    // undefined means all filters
    assetListEnabledFilters: commonAdminCoreDamOptions.value.configs[configName].assetListEnabledFilters,
    simpleAssetSidebarEnabled: commonAdminCoreDamOptions.value.configs[configName].simpleAssetSidebar ?? false,
  }
}

export interface DamNotificationOptions {
  enabled: boolean
  webSocketUrl: string
}

// A deployment template quotes the value and renders booleans as `True`.
// So the string "true" also enables it, in any case and with
// surrounding whitespace. Any other string, including "false", is off.
export const normalizeDamNotificationOptions = (
  raw: { enabled?: boolean | string; webSocketUrl?: string } | undefined
): DamNotificationOptions => {
  const webSocketUrl = isString(raw?.webSocketUrl) ? raw.webSocketUrl.trim() : ''
  const on = raw?.enabled === true || (isString(raw?.enabled) && raw.enabled.trim().toLowerCase() === 'true')

  return { enabled: on && webSocketUrl.length > 0, webSocketUrl }
}

/**
 * One notification socket of the page and the DAM configurations that use it.
 */
export interface DamNotificationSocketOptions {
  options: DamNotificationOptions
  configNames: string[]
}

/**
 * One socket per distinct service, shared by the configurations that name it.
 * `default`'s comes first, even when off: its own `notification`, else the root one.
 * Other configurations get one only with their own enabled `notification`.
 */
export function damNotificationSockets(): DamNotificationSocketOptions[] {
  const { notification } = useCommonAdminCoreDamOptionsGlobal()
  const configs = commonAdminCoreDamOptions.value?.configs ?? {}
  const ofDefault = isUndefined(configs.default?.notification)
    ? notification
    : normalizeDamNotificationOptions(configs.default.notification)
  const sockets: DamNotificationSocketOptions[] = [{ options: ofDefault, configNames: ['default'] }]
  for (const [name, config] of Object.entries(configs)) {
    if (name === 'default' || isUndefined(config?.notification)) continue
    const options = normalizeDamNotificationOptions(config.notification)
    if (!options.enabled) continue
    const shared = sockets.find(
      (socket) => socket.options.enabled && socket.options.webSocketUrl === options.webSocketUrl
    )
    if (shared) shared.configNames.push(name)
    else sockets.push({ options, configNames: [name] })
  }
  return sockets
}

export function useCommonAdminCoreDamOptionsGlobal() {
  if (isUndefined(commonAdminCoreDamOptions.value) || isUndefined(commonAdminCoreDamOptions.value.configs)) {
    throw new Error("Composable can't be used without properly configured common admin.")
  }

  return {
    apiTimeout: commonAdminCoreDamOptions.value.apiTimeout,
    notification: normalizeDamNotificationOptions(commonAdminCoreDamOptions.value.notification),
    adminDomain: commonAdminCoreDamOptions.value.adminDomain,
  }
}
