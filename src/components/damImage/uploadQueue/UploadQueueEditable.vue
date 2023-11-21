<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import UploadQueueItemEditable from '@/components/damImage/uploadQueue/UploadQueueItemEditable.vue'

const props = withDefaults(
  defineProps<{
    queueKey: string
    massOperations: boolean
    disableDoneAnimation?: boolean
  }>(),
  {
    disableDoneAnimation: false,
  }
)

const uploadQueuesStore = useUploadQueuesStore()

const list = computed(() => {
  return uploadQueuesStore.getQueueItems(props.queueKey)
})

const cancelItem = (data: { index: number; item: UploadQueueItem; queueId: string }) => {
  uploadQueuesStore.stopItemUpload(data.queueId, data.item, data.index)
}

const removeItem = (index: number) => {
  uploadQueuesStore.removeByIndex(props.queueKey, index)
}

// const { addToCachedKeywords, fetchCachedKeywords } = useCachedKeywords()
// const { addToCachedAuthors, fetchCachedAuthors } = useCachedAuthors()

onMounted(() => {
  list.value.forEach((item) => {
    // addToCachedKeywords(item.keywords)
    // addToCachedAuthors(item.authors)
  })
  // fetchCachedKeywords()
  // fetchCachedAuthors()
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
            v-model:customData="item.customData"
            v-model:keywords="item.keywords"
            v-model:authors="item.authors"
            :item="item"
            :index="index"
            :queue-key="queueKey"
            :disable-done-animation="disableDoneAnimation"
            @cancel-item="cancelItem"
            @remove-item="removeItem"
          />
        </VRow>
      </div>
    </div>
    <div
      v-if="list.length > 1"
      class="asset-queue-editable__sidebar system-border-l"
    >
      <!--      <AssetQueueSelectedSidebar :queue-key="queueKey" />-->
    </div>
  </div>
</template>
