import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

export const filterFieldsList = [
  { name: 'id' as const, default: null, type: 'string' },
  { name: 'text' as const, default: null, type: 'string', variant: 'search' },
  { name: 'identifier' as const, default: null },
  { name: 'reviewed' as const, default: null },
  { name: 'type' as const, default: null },
] satisfies readonly MakeFilterOption[]

const listFiltersStore = createFilterStore(filterFieldsList)

export function useAuthorListFilter() {
  const { filterConfig, filterData } = createFilter(filterFieldsList, listFiltersStore, {
    elastic: true,
    system: 'coreDam',
    subject: 'author',
  })

  return {
    filterConfig,
    filterData,
  }
}
