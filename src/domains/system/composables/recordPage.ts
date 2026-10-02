import { onBeforeUnmount, type Ref } from 'vue'
import { type NavigationFailure, type RouteLocationRaw, type RouteRecordName, type Router, useRouter } from 'vue-router'
import { useAlerts } from '@/domains/system/composables/alerts'
import {
  forgetLeftAfterFailure,
  isLeftAfterFailureRecently,
  markLeftAfterFailure,
  useRouteHistory,
} from '@/domains/system/composables/routeHistory'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'
import { apiErrorStatus } from '@/domains/api/utils/apiErrors'
import { isAnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { isAnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { isInCauseChain } from '@/shared/error/isInCauseChain'
import { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_NOT_FOUND } from '@/shared/statusCodes'

/**
 * Shows why a record could not be loaded and says whether its page should leave.
 *
 * For the record's own get-one, not for what a page loads around it: a 404 or 403 there means the
 * record is not there for this user, a 404 of a secondary request does not. A request that was
 * stopped (the page is gone) and a session found expired (the logout is already loading) show
 * nothing and do not leave. Everything else -- a 5xx, the network, a timeout, the sign-in server --
 * shows the message `showErrorsDefault` has for it and leaves too: the page would only show an
 * empty record with live buttons.
 */
export const handleRecordLoadError = (error: unknown, duration = -1): boolean => {
  if (isAnzuApiCancelledError(error)) return false
  if (isInCauseChain(error, (cause) => cause instanceof SessionExpiredError)) return false

  const { showErrorT, showErrorsDefault, showUnknownError } = useAlerts()
  const status = apiErrorStatus(error)
  // A rejected 403 is `AnzuApiForbiddenError`, which carries no status; one let through by
  // `validateStatus` is a response code error that does.
  if (isAnzuApiForbiddenError(error) || status === HTTP_STATUS_FORBIDDEN) {
    showErrorT('common.alert.recordForbidden', duration)
    return true
  }
  if (status === HTTP_STATUS_NOT_FOUND) {
    showErrorT('common.alert.recordNotFound', duration)
    return true
  }
  if (!showErrorsDefault(error, duration)) showUnknownError(duration)
  return true
}

export interface UseRecordPageOptions {
  /** Where to go when nothing in the history is a destination: the entity's list. */
  fallbackRouteName?: RouteRecordName
  fallbackRouteParams?: Record<string, any>
  /**
   * What the page gives its Close button: the record's sibling views and the create form. A route
   * with the record's params is skipped as that record's address only, see `leave`.
   */
  skipRouteNames?: RouteRecordName[]
  /**
   * The page's loading flag. `leave` holds it up, so the empty record's buttons never show, and the
   * page lowers it as it unmounts: the flag is often shared by every view of the entity, and the
   * next one -- a create form that loads nothing -- must not inherit it.
   */
  loading?: Ref<boolean>
}

export interface UseRecordPageReturn {
  /** For the record's get-one: stopped when the page unmounts. */
  signal: AbortSignal
  /** Back to where the user came from, else to the fallback. Resolves whether it got there. */
  leave: () => Promise<boolean>
}

const pathOf = (fullPath: string) => fullPath.split(/[?#]/, 1)[0] ?? fullPath
const withoutHash = (fullPath: string) => fullPath.split('#', 1)[0] ?? fullPath

// A param's name, its custom regex (whose `)` may be escaped) and its modifier: `?` and `*` make it optional.
const PATH_PARAM = /:(\w+)(?:\((?:\\.|[^\\)])*\))?([?*+])?/g

const paramsOf = (router: Router, name: RouteRecordName) => {
  const record = router.getRoutes().find((route) => route.name === name)
  if (!record) return undefined
  return [...record.path.matchAll(PATH_PARAM)].map((match) => ({
    key: match[1]!,
    optional: match[2] === '?' || match[2] === '*',
  }))
}

// `router.back()` answers nothing; its landing, or its error, is the answer.
const waitForLanding = (router: Router) =>
  new Promise<boolean>((resolve) => {
    const done = (landed: boolean) => {
      stopAfterEach()
      stopError()
      resolve(landed)
    }
    const stopAfterEach = router.afterEach((_to, _from, failure) => done(!failure))
    const stopError = router.onError(() => done(false))
  })

const settled = (navigation: Promise<NavigationFailure | void | undefined>) =>
  navigation.then(
    (failure) => !failure,
    () => false
  )

/**
 * For a detail or edit page: aborts the record's load when the page goes, and leaves the page when
 * the load fails.
 *
 * ```ts
 * const { signal, leave } = useRecordPage({ fallbackRouteName: '/x', skipRouteNames: [...], loading: detailLoading })
 * onMounted(async () => {
 *   if ((await fetchData(id, { signal })) === false) await leave()
 * })
 * ```
 *
 * `false` from the loader means "leave"; `undefined` is a load that was superseded or stopped on
 * purpose, after which the page stays.
 *
 * Not handled: a navigation the user started that is still pending (an async guard, a lazy chunk)
 * is cancelled by the leave; a guard that refuses the step back can leave the address bar out of
 * step with the router.
 */
export function useRecordPage(options: UseRecordPageOptions = {}): UseRecordPageReturn {
  const router = useRouter()
  const { history } = useRouteHistory()
  const { preservePageForLanding } = useDatatablePageStore()

  // The path, not the name: /x/1 and /x/2 share a name, and a late failure of the one must not move
  // the user off the other.
  const path = router.currentRoute.value.path
  // On it again: a failure there before no longer counts.
  forgetLeftAfterFailure(path)
  const controller = new AbortController()
  let unmounted = false
  onBeforeUnmount(() => {
    unmounted = true
    controller.abort()
    // Raised by `leave`, or left up by the load just aborted, whose `finally` no longer owns it. The
    // next page mounts after this one is gone and raises it again for its own load.
    if (options.loading) options.loading.value = false
  })

  const stillHere = () => !unmounted && router.currentRoute.value.path === path

  // Unlike the Close button, which skips every entry with the record's route name so that closing
  // one row never opens another, this goes back to the view the user actually came from -- another
  // record of the same entity included. Only the addresses of THIS record are skipped, compared
  // without query and hash (a tab in the query is the same view), plus the create form the record
  // may have been saved from: back there, Save would create a second record.
  const skipped = () => {
    const current = router.currentRoute.value
    const paths = new Set<string>([pathOf(current.fullPath)])
    const names = new Set<RouteRecordName>()
    for (const name of options.skipRouteNames ?? []) {
      const declared = paramsOf(router, name)
      if (!declared) continue
      // A route without params is one address; one the record cannot fill is skipped by name.
      if (declared.length === 0 || declared.some(({ key, optional }) => !optional && !(key in current.params))) {
        names.add(name)
        continue
      }
      const params = Object.fromEntries(
        declared.filter(({ key }) => key in current.params).map(({ key }) => [key, current.params[key]])
      )
      try {
        paths.add(pathOf(router.resolve({ name, params }).fullPath))
      } catch {
        names.add(name)
      }
    }
    return { paths, names }
  }

  const findTarget = (): string | undefined => {
    const { paths, names } = skipped()
    for (let i = history.value.length - 1; i >= 0; i--) {
      const entry = history.value[i]!
      // An address a page just left after a failure is no destination either: two failing records
      // next to each other in the history -- A, then B, while the backend is down -- would send the
      // user back and forth for as long as the outage lasts, B leaving to A, which finds B as its
      // newest entry. Skipped, the chain ends at the list.
      if (paths.has(pathOf(entry.fullPath)) || isLeftAfterFailureRecently(pathOf(entry.fullPath))) continue
      if (entry.name !== undefined && entry.name !== null && names.has(entry.name as RouteRecordName)) continue
      return entry.fullPath
    }
    return undefined
  }

  // Leaves no trace of the failed address: a step back when the target is the entry right before
  // it, a replace otherwise -- a push would let the browser's Back return to the page that just
  // failed, which would fail and leave again.
  const go = async (to: RouteLocationRaw): Promise<boolean> => {
    let target: string
    try {
      target = router.resolve(to).fullPath
    } catch {
      return false
    }
    // Without the hash: a list's filter writes it under the router, so the record's `state.back`
    // names the list without it, while the route history has it. The filter also keeps the list
    // entry's `current` in step, so the step back lands on the filter, and adds no entry.
    const back = router.options.history.state.back
    if (typeof back === 'string' && withoutHash(back) === withoutHash(target)) {
      const landing = waitForLanding(router)
      preservePageForLanding(router)
      router.back()
      return landing
    }
    const navigation = router.replace(to)
    preservePageForLanding(router, { to, navigation })
    return settled(navigation)
  }

  const leave = async (): Promise<boolean> => {
    if (!stillHere()) return false
    // Held up for good on a leave that fails: the record is not loaded, and its buttons -- Save
    // creating a new record, Delete with the address's id -- must not come back. The Close button,
    // which no page ties to loading, is the way out then.
    if (options.loading) options.loading.value = true
    markLeftAfterFailure(path)
    const target = findTarget()
    if (target !== undefined && (await go(target))) return true
    if (!stillHere() || options.fallbackRouteName === undefined) return false
    return go({ name: options.fallbackRouteName, params: options.fallbackRouteParams })
  }

  return { signal: controller.signal, leave }
}
