<script setup lang="ts">
import { COMMON_CONFIG } from '@/shared/commonConfig'
import { computed } from 'vue'
import type { DocIdNullable } from '@/shared/types/common'
import {
  useCommonAdminCoreDamOptionsGlobal,
  useCommonAdminCoreDamOptions,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
const props = withDefaults(
  defineProps<{
    assetId?: DocIdNullable
    configName?: string
  }>(),
  {
    assetId: null,
    configName: 'default',
  }
)

const { adminDomain } = useCommonAdminCoreDamOptionsGlobal()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { editAssetLabel } = useCommonAdminCoreDamOptions(props.configName)

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
