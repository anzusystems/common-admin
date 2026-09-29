import { computed } from 'vue'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

export const useDamKeywordAssetTypeConfig = (assetType: DamAssetTypeType, extSystem: IntegerId) => {
  const { getDamConfigExtSystem } = useDamConfigState()

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
