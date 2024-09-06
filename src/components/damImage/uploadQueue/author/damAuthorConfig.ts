import { computed } from 'vue'
import type { DamAssetTypeType } from '@/types/coreDam/Asset'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'

export const useDamAuthorAssetTypeConfig = (assetType: DamAssetTypeType, extSystem: IntegerId) => {
  const { getDamConfigExtSystem } = useDamConfigState()
  const configExtSystem = getDamConfigExtSystem(extSystem)

  if (isUndefined(configExtSystem)) {
    throw new Error('Ext system must be initialised.')
  }

  const authorEnabled = computed(() => {
    return configExtSystem[assetType].authors.enabled
  })

  const authorRequired = computed(() => {
    return configExtSystem[assetType].authors.required
  })

  return {
    authorEnabled,
    authorRequired,
  }
}
