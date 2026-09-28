import { reloadPage } from '@/domains/system/systemBar/utils/pageReload'
import { useSystemBar } from '@/domains/system/systemBar/composables/systemBar'

const RELOAD_KEY = 'anzu.appReloadAt'
const RELOAD_COOLDOWN = 30_000
/** How long a navigation waits for a reload to commit before it is aborted. */
export const RELOAD_VETO_GRACE = 3_000

let reloadRequested = false

/**
 * Reloads the page, at most once per `RELOAD_COOLDOWN`, so a reload that does not take cannot loop.
 * Answers whether a reload is under way; `onReload` runs once per reload, while the document can
 * still put a request on the wire.
 */
export function requestAppReload(onReload?: () => void): boolean {
  if (reloadRequested) return true
  try {
    const lastReload = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    if (Date.now() - lastReload < RELOAD_COOLDOWN) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // no stamp, no loop guard - better than a dead tab
  }
  reloadRequested = true
  // a beforeunload handler can veto the reload
  setTimeout(() => {
    reloadRequested = false
  }, RELOAD_VETO_GRACE)
  onReload?.()
  reloadPage()
  return true
}

/**
 * Reloads when `ASystemBar` has seen a new `appVersion` in `config.json`. For a route guard: answers
 * whether a reload is under way, and the guard then parks the navigation for `RELOAD_VETO_GRACE`.
 */
export function checkForNewVersion(): boolean {
  const { newVersion } = useSystemBar()
  if (!newVersion.value) return false
  return requestAppReload()
}
