import type { DocId, IntegerId } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { AssetFile } from '@/types/coreDam/AssetFile'

interface Texts {
  displayTitle: string
}

export type DistributionServiceName = string

// export type AssetFile = ImageFile | AudioFile | VideoFile | DocumentFile

// todo separate file
export enum AssetStatus {
  Draft = 'draft',
  WithFile = 'with_file',
  Deleting = 'deleting',
  Default = Draft,
}

// todo separate file
export enum AssetType {
  Image = 'image',
  Audio = 'audio',
  Video = 'video',
  Document = 'document',
  Default = Image,
}

interface Attributes {
  assetType: AssetType
  assetStatus: AssetStatus
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
