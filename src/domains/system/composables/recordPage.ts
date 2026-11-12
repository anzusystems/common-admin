import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { type NavigationFailure, type RouteLocationRaw, type RouteRecordName, type Router, useRouter } from 'vue-router'
import { useAlerts } from '@/domains/system/composables/alerts'
import {
  forgetLeftAfterFailure,
  isLeftAfterFailureRecently,
  markLeftAfterFailure,
  useRouteHistory,
} from '@/domains/system/composables/routeHistory'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'
import { isAppNavigationPending, usePageNavigation } from '@/domains/system/composables/pageNavigation'
import { apiErrorStatus } from '@/domains/api/utils/apiErrors'
import { isAnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { isAnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { isInCauseChain } from '@/shared/error/isInCauseChain'
import { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_NOT_FOUND } from '@/shared/statusCodes'

/**
 * Shows why a record failed to load and returns whether its page should leave.
 * Only for the record's own get-one: a 404 or 403 there means the record is unavailable, unlike for secondary requests.
 * An aborted request or an expired session shows nothing and does not leave. Other errors show the
 * `showErrorsDefault` message and leave, since the page would show an empty record with live buttons.
 * While the user navigates elsewhere (`trackNavigation`) it shows nothing
 * and does not leave, because the message would stay on the next page.
 */
export const handleRecordLoadError = (error: unknown, duration = -1): boolean => {
  if (isAnzuApiCancelledError(error)) return false
  if (isInCauseChain(error, (cause) => cause instanceof SessionExpiredError)) return false
  if (isAppNavigationPending()) return true

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
   * Same as the page's Close button: the record's sibling views and the create form.
   * A route with the record's params is skipped only as that record's address, see `leave`.
   */
  skipRouteNames?: RouteRecordName[]
  /**
   * The page's loading flag. `leave` keeps it up so the empty record's buttons never show.
   * The page lowers it on unmount. The flag is often shared by all views of
   * the entity, and the next one (e.g. a create form) must not inherit it.
   */
  loading?: Ref<boolean>
  /**
   * The record's load, run on mount with the page's signal. `false` leaves the page, `true` and `undefined` keep it.
   * A load also called later is fine: `load: () => getData()`.
   * Omit it and write `onMounted` by hand when the page acts on
   * the result, loads in setup or makes more requests on mount.
   */
  load?: (signal: AbortSignal) => Promise<boolean | undefined>
}

export interface UseRecordPageReturn {
  /** For the record's get-one: stopped when the page unmounts. */
  signal: AbortSignal
  /** Back to where the user came from, else to the fallback. Resolves whether it got there. */
  leave: () => Promise<boolean>
  /** The user is still on this page and not navigating away: for a redirect after the load. */
  onPage: () => boolean
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

// `router.back()` returns nothing, so its landing or its error is the result.
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
 * For a detail or edit page: aborts the record's load when the page goes, and leaves the page when the load fails.
 * `false` from the loader means leave. `undefined` is a superseded or aborted load, and the page stays.
 * While the user navigates elsewhere (`trackNavigation`), the page does not
 * leave. If that navigation fails, the page stays with its loading flag up.
 * Not handled: a guard that refuses the step back can leave the address bar out of sync with the router.
 * @example
 * useRecordPage({ fallbackRouteName: '/x', skipRouteNames: [...],
 * loading: detailLoading, load: (signal) => fetchData(id, { signal }) })
 */
export function useRecordPage(options: UseRecordPageOptions = {}): UseRecordPageReturn {
  const router = useRouter()
  const { history } = useRouteHistory()
  const { preservePageForLanding } = useDatatablePageStore()
  const { onPage } = usePageNavigation()

  // The path, not the name: /x/1 and /x/2 share a name, and a late failure of one must not move the user off the other.
  const path = router.currentRoute.value.path
  // The page is visited again, so an earlier failure no longer counts.
  forgetLeftAfterFailure(path)
  const controller = new AbortController()
  let unmounted = false
  onBeforeUnmount(() => {
    unmounted = true
    controller.abort()
    // Raised by `leave`, or left up by the aborted load whose `finally` no longer owns it.
    // The next page mounts after this one is gone and raises it again for its own load.
    if (options.loading) options.loading.value = false
  })

  const stillHere = () => !unmounted && router.currentRoute.value.path === path

  // Unlike the Close button, which skips every entry with the record's route name, this
  // returns to the view the user came from, including another record of the same entity.
  // Only this record's addresses are skipped, compared without query and hash (a tab in the query is the same view).
  // The create form is skipped too: going back there, Save would create a second record.
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
      // Addresses left recently after a failure are skipped too.
      // Otherwise two failing records in the history (A, then B, backend down) send the
      // user back and forth for the whole outage. Skipped, the chain ends at the list.
      if (paths.has(pathOf(entry.fullPath)) || isLeftAfterFailureRecently(pathOf(entry.fullPath))) continue
      if (entry.name !== undefined && entry.name !== null && names.has(entry.name as RouteRecordName)) continue
      return entry.fullPath
    }
    return undefined
  }

  // Leaves no trace of the failed address: a step back when the target is the previous entry, a replace otherwise.
  // A push would let browser Back return to the failed page, which would fail and leave again.
  const go = async (to: RouteLocationRaw): Promise<boolean> => {
    let target: string
    try {
      target = router.resolve(to).fullPath
    } catch {
      return false
    }
    // Compared without the hash. A list filter writes the hash outside the
    // router, so `state.back` lacks it while the route history has it.
    // The filter keeps the list entry's `current` in sync, so the step back lands on the filter and adds no entry.
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
    // Stays up for good if the leave fails. The record is not loaded, and its Save and Delete buttons must not return.
    // The Close button, which no page ties to loading, is the way out then.
    if (options.loading) options.loading.value = true
    // The user is navigating to another page. That navigation decides, and ours would cancel it.
    if (!onPage()) return false
    markLeftAfterFailure(path)
    const target = findTarget()
    if (target !== undefined && (await go(target))) return true
    if (!stillHere() || !onPage() || options.fallbackRouteName === undefined) return false
    return go({ name: options.fallbackRouteName, params: options.fallbackRouteParams })
  }

  const { load } = options
  if (load) {
    onMounted(async () => {
      if ((await load(controller.signal)) === false) await leave()
    })
  }

  return { signal: controller.signal, leave, onPage }
}
