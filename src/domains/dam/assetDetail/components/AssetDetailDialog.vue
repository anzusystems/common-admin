<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { type AssetDetailItemDto, DamAssetType } from '@/domains/dam/types/Asset'
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
  /**
   * `shown`: the asset the detail showed when it closed. Null when closed from its loader or when it showed none.
   */
  (e: 'close', shown: AssetDetailItemDto | null): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { asset, dialog, loading } = storeToRefs(assetDetailStore)

const { simpleAssetSidebarEnabled } = useCommonAdminCoreDamOptions(damConfigName)

const view = computed(() => assetDetailViewOfAsset(asset.value, simpleAssetSidebarEnabled))

// The asset shown when the close button is pressed.
// Captured before the store is emptied, because the host cannot read it from the store.
let shownAtClose: AssetDetailItemDto | null = null
const closeDialog = () => {
  shownAtClose = loading.value ? null : asset.value
  assetDetailStore.close()
  shownAtClose = null
}
// The store also closes the detail itself after a failed read. The host is told of either close, once.
// Only a change that removes this detail counts as its close.
// Until the host re-renders, this dialog still sees the next opening of its host or of another host.
const stopTellingHost = watch(
  dialog,
  (_now, before) => {
    if (before === props.queueKey) emit('close', shownAtClose)
  },
  { flush: 'sync' }
)
// The store is page-wide. A host unmounted with its detail open would leave its key in the store.
// The next host with that key then showed the detail at once, unasked.
// So the detail is closed with its host and its pending read is dropped. The host is not told because it is unmounting.
onBeforeUnmount(() => {
  stopTellingHost()
  if (dialog.value === props.queueKey) assetDetailStore.close()
})

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
