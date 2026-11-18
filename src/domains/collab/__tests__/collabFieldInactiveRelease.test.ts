import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCollabField } from '@/domains/collab/composables/collabField'
import { useCollabAnyDataChange } from '@/domains/collab/composables/collabAnyDataChange'
import { useCollabStateInternal } from '@/domains/collab/composables/collabState'
import { useCollabCurrentUserId } from '@/domains/collab/composables/collabCurrentUserId'
import { CollabStatus, type CollabStatusType } from '@/domains/collab/types/Collab'

// An editor holds a field and the other one leaves: the room is inactive, and a release there only wrote the
// buffer. The lock stayed on the server, and whoever came back found the field locked.

type Fn = (...args: any[]) => any
const emitted: string[] = []
const acks: Fn[] = []
const socket = {
  connected: true,
  active: true,
  on: (_event: string, _fn: Fn) => undefined,
  emit: (event: string, ...args: unknown[]) => {
    emitted.push(event)
    acks.push(args.at(-1) as Fn)
  },
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
const FIELD = 'headline'

const roomIs = (status: CollabStatusType) =>
  useCollabStateInternal().collabRoomInfoState.set(ROOM, { name: ROOM, status, users: [], moderator: null } as never)

const aloneIn = (lockedBy: number | null) => {
  const { collabFieldLocksState, collabFieldDataBufferState } = useCollabStateInternal()
  roomIs(CollabStatus.Inactive)
  collabFieldLocksState.set(ROOM, new Map(lockedBy === null ? [] : [[FIELD, lockedBy]]))
  collabFieldDataBufferState.delete(ROOM)
  return collabFieldDataBufferState
}

beforeEach(() => {
  emitted.length = 0
  acks.length = 0
  useCollabStateInternal().collabFieldLocksUnanswered.clear()
  socket.connected = true
  useCollabCurrentUserId().setCollabUserCurrentId(5)
})

describe('a release in an inactive room', () => {
  it('reaches the server too when this editor holds the lock', () => {
    const buffer = aloneIn(5)
    useCollabField(ROOM, FIELD).releaseCollabFieldLock('new headline')

    expect(emitted).toEqual(['releaseFieldLock'])
    expect(buffer.get(ROOM)?.get(FIELD)).toBe('new headline')
  })

  it('reaches the server too for a lock taken with `useCollabAnyDataChange`', () => {
    const buffer = aloneIn(5)
    useCollabAnyDataChange(ROOM).releaseCollabAnyLock(FIELD, 'pasted')

    expect(emitted).toEqual(['releaseFieldLock'])
    expect(buffer.get(ROOM)?.get(FIELD)).toBe('pasted')
  })

  // Granted after the client stopped waiting, a lock is told only to the others: the lock map never shows it.
  it('reaches the server too for a lock whose request timed out', () => {
    aloneIn(null)
    roomIs(CollabStatus.Active)
    const collabField = useCollabField(ROOM, FIELD)
    collabField.acquireCollabFieldLock()
    acks.at(-1)!(new Error('operation has timed out'))
    roomIs(CollabStatus.Inactive)
    collabField.releaseCollabFieldLock('x')

    expect(emitted).toEqual(['acquireFieldLock', 'releaseFieldLock'])
  })

  it('reaches the server too for a `useCollabAnyDataChange` lock whose request timed out', () => {
    aloneIn(null)
    roomIs(CollabStatus.Active)
    const anyDataChange = useCollabAnyDataChange(ROOM)
    anyDataChange.acquireCollabAnyLock(FIELD)
    acks.at(-1)!(new Error('operation has timed out'))
    roomIs(CollabStatus.Inactive)
    anyDataChange.releaseCollabAnyLock(FIELD, 'pasted')

    expect(emitted).toEqual(['acquireFieldLock', 'releaseFieldLock'])
  })

  // The retry can be refused while the slow request still holds the field on the server, which grants it after; a
  // release that timed out may not have reached it.
  it.each([
    [
      'useCollabField',
      () => {
        const collabField = useCollabField(ROOM, FIELD)
        return {
          acquire: () => collabField.acquireCollabFieldLock(),
          release: (value: string) => collabField.releaseCollabFieldLock(value),
        }
      },
    ],
    [
      'useCollabAnyDataChange',
      () => {
        const anyDataChange = useCollabAnyDataChange(ROOM)
        return {
          acquire: () => anyDataChange.acquireCollabAnyLock(FIELD),
          release: (value: string) => anyDataChange.releaseCollabAnyLock(FIELD, value),
        }
      },
    ],
  ])('keeps a timed-out request till a release of it is confirmed (%s)', (_name, use) => {
    aloneIn(null)
    roomIs(CollabStatus.Active)
    const { acquire, release } = use()
    acquire()
    acks.at(-1)!(new Error('operation has timed out'))
    acquire()
    acks.at(-1)!(null, { status: 'failed', reason: 'Failed to acquire a lock - concurrency' })
    roomIs(CollabStatus.Inactive)
    release('x')
    acks.at(-1)!(new Error('operation has timed out'))
    release('y')
    acks.at(-1)!(null, { status: 'ok', locks: { [FIELD]: 5 } })
    release('z')

    expect(emitted).toEqual(['acquireFieldLock', 'acquireFieldLock', 'releaseFieldLock', 'releaseFieldLock'])
  })

  it('stays in the buffer when the lock is someone else’s or there is no lock', () => {
    aloneIn(9)
    useCollabField(ROOM, FIELD).releaseCollabFieldLock('x')
    const { collabFieldLocksState } = useCollabStateInternal()
    collabFieldLocksState.get(ROOM)!.delete(FIELD)
    useCollabField(ROOM, FIELD).releaseCollabFieldLock('y')

    expect(emitted).toEqual([])
  })

  it('stays in the buffer while disconnected: the server let the lock go then', () => {
    aloneIn(5)
    socket.connected = false
    useCollabField(ROOM, FIELD).releaseCollabFieldLock('x')
    useCollabAnyDataChange(ROOM).releaseCollabAnyLock(FIELD, 'x')

    expect(emitted).toEqual([])
  })
})
