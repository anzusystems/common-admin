import type { DamAssetType, DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { IntegerId } from '@/types/common'

export interface DamPrvConfig {
  assetExternalProviders: {
    [key: string]: { title: string }
  }
  distributionServices: {
    [key: string]: {
      title: string
      iconPath: string
      type: DamDistributionServiceType
      allowedRedistributeStatuses: Array<DamDistributionStatus>
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

export interface DamExtSystemConfig extends Record<DamAssetType, DamExtSystemConfigItem> {
  assetExternalProviders: DamExternalProviderAssetConfig
  audio: DamExtSystemConfigItem
  video: DamExtSystemConfigItem
  image: DamExtSystemConfigItem
  document: DamExtSystemConfigItem
}

export interface DamConfigLicenceExtSystem {
  extSystem: IntegerId
  name: string
}

export interface DamConfigLicenceExtSystemReturnType {
  licence: IntegerId
  extSystem: IntegerId
  licenceName: string
  extSystemConfig: DamExtSystemConfig
}

export interface DamExtSystemConfigItem {
  sizeLimit: number
  defaultFileVersion: string
  versions: Array<string>
  mimeTypes: Array<string>
  distribution: DamDistributionConfig
  authors: DamExtSystemAssetTypeExifMetadata
  keywords: DamExtSystemAssetTypeExifMetadata
  customMetadataPinnedAmount: number
  slots: string[]
}

export type DamExternalProviderAssetConfig = Record<
  DamExternalProviderAssetName,
  {
    listingLimit: number
    title: string
  }
>

export type DamExternalProviderAssetName = string

export interface DamDistributionConfig {
  distributionServices: Array<DamDistributionServiceName>
  distributionRequirements: Record<DamDistributionServiceName, DamDistributionRequirementsConfig>
}

export interface DamDistributionRequirementsConfig {
  title: string
  requiredAuth: boolean
  blockedBy: Array<DamDistributionServiceName>
  categorySelect: DamDistributionRequirementsCategorySelectConfig
  strategy: DamDistributionRequirementStrategy
}

export enum DamDistributionRequirementStrategy {
  None = 'none',
  AtLeastOne = 'at_least_one',
  OneFromType = 'one_from_type',
  WaitForAll = 'wait_for_all',
  Default = None,
}

export interface DamDistributionRequirementsCategorySelectConfig {
  enabled: boolean
  required: boolean
}

export interface DamExtSystemAssetTypeExifMetadata {
  enabled: boolean
  required: boolean
}

export enum DamDistributionServiceType {
  Youtube = 'youtubeDistribution',
  Jw = 'jwDistribution',
  Custom = 'customDistribution',
}

export enum DamDistributionStatus {
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
