import { ref } from 'vue'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

/**
 * The distribution services of the prv configuration of `configName`: a name left out is the inherited one in a
 * component's setup, else `default`.
 */
export function useDamDistributionServiceType(configName?: string) {
  const damConfigStore = useDamConfigStoreOf(inheritedDamConfigName(configName))
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
