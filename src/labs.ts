import type { Pagination2 as Pagination } from '@/types/Pagination'
import { usePagination2 as usePagination } from '@/composables/system/pagination2'
import { createDatatableColumnsConfig2 as createDatatableColumnsConfig } from '@/composables/system/datatableColumns2'
import AFilterBooleanSelect from '@/components/filter2/variant/AFilterBooleanSelect2.vue'
import AFilterDatetimePicker from '@/components/filter2/variant/AFilterDatetimePicker2.vue'
import AFilterInteger from '@/components/filter2/variant/AFilterInteger2.vue'
import AFilterRemoteAutocomplete from '@/components/filter2/variant/AFilterRemoteAutocomplete2.vue'
import AFilterRemoteAutocompleteWithMinimal from '@/components/filter2/variant/AFilterRemoteAutocompleteWithMinimal2.vue'
import AFilterString from '@/components/filter2/variant/AFilterString2.vue'
import AFilterTimeInterval from '@/components/filter2/variant/AFilterTimeInterval2.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter2/variant/AFilterValueObjectOptionsSelect2.vue'
import AFilterWrapper from '@/components/filter2/AFilterWrapper2.vue'
import ADatatableOrdering from '@/components/ADatatableOrdering2.vue'
import ADatatablePagination from '@/components/ADatatablePagination2.vue'
import { apiFetchByIds2 as apiFetchByIds } from '@/services/api/v2/apiFetchByIds2'
import { useApiFetchList, generateListQuery } from '@/services/api/v2/useApiFetchList'
import {
  DatatablePaginationKey,
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
} from '@/components/filter2/filterInjectionKeys'
import {
  createFilter,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
  useFilterHelpers2 as useFilterHelpers,
} from '@/composables/filter/filterFactory'
import {
  TimeIntervalSpecialOptions,
  type TimeIntervalToolsValue,
} from '@/components/filter2/variant/filterTimeIntervalTools'

export {
  // V2 FILTERS
  AFilterWrapper,
  AFilterBooleanSelect,
  AFilterDatetimePicker,
  AFilterInteger,
  AFilterRemoteAutocomplete,
  AFilterRemoteAutocompleteWithMinimal,
  AFilterString,
  AFilterTimeInterval,
  AFilterValueObjectOptionsSelect,
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  DatatablePaginationKey,
  createFilter,
  useFilterHelpers,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
  TimeIntervalSpecialOptions,
  type TimeIntervalToolsValue,
  type Pagination,
  apiFetchByIds,
  useApiFetchList,
  generateListQuery,
  usePagination,
  createDatatableColumnsConfig,
  ADatatableOrdering,
  ADatatablePagination,
}
