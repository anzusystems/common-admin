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
    defaultLicenceId: commonAdminCoreDamOptions.value.configs[configName].defaultLicenceId,
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
  }
}
