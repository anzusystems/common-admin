import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY } from '@/components/damImage/uploadQueue/api/keywordApi'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { reactive } from 'vue'
// eslint-disable-next-line deprecation/no-deprecated-imports
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

export function useKeywordInnerFilter() {
  const filterFieldsInner = [
    { name: 'text' as const, variant: 'search', default: null, type: 'string' },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFieldsInner, createFilterStore(filterFieldsInner), {
    elastic: true,
    system: SYSTEM_CORE_DAM,
    subject: ENTITY,
  })

  return {
    filterConfig,
    filterData,
  }
}

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
