import { reactive } from 'vue'
import {
  createFilter,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'

export const filterFields = [
  { name: 'text' as const, type: 'string', render: { skip: true } },
  { name: 'site' as const, apiName: 'siteIds' },
  { name: 'rubric' as const, apiName: 'rubricIds' },
  { name: 'articleAuthors' as const, apiName: 'authorIds' },
  { name: 'status' as const },
  { name: 'docId' as const, type: 'string' },
  { name: 'desks' as const, apiName: 'deskIds' },
  { name: 'publicPublishedAtFrom' as const, type: 'timeInterval', related: 'publicPublishedAtUntil' },
  { name: 'publicPublishedAtUntil' as const, type: 'timeInterval', exclude: true, render: { skip: true } },
  { name: 'owners' as const, apiName: 'ownerIds' },
  { name: 'url' as const, type: 'string' },
  { name: 'modifiedAtFrom' as const, type: 'timeInterval', related: 'modifiedAtUntil' },
  { name: 'modifiedAtUntil' as const, type: 'timeInterval', exclude: true, render: { skip: true } },
  { name: 'headline' as const, type: 'string' },
  { name: 'linkedList' as const, apiName: 'linkedListIds', render: { skip: true } },
  { name: 'lockType' as const },
  { name: 'keywords' as const, apiName: 'keywordIds', render: { skip: true } },
  { name: 'enableAds' as const, type: 'boolean', apiName: 'flagsStandard.enableAds' },
  { name: 'discriminator' as const, render: { skip: true } },
] satisfies readonly MakeFilterOption[]

const listFiltersStore = reactive<SubjectFilterStore>({
  text: null,
  site: [],
  rubric: [],
  articleAuthors: [],
  status: null,
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
  discriminator: 'standard',
})

export function useSubjectListFilter() {
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
type SubjectFilterFields = { name: (typeof filterFields)[number]['name'] }[]
export type SubjectFilterStore = FilterStore<SubjectFilterFields>
export type SubjectFilterData = FilterData<SubjectFilterFields>
export type SubjectFilterConfig = FilterConfig<SubjectFilterFields>
