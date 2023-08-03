import type { DocId, IntegerId } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { AssetFile } from '@/types/coreDam/AssetFile'

interface Texts {
  displayTitle: string
}

export type DistributionServiceName = string

export enum DamAssetStatus {
  Draft = 'draft',
  WithFile = 'with_file',
  Deleting = 'deleting',
  Default = Draft,
}

export enum DamAssetType {
  Image = 'image',
  Audio = 'audio',
  Video = 'video',
  Document = 'document',
  Default = Image,
}

export type DamAssetTypeValues = `${DamAssetType}`

export const damAssetTypeValueToEnum = (value: DamAssetTypeValues) => {
  switch (value) {
    case 'image':
      return DamAssetType.Image
    case 'audio':
      return DamAssetType.Audio
    case 'video':
      return DamAssetType.Video
    case 'document':
      return DamAssetType.Document
    default:
      return DamAssetType.Default
  }
}

interface Attributes {
  assetType: DamAssetType
  assetStatus: DamAssetStatus
}

export interface AssetFileProperties {
  distributesInServices: DistributionServiceName[]
  slotNames: string[]
  fromRss: boolean
  width: number
  height: number
}

export interface AssetSearchListItemDto extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: DocId
  texts: Texts
  attributes: Attributes
  licence: IntegerId
  mainFile: null | AssetFile
  keywords: DocId[]
  authors: DocId[]
  podcasts: DocId[]
  assetFileProperties: AssetFileProperties
}
