import { ref } from 'vue'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

const datatableHiddenColumns = ref([])

export const filterFields = [
  { name: 'id' as const, default: null },
  { name: 'displayType' as const, default: null, variant: 'in', apiName: 'attributes.displayType' },
  { name: 'title' as const, apiName: 'texts.title', default: [], variant: 'startsWith' },
  { name: 'startOfVotingFrom' as const, apiName: 'dates.startOfVoting', default: null, variant: 'gte' },
  { name: 'startOfVotingTo' as const, apiName: 'dates.startOfVoting', default: null, variant: 'lte' },
] satisfies readonly MakeFilterOption[]

const listFiltersStore = createFilterStore(filterFields)

export function usePollSelectStore() {
  const { filterConfig, filterData } = createFilter(filterFields, listFiltersStore, {
    system: 'cms',
    subject: 'poll',
  })

  return {
    filterConfig,
    filterData,
    datatableHiddenColumns,
  }
}
