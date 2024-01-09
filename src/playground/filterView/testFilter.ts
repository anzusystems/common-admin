import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import { dateTimeEndOfDay, dateTimeStartOfDay } from '@/utils/datetime'

const makeFilter = makeFilterHelper('system', 'subject')

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
    ...makeFilter({ name: 'text', variant: 'contains' }),
  },
  title: {
    ...makeFilter({ name: 'title', variant: 'contains' }),
  },
  blog: {
    ...makeFilter({ name: 'blog', variant: 'in', field: 'blogId' }),
  },
  url: {
    ...makeFilter({ name: 'url' }),
  },
  publishedAtFrom: {
    ...makeFilter({
      name: 'publishedAtFrom',
      field: 'publishedAt',
      variant: 'gte',
      default: dateTimeStartOfDay(-100),
      mandatory: true,
    }),
  },
  publishedAtUntil: {
    ...makeFilter({
      name: 'publishedAtUntil',
      field: 'publishedAt',
      variant: 'lte',
      default: dateTimeEndOfDay(),
      mandatory: true,
    }),
  },
})

export function useTestListFilter() {
  return filter
}
