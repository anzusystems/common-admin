import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { ENTITY } from '@/domains/dam/user/api/extSystemApi'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'

export function useExtSystemInnerFilter() {
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
