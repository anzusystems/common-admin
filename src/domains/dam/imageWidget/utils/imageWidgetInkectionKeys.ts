import type { InjectionKey, ShallowRef } from 'vue'
import type { DamConfigLicenceExtSystemReturnType, DamExtSystemConfig } from '@/domains/dam/types/DamConfig'
import type { IntegerId } from '@/shared/types/common'

export const ImageWidgetExtSystemConfigs: InjectionKey<ShallowRef<Map<IntegerId, DamExtSystemConfig>>> = Symbol.for(
  'anzu:ImageWidgetExtSystemConfigs'
)

export const ImageWidgetUploadConfigKey: InjectionKey<ShallowRef<DamConfigLicenceExtSystemReturnType | undefined>> =
  Symbol.for('anzu:ImageWidgetUploadConfig')
