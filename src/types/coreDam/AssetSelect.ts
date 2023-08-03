import type { DocId } from '@/types/common'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'

export enum AssetSelectReturnType {
  MainFileId = 'mainFileId',
  AssetId = 'assetId',
  Asset = 'asset',
}

export type AssetSelectReturnTypeValues = `${AssetSelectReturnType}`

export type AssetSelectReturnData = AssetSelectReturnMainFileId | AssetSelectReturnAssetId | AssetSelectReturnAsset

interface AssetSelectReturnMainFileId {
  type: 'mainFileId'
  value: Array<DocId>
}

interface AssetSelectReturnAssetId {
  type: 'assetId'
  value: Array<DocId>
}

interface AssetSelectReturnAsset {
  type: 'asset'
  value: Array<AssetSearchListItemDto>
}

export const assetSelectReturnTypeValuesToEnum = (value: AssetSelectReturnTypeValues) => {
  switch (value) {
    case 'assetId':
      return AssetSelectReturnType.AssetId
    case 'asset':
      return AssetSelectReturnType.Asset
    case 'mainFileId':
    default:
      return AssetSelectReturnType.MainFileId
  }
}
