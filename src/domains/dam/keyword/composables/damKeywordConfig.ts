import { computed } from 'vue'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

/**
 * The rules of the asset type in the ext system, by the DAM configuration store of `configName`: a name left out is
 * the inherited one in a component's setup, else `default`.
 */
export const useDamKeywordAssetTypeConfig = (
  assetType: DamAssetTypeType,
  extSystem: IntegerId,
  configName?: string
) => {
  const { getDamConfigExtSystem } = useDamConfigState(undefined, inheritedDamConfigName(configName))

  const configExtSystem = getDamConfigExtSystem(extSystem)

  if (isUndefined(configExtSystem)) {
    throw new Error('useDamKeywordAssetTypeConfig: Ext system must be initialised.')
  }

  const keywordEnabled = computed(() => {
    return !!configExtSystem[assetType]?.keywords?.enabled
  })

  const keywordRequired = computed(() => {
    return !!configExtSystem[assetType]?.keywords?.required
  })

  return {
    keywordEnabled,
    keywordRequired,
  }
}
