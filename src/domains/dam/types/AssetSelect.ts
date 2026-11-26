import type { DocId } from '@/shared/types/common'
import type { AssetSearchListItemDto } from '@/domains/dam/types/Asset'

export const AssetSelectReturnType = {
  MainFileId: 'mainFileId',
  AssetId: 'assetId',
  Asset: 'asset',
} as const
export type AssetSelectReturnTypeType = (typeof AssetSelectReturnType)[keyof typeof AssetSelectReturnType]

export type AssetSelectReturnData = AssetSelectReturnMainFileId | AssetSelectReturnAssetId | AssetSelectReturnAsset

// `forceTakeOver`: the picked assets of another licence than the upload licence go into the upload licence even
// where their licence allows direct use. The picker locks it on for a licence that does not allow it.
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

/** The record a picker picks for, as core-cms names it: the single use usage of a photo is answered for it. */
export interface AssetSelectUsageHolder {
  resourceName: string
  resourceId: string | number
}
