<script setup lang="ts">
import { COMMON_CONFIG } from '@/model/commonConfig'
import { computed } from 'vue'
import type { DocIdNullable } from '@/types/common.ts'
import { useCommonAdminCoreDamOptionsGlobal } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    assetId: DocIdNullable
  }>(),
  {
    assetId: null,
  }
)

const { t } = useI18n()
const { adminDomain } = useCommonAdminCoreDamOptionsGlobal()

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
    {{ t('common.damImage.media.button.editInDam') }}
  </VBtn>
</template>
