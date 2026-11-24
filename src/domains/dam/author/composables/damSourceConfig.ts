import { computed } from 'vue'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

/**
 * Whether the asset type of the ext system has sources, from the DAM configuration store of `configName`.
 * Without a name, uses the inherited one in component setup, else `default`.
 */
export const isDamSourceEnabled = (assetType: DamAssetTypeType, extSystem: IntegerId, configName?: string) => {
  const { getDamConfigExtSystem } = useDamConfigState(undefined, inheritedDamConfigName(configName))
  return !!getDamConfigExtSystem(extSystem)?.[assetType]?.sources?.enabled
}

/**
 * Source rules of the asset type of the ext system from the DAM configuration store of `configName`.
 * Without a name, uses the inherited one in component setup, else `default`.
 */
export const useDamSourceAssetTypeConfig = (assetType: DamAssetTypeType, extSystem: IntegerId, configName?: string) => {
  const { getDamConfigExtSystem } = useDamConfigState(undefined, inheritedDamConfigName(configName))
  const configExtSystem = getDamConfigExtSystem(extSystem)

  if (isUndefined(configExtSystem)) {
    throw new Error('useDamSourceAssetTypeConfig: Ext system must be initialised.')
  }

  const sourceEnabled = computed(() => {
    return !!configExtSystem[assetType]?.sources?.enabled
  })

  const sourceRequired = computed(() => {
    return !!configExtSystem[assetType]?.sources?.required
  })

  return {
    sourceEnabled,
    sourceRequired,
  }
}
