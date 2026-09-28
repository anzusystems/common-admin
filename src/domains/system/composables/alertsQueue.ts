import { ref, type Ref } from 'vue'

export type AlertType = 'success' | 'error' | 'info' | 'warning'

export interface AlertMessage {
  text: string
  color: AlertType
  timeout: number
}

// One queue per group, at module level: an alert raised while no host is mounted waits for one
// instead of being dropped.
const queues = new Map<string, Ref<AlertMessage[]>>()

export function useAlertsQueue(group = 'alerts'): Ref<AlertMessage[]> {
  let queue = queues.get(group)
  if (!queue) {
    queue = ref<AlertMessage[]>([])
    queues.set(group, queue)
  }
  return queue
}

/** `durationMs` below zero keeps the alert until it is closed. */
export function pushAlert(type: AlertType, text: string, durationMs: number, group = 'alerts') {
  useAlertsQueue(group).value.push({
    text,
    color: type,
    timeout: durationMs < 0 ? -1 : durationMs,
  })
}
