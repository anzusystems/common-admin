import { i18n } from '@/plugins/i18n'
import { DamAssetType, type AssetSearchListItemDto } from '@/types/coreDam/Asset'
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

export const resolveSingleUseReason = (
  asset: AssetSearchListItemDto,
  options: Pick<AssetSelectabilityOptions, 'singleUseAllowed'>,
): string | null => {
  const { t } = i18n.global
  if (!(asset.mainFile?.flags.singleUse ?? false)) return null

  if (!options.singleUseAllowed) {
    return t('common.assetSelect.disabledReason.singleUseNotAllowed')
  }
  if (asset.singleUseUsage?.blocked) {
    return t('common.assetSelect.disabledReason.singleUseBlocked', {
      count: asset.singleUseUsage.otherHolderCount,
    })
  }

  return null
}

export const resolveDisabledReason = (
  asset: AssetSearchListItemDto,
  licence: DamAssetLicenceCached | undefined,
  options: Pick<AssetSelectabilityOptions, 'singleUseAllowed' | 'uploadLicence'>,
): string | null => {
  const { t } = i18n.global
  const singleUseReason = resolveSingleUseReason(asset, options)
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
  options: Pick<AssetSelectabilityOptions, 'singleUseAllowed' | 'uploadLicence'>,
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
