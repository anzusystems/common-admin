<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import { AssetFileFailReason } from '@/domains/dam/types/AssetFile'
import AssetFileFailReasonChip from '@/domains/dam/assetDetail/components/AssetFileFailReasonChip.vue'

defineProps<{
  error: UploadQueueItem['error']
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="dam-upload-queue__overlay dam-upload-queue__overlay--error d-flex align-center justify-center flex-column"
  >
    <VIcon
      icon="mdi-alert"
      class="ma-1"
      size="x-small"
      color="error"
    />
    <div class="text-error">
      {{ t('common.damImage.queueItem.error') }}
    </div>
    <div
      v-if="error.message.length"
      class="text-body-small"
      v-text="error.message"
    />
    <div v-else-if="error.assetFileFailReason !== AssetFileFailReason.None">
      <AssetFileFailReasonChip :reason="error.assetFileFailReason" />
    </div>
    <div
      v-else
      class="text-body-small"
    >
      {{ t('common.damImage.uploadErrors.unknownError') }}
    </div>
  </div>
</template>
