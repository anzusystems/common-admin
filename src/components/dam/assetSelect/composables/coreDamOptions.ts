import { inject } from 'vue'
import type { CommonAdminCoreDamOptions } from '@/AnzuSystemsCommonAdmin'
import { CoreDamOptions } from '@/components/injectionKeys'
import { isUndefined } from '@/utils/common'

export function useCoreDamOptions(configName: string = 'default') {
  const coreDamOptions = inject<CommonAdminCoreDamOptions | undefined>(CoreDamOptions, undefined)

  if (
    isUndefined(coreDamOptions) ||
    isUndefined(coreDamOptions.configs) ||
    isUndefined(coreDamOptions.configs[configName])
  ) {
    throw new Error("Component can't be used without properly configured common admin.")
  }

  return {
    damClient: coreDamOptions.configs[configName].damClient,
    imageClient: coreDamOptions.configs[configName].imageClient,
    defaultLicenceId: coreDamOptions.configs[configName].defaultLicenceId,
  }
}
