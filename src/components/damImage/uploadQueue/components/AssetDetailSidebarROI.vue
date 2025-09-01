<script lang="ts" setup>
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useImageRoiStore } from '@/components/damImage/uploadQueue/composables/imageRoiStore'
import { useI18n } from 'vue-i18n'
import { usePagination } from '@/labs/filters/pagination'
import { assetFileIsImageFile } from '@/types/coreDam/AssetFile'
import { cloneDeep } from '@/utils/common'
import { onMounted } from 'vue'
import AssetDetailSidebarActionsWrapper from '@/components/damImage/uploadQueue/components/AssetDetailSidebarActionsWrapper.vue'
import AssetFileRotate from '@/components/damImage/uploadQueue/components/AssetFileRotate.vue'
import { ENTITY, fetchRoi, useFetchImageRoiList } from '@/components/damImage/uploadQueue/api/damImageRoiApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { SORT_BY_ID } from '@/composables/system/datatableColumns'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

withDefaults(
  defineProps<{
    isActive: boolean
    queueKey: UploadQueueKey
  }>(),
  {}
)

const { t } = useI18n()

const imageRoiStore = useImageRoiStore()
const assetDetailStore = useAssetDetailStore()

const { pagination } = usePagination(SORT_BY_ID)

const { damClient } = useCommonAdminCoreDamOptions()
const filterFieldsInner = [] satisfies readonly MakeFilterOption[]
const { filterConfig, filterData } = createFilter(filterFieldsInner, createFilterStore(filterFieldsInner), {
  system: SYSTEM_CORE_DAM,
  subject: ENTITY,
})

const loadRois = async () => {
  if (imageRoiStore.imageFile) {
    const { executeFetch } = useFetchImageRoiList(damClient, imageRoiStore.imageFile.id)
    imageRoiStore.showLoader()
    const res = await executeFetch(pagination, filterData, filterConfig)
    if (res.length > 0 && res[0].id) {
      const roi = await fetchRoi(damClient, res[0].id)
      imageRoiStore.setRoi(roi)
      imageRoiStore.hideLoader()
      return
    }
    imageRoiStore.setRoi(null)
    imageRoiStore.hideLoader()
    return
  }
  imageRoiStore.setRoi(null)
  imageRoiStore.hideLoader()
}

const afterRotate = async () => {
  await loadRois()
  imageRoiStore.forceReloadRoiPreviews()
  imageRoiStore.forceReloadCropper()
}

onMounted(async () => {
  imageRoiStore.reset()
  imageRoiStore.showLoader()
  if (
    assetDetailStore.asset &&
    assetDetailStore.asset.mainFile &&
    assetFileIsImageFile(assetDetailStore.asset.mainFile)
  ) {
    imageRoiStore.setImageFile(cloneDeep(assetDetailStore.asset.mainFile))
    await loadRois()
  }
  imageRoiStore.hideLoader()
})
</script>

<template>
  <AssetDetailSidebarActionsWrapper
    v-if="isActive"
    :queue-key="queueKey"
  >
    <ABtnTertiary
      v-if="!imageRoiStore.loader"
      @click.stop="imageRoiStore.forceReloadRoiPreviews()"
    >
      {{ t('common.damImage.asset.detail.roi.refresh') }}
    </ABtnTertiary>
  </AssetDetailSidebarActionsWrapper>
  <div class="px-3">
    <div class="v-expansion-panel-title px-0">
      {{ t('common.damImage.asset.detail.roi.title') }}
    </div>
    <div class="text-caption">
      {{ t('common.damImage.asset.detail.roi.description') }}
    </div>
  </div>
  <div
    v-if="imageRoiStore.loader"
    class="w-100 h-100 d-flex align-center justify-center"
  >
    <VProgressCircular
      indeterminate
      color="primary"
    />
  </div>
  <div
    v-else-if="imageRoiStore.roi"
    class="crop-preview pa-2"
  >
    <div
      v-for="item in imageRoiStore.roi?.links.image_roi_example"
      :key="item.url"
      class="pb-2"
    >
      <div class="text-subtitle-2">
        {{ item.title }}
      </div>
      <img
        :src="item.url + '?timestamp=' + imageRoiStore.timestampRoiPreviews"
        :width="item.width"
        :height="item.height"
        alt=""
      >
    </div>
  </div>
  <AssetFileRotate
    v-if="imageRoiStore.imageFile"
    :image-id="imageRoiStore.imageFile.id"
    class="mx-2"
    @after-rotate="afterRotate"
  />
</template>

<style lang="scss">
.crop-preview {
  width: 100%;

  img {
    max-width: 100%;
    height: auto;
  }
}
</style>
