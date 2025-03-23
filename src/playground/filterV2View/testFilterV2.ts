import { reactive } from 'vue'
import { createFilter, type FilterStore, type MakeFilterOption } from '@/composables/filter/filterFactory.ts'
import type { IntegerId } from '@/types/common.ts'

const filterFields: MakeFilterOption[] = [
  { name: 'text' as const, type: 'string', default: null, render: { skip: true } },
  { name: 'docId' as const, type: 'string', default: null },
  { name: 'headline' as const, type: 'string', default: null },
  { name: 'url' as const, type: 'string', default: null },
  { name: 'site' as const, field: 'siteIds', default: [] as IntegerId[] },
  { name: 'rubric' as const, field: 'rubricIds', default: [] as IntegerId[] },
  { name: 'desks' as const, field: 'deskIds', default: [] as IntegerId[] },
  { name: 'status' as const, default: [] as string[] },
  { name: 'linkedList' as const, field: 'linkedListIds', default: [] as IntegerId[], render: { skip: true } },
  { name: 'lockType' as const, default: null },
  { name: 'publicPublishedAtFrom' as const, type: 'datetime', default: null },
  { name: 'publicPublishedAtUntil' as const, type: 'datetime', default: null },
  { name: 'modifiedAtFrom' as const, type: 'datetime', default: null },
  { name: 'modifiedAtUntil' as const, type: 'datetime', default: null },
  { name: 'owners' as const, field: 'ownerIds', default: [] as IntegerId[] },
  { name: 'keywords' as const, field: 'keywordIds', default: [] as IntegerId[], render: { skip: true } },
  { name: 'articleAuthors' as const, field: 'authorIds', default: [] as IntegerId[] },
  { name: 'enableAds' as const, type: 'boolean', field: 'flagsStandard.enableAds', default: null },
]

const listFiltersStore = reactive<FilterStore<typeof filterFields>>({
  docId: null,
  text: null,
  headline: null,
  url: null,
  site: [],
  rubric: [],
  desks: [],
  status: [],
  linkedList: [],
  lockType: null,
  publicPublishedAtFrom: null,
  publicPublishedAtUntil: null,
  modifiedAtFrom: null,
  modifiedAtUntil: null,
  owners: [],
  keywords: [],
  articleAuthors: [],
  enableAds: null,
})

export function useTestListFilter() {
  const { filterConfig, filterData } = createFilter(filterFields, {
    elastic: true,
    system: 'system',
    subject: 'subject',
    globalStore: listFiltersStore,
  })

  return {
    filterConfig,
    filterData,
  }
}
