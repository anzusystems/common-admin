import { useWebSocket } from '@vueuse/core'
import { type EffectScope, effectScope, ref } from 'vue'
import { i18n } from '@/plugins/i18n'
import {
  type DamNotification,
  useDamNotificationsEventBus,
} from '@/components/damImage/uploadQueue/composables/damNotificationsEventBus'
import { useCommonAdminCoreDamOptionsGlobal } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useAlerts } from '@/composables/system/alerts'

const { t } = i18n.global

const damNotificationsInitialized = ref(false)

type DamNotificationsHandle = ReturnType<typeof createDamNotifications>

let singleton: DamNotificationsHandle | undefined = undefined
let singletonScope: EffectScope | undefined = undefined
let singletonKey: string | undefined = undefined

function createDamNotifications() {
  const { notification } = useCommonAdminCoreDamOptionsGlobal()

  const enabled = notification.enabled && notification.webSocketUrl.length > 0

  const eventBus = useDamNotificationsEventBus()

  let warningTimer: ReturnType<typeof setTimeout> | undefined = undefined
  let disposed = false

  const { open, close, status } = useWebSocket(notification.webSocketUrl, {
    immediate: false,
    autoClose: false,
    // Plain string url — VueUse's `watch(urlRef, open)` would never fire.
    autoConnect: false,
    autoReconnect: {
      retries: 5,
      delay: 5000,
      onFailed() {
        if (!enabled) return
        const { showWarning } = useAlerts()
        warningTimer = setTimeout(() => {
          showWarning(t('common.damImage.notificationsNotConnected'))
        }, 3000)
      },
    },
    onMessage(ws, event) {
      if (!enabled) return
      const message = JSON.parse(event.data as string)
      const data = message.data.length ? JSON.parse(message.data) : undefined
      eventBus.emit({ name: message.eventName, data })
    },
  })

  const closeConnection = () => {
    if (warningTimer) {
      clearTimeout(warningTimer)
      warningTimer = undefined
    }
    close()
  }

  const openConnection = () => {
    if (disposed) return
    damNotificationsInitialized.value = true
    if (!enabled) return
    // VueUse `open()` closes and re-inits even a live socket.
    if (status.value === 'OPEN' || status.value === 'CONNECTING') return
    open()
  }

  const dispose = () => {
    disposed = true
    closeConnection()
  }

  return {
    openConnection,
    closeConnection,
    dispose,
    damNotificationsInitialized,
    status,
  }
}

/**
 * One DAM notification socket per page. Memoized by `enabled|webSocketUrl`, so a reconfigured
 * plugin gets a fresh socket while repeated calls with the same config reuse the existing one.
 */
export function initDamNotifications() {
  const { notification } = useCommonAdminCoreDamOptionsGlobal()
  const key = `${notification.enabled}|${notification.webSocketUrl}`

  if (singleton && singletonKey === key) return singleton
  if (singleton) destroyDamNotifications()

  singletonScope = effectScope(true)
  singleton = singletonScope.run(() => createDamNotifications())!
  singletonKey = key

  return singleton
}

/**
 * Tears the singleton down and invalidates the previous handle. Owned by the app bootstrap —
 * tying it to a component unmount would kill the shared connection for everyone else.
 */
export function destroyDamNotifications() {
  singleton?.dispose()
  singletonScope?.stop()
  damNotificationsInitialized.value = false
  singleton = undefined
  singletonScope = undefined
  singletonKey = undefined
}

export function useDamNotifications() {
  const eventBus = useDamNotificationsEventBus()

  /** Returns the `off` handle; outside a component setup the caller must keep and call it. */
  const addDamNotificationListener = (callback: (event: DamNotification) => void) => {
    return eventBus.on(callback)
  }

  return {
    addDamNotificationListener,
  }
}
