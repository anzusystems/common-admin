import type { InjectionKey, Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/labs/filters/pagination'

export const FilterDataKey: InjectionKey<FilterData> = Symbol.for('anzu:FilterDataKey')
export const FilterConfigKey: InjectionKey<FilterConfig> = Symbol.for('anzu:FilterConfigKey')

export const FilterInnerDataKey: InjectionKey<FilterData> = Symbol.for('anzu:FilterInnerDataKey')
export const FilterInnerConfigKey: InjectionKey<FilterConfig> = Symbol.for('anzu:FilterInnerConfigKey')

export const FilterSubmitResetCounterKey: InjectionKey<Ref<number>> = Symbol.for('anzu:FilterSubmitResetCounterKey')
export const FilterSelectedKey: InjectionKey<Ref<Map<string, ValueObjectOption<string | number>[]>>> =
  Symbol.for('anzu:FilterSelectedKey')

export const DatatablePaginationKey: InjectionKey<Ref<Pagination>> = Symbol.for('anzu:DatatablePaginationKey')
