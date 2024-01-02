import type { IntegerId } from '@/types/common'
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

export interface DamCurrentUserDto extends AnzuUser {
  selectedLicence: DamCurrentUserAssetLicence | null
  adminToExtSystems: DamCurrentUserExtSystem[]
  userToExtSystems: DamCurrentUserExtSystem[]
  assetLicences: DamCurrentUserAssetLicence[]
  person: {
    firstName: string
    lastName: string
    fullName: string
  }
  avatar: {
    color: string
    text: string
  }
  allowedAssetExternalProviders: string[]
  allowedDistributionServices: string[]
}
