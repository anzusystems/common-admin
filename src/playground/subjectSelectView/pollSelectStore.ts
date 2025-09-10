import { ref } from 'vue'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

const datatableHiddenColumns = ref([])

export const filterFields = [
  { name: 'title' as const, apiName: 'texts.title', default: [], variant: 'startsWith', type: 'string' },
  { name: 'id' as const, default: null, render: { skip: true } },
  {
    name: 'displayType' as const,
    default: null,
    variant: 'in',
    apiName: 'attributes.displayType',
    render: { skip: true },
  },
  {
    name: 'startOfVotingFrom' as const,
    apiName: 'dates.startOfVoting',
    default: null,
    variant: 'gte',
    render: { skip: true },
  },
  {
    name: 'startOfVotingTo' as const,
    apiName: 'dates.startOfVoting',
    default: null,
    variant: 'lte',
    render: { skip: true },
  },
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
