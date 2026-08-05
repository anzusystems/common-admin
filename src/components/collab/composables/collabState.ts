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
const collabSocket: Ref<
  Socket<CollabServerToClientEvents, CollabClientToServerEvents> | undefined
> = ref()
const collabRoomInfoState = reactive(new Map<CollabRoom, CollabRoomInfo>())
/* Plain, not reactive: bookkeeping for the map above, nothing renders from it. The counter is global
 * and never resets, so a sequence number is never reused — see `claimRoomInfoWrite`. */
let collabRoomInfoWriteCounter = 0
const collabRoomInfoWriteSeq = new Map<CollabRoom, number>()
const collabFieldLocksState = reactive(new Map<CollabRoom, Map<CollabFieldName, CollabFieldLock>>())
const collabFieldDataBufferState = reactive(
  new Map<CollabRoom, Map<CollabFieldName, CollabFieldData>>(),
)

export function useCollabState() {
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
   * The room lock on the server serialises join and leave only for the lifetime of its lease, not for
   * the lifetime of the action holding it. A leave whose work outruns the lease lets a subsequent
   * join acquire, finish and acknowledge first — and the leave then reports the membership it read
   * before that join, marking a room inactive while the client is in it. From there
   * `changeCollabAnyData` and lock acquisition return early on the inactive state and the client goes
   * quiet without any visible failure.
   *
   * Ordering acknowledgements at the source fixes it for every consumer, rather than asking each one
   * to serialise its own leave and join.
   */
  const claimRoomInfoWrite = (room: CollabRoom) => {
    /* From a counter that never restarts, rather than one derived from the room's current value. A
     * per-room counter reset by `resetRoomInfoWrites` hands the same number out twice: an
     * acknowledgement that claimed 1 before a reconnect matches the 1 claimed by the re-join after
     * it, passes the check, and writes its pre-reconnect room over the fresh one. */
    const seq = ++collabRoomInfoWriteCounter
    collabRoomInfoWriteSeq.set(room, seq)

    return () => collabRoomInfoWriteSeq.get(room) === seq
  }

  /** Invalidates every in-flight acknowledgement; pairs with `collabRoomInfoState.clear()`. */
  const resetRoomInfoWrites = () => {
    collabRoomInfoWriteSeq.clear()
  }

  return {
    collabReconnecting,
    collabConnected,
    collabSocket,
    collabRoomInfoState,
    claimRoomInfoWrite,
    resetRoomInfoWrites,
    collabFieldLocksState,
    collabFieldDataBufferState,
    gatherBufferData,
  }
}
