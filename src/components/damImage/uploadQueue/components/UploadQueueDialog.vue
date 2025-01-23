<script lang="ts" setup>
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import { useI18n } from 'vue-i18n'
import UploadQueueEditable from '@/components/damImage/uploadQueue/components/UploadQueueEditable.vue'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import { computed, ref, toRaw } from 'vue'
import { useTheme } from '@/composables/themeSettings'
import UploadQueueButtonStop from '@/components/damImage/uploadQueue/components/UploadQueueButtonStop.vue'
import useVuelidate from '@vuelidate/core'
import { useAlerts } from '@/composables/system/alerts'
import {
  type AssetMetadataBulkItem,
  bulkUpdateAssetsMetadata,
  fetchAsset,
} from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import AFileInput from '@/components/file/AFileInput.vue'
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { ImageStoreItem } from '@/types/ImageAware'
import type { DocId, IntegerId } from '@/types/common'
import { isNull, isString, isUndefined } from '@/utils/common'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { generateUUIDv1 } from '@/utils/generator'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { storeToRefs } from 'pinia'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'

const props = withDefaults(
  defineProps<{
    queueKey: string
    licenceId: IntegerId
    fileInputKey: number
    extSystem: IntegerId
    accept: string | undefined
    maxSizes: Record<string, number> | undefined
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'onDrop', files: File[]): void
  (e: 'onFilesInput', files: File[]): void
  (e: 'onApply', items: ImageStoreItem[]): void
}>()

const { uploadQueueDialog, uploadQueueSidebar, toggleUploadQueueSidebar } = useUploadQueueDialog()

const imageStore = useImageStore()
const { maxPosition } = storeToRefs(imageStore)
const uploadQueuesStore = useUploadQueuesStore()
const queueTotalCount = computed(() => {
  return uploadQueuesStore.getQueueTotalCount(props.queueKey)
})

const items = computed(() => {
  return uploadQueuesStore.getQueueItems(props.queueKey)
})

const queueProcessedCount = computed(() => {
  return uploadQueuesStore.getQueueProcessedCount(props.queueKey)
})

const isUploading = computed(() => {
  return queueTotalCount.value > queueProcessedCount.value
})

const isFinished = computed(() => {
  return queueTotalCount.value === queueProcessedCount.value
})

const { t } = useI18n()
const { toolbarColor } = useTheme()
const v$ = useVuelidate({ $stopPropagation: true })
const { showRecordWas, showValidationError, showErrorsDefault } = useAlerts()
const { damClient } = useCommonAdminCoreDamOptions()

const saveButtonLoading = ref(false)
const saveAndCloseButtonLoading = ref(false)

const onStopConfirm = async () => {
  uploadQueuesStore.stopUpload(props.queueKey)
  uploadQueueDialog.value = null
}

const onSave = async () => {
  const itemsRaw = toRaw(items.value)
  if (itemsRaw.length === 0) return
  saveButtonLoading.value = true
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    saveButtonLoading.value = false
    return
  }
  try {
    await bulkUpdateAssetsMetadata(damClient, itemsRaw)
    showRecordWas('updated')
  } catch (error) {
    console.error(error)
    showErrorsDefault(error)
  } finally {
    saveButtonLoading.value = false
  }
}

const metadataMap = async (
  queueItems: UploadQueueItem[],
  bulkItems: AssetMetadataBulkItem[]
): Promise<ImageStoreItem[]> => {
  const assetMetadataMap = new Map<DocId, { description: string; authorIds: DocId[] }>()
  const authorIdsToFetch = new Set<DocId>()
  const authorsMap = new Map<DocId, string>()
  try {
    bulkItems.forEach((bulkItem) => {
      assetMetadataMap.set(bulkItem.id, {
        description: isString(bulkItem.customData?.description) ? bulkItem.customData.description.trim() : '',
        authorIds: bulkItem.authors,
      })
    })
    assetMetadataMap.forEach((assetMeta) => {
      assetMeta.authorIds.forEach((authorId) => {
        authorIdsToFetch.add(authorId)
      })
    })
    if (authorIdsToFetch.size > 0) {
      const authorsRes = await fetchAuthorListByIds(damClient, props.extSystem, [...authorIdsToFetch])
      authorsRes.forEach((author) => {
        authorsMap.set(author.id, author.name)
      })
    }
  } catch (e) {
    showErrorsDefault(e)
  }

  const queueItemsWithAssetId = queueItems.filter(
    (queueItem) => !isNull(queueItem.assetId) && !isNull(queueItem.fileId)
  )

  return queueItemsWithAssetId.map((queueItem) => {
    maxPosition.value++
    const description = assetMetadataMap.get(queueItem.assetId!)?.description
    const authorIds = assetMetadataMap.get(queueItem.assetId!)?.authorIds
    const authorNames: string[] = []
    if (authorIds) {
      authorIds.forEach((authorId) => {
        const name = authorsMap.get(authorId)
        if (!isUndefined(name) && name.trim().length > 0) {
          authorNames.push(name)
        }
      })
    }

    return {
      key: generateUUIDv1(),
      texts: {
        description: description ?? '',
        source: authorNames.join(', '),
      },
      flags: {
        showSource: true,
      },
      dam: {
        damId: queueItem.fileId as DocId,
        regionPosition: 0,
        licenceId: props.licenceId,
      },
      position: maxPosition.value,
      damAuthors: authorIds || [],
      showDamAuthors: !!(authorIds && authorIds.length === 0),
      assetId: queueItem.assetId || undefined,
    }
  })
}

