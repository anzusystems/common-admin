<script lang="ts" setup>
import AAdminSwitcher from '@/components/AAdminSwitcher.vue'
import ACurrentUserDropdown from '@/components/ACurrentUserDropdown.vue'
import { currentUser } from '@/views/system/currentUser'
</script>

<template>
  <div class="align-center justify-space-evenly py-1">
    <AAdminSwitcher config-url="https://web-static-common.smedata.sk/1.10.0/admin-switcher/config.localhost.json" />
    <ACurrentUserDropdown
      :current-user="currentUser"
      settings-route-name="settings"
      logout-route-name="logout"
    />
  </div>
</template>
