import type { InjectionKey, Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/composables/filter/filterFactory.ts'
import type { ValueObjectOption } from '@/types/ValueObject.ts'

export const FilterDataKey: InjectionKey<FilterData<any>> = Symbol.for('anzu:FilterDataKey')
export const FilterConfigKey: InjectionKey<FilterConfig<any>> = Symbol.for('anzu:FilterConfigKey')

export const FilterInnerDataKey: InjectionKey<FilterData<any>> = Symbol.for('anzu:FilterInnerDataKey')
export const FilterInnerConfigKey: InjectionKey<FilterConfig<any>> = Symbol.for('anzu:FilterInnerConfigKey')

export const FilterSubmitResetCounterKey: InjectionKey<Ref<number>> = Symbol.for('anzu:FilterSubmitResetCounterKey')
export const FilterSelectedKey: InjectionKey<Ref<Map<string, ValueObjectOption<string | number>[]>>> =
  Symbol.for('anzu:FilterSelectedKey')
export const FilterSelectedFutureKey: InjectionKey<Ref<Map<string, ValueObjectOption<string | number>[]>>> =
  Symbol.for('anzu:FilterSelectedFutureKey')
export const FilterTouchedKey: InjectionKey<Ref<boolean>> = Symbol.for('anzu:FilterTouchedKey')
