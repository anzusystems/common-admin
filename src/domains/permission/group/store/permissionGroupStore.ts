import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { usePermissionGroupFactory } from '@/domains/permission/group/factory/PermissionGroupFactory'
import type { PermissionGroup } from '@/domains/permission/group/types/PermissionGroup'

/**
 * A single open group, not a map keyed by system.
 *
 * Decision 9 of the plan: one system is one route and one view, and there is no cross-system view
 * of permission groups at all. Only one group is ever open, so a per-system map would be state
 * nothing reads -- unlike the config store next door, which really is asked about several systems
 * at once by the cross-system user pages.
 */
export const usePermissionGroupOneStore = defineStore('commonAdminPermissionGroupOneStore', () => {
  const { createPermissionGroup } = usePermissionGroupFactory()

  const permissionGroup = ref<PermissionGroup>(createPermissionGroup())
  const loadingPermissionGroup = ref(false)

  function setPermissionGroup(newPermissionGroup: PermissionGroup) {
    permissionGroup.value = newPermissionGroup
  }

  function setLoadingPermissionGroup(loading: boolean) {
    loadingPermissionGroup.value = loading
  }

  function reset() {
    permissionGroup.value = createPermissionGroup()
    loadingPermissionGroup.value = false
  }

  return {
    permissionGroup,
    loadingPermissionGroup,
    setPermissionGroup,
    setLoadingPermissionGroup,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePermissionGroupOneStore, import.meta.hot))
}
