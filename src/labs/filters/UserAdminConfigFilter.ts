import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

export function useUserAdminConfigInnerFilter(system: string, subject: string = 'userAdminConfig') {
  const filterFields = [
    { name: 'user' as const, default: null },
    { name: 'configType' as const, default: null },
    { name: 'layoutType' as const, default: null },
    { name: 'systemResource' as const, default: null },
    { name: 'customName' as const, default: null },
    { name: 'defaultConfig' as const, default: null },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFields, createFilterStore(filterFields), {
    system,
    subject,
  })

  return {
    filterConfig,
    filterData,
  }
}
