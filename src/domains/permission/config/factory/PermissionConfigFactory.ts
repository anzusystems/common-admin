import type { PermissionConfig } from '@/domains/permission/config/types/PermissionConfig'

export function usePermissionConfigFactory() {
  const createPermissionConfig = (): PermissionConfig => {
    return {
      config: {},
      defaultGrants: [],
      roles: [],
      translation: {
        actions: {},
        subjects: {},
        roles: {},
      },
    }
  }

  return {
    createPermissionConfig,
  }
}
