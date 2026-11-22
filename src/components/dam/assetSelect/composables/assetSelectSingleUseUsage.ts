import { ref } from 'vue'
import type { AssetSearchListItemDto, AssetSingleUseUsage } from '@/types/coreDam/Asset'
import type { AssetSelectUsageHolder } from '@/types/coreDam/AssetSelect'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useFetchAssetListByLicences } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useAssetSingleUseUsageFilter } from '@/model/coreDam/filter/AssetFilter'
import { usePagination } from '@/labs/filters/pagination'
import { useAlerts } from '@/composables/system/alerts'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { isNull } from '@/utils/common'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'
import { resolveDisabledReasons } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'

// DAM answers the usage only inside the licence search, so one asset is searched by its id.
export function useSingleUseUsageFetch(configName = 'default') {
  const { damClient, endPointAsset } = useCommonAdminCoreDamOptions(configName)

  const fetchSingleUseUsage = async (
    asset: AssetSearchListItemDto,
    usageHolder: AssetSelectUsageHolder | null,
  ): Promise<AssetSingleUseUsage | null> => {
    const { executeFetch } = useFetchAssetListByLicences(damClient, endPointAsset)
    const { filterData, filterConfig } = useAssetSingleUseUsageFilter()
    const { pagination } = usePagination(null)
    filterData.licences = [asset.licence]
    filterData.assetAndMainFileIds = asset.id
    filterData.usageHolderName = usageHolder?.name ?? null
    filterData.usageHolderId = isNull(usageHolder) ? null : String(usageHolder.id)
    const list = await executeFetch(pagination, filterData, filterConfig)
    return list.find((item) => item.id === asset.id)?.singleUseUsage ?? null
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

  const refreshUsage = async (asset: AssetSearchListItemDto) => {
    usageLoading.value = true
    try {
      const usage = await fetchSingleUseUsage(
        asset,
        assetSelectStore.selectability?.usageHolder ?? null,
      )
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
      showErrorsDefault(error)
    } finally {
      usageLoading.value = false
    }
  }

  return {
    usageLoading,
    refreshUsage,
  }
}

export interface SingleUseUsageCheck {
  asset: AssetSearchListItemDto
  holderName: string | null
  failed: boolean
}

export function useSingleUseUsageCheck(configName = 'default') {
  const { fetchSingleUseUsage } = useSingleUseUsageFetch(configName)
  const { showErrorsDefault } = useAlerts()
  const singleUseCheck = ref<SingleUseUsageCheck | null>(null)

  const checkSingleUseUsage = async (
    asset: AssetSearchListItemDto,
    usageHolder: AssetSelectUsageHolder | null,
  ) => {
    singleUseCheck.value = null
    if (!asset.mainFile?.flags.singleUse) return
    const holderName = usageHolder?.name ?? null
    try {
      const usage = await fetchSingleUseUsage(asset, usageHolder)
      singleUseCheck.value = { asset: { ...asset, singleUseUsage: usage }, holderName, failed: false }
    } catch (error) {
      singleUseCheck.value = { asset, holderName, failed: true }
      showErrorsDefault(error)
    }
  }

  const clearSingleUseUsage = () => {
    singleUseCheck.value = null
  }

  return {
    singleUseCheck,
    checkSingleUseUsage,
    clearSingleUseUsage,
  }
}
