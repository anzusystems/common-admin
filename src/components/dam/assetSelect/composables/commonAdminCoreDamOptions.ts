import { ref } from 'vue'
import type { CommonAdminCoreDamOptions } from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/utils/common'

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
    endPointImage: commonAdminCoreDamOptions.value.configs[configName].endPointImage || '/adm/v1/image',
    endPointAsset: commonAdminCoreDamOptions.value.configs[configName].endPointAsset || '/adm/v1/asset',
    mainFileSingleUseEnabled: commonAdminCoreDamOptions.value.configs[configName].mainFileSingleUseEnabled ?? true,
    showSourceEnabled: commonAdminCoreDamOptions.value.configs[configName].showSourceEnabled ?? true,
    customMetadataToImageMap: commonAdminCoreDamOptions.value.configs[configName].customMetadataToImageMap,
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
