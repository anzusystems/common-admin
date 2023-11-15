import type { DamAssetType } from '@/types/coreDam/Asset'

export interface DamConfig {
  assetExternalProviders: {
    [key: string]: { title: string }
  }
  distributionServices: {
    [key: string]: {
      title: string
      iconPath: string
      type: DistributionServiceType
      allowedRedistributeStatuses: Array<DistributionStatus>
    }
  }
  colorSet: {
    [key: string]: string
  }
  settings: {
    aclCheckEnabled: boolean
    adminAllowListName: string
    allowSelectExtSystem: boolean
    allowSelectLicenceId: boolean
    defaultAssetLicenceId: number
    defaultExtSystemId: number
    imageChunkConfig: {
      minSize: number
      maxSize: number
    }
    maxBulkItemCount: number
  }
}

export interface DamConfigExtSystem extends Record<DamAssetType, ExtSystemConfig> {
  assetExternalProviders: ExternalProviderAssetConfig
  audio: ExtSystemConfig
  video: ExtSystemConfig
  image: ExtSystemConfig
  document: ExtSystemConfig
}

export interface ExtSystemConfig {
  sizeLimit: number
  defaultFileVersion: string
  versions: Array<string>
  mimeTypes: Array<string>
  distribution: DistributionConfig
  authors: ExtSystemAssetTypeExifMetadata
  keywords: ExtSystemAssetTypeExifMetadata
  customMetadataPinnedAmount: number
  slots: string[]
}

export type ExternalProviderAssetConfig = Record<ExternalProviderAssetName, { listingLimit: number; title: string }>

export type DistributionServiceName = string

export type ExternalProviderAssetName = string

export interface DistributionConfig {
  distributionServices: Array<DistributionServiceName>
  distributionRequirements: Record<DistributionServiceName, DistributionRequirementsConfig>
}

export interface DistributionRequirementsConfig {
  title: string
  requiredAuth: boolean
  blockedBy: Array<DistributionServiceName>
  categorySelect: DistributionRequirementsCategorySelectConfig
  strategy: DistributionRequirementStrategy
}

export enum DistributionRequirementStrategy {
  None = 'none',
  AtLeastOne = 'at_least_one',
  OneFromType = 'one_from_type',
  WaitForAll = 'wait_for_all',
  Default = None,
}

export interface DistributionRequirementsCategorySelectConfig {
  enabled: boolean
  required: boolean
}

export interface ExtSystemAssetTypeExifMetadata {
  enabled: boolean
  required: boolean
}

export enum DistributionServiceType {
  Youtube = 'youtubeDistribution',
  Jw = 'jwDistribution',
  Custom = 'customDistribution',
}

export enum DistributionStatus {
  Waiting = 'waiting',
  Distributing = 'distributing',
  RemoteProcessing = 'remote_processing',
  Distributed = 'distributed',
  Failed = 'failed',
  Default = Waiting,
}

export interface DamPubConfig {
  userAuthType: UserAuthType
}

export enum UserAuthType {
  JsonCredentials = 'json_credentials',
  OAuth2 = 'oauth2',
  Default = JsonCredentials,
}
