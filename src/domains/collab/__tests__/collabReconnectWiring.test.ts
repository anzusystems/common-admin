import { describe, expect, it, vi } from 'vitest'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import { useCollabState } from '@/domains/collab/composables/collabState'
import { useCollabCurrentUserId } from '@/domains/collab/composables/collabCurrentUserId'
import {
  CollabAccessRoomStatus,
  CollabConnectionState,
  CollabRequestToJoinStatus,
  CollabRoomJoinStrategy,
} from '@/domains/collab/types/Collab'

type Fn = (...args: any[]) => any
const handlers: Record<string, Fn> = {}
const managerHandlers: Record<string, Fn> = {}
const socket = {
  connected: true,
  active: true,
  on: (event: string, fn: Fn) => void (handlers[event] = fn),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  timeout: vi.fn(() => socket),
  io: { on: (event: string, fn: Fn) => void (managerHandlers[event] = fn) },
}
let ioOptions: { auth: (callback: (data: object) => void) => void } | undefined
let sameIdentity: boolean | undefined = true
const beforeReconnect = vi.fn()

initCommonAdminCollabOptions({
  enabled: true,
  socketUrl: 'ws://x',
  io: ((_url: string, options: typeof ioOptions) => {
    ioOptions = options
    return socket
  }) as never,
  beforeReconnect,
  isSameIdentity: () => sameIdentity,
})
useCollabCurrentUserId().setCollabUserCurrentId(7)
useCollabInit().initCollab()

const ROOM = 'cms:article:1'
const handshakeAuth = () => {
  let data: object | undefined
  ioOptions!.auth((value) => (data = value))
  return data
}

describe('collabInit', () => {
  it('names the user the page belongs to in every handshake', () => {
    expect(handshakeAuth()).toEqual({ userId: 7 })
    useCollabCurrentUserId().setCollabUserCurrentId(8)
    expect(handshakeAuth()).toEqual({ userId: 8 })
    useCollabCurrentUserId().setCollabUserCurrentId(7)
  })

  it("stops socket.io's own reconnection under another account", () => {
    sameIdentity = false
    socket.connected = false
    handlers.disconnect!('transport close')

    managerHandlers.reconnect_attempt!(1)

    const { collabConnectionState, collabReconnecting } = useCollabState()
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
    expect(collabConnectionState.value).toBe(CollabConnectionState.IdentityChanged)
    expect(collabReconnecting.value).toBe(true)
  })

  it('fails a join and a request to join at once while no connection can come', async () => {
    socket.timeout.mockClear()

    await expect(useCollabRoom(ROOM).joinCollabRoom({ joinStrategy: CollabRoomJoinStrategy.Moderated })).rejects.toBe(
      CollabAccessRoomStatus.Failed
    )
    await expect(useCollabRoom(ROOM).requestToJoinCollabRoom()).rejects.toBe(CollabRequestToJoinStatus.Failed)
    expect(socket.timeout).not.toHaveBeenCalled()
  })

  it("connects again on the user's retry and lets joins through once connected", async () => {
    sameIdentity = true
    socket.active = false
    beforeReconnect.mockResolvedValueOnce('ready')

    await useCollabState().reconnectCollab()
    expect(socket.connect).toHaveBeenCalledTimes(1)

    socket.connected = true
    socket.active = true
    handlers.connect!()
    expect(useCollabState().collabConnectionState.value).toBe(CollabConnectionState.Connected)

    void useCollabRoom(ROOM)
      .joinCollabRoom({ joinStrategy: CollabRoomJoinStrategy.Moderated })
      .catch(() => undefined)
    expect(socket.timeout).toHaveBeenCalled()
  })

  it('does not ask beforeReconnect after a transport error, only after a refusal', async () => {
    beforeReconnect.mockClear()
    socket.connected = false
    handlers.connect_error!(new Error('websocket error'))
    expect(beforeReconnect).not.toHaveBeenCalled()

    socket.active = false
    beforeReconnect.mockResolvedValueOnce('ready')
    handlers.connect_error!(Object.assign(new Error('Token invalid!'), { data: { reason: 'tokenInvalid' } }))
    await vi.waitFor(() => expect(beforeReconnect).toHaveBeenCalledTimes(1))
  })
})
