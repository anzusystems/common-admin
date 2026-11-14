import { computed } from 'vue'
import type { DamAssetTypeType } from '@/types/coreDam/Asset'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'

export const isDamSourceEnabled = (assetType: DamAssetTypeType, extSystem: IntegerId) => {
  const { getDamConfigExtSystem } = useDamConfigState()
  return !!getDamConfigExtSystem(extSystem)?.[assetType]?.sources.enabled
}

export const useDamSourceAssetTypeConfig = (assetType: DamAssetTypeType, extSystem: IntegerId) => {
  const { getDamConfigExtSystem } = useDamConfigState()
  const configExtSystem = getDamConfigExtSystem(extSystem)

  if (isUndefined(configExtSystem)) {
    throw new Error('useDamSourceAssetTypeConfig: Ext system must be initialised.')
  }

  const sourceEnabled = computed(() => {
    return !!configExtSystem[assetType]?.sources.enabled
  })

  const sourceRequired = computed(() => {
    return !!configExtSystem[assetType]?.sources.required
  })

  return {
    sourceEnabled,
    sourceRequired,
  }
}
