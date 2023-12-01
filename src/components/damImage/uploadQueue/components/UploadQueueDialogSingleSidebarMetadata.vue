<script lang="ts" setup>
import AssetDetailSidebarActionsWrapper from '@/components/damImage/uploadQueue/components/AssetDetailSidebarActionsWrapper.vue'
import { isNull } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { useAlerts } from '@/composables/system/alerts'
import useVuelidate from '@vuelidate/core'
import type { DocId } from '@/types/common'
import type { DamAssetType } from '@/types/coreDam/Asset'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { storeToRefs } from 'pinia'
import UploadQueueDialogSingleSidebarMetadataContent
  from '@/components/damImage/uploadQueue/components/UploadQueueDialogSingleSidebarMetadataContent.vue'

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
}>()

const { t } = useI18n()

// const assetDetailStore = useAssetDetailStore()
// const { asset } = storeToRefs(assetDetailStore)
// const uploadQueueStore = useUploadQueuesStore()

// const v$ = useVuelidate({}, {}, { $scope: AssetMetadataValidationScopeSymbol })
// const v$ = useVuelidate({}, {}, { $scope: 'replace' })

const onSave = async () => {
  emit('onSave')
}
</script>

<template>
  <AssetDetailSidebarActionsWrapper v-if="isActive">
    <ABtnPrimary
      type="submit"
      class="ml-2"
      data-cy="button-save"
      @click.stop="onSave"
    >
      {{ t('common.button.save') }}
    </ABtnPrimary>
  </AssetDetailSidebarActionsWrapper>
  <UploadQueueDialogSingleSidebarMetadataContent :queue-key="queueKey" />
</template>
