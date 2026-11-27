import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { VApp } from 'vuetify/components'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import {
  broadcastSessionEnd,
  endSession,
  resetSessionEnd,
  sessionLive,
  useSessionEnd,
  watchSessionEnd,
} from '@/domains/auth/composables/sessionEnd'
import { createRefreshRequestInterceptor, createRefreshSession } from '@/domains/auth/composables/refreshSession'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import ALogoutView from '@/domains/ui/view/components/ALogoutView.vue'
import ASystemBarSessionEnded from '@/domains/system/systemBar/components/ASystemBarSessionEnded.vue'

// The test files of a browser run are pages of one origin, so each test gets a channel of its own:
// a sign-out view mounted by another file must not reach the watch of this one.
const RealBroadcastChannel = BroadcastChannel
let channelName = ''
class IsolatedChannel extends RealBroadcastChannel {
  constructor(_name?: string) {
    super(channelName)
  }
}

// Created after the watch, so the watch has had the message once this resolves: a channel's message
// goes to the other channels of the page in the order they were made.
const delivered = () =>
  new Promise<void>((resolve) => {
    const probe = new RealBroadcastChannel(channelName)
    probe.addEventListener('message', () => {
      probe.close()
      resolve()
    })
  })

const testPath = location.pathname + location.search + location.hash
const show = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}
const focus = () => window.dispatchEvent(new Event('focus'))
// The browser's prompt about unsaved changes was answered "stay": the page is still here after the sign-out.
const stay = () => vi.advanceTimersByTimeAsync(1500)
const barShown = () => useSessionEnd().sessionEnded.value

// The cookies: `null` without a session, another value after another sign-in.
let session: string | null = 'first'
let logout = vi.fn()
const stops: Array<() => void> = []
const watch = (sessionKey = () => session, leave = logout) => {
  stops.push(watchSessionEnd({ sessionKey, logout: leave }))
}

beforeEach(() => {
  channelName = `session-end-test-${Math.random()}`
  vi.stubGlobal('BroadcastChannel', IsolatedChannel)
  session = 'first'
  logout = vi.fn()
  resetSessionEnd()
})

afterEach(() => {
  stops.splice(0).forEach((stop) => stop())
  resetSessionEnd()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  history.replaceState(null, '', testPath)
})

