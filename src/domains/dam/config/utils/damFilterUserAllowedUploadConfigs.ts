import { cloneDeep, isArray, isObject, isUndefined } from '@/shared/utils/common'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import type { AclValue } from '@/domains/auth/types/Permission'
import type { DamCurrentUserDto } from '@/domains/dam/types/DamCurrentUser'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'

/** A current user as DAM returns it. Its licences are decided by it. */
const isDamUser = (user: unknown): user is DamCurrentUserDto =>
  isObject(user) &&
  isArray((user as Partial<DamCurrentUserDto>).adminToExtSystems) &&
  isArray((user as Partial<DamCurrentUserDto>).userToExtSystems) &&
  isArray((user as Partial<DamCurrentUserDto>).resolvedAssetLicences)

/**
 * Who decides the licences under `configName`.
 * `all` when `currentUser` is false or the user is a DAM admin. `none` while
 * no user is loaded or the user is not a DAM user. Otherwise the loaded user.
 * The system is the config's `currentUser`, `dam` by default. A user of another system is a config
 * error: it is logged and no licence is allowed. An admin of another system is not a DAM admin.
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

  // Matches the backend licence voter: an admin or user of the ext. system may use any of its licences.
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

/**
 * Whether the current user of the system `currentUser` of the configuration `configName` may upload into the licence.
 */
export function isImageWidgetUploadConfigAllowed(
  value: DamConfigLicenceExtSystemReturnType,
  configName: string
): boolean {
  const currentUser = licenceJudgeOf(configName)
  if (currentUser === 'all') return true
  if (currentUser === 'none') return false

  // Matches the backend licence voter: an admin or user of the ext. system may use any of its licences.
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
