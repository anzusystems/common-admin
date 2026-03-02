<script setup lang="ts">
import { COMMON_CONFIG } from '@/model/commonConfig'
import { computed } from 'vue'
import type { DocIdNullable } from '@/types/common'
import {
  useCommonAdminCoreDamOptionsGlobal,
  useCommonAdminCoreDamOptions,
} from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    assetId?: DocIdNullable
    configName?: string
  }>(),
  {
    assetId: null,
    configName: 'default',
  },
)

const { t } = useI18n()
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
    {{ editAssetLabel || t('common.damImage.image.button.editAsset') }}
  </VBtn>
</template>
