import { computed } from 'vue'
import type { DamAssetTypeType } from '@/types/coreDam/Asset'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'

export const useDamKeywordAssetTypeConfig = (assetType: DamAssetTypeType, extSystem: IntegerId) => {
  const { getDamConfigExtSystem } = useDamConfigState()

  const configExtSystem = getDamConfigExtSystem(extSystem)

  if (isUndefined(configExtSystem)) {
    throw new Error('Ext system must be initialised.')
  }

  const keywordEnabled = computed(() => {
    return configExtSystem[assetType].keywords.enabled
  })

  const keywordRequired = computed(() => {
    return configExtSystem[assetType].keywords.required
  })

  return {
    keywordEnabled,
    keywordRequired,
  }
}