describe('endSession', () => {
  it('sends the page to the sign-out once, however many ask', () => {
    endSession(logout, null)
    endSession(logout, null)
    endSession(vi.fn(), null)

    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('shows the bar when the page stays after the sign-out, not while it leaves', async () => {
    vi.useFakeTimers()
    endSession(logout, null)
    await vi.advanceTimersByTimeAsync(1400)
    expect(barShown()).toBe(false)
    await stay()
    expect(barShown()).toBe(true)

    resetSessionEnd()
    endSession(logout, null)
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    await stay()
    expect(barShown()).toBe(false)
  })

  // After a refused refresh the stale cookies stay: only another session counts as a new sign-in.
  it('comes back on a new sign-in, not on the cookies of the session that ended or none', async () => {
    vi.useFakeTimers()
    endSession(logout, 'first')
    await stay()
    expect([sessionLive(null), sessionLive('first'), barShown()]).toEqual([false, false, true])

    expect(sessionLive('second')).toBe(true)
    expect(barShown()).toBe(false)
    expect(sessionLive('second')).toBe(true)

    // A session that ends again is a new end: one more sign-out, not a loop.
    endSession(logout, 'second')
    endSession(logout, 'second')
    expect(logout).toHaveBeenCalledTimes(2)
  })

  it('leaves for the sign-out from the bar after all', async () => {
    vi.useFakeTimers()
    endSession(logout, null)
    await stay()
    useSessionEnd().leave()

    expect(logout).toHaveBeenCalledTimes(2)
  })
})

describe('watchSessionEnd', () => {
  it('leaves at once when another tab signs out and the cookies are already gone', async () => {
    watch()
    session = null
    const received = delivered()
    broadcastSessionEnd()
    await received

    expect(logout).toHaveBeenCalledTimes(1)
  })

  // The other tab's sign-out request is still on its way when it tells the others.
  it('leaves once the cookies of a sign-out in another tab are gone', async () => {
    vi.useFakeTimers()
    watch()
    const received = delivered()
    broadcastSessionEnd()
    await received
    await vi.advanceTimersByTimeAsync(1000)
    expect(logout).not.toHaveBeenCalled()

    session = null
    await vi.advanceTimersByTimeAsync(200)
    expect(logout).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  // A tab that was asleep gets the message when it wakes: by then the user may have signed in again.
  it('stays when the cookies do not go: the user signed in again', async () => {
    vi.useFakeTimers()
    watch()
    const received = delivered()
    broadcastSessionEnd()
    await received
    await vi.advanceTimersByTimeAsync(60_000)
    session = null
    await vi.advanceTimersByTimeAsync(60_000)

    expect(logout).not.toHaveBeenCalled()
  })

  it('checks the cookies when the tab is shown or focused, and leaves once', () => {
    watch()
    show('visible')
    focus()
    expect(logout).not.toHaveBeenCalled()

    session = null
    show('hidden')
    expect(logout).not.toHaveBeenCalled()
    show('visible')
    expect(logout).toHaveBeenCalledTimes(1)
    focus()
    show('visible')
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('checks again on the page restored from the back-forward cache', () => {
    watch()
    session = null
    focus()
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
    expect(logout).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    expect(logout).toHaveBeenCalledTimes(2)
  })

  it.each([['/login'], ['/logout']])('never reacts on %s', async (path) => {
    history.replaceState(null, '', path)
    vi.useFakeTimers()
    watch()
    session = null
    show('visible')
    focus()
    const received = delivered()
    broadcastSessionEnd()
    await received
    await vi.advanceTimersByTimeAsync(20_000)

    expect(logout).not.toHaveBeenCalled()
  })

  it('does nothing once stopped', async () => {
    watch()
    stops.splice(0).forEach((stop) => stop())
    session = null
    focus()
    show('visible')
    const received = delivered()
    broadcastSessionEnd()
    await received

    expect(logout).not.toHaveBeenCalled()
  })

  // Autosave, focus and the other tabs used to send a kept page to the sign-out again and again.
  it('keeps a page the user stayed on, and brings it back when another tab signs in', async () => {
    vi.useFakeTimers()
    watch()
    session = null
    focus()
    await stay()
    expect([logout.mock.calls.length, barShown()]).toEqual([1, true])

    focus()
    show('visible')
    const told = delivered()
    broadcastSessionEnd()
    await told
    await vi.advanceTimersByTimeAsync(20_000)
    expect([logout.mock.calls.length, barShown()]).toEqual([1, true])

    // The sign-in tab's first request starts its watch, which tells the others.
    session = 'second'
    const signedIn = delivered()
    watch(() => 'second', vi.fn())
    await signedIn
    expect(barShown()).toBe(false)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('brings a kept page back on return to the tab with the cookies of a new sign-in', async () => {
    vi.useFakeTimers()
    watch()
    session = null
    focus()
    await stay()

    session = 'second'
    focus()
    expect(barShown()).toBe(false)
    expect(logout).toHaveBeenCalledTimes(1)
  })
})

describe('the session-ended bar', () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })
  const mountBar = () => {
    wrapper = mount(defineComponent({ setup: () => () => h(VApp, () => h(ASystemBarSessionEnded)) }), {
      attachTo: document.body,
    })
  }
  const bar = () => document.querySelector('[data-cy="session-ended-bar"]')

  it('shows after the user stayed, offers both ways to sign in, and goes on a new sign-in', async () => {
    vi.useFakeTimers()
    mountBar()
    endSession(logout, null)
    await nextTick()
    expect(bar()).toBeNull()
    await stay()
    await nextTick()
    expect(bar()?.textContent).toContain('Your sign-in has ended')

    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    document.querySelector<HTMLElement>('[data-cy="session-ended-sign-in-new-tab"]')!.click()
    expect(open).toHaveBeenCalledWith('/login', '_blank', 'noopener')
    document.querySelector<HTMLElement>('[data-cy="session-ended-leave"]')!.click()
    expect(logout).toHaveBeenCalledTimes(2)

    sessionLive('second')
    await nextTick()
    expect(bar()).toBeNull()
  })
})

describe('ALogoutView', () => {
  const here = location.href.split('#')[0]!

  it('tells the other tabs when it leaves for the sign-out', async () => {
    watch()
    session = null
    const received = delivered()
    const wrapper = mount(ALogoutView, { props: { logoutUrl: () => `${here}#signed-out` } })
    await received
    wrapper.unmount()

    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('tells nobody without a sign-out address', async () => {
    let told = false
    const probe = new RealBroadcastChannel(channelName)
    probe.addEventListener('message', () => (told = true))
    const wrapper = mount(ALogoutView)
    await new Promise((resolve) => setTimeout(resolve, 100))
    wrapper.unmount()
    probe.close()

    expect(told).toBe(false)
  })
})

describe('createRefreshRequestInterceptor', () => {
  // Leaves its watch in the page, so these come last.
  const failing = (status: number) => {
    const error = new AxiosError('request failed')
    error.response = { status, statusText: '', data: {}, headers: {}, config: { headers: new AxiosHeaders() } }
    return Object.assign(new Error('wrapped'), { cause: error })
  }
  const setup = (watchSessionEndOption?: boolean, refresh: () => Promise<unknown> = async () => ({})) => {
    const cookies = { refreshTokenExists: 'yes' as unknown, jwtPayload: 'valid' as string | undefined }
    const interceptorLogout = vi.fn()
    const refreshSpy = vi.fn(refresh)
    const { interceptor } = createRefreshRequestInterceptor({
      cookies: () => ({ ...cookies }),
      refreshSession: createRefreshSession({ refresh: refreshSpy, jwtPayload: () => cookies.jwtPayload }),
      logout: interceptorLogout,
      skipUrlPrefix: '/auth',
      watchSessionEnd: watchSessionEndOption,
    })
    const request = () => interceptor({ url: '/adm/v1/x', headers: new AxiosHeaders() } as InternalAxiosRequestConfig)
    const signOut = () => {
      cookies.refreshTokenExists = undefined
      cookies.jwtPayload = undefined
    }
    return { cookies, interceptorLogout, refreshSpy, request, signOut }
  }

  it('watches from the first request of a signed-in user, with the same cookie rule', async () => {
    const { cookies, interceptorLogout, request, signOut } = setup()
    signOut()
    focus()
    expect(interceptorLogout).not.toHaveBeenCalled()

    cookies.refreshTokenExists = 'yes'
    cookies.jwtPayload = 'valid'
    await request()
    await request()
    cookies.refreshTokenExists = undefined
    focus()
    expect(interceptorLogout).not.toHaveBeenCalled()

    signOut()
    focus()
    expect(interceptorLogout).toHaveBeenCalledTimes(1)
  })

  it('does not watch with `watchSessionEnd: false`', async () => {
    const { interceptorLogout, request, signOut } = setup(false)
    await request()
    signOut()
    focus()
    expect(interceptorLogout).not.toHaveBeenCalled()
  })

  // Autosave runs every 15 seconds: each request used to send the kept page to the sign-out, and the browser asked again.
  it('rejects the requests of a kept page without a second sign-out, and lets them through after a new sign-in', async () => {
    vi.useFakeTimers()
    const { cookies, interceptorLogout, request, signOut } = setup(false)
    await request()
    signOut()
    await expect(request()).rejects.toBeInstanceOf(SessionExpiredError)
    await stay()
    for (let i = 0; i < 3; i++) await expect(request()).rejects.toBeInstanceOf(SessionExpiredError)
    expect([interceptorLogout.mock.calls.length, barShown()]).toEqual([1, true])

    cookies.refreshTokenExists = 'yes'
    cookies.jwtPayload = 'new'
    await expect(request()).resolves.toBeDefined()
    expect(barShown()).toBe(false)
  })

  it('keeps a page whose refresh was refused out until a new sign-in, without refreshing again', async () => {
    const { cookies, interceptorLogout, refreshSpy, request } = setup(false, async () => Promise.reject(failing(401)))
    cookies.jwtPayload = undefined
    await expect(request()).rejects.toBeInstanceOf(SessionExpiredError)
    await expect(request()).rejects.toBeInstanceOf(SessionExpiredError)
    expect([interceptorLogout.mock.calls.length, refreshSpy.mock.calls.length]).toEqual([1, 1])

    cookies.jwtPayload = 'new'
    await expect(request()).resolves.toBeDefined()
  })
})
