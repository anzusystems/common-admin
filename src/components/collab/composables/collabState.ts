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
// Plain, not reactive: bookkeeping for the map above, nothing renders from it.
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
   * The server serialises join and leave per room only for the lifetime of its lease, so a leave that
   * outruns it can acknowledge after a following join and mark a room inactive while the client is in
   * it — after which the client goes quiet with nothing visible to show for it.
   */
  const claimRoomInfoWrite = (room: CollabRoom) => {
    /* Never restarts. A per-room counter reset by `resetRoomInfoWrites` hands the same number out
     * twice, and a claim from before a reconnect would then match the re-join's after it. */
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
