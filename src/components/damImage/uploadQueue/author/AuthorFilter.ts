import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { ENTITY } from '@/components/damImage/uploadQueue/api/keywordApi'
import { reactive } from 'vue'
// eslint-disable-next-line deprecation/no-deprecated-imports
import { makeFilterHelper } from '@/composables/filter/filterHelpers'

export function useAuthorInnerFilter() {
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

const makeFilter = makeFilterHelper(SYSTEM_CORE_DAM, 'author')
/**
 * @deprecated
 */
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

