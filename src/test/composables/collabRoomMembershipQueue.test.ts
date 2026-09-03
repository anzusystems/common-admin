import { beforeEach, describe, expect, it } from 'vitest'
import type { CommonAdminCollabOptions } from '@/AnzuSystemsCommonAdmin'
import { initCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import { useCollabState } from '@/components/collab/composables/collabState'
import { useCollabRoom } from '@/components/collab/composables/collabRoom'
import { CollabAccessRoomStatus } from '@/components/collab/types/Collab'

type Ack = (error: Error | null, response?: unknown) => void

const okResponse = { status: CollabAccessRoomStatus.Ok, room: { status: 'active', users: [] } }

// So a test decides when the server answers, and can hold one operation open while another starts.
const createFakeSocket = () => {
  const emitted: Array<{ event: string; room: string; ack: Ack }> = []
  const socket = {
    timeout: () => socket,
    emit: (event: string, room: string, ...rest: unknown[]) => {
      const ack = rest.at(-1) as Ack
      emitted.push({ event, room, ack })
      return socket
    },
  }

  return { socket, emitted }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('collab room membership queue', () => {
  let emitted: Array<{ event: string; room: string; ack: Ack }>

  beforeEach(() => {
    initCommonAdminCollabOptions({
      enabled: true,
      socketUrl: 'ws://localhost',
      beforeReconnect: () => Promise.resolve(),
    } as CommonAdminCollabOptions)
    const fake = createFakeSocket()
    emitted = fake.emitted
    const { collabSocket } = useCollabState()
    collabSocket.value = fake.socket as never
  })

  it('holds a join until the leave before it has been acknowledged', async () => {
    const room = 'room-serialised'
    const { joinCollabRoom, leaveCollabRoom } = useCollabRoom(room)

    void leaveCollabRoom()
    await flush()
    expect(emitted).toHaveLength(1)
    expect(emitted[0].event).toBe('leaveCollabRoom')

    const join = joinCollabRoom()
    await flush()
    expect(emitted).toHaveLength(1)

    emitted[0].ack(null, okResponse)
    await flush()
    expect(emitted).toHaveLength(2)
    expect(emitted[1].event).toBe('joinCollabRoom')

    emitted[1].ack(null, okResponse)
    await expect(join).resolves.toBe(CollabAccessRoomStatus.Ok)
  })

  it('supersedes a queued join when a leave is requested behind it', async () => {
    const room = 'room-superseded'
    const { joinCollabRoom, leaveCollabRoom } = useCollabRoom(room)

    // Occupies the queue so the join below waits rather than emitting straight away.
    void leaveCollabRoom()
    await flush()
    const blocking = emitted[0]

    const join = joinCollabRoom()
    // The unmount of whoever asked for that join, while it is still queued.
    void leaveCollabRoom()

    blocking.ack(null, okResponse)
    await expect(join).rejects.toBe(CollabAccessRoomStatus.Superseded)

    await flush()
    expect(emitted.filter((entry) => entry.event === 'joinCollabRoom')).toHaveLength(0)
  })

  it('keeps serving the room after an operation rejects', async () => {
    const room = 'room-after-reject'
    const { joinCollabRoom } = useCollabRoom(room)

    const failing = joinCollabRoom()
    await flush()
    emitted[0].ack(new Error('timeout'))
    await expect(failing).rejects.toBe(CollabAccessRoomStatus.Failed)

    const second = joinCollabRoom()
    await flush()
    expect(emitted).toHaveLength(2)
    emitted[1].ack(null, okResponse)
    await expect(second).resolves.toBe(CollabAccessRoomStatus.Ok)
  })

  it('does not make one room wait for another', async () => {
    const { leaveCollabRoom } = useCollabRoom('room-a')
    const { joinCollabRoom } = useCollabRoom('room-b')

    void leaveCollabRoom()
    void joinCollabRoom()
    await flush()

    expect(emitted.map((entry) => entry.event)).toEqual(['leaveCollabRoom', 'joinCollabRoom'])
  })

  it('rejects without queueing when the socket is gone', async () => {
    const { collabSocket } = useCollabState()
    collabSocket.value = undefined
    const { joinCollabRoom } = useCollabRoom('room-no-socket')

    await expect(joinCollabRoom()).rejects.toBe(CollabAccessRoomStatus.Failed)
    expect(emitted).toHaveLength(0)
  })

  it('invalidates a queued join even when the leave itself cannot be sent', async () => {
    const room = 'room-leave-without-socket'
    const { joinCollabRoom, leaveCollabRoom } = useCollabRoom(room)
    const { collabSocket } = useCollabState()

    const blocking = leaveCollabRoom()
    await flush()
    const blockingEmit = emitted[0]

    const join = joinCollabRoom()

    // The socket drops, the owner unmounts, and the socket comes back before the join is dequeued.
    const socket = collabSocket.value
    collabSocket.value = undefined
    void leaveCollabRoom()
    collabSocket.value = socket

    blockingEmit.ack(null, okResponse)
    await expect(join).rejects.toBe(CollabAccessRoomStatus.Superseded)
    await blocking

    expect(emitted.filter((entry) => entry.event === 'joinCollabRoom')).toHaveLength(0)
  })

  it('rechecks the socket when the join reaches the front of the queue', async () => {
    const room = 'room-socket-lost'
    const { joinCollabRoom, leaveCollabRoom } = useCollabRoom(room)
    const { collabSocket } = useCollabState()

    void leaveCollabRoom()
    await flush()
    const blocking = emitted[0]

    const join = joinCollabRoom()
    collabSocket.value = undefined
    blocking.ack(null, okResponse)

    await expect(join).rejects.toBe(CollabAccessRoomStatus.Failed)
  })

  it('claims the room info write at the emit, not when the operation is queued', async () => {
    const room = 'room-claim'
    const { joinCollabRoom, leaveCollabRoom } = useCollabRoom(room)
    const { collabRoomInfoState } = useCollabState()

    void leaveCollabRoom()
    await flush()
    const leaveEmit = emitted[0]

    // Queued behind the leave. Were the claim taken now, the leave's acknowledgement below would
    // lose to it and its room info would be dropped.
    void joinCollabRoom()

    const leftRoom = { status: 'inactive', users: [] }
    leaveEmit.ack(null, { status: CollabAccessRoomStatus.Ok, room: leftRoom })
    await flush()

    expect(collabRoomInfoState.get(room)).toEqual(leftRoom)
  })
})

describe('collab room membership queue when collab is disabled', () => {
  beforeEach(() => {
    initCommonAdminCollabOptions({
      enabled: false,
      socketUrl: '',
      beforeReconnect: () => Promise.resolve(),
    } as CommonAdminCollabOptions)
  })

  it('rejects a join and resolves a leave without emitting', async () => {
    const { joinCollabRoom, leaveCollabRoom } = useCollabRoom('room-disabled')

    await expect(joinCollabRoom()).rejects.toBe(CollabAccessRoomStatus.Failed)
    await expect(leaveCollabRoom()).resolves.toBeUndefined()
  })
})
