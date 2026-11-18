import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import { useCollabStateInternal } from '@/domains/collab/composables/collabState'
import { CollabStatus, type CollabStatusType } from '@/domains/collab/types/Collab'

// What an editor writes alone goes to the buffer, and only a gather from this editor as moderator empties it. Back
// in a room where the others were, or after leaving, it stayed: once this editor was alone and the moderator again,
// it went out as the room's state over what the others had changed since.

type Fn = (...args: any[]) => any
const acks: Fn[] = []
const socket = {
  connected: true,
  active: true,
  on: (_event: string, _fn: Fn) => undefined,
  emit: (_event: string, ...args: unknown[]) => void acks.push(args.at(-1) as Fn),
  connect: vi.fn(),
  timeout: () => socket,
}
initCommonAdminCollabOptions({
  enabled: true,
  socketUrl: 'ws://x',
  io: (() => socket) as never,
  beforeReconnect: vi.fn(),
})
useCollabInit().initCollab()

const ROOM = 'cms:article:1'

const buffered = () => {
  const { collabFieldDataBufferState } = useCollabStateInternal()
  collabFieldDataBufferState.set(ROOM, new Map([['leadImage', 3]]))
  return collabFieldDataBufferState
}

const joinAnswered = async (status: CollabStatusType) => {
  const joined = useCollabRoom(ROOM).joinCollabRoom()
  acks.at(-1)!(null, { status: 'ok', room: { name: ROOM, status, users: [5, 6], moderator: 6 } })
  await joined
}

beforeEach(() => {
  acks.length = 0
})

describe('the buffer of a room', () => {
  it('is dropped on a join into a room the others are in', async () => {
    const buffer = buffered()
    await joinAnswered(CollabStatus.Active)

    expect(buffer.has(ROOM)).toBe(false)
  })

  it('is kept on a join into a room this editor is alone in: gathered when the next one comes', async () => {
    const buffer = buffered()
    await joinAnswered(CollabStatus.Inactive)

    expect(buffer.get(ROOM)?.get('leadImage')).toBe(3)
  })

  it('is dropped on a leave', () => {
    const buffer = buffered()
    void useCollabRoom(ROOM).leaveCollabRoom()

    expect(buffer.has(ROOM)).toBe(false)
  })
})
