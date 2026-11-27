import type { IntegerId } from '@/shared/types/common'
import type { AnzuUser } from '@/shared/types/AnzuUser'

export interface DamUserUpdateDto {
  id: IntegerId
  assetLicences: IntegerId[]
  allowedAssetExternalProviders: string[]
  allowedDistributionServices: string[]
  adminToExtSystems: IntegerId[]
  licenceGroups: IntegerId[]
  readonly userToExtSystems: IntegerId[]
  plainPassword?: string
}

export interface DamUser extends Omit<AnzuUser, 'id'>, DamUserUpdateDto {}
