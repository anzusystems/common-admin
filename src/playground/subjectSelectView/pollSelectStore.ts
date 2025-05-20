import { reactive, ref } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

const datatableHiddenColumns = ref([])

const makeFilter = makeFilterHelper('cms', 'poll')

const filter = reactive({
  id: {
    ...makeFilter({ name: 'id' }),
  },
  title: {
    ...makeFilter({ name: 'title', variant: 'startsWith', field: 'texts.title' }),
  },
  startOfVotingFrom: {
    ...makeFilter({
      name: 'startOfVotingFrom',
      variant: 'gte',
      field: 'dates.startOfVoting',
    }),
  },
  startOfVotingTo: {
    ...makeFilter({
      name: 'startOfVotingTo',
      variant: 'lte',
      field: 'dates.startOfVoting',
    }),
  },
  displayType: {
    ...makeFilter({ name: 'displayType', variant: 'in', field: 'attributes.displayType' }),
  },
})

export function usePollSelectStore() {
  return {
    filter,
    datatableHiddenColumns,
  }
}
