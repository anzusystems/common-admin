import type {
  CollabFieldData,
  CollabFieldDataEnvelope,
  CollabFieldName,
  CollabRoom,
} from '@/components/collab/types/Collab'
import { onBeforeUnmount, ref } from 'vue'
import {
  type CollabRoomDataChangedEvent,
  useCollabRoomDataChangeEventBus,
} from '@/components/collab/composables/collabEventBus'
import type { Fn } from '@vueuse/core'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import { useCollabState } from '@/components/collab/composables/collabState'
import { isUndefined } from '@/utils/common'

export function useCollabAnyDataChange(room: CollabRoom, autoUnsubscribe: boolean = true) {
  const { collabOptions } = useCommonAdminCollabOptions()
  const { collabSocket } = useCollabState()
  const changeEventBus = useCollabRoomDataChangeEventBus()

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
    collabSocket.value.emit('changeFieldData', room, field, data, () => {
      if (!isUndefined(callback)) callback()
    })
  }

  if(autoUnsubscribe === false) {
    onBeforeUnmount(() => {
      if (isUndefined(unsubscribeCollabAnyDataChangeListener.value)) return
      unsubscribeCollabAnyDataChangeListener.value()
    })
  }

  return {
    addCollabAnyDataChangeListener,
    unsubscribeCollabAnyDataChangeListener,
    changeCollabAnyData,
  }
}
