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
  /** `shown`: the asset the detail showed when it closed; none when it was closed from its loader, or had none. */
  (e: 'close', shown: AssetDetailItemDto | null): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { asset, dialog, loading } = storeToRefs(assetDetailStore)

const { simpleAssetSidebarEnabled } = useCommonAdminCoreDamOptions(damConfigName)

const view = computed(() => assetDetailViewOfAsset(asset.value, simpleAssetSidebarEnabled))

// What the detail shows while its button closes it. Noted before the store is emptied: its host cannot ask the store.
let shownAtClose: AssetDetailItemDto | null = null
const closeDialog = () => {
  shownAtClose = loading.value ? null : asset.value
  assetDetailStore.close()
  shownAtClose = null
}
// The store closes the detail by itself as well, after a read that failed: the host is told of either close, once.
// Only a change that takes this detail away is its close. Until its host has drawn again this dialog still sees what
// follows, the next opening of its host or of another.
const stopTellingHost = watch(
  dialog,
  (_now, before) => {
    if (before === props.queueKey) emit('close', shownAtClose)
  },
  { flush: 'sync' }
)
// A host that goes away with its detail open would leave its key in the store, which is the page's: the next host with
// that key drew the detail at once, over a page that had not asked for it. The detail is closed with its host, and its
// read on its way given up. That host is not told: it is going away.
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
