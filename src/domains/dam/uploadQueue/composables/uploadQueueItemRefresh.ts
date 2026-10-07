import { ref } from 'vue'
import { fetchAsset } from '@/domains/dam/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useAlerts } from '@/domains/system/composables/alerts'
import type { DocId } from '@/shared/types/common'

// How long an item of the queue waits before it offers refresh.
export const SHOW_REFRESH_AFTER_SECONDS = 20

/** The refresh of an item of the upload queue: asks what became of its file, and settles the item accordingly. */
export function useUploadQueueItemRefresh(configName = 'default') {
  const { damClient, endPointAsset } = useCommonAdminCoreDamOptions(configName)
  const uploadQueuesStore = useUploadQueuesStore()
  const { showWarningT } = useAlerts()
  const refreshing = ref(false)

  const refreshItem = async (assetId: DocId) => {
    refreshing.value = true
    try {
      const asset = await fetchAsset(damClient, endPointAsset, assetId)
      if (asset.mainFile?.fileAttributes.status === AssetFileProcessStatus.Processed) {
        await uploadQueuesStore.queueItemFullyProcessed(asset.id)
      } else if (asset.mainFile?.fileAttributes.status === AssetFileProcessStatus.Duplicate) {
        await uploadQueuesStore.queueItemDuplicate(asset.id, asset.mainFile.originAssetFile, DamAssetType.Image)
      } else if (asset.mainFile?.fileAttributes.status === AssetFileProcessStatus.Failed) {
        await uploadQueuesStore.queueItemFailed(assetId, asset.mainFile.fileAttributes.failReason)
      } else {
        showWarningT('common.damImage.queueItem.stillUploadingOrProcessing')
      }
    } catch (e) {
      //
    } finally {
      refreshing.value = false
    }
  }

  return { refreshing, refreshItem }
}
