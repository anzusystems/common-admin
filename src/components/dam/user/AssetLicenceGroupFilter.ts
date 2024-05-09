import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY } from '@/components/dam/user/assetLicenceGroupApi'

const makeFilter = makeFilterHelper(SYSTEM_CORE_DAM, ENTITY)

export function useDamAssetLicenceGroupFilter() {
  return reactive({
    name: {
      ...makeFilter({ name: 'name', variant: 'startsWith' }),
    },
  })
}
