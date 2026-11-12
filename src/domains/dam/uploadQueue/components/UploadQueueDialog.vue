<script lang="ts" setup>
import {
  useUploadQueueDialog,
  useUploadQueueDialogDrawn,
} from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useI18n } from 'vue-i18n'
import UploadQueueEditable from '@/domains/dam/uploadQueue/components/UploadQueueEditable.vue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useTheme } from '@/domains/system/composables/themeSettings'
import UploadQueueButtonStop from '@/domains/dam/uploadQueue/components/UploadQueueButtonStop.vue'
import useVuelidate from '@vuelidate/core'
import { useAlerts } from '@/domains/system/composables/alerts'
import {
  type AssetMetadataBulkItem,
  bulkUpdateAssetsMetadata,
  fetchAsset,
  hasMetadataToSave,
  showMetadataSaveError,
} from '@/domains/dam/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import AFileInput from '@/domains/ui/file/components/AFileInput.vue'
import AImageDropzone from '@/domains/ui/file/components/AFileDropzone.vue'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'
import type { DocId, IntegerId } from '@/shared/types/common'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { generateUUIDv1 } from '@/shared/utils/generator'
import { mapUploadMetadataToImages } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import { storeToRefs } from 'pinia'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { isNull } from '@/shared/utils/common'

const props = withDefaults(
  defineProps<{
    queueKey: string
    licenceId: IntegerId
    fileInputKey: number
    extSystem: IntegerId
    accept: string | undefined
    maxSizes: Record<string, number> | undefined
    configName?: string
  }>(),
  {
    configName: undefined,
  }
)

const emit = defineEmits<{
  (e: 'drop', files: File[]): void
  (e: 'filesInput', files: File[]): void
  (e: 'apply', items: ImageStoreItem[]): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { uploadQueueDialog, uploadQueueDialogSaving, uploadQueueSidebar, toggleUploadQueueSidebar } =
  useUploadQueueDialog()

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

// Failed uploads and items still waiting for metadata have nothing to
// save. Without this check "save" would send nothing and report success.
const nothingToSave = computed(() => !items.value.some(hasMetadataToSave))
// "Save and apply" hands over the items with status uploaded, saved or not. Duplicates and copies count as uploaded.
// A failed item also has asset and file ids, but it is not an image to hand over.
const isUploaded = (item: UploadQueueItem) => item.status === UploadQueueItemStatus.Uploaded
const nothingToApply = computed(() => !items.value.some(isUploaded))
// An uploaded row whose metadata did not arrive because its notification is late or lost. Its form is disabled.
const isUploadedWithoutForm = (item: UploadQueueItem): item is UploadQueueItem & { assetId: DocId } =>
  isUploaded(item) && !item.canEditMetadata && !isNull(item.assetId)

const { t } = useI18n()
const { toolbarColor } = useTheme()
const { mdAndDown } = useDisplay()
const v$ = useVuelidate({ $stopPropagation: true })
const { showRecordWas, showValidationError, showErrorsDefault, showWarningT } = useAlerts()
const { damClient, endPointAsset, endPointAuthor, customUploadMetadataToImageMap } =
  useCommonAdminCoreDamOptions(damConfigName)

const saveButtonLoading = ref(false)
const saveAndCloseButtonLoading = ref(false)

// Exposed outside the dialog while either save runs, so the host
// accepts no file for this queue through its own entry points.
// The "+" and the dropzone here are disabled for the same reason.
// Reset when the dialog closes, also mid-save, because that save may end after another dialog has started its own.
watch(
  () => saveButtonLoading.value || saveAndCloseButtonLoading.value,
  (saving) => {
    uploadQueueDialogSaving.value = saving ? props.queueKey : null
  },
  { flush: 'sync' }
)
// A save and apply that waits for row reads stops there once the dialog has unmounted.
let disposed = false
onBeforeUnmount(() => {
  disposed = true
  if (uploadQueueDialogSaving.value === props.queueKey) uploadQueueDialogSaving.value = null
})
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
useUploadQueueDialogDrawn(props.queueKey)

const onStopConfirm = async () => {
  uploadQueuesStore.stopUpload(props.queueKey)
  uploadQueueDialog.value = null
}

const onSave = async () => {
  // The loading button still reacts to Enter and Space. This prevents sending a running save again.
  if (saveButtonLoading.value || saveAndCloseButtonLoading.value) return
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
    await bulkUpdateAssetsMetadata(damClient, endPointAsset, itemsRaw)
    showRecordWas('updated')
  } catch (error) {
    showMetadataSaveError(error, props.extSystem, damConfigName)
  } finally {
    saveButtonLoading.value = false
  }
}

