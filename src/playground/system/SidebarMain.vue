<script lang="ts" setup>
import SidebarItems from '@/playground/system/SidebarItems.vue'
import TestRouteSwitch from '@/components/TestRouteSwitch.vue'
</script>

<template>
  <div>
    <VList
      density="compact"
      nav
      color="primary"
    >
      <SidebarItems />
    </VList>
    <TestRouteSwitch
      :from="{ name: 'view-image' }"
      :to="{ name: 'home' }"
    />
  </div>
</template>
