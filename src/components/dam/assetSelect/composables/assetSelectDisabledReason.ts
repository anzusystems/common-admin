import { i18n } from '@/plugins/i18n'
import { DamAssetType, type AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { DamAssetLicenceCached } from '@/types/coreDam/AssetLicence'
import type { DocId, IntegerId } from '@/types/common'
import { isNull, isUndefined } from '@/utils/common'
import type {
  AssetSelectabilityOptions,
  AssetSelectListItem,
} from '@/services/stores/coreDam/assetSelectStore'

/**
 * Human name of a holder type, from `common.assetSelect.holder.<resourceName>`. A resource the
 * locales do not know yet falls back to its raw value instead of showing an untranslated key.
 */
export const resolveHolderName = (resourceName: string): string => {
  const { t, te } = i18n.global
  const key = `common.assetSelect.holder.${resourceName}`
  return te(key) ? t(key) : resourceName
}

export const resolveDisabledReason = (
  asset: AssetSearchListItemDto,
  licence: DamAssetLicenceCached | undefined,
  options: AssetSelectabilityOptions,
): string | null => {
  const { t } = i18n.global
  const singleUse = asset.mainFile?.flags.singleUse ?? false

  if (!options.singleUseAllowed && singleUse) {
    return t('common.assetSelect.disabledReason.singleUseNotAllowed')
  }

  const holderResourceName = asset.mainFile?.fileAttributes.usedByResourceName ?? ''
  const holderResourceId = asset.mainFile?.fileAttributes.usedByResourceId ?? ''
  // The holder only decides for a file that is single use right now: a licence that stops enforcing it
  // leaves the last holder behind, and without this guard that stale value would block the file forever.
  const heldByOther =
    singleUse &&
    holderResourceName !== '' &&
    (isNull(options.owner) ||
      options.owner.resourceName !== holderResourceName ||
      options.owner.resourceId !== holderResourceId)
  if (heldByOther) {
    return t('common.assetSelect.disabledReason.singleUseHeld', {
      holder: resolveHolderName(holderResourceName),
    })
  }

  const directUseAllowed = licence?.flags.directUseAllowed ?? true
  if (!directUseAllowed && asset.attributes.assetType !== DamAssetType.Image) {
    return t('common.assetSelect.disabledReason.directUseDisabledNotImage')
  }
  if (!directUseAllowed && isUndefined(options.uploadLicence)) {
    return t('common.assetSelect.disabledReason.directUseDisabledNoUploadLicence')
  }

  return null
}

/**
 * Resolves the reasons for the given items only - callers pass one freshly fetched page, so an
 * already resolved page is never asked about again. Everything the rules need (the holder included)
 * arrives with the list item itself, so this is a pure synchronous mapping over the page.
 */
export const resolveDisabledReasons = (
  items: AssetSelectListItem[],
  getCachedAssetLicence: (id: IntegerId) => DamAssetLicenceCached | undefined,
  options: AssetSelectabilityOptions,
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
