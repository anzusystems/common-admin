<script setup lang="ts">
import { COMMON_CONFIG } from '@/shared/commonConfig'
import { computed } from 'vue'
import type { DocIdNullable } from '@/shared/types/common'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
const props = withDefaults(
  defineProps<{
    assetId?: DocIdNullable
    configName?: string
  }>(),
  {
    assetId: null,
    configName: undefined,
  }
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

// The DAM admin of the configuration, else the root one.
const { adminDomain, editAssetLabel } = useCommonAdminCoreDamOptions(damConfigName)

const href = computed(() => {
  return adminDomain + '/asset/' + props.assetId
})
</script>

<template>
  <VBtn
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
    size="small"
    label
    target="_blank"
    rel="noopener noreferrer"
    :href="href"
  >
    {{ editAssetLabel }}
  </VBtn>
</template>
