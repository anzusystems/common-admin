<script lang="ts" setup>
import AssetDetailSidebarActionsWrapper from '@/components/damImage/uploadQueue/components/AssetDetailSidebarActionsWrapper.vue'
import { useI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import type { DamAssetType } from '@/types/coreDam/Asset'
import UploadQueueDialogSingleSidebarMetadataContent from '@/components/damImage/uploadQueue/components/UploadQueueDialogSingleSidebarMetadataContent.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { useAlerts } from '@/composables/system/alerts'

withDefaults(
  defineProps<{
    queueKey: string
    isActive: boolean
    dataCy?: string
    assetType: DamAssetType
  }>(),
  {
    dataCy: undefined,
  }
)
const emit = defineEmits<{
  (e: 'onSave'): void
  (e: 'onSaveAndApply'): void
}>()

const { t } = useI18n()

const v$ = useVuelidate({}, {}, { $scope: ADamAssetMetadataValidationScopeSymbol })

const { showValidationError } = useAlerts()

const onSave = async () => {
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return
  }
  emit('onSave')
}

const onSaveAndApply = async () => {
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return
  }
  emit('onSaveAndApply')
}
</script>

<template>
  <AssetDetailSidebarActionsWrapper v-if="isActive">
    <ABtnSecondary
      type="submit"
      class="ml-2"
      data-cy="button-save"
      @click.stop="onSave"
    >
      {{ t('common.button.save') }}
    </ABtnSecondary>
    <ABtnPrimary
      type="submit"
      class="mx-2"
      data-cy="button-save-and-apply"
      @click.stop="onSaveAndApply"
    >
      {{ t('common.damImage.upload.saveAndApply') }}
    </ABtnPrimary>
  </AssetDetailSidebarActionsWrapper>
  <UploadQueueDialogSingleSidebarMetadataContent :queue-key="queueKey" />
</template>
