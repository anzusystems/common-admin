import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'

export function useDamExternalProviderAssetType() {
  const damConfigStore = useDamConfigStore()
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
