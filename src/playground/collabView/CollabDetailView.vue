<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { useRouter } from 'vue-router'
import { useCollabHelpers } from '@/components/collab/composables/collabHelpers'
import { useCachedUsers } from '@/playground/collabView/cachedUsers'
import { useCollabRoom } from '@/components/collab/composables/collabRoom'
import { onBeforeUnmount, onMounted } from 'vue'
import ACollabManagement from '@/components/collab/components/ACollabManagement.vue'
import AActionEditButton from '@/components/buttons/action/AActionEditButton.vue'
import { useCollabCurrentUserId } from '@/components/collab/composables/collabCurrentUserId'

const router = useRouter()

const { createCollabRoom } = useCollabHelpers()
const collabRoom = createCollabRoom(1, 'playground', 'cms')

const { addToCachedUsers, fetchCachedUsers, cachedUsers } = useCachedUsers()
const { currentUserId } = useCollabCurrentUserId()

const {
  subscribeCollabRoomInfo,
  unsubscribeCollabRoomInfo,
  addCollabReconnectListener,
  addApprovedJoinRequestListener,
} = useCollabRoom(collabRoom, true, addToCachedUsers, fetchCachedUsers as any)

onMounted(() => {
  subscribeCollabRoomInfo()
})

onBeforeUnmount(() => {
  unsubscribeCollabRoomInfo()
})

addCollabReconnectListener(() => {
  subscribeCollabRoomInfo()
})

addApprovedJoinRequestListener(() => {
  router.push({ name: 'view-collab-edit' })
})
</script>

<template>
  <ActionbarWrapper>
    <template #buttons>
      <AActionEditButton route-name="view-collab-edit" />
    </template>
  </ActionbarWrapper>

  <VCard>
    <VCardTitle>Collab Detail (current user id: {{ currentUserId }})</VCardTitle>
    <VCardText>
      <ACollabManagement
        :collab-room="collabRoom"
        :add-to-cached-users="addToCachedUsers"
        :fetch-cached-users="fetchCachedUsers as any"
        :cached-users="cachedUsers"
      />
    </VCardText>
  </VCard>
</template>
