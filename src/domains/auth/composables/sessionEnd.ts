import { readonly, ref } from 'vue'

const SESSION_CHANNEL = 'anzu-session'
const SESSION_ENDED = 'session-ended'
const SESSION_STARTED = 'session-started'
// A tab told of a sign-out waits this long for the session cookies to go: the sign-out request of the other tab
// is still on its way. They stay when the user signs in again meanwhile, and then the tab stays too.
const SESSION_END_WAIT_MS = 10_000
const SESSION_END_POLL_MS = 200
// The browser's prompt about unsaved changes holds `logout()` until the user answers. A page still here this long
// after it was kept by the user, or its sign-out page did not load.
const SESSION_END_STAY_MS = 1500
// They start or end the session themselves.
const AUTH_PATHS: readonly string[] = ['/login', '/logout']

interface SessionEnd {
  key: string | null
  logout: () => void
  stayTimer?: ReturnType<typeof setTimeout>
}

// From the end of a session until it comes back. This page has been sent to the sign-out once already.
let end: SessionEnd | undefined
const stayed = ref(false)
let watchedSessionKey: (() => string | null) | undefined

const openChannel = (): BroadcastChannel | undefined =>
  typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(SESSION_CHANNEL)

const post = (type: string) => {
  const channel = openChannel()
  channel?.postMessage({ type })
  channel?.close()
}

const onPageHide = () => clearTimeout(end?.stayTimer)

/** Tells the other tabs of this admin (its origin) that its session ends. `ALogoutView` sends it. */
export function broadcastSessionEnd(): void {
  post(SESSION_ENDED)
}

/**
 * The session is gone: sends this page to `logout`, once until the session comes back, whoever asks
 * (the request interceptor, a 401, another tab). A page the user keeps at the browser's prompt about
 * unsaved changes shows the bar of `useSessionEnd` instead, and its requests fail until a new sign-in.
 * `key` is the session that ended (see `watchSessionEnd`), to tell a new sign-in from it.
 */
export function endSession(logout: () => void, key: string | null = watchedSessionKey?.() ?? null): void {
  if (end) return
  const current: SessionEnd = { key, logout }
  end = current
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide, { once: true })
  logout()
  if (end !== current) return
  current.stayTimer = setTimeout(() => {
    if (end === current) stayed.value = true
  }, SESSION_END_STAY_MS)
}

/**
 * Whether the session works: it has not ended here, or `key` is a new sign-in since, which hides the bar.
 * `null` means no session.
 */
export function sessionLive(key: string | null): boolean {
  if (!end) return true
  if (key === null || key === end.key) return false
  clearTimeout(end.stayTimer)
  end = undefined
  stayed.value = false
  return true
}

/** For tests: forgets an ended session. */
export function resetSessionEnd(): void {
  clearTimeout(end?.stayTimer)
  end = undefined
  stayed.value = false
}

/**
 * `sessionEnded`: the session ended and the user kept this page for its unsaved changes. `ASystemBar` shows it.
 * `leave`: sends the page to the sign-out after all.
 */
export function useSessionEnd() {
  return {
    sessionEnded: readonly(stayed),
    leave: () => end?.logout(),
  }
}

/**
 * Sends this tab to `logout` (through `endSession`) once its session has ended elsewhere: right away when another
 * tab of this admin signs out (`broadcastSessionEnd`), and when the tab comes back (shown, focused, restored from
 * the back-forward cache) with the session gone. Brings a kept page back when a new sign-in shows: another tab of
 * this admin tells it, or the cookies have changed when the tab comes back. Reads only the cookies, no request.
 * The sign-in and sign-out pages never react. `createRefreshRequestInterceptor` starts it. Returns a function that
 * stops it.
 */
export function watchSessionEnd(options: {
  /** The session the cookies hold now, `null` without one. A new sign-in gives another value. */
  sessionKey: () => string | null
  logout: () => void
}): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined
  watchedSessionKey = options.sessionKey
  let waiting: ReturnType<typeof setInterval> | undefined

  const stopWaiting = () => {
    clearInterval(waiting)
    waiting = undefined
  }
  const onAuthPage = () => AUTH_PATHS.includes(window.location.pathname)
  const check = () => {
    if (onAuthPage()) return
    const key = options.sessionKey()
    if (!sessionLive(key) || key !== null) return
    stopWaiting()
    endSession(options.logout, null)
  }

  const onMessage = (event: MessageEvent) => {
    const type = (event.data as { type?: unknown } | null)?.type
    if (onAuthPage()) return
    if (type === SESSION_STARTED) {
      sessionLive(options.sessionKey())
      return
    }
    if (type !== SESSION_ENDED || end) return
    check()
    if (end) return
    stopWaiting()
    const until = Date.now() + SESSION_END_WAIT_MS
    waiting = setInterval(() => {
      check()
      if (end || Date.now() >= until) stopWaiting()
    }, SESSION_END_POLL_MS)
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') check()
  }
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return
    // The page it left is back, and it is a page of its own again.
    if (end && !stayed.value) resetSessionEnd()
    check()
  }

  const channel = openChannel()
  channel?.addEventListener('message', onMessage)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', check)
  window.addEventListener('pageshow', onPageShow)
  // A kept page in another tab waits for this.
  if (options.sessionKey() !== null) post(SESSION_STARTED)

  return () => {
    stopWaiting()
    channel?.close()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', check)
    window.removeEventListener('pageshow', onPageShow)
    if (watchedSessionKey === options.sessionKey) watchedSessionKey = undefined
  }
}
