import { computed } from 'vue'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { usePagination } from '@/domains/api/composables/pagination'
import { SortOrder } from '@/domains/api/types/SortOrder'
import { useAnzuUserEmailLookupFilter } from '@/domains/anzuUser/filter/anzuUserFilter'
import {
  CrossSystemPhase,
  useUserCrossSystemStore,
  type UserSystemResult,
} from '@/domains/anzuUser/store/userCrossSystemStore'
import type { AnyUserSystemDescriptor } from '@/domains/anzuUser/composables/userSystemDescriptor'
import { useUserSystemProbe, type UserSystemRefreshHook } from '@/domains/anzuUser/composables/userSystemProbe'
import {
  isAuthoritativelyAbsent,
  UserSystemAccess,
  UserSystemLoad,
  UserSystemPresence,
} from '@/domains/anzuUser/utils/userSystemState'
import type { AnzuUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'

export interface CrossSystemSearchParams {
  descriptors: AnyUserSystemDescriptor[]
  refreshHook?: UserSystemRefreshHook | undefined
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

export const isEmailTerm = (term: string): boolean => EMAIL_PATTERN.test(term.trim())

/**
 * The cross-system fan-out.
 * No current-user endpoints are called, because row buttons depend on the
 * probe's answer, not `<Acl>`. Budget: nine calls by id, eighteen by e-mail.
 */
export const useUserCrossSystemSearch = (params: CrossSystemSearchParams) => {
  const store = useUserCrossSystemStore()
  const { descriptors, refreshHook } = params

  // One probe per system, built once. Each keeps its own abort token, and
  // rebuilding per search would lose the ability to invalidate in-flight requests.
  const probes = new Map(
    descriptors.map((descriptor) => [descriptor.system, useUserSystemProbe({ descriptor, refreshHook })])
  )

  /**
   * Each search gets a number. A late answer from an older search
   * is dropped instead of overwriting the current results.
   */
  let generation = 0

  const cancel = () => {
    generation++
    probes.forEach((probe) => probe.cancel())
  }

  const runProbe = async (descriptor: AnyUserSystemDescriptor, id: IntegerId, token: number) => {
    const probe = probes.get(descriptor.system)
    if (!probe) return
    store.patchAxes(descriptor.system, { ...probe.axes.value, load: UserSystemLoad.Loading })
    await probe.probe(id)
    if (token !== generation) return
    store.setResult(descriptor.system, { axes: probe.axes.value, user: probe.user.value })
  }

  /** Results are written as they arrive, never through `Promise.all`: one dead backend must not hold up the rest. */
  const searchById = async (id: IntegerId) => {
    const token = ++generation
    store.resetResults()
    store.resolvedId = id
    store.phase = CrossSystemPhase.VerifyingById
    await Promise.allSettled(descriptors.map((descriptor) => runProbe(descriptor, id, token)))
    if (token !== generation) return
    store.phase = CrossSystemPhase.Done
  }

  /** Exact match, `filter_eq[email]`, one row. `startsWith` would match a different person. */
  const lookupByEmail = async (descriptor: AnyUserSystemDescriptor, email: string): Promise<AnzuUser | null> => {
    if (!descriptor.isEnabled()) return null
    const { filterData, filterConfig } = useAnzuUserEmailLookupFilter()
    filterData.email = email
    // One row is enough: an exact match either exists or does not.
    const { pagination } = usePagination('id', SortOrder.Desc, { rowsPerPage: 1 })

    const { execute } = useApiFetchList<AnzuUser>({
      client: descriptor.client,
      system: descriptor.system,
      entity: descriptor.entity,
      urlTemplate: descriptor.endpoints.list,
    })

    try {
      const rows = await execute(pagination, filterData, filterConfig)
      return rows[0] ?? null
    } catch {
      // The second round asks every system by id anyway.
      // A failure here only means this round found no id. It is not a verdict about the system.
      return null
    }
  }

  /**
   * Two rounds. Between them a row is neither present nor absent.
   * Showing "no account here" in that window would invite Create for an account that exists under another address.
   */
  const searchByEmail = async (email: string) => {
    const token = ++generation
    store.resetResults()
    store.phase = CrossSystemPhase.MatchingEmail

    const found = await Promise.all(
      descriptors.map(async (descriptor) => ({
        system: descriptor.system,
        user: await lookupByEmail(descriptor, email),
      }))
    )
    if (token !== generation) return

    const ids = new Map<string, IntegerId>()
    for (const row of found) {
      if (row.user?.id) ids.set(row.system, row.user.id)
    }

    const distinctIds = new Set(ids.values())
    if (distinctIds.size > 1) {
      // The same address under two identities. Bulk actions stop here instead of guessing.
      store.identityConflict = ids
      store.phase = CrossSystemPhase.Done
      for (const row of found) {
        if (!row.user) continue
        store.setResult(row.system, {
          axes: {
            load: UserSystemLoad.Loaded,
            presence: UserSystemPresence.Present,
            access: UserSystemAccess.Ok,
            enabled: row.user.enabled,
          },
          user: row.user,
        })
      }
      return
    }

    const id = distinctIds.values().next().value
    if (id === undefined) {
      // Rows stay unknown, not absent. An address search cannot prove absence, only an id search can.
      store.phase = CrossSystemPhase.Done
      return
    }

    await searchById(id)
  }

  /**
   * Runs the fan-out and returns whether it ran.
   * A term that is neither an address nor an id clears the results.
   * Stale rows stay live: their buttons and bulk actions write to `resolvedId`, the previous person.
   */
  const search = async (term: string): Promise<boolean> => {
    const trimmed = term.trim()
    if (trimmed.length === 0) return false
    store.searchTerm = trimmed
    if (isEmailTerm(trimmed)) {
      await searchByEmail(trimmed)
      return true
    }
    const id = Number(trimmed)
    if (!Number.isInteger(id) || id <= 0) {
      cancel()
      store.resetResults()
      store.termRejected = true
      return false
    }
    await searchById(id)
    return true
  }

  /** Re-reads one system after a write so the row shows the new state. */
  const refreshSystem = async (system: string) => {
    const descriptor = descriptors.find((item) => item.system === system)
    const id = store.resolvedId
    if (!descriptor || id === null) return
    await runProbe(descriptor, id, generation)
  }

  const resultFor = (system: string): UserSystemResult | undefined => store.results.get(system)

  /**
   * Create is offered only when every relevant probe answered an authoritative 404.
   * A 401, 403 or timeout means the record could not be read, not that it is missing.
   * A duplicate identity cannot be undone.
   */
  const unresolvedSystems = computed(() =>
    descriptors
      .filter((descriptor) => descriptor.isEnabled())
      .filter((descriptor) => {
        const result = store.results.get(descriptor.system)
        return result === undefined || !isAuthoritativelyAbsent(result.axes)
      })
      .map((descriptor) => descriptor.system)
  )

  return {
    search,
    searchById,
    searchByEmail,
    refreshSystem,
    resultFor,
    unresolvedSystems,
    cancel,
  }
}
