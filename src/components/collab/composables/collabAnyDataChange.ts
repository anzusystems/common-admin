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
import { type MaybeRef, ref, unref } from 'vue'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusEvent,
  CollabFieldLockType,
  type CollabRoomDataChangedEvent,
  createFieldLockStatusPayload,
  useCollabFieldLockStatusEventBus,
  useCollabRoomDataChangeEventBus,
} from '@/components/collab/composables/collabEventBus'
import { type Fn, tryOnBeforeUnmount } from '@vueuse/core'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import { useCollabState } from '@/components/collab/composables/collabState'
import { cloneDeep, isDefined, isUndefined } from '@/utils/common'
import { objectSetValueByPath } from '@/utils/object'

export function useCollabAnyDataChange(room: CollabRoom, disableAutoUnsubscribe = false) {
  const { collabOptions } = useCommonAdminCollabOptions()
  const { collabSocket, collabFieldLocksState, collabFieldDataBufferState, collabRoomInfoState } = useCollabState()
  const changeEventBus = useCollabRoomDataChangeEventBus()
  const fieldLockStatusEventBus = useCollabFieldLockStatusEventBus()

  const anyChangeCallback = ref<undefined | ((field: CollabFieldName, payload: CollabFieldDataEnvelope) => void)>()
  const unsubscribeCollabAnyDataChangeListener = ref<undefined | Fn>()

  const anyChangeEventBusListener = (event: CollabRoomDataChangedEvent, payload?: CollabFieldDataEnvelope) => {
    if (event.room !== room || isUndefined(payload) || isUndefined(anyChangeCallback.value)) {
      return
    }
    anyChangeCallback.value(event.field, payload)
  }

  const addCollabAnyDataChangeListener = (
    callback: (field: CollabFieldName, data: CollabFieldDataEnvelope) => void
  ) => {
    anyChangeCallback.value = callback
    unsubscribeCollabAnyDataChangeListener.value = changeEventBus.on(anyChangeEventBusListener)
  }

  const changeCollabAnyData = (field: CollabFieldName, data: CollabFieldData, callback: Fn | undefined = undefined) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    const roomInfo = collabRoomInfoState.get(room)
    if (roomInfo && roomInfo.status === CollabStatus.Inactive) return
    collabSocket.value.emit('changeFieldData', room, field, data, () => {
      if (!isUndefined(callback)) callback()
    })
  }

  const objectSetDataByField = <T extends object>(
    field: CollabFieldName,
    data: CollabFieldDataEnvelope,
    objectToUpdate: MaybeRef<T>
  ) => {
    const object = unref(objectToUpdate)
    switch (data.type) {
      case 'json':
        {
          objectSetValueByPath(object, field, cloneDeep(data.value))
        }
        break
      default: {
        objectSetValueByPath(object, field, data.value)
      }
    }
  }

  tryOnBeforeUnmount(() => {
    if (disableAutoUnsubscribe) return
    if (isDefined(unsubscribeCollabAnyDataChangeListener.value)) {
      unsubscribeCollabAnyDataChangeListener.value()
    }
  })

  const acquireCollabAnyLock = (field: CollabFieldName, options: Partial<CollabFieldLockOptions> = {}) => {
    if (!collabOptions.value.enabled || isUndefined(collabSocket.value)) return
    const roomInfo = collabRoomInfoState.get(room)
    if (roomInfo && roomInfo.status === CollabStatus.Inactive) return
    collabSocket.value
      ?.timeout(1000)
      .emit('acquireFieldLock', room, field, options, (error, response: CollabChangeRoomLockCallbackTypes) => {
        const statusEvent: CollabFieldLockStatusEvent = { field, room }
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
          const locks = new Map(response.locks ? Object.entries(response.locks) : [])
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

  const releaseCollabAnyLock = (
    field: CollabFieldName,
    data: CollabFieldData,
    options: Partial<CollabFieldLockOptions> = {}
  ) => {
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
        const statusEvent: CollabFieldLockStatusEvent = { field, room }
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
          if (response.locks) {
            for (const field of Object.keys(response.locks)) {
              collabFieldLocksState.get(room)?.delete(field)
            }
          }

          return void fieldLockStatusEventBus.emit(
            statusEvent,
            createFieldLockStatusPayload(CollabFieldLockType.Release, CollabFieldLockStatus.Success)
          )
        }
      })
  }

  return {
    addCollabAnyDataChangeListener,
    unsubscribeCollabAnyDataChangeListener,
    changeCollabAnyData,
    objectSetDataByField,
    acquireCollabAnyLock,
    releaseCollabAnyLock,
  }
}
