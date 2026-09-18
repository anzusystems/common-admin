import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY } from '@/components/dam/user/assetLicenceGroupApi'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

export function useDamAssetLicenceGroupInnerFilter() {
  const filterFieldsInner = [
    { name: 'name' as const, variant: 'startsWith', default: null, type: 'string' },
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
