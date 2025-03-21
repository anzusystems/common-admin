import { reactive } from 'vue'
import { createFilter, type FilterStore, type MakeFilterOptions } from '@/composables/filter/filterFactory.ts'

const filterFields: MakeFilterOptions = [
  { name: 'text', default: '' },
  { name: 'status', default: [] },
]

const listFiltersStore = reactive<FilterStore<typeof filterFields>>({
  text: '',
  status: [],
})

export function useTestListFilter() {
  const { filterConfig, filterData } = createFilter(filterFields, {
    elastic: true,
    system: 'cms',
    subject: 'subject',
    globalStore: listFiltersStore,
  })

  return {
    filterConfigSubject: filterConfig,
    filterDataSubject: filterData,
  }
}
