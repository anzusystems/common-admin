import { useDamConfigState } from '@/components/dam/uploadQueue/damConfigState'
import { DamAssetType } from '@/types/coreDam/Asset'
import { computed } from 'vue'

export function useDamAcceptTypeAndSizeHelper (assetType: undefined | DamAssetType = undefined) {
  const { damConfigExtSystem } = useDamConfigState()

  const createSizesByAssetType = (assetType: DamAssetType) => {
    const sizes: Record<string, number> = {}
    for (let i = 0; i < damConfigExtSystem.value[assetType].mimeTypes.length; i++) {
      sizes[damConfigExtSystem.value[assetType].mimeTypes[i]] = damConfigExtSystem.value[assetType].sizeLimit
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

