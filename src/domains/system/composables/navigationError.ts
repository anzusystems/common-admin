import { START_LOCATION, type Router } from 'vue-router'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useSentry } from '@/domains/system/composables/sentry'
import { requestAppReload } from '@/domains/system/systemBar/utils/appReload'

export interface NavigationErrorHandlerOptions {
  /** Runs first on every failure, e.g. to drop an admin's navigation-pending overlay. */
  onError?: (error: unknown) => void
  /**
   * The very first navigation failed, so only the start-up loader is on screen. Called once per handler.
   * Without it, and after it, the page is reloaded. The message stays up when a reload is not possible.
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
 * For `router.onError`. A navigation that throws (a guard error,
 * a chunk that does not load) otherwise only reaches the console.
 * A failed chunk is usually an old tab after a deploy: the page reloads, at most once per 30 s.
 * Anything else shows "the page could not be opened".
 */
export const createNavigationErrorHandler = (router: Router, options: NavigationErrorHandlerOptions = {}) => {
  // Runs once. Otherwise a callback that redirects to an error page runs again when that page fails too.
  let firstNavigationHandled = false

  return (error: unknown) => {
    safely(options.onError, error)
    useSentry('router').logError(error instanceof Error ? error : new Error(String(error)))

    if (options.reloadOnChunkError !== false && isChunkLoadError(error) && requestAppReload()) return

    if (router.currentRoute.value === START_LOCATION) {
      if (options.onFirstNavigationError && !firstNavigationHandled) {
        firstNavigationHandled = true
        // A callback that throws has not cleared the loader. The reload or the message below must still run.
        if (safely(options.onFirstNavigationError, error)) return
      }
      if (requestAppReload()) return
      // Only the start-up loader is on screen and the reload was just tried, so the message stays.
      useAlerts().showErrorT('common.alert.navigationFailed', -1)
      return
    }

    useAlerts().showErrorT('common.alert.navigationFailed')
  }
}
