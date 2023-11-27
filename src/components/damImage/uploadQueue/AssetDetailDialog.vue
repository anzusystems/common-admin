<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/themeSettings'
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import type { DocId } from '@/types/common'
import { DamAssetStatus, DamAssetType } from '@/types/coreDam/Asset'
import AssetDetailDialogLoader from '@/components/damImage/uploadQueue/AssetDetailDialogLoader.vue'
import AssetImage from '@/components/damImage/uploadQueue/AssetImage.vue'
import AssetDetailDialogSidebar from '@/components/damImage/uploadQueue/AssetDetailDialogSidebar.vue'
import { assetFileIsImageFile } from '@/types/coreDam/AssetFile'
import AssetImageRoiSelect from '@/components/damImage/uploadQueue/AssetImageRoiSelect.vue'

const { t } = useI18n()

const { toolbarColor } = useTheme()

const assetDetailStore = useAssetDetailStore()
const { asset, dialog, activeTab } = storeToRefs(assetDetailStore)
const loading = ref(false)

const closeDialog = () => {}

const postDelete = (data: DocId) => {
  // assetListStore.setDeletingById(data)
  // if (asset.value?.id === data) {
  //   assetDetailStore.setDeleting()
  // }
  closeDialog()
}

const sidebar = ref(true)

const toggleSidebar = () => {
  sidebar.value = !sidebar.value
}

const onImageLoad = () => {
  // imageLoading.value = false
}

const assetType = computed(() => {
  return asset.value?.attributes.assetType || DamAssetType.Default
})

const assetStatus = computed(() => {
  if (!asset.value) return DamAssetStatus.Default
  return asset.value.attributes.assetStatus
})

const isTypeImage = computed(() => {
  return assetType.value === DamAssetType.Image
})
const isTypeVideo = computed(() => {
  return assetType.value === DamAssetType.Video
})
const isTypeAudio = computed(() => {
  return assetType.value === DamAssetType.Audio
})
const isTypeDocument = computed(() => {
  return assetType.value === DamAssetType.Document
})

const imageProperties = computed(() => {
  if (asset.value?.mainFile && asset.value.mainFile.links && asset.value.mainFile.links.image_detail) {
    return {
      url: asset.value.mainFile.links.image_detail.url,
      width: asset.value.mainFile.links.image_detail.width,
      height: asset.value.mainFile.links.image_detail.height,
      bgColor:
        assetFileIsImageFile(asset.value.mainFile) &&
        asset.value.mainFile.imageAttributes &&
        asset.value.mainFile.imageAttributes.mostDominantColor
          ? asset.value.mainFile.imageAttributes.mostDominantColor
          : '#ccc',
    }
  }
  return {
    url: '',
    width: 356,
    height: 200,
    bgColor: '#ccc',
  }
})
const toolbarTitle = computed(() => {
  if (!asset.value) return ''
  return asset.value.texts.displayTitle
})

const assetMainFile = computed(() => {
  return asset.value?.mainFile || undefined
})
</script>

<template>
  <VDialog
    v-if="dialog"
    :model-value="true"
    fullscreen
  >
    <AssetDetailDialogLoader
      v-if="loading"
      @close-dialog="closeDialog"
    />
    <VCard
      v-else-if="asset"
      class="dam-image-detail"
      :class="{ 'dam-image-detail--sidebar-active': sidebar }"
    >
      <div class="dam-image-detail__wrapper d-flex flex-column">
        <VToolbar
          :color="toolbarColor"
          density="compact"
          :height="64"
          class="system-border-b pr-1"
        >
          <div class="text-subtitle-2 d-flex">
            <div>{{ toolbarTitle }}</div>
          </div>
          <VSpacer />
          <div>
            <VBtn
              :active="sidebar"
              :variant="sidebar ? 'flat' : 'text'"
              :color="sidebar ? 'secondary' : ''"
              icon
              class="mr-1"
              :width="36"
              :height="36"
              @click.stop="toggleSidebar"
            >
              <VIcon icon="mdi-information-outline" />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('coreDam.asset.detail.toggleInfo') }}
              </VTooltip>
            </VBtn>
            <VBtn
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
          </div>
        </VToolbar>
        <div class="d-flex w-100 h-100 position-relative">
          <div class="d-flex w-100 align-center dam-image-detail__left">
            <div
              v-if="activeTab === AssetDetailTabImageWithRoi.ROI"
              class="w-100 h-100 pa-2 d-flex align-center justify-center"
            >
              <AssetImageRoiSelect />
            </div>
            <div
              v-else
              class="w-100 h-100 pa-2 d-flex align-center justify-center"
            >
              <AssetImage
                :asset-type="assetType"
                :asset-status="assetStatus"
                :src="imageProperties.url"
                :background-color="imageProperties.bgColor"
                :width="imageProperties.width"
                :height="imageProperties.height"
                use-component
                @load="onImageLoad"
                @error="onImageLoad"
              />
            </div>
          </div>
          <div class="h-100 d-flex dam-image-detail__sidebar system-border-l">
            <AssetDetailDialogSidebar
              v-if="asset"
              :key="asset.id"
              :asset-id="asset.id"
              :is-video="isTypeVideo"
              :is-audio="isTypeAudio"
              :is-image="isTypeImage"
              :is-document="isTypeDocument"
              :asset-status="assetStatus"
              :asset-type="assetType"
              :asset-main-file-status="assetMainFile ? assetMainFile.fileAttributes.status : undefined"
              :asset-main-file-fail-reason="assetMainFile ? assetMainFile.fileAttributes.failReason : undefined"
              @post-delete="postDelete"
            />
          </div>
        </div>
      </div>
    </VCard>
  </VDialog>
</template>
