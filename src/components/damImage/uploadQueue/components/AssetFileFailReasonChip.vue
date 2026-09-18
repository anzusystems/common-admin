<script lang="ts" setup>
import { computed } from 'vue'
import type { AssetFileFailReasonType } from '@/types/coreDam/AssetFile'
import { useAssetFileFailReason } from '@/components/damImage/uploadQueue/composables/assetFileFailReason'
import AChipNoLink from '@/components/AChipNoLink.vue'

const props = withDefaults(
  defineProps<{
    reason: AssetFileFailReasonType
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
