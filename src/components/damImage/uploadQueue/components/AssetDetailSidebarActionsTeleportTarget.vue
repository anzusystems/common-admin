<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import {
  useAssetDetailSidebarActionbar
} from '@/components/damImage/uploadQueue/composables/assetDetailSidebarActionbar'

const { mounted, unMounted } = useAssetDetailSidebarActionbar()

onMounted(async () => {
  await nextTick()
  mounted()
})

onBeforeUnmount(() => {
  unMounted()
})
</script>

<template>
  <div id="anzu-asset-detail-sidebar-actions" />
</template>
