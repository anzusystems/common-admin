import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { DamExtSystemConfig } from '@/domains/dam/types/DamConfig'

export const getAssetTypeByMimeType = (
  mimeType: string,
  damConfigExtSystem: DamExtSystemConfig
): DamAssetTypeType | null => {
  for (const [key, values] of Object.entries(damConfigExtSystem)) {
    if (!Object.values(DamAssetType).includes(key as DamAssetTypeType)) continue
    for (let i = 0; i < values.mimeTypes.length; i++) {
      if (mimeType === values.mimeTypes[i]) return key as DamAssetTypeType
    }
  }
  return null
}
