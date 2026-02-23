import { DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'
import { computed } from 'vue'
import type { DamExtSystemConfig } from '@/types/coreDam/DamConfig'

export function useDamAcceptTypeAndSizeHelper(
  assetType: undefined | DamAssetTypeType = undefined,
  damConfigExtSystem: DamExtSystemConfig,
) {
  const createSizesByAssetType = (assetType: DamAssetTypeType) => {
    const config = damConfigExtSystem[assetType]
    if (!config) return {}
    const sizes: Record<string, number> = {}
    for (let i = 0; i < config.mimeTypes.length; i++) {
      sizes[config.mimeTypes[i]] = config.sizeLimit
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
