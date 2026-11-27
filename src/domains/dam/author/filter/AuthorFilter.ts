import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import { ENTITY } from '@/domains/dam/keyword/api/keywordApi'

export function useAuthorInnerFilter() {
  const filterFieldsInner = [
    { name: 'text' as const, variant: 'search', default: null, type: 'string' },
    { name: 'source' as const, default: null, type: 'boolean', render: { skip: true } },
    // Merged authors are not offered; the API keeps canBeCurrentAuthor false exactly for authors with current authors.
    { name: 'canBeCurrentAuthor' as const, default: true, type: 'boolean', render: { skip: true } },
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
