<script setup lang="ts">
import { computed, onMounted, ref, onBeforeUnmount } from 'vue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { UploadQueueItem, UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import AssetQueueSelectedSidebar from '@/domains/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import type { DocId, IntegerId } from '@/shared/types/common'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useUploadQueueItemRefresh } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useEventListener } from '@vueuse/core'

const props = withDefaults(
  defineProps<{
    queueKey: string
    extSystem: IntegerId
    massOperations: boolean
    configName?: string
    disableDoneAnimation?: boolean
  }>(),
  {
    configName: 'default',
    disableDoneAnimation: false,
  }
)

const emit = defineEmits<{
  (e: 'showDetail', data: DocId): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { mainFileSingleUseEnabled } = useCommonAdminCoreDamOptions(props.configName)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { refreshing, refreshItem } = useUploadQueueItemRefresh(props.configName)

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

const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()

const scrollableContainer = ref<HTMLElement | null>(null)

const handleKeyboardNavigation = (e: KeyboardEvent) => {
  if (!scrollableContainer.value) return

  const container = scrollableContainer.value
  const scrollAmount = 100
  const pageScrollAmount = container.clientHeight - 50

  switch (e.key) {
    case 'ArrowDown':
      container.scrollTop += scrollAmount
      e.preventDefault()
      break
    case 'ArrowUp':
      container.scrollTop -= scrollAmount
      e.preventDefault()
      break
    case 'PageDown':
      container.scrollTop += pageScrollAmount
      e.preventDefault()
      break
    case 'PageUp':
      container.scrollTop -= pageScrollAmount
      e.preventDefault()
      break
    case 'Home':
      container.scrollTop = 0
      e.preventDefault()
      break
    case 'End':
      container.scrollTop = container.scrollHeight
      e.preventDefault()
      break
  }
}

let cleanup: (() => void) | undefined

onMounted(() => {
  list.value.forEach((item) => {
    addToCachedKeywords(item.keywords)
    addToCachedAuthors(item.authors)
  })
  fetchCachedKeywords()
  fetchCachedAuthors()

  cleanup = useEventListener(document, 'keydown', handleKeyboardNavigation)
})

onBeforeUnmount(() => {
  if (cleanup) {
    cleanup()
  }
})
</script>

<template>
  <div
    class="asset-queue-editable"
    :class="{ 'asset-queue-editable--sidebar-active': massOperations }"
  >
    <div class="asset-queue-editable__left">
      <div
        ref="scrollableContainer"
        class="overflow-y-auto overflow-x-hidden h-100 mr-md-4"
        style="outline: none"
      >
        <VRow class="dam-upload-queue dam-upload-queue--editable pa-2 mb-5">
          <UploadQueueItemEditable
            v-for="(item, index) in list"
            :key="item.key"
            v-model:custom-data="item.customData"
            v-model:keywords="item.keywords"
            v-model:authors="item.authors"
            v-model:main-file-single-use="item.mainFileSingleUse"
            :main-file-single-use-enabled="mainFileSingleUseEnabled"
            :ext-system="extSystem"
            :item="item"
            :index="index"
            :queue-key="queueKey"
            :disable-done-animation="disableDoneAnimation"
            :refresh-disabled="refreshing"
            @cancel-item="cancelItem"
            @remove-item="removeItem"
            @refresh-item="refreshItem($event.assetId)"
            @show-detail="emit('showDetail', $event)"
          />
        </VRow>
      </div>
    </div>
    <div
      v-if="list.length > 0"
      class="asset-queue-editable__sidebar border-s"
    >
      <AssetQueueSelectedSidebar
        :queue-key="queueKey"
        :ext-system="extSystem"
      />
    </div>
  </div>
</template>
