import { vi } from 'vitest'
import type { DamNotificationNameType } from '@/domains/dam/composables/damNotificationsEventBus'

// The notification server as the browser sees it: the global `WebSocket`.
// A frame is `{ eventName, data }` with `data` a JSON text, as `composables/damNotifications.ts` reads it.

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
        // As the browser: an address that is no URL of a socket, or has a fragment, is refused at once.
        let parsed: URL | null = null
        try {
          parsed = new URL(url)
        } catch {
          parsed = null
        }
        if (!parsed || !['ws:', 'wss:'].includes(parsed.protocol) || parsed.hash) {
          throw new DOMException(`The URL '${url}' is invalid.`, 'SyntaxError')
        }
        this.url = url
        sockets.push(this)
      }
    }
  )

  const latest = (url?: string) => {
    const socket = url === undefined ? sockets.at(-1) : [...sockets].reverse().find((one) => one.url === url)
    if (!socket) throw new Error(`No WebSocket was opened${url === undefined ? '' : ' at ' + url}.`)
    return socket
  }

  return {
    sockets,
    accept: (url?: string) => {
      const socket = latest(url)
      socket.readyState = 1
      socket.onopen?.(new Event('open'))
    },
    /**
     * Without `data` the frame carries an empty text, as the server sends it.
     */
    deliver: (eventName: DamNotificationNameType | string, data?: unknown, url?: string) => {
      const frame = { eventName, data: data === undefined ? '' : JSON.stringify(data) }
      latest(url).onmessage?.(new MessageEvent('message', { data: JSON.stringify(frame) }))
    },
    drop: (url: string) => {
      const socket = latest(url)
      socket.readyState = 3
      socket.onclose?.(new CloseEvent('close'))
    },
    restore: () => vi.unstubAllGlobals(),
  }
}

export type DamSocket = ReturnType<typeof stubDamSocket>
