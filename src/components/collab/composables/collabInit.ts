import type {
  CollabRoom,
  CollabRoomData,
  CollabRoomInfo,
  CollabRoomLocks,
  CollabRoomPlainData,
} from '@/components/collab/types/Collab'
import { CollabStatus } from '@/components/collab/types/Collab'
import { io } from 'socket.io-client'
import {
  useCollabApprovedJoinRequestEventBus,
  useCollabApprovedRequestToTakeModerationEventBus,
  useCollabJoinRequestEventBus,
  useCollabKickedFromRoomEventBus,
  useCollabReconnectEventBus,
  useCollabRejectedJoinRequestEventBus,
  useCollabRejectedRequestToTakeModerationEventBus,
  useCollabRequestToTakeModerationEventBus,
  useCollabRoomDataChangeEventBus,
  useCollabStartingEventBus,
} from '@/components/collab/composables/collabEventBus'
import { useCollabState } from '@/components/collab/composables/collabState'
import { useAlerts } from '@/composables/system/alerts'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'

export function useCollabInit() {
  const { collabOptions } = useCommonAdminCollabOptions()
  const { showWarningT, showSuccessT } = useAlerts()
  const { collabConnected, collabSocket, collabRoomInfoState, collabFieldLocksState } = useCollabState()

  const initCollab = () => {
    const changeEventBus = useCollabRoomDataChangeEventBus()
    const reconnectEventBus = useCollabReconnectEventBus()
    const collabStartingEventBus = useCollabStartingEventBus()
    const requestAccessEventBus = useCollabJoinRequestEventBus()
    const approvedJoinRequestEventBus = useCollabApprovedJoinRequestEventBus()
    const rejectedJoinRequestEventBus = useCollabRejectedJoinRequestEventBus()
    const requestToTakeModerationEventBus = useCollabRequestToTakeModerationEventBus()
    const approvedRequestToTakeModerationEventBus = useCollabApprovedRequestToTakeModerationEventBus()
    const rejectedRequestToTakeModerationEventBus = useCollabRejectedRequestToTakeModerationEventBus()
    const kickedFromRoomEventBus = useCollabKickedFromRoomEventBus()

    if (collabSocket.value || !collabOptions.value.enabled) {
      return
    }

    collabSocket.value = io(collabOptions.value.socketUrl, {
      transports: ['websocket'],
      path: '/ws',
      forceNew: true,
    })
    collabSocket.value.on('collabRoomChanged', (room: CollabRoomInfo) => {
      try {
        if (collabRoomInfoState.has(room.name)) {
          collabRoomInfoState.set(room.name, room)
        }
      } catch (error) {
        console.error('error', error)
      }
    })
    collabSocket.value.on('collabRoomLocksChanged', (room: CollabRoom, locks: CollabRoomLocks) => {
      const locksEntries = Object.entries(locks)
      if (!collabFieldLocksState.has(room)) {
        collabFieldLocksState.set(room, new Map(locksEntries))
      }
      for (const [field, lock] of locksEntries) {
        if (!lock) {
          collabFieldLocksState.get(room)?.delete(field)
          continue
        }
        collabFieldLocksState.get(room)?.set(field, lock)
      }
    })
    collabSocket.value.on('collabRoomDataChanged', (room: CollabRoom, data: CollabRoomData) => {
      const dataEntries = Object.entries(data)
      for (const [field, fieldData] of dataEntries) {
        changeEventBus.emit({ room, field }, fieldData)
      }
    })
    collabSocket.value?.on('requestToJoin', (room: CollabRoom, userId: number, timestamp: number) => {
      requestAccessEventBus.emit({ room, userId, timestamp })
    })
    collabSocket.value?.on('approvedRequestToJoin', (room: CollabRoom) => {
      approvedJoinRequestEventBus.emit({ room })
    })
    collabSocket.value?.on('rejectedRequestToJoin', (room: CollabRoom) => {
      rejectedJoinRequestEventBus.emit({ room })
    })
    collabSocket.value?.on('requestToTakeModeration', (room: CollabRoom, userId: number, timestamp: number) => {
      requestToTakeModerationEventBus.emit({ room, userId, timestamp })
    })
    collabSocket.value?.on('approvedRequestToTakeModeration', (room: CollabRoom) => {
      approvedRequestToTakeModerationEventBus.emit({ room })
    })
    collabSocket.value?.on('rejectedRequestToTakeModeration', (room: CollabRoom) => {
      rejectedRequestToTakeModerationEventBus.emit({ room })
    })
    collabSocket.value?.on('transferredModeration', () => {
      showSuccessT('cms.collab.alert.transferredModeration')
    })
    collabSocket.value?.on('kickedFromRoom', (room: CollabRoom) => {
      showWarningT('cms.collab.alert.kickedFromRoom')
      kickedFromRoomEventBus.emit({ room })
    })
    collabSocket.value?.on('startCollab', async (room, callback: (data: CollabRoomPlainData) => void) => {
      collabStartingEventBus.emit({ room, startedCallback: callback })
    })
    collabSocket.value.on('connect', () => {
      collabRoomInfoState.clear()
      const connectedBefore = collabConnected.value
      collabConnected.value = collabSocket.value?.connected ?? false
      if (!connectedBefore) {
        reconnectEventBus.emit('reconnect')
      }
    })
    collabSocket.value.on('connect_error', () => {
      collabConnected.value = collabSocket.value?.connected ?? false
    })
    collabSocket.value.on('disconnect', (reason) => {
      collabRoomInfoState.forEach((roomInfo: CollabRoomInfo) => (roomInfo.status = CollabStatus.Inactive))
      collabConnected.value = collabSocket.value?.connected ?? false
      if (reason === 'io server disconnect') {
        collabSocket.value?.connect()
      }
    })
  }

  return {
    initCollab,
  }
}
