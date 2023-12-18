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

const { enabled: collabEnabled } = useCommonAdminCollabOptions()
const collabConnected = ref(true)
const collabReconnecting = computed(() => collabEnabled && !collabConnected.value)
const collabSocket: Ref<Socket<CollabServerToClientEvents, CollabClientToServerEvents> | undefined> = ref()
const collabRoomInfoState = reactive(new Map<CollabRoom, CollabRoomInfo>())
const collabFieldLocksState = reactive(new Map<CollabRoom, Map<CollabFieldName, CollabFieldLock>>())
const collabFieldDataBufferState = reactive(new Map<CollabRoom, Map<CollabFieldName, CollabFieldData>>())

export function useCollabState() {
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

  return {
    collabReconnecting,
    collabConnected,
    collabSocket,
    collabRoomInfoState,
    collabFieldLocksState,
    collabFieldDataBufferState,
    gatherBufferData,
  }
}
