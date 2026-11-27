import { commonT, commonTe } from '@/plugins/i18n'
import { type AssetSearchListItemDto, AssetSingleUseUsageStatus, DamAssetType } from '@/domains/dam/types/Asset'
import type { DamAssetLicenceCached } from '@/domains/dam/types/AssetLicence'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'
import type { AssetSelectabilityOptions, AssetSelectListItem } from '@/domains/dam/assetSelect/store/assetSelectStore'

/** The kind of record core-cms names by `resourceName`, in words; "other record" for a kind the library does not know. */
export const resolveHolderLabel = (resourceName: string): string => {
  const key = `common.assetSelect.holder.${resourceName}`
  return commonTe(key) ? commonT(key) : commonT('common.assetSelect.holderOther')
}

const SINGLE_USE_USAGE_COUNT_SHOWN = 10

/** A usage count as shown: up to 10, then "10+". */
export const formatSingleUseUsageCount = (usageCount: number): string =>
  usageCount > SINGLE_USE_USAGE_COUNT_SHOWN ? `${SINGLE_USE_USAGE_COUNT_SHOWN}+` : String(usageCount)

/** How many records use a single use photo, when another record does: the warning on its badge and usage tab. */
export const resolveSingleUseWarningCount = (asset: AssetSearchListItemDto): number => {
  const usage = asset.singleUseUsage
  return asset.mainFile?.flags?.singleUse &&
    (usage?.status === AssetSingleUseUsageStatus.Conflict || usage?.status === AssetSingleUseUsageStatus.OwnShared)
    ? usage.usageCount
    : 0
}

/** Why a single use photo cannot be picked for the record, by the usage core-cms answered; `null` if it can. */
export const resolveSingleUseReason = (asset: AssetSearchListItemDto): string | null => {
  if (!(asset.mainFile?.flags?.singleUse ?? false)) return null

  const usage = asset.singleUseUsage
  if (!usage?.blocked) return null

  if (usage.status === AssetSingleUseUsageStatus.NotAllowed) {
    return commonT('common.assetSelect.disabledReason.singleUseNotAllowed')
  }

  return commonT('common.assetSelect.disabledReason.singleUseBlocked', {
    count: formatSingleUseUsageCount(usage.usageCount),
  })
}

/**
 * Why an asset cannot be picked: a blocked single use photo, or a licence without direct use for what cannot be
 * taken over (an asset that is not a photo, or a picker without an upload licence). `null` if it can.
 */
export const resolveDisabledReason = (
  asset: AssetSearchListItemDto,
  licence: DamAssetLicenceCached | undefined,
  options: Pick<AssetSelectabilityOptions, 'uploadLicence'>
): string | null => {
  const singleUseReason = resolveSingleUseReason(asset)
  if (singleUseReason) return singleUseReason

  const directUseAllowed = licence?.flags?.directUseAllowed ?? true
  if (!directUseAllowed && asset.attributes.assetType !== DamAssetType.Image) {
    return commonT('common.assetSelect.disabledReason.directUseDisabledNotImage')
  }
  if (!directUseAllowed && isUndefined(options.uploadLicence)) {
    return commonT('common.assetSelect.disabledReason.directUseDisabledNoUploadLicence')
  }

  return null
}

export const resolveDisabledReasons = (
  items: AssetSelectListItem[],
  getCachedAssetLicence: (id: IntegerId) => DamAssetLicenceCached | undefined,
  options: Pick<AssetSelectabilityOptions, 'uploadLicence'>
): Map<DocId, string | null> => {
  const reasons = new Map<DocId, string | null>()

  items.forEach((item) => {
    reasons.set(item.asset.id, resolveDisabledReason(item.asset, getCachedAssetLicence(item.asset.licence), options))
  })

  return reasons
}
