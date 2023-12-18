import {
  type CollabAccessRoomCallbackTypes,
  CollabAccessRoomStatus,
  type CollabAccessRoomStatusType,
  type CollabFieldLock,
  type CollabFieldName,
  CollabRequestToJoinStatus,
  type CollabRequestToJoinStatusCallback,
  type CollabRequestToJoinStatusType,
  CollabRequestToTakeModerationStatus,
  type CollabRequestToTakeModerationStatusCallback,
  type CollabRequestToTakeModerationStatusType,
  type CollabRoom,
  type CollabRoomInfo,
  type CollabRoomInfoCallback,
  type CollabRoomOptions,
  type CollabRoomPlainData,
  type CollabRoomsInfo,
  CollabStatus,
  isCollabSuccessAccessRoomCallback,
} from '@/components/collab/types/Collab'
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'
import {
  type CollabApprovedJoinRequestEvent,
  type CollabApprovedRequestToTakeModerationEvent,
  type CollabJoinRequestEvent,
  type CollabKickedFromRoomEvent,
  type CollabRejectedJoinRequestEvent,
  type CollabRejectedRequestToTakeModerationEvent,
  type CollabRequestToTakeModerationEvent,
  type CollabStartingEvent,
  useCollabApprovedJoinRequestEventBus,
  useCollabApprovedRequestToTakeModerationEventBus,
  useCollabJoinRequestEventBus,
  useCollabKickedFromRoomEventBus,
  useCollabReconnectEventBus,
  useCollabRejectedJoinRequestEventBus,
  useCollabRejectedRequestToTakeModerationEventBus,
  useCollabRequestToTakeModerationEventBus,
  useCollabStartingEventBus,
} from '@/components/collab/composables/collabEventBus'
import type { Fn, Promisify } from '@vueuse/core'
import { useCollabState } from '@/components/collab/composables/collabState'
import { isDefined, isUndefined } from '@/utils/common'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import type { AddToCachedArgs } from '@/composables/system/defineCached'
import type { IntegerId } from '@/types/common'
import type { AnzuUser } from '@/types/AnzuUser'

const alertedOccupiedRooms = ref(new Set<CollabRoom>())

