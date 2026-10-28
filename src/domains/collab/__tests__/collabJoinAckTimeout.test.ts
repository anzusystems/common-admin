import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import { CollabRoomJoinStrategy } from '@/domains/collab/types/Collab'

// How long a join waits for the server is the caller's to set, and stays on the client: the options the server gets
// are stored as the room's and go out to everyone in it.

type Fn = (...args: any[]) => any
const emitted: { event: string; args: unknown[] }[] = []
const socket = {
  connected: true,
  active: true,
  on: (_event: string, _fn: Fn) => undefined,
  emit: (event: string, ...args: unknown[]) => void emitted.push({ event, args }),
  connect: vi.fn(),
  timeout: vi.fn(() => socket),
}
initCommonAdminCollabOptions({
  enabled: true,
  socketUrl: 'ws://x',
  io: (() => socket) as never,
  beforeReconnect: vi.fn(),
})
useCollabInit().initCollab()

const ROOM = 'cms:article:1'
const joinEmit = () => emitted.find((item) => item.event === 'joinCollabRoom')!

beforeEach(() => {
  emitted.length = 0
  socket.timeout.mockClear()
})

describe('the wait for a join', () => {
  it('is five seconds unless the caller says otherwise', () => {
    void useCollabRoom(ROOM)
      .joinCollabRoom({ joinStrategy: CollabRoomJoinStrategy.Moderated })
      .catch(() => undefined)

    expect(socket.timeout).toHaveBeenCalledWith(5000)
  })

  it('is the one the caller passes', () => {
    void useCollabRoom(ROOM)
      .joinCollabRoom({ joinStrategy: CollabRoomJoinStrategy.Moderated }, { ackTimeout: 15000 })
      .catch(() => undefined)

    expect(socket.timeout).toHaveBeenCalledWith(15000)
  })

  it('is not sent to the server with the room options', () => {
    void useCollabRoom(ROOM)
      .joinCollabRoom({ joinStrategy: CollabRoomJoinStrategy.Moderated }, { ackTimeout: 15000 })
      .catch(() => undefined)

    expect(joinEmit().args[1]).toEqual({ joinStrategy: CollabRoomJoinStrategy.Moderated })
  })

  it('of a leave is five seconds unless the caller says otherwise, and the one it passes', () => {
    void useCollabRoom(ROOM).leaveCollabRoom()
    expect(socket.timeout).toHaveBeenLastCalledWith(5000)

    void useCollabRoom(ROOM).leaveCollabRoom({ ackTimeout: 15000 })
    expect(socket.timeout).toHaveBeenLastCalledWith(15000)
  })
})
