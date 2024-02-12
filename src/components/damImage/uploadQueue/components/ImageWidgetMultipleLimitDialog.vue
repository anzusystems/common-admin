<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import type { ImageWidgetUploadConfig } from '@/types/ImageAware'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    uploadConfig: ImageWidgetUploadConfig
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'afterAdd'): void
}>()

const MAX_UPLOAD_ITEMS = 50
const dialog = ref(false)
const uploadDialogLoader = ref(false)
const fileCache = ref<File[]>([])

const { t } = useI18n()

const uploadQueuesStore = useUploadQueuesStore()

const uploadQueueTotalCount = computed(() => {
  return uploadQueuesStore.getQueueTotalCount(props.queueKey)
})

const alreadyAtUploadLimit = computed(() => {
  return uploadQueueTotalCount.value === MAX_UPLOAD_ITEMS
})

const openDialog = () => {
  dialog.value = true
}

const onDialogConfirm = async () => {
  uploadDialogLoader.value = true
  const files = fileCache.value.slice(0, MAX_UPLOAD_ITEMS - uploadQueueTotalCount.value)
  await uploadQueuesStore.addByFiles(props.queueKey, props.uploadConfig.extSystem, props.uploadConfig.licence, files)
  fileCache.value = []
  uploadDialogLoader.value = false
  dialog.value = false
  emit('afterAdd')
}

const onDialogCancel = () => {
  fileCache.value = []
  uploadQueuesStore.forceReloadFileInput(props.queueKey)
  dialog.value = false
}

const checkForLimit = (files: File[]) => {
  fileCache.value = files
  if (files.length + uploadQueueTotalCount.value > MAX_UPLOAD_ITEMS) {
    openDialog()
    return
  }
  onDialogConfirm()
}

defineExpose({
  check: checkForLimit,
})
</script>

<template>
  <VDialog
    v-model="dialog"
    :width="500"
  >
    <VCard
      v-if="dialog"
      data-cy="delete-panel"
    >
      <ADialogToolbar @on-cancel="onDialogCancel">
        {{ t('common.damImage.upload.limits.uploadWarning') }}
      </ADialogToolbar>
      <VCardText>
        <p v-if="alreadyAtUploadLimit">
          {{ t('common.damImage.upload.limits.onUploadLimit', { limit: MAX_UPLOAD_ITEMS }) }}
        </p>
        <p v-else>
          {{ t('common.damImage.upload.limits.addingOverLimit', { count: fileCache.length }) }}
          <span v-if="uploadQueueTotalCount > 0">{{
            t('common.damImage.upload.limits.countAlreadyInProgress', { count: uploadQueueTotalCount })
          }}</span>
          {{ t('common.damImage.upload.limits.onlyAllowedAtOnce', { count: MAX_UPLOAD_ITEMS }) }}<br><br>
          {{
            t('common.damImage.upload.limits.cancelOrUploadFirst', { count: MAX_UPLOAD_ITEMS - uploadQueueTotalCount })
          }}
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary @click.stop="onDialogCancel">
          {{ t('common.button.cancel') }}
        </ABtnTertiary>
        <ABtnPrimary
          v-if="!alreadyAtUploadLimit"
          :loading="uploadDialogLoader"
          @click.stop="onDialogConfirm"
        >
          {{
            t('common.damImage.upload.limits.actionAddFirstItems', { count: MAX_UPLOAD_ITEMS - uploadQueueTotalCount })
          }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
