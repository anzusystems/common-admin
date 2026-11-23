import { ref } from 'vue'
import type { AssetSearchListItemDto, AssetSingleUseUsage } from '@/types/coreDam/Asset'
import type { DocId } from '@/types/common'
import type { AssetSelectUsageHolder } from '@/types/coreDam/AssetSelect'
import { useImageSingleUseUsageFetch } from '@/components/damImage/composables/commonAdminImageOptions'
import { useAlerts } from '@/composables/system/alerts'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { isNull, isUndefined } from '@/utils/common'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'
import { resolveDisabledReasons } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'

export const getSingleUseGroupId = (asset: AssetSearchListItemDto): DocId | null => {
  const mainFile = asset.mainFile
  if (isUndefined(mainFile) || isNull(mainFile)) return null
  return mainFile.fileAttributes.takenOverFromId || mainFile.id
}

export function useSingleUseUsageFetch(configName = 'default') {
  const fetchUsageByGroups = useImageSingleUseUsageFetch(configName)

  const fetchSingleUseUsage = async (
    asset: AssetSearchListItemDto,
    usageHolder: AssetSelectUsageHolder | null,
  ): Promise<AssetSingleUseUsage | null> => {
    const groupId = getSingleUseGroupId(asset)
    if (isUndefined(fetchUsageByGroups) || isNull(groupId)) return null
    const usage = (await fetchUsageByGroups([groupId], usageHolder))[groupId]
    if (isUndefined(usage)) throw new Error(`Single use usage of group ${groupId} was not returned.`)
    return usage
  }

  return {
    fetchSingleUseUsage,
  }
}

export function useAssetSelectUsageRefresh(configName = 'default') {
  const assetSelectStore = useAssetSelectStore()
  const { getCachedAssetLicence } = useDamCachedAssetLicences()
  const { fetchSingleUseUsage } = useSingleUseUsageFetch(configName)
  const { showErrorsDefault } = useAlerts()
  const usageLoading = ref(false)
  let latestRefresh = 0

  const refreshUsage = async (asset: AssetSearchListItemDto) => {
    const request = ++latestRefresh
    usageLoading.value = true
    try {
      const usage = await fetchSingleUseUsage(
        asset,
        assetSelectStore.selectability?.usageHolder ?? null,
      )
      if (request !== latestRefresh) return
      assetSelectStore.setSingleUseUsage(asset.id, usage)
      const selectability = assetSelectStore.selectability
      if (!isNull(selectability)) {
        assetSelectStore.setDisabledReasons(
          resolveDisabledReasons(
            assetSelectStore.assetListItems.filter((item) => item.asset.id === asset.id),
            getCachedAssetLicence,
            selectability,
          ),
        )
      }
    } catch (error) {
      if (request === latestRefresh) showErrorsDefault(error)
    } finally {
      if (request === latestRefresh) usageLoading.value = false
    }
  }

  return {
    usageLoading,
    refreshUsage,
  }
}

export interface SingleUseUsageCheck {
  asset: AssetSearchListItemDto
  failed: boolean
}

export function useSingleUseUsageCheck(configName = 'default') {
  const { fetchSingleUseUsage } = useSingleUseUsageFetch(configName)
  const { showErrorsDefault } = useAlerts()
  const singleUseCheck = ref<SingleUseUsageCheck | null>(null)
  let latestCheck = 0

  const checkSingleUseUsage = async (
    asset: AssetSearchListItemDto,
    usageHolder: AssetSelectUsageHolder | null,
  ) => {
    const request = ++latestCheck
    singleUseCheck.value = null
    if (!asset.mainFile?.flags.singleUse) return
    try {
      const usage = await fetchSingleUseUsage(asset, usageHolder)
      if (request !== latestCheck) return
      singleUseCheck.value = { asset: { ...asset, singleUseUsage: usage }, failed: false }
    } catch (error) {
      if (request !== latestCheck) return
      singleUseCheck.value = { asset, failed: true }
      showErrorsDefault(error)
    }
  }

  const clearSingleUseUsage = () => {
    latestCheck++
    singleUseCheck.value = null
  }

  return {
    singleUseCheck,
    checkSingleUseUsage,
    clearSingleUseUsage,
  }
}
