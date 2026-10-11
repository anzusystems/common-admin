<script lang="ts" setup>
import { computed, onUnmounted, ref, type Ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AssetCustomData, DamAssetStatusDefault } from '@/domains/dam/types/Asset'
import type { DocId, IntegerId } from '@/shared/types/common'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import type { ValidationScope } from '@/shared/types/Validation'
import ATableCopyIdButton from '@/domains/ui/buttons/table/components/ATableCopyIdButton.vue'
import { prettyBytes } from '@/shared/utils/file'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import AssetCustomMetadataForm from '@/domains/dam/assetDetail/components/AssetCustomMetadataForm.vue'
import AssetImage from '@/domains/dam/assetDetail/components/AssetImage.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { isNull } from '@/shared/utils/common'
import { useDamKeywordAssetTypeConfig } from '@/domains/dam/keyword/composables/damKeywordConfig'
import { useDamAuthorAssetTypeConfig } from '@/domains/dam/author/composables/damAuthorConfig'
import AActionDeleteButton from '@/domains/ui/buttons/action/components/AActionDeleteButton.vue'
import { SHOW_REFRESH_AFTER_SECONDS } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import UploadQueueItemErrorOverlay from '@/domains/dam/uploadQueue/components/UploadQueueItemErrorOverlay.vue'
import type { DamFieldsDisabledAs } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'

const props = withDefaults(
  defineProps<{
    index: number
    queueKey: UploadQueueKey
    extSystem: IntegerId
    customData: AssetCustomData
    keywords: DocId[]
    authors: DocId[]
    item: UploadQueueItem
    refreshDisabled: boolean
    mainFileSingleUse: boolean | null
    mainFileSingleUseEnabled?: boolean
    disableDoneAnimation?: boolean
    /**
     * A failed row a refresh may still change: its finish request went out and the server has said nothing final
     * about it, or the original of its duplicate could not be read. The queue knows which rows those are; a row
     * shown outside a queue has no such state.
     */
    refreshMayHelp?: boolean
    /** Where "cancel" is offered. */
    cancelStatuses?: readonly UploadQueueItemStatusType[]
    /** The line "The main file is a duplicate." under the title. */
    duplicateNotice?: boolean
    /** The form stays off on a duplicate whatever its metadata. */
    disableFormOnDuplicate?: boolean
    /** The scope the fields of an editable row report to; a row that cannot be edited reports to none. */
    validationScope?: ValidationScope
    /** How keywords and authors look while the row cannot be edited; handed to both inputs as `disabledAs`. */
    disabledFieldsAs?: DamFieldsDisabledAs
    /** A duplicate gets no edit button at all: neither the `edit` slot nor its default is drawn. */
    hideEditOnDuplicate?: boolean
    /** Whether the row offers refresh, worked out by its host. Without it the row works it out itself. */
    refreshOffered?: boolean | undefined
  }>(),
  {
    mainFileSingleUseEnabled: true,
    disableDoneAnimation: false,
    refreshMayHelp: false,
    cancelStatuses: () => [
      UploadQueueItemStatus.Loading,
      UploadQueueItemStatus.Waiting,
      UploadQueueItemStatus.Uploading,
    ],
    duplicateNotice: true,
    disableFormOnDuplicate: false,
    validationScope: ADamAssetMetadataValidationScopeSymbol,
    disabledFieldsAs: 'chips',
    hideEditOnDuplicate: false,
    // Declared, or Vue would make an absent boolean `false` and the row would never offer refresh by itself.
    refreshOffered: undefined,
  }
)

const emit = defineEmits<{
  (e: 'update:customData', data: AssetCustomData): void
  (e: 'update:keywords', data: DocId[]): void
  (e: 'update:authors', data: DocId[]): void
  (e: 'update:mainFileSingleUse', data: boolean | null): void
  (e: 'cancelItem', data: { index: number; item: UploadQueueItem; queueKey: UploadQueueKey }): void
  (e: 'removeItem', index: number): void
  (e: 'showDetail', data: DocId): void
  (e: 'refreshItem', data: { index: number; assetId: DocId }): void
}>()

