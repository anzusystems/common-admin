import { reactive } from 'vue'
import { createFilter, type FilterStore, type MakeFilterOption } from '@/composables/filter/filterFactory'

export function useUserAdminConfigInnerFilter(system: string, subject: string = 'userAdminConfig') {
  const filterFields = [
    { name: 'user' as const },
    { name: 'configType' as const },
    { name: 'layoutType' as const },
    { name: 'systemResource' as const },
    { name: 'customName' as const },
    { name: 'defaultConfig' as const },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(
    filterFields,
    reactive<FilterStore<{ name: (typeof filterFields)[number]['name'] }[]>>({
      user: null,
      configType: null,
      layoutType: null,
      systemResource: null,
      customName: null,
      defaultConfig: null,
    }),
    {
      system,
      subject,
    }
  )

  return {
    filterConfig,
    filterData,
  }
}
