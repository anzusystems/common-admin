import { effectScope, shallowRef, watch } from 'vue'

// Whether a DAM configuration's notification socket is open. While it is, upload queues poll only as a backup.
// Separate module with no options and no socket, so a store can read the state without loading either.

// Keyed by configuration name. Configurations without a socket are absent.
// A `Map`, so names like `constructor` do not hit object properties.
const pushAlive = shallowRef(new Map<string, boolean>())

/** Only `damNotifications.ts` calls this. Sets whether the socket of `configNames` is open. */
export const setDamNotificationsPushAlive = (alive: boolean, configNames: string[]) => {
  if (configNames.every((name) => (pushAlive.value.get(name) ?? false) === alive)) return
  const next = new Map(pushAlive.value)
  configNames.forEach((name) => next.set(name, alive))
  pushAlive.value = next
}

/**
 * Notification socket state of `configName`: `isPushAlive()` while open, `false` without a socket.
 * Defaults to `default` regardless of the calling component. The name is not inherited.
 * `onChange` fires whenever any socket of the page opens or closes.
 */
export function useDamNotificationsConnection(configName = 'default') {
  return {
    isPushAlive: () => pushAlive.value.get(configName) ?? false,
    onChange: (callback: () => void) => {
      // Detached: the caller subscribes with its first row, inside whatever scope is
      // active (e.g. a component adding a file), and listens as long as it has rows.
      const scope = effectScope(true)
      scope.run(() => watch(pushAlive, () => callback(), { flush: 'sync' }))

      return () => scope.stop()
    },
  }
}
