import type { UserAdminConfig } from '@/domains/filters/bookmarks/types/UserAdminConfig'
import {
  UserAdminConfigLayoutTypeDefault,
  UserAdminConfigTypeDefault,
} from '@/domains/filters/bookmarks/types/UserAdminConfig'
import { dateTimeNow } from '@/shared/utils/datetime'

export function useUserAdminConfigFactory() {
  const createDefaultUserAdminConfig = (system: string): UserAdminConfig => {
    return {
      id: 0,
      user: 0,
      configType: UserAdminConfigTypeDefault,
      layoutType: UserAdminConfigLayoutTypeDefault,
      systemResource: '',
      customName: '',
      defaultConfig: false,
      data: [],
      position: 0,
      createdAt: dateTimeNow(),
      modifiedAt: dateTimeNow(),
      createdBy: null,
      modifiedBy: null,
      _resourceName: 'userAdminConfig',
      _system: system,
    }
  }

  return {
    createDefaultUserAdminConfig,
  }
}
