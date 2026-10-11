<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import AssetDetailDialogFrame from '@/domains/dam/assetDetail/components/AssetDetailDialogFrame.vue'
import AssetDetailDialogSidebar from '@/domains/dam/assetDetail/components/AssetDetailDialogSidebar.vue'
import { assetDetailViewOfAsset } from '@/domains/dam/assetDetail/composables/assetDetailView'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { IntegerId } from '@/shared/types/common'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    extSystem: IntegerId
    configName?: string
  }>(),
  {
    configName: undefined,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { asset, dialog, loading } = storeToRefs(assetDetailStore)

const { simpleAssetSidebarEnabled } = useCommonAdminCoreDamOptions(damConfigName)

const view = computed(() => assetDetailViewOfAsset(asset.value, simpleAssetSidebarEnabled))

const closeDialog = () => {
  assetDetailStore.setAsset(null)
  dialog.value = null
  emit('close')
}

const toolbarTitle = computed(() => {
  if (!asset.value) return ''
  return asset.value.texts.displayTitle
})
</script>

<template>
  <AssetDetailDialogFrame
    :loading="loading"
    :view="view"
    :ext-system="extSystem"
    :config-name="damConfigName"
    @close="closeDialog"
  >
    <template #title>
      <div>{{ t('common.damImage.asset.detail.sourceSystem') }}: {{ toolbarTitle }}</div>
    </template>
    <template #toolbar-actions>
      <VBtn
        :aria-label="t('common.button.close')"
        icon
        variant="text"
        :width="36"
        :height="36"
        class="mr-1"
        @click.stop="closeDialog"
      >
        <VIcon icon="mdi-close" />
        <VTooltip
          activator="parent"
          location="bottom"
        >
          {{ t('common.button.close') }}
        </VTooltip>
      </VBtn>
    </template>
    <template #sidebar="{ view: shown }">
      <AssetDetailDialogSidebar
        v-if="shown.id"
        :key="shown.id"
        :queue-key="queueKey"
        :ext-system="extSystem"
        :config-name="damConfigName"
        :asset-id="shown.id"
        :is-video="shown.assetType === DamAssetType.Video"
        :is-audio="shown.assetType === DamAssetType.Audio"
        :is-image="shown.assetType === DamAssetType.Image"
        :is-document="shown.assetType === DamAssetType.Document"
        :asset-status="shown.assetStatus"
        :asset-type="shown.assetType"
        :asset-main-file-status="shown.mainFile ? shown.mainFile.fileAttributes.status : undefined"
        :asset-main-file-fail-reason="shown.mainFile ? shown.mainFile.fileAttributes.failReason : undefined"
      />
    </template>
  </AssetDetailDialogFrame>
</template>
