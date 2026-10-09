import type { CommonAdminCoreDamConfig, ImageFieldValidationConfig } from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/domains/auth/types/Permission'
import { coreDamOptions as commonAdminCoreDamOptions } from '@/plugins/pluginOptions'
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

export function useCommonAdminCoreDamOptions(configName: string = 'default') {
  if (
    isUndefined(commonAdminCoreDamOptions.value) ||
    isUndefined(commonAdminCoreDamOptions.value.configs) ||
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
    roiUpdateAcl: resolveRoiUpdateAcl(commonAdminCoreDamOptions.value.configs[configName]),
    mainFileSingleUseEnabled: commonAdminCoreDamOptions.value.configs[configName].mainFileSingleUseEnabled ?? true,
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
    assetListEnabledFilters: commonAdminCoreDamOptions.value.configs[configName].assetListEnabledFilters, // defaults to undefined = all filters
    simpleAssetSidebarEnabled: commonAdminCoreDamOptions.value.configs[configName].simpleAssetSidebar ?? false,
  }
}

export interface DamNotificationOptions {
  enabled: boolean
  webSocketUrl: string
}

// A deployment template puts the value in quotes, and renders a boolean of its variables as `True`: the text
// "true" switches the service on as well, in any letter case and with whitespace around it. Nothing else does:
// "false" is a text too, and used to count as on.
export const normalizeDamNotificationOptions = (
  raw: { enabled?: boolean | string; webSocketUrl?: string } | undefined
): DamNotificationOptions => {
  const webSocketUrl = isString(raw?.webSocketUrl) ? raw.webSocketUrl.trim() : ''
  const on = raw?.enabled === true || (isString(raw?.enabled) && raw.enabled.trim().toLowerCase() === 'true')

  return { enabled: on && webSocketUrl.length > 0, webSocketUrl }
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
