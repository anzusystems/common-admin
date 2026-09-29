import { computed } from 'vue'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

export const useDamAuthorAssetTypeConfig = (assetType: DamAssetTypeType, extSystem: IntegerId) => {
  const { getDamConfigExtSystem } = useDamConfigState()
  const configExtSystem = getDamConfigExtSystem(extSystem)

  if (isUndefined(configExtSystem)) {
    throw new Error('useDamAuthorAssetTypeConfig: Ext system must be initialised.')
  }

  const authorEnabled = computed(() => {
    return !!configExtSystem[assetType]?.authors?.enabled
  })

  const authorRequired = computed(() => {
    return !!configExtSystem[assetType]?.authors?.required
  })

  return {
    authorEnabled,
    authorRequired,
  }
}
