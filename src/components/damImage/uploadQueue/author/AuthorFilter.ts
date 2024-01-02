import { reactive } from 'vue'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

const makeFilter = makeFilterHelper(SYSTEM_CORE_DAM, 'author')

export function useAuthorFilter() {
  return reactive({
    _elastic: {
      ...makeFilter({ exclude: true }),
    },
    text: {
      ...makeFilter({ name: 'text' }),
    },
  })
}
