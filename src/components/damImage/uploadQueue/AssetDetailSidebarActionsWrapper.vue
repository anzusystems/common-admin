<script lang="ts" setup>
import {
  useAssetDetailSidebarActionbar
} from '@/components/damImage/uploadQueue/composables/assetDetailSidebarActionbar'

const { canTeleport } = useAssetDetailSidebarActionbar()
</script>

<template>
  <Teleport
    v-if="canTeleport"
    to="#anzu-asset-detail-sidebar-actions"
  >
    <div class="w-100 text-right">
      <slot />
    </div>
  </Teleport>
</template>
