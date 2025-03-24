import { reactive } from 'vue'
import { createFilter, type FilterStore, type MakeFilterOption } from '@/composables/filter/filterFactory.ts'
import type { IntegerId } from '@/types/common.ts'

const filterFields: MakeFilterOption[] = [
  { name: 'text' as const, type: 'string', default: null, render: { skip: true } },
  { name: 'site' as const, field: 'siteIds', default: [] as IntegerId[] },
  { name: 'rubric' as const, field: 'rubricIds', default: [] as IntegerId[] },
  { name: 'articleAuthors' as const, field: 'authorIds', default: [] as IntegerId[] },
  { name: 'status' as const, default: [] as string[] },
  { name: 'docId' as const, type: 'string', default: null },
  { name: 'desks' as const, field: 'deskIds', default: [] as IntegerId[] },
  { name: 'publicPublishedAtFrom' as const, type: 'datetime', default: null },
  { name: 'publicPublishedAtUntil' as const, type: 'datetime', default: null },
  { name: 'owners' as const, field: 'ownerIds', default: [] as IntegerId[] },
  { name: 'url' as const, type: 'string', default: null },
  { name: 'modifiedAtFrom' as const, type: 'datetime', default: null },
  { name: 'modifiedAtUntil' as const, type: 'datetime', default: null },
  { name: 'headline' as const, type: 'string', default: null },
  { name: 'linkedList' as const, field: 'linkedListIds', default: [] as IntegerId[], render: { skip: true } },
  { name: 'lockType' as const, default: null },
  { name: 'keywords' as const, field: 'keywordIds', default: [] as IntegerId[], render: { skip: true } },
  { name: 'enableAds' as const, type: 'boolean', field: 'flagsStandard.enableAds', default: null },
]

const listFiltersStore = reactive<FilterStore<typeof filterFields>>({
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
