import { reactive } from 'vue'
import { createFilter, type FilterStore } from '@/composables/filter/filterFactory.ts'

const filterFields = [
  { name: 'text' as const, default: '' },
  { name: 'status' as const, default: [] as string[] },
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
