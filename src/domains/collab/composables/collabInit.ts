import type {
  CollabRoom,
  CollabRoomData,
  CollabRoomInfo,
  CollabRoomLocks,
  CollabRoomPlainData,
} from '@/domains/collab/types/Collab'
import { CollabStatus } from '@/domains/collab/types/Collab'
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
} from '@/domains/collab/composables/collabEventBus'
import { useCollabStateInternal } from '@/domains/collab/composables/collabState'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'
import { useSentry } from '@/domains/system/composables/sentry'
import { isNull } from '@/shared/utils/common'

export function useCollabInit() {
  const { collabOptions } = useCommonAdminCollabOptions()
  const { showWarningT, showSuccessT } = useAlerts()
  const { collabConnected, collabSocket, collabRoomInfoState, collabFieldLocksState, collabFieldLocksUnanswered } =
    useCollabStateInternal()

  const { logError } = useSentry()

  let authorizationReconnectTriggered = false

  const runBeforeReconnect = async () => {
    try {
      await collabOptions.value.beforeReconnect()
    } catch (error) {
      logError(error as Error, { level: 'warning', tags: { collabPhase: 'beforeReconnect' } })
    }
  }

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
    const io = collabOptions.value.io
    if (!io) {
      logError(new Error('Collab is enabled, but the plugin options pass no `io` from socket.io-client.'))
      return
    }

    try {
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
      collabSocket.value.on('collabRoomLocksChanged', (room: CollabRoom, locks: CollabRoomLocks | null) => {
        if (!isNull(locks)) {
          const locksEntries = Object.entries(locks)
          if (!collabFieldLocksState.has(room) || Object.keys(locks).length === 0) {
            collabFieldLocksState.set(room, new Map(locksEntries))
          }
          for (const [field, lock] of locksEntries) {
            if (!lock) {
              collabFieldLocksState.get(room)?.delete(field)
              continue
            }
            collabFieldLocksState.get(room)?.set(field, lock)
          }
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
        showSuccessT('common.collab.alert.transferredModeration')
      })
      collabSocket.value?.on('kickedFromRoom', (room: CollabRoom) => {
        showWarningT('common.collab.alert.kickedFromRoom')
        kickedFromRoomEventBus.emit({ room })
      })
      collabSocket.value?.on('startCollab', async (room, callback: (data: CollabRoomPlainData) => void) => {
        collabStartingEventBus.emit({ room, startedCallback: callback })
      })
      collabSocket.value.on('connect', async () => {
        /* Memberships from before a reconnect are stale; the server does not re-announce them.
         *
         * The write claims behind them are deliberately left alone. Socket.io drops the
         * acknowledgement of a packet it already put on the wire (`_clearAcks`), so one emitted
         * before the reconnect can no longer land here — but it keeps the acknowledgement of a
         * packet still in `sendBuffer`, which it delivers on this connection. Resetting the claims
         * would discard exactly those: a join emitted while the socket was still connecting is
         * flushed just before this handler runs, and its acknowledgement arrives a round trip
         * later to find its claim gone. */
        collabRoomInfoState.clear()
        // The server let the locks of the old connection go; a timed-out request was dropped from the send buffer.
        collabFieldLocksUnanswered.clear()
        // Without the reset a transient network error burns the flag and a later JWT
        // expiration never triggers a token refresh.
        authorizationReconnectTriggered = false
        const connectedBefore = collabConnected.value
        collabConnected.value = collabSocket.value?.connected ?? false
        if (!connectedBefore) {
          await runBeforeReconnect()
          reconnectEventBus.emit('reconnect')
        }
      })
      collabSocket.value.on('connect_error', async (error) => {
        if (!authorizationReconnectTriggered) {
          authorizationReconnectTriggered = true
          await runBeforeReconnect()
          collabSocket.value?.connect()
          return
        }
        collabConnected.value = collabSocket.value?.connected ?? false
        // active === true means socket.io will reconnect on its own; only a permanent
        // rejection is worth reporting.
        if (collabSocket.value?.active) {
          return
        }
        logError(error, { level: 'error', tags: { collabPhase: 'connectRejected' } })
      })
      collabSocket.value.on('disconnect', async (reason) => {
        collabRoomInfoState.forEach((roomInfo: CollabRoomInfo) => (roomInfo.status = CollabStatus.Inactive))
        collabConnected.value = collabSocket.value?.connected ?? false
        if (reason === 'io server disconnect') {
          await runBeforeReconnect()
          collabSocket.value?.connect()
        }
      })
    } catch (error) {
      // Not `message`: with `level` beside it Sentry reads the object as scope data and drops the key.
      logError(error as Error, { level: 'error', tags: { collabPhase: 'init' } })
    }
  }

  return {
    initCollab,
  }
}
