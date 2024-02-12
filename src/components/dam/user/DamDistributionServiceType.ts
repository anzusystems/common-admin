import { ref } from 'vue'
import type { AxiosInstance } from 'axios'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { ValueObjectOption } from '@/types/ValueObject'

export function useDamDistributionServiceType(client: () => AxiosInstance) {
  const { damPrvConfig } = useDamConfigState(client)
  const all = Object.entries(damPrvConfig.value.distributionServices).map(
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
