import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUser } from '@/types/AnzuUser'

export interface DamCurrentUserExtSystem {
  id: IntegerId
  name: string
}

export interface DamCurrentUserAssetLicence {
  id: IntegerId
  name: string
  extSystem: IntegerId
}

export interface DamCurrentUserAssetLicenceGroup {
  id: IntegerId
  name: string
  extSystem: IntegerId
  licences: IntegerId[]
}

export interface DamCurrentUserDto extends AnzuUser {
  selectedLicence: IntegerIdNullable
  selectedLicenceDto: DamCurrentUserAssetLicence | null
  adminToExtSystems: IntegerId[]
  adminToExtSystemsDto: DamCurrentUserExtSystem[]
  userToExtSystems: IntegerId[]
  userToExtSystemsDto: DamCurrentUserExtSystem[]
  assetLicences: IntegerId[]
  assetLicencesDto: DamCurrentUserAssetLicence[]
  licenceGroups: IntegerId[]
  licenceGroupsDto: DamCurrentUserAssetLicenceGroup[]
  resolvedAssetLicences: DamCurrentUserAssetLicence[]
  allowedAssetExternalProviders: string[]
  allowedDistributionServices: string[]
}
