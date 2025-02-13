import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

const makeFilter = makeFilterHelper('coreDam', 'author')

const filter = reactive({
  _elastic: {
    ...makeFilter({ exclude: true }),
  },
  id: {
    ...makeFilter({ name: 'id' }),
  },
  text: {
    ...makeFilter({ name: 'text' }),
  },
  identifier: {
    ...makeFilter({ name: 'identifier' }),
  },
  reviewed: {
    ...makeFilter({ name: 'reviewed' }),
  },
  type: {
    ...makeFilter({ name: 'type' }),
  },
})

export function useAuthorListFilter() {
  return filter
}
