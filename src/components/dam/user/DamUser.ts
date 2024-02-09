import type { IntegerId } from '@/types/common'

export interface DamUserUpdateDto {
  id: IntegerId
  assetLicences: IntegerId[]
  allowedAssetExternalProviders: string[]
  allowedDistributionServices: string[]
  adminToExtSystems: IntegerId[]
  readonly userToExtSystems: IntegerId[]
  plainPassword?: string
}
