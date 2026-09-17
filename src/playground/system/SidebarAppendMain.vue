<script lang="ts" setup>
import AAdminSwitcher from '@/components/AAdminSwitcher.vue'
import ACurrentUserDropdown from '@/components/ACurrentUserDropdown.vue'
import { currentUser } from '@/playground/system/currentUser'
import { computed } from 'vue'
import { mapFullToMinimal } from '@/playground/collabView/cachedUsers'
import type { AnzuUser } from '@/types/AnzuUser'

const userMinimal = computed(() => {
  return mapFullToMinimal(currentUser.value as AnzuUser)
})
</script>

<template>
  <div class="align-center justify-space-evenly py-1">
    <AAdminSwitcher config-url="https://web-static-common.smedata.sk/1.10.0/admin-switcher/config.localhost.json" />
    <ACurrentUserDropdown
      :current-user="userMinimal"
      settings-route-name="settings"
      logout-route-name="logout"
    />
  </div>
</template>
