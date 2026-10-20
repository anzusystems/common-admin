import { cloneDeep, isArray, isObject, isUndefined } from '@/shared/utils/common'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import type { AclValue } from '@/domains/auth/types/Permission'
import type { DamCurrentUserDto } from '@/domains/dam/types/DamCurrentUser'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'

/** A current user as DAM gives it: what its licences are decided by. */
const isDamUser = (user: unknown): user is DamCurrentUserDto =>
  isObject(user) &&
  isArray((user as Partial<DamCurrentUserDto>).adminToExtSystems) &&
  isArray((user as Partial<DamCurrentUserDto>).userToExtSystems) &&
  isArray((user as Partial<DamCurrentUserDto>).resolvedAssetLicences)

/**
 * Who decides the licences under the configuration `configName`: `all` with `currentUser: false` or for an admin of
 * DAM, `none` while no user is loaded or when the loaded one is no user of DAM, else that user. The system is
 * `currentUser` of the configuration, `dam` by default. A user of another system is a configuration error: it is
 * written down, and no licence is allowed, before its roles are read (an admin of another system is no admin of DAM).
 */
const licenceJudgeOf = (configName: string): 'all' | 'none' | DamCurrentUserDto => {
  const system = useCommonAdminCoreDamOptions(configName).currentUser ?? SYSTEM_DAM
  if (system === false) return 'all'
  const { useCurrentUser } = defineAuth<AclValue>(system)
  const { currentUser, isSuperAdmin } = useCurrentUser<DamCurrentUserDto>(system)
  const user = currentUser.value
  if (isUndefined(user)) return 'none'
  if (!isDamUser(user)) {
    console.error(
      `commonAdmin: the current user of the system "${system}", which \`currentUser\` of the DAM configuration ` +
        `"${configName}" names, is no user of DAM: no licence is allowed.`
    )
    return 'none'
  }
  return isSuperAdmin.value ? 'all' : user
}

/** The licences the current user of the system `currentUser` of the configuration `configName` may pick from. */
export function filterAllowedImageWidgetSelectConfigs(
  values: DamConfigLicenceExtSystemReturnType[],
  configName: string
) {
  const currentUser = licenceJudgeOf(configName)
  if (currentUser === 'all') return cloneDeep(values)
  if (currentUser === 'none') return []

  // As the backend's licence voter: an admin or a user of the ext. system may use any of its licences.
  const extSystems = [...currentUser.adminToExtSystems, ...currentUser.userToExtSystems]
  const assetLicences = currentUser.resolvedAssetLicences.map((assetLicenceValue) => assetLicenceValue.id)
  const allowed: DamConfigLicenceExtSystemReturnType[] = []
  values.forEach((value) => {
    if (extSystems.includes(value.extSystem)) {
      allowed.push(value)
      return
    }
    if (assetLicences.includes(value.licence)) {
      allowed.push(value)
    }
  })
  return allowed
}

/** Whether the current user of the system `currentUser` of the configuration `configName` may upload into the licence. */
export function isImageWidgetUploadConfigAllowed(
  value: DamConfigLicenceExtSystemReturnType,
  configName: string
): boolean {
  const currentUser = licenceJudgeOf(configName)
  if (currentUser === 'all') return true
  if (currentUser === 'none') return false

  // As the backend's licence voter: an admin or a user of the ext. system may use any of its licences.
  if (
    currentUser.adminToExtSystems.includes(value.extSystem) ||
    currentUser.userToExtSystems.includes(value.extSystem)
  ) {
    return true
  }

  const assetLicences = currentUser.resolvedAssetLicences.map((assetLicenceValue) => assetLicenceValue.id)
  if (assetLicences.includes(value.licence)) {
    return true
  }

  return false
}
