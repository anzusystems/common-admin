<script lang="ts" setup>
import { computed } from 'vue'
import type { AssetFileFailReasonType } from '@/domains/dam/types/AssetFile'
import { useAssetFileFailReason } from '@/domains/dam/assetDetail/composables/assetFileFailReason'
import AChipNoLink from '@/domains/ui/components/AChipNoLink.vue'

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
