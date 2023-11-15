import { DamAssetType } from '@/types/coreDam/Asset'
import type { DamConfigExtSystem } from '@/types/coreDam/DamConfig'

export const getAssetTypeByMimeType = (
  mimeType: string,
  damConfigExtSystem: DamConfigExtSystem
): DamAssetType | null => {
  for (const [key, values] of Object.entries(damConfigExtSystem)) {
    if (!Object.values(DamAssetType).includes(key as DamAssetType)) continue
    for (let i = 0; i < values.mimeTypes.length; i++) {
      if (mimeType === values.mimeTypes[i]) return key as DamAssetType
    }
  }
  return null
}
