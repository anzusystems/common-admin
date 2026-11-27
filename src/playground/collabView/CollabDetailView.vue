<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { useRouter } from 'vue-router'
import { useCollabHelpers } from '@/domains/collab/composables/collabHelpers'
import { useCachedUsers } from '@/playground/collabView/cachedUsers'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import { onBeforeUnmount, onMounted } from 'vue'
import ACollabManagement from '@/domains/collab/components/ACollabManagement.vue'
import AActionEditButton from '@/domains/ui/buttons/action/components/AActionEditButton.vue'
import { useCollabCurrentUserId } from '@/domains/collab/composables/collabCurrentUserId'

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
} = useCollabRoom(collabRoom, true, addToCachedUsers, fetchCachedUsers)

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
        :fetch-cached-users="fetchCachedUsers"
        :cached-users="cachedUsers"
      />
    </VCardText>
  </VCard>
</template>
