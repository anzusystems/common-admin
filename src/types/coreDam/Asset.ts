import type { DocId, DocIdNullable, IntegerId } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { AssetFile } from '@/types/coreDam/AssetFile'

interface Texts {
  displayTitle: string
}

export type DamDistributionServiceName = string

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
  distributesInServices: DamDistributionServiceName[]
  slotNames: string[]
  fromRss: boolean
  width: number
  height: number
}

interface Flags {
  described: boolean
  visible: boolean
}

export interface AssetMetadataSuggestions extends Record<string, Array<string>> {}

export type AssetCustomData = Record<string, any>

interface Metadata {
  authorSuggestions: AssetMetadataSuggestions
  keywordSuggestions: AssetMetadataSuggestions
  customData: any
}

export interface AssetSearchListItemDto extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: DocId
  texts: Texts
  attributes: Attributes
  flags: Flags
  licence: IntegerId
  mainFile: null | AssetFile
  keywords: DocId[]
  authors: DocId[]
  podcasts: DocId[]
  assetFileProperties: AssetFileProperties
}

export interface AssetDetailItemDto extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: DocId
  texts: Texts
  attributes: Attributes
  flags: Flags
  licence: IntegerId
  mainFile: null | AssetFile
  keywords: DocId[]
  authors: DocId[]
  podcasts: DocId[]
  metadata: Metadata
  distributionCategory: DocIdNullable
  assetFileProperties: AssetFileProperties
}

export interface AssetMetadataDto extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware, Metadata {
  id: DocId
  customData: AssetCustomData
}

export type AssetExternalProviderId = string | number
export type AssetExternalProviderIdNullable = AssetExternalProviderId | null

export type AssetExternalProviderMetadata = Record<string, string | number | number[] | string[] | boolean>
