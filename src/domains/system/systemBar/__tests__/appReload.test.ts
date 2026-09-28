import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkForNewVersion, RELOAD_VETO_GRACE, requestAppReload } from '@/domains/system/systemBar/utils/appReload'
import { useSystemBar } from '@/domains/system/systemBar/composables/systemBar'

// The page reload the admins' route guards trigger when a new version is deployed. The veto flag is
// module state that a browser does not let a test reload, so every case runs on fake timers and
// ends past the veto grace, which is what clears it.

const reload = vi.hoisted(() => vi.fn())
vi.mock('@/domains/system/systemBar/utils/pageReload', () => ({ reloadPage: reload }))

const { newVersion } = useSystemBar()

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  newVersion.value = false
})
afterEach(() => {
  vi.advanceTimersByTime(RELOAD_VETO_GRACE)
  vi.useRealTimers()
  reload.mockReset()
})

describe('reload when a new version is deployed', () => {
  it('does nothing while the running version is current', () => {
    expect(checkForNewVersion()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once the system bar reports a new one', () => {
    newVersion.value = true

    expect(checkForNewVersion()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again inside the cooldown', () => {
    newVersion.value = true
    checkForNewVersion()
    reload.mockClear()

    // Past the veto grace, so only the sessionStorage stamp stops the second call -- which is what
    // keeps a reload that does not take from looping.
    vi.advanceTimersByTime(RELOAD_VETO_GRACE + 1_000)

    expect(checkForNewVersion()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('answers true, without a second reload, while one is already under way', () => {
    const onReload = vi.fn()

    expect(requestAppReload(onReload)).toBe(true)
    expect(requestAppReload(onReload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(onReload).toHaveBeenCalledTimes(1)
  })
})
