<script lang="ts" setup>
import { computed } from 'vue'
import type { AssetFileFailReason } from '@/types/coreDam/AssetFile'
import { useAssetFileFailReason } from '@/components/damImage/uploadQueue/composables/assetFileFailReason'
import AChipNoLink from '@/components/AChipNoLink.vue'

const props = withDefaults(
  defineProps<{
    reason: AssetFileFailReason
  }>(),
  {}
)

const { getAssetFileFailReasonOption } = useAssetFileFailReason()
const reasonOption = computed(() => {
  return getAssetFileFailReasonOption(props.reason)
})
</script>

<template>
  <AChipNoLink v-if="reasonOption">
    {{ reasonOption.title }}
  </AChipNoLink>
</template>