export function useCollabRoom(
  room: CollabRoom,
  watchForNewUsers: boolean = false,
  addToCachedUsers: ((...args: AddToCachedArgs<IntegerId>) => void) | undefined = undefined,
  fetchCachedUsers: (() => Promisify<Promise<any>>) | undefined = undefined
) {
  const { collabSocket, collabRoomInfoState, collabFieldDataBufferState, collabFieldLocksState } = useCollabState()

  const reconnectEventBus = useCollabReconnectEventBus()
  const unsubscribeCollabReconnectListener = ref<undefined | Fn>()
  const reconnectCallback = ref<undefined | Fn>()

  const joinRequestEventBus = useCollabJoinRequestEventBus()
  const unsubscribeJoinRequestListener = ref<undefined | Fn>()
  const joinRequestCallback = ref<undefined | ((userId: number, timestamp: number) => void)>()

  const approvedJoinRequestEventBus = useCollabApprovedJoinRequestEventBus()
  const unsubscribeApprovedJoinRequestListener = ref<undefined | Fn>()
  const approvedJoinRequestCallback = ref<undefined | Fn>()

  const rejectedJoinRequestEventBus = useCollabRejectedJoinRequestEventBus()
  const unsubscribeRejectedJoinRequestListener = ref<undefined | Fn>()
  const rejectedJoinRequestCallback = ref<undefined | Fn>()

  const requestToTakeModerationEventBus = useCollabRequestToTakeModerationEventBus()
  const unsubscribeRequestToTakeModerationListener = ref<undefined | Fn>()
  const requestToTakeModerationCallback = ref<undefined | ((userId: number, timestamp: number) => void)>()

  const approvedRequestToTakeModerationEventBus = useCollabApprovedRequestToTakeModerationEventBus()
  const unsubscribeApprovedRequestToTakeModerationListener = ref<undefined | Fn>()
  const approvedRequestToTakeModerationCallback = ref<undefined | Fn>()

  const rejectedRequestToTakeModerationEventBus = useCollabRejectedRequestToTakeModerationEventBus()
  const unsubscribeRejectedRequestToTakeModerationListener = ref<undefined | Fn>()
  const rejectedRequestToTakeModerationCallback = ref<undefined | Fn>()

  const kickedFromRoomEventBus = useCollabKickedFromRoomEventBus()
  const unsubscribeKickedFromRoomListener = ref<undefined | Fn>()
  const kickedFromRoomCallback = ref<undefined | Fn>()

  const collabStartingEventBus = useCollabStartingEventBus()
  const unsubscribeCollabStartingListener = ref<undefined | Fn>()
  const collabStartingCallback = ref<undefined | ((startedCallback: (data: CollabRoomPlainData) => void) => void)>()

  const reconnectEventBusListener = () => {
    if (isDefined(reconnectCallback.value)) {
      reconnectCallback.value()
    }
  }

  const joinRequestEventBusListener = (event: CollabJoinRequestEvent) => {
    if (event.room === room && isDefined(joinRequestCallback.value)) {
      joinRequestCallback.value(event.userId, event.timestamp)
    }
  }

  const approvedJoinRequestEventBusListener = (event: CollabApprovedJoinRequestEvent) => {
    if (event.room === room && isDefined(approvedJoinRequestCallback.value)) {
      approvedJoinRequestCallback.value()
    }
  }

  const rejectedJoinRequestEventBusListener = (event: CollabRejectedJoinRequestEvent) => {
    if (event.room === room && isDefined(rejectedJoinRequestCallback.value)) {
      rejectedJoinRequestCallback.value()
    }
  }

  const requestToTakeModerationEventBusListener = (event: CollabRequestToTakeModerationEvent) => {
    if (event.room === room && isDefined(requestToTakeModerationCallback.value)) {
      requestToTakeModerationCallback.value(event.userId, event.timestamp)
    }
  }

  const approvedRequestToTakeModerationEventBusListener = (event: CollabApprovedRequestToTakeModerationEvent) => {
    if (event.room === room && isDefined(approvedRequestToTakeModerationCallback.value)) {
      approvedRequestToTakeModerationCallback.value()
    }
  }

  const rejectedRequestToTakeModerationEventBusListener = (event: CollabRejectedRequestToTakeModerationEvent) => {
    if (event.room === room && isDefined(rejectedRequestToTakeModerationCallback.value)) {
      rejectedRequestToTakeModerationCallback.value()
    }
  }

  const kickedFromCollabRookEventBusListener = (event: CollabKickedFromRoomEvent) => {
    if (event.room === room && isDefined(kickedFromRoomCallback.value)) {
      kickedFromRoomCallback.value()
    }
  }

  const collabStartingEventBusListener = (event: CollabStartingEvent) => {
    if (event.room === room && isDefined(collabStartingCallback.value)) {
      collabStartingCallback.value(event.startedCallback)
    }
  }

  const addJoinRequestListener = (callback: (userId: number, timestamp: number) => void) => {
    joinRequestCallback.value = callback
    unsubscribeJoinRequestListener.value = joinRequestEventBus.on(joinRequestEventBusListener)
  }

  const addApprovedJoinRequestListener = (callback: () => void) => {
    approvedJoinRequestCallback.value = callback
    unsubscribeApprovedJoinRequestListener.value = approvedJoinRequestEventBus.on(approvedJoinRequestEventBusListener)
  }

  const addRejectedJoinRequestListener = (callback: () => void) => {
    rejectedJoinRequestCallback.value = callback
    unsubscribeRejectedJoinRequestListener.value = rejectedJoinRequestEventBus.on(rejectedJoinRequestEventBusListener)
  }

  const addRequestToTakeModerationListener = (callback: (userId: number, timestamp: number) => void) => {
    requestToTakeModerationCallback.value = callback
    unsubscribeRequestToTakeModerationListener.value = requestToTakeModerationEventBus.on(
      requestToTakeModerationEventBusListener
    )
  }

  const addApprovedRequestToTakeModerationListener = (callback: () => void) => {
    approvedRequestToTakeModerationCallback.value = callback
    unsubscribeApprovedRequestToTakeModerationListener.value = approvedRequestToTakeModerationEventBus.on(
      approvedRequestToTakeModerationEventBusListener
    )
  }

  const addRejectedRequestToTakeModerationListener = (callback: () => void) => {
    rejectedRequestToTakeModerationCallback.value = callback
    unsubscribeRejectedRequestToTakeModerationListener.value = rejectedRequestToTakeModerationEventBus.on(
      rejectedRequestToTakeModerationEventBusListener
    )
  }

  const addCollabReconnectListener = (callback: () => void) => {
    reconnectCallback.value = callback
    unsubscribeCollabReconnectListener.value = reconnectEventBus.on(reconnectEventBusListener)
  }

  const addKickedFromRoomListener = (callback: () => void) => {
    kickedFromRoomCallback.value = callback
    unsubscribeKickedFromRoomListener.value = kickedFromRoomEventBus.on(kickedFromCollabRookEventBusListener)
  }

  const addCollabStartingListener = (callback: (startedCallback: (data: CollabRoomPlainData) => void) => void) => {
    collabStartingCallback.value = callback
    unsubscribeCollabStartingListener.value = collabStartingEventBus.on(collabStartingEventBusListener)
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      if (isDefined(unsubscribeJoinRequestListener.value)) {
        unsubscribeJoinRequestListener.value()
      }
      if (isDefined(unsubscribeApprovedJoinRequestListener.value)) {
        unsubscribeApprovedJoinRequestListener.value()
      }
      if (isDefined(unsubscribeRejectedJoinRequestListener.value)) {
        unsubscribeRejectedJoinRequestListener.value()
      }
      if (isDefined(unsubscribeRequestToTakeModerationListener.value)) {
        unsubscribeRequestToTakeModerationListener.value()
      }
      if (isDefined(unsubscribeApprovedRequestToTakeModerationListener.value)) {
        unsubscribeApprovedRequestToTakeModerationListener.value()
      }
      if (isDefined(unsubscribeRejectedRequestToTakeModerationListener.value)) {
        unsubscribeRejectedRequestToTakeModerationListener.value()
      }
      if (isDefined(unsubscribeKickedFromRoomListener.value)) {
        unsubscribeKickedFromRoomListener.value()
      }
      if (isDefined(unsubscribeCollabStartingListener.value)) {
        unsubscribeCollabStartingListener.value()
      }
    })
  }

  const { collabOptions } = useCommonAdminCollabOptions()

  const subscribeCollabRoomInfo = () => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('subscribeCollabRoomInfo', room, (response: CollabRoomInfoCallback) => {
      collabRoomInfoState.set(room, response.room)
    })
  }

  const unsubscribeCollabRoomInfo = () => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('unsubscribeCollabRoomInfo', room, (response: CollabRoomInfoCallback) => {
      collabRoomInfoState.set(room, response.room)
    })
  }

  const joinCollabRoom = async (options: Partial<CollabRoomOptions> = {}): Promise<CollabAccessRoomStatusType> => {
    return new Promise((resolve, reject) => {
      if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return reject(CollabAccessRoomStatus.Failed)
      collabSocket.value
        ?.timeout(5000)
        .emit('joinCollabRoom', room, options, (error, response: CollabAccessRoomCallbackTypes) => {
          if (error) {
            return void reject(CollabAccessRoomStatus.Failed)
          }
          if (isCollabSuccessAccessRoomCallback(response)) {
            collabRoomInfoState.set(room, response.room)
            return void resolve(response.status)
          }
          return void reject(response.status)
        })
    })
  }

  const leaveCollabRoom = () => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('leaveCollabRoom', room, (response: CollabAccessRoomCallbackTypes) => {
      if (isCollabSuccessAccessRoomCallback(response)) {
        collabRoomInfoState.set(room, response.room)
      }
    })
  }

  const enteredCollabRoom = () => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value?.emit('enteredCollabRoom', room)
  }

  const requestToJoinCollabRoom = (): Promise<CollabRequestToJoinStatusType> => {
    return new Promise((resolve, reject) => {
      if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) {
        return reject(CollabRequestToJoinStatus.Failed)
      }
      collabSocket.value
        ?.timeout(2000)
        .emit('requestToJoin', room, new Date().getTime(), (error, response: CollabRequestToJoinStatusCallback) => {
          if (error) {
            return void reject(CollabRequestToJoinStatus.Failed)
          }
          if (response.status === CollabRequestToJoinStatus.Ok) {
            return void resolve(response.status)
          }
          return void reject(response.status)
        })
    })
  }

  const approveRequestToJoinCollabRoom = (userId: number) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('approveRequestToJoin', room, userId)
  }

  const rejectRequestToJoinCollabRoom = (userId: number) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('rejectRequestToJoin', room, userId)
  }

  const requestToTakeModeration = async (): Promise<CollabRequestToTakeModerationStatusType> => {
    return new Promise((resolve, reject) => {
      if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) {
        return reject(CollabRequestToTakeModerationStatus.Failed)
      }
      collabSocket.value
        ?.timeout(2000)
        .emit(
          'requestToTakeModeration',
          room,
          new Date().getTime(),
          (error, response: CollabRequestToTakeModerationStatusCallback) => {
            if (error) {
              return void reject(CollabRequestToTakeModerationStatus.Failed)
            }
            if (response.status === CollabRequestToTakeModerationStatus.Ok) {
              return void resolve(response.status)
            }
            return void reject(response.status)
          }
        )
    })
  }

  const approveRequestToTakeModeration = () => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('approveRequestToTakeModeration', room)
  }

  const rejectRequestToTakeModeration = () => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('rejectRequestToTakeModeration', room)
  }

  const kickUserFromRoom = (userId: number) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('kickUserFromRoom', room, userId)
  }

  const transferModeration = (userId: number) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    collabSocket.value.emit('transferModeration', room, userId)
  }

  const fetchRoomInfo = async (room: CollabRoom): Promise<CollabRoomInfo> => {
    const baseRoomInfo: CollabRoomInfo = { name: '', status: CollabStatus.Inactive, users: [], moderator: null }
    return new Promise((resolve) => {
      if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return resolve(baseRoomInfo)
      collabSocket.value?.timeout(500).emit('fetchRoomsInfo', [room], (error, response: CollabRoomsInfo) => {
        if (error) return void resolve(baseRoomInfo)
        const roomInfo = response[room]
        if (isUndefined(roomInfo)) resolve(baseRoomInfo)
        if (!isUndefined(addToCachedUsers)) addToCachedUsers(roomInfo.users)
        if (!isUndefined(fetchCachedUsers)) fetchCachedUsers()

        return resolve(roomInfo)
      })
    })
  }

  const collabRoomInfo = computed((): CollabRoomInfo => {
    return collabRoomInfoState.get(room) ?? { name: room, moderator: null, users: [], status: CollabStatus.Inactive }
  })

  if (watchForNewUsers) {
    watch(
      collabRoomInfo,
      (newValue) => {
        if (newValue.users.length) {
          if (!isUndefined(addToCachedUsers)) addToCachedUsers(newValue.users)
          if (!isUndefined(fetchCachedUsers)) fetchCachedUsers()
        }
      },
      { immediate: true }
    )
  }

  const collabRoomLocks = computed((): Map<CollabFieldName, CollabFieldLock> => {
    return collabFieldLocksState.get(room) ?? new Map()
  })

  return {
    subscribeCollabRoomInfo,
    unsubscribeCollabRoomInfo,
    joinCollabRoom,
    leaveCollabRoom,
    requestToJoinCollabRoom,
    approveRequestToJoinCollabRoom,
    rejectRequestToJoinCollabRoom,
    addJoinRequestListener,
    addCollabReconnectListener,
    addApprovedJoinRequestListener,
    addRejectedJoinRequestListener,
    requestToTakeModeration,
    approveRequestToTakeModeration,
    rejectRequestToTakeModeration,
    addRequestToTakeModerationListener,
    addApprovedRequestToTakeModerationListener,
    addRejectedRequestToTakeModerationListener,
    enteredCollabRoom,
    kickUserFromRoom,
    transferModeration,
    addKickedFromRoomListener,
    addCollabStartingListener,
    fetchRoomInfo,
    collabRoomInfo,
    collabRoomLocks,
    collabFieldDataBufferState,
    alertedOccupiedRooms,
  }
}