const onSaveAndApply = async () => {
  const itemsRaw = toRaw(items.value)
  if (itemsRaw.length === 0) return
  saveAndCloseButtonLoading.value = true
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    saveAndCloseButtonLoading.value = false
    return
  }
  try {
    const res = await bulkUpdateAssetsMetadata(damClient, itemsRaw)
    const mapped = await metadataMap(itemsRaw, res)
    emit('onApply', mapped)
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    saveAndCloseButtonLoading.value = false
  }
}

const assetDetailStore = useAssetDetailStore()
const { loading, dialog, updateUploadStore } = storeToRefs(assetDetailStore)

const showDetail = async (id: DocId) => {
  try {
    assetDetailStore.setAsset(null)
    loading.value = true
    dialog.value = props.queueKey
    updateUploadStore.value = true
    assetDetailStore.setAsset(await fetchAsset(damClient, id))
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="true"
    fullscreen
    class="overlay--sidebar"
  >
    <VCard>
      <div class="asset-footer__upload asset-footer--full asset-footer__upload--full pa-0">
        <div class="d-flex w-100 h-100 flex-column">
          <VToolbar
            class="w-100 system-border-b pr-1"
            :color="toolbarColor"
            density="compact"
            :height="64"
          >
            <div class="d-flex align-center px-2">
              <div>
                <div
                  v-if="isUploading"
                  class="text-subtitle-2 d-flex align-center"
                >
                  {{ t('common.damImage.upload.title') }}
                </div>
                <div
                  v-else
                  class="text-subtitle-2 d-flex align-center text-green-darken-3 font-weight-bold"
                >
                  {{ t('common.damImage.upload.titleDone') }}
                </div>
              </div>
            </div>
            <VSpacer />
            <div
              v-if="isUploading"
              class="text-caption d-flex align-center"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="16"
                width="2"
                class="mr-1"
              />
              <div>{{ t('common.damImage.upload.uploading') }} {{ queueProcessedCount + 1 }}/{{ queueTotalCount }}</div>
            </div>
            <div class="d-flex align-center pr-3">
              <VDivider
                v-show="isUploading"
                vertical
                class="mx-4 my-2"
              />
              <ABtnPrimary
                v-if="isFinished"
                :height="36"
                class="mr-2"
                rounded="pill"
                :loading="saveAndCloseButtonLoading"
                :disabled="saveButtonLoading"
                @click.stop="onSaveAndApply"
              >
                {{ t('common.damImage.upload.saveAndApply') }}
              </ABtnPrimary>
              <VBtn
                variant="text"
                :height="36"
                :width="36"
                class="mr-2"
                icon
                :loading="saveButtonLoading"
                :disabled="saveAndCloseButtonLoading"
                @click.stop="onSave"
              >
                <VIcon icon="mdi-content-save" />
                <VTooltip
                  activator="parent"
                  location="bottom"
                >
                  {{ t('common.damImage.upload.save') }}
                </VTooltip>
              </VBtn>
              <AFileInput
                :file-input-key="fileInputKey"
                :accept="accept"
                :max-sizes="maxSizes"
                multiple
                @files-input="emit('onFilesInput', $event)"
              >
                <template #activator="{ props: fileInputProps }">
                  <VBtn
                    tabindex="-1"
                    icon
                    variant="text"
                    :height="34"
                    :width="34"
                    v-bind="fileInputProps"
                  >
                    <VIcon icon="mdi-plus" />
                    <VTooltip
                      activator="parent"
                      location="bottom"
                    >
                      {{ t('common.damImage.upload.add') }}
                    </VTooltip>
                  </VBtn>
                </template>
              </AFileInput>
              <VDivider
                vertical
                class="mx-4 my-2"
              />
              <VBtn
                :height="36"
                :width="36"
                :active="uploadQueueSidebar"
                :variant="uploadQueueSidebar ? 'flat' : 'text'"
                :color="uploadQueueSidebar ? 'secondary' : ''"
                class="mr-2"
                icon
                @click.stop="toggleUploadQueueSidebar"
              >
                <VIcon icon="mdi-tag-text-outline" />
                <VTooltip
                  activator="parent"
                  location="bottom"
                >
                  {{ t('common.damImage.asset.massOperations.title') }}
                </VTooltip>
              </VBtn>
              <UploadQueueButtonStop
                data-cy="button-close"
                :button-size="36"
                :is-uploading="isUploading"
                @confirm="onStopConfirm"
              />
            </div>
          </VToolbar>
          <UploadQueueEditable
            :queue-key="queueKey"
            :ext-system="extSystem"
            :mass-operations="uploadQueueSidebar"
            @show-detail="showDetail"
          />
        </div>
        <AImageDropzone
          variant="fill"
          transparent
          hover-only
          :accept="accept"
          :max-sizes="maxSizes"
          @on-drop="emit('onDrop', $event)"
        />
      </div>
    </VCard>
  </VDialog>
</template>