defineSlots<{
  /** Over the picture, under the error overlay. */
  'image-overlay'?(props: { item: UploadQueueItem }): unknown
  /** Left of the action line. Default: "Edit in Media Library", disabled without metadata, emits `showDetail`. */
  edit?(props: { item: UploadQueueItem }): unknown
  /** Last of the action line. Default: "Remove from queue" while it is offered, emits `removeItem`. */
  remove?(props: { item: UploadQueueItem; index: number; offered: boolean }): unknown
}>()

const IMAGE_ASPECT_RATIO = 16 / 9

const customData = computed({
  get() {
    return props.customData
  },
  set(newValue) {
    emit('update:customData', { ...props.customData, ...newValue })
  },
})

const keywords = computed({
  get() {
    return props.keywords
  },
  set(newValue) {
    emit('update:keywords', [...newValue])
  },
})

const authors = computed({
  get() {
    return props.authors
  },
  set(newValue) {
    emit('update:authors', [...newValue])
  },
})

const mainFileSingleUse = computed({
  get() {
    return props.mainFileSingleUse
  },
  set(newValue) {
    emit('update:mainFileSingleUse', newValue)
  },
})

const { t } = useI18n()

// The save skips an item whose metadata cannot be edited, so nothing in its row is validated: it could not be
// put right. A scope is read once, when a field is set up - hence the key on the form.
const metadataValidationScope = computed(() => {
  return props.item.canEditMetadata ? props.validationScope : false
})

const processingStatuses: readonly UploadQueueItemStatusType[] = [
  UploadQueueItemStatus.Processing,
  UploadQueueItemStatus.Loading,
]
const processing = computed(() => {
  return processingStatuses.includes(props.item.status)
})
const waiting = computed(() => {
  return props.item.status === UploadQueueItemStatus.Waiting
})
const done = computed(() => {
  return !props.disableDoneAnimation && props.item.status === UploadQueueItemStatus.Uploaded
})
const uploading = computed(() => {
  return props.item.status === UploadQueueItemStatus.Uploading
})
const uploadProgress = computed(() => {
  return props.item.progress.progressPercent
})

const imageSrc = computed(() => {
  return props.item.imagePreview ? props.item.imagePreview.url : undefined
})
const assetType = computed(() => {
  return props.item.assetType
})
const status = computed(() => {
  if (!props.item) return DamAssetStatusDefault
  return props.item.assetStatus
})

const cancelItem = () => {
  emit('cancelItem', { index: props.index, item: props.item, queueKey: props.queueKey })
}

const showCancel = computed(() => {
  return props.cancelStatuses.includes(props.item.status)
})

// Of a row that has not failed: offered once it has waited, for its file or for its metadata.
const refreshDue = ref(false)
const refreshTimer: Ref<ReturnType<typeof setTimeout> | undefined> = ref(undefined)
// A failed row offers refresh only while one may still change it. One whose chunk the server never took, or
// whose file the server has failed, has nothing a refresh could find.
const offeredByRow = computed(() => {
  if (props.item.status === UploadQueueItemStatus.Failed) return props.refreshMayHelp && !isNull(props.item.assetId)
  return refreshDue.value
})
const showRefresh = computed(() => {
  return props.refreshOffered ?? offeredByRow.value
})
// Remove comes with refresh, and a failed row has it at once: nothing else takes such a row out of the queue.
const showRemove = computed(() => {
  return showRefresh.value || props.item.status === UploadQueueItemStatus.Failed
})

const showDetail = async () => {
  if (isNull(props.item.assetId)) return
  emit('showDetail', props.item.assetId)
}

