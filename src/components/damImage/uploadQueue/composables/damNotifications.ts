import { useWebSocket } from '@vueuse/core'
import { ref } from 'vue'
import { i18n } from '@/plugins/i18n'
import { useAlerts } from '@/composables/system/alerts'
import {
  type DamNotification,
  useDamNotificationsEventBus,
} from '@/components/damImage/uploadQueue/composables/damNotificationsEventBus'
import { useCommonAdminCoreDamOptionsGlobal } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

const { t } = i18n.global || i18n

const damNotificationsInitialized = ref(false)

export function initDamNotifications() {
  const { notification } = useCommonAdminCoreDamOptionsGlobal()

  const enabled = notification.enabled && notification.webSocketUrl.length > 0

  const { open, ws } = useWebSocket(notification.webSocketUrl, {
    immediate: false,
    autoReconnect: {
      retries: 10,
      delay: 5000,
    },
    heartbeat: {
      interval: 4000,
    },
  })

  const openConnection = () => {
    console.log('openConnection', enabled)
    damNotificationsInitialized.value = true
    if (!enabled) return
    const eventBus = useDamNotificationsEventBus()
    open()
    if (!ws.value) return
    ws.value.onopen = function (this: WebSocket, event: Event) {
      console.log('ws dam notification-server open', event)
    }
    ws.value.onerror = function (this: WebSocket, event: Event) {
      const { showWarning } = useAlerts()
      setTimeout(() => {
        showWarning(t('common.damImage.notificationsNotConnected'), -1)
      }, 3000)
      console.log('ws dam notification-server error', event)
    }
    ws.value.onmessage = function (this: WebSocket, event: MessageEvent) {
      const message = JSON.parse(event.data as string)
      const data = message.data.length ? JSON.parse(message.data) : undefined
      console.log(message.eventName, data)
      eventBus.emit({ name: message.eventName, data })
    }
  }

  return {
    openConnection,
    damNotificationsInitialized,
  }
}

export function useDamNotifications() {
  const eventBus = useDamNotificationsEventBus()

  const addDamNotificationListener = (callback: (event: DamNotification) => void) => {
    return eventBus.on(callback)
  }

  return {
    addDamNotificationListener,
  }
}
