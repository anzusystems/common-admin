import { hasInjectionContext, inject, ref } from 'vue'
import type { CommonAdminCoreDamOptions } from '@/AnzuSystemsCommonAdmin'
import { CoreDamOptions } from '@/components/injectionKeys'
import { isUndefined } from '@/utils/common'

const coreDamOptions = ref<CommonAdminCoreDamOptions | undefined>(undefined)
export function useCoreDamOptions(configName: string = 'default') {
  if (hasInjectionContext()) {
    coreDamOptions.value = inject<CommonAdminCoreDamOptions | undefined>(CoreDamOptions, undefined)
  } else {
    console.error('todo, inject fix')
  }
  if (
    isUndefined(coreDamOptions.value) ||
    isUndefined(coreDamOptions.value.configs) ||
    isUndefined(coreDamOptions.value.configs[configName])
  ) {
    throw new Error("Component can't be used without properly configured common admin.")
  }

  return {
    damClient: coreDamOptions.value.configs[configName].damClient,
    defaultLicenceId: coreDamOptions.value.configs[configName].defaultLicenceId,
  }
}
