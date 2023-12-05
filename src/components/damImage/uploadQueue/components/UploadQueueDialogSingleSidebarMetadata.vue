<script lang="ts" setup>
import AssetDetailSidebarActionsWrapper from '@/components/damImage/uploadQueue/components/AssetDetailSidebarActionsWrapper.vue'
import { useI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import type { DocId } from '@/types/common'
import type { DamAssetType } from '@/types/coreDam/Asset'
import UploadQueueDialogSingleSidebarMetadataContent from '@/components/damImage/uploadQueue/components/UploadQueueDialogSingleSidebarMetadataContent.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'

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
  (e: 'postDelete', data: DocId): void
  (e: 'onSave'): void
  (e: 'onSaveAndApply'): void
}>()

const { t } = useI18n()

// const assetDetailStore = useAssetDetailStore()
// const { asset } = storeToRefs(assetDetailStore)
// const uploadQueueStore = useUploadQueuesStore()

const v$ = useVuelidate({}, {}, { $scope: ADamAssetMetadataValidationScopeSymbol })

const onSave = async () => {
  emit('onSave')
}

const onSaveAndApply = async () => {
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
      class="ml-2"
      data-cy="button-save-and-apply"
      @click.stop="onSaveAndApply"
    >
      Save and apply
    </ABtnPrimary>
  </AssetDetailSidebarActionsWrapper>
  <UploadQueueDialogSingleSidebarMetadataContent :queue-key="queueKey" />
</template>
