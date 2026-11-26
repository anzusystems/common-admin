import { ref } from 'vue'
import { type AssetSearchListItemDto, type AssetSingleUseUsage, DamAssetType } from '@/domains/dam/types/Asset'
import type { DocId } from '@/shared/types/common'
import type { AssetSelectUsageHolder } from '@/domains/dam/types/AssetSelect'
import { useImageSingleUseUsageFetch } from '@/domains/dam/imageWidget/composables/imageSingleUseUsageFetch'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { isNull, isUndefined } from '@/shared/utils/common'
import { useDamCachedAssetLicences } from '@/domains/dam/user/composables/cachedAssetLicences'
import { resolveDisabledReasons } from '@/domains/dam/assetSelect/composables/assetSelectDisabledReason'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

/**
 * The photo group of an asset, by which core-cms answers its usage: the root file it was taken over from, else its
 * main file. `null` without a main file.
 */
export const getSingleUseGroupId = (asset: AssetSearchListItemDto): DocId | null => {
  const mainFile = asset.mainFile
  if (isUndefined(mainFile) || isNull(mainFile)) return null
  return mainFile.fileAttributes?.takenOverFromId || mainFile.id
}

/**
 * The single use usage of one asset, asked through the image configuration of DAM configuration `configName`
 * (`useImageSingleUseUsageFetch`). Without a name, the inherited one. Call in setup.
 */
export function useSingleUseUsageFetch(configName?: string) {
  const fetchUsageByGroups = useImageSingleUseUsageFetch(inheritedDamConfigName(configName))

  /** `null` when nobody can be asked; throws when the answer misses the group. */
  const fetchSingleUseUsage = async (
    asset: AssetSearchListItemDto,
    usageHolder: AssetSelectUsageHolder | null
  ): Promise<AssetSingleUseUsage | null> => {
    const groupId = getSingleUseGroupId(asset)
    if (isUndefined(fetchUsageByGroups) || isNull(groupId)) return null
    const usage = (await fetchUsageByGroups([groupId], usageHolder))[groupId]
    if (isUndefined(usage)) throw new Error(`Single use usage of group ${groupId} was not returned.`)
    return usage
  }

  /** Whether the asset has a usage to show: a photo with a main file, where someone can be asked. */
  const hasUsage = (asset: AssetSearchListItemDto): boolean =>
    !isUndefined(fetchUsageByGroups) &&
    asset.attributes.assetType === DamAssetType.Image &&
    !isNull(getSingleUseGroupId(asset))

  return {
    fetchSingleUseUsage,
    hasUsage,
    /** Someone checks single use photos (`singleUseUsageEnabled`). Otherwise a picked one is not checked at all. */
    canAsk: !isUndefined(fetchUsageByGroups),
  }
}

/**
 * Reads the usage of a listed asset anew for its usage tab, for the record the picker picks for, and writes it into
 * the list with its reason. Only the latest read is applied and ends the loading.
 */
export function useAssetSelectUsageRefresh(configName?: string) {
  const name = inheritedDamConfigName(configName)
  const assetSelectStore = useAssetSelectStore()
  const { getCachedAssetLicence } = useDamCachedAssetLicences(name)
  const { fetchSingleUseUsage, hasUsage } = useSingleUseUsageFetch(name)
  const { showErrorsDefault, showUnknownError } = useAlerts()
  const usageLoading = ref(false)
  let latestRefresh = 0

  const refreshUsage = async (asset: AssetSearchListItemDto) => {
    const request = ++latestRefresh
    usageLoading.value = true
    try {
      const usage = await fetchSingleUseUsage(asset, assetSelectStore.selectability?.usageHolder ?? null)
      if (request !== latestRefresh) return
      assetSelectStore.setSingleUseUsage(asset.id, usage)
      const selectability = assetSelectStore.selectability
      if (!isNull(selectability)) {
        assetSelectStore.setDisabledReasons(
          resolveDisabledReasons(
            assetSelectStore.assetListItems.filter((item) => item.asset.id === asset.id),
            getCachedAssetLicence,
            selectability
          )
        )
      }
    } catch (error) {
      // An answer without the group is no api error, so it is reported as unknown.
      if (request === latestRefresh && !showErrorsDefault(error)) showUnknownError()
    } finally {
      if (request === latestRefresh) usageLoading.value = false
    }
  }

  return {
    usageLoading,
    hasUsage,
    refreshUsage,
  }
}

export interface SingleUseUsageCheck {
  asset: AssetSearchListItemDto
  /** The usage could not be read: the image dialog cannot confirm the photo. */
  failed: boolean
}

/**
 * The usage of a single use photo picked into an image widget, read at the pick for the widget's record.
 * The image dialog warns by it and refuses the confirm of a blocked photo or of a failed read.
 */
export function useSingleUseUsageCheck(configName?: string) {
  const { fetchSingleUseUsage, canAsk } = useSingleUseUsageFetch(inheritedDamConfigName(configName))
  const { showErrorsDefault, showUnknownError } = useAlerts()
  const singleUseCheck = ref<SingleUseUsageCheck | null>(null)
  let latestCheck = 0

  const checkSingleUseUsage = async (asset: AssetSearchListItemDto, usageHolder: AssetSelectUsageHolder | null) => {
    const request = ++latestCheck
    singleUseCheck.value = null
    if (!canAsk || !asset.mainFile?.flags?.singleUse) return
    try {
      const usage = await fetchSingleUseUsage(asset, usageHolder)
      if (request !== latestCheck) return
      singleUseCheck.value = { asset: { ...asset, singleUseUsage: usage }, failed: false }
    } catch (error) {
      if (request !== latestCheck) return
      singleUseCheck.value = { asset, failed: true }
      if (!showErrorsDefault(error)) showUnknownError()
    }
  }

  /** The turn of the latest check. Read right after `checkSingleUseUsage`, it names that check. */
  const singleUseCheckTurn = () => latestCheck

  /**
   * Forgets the check, and drops its answer if still on its way. Given `turn`, only while that check is the latest:
   * a pick given up late must not wipe the check of a pick made since.
   */
  const clearSingleUseUsage = (turn?: number) => {
    if (!isUndefined(turn) && turn !== latestCheck) return
    latestCheck++
    singleUseCheck.value = null
  }

  return {
    singleUseCheck,
    checkSingleUseUsage,
    singleUseCheckTurn,
    clearSingleUseUsage,
  }
}
