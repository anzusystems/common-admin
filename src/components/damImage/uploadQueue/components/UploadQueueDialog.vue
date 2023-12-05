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
import { type AssetMetadataBulkItem, bulkUpdateAssetsMetadata } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import AFileInput from '@/components/file/AFileInput.vue'
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import type { DocId, IntegerId } from '@/types/common'
import { isNull, isString, isUndefined } from '@/utils/common'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { generateUUIDv1 } from '@/utils/generator'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { storeToRefs } from 'pinia'

const props = withDefaults(
  defineProps<{
    queueKey: string
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
  (e: 'onApply', items: ImageCreateUpdateAware[]): void
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
const v$ = useVuelidate()
const { showRecordWas, showValidationError, showErrorsDefault } = useAlerts()
const { damClient } = useCommonAdminCoreDamOptions()

const saveButtonLoading = ref(false)
const saveAndCloseButtonLoading = ref(false)

const onStopConfirm = async () => {
  uploadQueuesStore.stopUpload(props.queueKey)
  uploadQueueDialog.value = false
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

const metadataMap = async (queueItems: UploadQueueItem[], bulkItems: AssetMetadataBulkItem[]) => {
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
    const authorNames: string[] = []
    assetMetadataMap.get(queueItem.assetId!)?.authorIds.forEach((authorId) => {
      const name = authorsMap.get(authorId)
      if (!isUndefined(name) && name.trim().length > 0) {
        authorNames.push(name)
      }
    })
    return {
      key: generateUUIDv1(),
      texts: {
        description: description ?? '',
        source: authorNames.join(', '),
      },
      dam: {
        damId: queueItem.fileId as DocId,
        regionPosition: 0,
      },
      position: maxPosition.value,
    }
  })
}

const onSaveAndApply = async () => {
  const itemsRaw = toRaw(items.value)
  if (itemsRaw.length === 0) return
  saveAndCloseButtonLoading.value = true
  v$.value.$touch()
  if (v$.value.$invalid) {
    console.log('invalid')
    showValidationError()
    saveAndCloseButtonLoading.value = false
    return
  }
  console.log(itemsRaw)
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
                  {{ t('coreDam.asset.upload.title') }}
                </div>
                <div
                  v-else
                  class="text-subtitle-2 d-flex align-center text-green-darken-3 font-weight-bold"
                >
                  {{ t('coreDam.asset.upload.titleDone') }}
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
              <div>{{ t('coreDam.asset.upload.uploading') }} {{ queueProcessedCount + 1 }}/{{ queueTotalCount }}</div>
            </div>
            <div class="d-flex align-center">
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
                {{ t('coreDam.asset.upload.saveAndClose') }}
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
                  {{ t('coreDam.asset.upload.save') }}
                </VTooltip>
              </VBtn>
              <AFileInput
                :file-input-key="fileInputKey"
                :accept="accept"
                :max-sizes="maxSizes"
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
                  {{ t('coreDam.asset.uploadQueueSidebar.title') }}
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
            :mass-operations="uploadQueueSidebar"
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
