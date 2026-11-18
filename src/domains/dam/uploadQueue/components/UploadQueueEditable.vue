<script setup lang="ts">
import { computed, onMounted, ref, onBeforeUnmount } from 'vue'
import type { UploadQueueItem, UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import AssetQueueSelectedSidebar from '@/domains/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue'
import type { DocId, IntegerId } from '@/shared/types/common'
import {
  type UploadQueueListBinding,
  useLibraryUploadQueueListBinding,
} from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { createUploadQueueItemRefresh } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useEventListener } from '@vueuse/core'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    extSystem: IntegerId
    massOperations: boolean
    configName?: string
    disableDoneAnimation?: boolean
    /** What the list needs from its host. Without it the library store, caches, alerts and options are used. */
    queue?: UploadQueueListBinding
    /** Minimum row count at which the mass operations are shown beside the list. */
    massOperationsFrom?: number
    /** Arrow keys, PageUp, PageDown, Home and End scroll the list. */
    keyboardScroll?: boolean
  }>(),
  {
    configName: undefined,
    disableDoneAnimation: false,
    queue: undefined,
    massOperationsFrom: 1,
    keyboardScroll: true,
  }
)

const emit = defineEmits<{
  (e: 'showDetail', data: DocId): void
}>()

defineSlots<{
  /** Default: the library row, with its v-models on the item. */
  item?(props: {
    item: UploadQueueItem
    index: number
    refreshDisabled: boolean
    refresh: () => void
    refreshMayHelp: boolean
  }): unknown
  /**
   * Default: the library mass operations of `queueKey`, using the library store even when `queue` is bound.
   * A host with its own store passes its sidebar here, as admin-dam does.
   */
  sidebar?(props: { queueKey: UploadQueueKey }): unknown
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

// Created only when the host binds none, so a list with its own binding touches nothing of the library.
const queue = props.queue ?? useLibraryUploadQueueListBinding(() => props.queueKey, damConfigName)

const { refreshing, refreshItem } = createUploadQueueItemRefresh(queue)

const list = computed(() => {
  return queue.items()
})

const scrollableContainer = ref<HTMLElement | null>(null)

// Inputs that ignore these keys, such as a switch. On them the keys still scroll the list.
const KEYLESS_INPUT_TYPES = ['checkbox', 'button', 'submit', 'reset', 'image', 'file']

// A key typed into a row field moves its caret or value. It is left to the browser and the list does not scroll.
const isTypedIntoField = (target: EventTarget | null) =>
  (target instanceof HTMLInputElement && !KEYLESS_INPUT_TYPES.includes(target.type)) ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable)

// The same for a key pressed in an open menu, such as a field's menu: it navigates that menu.
// Other overlays, such as the containing dialog or a snackbar, leave the keys to the list.
const isInMenu = (target: EventTarget | null) => target instanceof Element && !!target.closest('.v-menu')

const handleKeyboardNavigation = (e: KeyboardEvent) => {
  if (!scrollableContainer.value || isTypedIntoField(e.target) || isInMenu(e.target)) return

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
  queue.prime(list.value)

  if (props.keyboardScroll) cleanup = useEventListener(document, 'keydown', handleKeyboardNavigation)
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
          <template
            v-for="(item, index) in list"
            :key="item.key"
          >
            <slot
              name="item"
              :item="item"
              :index="index"
              :refresh-disabled="refreshing"
              :refresh="() => refreshItem(item)"
              :refresh-may-help="queue.refreshMayHelp(item)"
            >
              <UploadQueueItemEditable
                v-model:custom-data="item.customData"
                v-model:keywords="item.keywords"
                v-model:authors="item.authors"
                v-model:main-file-single-use="item.mainFileSingleUse"
                :main-file-single-use-enabled="queue.mainFileSingleUseEnabled"
                :ext-system="extSystem"
                :item="item"
                :index="index"
                :queue-key="queueKey"
                :disable-done-animation="disableDoneAnimation"
                :refresh-disabled="refreshing"
                :refresh-may-help="queue.refreshMayHelp(item)"
                @cancel-item="queue.cancel($event.item, $event.index, $event.queueKey)"
                @remove-item="queue.remove($event)"
                @refresh-item="refreshItem(item)"
                @show-detail="emit('showDetail', $event)"
              />
            </slot>
          </template>
        </VRow>
      </div>
    </div>
    <div
      v-if="list.length >= massOperationsFrom"
      class="asset-queue-editable__sidebar border-s"
    >
      <slot
        name="sidebar"
        :queue-key="queueKey"
      >
        <AssetQueueSelectedSidebar
          :queue-key="queueKey"
          :ext-system="extSystem"
        />
      </slot>
    </div>
  </div>
</template>
