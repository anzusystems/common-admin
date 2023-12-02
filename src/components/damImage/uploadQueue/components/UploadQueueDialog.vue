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
import { bulkUpdateAssetsMetadata } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import AFileInput from '@/components/file/AFileInput.vue'
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'

const props = withDefaults(
  defineProps<{
    queueKey: string
    fileInputKey: number
    accept: string | undefined
    maxSizes: Record<string, number> | undefined
  }>(),
  {
  }
)

const emit = defineEmits<{
  (e: 'onDrop', files: File[]): void
  (e: 'onFilesInput', files: File[]): void
  (e: 'onApply', items: ImageCreateUpdateAware[]): void
}>()

const { uploadQueueDialog, uploadQueueSidebar, toggleUploadQueueSidebar } = useUploadQueueDialog()

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
    await bulkUpdateAssetsMetadata(damClient, itemsRaw)
    emit(
      'onApply',
      itemsRaw.map((item) => {
        console.log(item)
        // todo take data from asset
        return {
          texts: {
            description: '',
            source: '',
          },
          dam: {
            damId: item.fileId ?? '',
            regionPosition: 0,
          },
          position: 1,
        }
      })
    )
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
                      {{ t('system.upload.add') }}
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
