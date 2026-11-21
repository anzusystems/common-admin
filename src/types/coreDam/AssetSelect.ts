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
  forceTakeOver: boolean
  value: Array<DocId>
}

interface AssetSelectReturnAssetId {
  type: typeof AssetSelectReturnType.AssetId
  forceTakeOver: boolean
  value: Array<DocId>
}

interface AssetSelectReturnAsset {
  type: typeof AssetSelectReturnType.Asset
  forceTakeOver: boolean
  value: Array<AssetSearchListItemDto>
}

export interface AssetSelectUsageHolder {
  name: string
  id: string | number
}
