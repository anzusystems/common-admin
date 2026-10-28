import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCollabField } from '@/domains/collab/composables/collabField'
import { useCollabStateInternal } from '@/domains/collab/composables/collabState'
import { CollabStatus, type CollabStatusType } from '@/domains/collab/types/Collab'

// A field holds the lock while it has the focus. A lost connection took it on the server, and a field focused while
// the editor was alone asked for none: typing on, the editor held no lock, and another could take the field.

type Fn = (...args: any[]) => any
const emitted: string[] = []
const socket = {
  connected: true,
  active: true,
  on: (_event: string, _fn: Fn) => undefined,
  emit: (event: string) => void emitted.push(event),
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

const ROOM = 'cms:article:2'
const FIELD = 'headline'

const roomIs = async (status: CollabStatusType | undefined) => {
  const { collabRoomInfoState } = useCollabStateInternal()
  if (status === undefined) collabRoomInfoState.delete(ROOM)
  else collabRoomInfoState.set(ROOM, { name: ROOM, status, users: [], moderator: null } as never)
  await nextTick()
}

// As in a component: its watcher goes with it.
let scope = effectScope()
const field = (reacquireWhenActive: boolean) =>
  scope.run(() => useCollabField(ROOM, FIELD, false, reacquireWhenActive))!

beforeEach(async () => {
  scope = effectScope()
  await roomIs(CollabStatus.Active)
  emitted.length = 0
})
afterEach(() => scope.stop())

describe('a field that holds its lock while focused', () => {
  it('asks for it again when the room is back after a lost connection', async () => {
    field(true).acquireCollabFieldLock()
    // Cleared on the reconnect, set again by the join.
    await roomIs(undefined)
    await roomIs(CollabStatus.Active)

    expect(emitted).toEqual(['acquireFieldLock', 'acquireFieldLock'])
  })

  it('asks for it when another editor arrives, focused while alone', async () => {
    await roomIs(CollabStatus.Inactive)
    emitted.length = 0
    field(true).acquireCollabFieldLock()
    await roomIs(CollabStatus.Active)

    expect(emitted).toEqual(['acquireFieldLock'])
  })

  it('asks for nothing once released', async () => {
    const collabField = field(true)
    collabField.acquireCollabFieldLock()
    collabField.releaseCollabFieldLock('x')
    await roomIs(undefined)
    await roomIs(CollabStatus.Active)

    expect(emitted).toEqual(['acquireFieldLock', 'releaseFieldLock'])
  })

  it('asks for nothing without the option', async () => {
    field(false).acquireCollabFieldLock()
    await roomIs(undefined)
    await roomIs(CollabStatus.Active)

    expect(emitted).toEqual(['acquireFieldLock'])
  })
})
