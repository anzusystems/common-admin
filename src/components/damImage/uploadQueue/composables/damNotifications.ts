import { useWebSocket } from '@vueuse/core'
import { ref } from 'vue'
import { i18n } from '@/plugins/i18n'
import {
  type DamNotification,
  useDamNotificationsEventBus,
} from '@/components/damImage/uploadQueue/composables/damNotificationsEventBus'
import { useCommonAdminCoreDamOptionsGlobal } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useAlerts } from '@/composables/system/alerts'

const { t } = i18n.global || i18n

const damNotificationsInitialized = ref(false)

export function initDamNotifications() {
  const { notification } = useCommonAdminCoreDamOptionsGlobal()

  const enabled = notification.enabled && notification.webSocketUrl.length > 0

  const eventBus = useDamNotificationsEventBus()

  const { open } = useWebSocket(notification.webSocketUrl, {
    immediate: false,
    autoClose: false,
    autoReconnect: {
      retries: 10,
      delay: 5000,
    },
    onMessage(ws, event) {
      if (!enabled) return
      const message = JSON.parse(event.data as string)
      const data = message.data.length ? JSON.parse(message.data) : undefined
      eventBus.emit({ name: message.eventName, data })
    },
    onError() {
      if (!enabled) return
      const { showWarning } = useAlerts()
      setTimeout(() => {
        showWarning(t('common.damImage.notificationsNotConnected'), -1)
      }, 3000)
    },
  })

  const openConnection = () => {
    damNotificationsInitialized.value = true
    if (!enabled) return
    open()
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