const onSaveAndApply = async () => {
  if (saveButtonLoading.value || saveAndCloseButtonLoading.value) return
  const itemsRaw = toRaw(items.value)
  if (itemsRaw.length === 0) return
  saveAndCloseButtonLoading.value = true
  // The save skips a row without its form. Its image would be handed over without texts and its asset left unsaved.
  // Such rows are read once more, as their refresh does.
  // A form that arrives this way has not been seen by the user, so
  // nothing is saved or handed over until the button is pressed again.
  // If no form arrives, the save continues as before.
  const withoutForm = itemsRaw.filter(isUploadedWithoutForm)
  if (withoutForm.length > 0) {
    const shownFor = uploadQueueDialog.value
    await Promise.all(
      withoutForm.map((item) => uploadQueuesStore.refreshAsset(item.assetId, { queueKey: props.queueKey }))
    )
    // The dialog closed during the read and its queue was stopped and emptied. Nothing is saved or handed over.
    // Otherwise the save would go out for a queue the user has left.
    if (disposed || uploadQueueDialog.value !== shownFor) {
      saveAndCloseButtonLoading.value = false
      return
    }
    // A row given up meanwhile because its asset is gone ("Asset už
    // neexistuje.") is not handed over. The user is warned, as on refresh.
    // It may be given up by this read or by another one. A row
    // uploaded before the read could not have been given up earlier.
    if (withoutForm.some((item) => uploadQueuesStore.isGivenUpMissing(item))) {
      showWarningT('common.damImage.queueItem.assetGone')
    }
    if (withoutForm.some((item) => item.canEditMetadata)) {
      showWarningT('common.damImage.upload.metadataJustLoaded')
      saveAndCloseButtonLoading.value = false
      return
    }
  }
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    saveAndCloseButtonLoading.value = false
    return
  }
  try {
    let res: AssetMetadataBulkItem[]
    try {
      res = await bulkUpdateAssetsMetadata(damClient, endPointAsset, itemsRaw)
    } catch (error) {
      showMetadataSaveError(error, props.extSystem, damConfigName)
      return
    }
    const uploaded = itemsRaw.filter(isUploaded)
    const mappedItems = customUploadMetadataToImageMap
      ? await customUploadMetadataToImageMap(uploaded, res, damClient, props.extSystem, props.licenceId)
      : await mapUploadMetadataToImages(uploaded, res, damClient, props.extSystem, props.licenceId, endPointAuthor)
    // The save skips a row whose metadata never came, but its image is still handed over, without authors.
    // Its DAM authors are unknown. They are offered only for assets the save answered
    // for, otherwise the widget's picked authors would replace the asset's own.
    const savedAssetIds = new Set(res.map((saved) => saved.id))
    // No position is set here. The receiving widget assigns each image a position
    // after its last one, overriding any position an application mapping set.
    const storeItems: ImageStoreItem[] = mappedItems.map((item) => ({
      key: generateUUIDv1(),
      ...item,
      damAuthors: item.authorIds ?? [],
      showDamAuthors: !!item.assetId && savedAssetIds.has(item.assetId) && (item.authorIds ?? []).length === 0,
      assetId: item.assetId ?? undefined,
    }))
    emit('apply', storeItems)
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    saveAndCloseButtonLoading.value = false
  }
}

const assetDetailStore = useAssetDetailStore()
const { updateUploadStore } = storeToRefs(assetDetailStore)

const showDetail = async (id: DocId) => {
  updateUploadStore.value = true
  try {
    await assetDetailStore.open(props.queueKey, () => fetchAsset(damClient, endPointAsset, id))
  } catch (e) {
    showErrorsDefault(e)
  }
}
</script>

<template>
  <VDialog
    :model-value="true"
    fullscreen
    scrollable
    class="overlay--sidebar"
  >
    <VCard>
      <div class="asset-footer__upload asset-footer--full asset-footer__upload--full pa-0">
        <div class="d-flex w-100 h-100 flex-column">
          <VToolbar
            class="w-100 border-b pr-1"
            :color="toolbarColor"
            density="compact"
            :height="64"
            style="overflow-x: auto"
          >
            <div class="d-flex align-center px-2">
              <div>
                <div
                  v-if="isUploading"
                  class="text-label-large d-flex align-center"
                >
                  {{ t('common.damImage.upload.title') }}
                </div>
                <div
                  v-else
                  class="text-label-large d-flex align-center text-green-darken-3 font-weight-bold"
                >
                  {{ t('common.damImage.upload.titleDone') }}
                </div>
              </div>
            </div>
            <VSpacer />
            <div
              v-if="isUploading"
              class="text-body-small d-flex align-center"
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
                :disabled="saveButtonLoading || nothingToApply"
                @click.stop="onSaveAndApply"
              >
                {{ mdAndDown ? t('common.damImage.upload.apply') : t('common.damImage.upload.saveAndApply') }}
              </ABtnPrimary>
              <VBtn
                :aria-label="t('common.damImage.upload.save')"
                variant="text"
                :height="36"
                :width="36"
                class="mr-2 text-medium-emphasis"
                icon
                :loading="saveButtonLoading"
                :disabled="saveAndCloseButtonLoading || nothingToSave"
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
              <!--
                No file can be added while a save runs. "Save and apply" ends
                with the host closing the dialog and emptying its queue.
                A file added meanwhile would be dropped half uploaded, without notice.
              -->
              <AFileInput
                :file-input-key="fileInputKey"
                :accept="accept"
                :max-sizes="maxSizes"
                multiple
                @files-input="emit('filesInput', $event)"
              >
                <template #activator="{ props: fileInputProps }">
                  <VBtn
                    :aria-label="t('common.damImage.upload.add')"
                    icon
                    variant="text"
                    :height="34"
                    :width="34"
                    class="text-medium-emphasis"
                    :disabled="saveButtonLoading || saveAndCloseButtonLoading"
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
                :aria-label="t('common.damImage.asset.massOperations.title')"
                :height="36"
                :width="36"
                :active="uploadQueueSidebar"
                :variant="uploadQueueSidebar ? 'flat' : 'text'"
                :color="uploadQueueSidebar ? 'secondary' : ''"
                class="mr-2 text-medium-emphasis"
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
            :config-name="damConfigName"
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
          :disabled="saveButtonLoading || saveAndCloseButtonLoading"
          @drop="emit('drop', $event)"
        />
      </div>
    </VCard>
  </VDialog>
</template>
