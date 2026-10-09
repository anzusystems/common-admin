import { vi } from 'vitest'
import type { DamNotificationNameType } from '@/domains/dam/composables/damNotificationsEventBus'

// The notification server as the browser sees it: the global `WebSocket`. A frame is `{ eventName, data }` with
// `data` a JSON text, as `composables/damNotifications.ts` reads it.

export interface FakeSocket {
  url: string
  readyState: number
  onopen: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
}

export function stubDamSocket() {
  const sockets: FakeSocket[] = []

  vi.stubGlobal(
    'WebSocket',
    class implements FakeSocket {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3
      readyState = 0
      onopen: FakeSocket['onopen'] = null
      onclose: FakeSocket['onclose'] = null
      onerror: FakeSocket['onerror'] = null
      onmessage: FakeSocket['onmessage'] = null
      close = vi.fn()
      send = vi.fn()
      addEventListener = vi.fn()
      removeEventListener = vi.fn()
      url: string
      constructor(url: string) {
        this.url = url
        sockets.push(this)
      }
    }
  )

  const latest = () => {
    const socket = sockets.at(-1)
    if (!socket) throw new Error('No WebSocket was opened.')
    return socket
  }

  return {
    /** Every socket the code under test constructed. */
    sockets,
    /** The server accepts the connection. */
    accept: () => {
      const socket = latest()
      socket.readyState = 1
      socket.onopen?.(new Event('open'))
    },
    /** A frame of the notification server. Without `data` the frame carries an empty text, as the server sends it. */
    deliver: (eventName: DamNotificationNameType | string, data?: unknown) => {
      const frame = { eventName, data: data === undefined ? '' : JSON.stringify(data) }
      latest().onmessage?.(new MessageEvent('message', { data: JSON.stringify(frame) }))
    },
    restore: () => vi.unstubAllGlobals(),
  }
}

export type DamSocket = ReturnType<typeof stubDamSocket>
