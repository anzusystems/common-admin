import { describe, expect, it, vi } from 'vitest'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import { useCollabReconnectEventBus } from '@/domains/collab/composables/collabEventBus'

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
  it('a refusal does not leak the rejection and does not connect with what failed to refresh', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    beforeReconnect.mockRejectedValueOnce(new Error('refresh failed'))
    expect(() => handlers.connect_error!(new Error('jwt expired'))).not.toThrow()
    await vi.waitFor(() => expect(beforeReconnect).toHaveBeenCalledTimes(1))
    expect(socket.connect).not.toHaveBeenCalled()
  })

  it('connect announces the reconnect so rooms are rejoined, without asking beforeReconnect', () => {
    const reconnect = vi.fn()
    const off = useCollabReconnectEventBus().on(reconnect)
    handlers.disconnect!('transport close')
    socket.connected = true
    handlers.connect!()
    expect(reconnect).toHaveBeenCalledTimes(1)
    expect(beforeReconnect).not.toHaveBeenCalled()
    off()
  })
})
