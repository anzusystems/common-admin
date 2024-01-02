<script lang="ts" setup>
import AssetDetailSidebarActionsWrapper from '@/components/damImage/uploadQueue/components/AssetDetailSidebarActionsWrapper.vue'
import { isNull } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { useAlerts } from '@/composables/system/alerts'
import useVuelidate from '@vuelidate/core'
import type { DamAssetType } from '@/types/coreDam/Asset'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { storeToRefs } from 'pinia'
import AssetMetadata from '@/components/damImage/uploadQueue/components/AssetMetadata.vue'
import { updateAssetMetadata } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { ADamAssetMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    isActive: boolean
    dataCy?: string
    assetType: DamAssetType
    extSystem: IntegerId
  }>(),
  {
    dataCy: undefined,
  }
)

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { asset, updateUploadStore } = storeToRefs(assetDetailStore)
const uploadQueueStore = useUploadQueuesStore()

const saveButtonLoading = ref(false)

const { showRecordWas, showValidationError, showErrorsDefault } = useAlerts()

const v$ = useVuelidate({}, {}, { $scope: ADamAssetMetadataValidationScopeSymbol })

const { damClient } = useCommonAdminCoreDamOptions()

const onSave = async () => {
  if (isNull(asset.value)) return
  saveButtonLoading.value = true
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    saveButtonLoading.value = false
    return
  }
  try {
    await updateAssetMetadata(damClient, asset.value, props.extSystem)
    if (updateUploadStore.value && !isNull(asset.value)) {
      await uploadQueueStore.updateFromDetail(asset.value)
    }
    showRecordWas('updated')
  } catch (error) {
    showErrorsDefault(error)
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
      @click.stop="onSave"
    >
      {{ t('common.button.save') }}
    </ABtnPrimary>
  </AssetDetailSidebarActionsWrapper>
  <AssetMetadata :ext-system="extSystem" />
</template>
