import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'

export const filterFields = [
  { name: 'text' as const, default: null, type: 'string', variant: 'search', render: { skip: true } },
  { name: 'site' as const, default: [], apiName: 'siteIds' },
  { name: 'rubric' as const, default: [], apiName: 'rubricIds' },
  { name: 'articleAuthors' as const, default: [], apiName: 'authorIds' },
  { name: 'status' as const, default: null },
  { name: 'docId' as const, default: null, type: 'string' },
  { name: 'desks' as const, default: [], apiName: 'deskIds' },
  { name: 'publicPublishedAtFrom' as const, default: null, type: 'timeInterval', related: 'publicPublishedAtUntil' },
  {
    name: 'publicPublishedAtUntil' as const,
    default: null,
    type: 'timeInterval',
    exclude: true,
    render: { skip: true },
  },
  { name: 'owners' as const, default: [], apiName: 'ownerIds' },
  { name: 'url' as const, default: null, type: 'string' },
  { name: 'modifiedAtFrom' as const, default: null, type: 'timeInterval', related: 'modifiedAtUntil' },
  { name: 'modifiedAtUntil' as const, default: null, type: 'timeInterval', exclude: true, render: { skip: true } },
  { name: 'headline' as const, default: null, type: 'string' },
  { name: 'linkedList' as const, default: [], apiName: 'linkedListIds', render: { skip: true } },
  { name: 'lockType' as const, default: null },
  { name: 'keywords' as const, default: [], apiName: 'keywordIds', render: { skip: true } },
  { name: 'enableAds' as const, default: null, type: 'boolean', apiName: 'flagsStandard.enableAds' },
  { name: 'discriminator' as const, default: 'standard', render: { skip: true } },
] satisfies readonly MakeFilterOption[]

const listFiltersStore = createFilterStore(filterFields)

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

export type SubjectFilterFields = typeof filterFields
export type SubjectFilterStore = FilterStore<SubjectFilterFields>
export type SubjectFilterData = FilterData<SubjectFilterFields>
export type SubjectFilterConfig = FilterConfig<SubjectFilterFields>
