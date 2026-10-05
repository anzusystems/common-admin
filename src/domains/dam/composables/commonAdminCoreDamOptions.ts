import type { CommonAdminCoreDamConfig, ImageFieldValidationConfig } from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/domains/auth/types/Permission'
import { coreDamOptions as commonAdminCoreDamOptions } from '@/plugins/pluginOptions'
import { isUndefined } from '@/shared/utils/common'
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

export function useCommonAdminCoreDamOptionsGlobal() {
  if (isUndefined(commonAdminCoreDamOptions.value) || isUndefined(commonAdminCoreDamOptions.value.configs)) {
    throw new Error("Composable can't be used without properly configured common admin.")
  }

  return {
    apiTimeout: commonAdminCoreDamOptions.value.apiTimeout,
    uploadStatusFallback: commonAdminCoreDamOptions.value.uploadStatusFallback,
    notification: commonAdminCoreDamOptions.value.notification,
    adminDomain: commonAdminCoreDamOptions.value.adminDomain,
  }
}
