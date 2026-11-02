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
import { useCollabCurrentUserId } from '@/domains/collab/composables/collabCurrentUserId'
import { type CollabRefusal, createCollabRecovery } from '@/domains/collab/composables/collabRecovery'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'
import { useSentry } from '@/domains/system/composables/sentry'
import { isNull } from '@/shared/utils/common'

export function useCollabInit() {
  const { collabOptions } = useCommonAdminCollabOptions()
  const { showWarningT, showSuccessT } = useAlerts()
  const {
    collabConnected,
    collabSocket,
    collabConnectionState,
    setCollabRecover,
    collabRoomInfoState,
    collabFieldLocksState,
    collabFieldLocksUnanswered,
  } = useCollabStateInternal()
  const { currentUserId } = useCollabCurrentUserId()

  const { logError } = useSentry()

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
        // Read for every handshake: the server refuses cookies of another account than the page belongs to.
        auth: (callback) => callback({ userId: currentUserId.value }),
      })
      const recovery = createCollabRecovery({
        socket: collabSocket.value,
        state: collabConnectionState,
        beforeReconnect: () => collabOptions.value.beforeReconnect(),
        isSameIdentity: () => collabOptions.value.isSameIdentity?.(),
        logError,
      })
      setCollabRecover(recovery.retry)
      // Optional: the test doubles of the socket have no manager.
      collabSocket.value.io?.on('reconnect_attempt', () => {
        if (recovery.onReconnectAttempt()) collabConnected.value = false
      })
      if (typeof window !== 'undefined') {
        window.addEventListener('online', recovery.retryIfWaiting)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') recovery.retryIfWaiting()
        })
        window.addEventListener('pagehide', recovery.onPageHide)
        window.addEventListener('pageshow', (event) => recovery.onPageShow(event.persisted))
      }
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
      collabSocket.value.on('connect', () => {
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
        // The server released the old connection's locks, and timed-out requests were dropped from the send buffer.
        collabFieldLocksUnanswered.clear()
        recovery.onConnect()
        const connectedBefore = collabConnected.value
        collabConnected.value = collabSocket.value?.connected ?? false
        if (!connectedBefore) reconnectEventBus.emit('reconnect')
      })
      collabSocket.value.on('connect_error', (error: CollabRefusal) => {
        collabConnected.value = collabSocket.value?.connected ?? false
        // Still `active`: a transport error, socket.io reconnects on its own. Otherwise the server refused it.
        if (collabSocket.value?.active) return recovery.onTransportError()
        recovery.onRefused(error)
      })
      collabSocket.value.on('disconnect', (reason) => {
        collabRoomInfoState.forEach((roomInfo: CollabRoomInfo) => (roomInfo.status = CollabStatus.Inactive))
        collabConnected.value = collabSocket.value?.connected ?? false
        recovery.onDisconnect(reason)
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
