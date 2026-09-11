import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommonAdminCoreDamOptions } from '@/AnzuSystemsCommonAdmin'
import { initCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import {
  destroyDamNotifications,
  initDamNotifications,
} from '@/components/damImage/uploadQueue/composables/damNotifications'

// initDamNotifications() used to be unguarded: every call built a fresh socket that nothing could
// close, so a router guard accumulated one per attempt. Pins the singleton contract.

const setOptions = (webSocketUrl: string, enabled = true) => {
  initCommonAdminCoreDamOptions({
    configs: { default: {} },
    notification: { enabled, webSocketUrl },
  } as unknown as CommonAdminCoreDamOptions)
}

describe('damNotifications singleton', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'WebSocket',
      class {
        static readonly CONNECTING = 0
        static readonly OPEN = 1
        static readonly CLOSING = 2
        static readonly CLOSED = 3
        readyState = 0
        close = vi.fn()
        send = vi.fn()
        addEventListener = vi.fn()
        removeEventListener = vi.fn()
      },
    )
    setOptions('ws://localhost/notifications')
  })

  afterEach(() => {
    destroyDamNotifications()
    vi.unstubAllGlobals()
  })

  it('returns the same handle while the config is unchanged', () => {
    const first = initDamNotifications()
    const second = initDamNotifications()

    expect(second).toBe(first)
  })

  it('replaces the handle when the config key changes', () => {
    const first = initDamNotifications()

    setOptions('ws://localhost/other')
    const second = initDamNotifications()

    expect(second).not.toBe(first)
  })

  it('stops the previous handle from reopening the connection after the config changed', () => {
    const first = initDamNotifications()

    setOptions('ws://localhost/other')
    initDamNotifications()

    first.openConnection()

    expect(first.status.value).toBe('CLOSED')
  })

  it('resets damNotificationsInitialized on destroy', () => {
    const handle = initDamNotifications()
    handle.openConnection()
    expect(handle.damNotificationsInitialized.value).toBe(true)

    destroyDamNotifications()

    expect(handle.damNotificationsInitialized.value).toBe(false)
  })

  it('does not reopen an already open connection', () => {
    const handle = initDamNotifications()

    handle.openConnection()
    const statusAfterFirst = handle.status.value
    handle.openConnection()

    expect(handle.status.value).toBe(statusAfterFirst)
  })
})
