import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import type { CommonAdminCoreDamOptions } from '@/AnzuSystemsCommonAdmin'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  initCommonAdminCoreDamOptions,
  normalizeDamNotificationOptions,
  useCommonAdminCoreDamOptionsGlobal,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsConnection } from '@/domains/dam/composables/damNotificationsConnection'

// When an application has the notification service at all, and what the upload queues are told about its socket:
// with the socket open they poll only as a backup. The options go through the real plugin options, the socket is
// a stub of the global `WebSocket`.

const ADDRESS = 'ws://localhost/notifications'

/** The options of an application, with `notification` as given, or without it altogether. */
const configure = (...notification: [unknown?]) =>
  initCommonAdminCoreDamOptions({
    configs: { default: {} },
    apiTimeout: 30,
    adminDomain: 'https://dam.test',
    ...(notification.length ? { notification: notification[0] } : {}),
  } as unknown as CommonAdminCoreDamOptions)

let socket: DamSocket
beforeEach(() => {
  socket = stubDamSocket()
})
afterEach(() => {
  destroyDamNotifications()
  socket.restore()
})

const closeSocket = () => socket.sockets.at(-1)!.onclose?.(new CloseEvent('close'))
/** The application starts its notifications, as it does once at start-up. */
const started = () => {
  const notifications = initDamNotifications()
  notifications.openConnection()
  return notifications
}

describe('the notification service of an application', () => {
  // A deployment template puts the value in quotes, and renders a boolean of its variables as `True`.
  it.each([true, 'true', 'True', 'TRUE', ' true ', '\tTrue\n'])('is on with enabled %j and an address', (enabled) => {
    configure({ enabled, webSocketUrl: ADDRESS })

    expect(useCommonAdminCoreDamOptionsGlobal().notification).toEqual({ enabled: true, webSocketUrl: ADDRESS })
    started()
    expect(socket.sockets.map((one) => one.url)).toEqual([ADDRESS])
  })

  // Any text used to count as on, "false" among them.
  it.each(['1', 'false', 'False', 'yes', 'on', 'truee', 't rue', '', ' ', 1, 0, false, null, undefined])(
    'is off with enabled %j, whatever the address',
    (enabled) => {
      configure({ enabled, webSocketUrl: ADDRESS })

      expect(useCommonAdminCoreDamOptionsGlobal().notification).toEqual({ enabled: false, webSocketUrl: ADDRESS })
      const notifications = started()
      expect(socket.sockets).toEqual([])
      // The application still counts as started: nothing waits for a socket that will not come.
      expect(notifications.damNotificationsInitialized.value).toBe(true)
    }
  )

  it.each([undefined, null, '', '   ', 5])('is off with the address %j, and nothing throws', (webSocketUrl) => {
    configure({ enabled: true, webSocketUrl })

    expect(useCommonAdminCoreDamOptionsGlobal().notification).toEqual({ enabled: false, webSocketUrl: '' })
    started()
    expect(socket.sockets).toEqual([])
  })

  it('takes its address without the spaces around it', () => {
    configure({ enabled: 'true', webSocketUrl: `  ${ADDRESS}\n` })

    started()
    expect(socket.sockets.map((one) => one.url)).toEqual([ADDRESS])
  })

  it.each([
    ['no notification option at all', []],
    ['an empty one', [{}]],
    ['one that is null', [null]],
  ] as Array<[string, [unknown?]]>)('is off with %s, and nothing throws', (_name, notification) => {
    configure(...notification)

    expect(useCommonAdminCoreDamOptionsGlobal().notification).toEqual({ enabled: false, webSocketUrl: '' })
    const notifications = started()
    expect(socket.sockets).toEqual([])
    expect(notifications.status.value).toBe('CLOSED')
  })

  it('reads the same from the options as they are handed over', () => {
    expect(normalizeDamNotificationOptions(undefined)).toEqual({ enabled: false, webSocketUrl: '' })
    expect(normalizeDamNotificationOptions({ enabled: ' True ', webSocketUrl: ADDRESS })).toEqual({
      enabled: true,
      webSocketUrl: ADDRESS,
    })
  })
})

describe('what the upload queues are told of the notification socket', () => {
  const connection = useDamNotificationsConnection()
  let heard: boolean[]
  let off: () => void
  beforeEach(() => {
    heard = []
    off = connection.onChange(() => heard.push(connection.isPushAlive()))
  })
  afterEach(() => off())

  it('is alive only while the socket is open: not while it connects, nor once it has closed', () => {
    configure({ enabled: true, webSocketUrl: ADDRESS })
    expect(connection.isPushAlive()).toBe(false)

    started()
    expect(connection.isPushAlive()).toBe(false)
    socket.accept()
    expect(connection.isPushAlive()).toBe(true)
    closeSocket()
    expect(connection.isPushAlive()).toBe(false)

    expect(heard).toEqual([true, false])
  })

  it('is not alive any more once the application tears its notifications down', () => {
    configure({ enabled: true, webSocketUrl: ADDRESS })
    started()
    socket.accept()

    destroyDamNotifications()

    expect(connection.isPushAlive()).toBe(false)
    expect(heard).toEqual([true, false])
  })

  it('is never alive for an application without the service', () => {
    configure({ enabled: 'false', webSocketUrl: ADDRESS })

    started()

    expect(connection.isPushAlive()).toBe(false)
    expect(heard).toEqual([])
  })

  it('no longer reaches a listener that has let go', () => {
    configure({ enabled: true, webSocketUrl: ADDRESS })
    off()

    started()
    socket.accept()

    expect(connection.isPushAlive()).toBe(true)
    expect(heard).toEqual([])
  })

  // A queue subscribes when its first row begins to wait, from wherever that row was added: a component that is
  // gone by the time the socket closes.
  it('still reaches a listener that subscribed inside a scope which has ended since', () => {
    configure({ enabled: true, webSocketUrl: ADDRESS })
    const inScope: boolean[] = []
    const scope = effectScope()
    const offInScope = scope.run(() => connection.onChange(() => inScope.push(connection.isPushAlive())))!
    scope.stop()

    started()
    socket.accept()

    expect(inScope).toEqual([true])
    offInScope()
  })
})
