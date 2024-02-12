import { reactive } from 'vue'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY } from '@/components/dam/user/extSystemApi'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

const makeFilter = makeFilterHelper(SYSTEM_CORE_DAM, ENTITY)

export function useExtSystemFilter() {
  return reactive({
    name: {
      ...makeFilter({ name: 'name', variant: 'startsWith' }),
    },
  })
}
