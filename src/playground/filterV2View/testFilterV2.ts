import { reactive } from 'vue'
import { createFilter, type FilterStore, type MakeFilterOption } from '@/composables/filter/filterFactory.ts'

export const filterFields = [
  { name: 'text' as const, type: 'string', render: { skip: true } },
  { name: 'site' as const, field: 'siteIds' },
  { name: 'rubric' as const, field: 'rubricIds' },
  { name: 'articleAuthors' as const, field: 'authorIds' },
  { name: 'status' as const },
  { name: 'docId' as const, type: 'string' },
  { name: 'desks' as const, field: 'deskIds' },
  { name: 'publicPublishedAtFrom' as const, type: 'datetime' },
  { name: 'publicPublishedAtUntil' as const, type: 'datetime' },
  { name: 'owners' as const, field: 'ownerIds' },
  { name: 'url' as const, type: 'string' },
  { name: 'modifiedAtFrom' as const, type: 'datetime' },
  { name: 'modifiedAtUntil' as const, type: 'datetime' },
  { name: 'headline' as const, type: 'string' },
  { name: 'linkedList' as const, field: 'linkedListIds', render: { skip: true } },
  { name: 'lockType' as const },
  { name: 'keywords' as const, field: 'keywordIds', render: { skip: true } },
  { name: 'enableAds' as const, type: 'boolean', field: 'flagsStandard.enableAds' },
] satisfies readonly MakeFilterOption<any>[]

export type FilterFieldsType = typeof filterFields

const listFiltersStore = reactive<FilterStore<FilterFieldsType>>({
  text: null,
  site: [],
  rubric: [],
  articleAuthors: [],
  status: [],
  docId: null,
  desks: [],
  publicPublishedAtFrom: null,
  publicPublishedAtUntil: null,
  owners: [],
  url: null,
  modifiedAtFrom: null,
  modifiedAtUntil: null,
  headline: null,
  linkedList: [],
  lockType: null,
  keywords: [],
  enableAds: null,
})

export function useTestListFilter() {
  const { filterConfig, filterData } = createFilter(filterFields, listFiltersStore, {
    elastic: true,
    system: 'system',
    subject: 'subject',
  })

  return {
    filterConfig,
    filterData,
  }
}
