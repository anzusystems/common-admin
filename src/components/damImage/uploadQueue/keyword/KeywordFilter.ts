import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY } from '@/components/damImage/uploadQueue/api/keywordApi'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

export function useKeywordInnerFilter() {
  const filterFieldsInner = [
    { name: 'text' as const, variant: 'search', default: null, type: 'string' },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFieldsInner, createFilterStore(filterFieldsInner), {
    elastic: true,
    system: SYSTEM_CORE_DAM,
    subject: ENTITY,
  })

  return {
    filterConfig,
    filterData,
  }
}
