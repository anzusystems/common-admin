<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AssetCustomData, DamAssetStatusDefault } from '@/types/coreDam/Asset'
import type { DocId, IntegerId } from '@/types/common'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  type UploadQueueKey,
} from '@/types/coreDam/UploadQueue'
import { AssetFileFailReason } from '@/types/coreDam/AssetFile'
import ATableCopyIdButton from '@/components/buttons/table/ATableCopyIdButton.vue'
import { prettyBytes } from '@/utils/file'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import AssetCustomMetadataForm from '@/components/damImage/uploadQueue/components/AssetCustomMetadataForm.vue'
import AssetImage from '@/components/damImage/uploadQueue/components/AssetImage.vue'
import AssetFileFailReasonChip from '@/components/damImage/uploadQueue/components/AssetFileFailReasonChip.vue'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import KeywordRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/keyword/KeywordRemoteAutocompleteWithCached.vue'
import { isNull } from '@/utils/common'
import { useDamKeywordAssetTypeConfig } from '@/components/damImage/uploadQueue/keyword/damKeywordConfig'
import { useDamAuthorAssetTypeConfig } from '@/components/damImage/uploadQueue/author/damAuthorConfig'

const props = withDefaults(
  defineProps<{
    index: number
    queueKey: string
    extSystem: IntegerId
    customData: AssetCustomData
    keywords: DocId[]
    authors: DocId[]
    item: UploadQueueItem
    mainFileSingleUse: boolean | null
    disableDoneAnimation?: boolean
  }>(),
  {
    disableDoneAnimation: false,
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

const showCancelStatuses: readonly UploadQueueItemStatusType[] = [
  UploadQueueItemStatus.Loading,
  UploadQueueItemStatus.Waiting,
  UploadQueueItemStatus.Uploading,
]
const showCancel = computed(() => {
  return showCancelStatuses.includes(props.item.status)
})

const showDetail = async () => {
  if (isNull(props.item.assetId)) return
  emit('showDetail', props.item.assetId)
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss,vue/no-ref-object-reactivity-loss
const { keywordRequired, keywordEnabled } = useDamKeywordAssetTypeConfig(assetType.value, props.extSystem)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss,vue/no-ref-object-reactivity-loss
const { authorRequired, authorEnabled } = useDamAuthorAssetTypeConfig(assetType.value, props.extSystem)
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
          <div
            v-if="item.error.hasError"
            :class="
              'dam-upload-queue__overlay dam-upload-queue__overlay--error ' +
                'd-flex align-center justify-center flex-column'
            "
          >
            <VIcon
              icon="mdi-alert"
              class="ma-1"
              size="x-small"
              color="error"
            />
            <div class="text-error">
              {{ t('common.damImage.queueItem.error') }}
            </div>
            <div
              v-if="item.error.message.length"
              class="text-caption"
              v-text="item.error.message"
            />
            <div v-else-if="item.error.assetFileFailReason !== AssetFileFailReason.None">
              <AssetFileFailReasonChip :reason="item.error.assetFileFailReason" />
            </div>
            <div
              v-else
              class="text-caption"
            >
              {{ t('common.damImage.uploadErrors.unknownError') }}
            </div>
          </div>
        </div>
        <VRow
          dense
          class="my-2"
        >
          <VCol>
            <div class="w-100 d-flex justify-space-between align-center">
              <div>
                <VBtn
                  size="small"
                  variant="text"
                  :disabled="!item.canEditMetadata"
                  @click.stop="showDetail"
                >
                  {{ t('common.damImage.queueItem.edit') }}
                </VBtn>
              </div>
              <div>
                <div v-if="item.isDuplicate" />
                <ATableCopyIdButton
                  v-if="item.assetId"
                  :id="item.assetId"
                  button-t="common.damImage.queueItem.copyAssetId"
                  size="small"
                />
                <VBtn
                  v-if="showCancel"
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
                <!--                <AActionDeleteButton-->
                <!--                  variant="icon"-->
                <!--                  :disabled="!item.canEditMetadata && !item.isDuplicate"-->
                <!--                  button-class=""-->
                <!--                  @delete-record="remove"-->
                <!--                />-->
              </div>
            </div>
          </VCol>
        </VRow>
        <VRow
          v-if="item.displayTitle"
          dense
          class="my-2 mb-3 mt-0 text-caption"
        >
          <VCol class="pt-0">
            {{ t('common.damImage.queueItem.displayTitle') }}: {{ item.displayTitle }}
            <span v-if="item.file?.size">&nbsp;({{ prettyBytes(item.file.size) }})</span>
          </VCol>
        </VRow>
        <VRow
          v-if="item.isDuplicate"
          class="text-caption text-warning"
        >
          <VCol class="pt-0">
            {{ t('common.damImage.asset.detail.info.status.duplicate') }}
          </VCol>
        </VRow>
        <VForm :disabled="!item.canEditMetadata">
          <AssetCustomMetadataForm
            v-if="item"
            v-model="customData"
            :ext-system="extSystem"
            :asset-type="assetType"
          >
            <template #after-pinned>
              <VRow
                v-if="keywordEnabled"
                dense
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
                      :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                      :disabled="!item.canEditMetadata"
                    />
                  </ASystemEntityScope>
                </VCol>
              </VRow>
              <VRow
                v-if="authorEnabled"
                dense
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
                      :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                      :disabled="!item.canEditMetadata"
                    />
                  </ASystemEntityScope>
                </VCol>
              </VRow>
              <VRow
                dense
                class="my-2"
              >
                <VCol>
                  <VSwitch
                    :label="t('common.damImage.asset.model.mainFileSingleUse')"
                    v-model="mainFileSingleUse"
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
