<script lang="ts" setup>
import { useAssetDetailSidebarActionbar } from '@/domains/dam/assetDetail/composables/assetDetailSidebarActionbar'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
  }>(),
  {}
)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { canTeleport, divClassName } = useAssetDetailSidebarActionbar(props.queueKey)
</script>

<template>
  <Teleport
    v-if="canTeleport"
    :to="'.' + divClassName"
  >
    <div>
      <slot />
    </div>
  </Teleport>
</template>
