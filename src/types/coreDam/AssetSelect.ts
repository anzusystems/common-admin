import type { DocId } from '@/types/common'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'

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
 * like the holder DAM reports in `mainFile.fileAttributes`, so the comparison is a plain equality.
 */
export interface AssetSelectOwner {
  resourceName: string
  resourceId: string
}
