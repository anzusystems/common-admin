import { describe, expect, it, vi } from 'vitest'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import { useCollabCurrentUserId } from '@/domains/collab/composables/collabCurrentUserId'
import { CollabRoomJoinStrategy } from '@/domains/collab/types/Collab'

// "Leave the collaboration" kicks the user's own user, and the server answers every kick with `kickedFromRoom`.
// Leaving then said "You were kicked from the collaboration".

const warnings = vi.hoisted(() => [] as string[])
vi.mock('@/domains/system/composables/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/system/composables/alerts')>()
  return {
    ...actual,
    useAlerts: () => ({ ...actual.useAlerts(), showWarningT: (key: string) => void warnings.push(key) }),
  }
})

type Fn = (...args: any[]) => any
const handlers: Record<string, Fn> = {}
const socket = {
  connected: true,
  active: true,
  on: (event: string, fn: Fn) => void (handlers[event] = fn),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  timeout: vi.fn(() => socket),
  io: { on: vi.fn() },
}

initCommonAdminCollabOptions({
  enabled: true,
  socketUrl: 'ws://x',
  io: (() => socket) as never,
  beforeReconnect: vi.fn(),
})
useCollabCurrentUserId().setCollabUserCurrentId(7)
useCollabInit().initCollab()

const ROOM = 'cms:article:1'

const kicked = (room: string) => {
  const listener = vi.fn()
  useCollabRoom(room).addKickedFromRoomListener(listener)
  handlers.kickedFromRoom!(room)
  return listener
}

describe('leaving the collaboration', () => {
  it('leaves without the "kicked" alert, and the page still leaves the room', () => {
    warnings.length = 0
    useCollabRoom(ROOM).kickUserFromRoom(7)
    expect(socket.emit).toHaveBeenCalledWith('kickUserFromRoom', ROOM, 7)

    expect(kicked(ROOM)).toHaveBeenCalledTimes(1)
    expect(warnings).toEqual([])
  })

  it('still alerts a kick by the moderator after the user left once', () => {
    warnings.length = 0
    kicked(ROOM)
    expect(warnings).toEqual(['common.collab.alert.kickedFromRoom'])
  })

  it('alerts the kick of another room and a kick of another user it sent', () => {
    warnings.length = 0
    useCollabRoom(ROOM).kickUserFromRoom(8)
    kicked(ROOM)
    useCollabRoom(ROOM).kickUserFromRoom(7)
    kicked('cms:article:2')
    expect(warnings).toEqual(['common.collab.alert.kickedFromRoom', 'common.collab.alert.kickedFromRoom'])
  })

  it('alerts a kick after a new join, when the leave was never answered', () => {
    warnings.length = 0
    useCollabRoom('cms:article:3').kickUserFromRoom(7)
    void useCollabRoom('cms:article:3')
      .joinCollabRoom({ joinStrategy: CollabRoomJoinStrategy.Moderated })
      .catch(() => undefined)
    kicked('cms:article:3')
    expect(warnings).toEqual(['common.collab.alert.kickedFromRoom'])
  })
})
