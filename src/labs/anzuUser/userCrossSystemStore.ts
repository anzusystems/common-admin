import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { emptyUserSystemAxes, type UserSystemAxes } from '@/labs/anzuUser/userSystemState'
import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerId, IntegerIdNullable } from '@/types/common'

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
   * Which run the line belongs to.
   *
   * The log survives a run so that a retry does not erase the systems that succeeded a minute ago,
   * and the retry button acts on whatever the log calls failed. Without these two fields a failed
   * metadata write would be retried as a disable, and a previous person's failures would be retried
   * against the id currently on screen -- neither `setEnabled` nor `writeMetadata` can tell it is
   * being asked about a different action or a different account.
   */
  action: BulkActionType
  subjectId: IntegerIdNullable
  detail?: string
}

/**
 * Search results and the bulk run live here, not inside the dialog's component.
 *
 * The dialog can be closed while the calls are still going -- one dead backend running into its
 * timeout must not lock the screen -- and state owned by the component would be thrown away with
 * it. The results stay on the page either way.
 */
export const useUserCrossSystemStore = defineStore('labsUserCrossSystemStore', () => {
  const searchTerm = ref('')
  const resolvedId = ref<IntegerIdNullable>(null)
  const phase = ref<CrossSystemPhaseType>(CrossSystemPhase.Idle)
  const results = ref(new Map<string, UserSystemResult>())

  /**
   * The same e-mail answered with two different ids.
   *
   * Bulk actions stop when this is set. Picking the first one quietly would have every later
   * fan-out follow the wrong identity, and since no admin can delete an AnzuUser, anything written
   * under it stays.
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
    // A new search is a new person. Leaving the log behind would put the previous one's failures on
    // screen under a live retry button, and that retry writes to `resolvedId` -- somebody else by
    // then.
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
   * Opens a run over `systems`, keeping what the same run already said about the others.
   *
   * The retry is why anything is kept at all: "try the failed ones again" runs a subset, and
   * resetting the whole log would erase the systems that succeeded a minute ago, so a partial
   * success would read as if it had never happened. What is kept is scoped to this action and this
   * account, because everything else in the log belongs to a run the operator is no longer looking
   * at.
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
   * What leaving the page does: nobody on screen for the next visit.
   *
   * `resetResults` already drops the log and which run it was for. The lock it deliberately leaves:
   * a run still writing goes on after the page is gone -- `cancel()` stops the probes, not the
   * writes -- and releasing it would let a second bulk action start against the same account while
   * the first is unfinished (B13). The run releases it itself when it ends.
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
