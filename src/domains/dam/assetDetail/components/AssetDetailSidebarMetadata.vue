<script lang="ts" setup>
import AssetDetailSidebarActionsWrapper from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsWrapper.vue'
import { cloneDeep, isNull } from '@/shared/utils/common'
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import useVuelidate from '@vuelidate/core'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { storeToRefs } from 'pinia'
import AssetMetadata from '@/domains/dam/assetDetail/components/AssetMetadata.vue'
import { showMetadataSaveError, updateAssetMetadata } from '@/domains/dam/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { IntegerId } from '@/shared/types/common'
import { assetMetadataMayStillChange } from '@/domains/dam/assetDetail/utils/assetMetadataMayStillChange'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    isActive: boolean
    dataCy?: string
    assetType: DamAssetTypeType
    extSystem: IntegerId
    configName?: string
  }>(),
  {
    dataCy: undefined,
    configName: undefined,
  }
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { asset, updateUploadStore, mainFileSingleUse } = storeToRefs(assetDetailStore)
const uploadQueueStore = useUploadQueuesStore()

const saveButtonLoading = ref(false)
// Saving before the server has processed the file would overwrite the metadata the server extracts from it.
// The detail is not reloaded automatically. The user reopens it after processing.
const saveBlocked = computed(() => !isNull(asset.value) && assetMetadataMayStillChange(asset.value))

const { showRecordWas, showValidationError } = useAlerts()

const v$ = useVuelidate({ $scope: ADamAssetMetadataValidationScopeSymbol, $stopPropagation: true })

const { damClient, endPointAsset } = useCommonAdminCoreDamOptions(damConfigName)

const onSave = async () => {
  // The loading button still reacts to Enter and Space. This prevents sending a running save again.
  if (isNull(asset.value) || saveBlocked.value || saveButtonLoading.value) return
  saveButtonLoading.value = true
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    saveButtonLoading.value = false
    return
  }
  // Snapshot the asset before sending and update the queue from that snapshot.
  // The form is not locked during the save, and the detail can
  // be closed or switched to another asset before the response.
  // Reading the live state then gave the queue rows unsaved input, or nothing.
  const saved = cloneDeep(asset.value)
  const savedSingleUse = mainFileSingleUse.value
  const tellsQueue = updateUploadStore.value
  // Queue rows as of pressing save. Input typed into them while the save runs must not be overwritten.
  const rowsAtSave = tellsQueue ? uploadQueueStore.noteRowsOfAsset(saved.id, damConfigName) : undefined
  try {
    const sent = updateAssetMetadata(damClient, endPointAsset, saved, props.extSystem, savedSingleUse)
    // Registered for the host. If the detail closes before the response, the host waits for this save.
    assetDetailStore.setSaving(saved.id, sent, damConfigName)
    await sent
    if (tellsQueue) {
      await uploadQueueStore.updateFromDetail(saved, damConfigName, savedSingleUse, rowsAtSave)
    }
    showRecordWas('updated')
  } catch (error) {
    showMetadataSaveError(error, props.extSystem, damConfigName)
  } finally {
    // After a failed save nothing uses the note. After a successful write it has already been released.
    if (rowsAtSave) uploadQueueStore.forgetRowsNote(rowsAtSave)
    saveButtonLoading.value = false
  }
}
</script>

<template>
  <AssetDetailSidebarActionsWrapper
    v-if="isActive"
    :queue-key="queueKey"
  >
    <ABtnPrimary
      type="submit"
      class="ml-2"
      data-cy="button-save"
      :loading="saveButtonLoading"
      :disabled="saveBlocked"
      @click.stop="onSave"
    >
      {{ t('common.button.save') }}
    </ABtnPrimary>
  </AssetDetailSidebarActionsWrapper>
  <div
    v-if="isActive && saveBlocked"
    class="text-body-small px-4 pt-2"
    data-cy="save-blocked"
  >
    {{ t('common.damImage.queueItem.stillUploadingOrProcessing') }}
  </div>
  <AssetMetadata
    :ext-system="extSystem"
    :config-name="damConfigName"
  />
</template>
