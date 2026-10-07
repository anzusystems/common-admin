<script lang="ts" setup>
import AssetDetailSidebarActionsWrapper from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsWrapper.vue'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import useVuelidate from '@vuelidate/core'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import UploadQueueDialogSingleSidebarMetadataContent from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebarMetadataContent.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { IntegerId } from '@/shared/types/common'

const props = withDefaults(
  defineProps<{
    queueKey: string
    extSystem: IntegerId
    isActive: boolean
    dataCy?: string
    assetType: DamAssetTypeType
    configName?: string
    showRefresh?: boolean
    refreshDisabled?: boolean
  }>(),
  {
    dataCy: undefined,
    configName: 'default',
    showRefresh: false,
    refreshDisabled: false,
  }
)
const emit = defineEmits<{
  (e: 'save'): void
  (e: 'saveAndApply'): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()

const uploadQueuesStore = useUploadQueuesStore()

const canEditMetadata = computed(() => {
  const items = uploadQueuesStore.getQueueItems(props.queueKey)
  return items[0]?.canEditMetadata ?? false
})

const v$ = useVuelidate({ $scope: ADamAssetMetadataValidationScopeSymbol })

const { showValidationError } = useAlerts()

const onSave = async () => {
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return
  }
  emit('save')
}

const onSaveAndApply = async () => {
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return
  }
  emit('saveAndApply')
}
</script>

<template>
  <AssetDetailSidebarActionsWrapper
    v-if="isActive"
    :queue-key="queueKey"
  >
    <ABtnTertiary
      v-if="showRefresh"
      data-cy="button-refresh"
      :disabled="refreshDisabled"
      @click.stop="emit('refresh')"
    >
      {{ t('common.button.refresh') }}
    </ABtnTertiary>
    <ABtnSecondary
      type="submit"
      class="ml-2"
      data-cy="button-save"
      :disabled="!canEditMetadata"
      @click.stop="onSave"
    >
      {{ t('common.button.save') }}
    </ABtnSecondary>
    <ABtnPrimary
      type="submit"
      class="mx-2"
      data-cy="button-save-and-apply"
      :disabled="!canEditMetadata"
      @click.stop="onSaveAndApply"
    >
      {{ t('common.damImage.upload.saveAndApply') }}
    </ABtnPrimary>
  </AssetDetailSidebarActionsWrapper>
  <UploadQueueDialogSingleSidebarMetadataContent
    :queue-key="queueKey"
    :ext-system="extSystem"
    :config-name="configName"
  />
</template>