const refresh = () => {
  if (props.item.assetId) {
    emit('refreshItem', { index: props.index, assetId: props.item.assetId })
  }
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { keywordRequired, keywordEnabled } = useDamKeywordAssetTypeConfig(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  assetType.value,
  props.extSystem
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { authorRequired, authorEnabled } = useDamAuthorAssetTypeConfig(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  assetType.value,
  props.extSystem
)

watch(
  () => props.item.status,
  async (newValue) => {
    if (newValue === UploadQueueItemStatus.Uploading || newValue === UploadQueueItemStatus.Processing) {
      clearTimeout(refreshTimer.value)
      refreshTimer.value = setTimeout(() => {
        if (newValue === UploadQueueItemStatus.Uploading || newValue === UploadQueueItemStatus.Processing) {
          refreshDue.value = true
        }
      }, SHOW_REFRESH_AFTER_SECONDS * 1000)
    } else if (newValue === UploadQueueItemStatus.Uploaded) {
      clearTimeout(refreshTimer.value)
      refreshTimer.value = undefined
      refreshDue.value = false
      // An uploaded row whose metadata has not come by then has a disabled form, and the save skips it. Refresh
      // loads the metadata.
      refreshTimer.value = setTimeout(() => {
        if (props.item.status !== UploadQueueItemStatus.Uploaded || props.item.canEditMetadata) return
        refreshDue.value = true
      }, SHOW_REFRESH_AFTER_SECONDS * 1000)
    } else if (newValue === UploadQueueItemStatus.Failed) {
      // Its wait is over: what a failed row offers follows `refreshMayHelp`, at once.
      clearTimeout(refreshTimer.value)
      refreshTimer.value = undefined
      refreshDue.value = false
    }
  },
  { immediate: true }
)

watch(
  () => props.item.canEditMetadata,
  (canEdit) => {
    // The metadata of an uploaded row came after all, by its notification or by that refresh.
    if (canEdit && props.item.status === UploadQueueItemStatus.Uploaded) refreshDue.value = false
  }
)

onUnmounted(() => {
  clearTimeout(refreshTimer.value)
  refreshTimer.value = undefined
})
</script>

<template>
  <VCol
    xxl="2"
    xl="3"
    md="4"
    sm="6"
    cols="12"
  >
    <div class="dam-upload-queue__item">
      <div class="dam-upload-queue__item-card">
        <div class="position-relative">
          <AssetImage
            :asset-type="assetType"
            :asset-status="status"
            :src="imageSrc"
            background-color="#ccc"
            :show-uploading="uploading"
            :show-processing="processing"
            :show-waiting="waiting"
            :show-done="done"
            :uploading-progress="uploadProgress"
            :remaining-time="item.progress.remainingTime"
            use-component
            cover
            :aspect-ratio="IMAGE_ASPECT_RATIO"
          />
          <slot
            name="image-overlay"
            :item="item"
          />
          <UploadQueueItemErrorOverlay
            v-if="item.error.hasError"
            :error="item.error"
          />
        </div>
        <VRow
          density="compact"
          class="my-2"
        >
          <VCol>
            <div class="w-100 d-flex justify-space-between align-center">
              <div>
                <template v-if="!(hideEditOnDuplicate && item.isDuplicate)">
                  <slot
                    name="edit"
                    :item="item"
                  >
                    <VBtn
                      size="small"
                      variant="text"
                      :disabled="!item.canEditMetadata"
                      @click.stop="showDetail"
                    >
                      {{ t('common.damImage.image.button.editAsset') }}
                    </VBtn>
                  </slot>
                </template>
              </div>
              <div>
                <ATableCopyIdButton
                  v-if="item.assetId"
                  :id="item.assetId"
                  button-t="common.damImage.queueItem.copyAssetId"
                  size="small"
                />
                <VBtn
                  v-if="showRefresh"
                  :aria-label="t('common.button.refresh')"
                  icon
                  size="small"
                  variant="text"
                  :disabled="refreshDisabled"
                  @click.stop="refresh"
                >
                  <VIcon icon="mdi-refresh" />
                  <VTooltip
                    activator="parent"
                    location="bottom"
                  >
                    {{ t('common.button.refresh') }}
                  </VTooltip>
                </VBtn>
                <VBtn
                  v-if="showCancel"
                  :aria-label="t('common.button.cancel')"
                  icon
                  size="small"
                  variant="text"
                  @click.stop="cancelItem"
                >
                  <VIcon icon="mdi-close-circle-outline" />
                  <VTooltip
                    activator="parent"
                    location="bottom"
                  >
                    {{ t('common.button.cancel') }}
                  </VTooltip>
                </VBtn>
                <slot
                  name="remove"
                  :item="item"
                  :index="index"
                  :offered="showRemove"
                >
                  <AActionDeleteButton
                    v-if="showRemove"
                    variant="icon"
                    button-class=""
                    dialog-message-t="common.damImage.queueItem.removeFromQueue"
                    @delete-record="emit('removeItem', index)"
                  />
                </slot>
              </div>
            </div>
          </VCol>
        </VRow>
        <VRow
          v-if="item.displayTitle"
          density="compact"
          class="my-2 mb-3 mt-0 text-body-small"
        >
          <VCol class="pt-0">
            {{ t('common.damImage.queueItem.displayTitle') }}: {{ item.displayTitle }}
            <span v-if="item.file?.size">&nbsp;({{ prettyBytes(item.file.size) }})</span>
          </VCol>
        </VRow>
        <VRow
          v-if="duplicateNotice && item.isDuplicate"
          class="text-body-small text-warning"
        >
          <VCol class="pt-0">
            {{ t('common.damImage.asset.detail.info.status.duplicate') }}
          </VCol>
        </VRow>
        <VForm :disabled="!item.canEditMetadata || (disableFormOnDuplicate && item.isDuplicate)">
          <AssetCustomMetadataForm
            v-if="item"
            :key="item.canEditMetadata ? 'validated' : 'skipped'"
            v-model="customData"
            :ext-system="extSystem"
            :asset-type="assetType"
            :validation-scope="metadataValidationScope"
          >
            <template #after-pinned>
              <VRow
                v-if="keywordEnabled"
                density="compact"
                class="my-2"
              >
                <VCol>
                  <ASystemEntityScope
                    subject="keyword"
                    system="dam"
                  >
                    <KeywordRemoteAutocompleteWithCached
                      v-model="keywords"
                      :queue-id="queueKey"
                      :ext-system="extSystem"
                      :label="t('common.damImage.asset.model.keywords')"
                      clearable
                      multiple
                      :required="keywordRequired"
                      :validation-scope="metadataValidationScope"
                      :disabled="!item.canEditMetadata"
                      :disabled-as="disabledFieldsAs"
                    />
                  </ASystemEntityScope>
                </VCol>
              </VRow>
              <VRow
                v-if="authorEnabled"
                density="compact"
                class="my-2"
              >
                <VCol>
                  <ASystemEntityScope
                    subject="author"
                    system="dam"
                  >
                    <AuthorRemoteAutocompleteWithCached
                      v-model="authors"
                      :queue-id="queueKey"
                      :label="t('common.damImage.asset.model.authors')"
                      :author-conflicts="item.authorConflicts"
                      :ext-system="extSystem"
                      clearable
                      multiple
                      :required="authorRequired"
                      :validation-scope="metadataValidationScope"
                      :disabled="!item.canEditMetadata"
                      :disabled-as="disabledFieldsAs"
                    />
                  </ASystemEntityScope>
                </VCol>
              </VRow>
              <VRow
                v-if="mainFileSingleUseEnabled"
                density="compact"
                class="my-2"
              >
                <VCol>
                  <VSwitch
                    v-model="mainFileSingleUse"
                    :label="t('common.damImage.asset.model.mainFileSingleUse')"
                  />
                </VCol>
              </VRow>
            </template>
          </AssetCustomMetadataForm>
        </VForm>
      </div>
    </div>
  </VCol>
</template>
