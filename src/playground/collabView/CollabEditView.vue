<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { useRoute, useRouter } from 'vue-router'
import { useCollabHelpers } from '@/domains/collab/composables/collabHelpers'
import { useCachedUsers } from '@/playground/collabView/cachedUsers'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { CollabConfig } from '@/domains/collab/types/Collab'
import { useCollabState } from '@/domains/collab/composables/collabState'
import AFormTextarea from '@/domains/form/components/AFormTextarea.vue'
import AFormTextField from '@/domains/form/components/AFormTextField.vue'
import AFormSwitch from '@/domains/form/components/AFormSwitch.vue'
import AFormDatetimePicker from '@/domains/form/components/AFormDatetimePicker.vue'
import AFormFlagDatetimePicker from '@/domains/form/components/AFormFlagDatetimePicker.vue'
import ACollabManagement from '@/domains/collab/components/ACollabManagement.vue'
import { useCollabCurrentUserId } from '@/domains/collab/composables/collabCurrentUserId'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import AActionCloseButtonHistory from '@/domains/ui/buttons/action/components/AActionCloseButtonHistory.vue'
import { useCollabAnyDataChange } from '@/domains/collab/composables/collabAnyDataChange'

const model = ref({
  inputOne: '',
  inputTwo: '',
  inputThree: '',
  inputFour: '',
  inputFive: '',
  editor: { type: 'doc', content: [] },
  switch: false,
  date1: null,
  date2: null,
  image: null,
})

const route = useRoute()
const router = useRouter()

const { addToCachedUsers, fetchCachedUsers, cachedUsers } = useCachedUsers()

const { createCollabFieldConfig } = useCollabHelpers()

const { currentUserId } = useCollabCurrentUserId()

// @ts-ignore
const collab = route.meta.collab?.(route.params) as CollabConfig
const {
  joinCollabRoom,
  addCollabReconnectListener,
  addKickedFromRoomListener,
  addCollabStartingListener,
  enteredCollabRoom,
  collabRoomLocks,
  collabRoomInfo,
  collabFieldDataBufferState,
} = useCollabRoom(collab.room, true, addToCachedUsers, fetchCachedUsers)
const { addCollabAnyDataChangeListener, objectSetDataByField } = useCollabAnyDataChange(collab.room)
const { gatherBufferData } = useCollabState()

addCollabReconnectListener(async () => {
  try {
    await joinCollabRoom({ joinStrategy: collab.joinStrategy, editors: collab.editors })
    enteredCollabRoom()
  } catch (error) {
    await router.push({ name: collab.occupiedOrKickedRedirectToRoute })
  }
})
addKickedFromRoomListener(() => {
  if (collab.occupiedOrKickedRedirectToRoute) {
    router.push({ name: collab.occupiedOrKickedRedirectToRoute, params: route.params })
  }
})

addCollabStartingListener((startedCallback) => {
  startedCallback(gatherBufferData(collab.room))
})

addCollabAnyDataChangeListener((field, data) => {
  objectSetDataByField(field, data, model)
})

onMounted(() => {
  enteredCollabRoom()
})

onBeforeUnmount(() => {
  collabFieldDataBufferState.delete(collab.room)
})
</script>

<template>
  <ActionbarWrapper>
    <template #buttons>
      <AActionCloseButtonHistory fallback-route-name="home" />
    </template>
  </ActionbarWrapper>

  <VCard>
    <VCardTitle>Collab Edit (current user id: {{ currentUserId }})</VCardTitle>
    <VCardText>
      <ACollabManagement
        :collab-room="collab.room"
        :add-to-cached-users="addToCachedUsers"
        :fetch-cached-users="fetchCachedUsers"
        :cached-users="cachedUsers"
        is-edit
      />
      <h2 class="text-headline-small mt-5 mb-3">Playground</h2>
      <div>
        <VRow>
          <VCol cols="8">
            <AFormTextarea
              v-model="model.inputOne"
              label="Test textarea field input lock"
              :collab="createCollabFieldConfig('testOneField', collab.room, cachedUsers)"
            />
            <AFormTextField
              v-model="model.inputTwo"
              label="Test text field input lock"
              :collab="createCollabFieldConfig('testTwoField', collab.room, cachedUsers)"
            />
            <AFormTextField
              v-model="model.inputThree"
              label="Test text field input lock"
              :collab="createCollabFieldConfig('testThreeField', collab.room, cachedUsers)"
            />
            <AFormTextField
              v-model="model.inputFour"
              label="Test text field input lock"
              :collab="createCollabFieldConfig('testFourField', collab.room, cachedUsers)"
            />
            <AFormTextField
              v-model="model.inputFive"
              label="Test text field input lock"
              :collab="createCollabFieldConfig('testFiveField', collab.room, cachedUsers)"
            />
            <AFormSwitch
              v-model="model.switch"
              label="Test switch"
              :collab="createCollabFieldConfig('testSwitch', collab.room, cachedUsers)"
            />
            <AFormDatetimePicker
              v-model="model.date1"
              label="Test datetime picker"
              :collab="createCollabFieldConfig('testDate1', collab.room, cachedUsers)"
            />
            <AFormFlagDatetimePicker
              v-model="model.date2"
              label="Test flag datetime picker"
              :collab="createCollabFieldConfig('testDate2', collab.room, cachedUsers)"
            />
          </VCol>
          <VCol cols="4">
            <AImageWidget
              v-model="model.image"
              :upload-licence="100000"
              :select-licences="[100000]"
              :collab="createCollabFieldConfig('collabImage', collab.room, cachedUsers)"
              queue-key="collabImage"
              label="Image"
            />
          </VCol>
        </VRow>
        <h2 class="text-headline-small mb-2">Room Info</h2>
        <pre>{{ collabRoomInfo }}</pre>
        <h2 class="text-headline-small mt-5 mb-2">Room Locks</h2>
        <pre>{{ collabRoomLocks }}</pre>
        <h2 class="text-headline-small mt-5 mb-2">Room Data buffer</h2>
        <pre>{{ collabFieldDataBufferState }}</pre>
      </div>
    </VCardText>
  </VCard>
</template>
