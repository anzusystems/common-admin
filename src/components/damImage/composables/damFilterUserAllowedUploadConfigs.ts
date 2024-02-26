import { useDamCurrentUser } from '@/components/damImage/composables/damCurrentUser'
import { cloneDeep, isUndefined } from '@/utils/common'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'

export function filterAllowedImageWidgetSelectConfigs(values: DamConfigLicenceExtSystemReturnType[]) {
  const { damCurrentUser, damCurrentUserIsSuperAdmin } = useDamCurrentUser()
  if (damCurrentUserIsSuperAdmin.value) return cloneDeep(values)
  const currentUser = damCurrentUser.value
  if (isUndefined(currentUser)) return []

  const adminToExtSystems = currentUser.adminToExtSystems.map((extSystemValue) => extSystemValue.id)
  const assetLicences = currentUser.assetLicences.map((assetLicenceValue) => assetLicenceValue.id)
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
  const { damCurrentUser, damCurrentUserIsSuperAdmin } = useDamCurrentUser()
  if (damCurrentUserIsSuperAdmin.value) return true

  const currentUser = damCurrentUser.value
  if (isUndefined(currentUser)) return []

  const adminToExtSystems = currentUser.adminToExtSystems.map((extSystemValue) => extSystemValue.id)
  if (adminToExtSystems.includes(value.extSystem)) {
    return true
  }

  const assetLicences = currentUser.assetLicences.map((assetLicenceValue) => assetLicenceValue.id)
  if (assetLicences.includes(value.licence)) {
    return true
  }

  return false
}
