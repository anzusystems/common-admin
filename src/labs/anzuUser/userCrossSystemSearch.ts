import { computed } from 'vue'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { usePagination } from '@/labs/filters/pagination'
import { SortOrder } from '@/composables/system/datatableColumns'
import { useAnzuUserEmailLookupFilter } from '@/labs/anzuUser/anzuUserFilter'
import { CrossSystemPhase, useUserCrossSystemStore, type UserSystemResult } from '@/labs/anzuUser/userCrossSystemStore'
import type { AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import { useUserSystemProbe, type UserSystemRefreshHook } from '@/labs/anzuUser/userSystemProbe'
import {
  isAuthoritativelyAbsent,
  UserSystemAccess,
  UserSystemLoad,
  UserSystemPresence,
} from '@/labs/anzuUser/userSystemState'
import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'

export interface CrossSystemSearchParams {
  descriptors: AnyUserSystemDescriptor[]
  refreshHook?: UserSystemRefreshHook | undefined
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

export const isEmailTerm = (term: string): boolean => EMAIL_PATTERN.test(term.trim())

/**
 * The cross-system fan-out.
 *
 * No calls to the current-user endpoints go out at all: the buttons in a row are decided by the
 * probe's answer rather than by `<Acl>`, so there is nothing to load nine current users for. The
 * budget is nine calls when searching by id, eighteen when searching by e-mail.
 */
export const useUserCrossSystemSearch = (params: CrossSystemSearchParams) => {
  const store = useUserCrossSystemStore()
  const { descriptors, refreshHook } = params

  // One probe instance per system, built once: each keeps its own abort token, and rebuilding them
  // per search would lose the ability to invalidate what is still in flight.
  const probes = new Map(
    descriptors.map((descriptor) => [descriptor.system, useUserSystemProbe({ descriptor, refreshHook })])
  )

  /**
   * Every search gets a number. A late answer from the previous one is dropped rather than written
   * over the results of the search the operator is looking at now.
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
    // One row: an exact match either exists or does not, and asking for a page of them would only
    // cost the backend more.
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
      // The second round asks every system by id anyway, so a failure here is not a verdict about
      // that system -- it only means this round could not contribute an id.
      return null
    }
  }

  /**
   * Two rounds, and the first one must not lie while the second is still running.
   *
   * Between them a row is neither present nor absent: showing "no account here" in that window
   * would invite the operator to press Create for an account that does exist under another address.
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
      // The same address under two identities. Bulk actions stop here rather than guessing.
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
      // Nobody anywhere under this address. Every row is still unknown rather than absent: an
      // address search cannot prove absence, only an id search can.
      store.phase = CrossSystemPhase.Done
      return
    }

    await searchById(id)
  }

  /**
   * Runs the fan-out, and answers whether it ran at all.
   *
   * A term that is neither an address nor an id has to clear the screen rather than be ignored.
   * The rows left standing are live: their buttons and all three bulk actions write to
   * `resolvedId`, which is still the previous person, while the box above them now holds a name
   * that was never searched for. The plan expects this operator -- the one who knows only a
   * surname -- so the answer has to be an empty result, not the last one.
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

  /** Re-reads one system after a write, so the row stops showing what it showed before it. */
  const refreshSystem = async (system: string) => {
    const descriptor = descriptors.find((item) => item.system === system)
    const id = store.resolvedId
    if (!descriptor || id === null) return
    await runProbe(descriptor, id, generation)
  }

  const resultFor = (system: string): UserSystemResult | undefined => store.results.get(system)

  /**
   * Whether creating an account may be offered when nobody was found.
   *
   * Only when every relevant probe answered an authoritative 404. A 401, a 403 or a timeout means
   * the record could not be read, which is not the same as not existing -- and a duplicate identity
   * cannot be taken back.
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
