import { reactive, ref } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

const datatableHiddenColumns = ref([])

const makeFilter = makeFilterHelper('cms', 'poll')

const filter = reactive({
  id: {
    ...makeFilter({ name: 'id' }),
  },
  title: {
    ...makeFilter({ name: 'title', variant: 'startsWith', apiName: 'texts.title' }),
  },
  startOfVotingFrom: {
    ...makeFilter({
      name: 'startOfVotingFrom',
      variant: 'gte',
      apiName: 'dates.startOfVoting',
    }),
  },
  startOfVotingTo: {
    ...makeFilter({
      name: 'startOfVotingTo',
      variant: 'lte',
      apiName: 'dates.startOfVoting',
    }),
  },
  displayType: {
    ...makeFilter({ name: 'displayType', variant: 'in', apiName: 'attributes.displayType' }),
  },
})

export function usePollSelectStore() {
  return {
    filter,
    datatableHiddenColumns,
  }
}
