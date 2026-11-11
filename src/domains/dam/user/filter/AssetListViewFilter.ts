import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { ENTITY } from '@/domains/dam/user/api/assetListViewApi'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'

export function useDamAssetListViewInnerFilter() {
  const filterFieldsInner = [
    { name: 'name' as const, variant: 'startsWith', default: null, type: 'string' },
    { name: 'extSystem' as const, default: null },
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
