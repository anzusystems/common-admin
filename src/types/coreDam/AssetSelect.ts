import type { DocId } from '@/types/common'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import { isNull } from '@/utils/common'

export const AssetSelectReturnType = {
  MainFileId: 'mainFileId',
  AssetId: 'assetId',
  Asset: 'asset',
} as const
export type AssetSelectReturnTypeType =
  (typeof AssetSelectReturnType)[keyof typeof AssetSelectReturnType]

export type AssetSelectReturnData =
  | AssetSelectReturnMainFileId
  | AssetSelectReturnAssetId
  | AssetSelectReturnAsset

interface AssetSelectReturnMainFileId {
  type: typeof AssetSelectReturnType.MainFileId
  value: Array<DocId>
}

interface AssetSelectReturnAssetId {
  type: typeof AssetSelectReturnType.AssetId
  value: Array<DocId>
}

interface AssetSelectReturnAsset {
  type: typeof AssetSelectReturnType.Asset
  value: Array<AssetSearchListItemDto>
}

/**
 * The subject a single-use photo may already be held by without blocking this pick. Shaped exactly
 * like the holder DAM reports in `mainFile.fileAttributes.usedByHolderName/Id`, so the comparison is
 * a plain equality. `null` means the entity has no id yet — no single-use photo is selectable then.
 */
export interface AssetSelectHolder {
  resourceName: string
  resourceId: string
}

/**
 * Whether two holders are the same subject. `null` never matches anything, including another `null` —
 * no identity means there is nothing to claim a single-use photo with.
 */
export const holdersEqual = (a: AssetSelectHolder | null, b: AssetSelectHolder | null): boolean => {
  if (isNull(a) || isNull(b)) return false
  return a.resourceName === b.resourceName && a.resourceId === b.resourceId
}
