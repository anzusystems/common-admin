import type { DamAssetTypeType, DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { IntegerId } from '@/types/common'

export interface DamPrvConfig {
  assetExternalProviders: {
    [key: string]: { title: string }
  }
  distributionServices: {
    [key: string]: {
      title: string
      iconPath: string
      type: DamDistributionServiceTypeType
      allowedRedistributeStatuses: Array<DamDistributionStatusType>
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

export interface DamExtSystemConfig extends Record<DamAssetTypeType, DamExtSystemConfigItem> {
  assetExternalProviders: DamExternalProviderAssetConfig
  audio: DamExtSystemConfigItem
  video: DamExtSystemConfigItem
  image: DamExtSystemConfigItemImage
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

export interface DamExtSystemConfigItemImage extends DamExtSystemConfigItem {
  roiWidth: number,
  roiHeight: number,
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
  strategy: DamDistributionRequirementStrategyType
}

export const DamDistributionRequirementStrategy = {
  None: 'none',
  AtLeastOne: 'at_least_one',
  OneFromType: 'one_from_type',
  WaitForAll: 'wait_for_all',
} as const
export type DamDistributionRequirementStrategyType =
  (typeof DamDistributionRequirementStrategy)[keyof typeof DamDistributionRequirementStrategy]
export const DamDistributionRequirementStrategyDefault = DamDistributionRequirementStrategy.None

export interface DamDistributionRequirementsCategorySelectConfig {
  enabled: boolean
  required: boolean
}

export interface DamExtSystemAssetTypeExifMetadata {
  enabled: boolean
  required: boolean
}

export const DamDistributionServiceType = {
  Youtube: 'youtubeDistribution',
  Jw: 'jwDistribution',
  Custom: 'customDistribution',
} as const
export type DamDistributionServiceTypeType =
  (typeof DamDistributionServiceType)[keyof typeof DamDistributionServiceType]

export const DamDistributionStatus = {
  Waiting: 'waiting',
  Distributing: 'distributing',
  RemoteProcessing: 'remote_processing',
  Distributed: 'distributed',
  Failed: 'failed',
} as const
export type DamDistributionStatusType = (typeof DamDistributionStatus)[keyof typeof DamDistributionStatus]
export const DamDistributionStatusDefault = DamDistributionStatus.Waiting

export interface DamPubConfig {
  userAuthType: UserAuthTypeType
}

export const UserAuthType = {
  JsonCredentials: 'json_credentials',
  OAuth2: 'oauth2',
} as const
export type UserAuthTypeType = (typeof UserAuthType)[keyof typeof UserAuthType]
export const UserAuthTypeDefault = UserAuthType.JsonCredentials
