import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { usePermissionConfigFactory } from '@/domains/permission/config/factory/PermissionConfigFactory'
import type { PermissionConfig } from '@/domains/permission/config/types/PermissionConfig'

/**
 * One entry per system. Shared `loading` and `initialized` flags break with parallel fetches.
 * The first fetch to finish would clear the flag for all, and a failure without `finally` would leave it set forever.
 */
export interface PermissionConfigEntry {
  config: PermissionConfig
  loading: boolean
  initialized: boolean
}

export const usePermissionConfigStore = defineStore('commonAdminPermissionConfigStore', () => {
  const { createPermissionConfig } = usePermissionConfigFactory()

  const entries = ref(new Map<string, PermissionConfigEntry>())

  const emptyEntry = (): PermissionConfigEntry => ({
    config: createPermissionConfig(),
    loading: false,
    initialized: false,
  })

  /**
   * Never returns undefined, so a template can read `.config` before the first fetch.
   * The empty config is a fresh object per call. The editor writes into
   * it, so a shared constant would be shared across unanswered systems.
   */
  function getEntry(system: string): PermissionConfigEntry {
    return entries.value.get(system) ?? emptyEntry()
  }

  function setLoading(system: string, loading: boolean) {
    const entry = entries.value.get(system) ?? emptyEntry()
    entries.value.set(system, { ...entry, loading })
  }

  function setConfig(system: string, config: PermissionConfig) {
    const entry = entries.value.get(system) ?? emptyEntry()
    entries.value.set(system, { ...entry, config, initialized: true })
  }

  /**
   * Drops one system, leaving the others loaded. Used when a system's client is swapped out.
   */
  function resetSystem(system: string) {
    entries.value.delete(system)
  }

  function reset() {
    entries.value = new Map()
  }

  return {
    entries,
    getEntry,
    setLoading,
    setConfig,
    resetSystem,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePermissionConfigStore, import.meta.hot))
}
