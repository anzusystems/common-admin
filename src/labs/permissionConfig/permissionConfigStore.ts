import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { usePermissionConfigFactory } from '@/model/factory/PermissionConfigFactory'
import type { PermissionConfig } from '@/types/PermissionConfig'

/**
 * One entry per system. The admins this replaces kept `loading` and `initialized` as two module
 * booleans shared by every system they fetched, which is wrong the moment the fetches run in
 * parallel: the first one to finish cleared the flag for all of them, and the first one to fail
 * left it set forever because there was no `finally`.
 */
export interface PermissionConfigEntry {
  config: PermissionConfig
  loading: boolean
  initialized: boolean
}

export const usePermissionConfigStore = defineStore('labsPermissionConfigStore', () => {
  const { createPermissionConfig } = usePermissionConfigFactory()

  const entries = ref(new Map<string, PermissionConfigEntry>())

  const emptyEntry = (): PermissionConfigEntry => ({
    config: createPermissionConfig(),
    loading: false,
    initialized: false,
  })

  /**
   * Never returns undefined, so a template can read `.config` before the first fetch lands. The
   * empty config is a fresh object per call rather than a shared constant: the editor writes into
   * what it is handed, and one frozen blank would be shared by every system that has not answered.
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

  /** Drops one system, leaving the others loaded. Used when a system's client is swapped out. */
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
