import type { UserAdminConfig } from '@/types/UserAdminConfig.ts'
import { UserAdminConfigLayoutTypeDefault, UserAdminConfigTypeDefault } from '@/types/UserAdminConfig.ts'
import { dateTimeNow } from '@/utils/datetime.ts'

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
