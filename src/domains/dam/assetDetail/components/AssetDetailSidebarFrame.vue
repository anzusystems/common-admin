<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AssetDetailSidebarROI from '@/domains/dam/assetDetail/components/AssetDetailSidebarROI.vue'
import AssetDetailSidebarActionsTeleportTarget from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsTeleportTarget.vue'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

// Shared sidebar frame of the asset detail and the single-upload
// dialog: tabs, ROIs and the teleport target for the info tab buttons.
// Content above the tabs and inside the info tab belongs to each sidebar.

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    configName?: string
    roiTab: boolean
    simpleMode: boolean
  }>(),
  {
    configName: undefined,
  }
)

defineSlots<{
  prepend?(): unknown
  info(props: { isActive: boolean }): unknown
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()

const { activeTab } = storeToRefs(useAssetDetailStore())
</script>

<template>
  <div
    class="sidebar-info d-flex w-100 h-100 flex-column"
    :class="{ 'sidebar-info--no-tabs': simpleMode }"
  >
    <div class="w-100 h-100 d-flex flex-column">
      <VTabs
        v-if="!simpleMode"
        v-model="activeTab"
        show-arrows
        class="sidebar-info__tabs"
      >
        <VTab
          :value="AssetDetailTabImageWithRoi.Info"
          data-cy="button-meta"
        >
          {{ t('common.damImage.asset.detail.tabs.info') }}
        </VTab>
        <VTab
          v-if="roiTab"
          :value="AssetDetailTabImageWithRoi.ROI"
          data-cy="button-focus"
        >
          {{ t('common.damImage.asset.detail.tabs.roi') }}
        </VTab>
      </VTabs>

      <div class="sidebar-info__content">
        <slot name="prepend" />
        <template v-if="simpleMode">
          <div class="py-2">
            <slot
              name="info"
              :is-active="true"
            />
          </div>
          <div class="py-2">
            <AssetDetailSidebarROI
              :is-active="true"
              :queue-key="queueKey"
              :config-name="damConfigName"
            />
          </div>
        </template>
        <template v-else>
          <div
            v-if="activeTab === AssetDetailTabImageWithRoi.Info"
            class="py-2"
          >
            <slot
              name="info"
              :is-active="activeTab === AssetDetailTabImageWithRoi.Info"
            />
          </div>
          <div
            v-if="roiTab && activeTab === AssetDetailTabImageWithRoi.ROI"
            class="py-2"
          >
            <AssetDetailSidebarROI
              :is-active="activeTab === AssetDetailTabImageWithRoi.ROI"
              :queue-key="queueKey"
              :config-name="damConfigName"
            />
          </div>
        </template>
      </div>
      <div class="sidebar-info__actions px-2">
        <AssetDetailSidebarActionsTeleportTarget :queue-key="queueKey" />
      </div>
    </div>
  </div>
</template>
