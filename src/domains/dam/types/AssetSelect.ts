import type { DocId, IntegerId } from '@/shared/types/common'
import type { AssetSearchListItemDto } from '@/domains/dam/types/Asset'

export const AssetSelectReturnType = {
  MainFileId: 'mainFileId',
  AssetId: 'assetId',
  Asset: 'asset',
} as const
export type AssetSelectReturnTypeType = (typeof AssetSelectReturnType)[keyof typeof AssetSelectReturnType]

export type AssetSelectReturnData = AssetSelectReturnMainFileId | AssetSelectReturnAssetId | AssetSelectReturnAsset

interface AssetSelectReturnMainFileId {
  type: typeof AssetSelectReturnType.MainFileId
  copyToLicence: undefined | IntegerId
  value: Array<DocId>
}

interface AssetSelectReturnAssetId {
  type: typeof AssetSelectReturnType.AssetId
  copyToLicence: undefined | IntegerId
  value: Array<DocId>
}

interface AssetSelectReturnAsset {
  type: typeof AssetSelectReturnType.Asset
  copyToLicence: undefined | IntegerId
  value: Array<AssetSearchListItemDto>
}
