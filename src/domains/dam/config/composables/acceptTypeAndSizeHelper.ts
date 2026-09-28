import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import { computed } from 'vue'
import type { DamExtSystemConfig } from '@/domains/dam/types/DamConfig'

export function useDamAcceptTypeAndSizeHelper(
  assetType: undefined | DamAssetTypeType = undefined,
  damConfigExtSystem: DamExtSystemConfig
) {
  const createSizesByAssetType = (assetType: DamAssetTypeType) => {
    const config = damConfigExtSystem[assetType]
    if (!config) return {}
    const sizes: Record<string, number> = {}
    for (const mimeType of config.mimeTypes) {
      sizes[mimeType] = config.sizeLimit
    }
    return sizes
  }

  const uploadSizes = computed(() => {
    if (assetType) {
      return {
        ...createSizesByAssetType(assetType),
      }
    }
    return {
      ...createSizesByAssetType(DamAssetType.Image),
      ...createSizesByAssetType(DamAssetType.Audio),
      ...createSizesByAssetType(DamAssetType.Video),
      ...createSizesByAssetType(DamAssetType.Document),
    }
  })

  const uploadAccept = computed(() => {
    return Object.keys(uploadSizes.value).join(',')
  })

  return {
    uploadSizes,
    uploadAccept,
  }
}
