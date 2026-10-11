<script lang="ts" setup>
import AssetDetailSidebarActionsWrapper from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsWrapper.vue'
import { isNull } from '@/shared/utils/common'
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
  if (isNull(asset.value) || saveBlocked.value) return
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
      await uploadQueueStore.updateFromDetail(asset.value, damConfigName)
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
