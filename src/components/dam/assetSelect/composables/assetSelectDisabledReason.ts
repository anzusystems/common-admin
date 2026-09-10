import type { AxiosInstance } from 'axios'
import { i18n } from '@/plugins/i18n'
import { DamAssetType, type AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { DamAssetLicenceCached } from '@/types/coreDam/AssetLicence'
import type { DocId, IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'
import { useAlerts } from '@/composables/system/alerts'
import {
  fetchSingleUseHolders,
  type SingleUseHolders,
} from '@/components/dam/assetSelect/composables/assetSelectSingleUseHolders'
import type {
  AssetSelectabilityOptions,
  AssetSelectListItem,
} from '@/services/stores/coreDam/assetSelectStore'

const NO_HOLDERS: SingleUseHolders = { docIds: [], galleryIds: [] }

export const resolveDisabledReason = (
  asset: AssetSearchListItemDto,
  licence: DamAssetLicenceCached | undefined,
  options: AssetSelectabilityOptions,
  holders: SingleUseHolders,
): string | null => {
  const { t } = i18n.global
  const singleUse = asset.mainFile?.flags.singleUse ?? false

  if (!options.singleUseAllowed && singleUse) {
    return t('common.assetSelect.disabledReason.singleUseNotAllowed')
  }

  const heldByOther =
    holders.docIds.some((docId) => docId !== options.ownerDocId) ||
    holders.galleryIds.some((galleryId) => galleryId !== options.ownerGalleryId)
  if (singleUse && heldByOther) {
    return t('common.assetSelect.disabledReason.singleUseHeld')
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
 * Resolves the reasons for the given items only - callers pass one freshly fetched page, so an already
 * resolved page is never asked about again. The `single-use-holders` precheck for rule 2 (single use
 * already held by another docId) is batched inside fetchSingleUseHolders, never sent per item. A failed
 * precheck degrades to "no known holders" - the CMS save still enforces exclusivity server-side, so this
 * only affects the disabled hint in the dialog.
 */
export const resolveDisabledReasons = async (
  imageClient: (() => AxiosInstance) | undefined,
  items: AssetSelectListItem[],
  getCachedAssetLicence: (id: IntegerId) => DamAssetLicenceCached | undefined,
  options: AssetSelectabilityOptions,
): Promise<Map<DocId, string | null>> => {
  const reasons = new Map<DocId, string | null>()
  const singleUseDamIds: DocId[] = []

  items.forEach((item) => {
    if (!options.singleUseAllowed) return
    if (!item.asset.mainFile?.flags.singleUse) return
    singleUseDamIds.push(item.asset.mainFile.id)
  })

  let holdersByDamId = new Map<DocId, SingleUseHolders>()
  if (singleUseDamIds.length > 0 && imageClient) {
    try {
      holdersByDamId = await fetchSingleUseHolders(imageClient, singleUseDamIds)
    } catch (error) {
      const { showErrorsDefault } = useAlerts()
      showErrorsDefault(error)
    }
  }

  items.forEach((item) => {
    const licence = getCachedAssetLicence(item.asset.licence)
    const damId = item.asset.mainFile?.id
    const holders = (damId ? holdersByDamId.get(damId) : undefined) ?? NO_HOLDERS
    reasons.set(item.asset.id, resolveDisabledReason(item.asset, licence, options, holders))
  })

  return reasons
}
