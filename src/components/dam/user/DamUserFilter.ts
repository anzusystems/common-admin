import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY } from '@/components/damImage/uploadQueue/api/keywordApi'

export function useDamUserInnerFilter() {
  const filterFieldsInner = [
    { name: 'id' as const, default: null },
    { name: 'email' as const, default: null, variant: 'startsWith' },
    { name: 'enabled' as const, default: null },
    { name: 'lastName' as const, default: null, variant: 'startsWith', apiName: 'person.lastName' },
    { name: 'permissionGroups' as const, variant: 'custom', default: [], type: 'string' },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFieldsInner, createFilterStore(filterFieldsInner), {
    system: SYSTEM_CORE_DAM,
    subject: ENTITY,
  })

  return {
    filterConfig,
    filterData,
  }
}
