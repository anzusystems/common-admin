import { toRaw } from 'vue'
import type { DocId } from '@/shared/types/common'
import type { AssetCustomData, AssetDetailItemDto } from '@/domains/dam/types/Asset'
import { cloneDeep, isArray, isObject, isUndefined } from '@/shared/utils/common'

/**
 * The metadata a save of a queue row or of the asset detail edits, as the DAM had them when last read or saved.
 * The DAM keeps a field a save leaves out, but deletes a custom field left out of the custom data. So a save
 * sends only the fields changed against this, and changed custom data rebased onto the asset read right before.
 * Sending the rest as loaded would put back or delete what another editor saved meanwhile.
 */
export interface DamMetadataOnServer {
  keywords: DocId[]
  authors: DocId[]
  sources: DocId[]
  customData: AssetCustomData
  mainFileSingleUse: boolean | null
}

// Keyed by the queue row or the asset object of the detail. Unknown for one never read here: that one is sent whole.
const known = new WeakMap<object, DamMetadataOnServer>()

export const metadataOnServer = (of: object) => known.get(toRaw(of))

export const setMetadataOnServer = (of: object, metadata: DamMetadataOnServer) => {
  known.set(toRaw(of), cloneDeep(metadata))
}

export const forgetMetadataOnServer = (of: object) => {
  known.delete(toRaw(of))
}

// The DAM writes empty custom data as an empty list.
export const customDataOf = (value: unknown): AssetCustomData => (isObject(value) && !isArray(value) ? value : {})

// Missing parts read as empty: a host may hand over a shortened asset.
export const metadataOfAsset = (
  asset: Partial<Pick<AssetDetailItemDto, 'keywords' | 'authors' | 'sources' | 'mainFileSingleUse'>> & {
    metadata?: { customData?: unknown }
  }
): DamMetadataOnServer => ({
  keywords: asset.keywords ?? [],
  authors: asset.authors ?? [],
  sources: asset.sources ?? [],
  customData: customDataOf(asset.metadata?.customData),
  mainFileSingleUse: asset.mainFileSingleUse ?? null,
})

/**
 * Equality as the DAM sees it: lists by values in order, objects by keys.
 * A key with no value equals a missing key, as it is not sent.
 */
export const sameMetadataValue = (one: unknown, other: unknown): boolean => {
  if (one === other) return true
  if (isArray(one) || isArray(other)) {
    return (
      isArray(one) &&
      isArray(other) &&
      one.length === other.length &&
      one.every((value, index) => sameMetadataValue(value, other[index]))
    )
  }
  if (!isObject(one) || !isObject(other)) return false
  const a = one as Record<string, unknown>
  const b = other as Record<string, unknown>

  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((key) => sameMetadataValue(a[key], b[key]))
}

/**
 * Custom data `mine` rebased onto `theirs`: keys `mine` changed against `base` keep its value, all other keys take
 * the value of `theirs`, which can be another editor's. A key without a value is left out.
 * A key both changed keeps `mine`: the later save wins.
 */
export const rebaseCustomData = (
  mine: AssetCustomData,
  base: AssetCustomData,
  theirs: AssetCustomData
): AssetCustomData => {
  const rebased: AssetCustomData = {}
  for (const key of new Set([...Object.keys(mine ?? {}), ...Object.keys(theirs)])) {
    const value = sameMetadataValue(mine?.[key], base[key]) ? theirs[key] : mine?.[key]
    if (!isUndefined(value)) rebased[key] = value
  }

  return rebased
}
