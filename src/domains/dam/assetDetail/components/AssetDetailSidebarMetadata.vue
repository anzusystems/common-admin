<script lang="ts" setup>
import AssetDetailSidebarActionsWrapper from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsWrapper.vue'
import { isNull } from '@/shared/utils/common'
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import useVuelidate from '@vuelidate/core'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { storeToRefs } from 'pinia'
import AssetMetadata from '@/domains/dam/assetDetail/components/AssetMetadata.vue'
import { updateAssetMetadata } from '@/domains/dam/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { IntegerId } from '@/shared/types/common'

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
    configName: 'default',
  }
)

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { asset, updateUploadStore, mainFileSingleUse } = storeToRefs(assetDetailStore)
const uploadQueueStore = useUploadQueuesStore()

const saveButtonLoading = ref(false)

const { showRecordWas, showValidationError, showErrorsDefault } = useAlerts()

const v$ = useVuelidate({ $scope: ADamAssetMetadataValidationScopeSymbol, $stopPropagation: true })

const { damClient, endPointAsset } = useCommonAdminCoreDamOptions()

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
    await updateAssetMetadata(damClient, endPointAsset, asset.value, props.extSystem, mainFileSingleUse.value)
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
  <AssetMetadata
    :ext-system="extSystem"
    :config-name="configName"
  />
</template>
