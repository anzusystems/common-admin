import type { Socket } from 'socket.io-client'
import type {
  CollabClientToServerEvents,
  CollabFieldData,
  CollabFieldLock,
  CollabFieldName,
  CollabRoom,
  CollabRoomInfo,
  CollabRoomPlainData,
  CollabServerToClientEvents,
} from '@/components/collab/types/Collab'
import { computed, reactive, ref, type Ref, toRaw } from 'vue'
import { useCollabGatheringBufferDataEventBus } from '@/components/collab/composables/collabEventBus'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'

const collabConnected = ref(true)
const collabSocket: Ref<Socket<CollabServerToClientEvents, CollabClientToServerEvents> | undefined> = ref()
const collabRoomInfoState = reactive(new Map<CollabRoom, CollabRoomInfo>())
// Plain, not reactive: bookkeeping for the map above, nothing renders from it.
let collabRoomInfoWriteCounter = 0
const collabRoomInfoWriteSeq = new Map<CollabRoom, number>()
const collabFieldLocksState = reactive(new Map<CollabRoom, Map<CollabFieldName, CollabFieldLock>>())
const collabFieldDataBufferState = reactive(new Map<CollabRoom, Map<CollabFieldName, CollabFieldData>>())

/**
 * Everything the collaboration modules share, the socket included. Internal: an admin reads
 * `useCollabState()`.
 */
export function useCollabStateInternal() {
  const { collabOptions } = useCommonAdminCollabOptions()

  const collabReconnecting = computed(() => collabOptions.value.enabled && !collabConnected.value)

  const gatherBufferData = (room: CollabRoom): CollabRoomPlainData => {
    const collabGatheringBufferDataEventBus = useCollabGatheringBufferDataEventBus()
    collabGatheringBufferDataEventBus.emit({ room })
    let dataBuffer: CollabRoomPlainData = {}
    const dataBufferMap = collabFieldDataBufferState.get(room)
    if (dataBufferMap) {
      dataBuffer = toRaw(Object.fromEntries(dataBufferMap.entries()))
      collabFieldDataBufferState.delete(room)
    }
    return dataBuffer
  }

  /**
   * Call before emitting anything whose acknowledgement writes `collabRoomInfoState`, and let the
   * returned predicate decide whether that write still applies.
   *
   * The server serialises join and leave per room only for the lifetime of its lease, so a leave that
   * outruns it can acknowledge after a following join and mark a room inactive while the client is in
   * it — after which the client goes quiet with nothing visible to show for it.
   */
  const claimRoomInfoWrite = (room: CollabRoom) => {
    /* Global and never restarting, so a number is never handed out twice. Claims outlive a
     * reconnect on purpose — see the `connect` handler in `collabInit.ts`. */
    const seq = ++collabRoomInfoWriteCounter
    collabRoomInfoWriteSeq.set(room, seq)

    return () => collabRoomInfoWriteSeq.get(room) === seq
  }

  return {
    collabReconnecting,
    collabConnected,
    collabSocket,
    collabRoomInfoState,
    claimRoomInfoWrite,
    collabFieldLocksState,
    collabFieldDataBufferState,
    gatherBufferData,
  }
}

/**
 * What an admin reads from the collaboration state: whether the connection is being re-established,
 * the rooms' info, and the buffered field data of a room (`gatherBufferData` collects and clears it).
 * The socket and the lock bookkeeping stay inside the library.
 */
export function useCollabState() {
  const { collabReconnecting, collabRoomInfoState, collabFieldDataBufferState, gatherBufferData } =
    useCollabStateInternal()

  return { collabReconnecting, collabRoomInfoState, collabFieldDataBufferState, gatherBufferData }
}
