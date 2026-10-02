import { START_LOCATION, type Router } from 'vue-router'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useSentry } from '@/domains/system/composables/sentry'
import { requestAppReload } from '@/domains/system/systemBar/utils/appReload'

export interface NavigationErrorHandlerOptions {
  /** Runs first on every failure, e.g. to drop an admin's navigation-pending overlay. */
  onError?: (error: unknown) => void
  /**
   * The very first navigation failed, so nothing but the start-up loader is on screen. Called once per
   * handler. Without it -- and after it -- the page is reloaded, and the message stays up when that is
   * not possible.
   */
  onFirstNavigationError?: (error: unknown) => void
  /**
   * `false` for an admin whose page holds work a reload would lose (DAM's running uploads): a chunk that
   * does not load then shows the message instead of reloading. Defaults to `true`.
   */
  reloadOnChunkError?: boolean
}

// What the browsers say when a route's chunk cannot be fetched (Chromium, Safari, Firefox), and what
// Vite says when the route's stylesheet, loaded before its code, cannot be.
const CHUNK_LOAD_MESSAGE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i

const isChunkLoadError = (error: unknown) =>
  error instanceof Error && (error.name === 'ChunkLoadError' || CHUNK_LOAD_MESSAGE.test(error.message))

// An admin's callback must not throw out of the handler: vue-router would skip the error listeners
// after this one, `useRecordPage`'s among them.
const safely = (callback: ((error: unknown) => void) | undefined, error: unknown): boolean => {
  try {
    callback?.(error)
    return true
  } catch (callbackError) {
    console.error(callbackError)
    return false
  }
}

/**
 * For `router.onError`: a navigation that throws -- a guard raising, a route's chunk that does not
 * load -- otherwise only reaches the console, and the click does nothing the user can see.
 *
 * A chunk that does not load is usually an old tab after a deploy: the page is reloaded, at most
 * once per 30 s, and gets the new one. Anything else shows "the page could not be opened".
 */
export const createNavigationErrorHandler = (router: Router, options: NavigationErrorHandlerOptions = {}) => {
  // Once: a callback that sends the user to an error page would otherwise be called again when that
  // page fails as well.
  let firstNavigationHandled = false

  return (error: unknown) => {
    safely(options.onError, error)
    useSentry('router').logError(error instanceof Error ? error : new Error(String(error)))

    if (options.reloadOnChunkError !== false && isChunkLoadError(error) && requestAppReload()) return

    if (router.currentRoute.value === START_LOCATION) {
      if (options.onFirstNavigationError && !firstNavigationHandled) {
        firstNavigationHandled = true
        // One that throws has not left the loader: the reload or the message below still has to.
        if (safely(options.onFirstNavigationError, error)) return
      }
      if (requestAppReload()) return
      // Nothing but the start-up loader is on screen and the reload was just tried: the message stays.
      useAlerts().showErrorT('common.alert.navigationFailed', -1)
      return
    }

    useAlerts().showErrorT('common.alert.navigationFailed')
  }
}
