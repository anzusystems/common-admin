<script setup lang="ts">
import {
  type CollabDelayedRequest,
  CollabRequestToJoinStatus,
  CollabRequestToTakeModerationStatus,
  type CollabRoom,
  CollabStatus,
  type CollabUserId,
} from '@/components/collab/types/Collab'
import { useI18n } from 'vue-i18n'
import { computed, type Ref, ref } from 'vue'
import ACollabCountdown from '@/components/collab/components/ACollabCountdown.vue'
import { useCollabRoom } from '@/components/collab/composables/collabRoom'
import { useAlerts } from '@/composables/system/alerts'
import { useCollabCurrentUserId } from '@/components/collab/composables/collabCurrentUserId'
import type { AddToCachedArgs } from '@/composables/system/defineCached'
import type { IntegerId } from '@/types/common'
import type { Promisify } from '@vueuse/core'
import { isDefined } from '@/utils/common'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'
import type { CollabCachedUsersMap } from '@/components/collab/composables/collabHelpers'

const props = withDefaults(
  defineProps<{
    collabRoom: CollabRoom
    cachedUsers: CollabCachedUsersMap | Ref<CollabCachedUsersMap>
    isEdit?: boolean
    isAllowedToPurgeRoom?: boolean
    addToCachedUsers?: ((...args: AddToCachedArgs<IntegerId>) => void) | undefined
    fetchCachedUsers?: (() => Promisify<Promise<any>>) | undefined
  }>(),
  {
    isEdit: false,
    isAllowedToPurgeRoom: false,
    addToCachedUsers: undefined,
    fetchCachedUsers: undefined,
  }
)

const {
  collabRoomInfo,
  addJoinRequestListener,
  requestToJoinCollabRoom,
  approveRequestToJoinCollabRoom,
  rejectRequestToJoinCollabRoom,
  addApprovedJoinRequestListener,
  addRejectedJoinRequestListener,
  requestToTakeModeration,
  approveRequestToTakeModeration,
  rejectRequestToTakeModeration,
  addRequestToTakeModerationListener,
  addApprovedRequestToTakeModerationListener,
  addRejectedRequestToTakeModerationListener,
  kickUserFromRoom,
  purgeRoom,
  transferModeration,
  alertedOccupiedRooms,
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
} = useCollabRoom(props.collabRoom)

const { t } = useI18n()
const { showErrorT, showSuccessT } = useAlerts()

const { currentUserId } = useCollabCurrentUserId()

const approveRequestsToCollab = ref<CollabDelayedRequest[]>([])
const selectedIdsToCollab = ref<CollabUserId[]>([])
const collabUserIds = computed<CollabUserId[]>(() => {
  return collabRoomInfo.value.users.filter((userId) => userId !== currentUserId.value)
})
const moderatorManagementDialog = ref(false)
const approveRequestTakeModerationDialog = ref(false)
const moderationRequest = ref<null | CollabDelayedRequest>(null)
const requestToJoinAccepted = ref<boolean | null>(null)
const waitingFroApproval = ref(false)

addJoinRequestListener(async (userId: CollabUserId, timestamp: number) => {
  if (isDefined(props.addToCachedUsers)) props.addToCachedUsers(userId)
  if (isDefined(props.fetchCachedUsers)) props.fetchCachedUsers()
  if (!selectedIdsToCollab.value.includes(userId)) selectedIdsToCollab.value.push(userId)
  approveRequestsToCollab.value.push({ userId, timestamp })
})

addApprovedJoinRequestListener(() => {
  showSuccessT('common.collab.alert.approvedJoinRequest')
  waitingFroApproval.value = false
  requestToJoinAccepted.value = true
  alertedOccupiedRooms.value.delete(props.collabRoom)
})

addRejectedJoinRequestListener(() => {
  showErrorT('common.collab.alert.rejectedJoinRequest')
  waitingFroApproval.value = false
  requestToJoinAccepted.value = false
  alertedOccupiedRooms.value.delete(props.collabRoom)
})

addRequestToTakeModerationListener(async (userId: number, timestamp: number) => {
  if (isDefined(props.addToCachedUsers)) props.addToCachedUsers(userId)
  if (isDefined(props.fetchCachedUsers)) props.fetchCachedUsers()
  moderationRequest.value = { userId, timestamp }
  approveRequestTakeModerationDialog.value = true
})

