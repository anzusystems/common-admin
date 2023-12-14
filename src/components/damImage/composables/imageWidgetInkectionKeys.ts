import type { InjectionKey, ShallowRef } from 'vue'
import type { DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import type { IntegerId } from '@/types/common'

export const ImageWidgetExtSystemConfigs: InjectionKey<ShallowRef<Map<IntegerId, DamExtSystemConfig>>> = Symbol.for(
  'anzu:ImageWidgetExtSystemConfigs'
)
