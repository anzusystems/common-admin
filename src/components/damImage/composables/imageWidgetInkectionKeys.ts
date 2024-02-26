import type { InjectionKey, ShallowRef } from 'vue'
import type { DamConfigLicenceExtSystemReturnType, DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import type { IntegerId } from '@/types/common'

export const ImageWidgetExtSystemConfigs: InjectionKey<ShallowRef<Map<IntegerId, DamExtSystemConfig>>> = Symbol.for(
  'anzu:ImageWidgetExtSystemConfigs'
)

export const ImageWidgetUploadConfig: InjectionKey<DamConfigLicenceExtSystemReturnType | undefined> =
  Symbol.for('anzu:ImageWidgetUploadConfig')
