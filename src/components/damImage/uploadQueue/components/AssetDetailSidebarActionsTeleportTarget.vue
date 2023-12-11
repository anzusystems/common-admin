<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useAssetDetailSidebarActionbar } from '@/components/damImage/uploadQueue/composables/assetDetailSidebarActionbar'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
  }>(),
  {
  }
)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { mounted, unMounted, divClassName } = useAssetDetailSidebarActionbar(props.queueKey)

onMounted(async () => {
  await nextTick()
  mounted()
})

onBeforeUnmount(() => {
  unMounted()
})
</script>

<template>
  <div :class="divClassName" />
</template>
