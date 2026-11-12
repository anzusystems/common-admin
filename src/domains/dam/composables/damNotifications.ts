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

/** One socket for the configurations `configNames`. Its events are tagged with those names. */
function createDamSocket({ options: notification, configNames }: DamNotificationSocketOptions) {
  const enabled = notification.enabled

  const eventBus = useDamNotificationsEventBus()

  let warningTimer: ReturnType<typeof setTimeout> | undefined = undefined

  /** Warns the user once the socket gives up. Only one warning is shown at a time; closing it clears it. */
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
    // Plain string url. VueUse's `watch(urlRef, open)` would never fire.
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

  // Only an open socket counts. A connecting or failed one brings no notifications.
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
      // The browser refused the address. For `default` this throws. For other
      // configurations it fails like a socket that gave up, and the page continues.
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
 * All sockets of the page, `default`'s first. The handle acts
 * on all of them. Its `status` is that of `default`'s socket.
 */
function createDamNotifications(sockets: DamNotificationSocketOptions[], onDispose: () => void = () => {}) {
  const [ofDefault, ...others] = sockets.map(createDamSocket)
  const all = [ofDefault!, ...others]

  let disposed = false

  const closeConnection = () => all.forEach((socket) => socket.closeConnection())

  const openConnection = () => {
    if (disposed) return
    damNotificationsInitialized.value = true
    // The others open even when `default`'s throws. That error is rethrown after they open.
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
 * DAM notification sockets of the page: `default`'s, plus one per other service
 * a configuration names (shared by configurations naming the same service).
 * Memoized by services and their configurations. A reconfigured plugin gets fresh sockets, repeated calls reuse them.
 * The handle opens, closes and disposes of them all.
 */
export function initDamNotifications() {
  const sockets = damNotificationSockets()
  const key = sockets
    .map(({ options, configNames }) => `${configNames.join(',')}=${options.enabled}|${options.webSocketUrl}`)
    .join(';')

  if (singleton && singletonKey === key) return singleton
  if (singleton) destroyDamNotifications()

  singletonScope = effectScope(true)
  // Disposing directly also forgets the handle. Otherwise the next call returned a socket that never reopened.
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
 * Tears the sockets down and invalidates the previous handle. Owned by app bootstrap.
 * Tying it to a component unmount would kill the shared connection for everyone else.
 */
export function destroyDamNotifications() {
  singleton?.dispose()
  forgetSingleton()
}

/** Which sockets a DAM notification listener hears. */
export interface DamNotificationListenerOptions {
  /** Socket of this DAM configuration. Defaults to `default`. */
  configName?: string
  /** Every socket of the page. `configName` is ignored then. */
  all?: boolean
}

type DamNotificationCallback = (event: DamNotification, origin: string[]) => void
type DamNotificationBusListener = (event: DamNotification, from?: string[]) => void

// One bus listener per callback and socket set. Adding it twice yields one listener, heard once.
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
      // An event put on the bus without its socket is treated as `default`'s.
      const origin = from ?? ['default']
      if (!options.all && !origin.includes(options.configName ?? 'default')) return
      // A copy per callback. The array is the socket's names, shared by every future event.
      callback(event, [...origin])
    }
    ofCallback.set(key, listener)
  }
  return listener
}

export function useDamNotifications() {
  const eventBus = useDamNotificationsEventBus()

  /**
   * Hears `default`'s socket, or the one `options` names. The
   * callback also gets a copy of the socket's configuration names.
   * One callback added twice for the same sockets is heard once.
   * Returns the `off` handle. Outside a component setup the caller must keep and call it.
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
