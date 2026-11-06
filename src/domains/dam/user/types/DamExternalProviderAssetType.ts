import { ref } from 'vue'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'

/** Like `useDamDistributionServiceType`, for external asset providers. */
export function useDamExternalProviderAssetType(configName: string) {
  const damConfigStore = useDamConfigStoreOf(configName)
  const all = Object.entries(damConfigStore.damPrvConfig.assetExternalProviders).map(
    ([providerName, value]): ValueObjectOption<string> => {
      return {
        value: providerName,
        title: value.title,
      }
    }
  )

  const allExternalProviderAssetTypeOptions = ref<ValueObjectOption<string>[]>(all)

  const getExternalProviderAssetTypeOption = (value: string) => {
    return allExternalProviderAssetTypeOptions.value.find((item) => item.value === value)
  }

  return {
    allExternalProviderAssetTypeOptions,
    getExternalProviderAssetTypeOption,
  }
}
