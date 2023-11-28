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

withDefaults(
  defineProps<{
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
}>()

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { asset } = storeToRefs(assetDetailStore)
// const uploadQueueStore = useUploadQueuesStore()

const saveButtonLoading = ref(false)

const { showRecordWas, showValidationError, showErrorsDefault } = useAlerts()

// const v$ = useVuelidate({}, {}, { $scope: AssetMetadataValidationScopeSymbol })
const v$ = useVuelidate({}, {}, { $scope: 'replace' })

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
    // await updateAssetMetadata(asset.value)
    // if (view.value === 'queue') {
    //   uploadQueueStore.updateAssetMetadata(asset.value)
    // }
    showRecordWas('updated')
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    saveButtonLoading.value = false
  }
}

const onDelete = async () => {
  if (isNull(asset.value)) return
  try {
    // await deleteAsset(asset.value.id)
    showRecordWas('deleted')
    emit('postDelete', asset.value.id)
  } catch (error) {
    showErrorsDefault(error)
  }
}
</script>

<template>
  <AssetDetailSidebarActionsWrapper v-if="isActive">
    <!--    <AssetDownloadButton :asset-type="assetType" />-->
    <!--    <AActionDeleteButton @delete-record="onDelete" />-->
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
  <!--  <AssetMetadata />-->
</template>
