import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { emptyUserSystemAxes, type UserSystemAxes } from '@/domains/anzuUser/utils/userSystemState'
import type { AnzuUser } from '@/shared/types/AnzuUser'
import type { IntegerId, IntegerIdNullable } from '@/shared/types/common'

export interface UserSystemResult {
  axes: UserSystemAxes
  user: AnzuUser | null
}

export const CrossSystemPhase = {
  Idle: 'idle',
  /** First round of an e-mail search: find the person and their id. */
  MatchingEmail: 'matchingEmail',
  /** Second round: ask every system by that id, to catch the ones holding a different e-mail. */
  VerifyingById: 'verifyingById',
  Done: 'done',
} as const
export type CrossSystemPhaseType = (typeof CrossSystemPhase)[keyof typeof CrossSystemPhase]

export const BulkAction = {
  Enable: 'enable',
  Disable: 'disable',
  Metadata: 'metadata',
} as const
export type BulkActionType = (typeof BulkAction)[keyof typeof BulkAction]

export const BulkOutcome = {
  Pending: 'pending',
  Running: 'running',
  Done: 'done',
  Forbidden: 'forbidden',
  Unauthenticated: 'unauthenticated',
  NotFound: 'notFound',
  Invalid: 'invalid',
  Unavailable: 'unavailable',
} as const
export type BulkOutcomeType = (typeof BulkOutcome)[keyof typeof BulkOutcome]

export interface BulkLogEntry {
  system: string
  outcome: BulkOutcomeType
  /**
   * The run this line belongs to. The log survives so a retry keeps earlier successes.
   * Without these fields a retry could repeat the wrong action or target the person now on screen.
   */
  action: BulkActionType
  subjectId: IntegerIdNullable
  detail?: string
}

/** Kept in a store, not the dialog. The dialog can close while calls run, and the results must survive. */
export const useUserCrossSystemStore = defineStore('commonAdminUserCrossSystemStore', () => {
  const searchTerm = ref('')
  const resolvedId = ref<IntegerIdNullable>(null)
  const phase = ref<CrossSystemPhaseType>(CrossSystemPhase.Idle)
  const results = ref(new Map<string, UserSystemResult>())

  /**
   * The same e-mail answered with two ids. Bulk actions stop when set.
   * AnzuUser cannot be deleted, so writes under the wrong identity would persist.
   */
  const identityConflict = ref<Map<string, IntegerId> | null>(null)

  const bulkRunning = ref(false)
  const bulkAction = ref<BulkActionType | null>(null)
  const bulkSubjectId = ref<IntegerIdNullable>(null)
  const bulkLog = ref<BulkLogEntry[]>([])

  /** The term was neither an address nor an id, so nothing was asked and there is nothing to show. */
  const termRejected = ref(false)

  function resetResults() {
    results.value = new Map()
    resolvedId.value = null
    identityConflict.value = null
    phase.value = CrossSystemPhase.Idle
    termRejected.value = false
    // A new search is a new person. An old log's retry would write to the new `resolvedId`.
    bulkLog.value = []
    bulkAction.value = null
    bulkSubjectId.value = null
  }

  function setResult(system: string, result: UserSystemResult) {
    results.value.set(system, result)
  }

  function ensureResult(system: string) {
    if (!results.value.has(system)) {
      results.value.set(system, { axes: emptyUserSystemAxes(), user: null })
    }
  }

  function patchAxes(system: string, axes: UserSystemAxes) {
    ensureResult(system)
    const current = results.value.get(system)!
    results.value.set(system, { ...current, axes })
  }

  function setUser(system: string, user: AnzuUser | null) {
    ensureResult(system)
    const current = results.value.get(system)!
    results.value.set(system, { ...current, user })
  }

  /**
   * Starts a run over `systems`, keeping earlier log entries for the same action and account.
   * A retry runs a subset; clearing the log would erase earlier successes.
   */
  function startBulk(action: BulkActionType, systems: string[], subjectId: IntegerIdNullable) {
    bulkRunning.value = true
    bulkAction.value = action
    bulkSubjectId.value = subjectId
    const queued = new Set(systems)
    const kept = bulkLog.value.filter(
      (entry) => entry.action === action && entry.subjectId === subjectId && !queued.has(entry.system)
    )
    bulkLog.value = [...kept, ...systems.map((system) => ({ system, outcome: BulkOutcome.Pending, action, subjectId }))]
  }

  function setBulkEntry(system: string, outcome: BulkOutcomeType, detail?: string) {
    const index = bulkLog.value.findIndex(
      (entry) => entry.system === system && entry.action === bulkAction.value && entry.subjectId === bulkSubjectId.value
    )
    if (index === -1) return
    const entry: BulkLogEntry = { ...bulkLog.value[index]!, outcome, detail }
    bulkLog.value = bulkLog.value.map((old, i) => (i === index ? entry : old))
  }

  function finishBulk() {
    bulkRunning.value = false
  }

  /**
   * Clears the page for the next visit but keeps the bulk lock.
   * `cancel()` stops probes, not writes. Releasing the lock would allow a second
   * bulk action on the same account (B13). The run releases it when done.
   */
  function reset() {
    searchTerm.value = ''
    resetResults()
  }

  return {
    searchTerm,
    resolvedId,
    phase,
    results,
    identityConflict,
    bulkRunning,
    bulkAction,
    bulkSubjectId,
    bulkLog,
    termRejected,
    resetResults,
    setResult,
    patchAxes,
    setUser,
    startBulk,
    setBulkEntry,
    finishBulk,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUserCrossSystemStore, import.meta.hot))
}
