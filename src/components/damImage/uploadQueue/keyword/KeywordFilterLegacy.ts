import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY } from '@/components/damImage/uploadQueue/api/keywordApi'
import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

const makeFilter = makeFilterHelper(SYSTEM_CORE_DAM, ENTITY)
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
  reviewed: {
    ...makeFilter({ name: 'reviewed' }),
  },
})

/**
 * @deprecated
 */
export function useKeywordListFilter() {
  return filter
}
