import { describe, expect, it, vi } from 'vitest'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import { useCollabReconnectEventBus } from '@/domains/collab/composables/collabEventBus'

// A socket.io client that records the handlers collab registers and the ack of each emit, so a test
// can play the server.
type Fn = (...args: any[]) => any
const handlers: Record<string, Fn> = {}
const acks: Record<string, Fn> = {}
const socket = {
  connected: false,
  active: false,
  on: (event: string, fn: Fn) => void (handlers[event] = fn),
  emit: (event: string, ...args: any[]) => void (acks[event] = args[args.length - 1]),
  connect: vi.fn(),
  timeout: () => socket,
}
const beforeReconnect = vi.fn()
initCommonAdminCollabOptions({ enabled: true, socketUrl: 'ws://x', io: (() => socket) as never, beforeReconnect })
useCollabInit().initCollab()

describe('collabRoom.fetchRoomInfo', () => {
  it('answers the default when the server omits the room, without a TypeError in the ack', async () => {
    const addToCachedUsers = vi.fn()
    const { fetchRoomInfo } = useCollabRoom('cms:article:1', false, addToCachedUsers, vi.fn())
    const pending = fetchRoomInfo('cms:article:1')
    // socket.io calls the ack from its packet handler; a throw here is an uncaught error.
    expect(() => acks.fetchRoomsInfo!(null, {})).not.toThrow()
    await expect(pending).resolves.toMatchObject({ name: '', users: [] })
  })
})

describe('collabInit with a beforeReconnect that rejects', () => {
  it('connect_error still reconnects and does not leak the rejection', async () => {
    beforeReconnect.mockRejectedValueOnce(new Error('refresh failed'))
    await expect(handlers.connect_error!(new Error('jwt expired'))).resolves.toBeUndefined()
    expect(socket.connect).toHaveBeenCalledTimes(1)
  })

  it('connect still announces the reconnect so rooms are rejoined', async () => {
    const reconnect = vi.fn()
    const off = useCollabReconnectEventBus().on(reconnect)
    beforeReconnect.mockRejectedValueOnce(new Error('refresh failed'))
    handlers.disconnect!('transport close')
    socket.connected = true
    await expect(handlers.connect!()).resolves.toBeUndefined()
    expect(reconnect).toHaveBeenCalledTimes(1)
    off()
  })
})
