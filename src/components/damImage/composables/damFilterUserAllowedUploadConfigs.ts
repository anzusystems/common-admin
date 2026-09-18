import { cloneDeep, isUndefined } from '@/utils/common'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { defineAuth } from '@/composables/auth/defineAuth'
import type { AclValue } from '@/types/Permission'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'
import { SYSTEM_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

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

export function isImageWidgetUploadConfigAllowed(value: DamConfigLicenceExtSystemReturnType) {
  const { useCurrentUser } = defineAuth<AclValue>(SYSTEM_DAM)
  const { currentUser: damCurrentUser, isSuperAdmin: damCurrentUserIsSuperAdmin } =
    useCurrentUser<DamCurrentUserDto>(SYSTEM_DAM)

  if (damCurrentUserIsSuperAdmin.value) return true

  const currentUser = damCurrentUser.value
  if (isUndefined(currentUser)) return []

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
