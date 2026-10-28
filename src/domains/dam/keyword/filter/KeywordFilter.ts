import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { ENTITY } from '@/domains/dam/keyword/api/keywordApi'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'

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
