import { effectScope, shallowRef, watch } from 'vue'

// Whether the notification socket of a DAM configuration is open, for the upload queues: with it alive they poll
// only as a backup. A module of its own, with no options and no socket in it: a store reads the state without loading
// either.

// By the name of the configuration; one without a socket is not in it. A `Map`: a name such as `constructor` is no
// property every object has.
const pushAlive = shallowRef(new Map<string, boolean>())

/** Only `damNotifications.ts` calls this: the socket of the configurations `configNames` is open, or not. */
export const setDamNotificationsPushAlive = (alive: boolean, configNames: string[]) => {
  if (configNames.every((name) => (pushAlive.value.get(name) ?? false) === alive)) return
  const next = new Map(pushAlive.value)
  configNames.forEach((name) => next.set(name, alive))
  pushAlive.value = next
}

/**
 * The notification socket of the DAM configuration `configName`: `isPushAlive()` while it is open, `false` for a
 * configuration without one. Left out, `default`'s, whatever component calls it (the name is not inherited).
 * `onChange` is called whenever any socket of the page opens or closes.
 */
export function useDamNotificationsConnection(configName = 'default') {
  return {
    isPushAlive: () => pushAlive.value.get(configName) ?? false,
    onChange: (callback: () => void) => {
      // Detached: the caller subscribes with its first row, inside whatever scope is active then (a component
      // that adds a file), and listens for as long as it has rows.
      const scope = effectScope(true)
      scope.run(() => watch(pushAlive, () => callback(), { flush: 'sync' }))

      return () => scope.stop()
    },
  }
}
