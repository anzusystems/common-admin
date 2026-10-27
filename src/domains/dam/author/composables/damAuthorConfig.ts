import { computed } from 'vue'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

/**
 * Asset type rules of the ext system from the DAM configuration store of `configName`.
 * Without a name, uses the inherited one in component setup, else `default`.
 */
export const useDamAuthorAssetTypeConfig = (assetType: DamAssetTypeType, extSystem: IntegerId, configName?: string) => {
  const { getDamConfigExtSystem } = useDamConfigState(undefined, inheritedDamConfigName(configName))
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
