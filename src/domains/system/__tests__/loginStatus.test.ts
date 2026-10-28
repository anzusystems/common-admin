import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { localTimeShiftInSeconds, useLoginStatus } from '@/domains/system/composables/loginStatus'

const route = (query: Record<string, string> = {}) => ({ query }) as unknown as RouteLocationNormalized

describe('useLoginStatus', () => {
  it('forgets a failed SSO verdict once a later navigation no longer carries it', () => {
    expect(useLoginStatus(route({ loginState: 'failure-unauthorized', timestamp: '1' })).isStatusUnauthorized()).toBe(
      true
    )

    const later = useLoginStatus(route())
    expect(later.isStatusUnauthorized()).toBe(false)
    expect(later.isStatusNotDefined()).toBe(true)
  })

  // The start-up reads the verdict after its awaits, and another navigation can pass the guard meanwhile.
  it('keeps the verdict of its own navigation when a later one runs before it is read', () => {
    const callback = useLoginStatus(route({ loginState: 'failure-unauthorized', timestamp: '1' }))
    useLoginStatus(route())

    expect(callback.isStatusUnauthorized()).toBe(true)
    expect(callback.isStatusNotDefined()).toBe(false)
  })

  it('measures the clock shift again on every login instead of keeping the largest one', () => {
    const now = Math.floor(Date.now() / 1000)
    useLoginStatus(route({ loginState: 'success', timestamp: String(now + 3600) }))
    expect(localTimeShiftInSeconds.value).toBeGreaterThanOrEqual(3539)

    useLoginStatus(route({ loginState: 'success', timestamp: String(now) }))
    expect(localTimeShiftInSeconds.value).toBe(0)
  })
})
