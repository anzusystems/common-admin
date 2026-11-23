import { i18n } from '@/plugins/i18n'
import {
  AssetSingleUseUsageStatus,
  DamAssetType,
  type AssetSearchListItemDto,
  type AssetSingleUseUsage,
} from '@/types/coreDam/Asset'
import type { DamAssetLicenceCached } from '@/types/coreDam/AssetLicence'
import type { DocId, IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'
import type {
  AssetSelectabilityOptions,
  AssetSelectListItem,
} from '@/services/stores/coreDam/assetSelectStore'

export const resolveHolderName = (resourceName: string): string => {
  const { t, te } = i18n.global
  const key = `common.assetSelect.holder.${resourceName}`
  return te(key) ? t(key) : resourceName
}

const SINGLE_USE_USAGE_COUNT_SHOWN = 10

export const formatSingleUseUsageCount = (usageCount: number): string =>
  usageCount > SINGLE_USE_USAGE_COUNT_SHOWN ? `${SINGLE_USE_USAGE_COUNT_SHOWN}+` : String(usageCount)

export const resolveSingleUseWarningCount = (
  usage: AssetSingleUseUsage | null | undefined,
): number =>
  usage &&
  (usage.status === AssetSingleUseUsageStatus.Conflict ||
    usage.status === AssetSingleUseUsageStatus.OwnShared)
    ? usage.usageCount
    : 0

export const resolveSingleUseReason = (asset: AssetSearchListItemDto): string | null => {
  const { t } = i18n.global
  if (!(asset.mainFile?.flags.singleUse ?? false)) return null

  const usage = asset.singleUseUsage
  if (!usage?.blocked) return null

  if (usage.status === AssetSingleUseUsageStatus.NotAllowed) {
    return t('common.assetSelect.disabledReason.singleUseNotAllowed')
  }

  return t('common.assetSelect.disabledReason.singleUseBlocked', {
    count: formatSingleUseUsageCount(usage.usageCount),
  })
}

export const resolveDisabledReason = (
  asset: AssetSearchListItemDto,
  licence: DamAssetLicenceCached | undefined,
  options: Pick<AssetSelectabilityOptions, 'uploadLicence'>,
): string | null => {
  const { t } = i18n.global
  const singleUseReason = resolveSingleUseReason(asset)
  if (singleUseReason) return singleUseReason

  const directUseAllowed = licence?.flags?.directUseAllowed ?? true
  if (!directUseAllowed && asset.attributes.assetType !== DamAssetType.Image) {
    return t('common.assetSelect.disabledReason.directUseDisabledNotImage')
  }
  if (!directUseAllowed && isUndefined(options.uploadLicence)) {
    return t('common.assetSelect.disabledReason.directUseDisabledNoUploadLicence')
  }

  return null
}

export const resolveDisabledReasons = (
  items: AssetSelectListItem[],
  getCachedAssetLicence: (id: IntegerId) => DamAssetLicenceCached | undefined,
  options: Pick<AssetSelectabilityOptions, 'uploadLicence'>,
): Map<DocId, string | null> => {
  const reasons = new Map<DocId, string | null>()

  items.forEach((item) => {
    reasons.set(
      item.asset.id,
      resolveDisabledReason(item.asset, getCachedAssetLicence(item.asset.licence), options),
    )
  })

  return reasons
}
