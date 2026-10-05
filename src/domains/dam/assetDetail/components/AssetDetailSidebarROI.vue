<script lang="ts" setup>
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useImageRoiStore } from '@/domains/dam/cropper/store/imageRoiStore'
import { useI18n } from 'vue-i18n'
import { usePagination } from '@/domains/api/composables/pagination'
import { assetFileIsImageFile } from '@/domains/dam/types/AssetFile'
import { cloneDeep, isNull } from '@/shared/utils/common'
import { computed, onMounted } from 'vue'
import AssetDetailSidebarActionsWrapper from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsWrapper.vue'
import AssetFileRotate from '@/domains/dam/assetDetail/components/AssetFileRotate.vue'
import { ENTITY, fetchRoi, useFetchImageRoiList } from '@/domains/dam/api/damImageRoiApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { SORT_BY_ID } from '@/domains/filters/datatable/utils/datatableColumns'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { fetchImageFile } from '@/domains/dam/api/damImageApi'
import type { DocId } from '@/shared/types/common'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAuthHelpers } from '@/domains/auth/composables/defineAuth'

const props = withDefaults(
  defineProps<{
    isActive: boolean
    queueKey: UploadQueueKey
    configName?: string
  }>(),
  {
    configName: 'default',
  }
)

const { t } = useI18n()
const { showErrorsDefault } = useAlerts()

const imageRoiStore = useImageRoiStore()
const assetDetailStore = useAssetDetailStore()

const { pagination } = usePagination(SORT_BY_ID)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient, endPointImage, endPointRoi, imageRotateAcl } = useCommonAdminCoreDamOptions(props.configName)
const { canSafeHelper } = useAuthHelpers()
// The endpoint refuses the rotation without it.
const rotateAllowed = computed(() => isNull(imageRotateAcl) || canSafeHelper(imageRotateAcl, undefined, 'rotate'))
const filterFieldsInner = [] satisfies readonly MakeFilterOption[]
const { filterConfig, filterData } = createFilter(filterFieldsInner, createFilterStore(filterFieldsInner), {
  system: SYSTEM_CORE_DAM,
  subject: ENTITY,
})

const loadImageFile = async (id: DocId) => {
  const res = await fetchImageFile(damClient, endPointImage, id)
  imageRoiStore.setImageFile(res)
}

const loadRois = async (forceReloadFile = false) => {
  imageRoiStore.showLoader()
  try {
    if (imageRoiStore.imageFile) {
      const { execute } = useFetchImageRoiList(damClient, endPointImage, imageRoiStore.imageFile.id)
      const res = await execute(pagination, filterData, filterConfig)
      if (res.length > 0 && res[0].id) {
        const roi = await fetchRoi(damClient, endPointRoi, res[0].id)
        if (forceReloadFile) {
          await loadImageFile(imageRoiStore.imageFile.id)
        }
        imageRoiStore.setRoi(roi)
        return
      }
    }
    imageRoiStore.setRoi(null)
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    imageRoiStore.hideLoader()
  }
}

const afterRotate = async () => {
  await loadRois(true)
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
      class="d-none d-md-flex"
      @click.stop="loadRois(true)"
    >
      {{ t('common.damImage.asset.detail.roi.refresh') }}
    </ABtnTertiary>
    <VBtn
      v-if="!imageRoiStore.loader"
      icon
      variant="text"
      size="small"
      class="d-flex d-md-none"
      :title="t('common.damImage.asset.detail.roi.refresh')"
      @click.stop="loadRois(true)"
    >
      <VIcon icon="mdi-refresh" />
    </VBtn>
  </AssetDetailSidebarActionsWrapper>
  <div class="px-3">
    <div class="v-expansion-panel-title px-0">
      {{ t('common.damImage.asset.detail.roi.title') }}
    </div>
    <div class="text-body-small">
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
      <div class="text-label-large">
        {{ item.title }}
      </div>
      <img
        v-if="imageRoiStore.imageFile"
        :src="item.url + '?manipulated=' + imageRoiStore.imageFile.manipulatedAt"
        :width="item.width"
        :height="item.height"
        alt=""
      />
    </div>
  </div>
  <AssetFileRotate
    v-if="imageRoiStore.imageFile && rotateAllowed"
    :image-id="imageRoiStore.imageFile.id"
    :config-name="configName"
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
