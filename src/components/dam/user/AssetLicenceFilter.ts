import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY } from '@/components/dam/user/assetLicenceApi'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

export function useDamAssetLicenceInnerFilter() {
  const filterFieldsInner = [
    { name: 'name' as const, variant: 'startsWith', default: null, type: 'string' },
    { name: 'extSystem' as const, default: null },
    { name: 'extId' as const, default: null },
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
