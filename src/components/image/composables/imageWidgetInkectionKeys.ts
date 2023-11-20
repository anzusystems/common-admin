import type { InjectionKey, ShallowRef } from 'vue'
import type { DamExtSystemConfig } from '@/types/coreDam/DamConfig'

export const ImageWidgetExtSystemConfig: InjectionKey<ShallowRef<DamExtSystemConfig>> = Symbol.for(
  'anzu:ImageWidgetExtSystemConfig'
)
