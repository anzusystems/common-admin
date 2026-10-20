import { useWebSocket } from '@vueuse/core'
import { type EffectScope, effectScope, ref, watch } from 'vue'
import { commonT } from '@/plugins/i18n'
import { type DamNotification, useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import {
  damNotificationSockets,
  type DamNotificationSocketOptions,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { setDamNotificationsPushAlive } from '@/domains/dam/composables/damNotificationsConnection'
import { useAlerts } from '@/domains/system/composables/alerts'

const t = commonT

const damNotificationsInitialized = ref(false)

type DamNotificationsHandle = ReturnType<typeof createDamNotifications>

let singleton: DamNotificationsHandle | undefined = undefined
let singletonScope: EffectScope | undefined = undefined
let singletonKey: string | undefined = undefined

/** One socket, of the configurations `configNames`: what comes through it is told to come from them. */
function createDamSocket({ options: notification, configNames }: DamNotificationSocketOptions) {
  const enabled = notification.enabled

  const eventBus = useDamNotificationsEventBus()

  let warningTimer: ReturnType<typeof setTimeout> | undefined = undefined

  /** The socket has given up: the user is told, once it has failed. One warning waits at a time, which a close takes. */
  const warnFailed = () => {
    if (!enabled) return
    const { showWarning } = useAlerts()
    if (warningTimer) clearTimeout(warningTimer)
    warningTimer = setTimeout(() => {
      showWarning(t('common.damImage.notificationsNotConnected'))
    }, 3000)
  }

  const { open, close, status } = useWebSocket(notification.webSocketUrl, {
    immediate: false,
    autoClose: false,
    // Plain string url — VueUse's `watch(urlRef, open)` would never fire.
    autoConnect: false,
    autoReconnect: {
      retries: 5,
      delay: 5000,
      onFailed: warnFailed,
    },
    onMessage(ws, event) {
      if (!enabled) return
      const message = JSON.parse(event.data as string)
      const data = message.data.length ? JSON.parse(message.data) : undefined
      eventBus.emit({ name: message.eventName, data }, configNames)
    },
  })

  // Only an open socket counts: one that still connects, or has given up, brings no notification.
  watch(status, (current) => setDamNotificationsPushAlive(enabled && current === 'OPEN', configNames), {
    immediate: true,
    flush: 'sync',
  })

  const closeConnection = () => {
    if (warningTimer) {
      clearTimeout(warningTimer)
      warningTimer = undefined
    }
    close()
  }

  const openConnection = () => {
    if (!enabled) return
    // VueUse `open()` closes and re-inits even a live socket.
    if (status.value === 'OPEN' || status.value === 'CONNECTING') return
    try {
      open()
    } catch (error) {
      // An address the browser refuses. `default`'s throws, as the one socket of the page did; that of another
      // configuration fails as a socket that gave up does, and the page goes on.
      if (configNames.includes('default')) throw error
      console.error('damNotifications: the socket could not be opened', error)
      warnFailed()
    }
  }

  const dispose = () => {
    closeConnection()
    setDamNotificationsPushAlive(false, configNames)
  }

  return { openConnection, closeConnection, dispose, status }
}

/**
 * The sockets of the page, `default`'s first. The handle acts on them all; its `status` is that of `default`'s
 * socket, as it was of the one socket of the page.
 */
function createDamNotifications(sockets: DamNotificationSocketOptions[], onDispose: () => void = () => {}) {
  const [ofDefault, ...others] = sockets.map(createDamSocket)
  const all = [ofDefault!, ...others]

  let disposed = false

  const closeConnection = () => all.forEach((socket) => socket.closeConnection())

  const openConnection = () => {
    if (disposed) return
    damNotificationsInitialized.value = true
    // The others are opened also when that of `default` throws, which is thrown once they are.
    let failure: { error: unknown } | undefined
    all.forEach((socket) => {
      try {
        socket.openConnection()
      } catch (error) {
        failure ??= { error }
      }
    })
    if (failure) throw failure.error
  }

  const dispose = () => {
    disposed = true
    all.forEach((socket) => socket.dispose())
    onDispose()
  }

  return {
    openConnection,
    closeConnection,
    dispose,
    damNotificationsInitialized,
    status: ofDefault!.status,
  }
}

/**
 * The DAM notification sockets of the page: `default`'s, from its `notification` or the root one, and one for each
 * other service a configuration names (configurations that name one service share its socket). Memoized by the
 * services and the configurations of each, so a reconfigured plugin gets fresh sockets while repeated calls with the
 * same config reuse the existing ones. The handle opens, closes and disposes of them all.
 */
export function initDamNotifications() {
  const sockets = damNotificationSockets()
  const key = sockets
    .map(({ options, configNames }) => `${configNames.join(',')}=${options.enabled}|${options.webSocketUrl}`)
    .join(';')

  if (singleton && singletonKey === key) return singleton
  if (singleton) destroyDamNotifications()

  singletonScope = effectScope(true)
  // Disposed directly, the handle is forgotten too: kept, the next call handed back a socket that never opened again.
  const handle: DamNotificationsHandle = singletonScope.run(() =>
    createDamNotifications(sockets, () => {
      if (singleton === handle) forgetSingleton()
    })
  )!
  singleton = handle
  singletonKey = key

  return singleton
}

const forgetSingleton = () => {
  singletonScope?.stop()
  damNotificationsInitialized.value = false
  singleton = undefined
  singletonScope = undefined
  singletonKey = undefined
}

/**
 * Tears the sockets down and invalidates the previous handle. Owned by the app bootstrap —
 * tying it to a component unmount would kill the shared connection for everyone else.
 */
export function destroyDamNotifications() {
  singleton?.dispose()
  forgetSingleton()
}

/** Which sockets a listener of DAM notifications hears. */
export interface DamNotificationListenerOptions {
  /** The socket of this DAM configuration; `default` where left out. */
  configName?: string
  /** Every socket of the page; `configName` is not read then. */
  all?: boolean
}

type DamNotificationCallback = (event: DamNotification, origin: string[]) => void
type DamNotificationBusListener = (event: DamNotification, from?: string[]) => void

// One listener of the bus for a callback and the sockets it hears: added twice, it is one listener, heard once, as the
// callback itself was.
const busListeners = new WeakMap<DamNotificationCallback, Map<string, DamNotificationBusListener>>()
const busListenerOf = (callback: DamNotificationCallback, options: DamNotificationListenerOptions) => {
  const key = options.all ? 'all' : `of ${options.configName ?? 'default'}`
  let ofCallback = busListeners.get(callback)
  if (!ofCallback) {
    ofCallback = new Map()
    busListeners.set(callback, ofCallback)
  }
  let listener = ofCallback.get(key)
  if (!listener) {
    listener = (event, from) => {
      // An event put on the bus without the socket it came through is taken for one of `default`'s.
      const origin = from ?? ['default']
      if (!options.all && !origin.includes(options.configName ?? 'default')) return
      // A copy for each: the names are those of the socket for every event to come.
      callback(event, [...origin])
    }
    ofCallback.set(key, listener)
  }
  return listener
}

export function useDamNotifications() {
  const eventBus = useDamNotificationsEventBus()

  /**
   * Hears the socket of `default`, or the one `options` names. The callback gets, beside the event, the names of the
   * configurations of the socket it came through (a copy of its own). One callback added twice for the same sockets is
   * heard once. Returns the `off` handle; outside a component setup the caller must keep and call it.
   */
  const addDamNotificationListener = (
    callback: DamNotificationCallback,
    options: DamNotificationListenerOptions = {}
  ) => {
    return eventBus.on(busListenerOf(callback, options))
  }

  return {
    addDamNotificationListener,
  }
}
