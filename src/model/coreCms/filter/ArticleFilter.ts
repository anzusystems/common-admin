import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import { dateTimeEndOfDay, dateTimeStartOfDay } from '@/utils/datetime'

const makeFilter = makeFilterHelper('common', 'articleSelect')

const filter = reactive({
  _elastic: {
    ...makeFilter({ exclude: true }),
  },
  id: {
    ...makeFilter({ name: 'id' }),
  },
  docId: {
    ...makeFilter({ name: 'docId' }),
  },
  text: {
    ...makeFilter({ name: 'text', variant: 'search' }),
  },
  title: {
    ...makeFilter({ name: 'title', variant: 'search' }),
  },
  url: {
    ...makeFilter({ name: 'url' }),
  },
  site: {
    ...makeFilter({ name: 'site', field: 'siteIds', default: [] }),
  },
  rubric: {
    ...makeFilter({ name: 'rubrics', field: 'rubricIds', default: [] }),
  },
  discriminator: {
    ...makeFilter({ name: 'discriminator' }),
  },
  publicPublishedAtFrom: {
    ...makeFilter({
      name: 'publicPublishedAtFrom',
      default: dateTimeStartOfDay(-100),
    }),
  },
  publicPublishedAtUntil: {
    ...makeFilter({
      name: 'publicPublishedAtUntil',
      default: dateTimeEndOfDay(),
    }),
  },
  modifiedAtFrom: {
    ...makeFilter({
      name: 'modifiedAtFrom',
      default: dateTimeStartOfDay(-100),
    }),
  },
  modifiedAtUntil: {
    ...makeFilter({
      name: 'modifiedAtUntil',
      default: dateTimeEndOfDay(),
    }),
  },
  owners: {
    ...makeFilter({ name: 'owners', field: 'ownerIds', default: [] }),
  },
  keywords: {
    ...makeFilter({ name: 'keywords', field: 'keywordIds', default: [] }),
  },
  articleAuthors: {
    ...makeFilter({ name: 'articleAuthors', field: 'authorIds', default: [] }),
  },
})

export function useArticleListFilter() {
  return filter
}
