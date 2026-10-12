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
// Saved before the server has processed the file, the form would write over what the server fills in from the file.
// The detail is not read again by itself: once the file is processed, the user opens it anew.
const saveBlocked = computed(() => !isNull(asset.value) && assetMetadataMayStillChange(asset.value))

const { showRecordWas, showValidationError } = useAlerts()

const v$ = useVuelidate({ $scope: ADamAssetMetadataValidationScopeSymbol, $stopPropagation: true })

const { damClient, endPointAsset } = useCommonAdminCoreDamOptions(damConfigName)

const onSave = async () => {
  // The spinning button still takes Enter and Space: a save that runs is not sent again.
  if (isNull(asset.value) || saveBlocked.value || saveButtonLoading.value) return
  saveButtonLoading.value = true
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    saveButtonLoading.value = false
    return
  }
  // One copy of what is saved, taken before it is sent, and the queue is told by that copy. The form is not locked
  // while the save runs, and the detail can be closed, or opened on another asset, before the answer: read then,
  // the rows of the queue got what was typed since as if it were saved, or nothing at all.
  const saved = cloneDeep(asset.value)
  const savedSingleUse = mainFileSingleUse.value
  const tellsQueue = updateUploadStore.value
  try {
    const sent = updateAssetMetadata(damClient, endPointAsset, saved, props.extSystem, savedSingleUse)
    // Kept where the host of the detail finds it: closed before the answer, the detail has its host wait for it.
    assetDetailStore.setSaving(sent)
    await sent
    if (tellsQueue) {
      await uploadQueueStore.updateFromDetail(saved, damConfigName, savedSingleUse)
    }
    showRecordWas('updated')
  } catch (error) {
    showMetadataSaveError(error, props.extSystem)
  } finally {
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
