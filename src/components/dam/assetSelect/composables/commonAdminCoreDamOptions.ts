import { ref } from 'vue'
import type {
  CommonAdminCoreDamOptions,
  ImageFieldValidationConfig,
} from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/utils/common'
import { i18n } from '@/plugins/i18n'

const { t } = i18n.global

const defaultDescriptionValidation: ImageFieldValidationConfig = {
  required: false,
  min: 0,
  max: 2000,
}
const defaultSourceValidation: ImageFieldValidationConfig = { required: true, min: 0, max: 255 }

const commonAdminCoreDamOptions = ref<CommonAdminCoreDamOptions | undefined>(undefined)

export function initCommonAdminCoreDamOptions(data: CommonAdminCoreDamOptions) {
  commonAdminCoreDamOptions.value = data
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
    endPointImage:
      commonAdminCoreDamOptions.value.configs[configName].endPointImage || '/adm/v1/image',
    endPointAsset:
      commonAdminCoreDamOptions.value.configs[configName].endPointAsset || '/adm/v1/asset',
    mainFileSingleUseEnabled:
      commonAdminCoreDamOptions.value.configs[configName].mainFileSingleUseEnabled ?? true,
    showSourceEnabled:
      commonAdminCoreDamOptions.value.configs[configName].showSourceEnabled ?? true,
    showFileInfoEnabled:
      commonAdminCoreDamOptions.value.configs[configName].showFileInfoEnabled ?? true,
    sourceLabel:
      commonAdminCoreDamOptions.value.configs[configName].sourceLabel ||
      t('common.damImage.image.model.texts.source'),
    editAssetLabel:
      commonAdminCoreDamOptions.value.configs[configName].editAssetLabel ||
      t('common.damImage.image.button.editAsset'),
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
    customUploadMetadataToImageMap:
      commonAdminCoreDamOptions.value.configs[configName].customUploadMetadataToImageMap,
    customAssetSelectMetadataToImageMap:
      commonAdminCoreDamOptions.value.configs[configName].customAssetSelectMetadataToImageMap,
    assetListEnabledFilters:
      commonAdminCoreDamOptions.value.configs[configName].assetListEnabledFilters, // defaults to undefined = all filters
    simpleAssetSidebarEnabled:
      commonAdminCoreDamOptions.value.configs[configName].simpleAssetSidebar ?? false,
  }
}

export function useCommonAdminCoreDamOptionsGlobal() {
  if (
    isUndefined(commonAdminCoreDamOptions.value) ||
    isUndefined(commonAdminCoreDamOptions.value.configs)
  ) {
    throw new Error("Composable can't be used without properly configured common admin.")
  }

  return {
    apiTimeout: commonAdminCoreDamOptions.value.apiTimeout,
    uploadStatusFallback: commonAdminCoreDamOptions.value.uploadStatusFallback,
    notification: commonAdminCoreDamOptions.value.notification,
    adminDomain: commonAdminCoreDamOptions.value.adminDomain,
  }
}
