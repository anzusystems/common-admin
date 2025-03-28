import {
  type CollabChangeRoomLockCallbackTypes,
  type CollabFieldData,
  type CollabFieldDataEnvelope,
  type CollabFieldLockOptions,
  type CollabFieldName,
  type CollabRoom,
  CollabStatus,
  isCollabFailedChangeRoomLockCallback,
  isCollabSuccessChangeRoomLockCallback,
} from '@/components/collab/types/Collab'
import { computed, ref } from 'vue'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusEvent,
  type CollabFieldLockStatusPayload,
  CollabFieldLockType,
  type CollabGatheringBufferDataEvent,
  type CollabRoomDataChangedEvent,
  createFieldLockStatusPayload,
  useCollabFieldLockStatusEventBus,
  useCollabGatheringBufferDataEventBus,
  useCollabRoomDataChangeEventBus,
} from '@/components/collab/composables/collabEventBus'
import { type Fn, tryOnBeforeUnmount } from '@vueuse/core'
import { useCollabState } from '@/components/collab/composables/collabState'
import { isDefined, isUndefined } from '@/utils/common'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import { useCollabCurrentUserId } from '@/components/collab/composables/collabCurrentUserId'

export function useCollabField(room: CollabRoom, field: CollabFieldName, disableAutoUnsubscribe = false) {
  const { collabOptions } = useCommonAdminCollabOptions()
  const { currentUserId } = useCollabCurrentUserId()
  const { collabSocket, collabFieldLocksState, collabFieldDataBufferState, collabRoomInfoState } = useCollabState()

  const changeEventBus = useCollabRoomDataChangeEventBus()
  const unsubscribeCollabFieldDataChangeListener = ref<undefined | Fn>()
  const fieldChangeCallback = ref<undefined | ((payload: CollabFieldDataEnvelope) => void)>()

  const fieldLockStatusEventBus = useCollabFieldLockStatusEventBus()
  const unsubscribeCollabFieldLockStatusListener = ref<undefined | Fn>()
  const fieldLockStatusCallback = ref<undefined | ((payload: CollabFieldLockStatusPayload) => void)>()

  const collabGatheringBufferDataEventBus = useCollabGatheringBufferDataEventBus()
  const unsubscribeCollabGatheringBufferData = ref<undefined | Fn>()
  const collabGatheringBufferDataCallback = ref<undefined | Fn>()

  const fieldChangeEventBusListener = (event: CollabRoomDataChangedEvent, payload?: CollabFieldDataEnvelope) => {
    if (
      event.room !== room ||
      event.field !== field ||
      isUndefined(payload) ||
      isUndefined(fieldChangeCallback.value)
    ) {
      return
    }
    fieldChangeCallback.value(payload)
  }

  const fieldLockStatusEventBusListener = (
    event: CollabFieldLockStatusEvent,
    payload?: CollabFieldLockStatusPayload
  ) => {
    if (
      event.room !== room ||
      event.field !== field ||
      isUndefined(payload) ||
      isUndefined(fieldLockStatusCallback.value)
    ) {
      return
    }
    fieldLockStatusCallback.value(payload)
  }

  const collabGatheringBufferDataEventBusListener = (event: CollabGatheringBufferDataEvent) => {
    if (event.room === room && isDefined(collabGatheringBufferDataCallback.value)) {
      collabGatheringBufferDataCallback.value()
    }
  }

  const addCollabFieldDataChangeListener = (callback: (data: CollabFieldDataEnvelope) => void) => {
    fieldChangeCallback.value = callback
    unsubscribeCollabFieldDataChangeListener.value = changeEventBus.on(fieldChangeEventBusListener)
  }
  const addCollabFieldLockStatusListener = (callback: (data: CollabFieldLockStatusPayload) => void) => {
    fieldLockStatusCallback.value = callback
    unsubscribeCollabFieldLockStatusListener.value = fieldLockStatusEventBus.on(fieldLockStatusEventBusListener)
  }

  const addCollabGatheringBufferDataListener = (callback: () => void) => {
    collabGatheringBufferDataCallback.value = callback
    unsubscribeCollabGatheringBufferData.value = collabGatheringBufferDataEventBus.on(
      collabGatheringBufferDataEventBusListener
    )
  }

  tryOnBeforeUnmount(() => {
    if (disableAutoUnsubscribe) return
    if (isDefined(unsubscribeCollabFieldDataChangeListener.value)) {
      unsubscribeCollabFieldDataChangeListener.value()
    }
    if (isDefined(unsubscribeCollabFieldLockStatusListener.value)) {
      unsubscribeCollabFieldLockStatusListener.value()
    }
    if (isDefined(unsubscribeCollabGatheringBufferData.value)) {
      unsubscribeCollabGatheringBufferData.value()
    }
  })

  const lockedByUser = computed(() => {
    const roomLockData = collabFieldLocksState.get(room)
    if (roomLockData) {
      const lock = roomLockData.get(field)
      if (lock && currentUserId.value !== lock) {
        return lock
      }
    }
    return null
  })

  const acquireCollabFieldLock = (options: Partial<CollabFieldLockOptions> = {}) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    const roomInfo = collabRoomInfoState.get(room)
    if (roomInfo && roomInfo.status === CollabStatus.Inactive) return
    collabSocket.value
      ?.timeout(1000)
      .emit('acquireFieldLock', room, field, options, (error, response: CollabChangeRoomLockCallbackTypes) => {
        const statusEvent: CollabFieldLockStatusEvent = { field: apiName, room }
        if (error || isCollabFailedChangeRoomLockCallback(response)) {
          return void fieldLockStatusEventBus.emit(
            statusEvent,
            createFieldLockStatusPayload(CollabFieldLockType.Acquire, CollabFieldLockStatus.Failure)
          )
        }
        if (isCollabSuccessChangeRoomLockCallback(response)) {
          if (!collabFieldLocksState.has(room)) {
            collabFieldLocksState.set(room, new Map())
          }
          const locks = new Map(Object.entries(response.locks))
          for (const [field, lock] of locks.entries()) {
            collabFieldLocksState.get(room)?.set(field, lock)
          }

          return void fieldLockStatusEventBus.emit(
            statusEvent,
            createFieldLockStatusPayload(CollabFieldLockType.Acquire, CollabFieldLockStatus.Success)
          )
        }
      })
  }

  const releaseCollabFieldLock = (data: CollabFieldData, options: Partial<CollabFieldLockOptions> = {}) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    const roomInfo = collabRoomInfoState.get(room)
    if (roomInfo && roomInfo.status === CollabStatus.Inactive) {
      if (!collabFieldDataBufferState.has(room)) {
        collabFieldDataBufferState.set(room, new Map())
      }
      collabFieldDataBufferState.get(room)?.set(field, data)
      return
    }
    collabSocket.value
      ?.timeout(1000)
      .emit('releaseFieldLock', room, field, data, options, (error, response: CollabChangeRoomLockCallbackTypes) => {
        const statusEvent: CollabFieldLockStatusEvent = { field: apiName, room }
        if (error || isCollabFailedChangeRoomLockCallback(response)) {
          return void fieldLockStatusEventBus.emit(
            statusEvent,
            createFieldLockStatusPayload(CollabFieldLockType.Release, CollabFieldLockStatus.Failure)
          )
        }
        if (isCollabSuccessChangeRoomLockCallback(response)) {
          if (!collabFieldLocksState.has(room)) {
            collabFieldLocksState.set(room, new Map())
          }
          for (const field of Object.keys(response.locks)) {
            collabFieldLocksState.get(room)?.delete(field)
          }

          return void fieldLockStatusEventBus.emit(
            statusEvent,
            createFieldLockStatusPayload(CollabFieldLockType.Release, CollabFieldLockStatus.Success)
          )
        }
      })
  }

  const changeCollabFieldData = (data: CollabFieldData) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    const roomInfo = collabRoomInfoState.get(room)
    if (roomInfo && roomInfo.status === CollabStatus.Inactive) return
    collabSocket.value.emit('changeFieldData', room, field, data, () => {
      return
    })
  }

  return {
    addCollabFieldDataChangeListener,
    addCollabFieldLockStatusListener,
    addCollabGatheringBufferDataListener,
    acquireCollabFieldLock,
    releaseCollabFieldLock,
    changeCollabFieldData,
    lockedByUser,
    collabFieldDataBufferState,
    unsubscribeCollabFieldDataChangeListener,
    unsubscribeCollabFieldLockStatusListener,
    unsubscribeCollabGatheringBufferData,
  }
}
