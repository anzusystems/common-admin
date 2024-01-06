import { reactive } from 'vue'
import { dateTimeEndOfDay, dateTimeStartOfDay } from '@/utils/datetime'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

const makeFilter = makeFilterHelper('cms', 'article')

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
    ...makeFilter({ name: 'text' }),
  },
  title: {
    ...makeFilter({ name: 'title' }),
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
})

export function useTestListFilter() {
  return filter
}
