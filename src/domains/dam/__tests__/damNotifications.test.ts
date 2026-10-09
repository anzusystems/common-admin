import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommonAdminCoreDamOptions } from '@/AnzuSystemsCommonAdmin'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  destroyDamNotifications,
  initDamNotifications,
  useDamNotifications,
} from '@/domains/dam/composables/damNotifications'
import { type DamNotification, DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'

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
      }
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

  // Disposed directly, the handle stayed cached: the next init handed it back, and it never opened again.
  it('opens a fresh connection after its handle was disposed directly', () => {
    const first = initDamNotifications()
    first.dispose()

    const second = initDamNotifications()
    second.openConnection()

    expect(second).not.toBe(first)
    expect(second.damNotificationsInitialized.value).toBe(true)
    expect(second.status.value).not.toBe('CLOSED')
  })

  it('does not reopen an already open connection', () => {
    const handle = initDamNotifications()

    handle.openConnection()
    const statusAfterFirst = handle.status.value
    handle.openConnection()

    expect(handle.status.value).toBe(statusAfterFirst)
  })
})

// The way of a notification from the server to whoever listens: a frame on the socket, an event for the listeners.
describe('the notification socket', () => {
  let socket: DamSocket
  let off: () => void = () => {}
  const heard: DamNotification[] = []

  beforeEach(() => {
    socket = stubDamSocket()
    heard.length = 0
    off = useDamNotifications().addDamNotificationListener((event) => heard.push(event))
  })
  afterEach(() => {
    off()
    destroyDamNotifications()
    socket.restore()
  })

  it.each([
    ['switched off', 'ws://localhost/notifications', false],
    ['switched on without an address', '', true],
  ])('is not opened when it is %s, and the notifications still count as started', (_name, webSocketUrl, enabled) => {
    setOptions(webSocketUrl, enabled)
    const notifications = initDamNotifications()

    notifications.openConnection()

    expect(socket.sockets).toEqual([])
    expect(notifications.damNotificationsInitialized.value).toBe(true)
    expect(notifications.status.value).toBe('CLOSED')
  })

  it('is opened once, at the configured address', () => {
    setOptions('ws://localhost/notifications')
    const notifications = initDamNotifications()

    notifications.openConnection()
    notifications.openConnection()

    expect(socket.sockets.map((one) => one.url)).toEqual(['ws://localhost/notifications'])
  })

  it('hands a frame to the listeners as the name of the event and its data', () => {
    setOptions('ws://localhost/notifications')
    initDamNotifications().openConnection()
    socket.accept()

    socket.deliver(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    socket.deliver(DamNotificationName.AssetFileFailed, { asset: 'asset-2', id: 'file-2', failReason: 'unknown' })

    expect(heard).toEqual([
      { name: 'asset_file_processed', data: { asset: 'asset-1', id: 'file-1' } },
      { name: 'asset_file_failed', data: { asset: 'asset-2', id: 'file-2', failReason: 'unknown' } },
    ])
  })

  it('hands a frame without data to the listeners with no data', () => {
    setOptions('ws://localhost/notifications')
    initDamNotifications().openConnection()
    socket.accept()

    socket.deliver(DamNotificationName.UserUpdated)

    expect(heard).toEqual([{ name: 'user_updated', data: undefined }])
  })

  it('hands on a name it does not know as well: the listeners decide', () => {
    setOptions('ws://localhost/notifications')
    initDamNotifications().openConnection()
    socket.accept()

    socket.deliver('a_name_of_tomorrow', { any: 'thing' })

    expect(heard).toEqual([{ name: 'a_name_of_tomorrow', data: { any: 'thing' } }])
  })
})
