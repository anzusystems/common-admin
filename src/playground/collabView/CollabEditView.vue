<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { useRoute, useRouter } from 'vue-router'
import { useCollabHelpers } from '@/components/collab/composables/collabHelpers'
import { useCachedUsers } from '@/playground/collabView/cachedUsers'
import { useCollabRoom } from '@/components/collab/composables/collabRoom'
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import type { CollabConfig } from '@/components/collab/types/Collab'
import { useCollabState } from '@/components/collab/composables/collabState'
import AActionCloseButton from '@/components/buttons/action/AActionCloseButton.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import AFormSwitch from '@/components/form/AFormSwitch.vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import AFormFlagDatetimePicker from '@/components/form/AFormFlagDatetimePicker.vue'
import ACollabManagement from '@/components/collab/components/ACollabManagement.vue'
import { useCollabCurrentUserId } from '@/components/collab/composables/collabCurrentUserId'

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
} = useCollabRoom(collab.room, true, addToCachedUsers, fetchCachedUsers as any)
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

onMounted(() => {
  enteredCollabRoom()
})

onBeforeUnmount(() => {
  collabFieldDataBufferState.delete(collab.room)
})

const model = reactive({
  inputOne: '',
  inputTwo: '',
  inputThree: '',
  inputFour: '',
  inputFive: '',
  editor: { type: 'doc', content: [] },
  switch: false,
  date1: null,
  date2: null,
})

</script>

<template>
  <ActionbarWrapper>
    <template #buttons>
      <AActionCloseButton route-name="home" />
    </template>
  </ActionbarWrapper>

  <VCard>
    <VCardTitle>Collab Edit (current user id: {{ currentUserId }})</VCardTitle>
    <VCardText>
      <ACollabManagement
        :collab-room="collab.room"
        :add-to-cached-users="addToCachedUsers"
        :fetch-cached-users="fetchCachedUsers as any"
        :cached-users="cachedUsers"
      />
      <h2 class="text-h6 mt-5 mb-3">
        Playground
      </h2>
      <div>
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
        <h2 class="text-h6 mb-2">
          Room Info
        </h2>
        <pre>{{ collabRoomInfo }}</pre>
        <h2 class="text-h6 mt-5 mb-2">
          Room Locks
        </h2>
        <pre>{{ collabRoomLocks }}</pre>
        <h2 class="text-h6 mt-5 mb-2">
          Room Data buffer
        </h2>
        <pre>{{ collabFieldDataBufferState }}</pre>
      </div>
    </VCardText>
  </VCard>
</template>
