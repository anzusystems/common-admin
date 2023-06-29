import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

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
    ...makeFilter({ name: 'publishedAtFrom' }),
  },
  publishedAtUntil: {
    ...makeFilter({ name: 'publishedAtUntil' }),
  },
})

export function useTestListFilter() {
  return filter
}
