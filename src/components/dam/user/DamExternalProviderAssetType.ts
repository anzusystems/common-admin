import { ref } from 'vue'
import type { AxiosInstance } from 'axios'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { ValueObjectOption } from '@/types/ValueObject'

export function useDamExternalProviderAssetType(client: () => AxiosInstance) {
  const { damPrvConfig } = useDamConfigState(client)
  const all = Object.entries(damPrvConfig.value.assetExternalProviders).map(
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
