import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'

export function useDamDistributionServiceType() {
  const damConfigStore = useDamConfigStore()
  const all = Object.entries(damConfigStore.damPrvConfig.distributionServices).map(
    ([serviceName, value]): ValueObjectOption<string> => {
      return {
        value: serviceName,
        title: value.title,
      }
    }
  )

  const allDistributionServiceTypeOptions = ref<ValueObjectOption<string>[]>(all)

  const getDistributionServiceTypeOption = (value: string) => {
    return allDistributionServiceTypeOptions.value.find((item) => item.value === value)
  }

  return {
    allDistributionServiceTypeOptions,
    getDistributionServiceTypeOption,
  }
}