addApprovedRequestToTakeModerationListener(() => {
  showSuccessT('common.collab.alert.approvedToTakeModeration')
  waitingFroApproval.value = false
})

addRejectedRequestToTakeModerationListener(() => {
  showErrorT('common.collab.alert.rejectedToTakeModeration')
  waitingFroApproval.value = false
})

const waitingForApprovalTimerDone = () => {
  waitingFroApproval.value = false
}

const showRequestToJoinCollabButton = computed(() => {
  return (
    requestToJoinAccepted.value === null &&
    collabRoomInfo.value.users.length &&
    !collabRoomInfo.value.users.includes(currentUserId.value ?? 0) &&
    !waitingFroApproval.value
  )
})

const showRequestToTakeModerationButton = computed(() => {
  return (
    props.isEdit &&
    collabRoomInfo.value.status === CollabStatus.Active &&
    collabRoomInfo.value.moderator !== currentUserId.value
  )
})

const showModeratorManagementDialog = computed(() => {
  return moderatorManagementDialog.value && collabRoomInfo.value.status === CollabStatus.Active
})

const showKickYourselfButton = computed(() => {
  return props.isEdit && collabRoomInfo.value.status === CollabStatus.Active
})

const showModeratorManagementButton = computed(() => {
  return (
    props.isEdit &&
    collabRoomInfo.value.moderator === currentUserId.value &&
    collabRoomInfo.value.status === CollabStatus.Active
  )
})

const showJoinCollaborationDialog = computed(() => {
  return !props.isEdit && alertedOccupiedRooms.value.has(props.collabRoom) && requestToJoinAccepted.value === null
})

const requestToJoinCollabTimerDone = (userId: number) => {
  approveRequestsToCollab.value = approveRequestsToCollab.value.filter((request) => request.userId !== userId)
  selectedIdsToCollab.value = selectedIdsToCollab.value.filter((id) => id !== userId)
}

const requestToJoinCollabRoomAction = async () => {
  try {
    await requestToJoinCollabRoom()
    waitingFroApproval.value = true
  } catch (error) {
    if (error === CollabRequestToJoinStatus.AlreadyRequested) {
      return void showErrorT('common.collab.alert.alreadyRequestedToJoin')
    }
    return void showErrorT('common.collab.alert.failedRequestedToJoin')
  }
}

const showModeratorManagementDialogAction = () => {
  moderatorManagementDialog.value = true
}

const requestToTakeModerationAction = async () => {
  try {
    await requestToTakeModeration()
    waitingFroApproval.value = true
  } catch (error) {
    if (error === CollabRequestToTakeModerationStatus.AlreadyRequested) {
      return void showErrorT('common.collab.alert.alreadyRequestedToTakeModeration')
    }
    return void showErrorT('common.collab.alert.failedRequestToTakeModeration')
  }
}

const approveRequestToCollaborate = () => {
  selectedIdsToCollab.value.forEach((selectedId) => {
    approveRequestToJoinCollabRoom(selectedId)
  })
  approveRequestsToCollab.value = approveRequestsToCollab.value.filter(
    (request) => !selectedIdsToCollab.value.includes(request.userId)
  )
  selectedIdsToCollab.value = []
}

const rejectRequestToCollaborate = () => {
  selectedIdsToCollab.value.forEach((selectedId) => {
    rejectRequestToJoinCollabRoom(selectedId)
  })
  approveRequestsToCollab.value = approveRequestsToCollab.value.filter(
    (request) => !selectedIdsToCollab.value.includes(request.userId)
  )
  selectedIdsToCollab.value = []
}

const resetRequestToTakeModeration = () => {
  moderationRequest.value = null
  approveRequestTakeModerationDialog.value = false
}

const rejectRequestToTakeModerationAction = () => {
  rejectRequestToTakeModeration()
  resetRequestToTakeModeration()
}

const approveRequestToTakeModerationAction = () => {
  approveRequestToTakeModeration()
  resetRequestToTakeModeration()
}

const transferModerationAction = (userId: CollabUserId) => {
  transferModeration(userId)
  moderatorManagementDialog.value = false
}

