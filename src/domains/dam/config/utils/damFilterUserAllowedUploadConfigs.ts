import { cloneDeep, isUndefined } from '@/shared/utils/common'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import type { AclValue } from '@/domains/auth/types/Permission'
import type { DamCurrentUserDto } from '@/domains/dam/types/DamCurrentUser'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'

export function filterAllowedImageWidgetSelectConfigs(values: DamConfigLicenceExtSystemReturnType[]) {
  const { useCurrentUser } = defineAuth<AclValue>(SYSTEM_DAM)
  const { currentUser: damCurrentUser, isSuperAdmin: damCurrentUserIsSuperAdmin } =
    useCurrentUser<DamCurrentUserDto>(SYSTEM_DAM)

  if (damCurrentUserIsSuperAdmin.value) return cloneDeep(values)
  const currentUser = damCurrentUser.value
  if (isUndefined(currentUser)) return []

  const adminToExtSystems = currentUser.adminToExtSystems
  const assetLicences = currentUser.resolvedAssetLicences.map((assetLicenceValue) => assetLicenceValue.id)
  const allowed: DamConfigLicenceExtSystemReturnType[] = []
  values.forEach((value) => {
    if (adminToExtSystems.includes(value.extSystem)) {
      allowed.push(value)
      return
    }
    if (assetLicences.includes(value.licence)) {
      allowed.push(value)
    }
  })
  return allowed
}

export function isImageWidgetUploadConfigAllowed(value: DamConfigLicenceExtSystemReturnType): boolean {
  const { useCurrentUser } = defineAuth<AclValue>(SYSTEM_DAM)
  const { currentUser: damCurrentUser, isSuperAdmin: damCurrentUserIsSuperAdmin } =
    useCurrentUser<DamCurrentUserDto>(SYSTEM_DAM)

  if (damCurrentUserIsSuperAdmin.value) return true

  const currentUser = damCurrentUser.value
  if (isUndefined(currentUser)) return false

  const adminToExtSystems = currentUser.adminToExtSystems
  if (adminToExtSystems.includes(value.extSystem)) {
    return true
  }

  const assetLicences = currentUser.resolvedAssetLicences.map((assetLicenceValue) => assetLicenceValue.id)
  if (assetLicences.includes(value.licence)) {
    return true
  }

  return false
}
