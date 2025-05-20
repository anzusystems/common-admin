import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

const makeFilter = makeFilterHelper('dam', 'user')

const filter = reactive({
  id: {
    ...makeFilter({ name: 'id', default: null }),
  },
  email: {
    ...makeFilter({ name: 'email', variant: 'startsWith' }),
  },
  enabled: {
    ...makeFilter({ name: 'enabled' }),
  },
  lastName: {
    ...makeFilter({ name: 'lastName', variant: 'startsWith', field: 'person.lastName' }),
  },
  permissionGroups: {
    ...makeFilter({ name: 'permissionGroups', variant: 'custom', multiple: true, default: [] }),
  },
})

export function useDamUserFilter() {
  return filter
}
