import { useWebSocket } from '@vueuse/core'
import { inject, ref } from 'vue'
import type { CommonAdminCoreDamOptions } from '@/AnzuSystemsCommonAdmin'
import { CoreDamOptions } from '@/components/injectionKeys'
import { i18n } from '@/plugins/i18n'
import { useAlerts } from '@/composables/system/alerts'
import {
  type DamNotification,
  useDamNotificationsEventBus,
} from '@/components/dam/uploadQueue/damNotificationsEventBus'

const { t } = i18n.global || i18n

const damNotificationsInitialized = ref(false)

export function initDamNotifications() {
  const coreDamOptions = inject<CommonAdminCoreDamOptions | undefined>(CoreDamOptions, undefined)
  const enabled = coreDamOptions?.notification.enabled && coreDamOptions?.notification.webSocketUrl.length > 0
  console.log(coreDamOptions?.notification.webSocketUrl)

  const { open, ws } = useWebSocket(coreDamOptions?.notification.webSocketUrl, {
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
        showWarning(t('system.error.notificationsNotConnected'), -1)
      }, 3000)
      console.log('ws dam notification-server error', event)
    }
    ws.value.onmessage = function (this: WebSocket, event: MessageEvent) {
      const message = JSON.parse(event.data as string)
      console.log(message)
      console.log(message.eventName)
      eventBus.emit({ name: message.eventName, data: message.data.length ? JSON.parse(message.data) : undefined })
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
