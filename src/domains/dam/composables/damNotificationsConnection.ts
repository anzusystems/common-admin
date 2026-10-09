import { effectScope, ref, watch } from 'vue'

// Whether the notification socket is open, for the upload queues: with it alive they poll only as a backup.
// A module of its own, with no options and no socket in it: a store reads the state without loading either.

const pushAlive = ref(false)

/** Only `damNotifications.ts` calls this. */
export const setDamNotificationsPushAlive = (alive: boolean) => {
  pushAlive.value = alive
}

export function useDamNotificationsConnection() {
  return {
    isPushAlive: () => pushAlive.value,
    onChange: (callback: () => void) => {
      // Detached: the caller subscribes with its first row, inside whatever scope is active then (a component
      // that adds a file), and listens for as long as it has rows.
      const scope = effectScope(true)
      scope.run(() => watch(pushAlive, () => callback(), { flush: 'sync' }))

      return () => scope.stop()
    },
  }
}
