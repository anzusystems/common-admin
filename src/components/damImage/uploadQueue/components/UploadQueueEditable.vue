<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueItem, UploadQueueKey } from '@/types/coreDam/UploadQueue'
import UploadQueueItemEditable from '@/components/damImage/uploadQueue/components/UploadQueueItemEditable.vue'
import AssetQueueSelectedSidebar from '@/components/damImage/uploadQueue/components/AssetQueueSelectedSidebar.vue'
import { useDamCachedKeywords } from '@/components/damImage/uploadQueue/keyword/cachedKeywords'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import type { DocId, IntegerId } from '@/types/common'
import { fetchAsset } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { DamAssetStatus, DamAssetType } from '@/types/coreDam/Asset'
import { useAlerts } from '@/composables/system/alerts'
import { AssetFileProcessStatus } from '@/types/coreDam/AssetFile'

const props = withDefaults(
  defineProps<{
    queueKey: string
    extSystem: IntegerId
    massOperations: boolean
    disableDoneAnimation?: boolean
  }>(),
  {
    disableDoneAnimation: false,
  }
)

const emit = defineEmits<{
  (e: 'showDetail', data: DocId): void
}>()

const { damClient } = useCommonAdminCoreDamOptions()

const refreshDisabled = ref(false)

const uploadQueuesStore = useUploadQueuesStore()

const list = computed(() => {
  return uploadQueuesStore.getQueueItems(props.queueKey)
})

const cancelItem = (data: { index: number; item: UploadQueueItem; queueKey: UploadQueueKey }) => {
  uploadQueuesStore.stopItemUpload(data.queueKey, data.item, data.index)
}

const removeItem = (index: number) => {
  uploadQueuesStore.removeByIndex(props.queueKey, index)
}

const { showWarningT } = useAlerts()

const refreshItem = async (data: { index: number; assetId: DocId }) => {
  refreshDisabled.value = true
  try {
    const asset = await fetchAsset(damClient, data.assetId)
    if (asset.attributes.assetStatus === DamAssetStatus.WithFile) {
      await uploadQueuesStore.queueItemProcessed(asset.id)
    } else if (asset.mainFile?.fileAttributes.status === AssetFileProcessStatus.Duplicate) {
      await uploadQueuesStore.queueItemDuplicate(asset.id, asset.mainFile.originAssetFile, DamAssetType.Image)
    } else if (asset.mainFile?.fileAttributes.status === AssetFileProcessStatus.Failed) {
      await uploadQueuesStore.queueItemFailed(data.assetId, asset.mainFile.fileAttributes.failReason)
    } else {
      showWarningT('common.damImage.queueItem.stillUploadingOrProcessing')
    }
  } catch (e) {
    //
  } finally {
    refreshDisabled.value = false
  }
}

const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()

onMounted(() => {
  list.value.forEach((item) => {
    addToCachedKeywords(item.keywords)
    addToCachedAuthors(item.authors)
  })
  fetchCachedKeywords()
  fetchCachedAuthors()
})
</script>

<template>
  <div
    class="asset-queue-editable"
    :class="{ 'asset-queue-editable--sidebar-active': massOperations }"
  >
    <div class="asset-queue-editable__left">
      <div class="overflow-y-auto overflow-x-hidden h-100">
        <VRow class="dam-upload-queue dam-upload-queue--editable pa-2 mb-5">
          <UploadQueueItemEditable
            v-for="(item, index) in list"
            :key="item.key"
            v-model:custom-data="item.customData"
            v-model:keywords="item.keywords"
            v-model:authors="item.authors"
            v-model:main-file-single-use="item.mainFileSingleUse"
            :ext-system="extSystem"
            :item="item"
            :index="index"
            :queue-key="queueKey"
            :disable-done-animation="disableDoneAnimation"
            :refresh-disabled="refreshDisabled"
            @cancel-item="cancelItem"
            @remove-item="removeItem"
            @refresh-item="refreshItem"
            @show-detail="emit('showDetail', $event)"
          />
        </VRow>
      </div>
    </div>
    <div
      v-if="list.length > 0"
      class="asset-queue-editable__sidebar system-border-l"
    >
      <AssetQueueSelectedSidebar
        :queue-key="queueKey"
        :ext-system="extSystem"
      />
    </div>
  </div>
</template>
