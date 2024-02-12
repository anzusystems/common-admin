import type { IntegerId } from '@/types/common'
import type { AnzuUser } from '@/types/AnzuUser'

export interface DamUserUpdateDto {
  id: IntegerId
  assetLicences: IntegerId[]
  allowedAssetExternalProviders: string[]
  allowedDistributionServices: string[]
  adminToExtSystems: IntegerId[]
  readonly userToExtSystems: IntegerId[]
  plainPassword?: string
}

export interface DamUser extends Omit<AnzuUser, 'id'>, DamUserUpdateDto {}