const kickUserAction = (userId: CollabUserId) => {
  kickUserFromRoom(userId)
  moderatorManagementDialog.value = false
}

const purgeRoomAction = () => {
  purgeRoom()
}

const kickYourselfAction = () => {
  kickUserFromRoom(currentUserId.value ?? 0)
}

const calculateWaitingSeconds = (timestamp: number) => {
  return Math.ceil((60000 - (new Date().getTime() - timestamp)) / 1000)
}
</script>

<template>
  <div>
    {{ t('common.collab.moderator') }}:
    <ACollabLockedByUser
      v-if="collabRoomInfo.moderator"
      :id="collabRoomInfo.moderator"
      :key="collabRoomInfo.moderator"
      :users="cachedUsers"
    />
    {{ t('common.collab.users') }}:
    <ACollabLockedByUser
      v-for="userId in collabRoomInfo.users.filter((user) => user !== collabRoomInfo.moderator)"
      :id="userId"
      :key="userId"
      :users="cachedUsers"
      class="mr-1"
    />
    <VDivider
      class="mx-2"
      inset
      vertical
    />
    <ABtnSecondary
      v-if="showRequestToJoinCollabButton"
      size="small"
      @click="requestToJoinCollabRoomAction"
    >
      {{ t('common.collab.requestToCollaborate') }}
    </ABtnSecondary>
    <VBtn
      v-if="waitingFroApproval"
      size="small"
      variant="text"
    >
      <VIcon
        class="mr-1"
        icon="mdi-loading mdi-spin"
      />
      {{ t('common.collab.waitingForApprove') }}
      <ACollabCountdown
        parentheses
        @done="waitingForApprovalTimerDone"
      />
    </VBtn>
    <ABtnIcon
      v-if="showModeratorManagementButton"
      size="small"
      @click="showModeratorManagementDialogAction"
    >
      <VIcon icon="mdi-account-details-outline" />
      <VTooltip
        anchor="bottom"
        activator="parent"
        :text="t('common.collab.moderatorManagement')"
      />
    </ABtnIcon>
    <VDialog
      v-if="approveRequestsToCollab.length"
      :model-value="true"
      width="auto"
    >
      <VCard v-if="approveRequestsToCollab.length">
        <ADialogToolbar>
          {{ t('common.collab.requestToCollaborateText') }}
        </ADialogToolbar>
        <VCardItem>
          <VList
            v-model:selected="selectedIdsToCollab"
            select-strategy="independent"
          >
            <VListItem
              v-for="request in approveRequestsToCollab"
              :key="request.userId"
              :value="request.userId"
            >
              <template #prepend>
                <ACollabLockedByUser
                  :id="request.userId"
                  :users="cachedUsers"
                />
              </template>
              <template #title>
                <ACollabCountdown
                  class="ml-3"
                  :seconds="calculateWaitingSeconds(request.timestamp)"
                  :label="t('common.collab.approvedAfterCountdown')"
                  @done="() => requestToJoinCollabTimerDone(request.userId)"
                />
              </template>
              <template #append="{ isActive, select }">
                <VCheckboxBtn
                  :model-value="isActive"
                  color="primary"
                  @click="() => select(isActive)"
                />
              </template>
            </VListItem>
          </VList>
        </VCardItem>
        <VCardActions>
          <VSpacer />
          <ABtnTertiary
            :disabled="!selectedIdsToCollab.length"
            @click="rejectRequestToCollaborate"
          >
            {{ t('common.collab.button.reject') }}
          </ABtnTertiary>
          <ABtnPrimary
            :disabled="!selectedIdsToCollab.length"
            @click.stop="approveRequestToCollaborate"
          >
            {{ t('common.collab.button.accept') }}
          </ABtnPrimary>
        </VCardActions>
      </VCard>
    </VDialog>
    <VDialog
      v-model="showModeratorManagementDialog"
      width="auto"
    >
      <VCard>
        <ADialogToolbar @on-cancel="moderatorManagementDialog = false">
          {{ t('common.collab.moderatorManagement') }}
        </ADialogToolbar>
        <VCardItem>
          <VList>
            <VListItem
              v-for="userId in collabUserIds"
              :key="userId"
              :link="false"
            >
              <template #title>
                <ACollabLockedByUser
                  :id="userId"
                  :users="cachedUsers"
                />
              </template>
              <template #append>
                <div class="ml-3">
                  <ABtnSecondary
                    size="small"
                    @click="transferModerationAction(userId)"
                  >
                    {{ t('common.collab.button.transferModeration') }}
                  </ABtnSecondary>
                  <ABtnTertiary
                    size="small"
                    @click="kickUserAction(userId)"
                  >
                    {{ t('common.collab.button.kickUser') }}
                  </ABtnTertiary>
                </div>
              </template>
            </VListItem>
          </VList>
        </VCardItem>
        <VCardActions>
          <VSpacer />
          <ABtnTertiary @click="moderatorManagementDialog = false">
            {{ t('common.button.close') }}
          </ABtnTertiary>
        </VCardActions>
      </VCard>
    </VDialog>
    <ABtnIcon
      v-if="showRequestToTakeModerationButton"
      size="small"
      @click="requestToTakeModerationAction"
    >
      <VIcon icon="mdi-account-switch" />
      <VTooltip
        anchor="bottom"
        activator="parent"
        :text="t('common.collab.requestToTakeModeration')"
      />
    </ABtnIcon>
    <ABtnTertiary
      v-if="showKickYourselfButton"
      size="small"
      @click="kickYourselfAction"
    >
      {{ t('common.collab.button.kickYourself') }}
    </ABtnTertiary>
    <ABtnIcon
      v-if="isAllowedToPurgeRoom"
      v-tooltip="t('common.collab.button.purgeCollabRoom')"
      size="small"
      variant="text"
      icon="mdi-delete-sweep"
      @click.stop="purgeRoomAction"
    />
    <VDialog
      v-if="moderationRequest"
      v-model="approveRequestTakeModerationDialog"
      width="auto"
    >
      <VCard>
        <ADialogToolbar>
          {{ t('common.collab.requestToTakeModerationTextTitle') }}
        </ADialogToolbar>
        <VCardItem>
          <VList>
            <VListItem>
              <template #prepend>
                <ACollabLockedByUser
                  :id="moderationRequest.userId"
                  :users="cachedUsers"
                />
              </template>
              <template #title>
                <span class="ml-1">{{ t('common.collab.requestToTakeModerationText') }}</span>
              </template>
            </VListItem>
          </VList>
        </VCardItem>
        <VCardActions>
          <VSpacer />
          <ABtnTertiary @click="rejectRequestToTakeModerationAction">
            {{ t('common.collab.button.reject') }}
          </ABtnTertiary>
          <ABtnPrimary @click.stop="approveRequestToTakeModerationAction">
            {{ t('common.collab.button.accept') }}
            <ACollabCountdown
              parentheses
              :seconds="calculateWaitingSeconds(moderationRequest.timestamp)"
              @done="resetRequestToTakeModeration"
            />
          </ABtnPrimary>
        </VCardActions>
      </VCard>
    </VDialog>
    <VDialog
      v-if="showJoinCollaborationDialog"
      :model-value="true"
      width="auto"
    >
      <VCard>
        <ADialogToolbar @on-cancel="alertedOccupiedRooms.delete(props.collabRoom)">
          {{ t('common.collab.occupiedEntityTitle') }}
        </ADialogToolbar>
        <VCardText>{{ t('common.collab.occupiedEntityText') }}</VCardText>
        <VCardActions>
          <VSpacer />
          <ABtnTertiary @click="alertedOccupiedRooms.delete(props.collabRoom)">
            {{ t('common.button.close') }}
          </ABtnTertiary>
          <ABtnPrimary
            v-if="showRequestToJoinCollabButton"
            @click="requestToJoinCollabRoomAction"
          >
            {{ t('common.collab.requestToCollaborate') }}
          </ABtnPrimary>
          <VBtn
            v-if="waitingFroApproval"
            variant="text"
          >
            <VIcon
              class="mr-1"
              icon="mdi-loading mdi-spin"
            />
            {{ t('common.collab.waitingForApprove') }}
            <ACollabCountdown
              parentheses
              @done="waitingForApprovalTimerDone"
            />
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
